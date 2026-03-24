import { Router } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';

import { createHistoryAssetForUser, mapHistoryRowsForUser, type HistoryKind } from '../classroom/migration.store.js';
import { linkResultDocumentForUser } from '../classroom/resultsDocuments.store.js';
import { upsertSchoolProfile } from '../schools/schoolProfile.store.js';
import { uploadAssetToStorage, uploadVideoToYouTube } from './uploadProviders.js';

export const uploadsRouter = Router();

const upload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 6 * 1024 * 1024 },
});

const videoUpload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 512 * 1024 * 1024 },
});

type UploadedFile = {
	mimetype?: string;
	buffer: Buffer;
	originalname?: string;
	fieldname?: string;
	size?: number;
};

function readUploadedFile(req: any): UploadedFile | null {
	if (req.file) return req.file as UploadedFile;
	const files = req.files as UploadedFile[] | Record<string, UploadedFile[]> | undefined;
	if (!files) return null;
	if (Array.isArray(files)) return files[0] || null;
	for (const value of Object.values(files)) {
		if (Array.isArray(value) && value[0]) return value[0];
	}
	return null;
}

function requireSchoolId(req: any) {
	const user = req.user;
	if (!user) {
		const error = new Error('Unauthenticated') as Error & { status?: number };
		error.status = 401;
		throw error;
	}
	const schoolId = String(req.body?.school_id || user.school_id || '').trim();
	if (!schoolId) {
		const error = new Error('school_id is required') as Error & { status?: number };
		error.status = 400;
		throw error;
	}
	if (schoolId !== String(user.school_id || '').trim()) {
		const error = new Error('Forbidden') as Error & { status?: number };
		error.status = 403;
		throw error;
	}
	return { user, schoolId };
}

async function handleGenericAssetUpload(req: any, res: any, folder: string, allowedPrefix: string, filenamePrefix: string) {
	try {
		const { schoolId } = requireSchoolId(req);
		const file = readUploadedFile(req);
		if (!file) return res.status(400).json({ error: 'file upload is required' });
		if (!String(file.mimetype || '').toLowerCase().startsWith(allowedPrefix)) {
			return res.status(400).json({ error: `Only ${allowedPrefix.replace('/', '')} uploads are allowed for this endpoint.` });
		}
		const uploaded = await uploadAssetToStorage({ schoolId, folder, filenamePrefix, mimeType: file.mimetype, buffer: file.buffer });
		return res.json({ ok: true, url: uploaded.url, provider: uploaded.provider, key: uploaded.key });
	} catch (error) {
		const status = typeof error === 'object' && error && 'status' in error ? Number((error as { status?: number }).status) : 500;
		return res.status(status || 500).json({ error: error instanceof Error ? error.message : 'Upload failed.' });
	}
}

function hasAllowedRole(user: any, allowedRoles: string[]) {
	const role = String(user?.activeRole || user?.roles?.[0] || '').trim().toLowerCase();
	return allowedRoles.includes(role);
}

function detectMigrationSourceType(file: UploadedFile) {
	const mime = String(file.mimetype || '').toLowerCase();
	const name = String(file.originalname || '').toLowerCase();
	if (mime === 'text/csv' || name.endsWith('.csv')) return 'csv' as const;
	if (mime.includes('spreadsheetml') || mime.includes('excel') || name.endsWith('.xlsx') || name.endsWith('.xls')) return 'xlsx' as const;
	if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'pdf' as const;
	if (mime.includes('wordprocessingml') || name.endsWith('.docx')) return 'docx' as const;
	if (mime.includes('msword') || name.endsWith('.doc')) return 'doc' as const;
	return null;
}

function parseCsvRows(buffer: Buffer) {
	const text = buffer.toString('utf8').replace(/\r/g, '').trim();
	if (!text) return [] as Record<string, string>[];
	const rows = text.split('\n').map((line) => line.split(',').map((part) => part.trim().replace(/^"|"$/g, '')));
	const headers = rows[0] || [];
	return rows.slice(1).filter((row) => row.some(Boolean)).map((row) => Object.fromEntries(headers.map((header, index) => [header || `column_${index + 1}`, row[index] || ''])));
}

