import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { fileURLToPath } from 'url';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { google } from 'googleapis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCAL_UPLOADS_ROOT = path.resolve(__dirname, '../../../uploads');

function ensureDir(dirPath: string) {
	fs.mkdirSync(dirPath, { recursive: true });
}

function sanitizeSegment(value: string) {
	return value.replace(/[^a-zA-Z0-9/_-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'file';
}

function extensionForMimeType(mimeType?: string) {
	switch (String(mimeType || '').toLowerCase()) {
		case 'image/png': return 'png';
		case 'image/jpeg': return 'jpg';
		case 'image/webp': return 'webp';
		case 'image/svg+xml': return 'svg';
		case 'image/gif': return 'gif';
		case 'application/pdf': return 'pdf';
		case 'video/mp4': return 'mp4';
		case 'video/webm': return 'webm';
		case 'video/quicktime': return 'mov';
		default: return 'bin';
	}
}

function createFilename(prefix: string, mimeType?: string) {
	return `${sanitizeSegment(prefix)}-${Date.now()}-${crypto.randomBytes(5).toString('hex')}.${extensionForMimeType(mimeType)}`;
}

function getAssetBaseUrl() {
	return String(process.env.NDOVERA_PUBLIC_ASSET_BASE_URL || process.env.VITE_PUBLIC_ASSET_BASE_URL || '').trim().replace(/\/$/, '');
}

function getR2Config() {
	const endpoint = String(process.env.CF_R2_ENDPOINT || '').trim();
	const region = String(process.env.CF_R2_REGION || 'auto').trim();
	const bucket = String(process.env.CF_R2_BUCKET || '').trim();
	const accessKeyId = String(process.env.CF_R2_ACCESS_KEY_ID || '').trim();
	const secretAccessKey = String(process.env.CF_R2_SECRET_ACCESS_KEY || '').trim();
	const publicBaseUrl = String(process.env.CF_R2_PUBLIC_BASE_URL || '').trim().replace(/\/$/, '');
	return { endpoint, region, bucket, accessKeyId, secretAccessKey, publicBaseUrl, configured: Boolean(endpoint && bucket && accessKeyId && secretAccessKey) };
}

function getR2Client(config: ReturnType<typeof getR2Config>) {
	return new S3Client({
		region: config.region,
		endpoint: config.endpoint,
		credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
	});
}

export async function uploadAssetToStorage(input: { schoolId: string; folder: string; filenamePrefix: string; mimeType?: string; buffer: Buffer }) {
	const filename = createFilename(input.filenamePrefix, input.mimeType);
	const key = `${sanitizeSegment(input.schoolId)}/${sanitizeSegment(input.folder)}/${filename}`;
	const r2 = getR2Config();
	if (r2.configured) {
		const client = getR2Client(r2);
		await client.send(new PutObjectCommand({
			Bucket: r2.bucket,
			Key: key,
			Body: input.buffer,
			ContentType: input.mimeType || 'application/octet-stream',
		}));
		const url = r2.publicBaseUrl ? `${r2.publicBaseUrl}/${key}` : `${getAssetBaseUrl()}/${key}`;
		return { provider: 'r2' as const, key, url };
	}
	const localDir = path.join(LOCAL_UPLOADS_ROOT, sanitizeSegment(input.schoolId), sanitizeSegment(input.folder));
	ensureDir(localDir);
	const absolutePath = path.join(localDir, filename);
	fs.writeFileSync(absolutePath, input.buffer);
	const publicPath = `/uploads/${sanitizeSegment(input.schoolId)}/${sanitizeSegment(input.folder)}/${filename}`;
	const baseUrl = getAssetBaseUrl();
	return { provider: 'local' as const, key: publicPath, url: baseUrl ? `${baseUrl}${publicPath}` : publicPath };
}

function getYouTubeConfig() {
	return {
		clientId: String(process.env.YOUTUBE_CLIENT_ID || '').trim(),
		clientSecret: String(process.env.YOUTUBE_CLIENT_SECRET || '').trim(),
		refreshToken: String(process.env.YOUTUBE_REFRESH_TOKEN || '').trim(),
		redirectUri: String(process.env.YOUTUBE_REDIRECT_URI || '').trim(),
		privacyStatus: String(process.env.YOUTUBE_UPLOAD_PRIVACY || 'unlisted').trim(),
	};
}

export async function uploadVideoToYouTube(input: { title: string; description?: string; buffer: Buffer; mimeType?: string; playlistId?: string }) {
	const config = getYouTubeConfig();
	if (!config.clientId || !config.clientSecret || !config.refreshToken || !config.redirectUri) {
		const error = new Error('YouTube upload is not configured.') as Error & { status?: number };
		error.status = 503;
		throw error;
	}
	const oauth2Client = new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri);
	oauth2Client.setCredentials({ refresh_token: config.refreshToken });
	const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
	const upload = await youtube.videos.insert({
		part: ['snippet', 'status'],
		requestBody: {
			snippet: {
				title: input.title,
				description: input.description || '',
			},
			status: {
				privacyStatus: config.privacyStatus as 'private' | 'public' | 'unlisted',
			},
		},
		media: {
			mimeType: input.mimeType || 'video/mp4',
			body: Readable.from(input.buffer),
		},
	});
	const videoId = String(upload.data.id || '').trim();
	if (!videoId) {
		const error = new Error('YouTube did not return a video id.') as Error & { status?: number };
		error.status = 502;
		throw error;
	}
	let playlistItemId: string | null = null;
	if (input.playlistId) {
		const playlistResponse = await youtube.playlistItems.insert({
			part: ['snippet'],
			requestBody: {
				snippet: {
					playlistId: input.playlistId,
					resourceId: { kind: 'youtube#video', videoId },
				},
			},
		});
		playlistItemId = String(playlistResponse.data.id || '').trim() || null;
	}
	return {
		provider: 'youtube' as const,
		videoId,
		playlistItemId,
		url: `https://www.youtube.com/watch?v=${videoId}`,
		embedUrl: `https://www.youtube.com/embed/${videoId}`,
	};
}