function parseXlsxRows(buffer: Buffer) {
	const workbook = XLSX.read(buffer, { type: 'buffer' });
	const firstSheet = workbook.SheetNames[0];
	if (!firstSheet) return [] as Record<string, string>[];
	return XLSX.utils.sheet_to_json<Record<string, string>>(workbook.Sheets[firstSheet], { defval: '' }).map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [String(key), String(value ?? '')])));
}

function normalizeHistoryKind(value: unknown): HistoryKind {
	const normalized = String(value || '').trim().toLowerCase();
	if (normalized === 'old-results') return 'old-results';
	if (normalized === 'alumni') return 'alumni';
	if (normalized === 'admission-register') return 'admission-register';
	if (normalized === 'legacy-directory') return 'legacy-directory';
	if (normalized === 'staff-history') return 'staff-history';
	if (normalized === 'parent-history') return 'parent-history';
	return 'general-history';
}

uploadsRouter.post('/result-document', upload.single('file'), async (req, res) => {
	try {
		const request = req as any;
		const { user, schoolId } = requireSchoolId(request);
		if (!hasAllowedRole(user, ['teacher', 'school admin', 'hos', 'owner', 'ict', 'ict manager', 'admin', 'principal', 'head teacher', 'sectional head', 'head of section'])) {
			return res.status(403).json({ error: 'Your current role cannot upload result documents.' });
		}
		const file = readUploadedFile(request);
		if (!file) return res.status(400).json({ error: 'A PDF, DOC, or DOCX result file is required.' });
		const sourceType = detectMigrationSourceType(file);
		if (!sourceType || !['pdf', 'doc', 'docx'].includes(sourceType)) {
			return res.status(400).json({ error: 'Only PDF, DOC, and DOCX files are allowed for result uploads.' });
		}
		const uploaded = await uploadAssetToStorage({ schoolId, folder: 'results', filenamePrefix: 'result', mimeType: file.mimetype, buffer: file.buffer });
		const record = await linkResultDocumentForUser(user, {
			studentRef: String(req.body?.studentRef || '').trim() || undefined,
			sourceName: String(file.originalname || 'result-document'),
			session: String(req.body?.session || '').trim() || undefined,
			term: String(req.body?.term || '').trim() || undefined,
			mimeType: String(file.mimetype || 'application/octet-stream'),
			url: uploaded.url,
		});
		return res.status(201).json({ ok: true, document: record, provider: uploaded.provider });
	} catch (error) {
		const status = typeof error === 'object' && error && 'status' in error ? Number((error as { status?: number }).status) : 500;
		return res.status(status || 500).json({ error: error instanceof Error ? error.message : 'Result upload failed.' });
	}
});


async function handleHistoryAssetUpload(req: any, res: any) {
	try {
		const request = req as any;
		const { user, schoolId } = requireSchoolId(request);
		if (!hasAllowedRole(user, ['hos', 'owner', 'tenant school owner'])) {
			return res.status(403).json({ error: 'Your current role cannot upload history files.' });
		}
		const file = readUploadedFile(request);
		if (!file) return res.status(400).json({ error: 'A history file is required.' });
		const sourceType = detectMigrationSourceType(file);
		const historyKind = normalizeHistoryKind(request.body?.historyKind);
		if (!sourceType) {
			return res.status(400).json({ error: 'Only PDF, DOC, DOCX, CSV, and Excel files are allowed for history uploads.' });
		}
		const uploaded = await uploadAssetToStorage({ schoolId, folder: 'history', filenamePrefix: 'history', mimeType: file.mimetype, buffer: file.buffer });
		const rows = sourceType === 'csv' ? parseCsvRows(file.buffer) : sourceType === 'xlsx' ? parseXlsxRows(file.buffer) : [];
		const mappedUsers = rows.length ? await mapHistoryRowsForUser(user, rows, historyKind) : [];
		const asset = await createHistoryAssetForUser(user, {
			fileName: String(file.originalname || 'history-file'),
			mimeType: String(file.mimetype || 'application/octet-stream'),
			fileSize: Number(file.size || file.buffer.length || 0),
			url: uploaded.url,
			sourceType,
			historyKind,
			mappedUsers,
			status: rows.length ? 'processed' : 'manual-review',
		});
		return res.status(201).json({
			ok: true,
			asset,
			mappedCount: mappedUsers.filter((entry) => entry.status === 'mapped').length,
			unmatchedCount: mappedUsers.filter((entry) => entry.status === 'unmatched').length,
			provider: uploaded.provider,
		});
	} catch (error) {
		const status = typeof error === 'object' && error && 'status' in error ? Number((error as { status?: number }).status) : 500;
		return res.status(status || 500).json({ error: error instanceof Error ? error.message : 'History upload failed.' });
	}
}

uploadsRouter.post('/history-asset', upload.single('file'), handleHistoryAssetUpload);
uploadsRouter.post('/migration-asset', upload.single('file'), handleHistoryAssetUpload);

uploadsRouter.post('/logo', upload.single('logo'), async (req, res) => {
	const request = req as any;
	const user = request.user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });

	const schoolId = String(req.body?.school_id || user.school_id || '').trim();
	if (!schoolId) return res.status(400).json({ error: 'school_id is required' });
	if (schoolId !== String(user.school_id || '').trim()) return res.status(403).json({ error: 'Forbidden' });
	const file = readUploadedFile(request);
	if (!file) return res.status(400).json({ error: 'logo file is required' });
	if (!String(file.mimetype || '').startsWith('image/')) {
		return res.status(400).json({ error: 'Only image uploads are allowed for logos.' });
	}

	const uploaded = await uploadAssetToStorage({
		schoolId,
		folder: 'branding',
		filenamePrefix: 'logo',
		mimeType: file.mimetype,
		buffer: file.buffer,
	});

	await upsertSchoolProfile({ schoolId, logoUrl: uploaded.url });

	return res.json({
		ok: true,
		url: uploaded.url,
		provider: uploaded.provider,
		urls: {
			original: uploaded.url,
			large: uploaded.url,
		},
	});
});
uploadsRouter.post('/user-avatar', upload.any(), async (req, res) => handleGenericAssetUpload(req, res, 'avatars', 'image/', 'avatar'));
uploadsRouter.post('/payment-proof', upload.any(), async (req, res) => handleGenericAssetUpload(req, res, 'payment-proofs', 'image/', 'payment-proof'));
uploadsRouter.post('/media', upload.any(), async (req, res) => handleGenericAssetUpload(req, res, 'media', 'image/', 'media'));
uploadsRouter.post('/classroom-asset', upload.any(), async (req, res) => handleGenericAssetUpload(req, res, 'classroom-assets', 'image/', 'classroom-asset'));
uploadsRouter.post('/live-class-recording', videoUpload.any(), async (req, res) => {
	try {
		const { schoolId } = requireSchoolId(req);
		const file = readUploadedFile(req);
		if (!file) return res.status(400).json({ error: 'video file is required' });
		if (!String(file.mimetype || '').toLowerCase().startsWith('video/')) {
			return res.status(400).json({ error: 'Only video uploads are allowed for live class recordings.' });
		}
		const uploaded = await uploadVideoToYouTube({
			title: String(req.body?.title || `Live class recording ${schoolId}`).trim(),
			description: String(req.body?.description || `School recording for ${schoolId}`).trim(),
			playlistId: String(req.body?.playlistId || '').trim() || undefined,
			mimeType: file.mimetype,
			buffer: file.buffer,
		});
		return res.json({
			ok: true,
			url: uploaded.url,
			embedUrl: uploaded.embedUrl,
			externalProvider: uploaded.provider,
			youtubeVideoId: uploaded.videoId,
		});
	} catch (error) {
		const status = typeof error === 'object' && error && 'status' in error ? Number((error as { status?: number }).status) : 500;
		return res.status(status || 500).json({ error: error instanceof Error ? error.message : 'Video upload failed.' });
	}
});