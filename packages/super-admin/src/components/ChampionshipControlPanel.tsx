import React, { useEffect, useMemo, useState } from 'react'

type SchoolOption = { id: string; name: string; subdomain: string }
type FeatureFlag = { name: string; enabled: boolean }
type Competition = { id: string; title: string; type: string; scope: 'school' | 'global'; status: string; schoolId?: string | null; questionCount?: number; participantCount?: number; startTime?: string | null; isLive: boolean }
type PracticeBankSet = { id: string; title: string; subject: string; scope: string; examFamily?: string; classBand?: string; questions: number; visibility: string; updatedAt: string; note: string }
type DashboardResponse = { featureFlags: FeatureFlag[]; competitions: Competition[] }

const emptyQuestion = () => ({ type: 'quiz', prompt: '', options: ['', '', '', ''], correctAnswer: '', points: 1 })

async function request<T>(apiBase: string, path: string, options: RequestInit = {}): Promise<T> {
	const headers = new Headers(options.headers || {})
	headers.set('Content-Type', headers.get('Content-Type') || 'application/json')
	const response = await fetch(`${apiBase}${path}`, { ...options, headers, credentials: 'include' })
	const payload = await response.json().catch(() => ({}))
	if (!response.ok) throw new Error(payload?.error || 'Request failed')
	return payload as T
}

export function ChampionshipControlPanel({ apiBase, schools, selectedSchoolId }: { apiBase: string; schools: SchoolOption[]; selectedSchoolId: string }) {
	const [data, setData] = useState<DashboardResponse>({ featureFlags: [], competitions: [] })
	const [loading, setLoading] = useState(true)
	const [message, setMessage] = useState('')
	const [error, setError] = useState('')
	const [saving, setSaving] = useState(false)
	const [importing, setImporting] = useState(false)
	const [practiceSets, setPracticeSets] = useState<PracticeBankSet[]>([])
	const [draft, setDraft] = useState({
		scope: 'global',
		schoolId: '',
		hostOrganization: 'Ndovera',
		title: '',
		description: '',
		type: 'quiz',
		mode: 'single',
		status: 'scheduled',
		entryFee: 0,
		startTime: '',
		endTime: '',
		isLive: false,
		liveRoomUrl: '',
		practiceSyncEnabled: true,
		examFamily: 'WAEC',
		classBand: 'SS 1-3',
		practiceSubject: '',
		practiceNote: '',
		questions: [emptyQuestion()],
	})
	const [importDraft, setImportDraft] = useState({
		title: '',
		subject: '',
		scope: 'cbt',
		visibility: 'global',
		level: '',
		mode: 'Bulk import',
		note: '',
		examFamily: 'WAEC',
		classBand: 'SS 1-3',
		rawText: '',
	})

	const refresh = async () => {
		setLoading(true)
		setError('')
		try {
			const [dashboard, practiceBank] = await Promise.all([
				request<DashboardResponse>(apiBase, '/api/super/championships/dashboard'),
				request<{ sets: PracticeBankSet[] }>(apiBase, '/api/super/championships/practice-bank'),
			])
			setData(dashboard)
			setPracticeSets(practiceBank.sets)
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Unable to load championships dashboard.')
		} finally {
			setLoading(false)
		}
	}

	useEffect(() => {
		void refresh()
	}, [])

	useEffect(() => {
		setDraft((current) => ({ ...current, schoolId: current.schoolId || selectedSchoolId || schools[0]?.id || '' }))
	}, [schools, selectedSchoolId])

	const stats = useMemo(() => ({
		total: data.competitions.length,
		global: data.competitions.filter((entry) => entry.scope === 'global').length,
		live: data.competitions.filter((entry) => entry.isLive).length,
		enabled: data.featureFlags.filter((entry) => entry.enabled).length,
	}), [data])

	const toggleFlag = async (flag: FeatureFlag) => {
		setError('')
		setMessage('')
		try {
			await request(apiBase, `/api/super/championships/flags/${encodeURIComponent(flag.name)}`, { method: 'PATCH', body: JSON.stringify({ enabled: !flag.enabled }) })
			setMessage(`Updated ${flag.name}.`)
			await refresh()
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Unable to update feature flag.')
		}
	}

	const publish = async () => {
		setSaving(true)
		setError('')
		setMessage('')
		try {
			await request(apiBase, '/api/super/championships', {
				method: 'POST',
				body: JSON.stringify({
					...draft,
					schoolId: draft.scope === 'school' ? draft.schoolId : '',
					hostedByNdovera: draft.scope === 'hosted',
					questions: draft.questions.map((question) => ({ ...question, options: question.options.filter((option) => option.trim()) })),
				}),
			})
			setMessage('Championship published from super-admin control.')
			setDraft({ scope: 'global', schoolId: selectedSchoolId || schools[0]?.id || '', hostOrganization: 'Ndovera', title: '', description: '', type: 'quiz', mode: 'single', status: 'scheduled', entryFee: 0, startTime: '', endTime: '', isLive: false, liveRoomUrl: '', practiceSyncEnabled: true, examFamily: 'WAEC', classBand: 'SS 1-3', practiceSubject: '', practiceNote: '', questions: [emptyQuestion()] })
			await refresh()
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Unable to publish championship.')
		} finally {
			setSaving(false)
		}
	}

	const importPracticeBank = async () => {
		setImporting(true)
		setError('')
		setMessage('')
		try {
			const payload = await request<{ parsedCount: number; assistedCount: number }>(apiBase, '/api/super/championships/practice-bank/import', {
				method: 'POST',
				body: JSON.stringify(importDraft),
			})
			setMessage(`Practice bank imported with ${payload.parsedCount} questions. ${payload.assistedCount ? `${payload.assistedCount} answers were system-assisted.` : 'All answers were supplied.'}`)
			setImportDraft({ title: '', subject: '', scope: 'cbt', visibility: 'global', level: '', mode: 'Bulk import', note: '', examFamily: 'WAEC', classBand: 'SS 1-3', rawText: '' })
			await refresh()
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Unable to import practice bank.')
		} finally {
			setImporting(false)
		}
	}

	return (
		<div style={{ display: 'grid', gap: 18 }}>
			<div className="panel" style={{ padding: 22 }}>
				<h2 style={{ margin: 0, fontSize: 22 }}>Championship controls</h2>
				<p className="muted" style={{ marginTop: 8 }}>Feature flags and publishing controls for school and global competitions now run against the live championship database.</p>
				<div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginTop: 18 }}>
					<div className="panel" style={{ padding: 16 }}><div className="muted" style={{ fontSize: 12, textTransform: 'uppercase' }}>Competitions</div><div style={{ fontSize: 28, fontWeight: 900 }}>{stats.total}</div></div>
					<div className="panel" style={{ padding: 16 }}><div className="muted" style={{ fontSize: 12, textTransform: 'uppercase' }}>Global</div><div style={{ fontSize: 28, fontWeight: 900 }}>{stats.global}</div></div>
					<div className="panel" style={{ padding: 16 }}><div className="muted" style={{ fontSize: 12, textTransform: 'uppercase' }}>Live</div><div style={{ fontSize: 28, fontWeight: 900 }}>{stats.live}</div></div>
					<div className="panel" style={{ padding: 16 }}><div className="muted" style={{ fontSize: 12, textTransform: 'uppercase' }}>Enabled flags</div><div style={{ fontSize: 28, fontWeight: 900 }}>{stats.enabled}</div></div>
				</div>
			</div>

			{message ? <div className="panel" style={{ padding: 14, borderColor: 'rgba(16,185,129,0.45)', color: '#bbf7d0' }}>{message}</div> : null}
			{error ? <div className="panel" style={{ padding: 14, borderColor: 'rgba(239,68,68,0.45)', color: '#fecaca' }}>{error}</div> : null}

			<div style={{ display: 'grid', gridTemplateColumns: '0.9fr 1.1fr', gap: 18 }}>
				<div className="panel" style={{ padding: 22 }}>
					<h3 style={{ margin: 0, fontSize: 18 }}>Feature flags</h3>
					<div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
						{loading ? <div className="muted">Loading flags…</div> : data.featureFlags.map((flag) => (
							<div key={flag.name} className="panel" style={{ padding: 14, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
								<div>
									<div style={{ fontWeight: 800 }}>{flag.name}</div>
									<div className="muted" style={{ marginTop: 4, fontSize: 13 }}>{flag.enabled ? 'Enabled for live traffic' : 'Disabled across championships'}</div>
								</div>
								<button className="btn" style={{ background: flag.enabled ? '#10b981' : 'rgba(255,255,255,0.06)', color: 'white' }} onClick={() => void toggleFlag(flag)}>{flag.enabled ? 'Disable' : 'Enable'}</button>
							</div>
						))}
					</div>
				</div>

				<div className="panel" style={{ padding: 22 }}>
					<h3 style={{ margin: 0, fontSize: 18 }}>Publish championship</h3>
					<div style={{ display: 'grid', gap: 12, marginTop: 16, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
						<select className="select" value={draft.scope} onChange={(event) => setDraft((current) => ({ ...current, scope: event.target.value }))}><option value="global">Global</option><option value="school">School</option><option value="hosted">Hosted by Ndovera</option></select>
						<select className="select" value={draft.schoolId} disabled={draft.scope !== 'school'} onChange={(event) => setDraft((current) => ({ ...current, schoolId: event.target.value }))}>{schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select>
						<input className="field" value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Championship title" />
						<select className="select" value={draft.type} onChange={(event) => setDraft((current) => ({ ...current, type: event.target.value }))}><option value="quiz">Quiz</option><option value="spelling">Spelling</option><option value="essay">Essay</option><option value="math">Math</option><option value="exam">Exam</option><option value="live">Live</option></select>
						<select className="select" value={draft.mode} onChange={(event) => setDraft((current) => ({ ...current, mode: event.target.value }))}><option value="single">Single stage</option><option value="stage">Multi-stage</option></select>
						<select className="select" value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value }))}><option value="draft">Draft</option><option value="scheduled">Scheduled</option><option value="active">Active</option><option value="completed">Completed</option></select>
						<input className="field" type="datetime-local" value={draft.startTime} onChange={(event) => setDraft((current) => ({ ...current, startTime: event.target.value }))} />
						<input className="field" type="datetime-local" value={draft.endTime} onChange={(event) => setDraft((current) => ({ ...current, endTime: event.target.value }))} />
						<input className="field" type="number" min="0" value={draft.entryFee} onChange={(event) => setDraft((current) => ({ ...current, entryFee: Number(event.target.value) || 0 }))} placeholder="Entry fee" />
						<label className="panel" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 10 }}><input type="checkbox" checked={draft.isLive} onChange={(event) => setDraft((current) => ({ ...current, isLive: event.target.checked }))} /> Live mode enabled</label>
						<input className="field" value={draft.hostOrganization} disabled={draft.scope !== 'hosted'} onChange={(event) => setDraft((current) => ({ ...current, hostOrganization: event.target.value }))} placeholder="Host organization" style={{ gridColumn: '1 / -1' }} />
						<select className="select" value={draft.examFamily} onChange={(event) => setDraft((current) => ({ ...current, examFamily: event.target.value }))}><option value="WAEC">WAEC</option><option value="NECO">NECO</option><option value="JAMB">JAMB</option><option value="IGCSE">IGCSE</option><option value="GCE">GCE</option><option value="NABTEB">NABTEB</option><option value="NECO BECE">NECO BECE</option><option value="Junior WAEC">Junior WAEC</option><option value="NCEE">NCEE</option><option value="Scholarship">Scholarship</option><option value="School Practice">School Practice</option></select>
						<select className="select" value={draft.classBand} onChange={(event) => setDraft((current) => ({ ...current, classBand: event.target.value }))}><option value="Grade 3-6">Grade 3-6</option><option value="JSS 1-3">JSS 1-3</option><option value="SS 1-3">SS 1-3</option><option value="Mixed">Mixed</option></select>
						<input className="field" value={draft.practiceSubject} onChange={(event) => setDraft((current) => ({ ...current, practiceSubject: event.target.value }))} placeholder="Practice subject for sync" />
						<label className="panel" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 10 }}><input type="checkbox" checked={draft.practiceSyncEnabled} onChange={(event) => setDraft((current) => ({ ...current, practiceSyncEnabled: event.target.checked }))} /> Sync non-JAMB exam questions into practice bank</label>
						<textarea className="textarea" value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Competition notes or instructions" style={{ gridColumn: '1 / -1' }} />
						<textarea className="textarea" value={draft.practiceNote} onChange={(event) => setDraft((current) => ({ ...current, practiceNote: event.target.value }))} placeholder="Practice sync note" style={{ gridColumn: '1 / -1' }} />
						<input className="field" value={draft.liveRoomUrl} onChange={(event) => setDraft((current) => ({ ...current, liveRoomUrl: event.target.value }))} placeholder="Live room URL" style={{ gridColumn: '1 / -1' }} />
					</div>
					<div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
						{draft.questions.map((question, index) => (
							<div key={`question_${index}`} className="panel" style={{ padding: 16 }}>
								<div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}><div style={{ fontWeight: 800 }}>Question {index + 1}</div>{draft.questions.length > 1 ? <button className="btn btn-secondary" onClick={() => setDraft((current) => ({ ...current, questions: current.questions.filter((_, itemIndex) => itemIndex !== index) }))}>Remove</button> : null}</div>
								<div style={{ display: 'grid', gap: 10, marginTop: 12, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
									<input className="field" value={question.prompt} onChange={(event) => setDraft((current) => ({ ...current, questions: current.questions.map((entry, itemIndex) => itemIndex === index ? { ...entry, prompt: event.target.value } : entry) }))} placeholder="Prompt" style={{ gridColumn: '1 / -1' }} />
									{question.options.map((option, optionIndex) => <input key={`${index}_${optionIndex}`} className="field" value={option} onChange={(event) => setDraft((current) => ({ ...current, questions: current.questions.map((entry, itemIndex) => itemIndex === index ? { ...entry, options: entry.options.map((item, nestedIndex) => nestedIndex === optionIndex ? event.target.value : item) } : entry) }))} placeholder={`Option ${optionIndex + 1}`} />)}
									<input className="field" value={question.correctAnswer} onChange={(event) => setDraft((current) => ({ ...current, questions: current.questions.map((entry, itemIndex) => itemIndex === index ? { ...entry, correctAnswer: event.target.value } : entry) }))} placeholder="Correct answer" />
									<input className="field" type="number" min="1" value={question.points} onChange={(event) => setDraft((current) => ({ ...current, questions: current.questions.map((entry, itemIndex) => itemIndex === index ? { ...entry, points: Number(event.target.value) || 1 } : entry) }))} placeholder="Points" />
								</div>
							</div>
						))}
						<div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><button className="btn btn-secondary" onClick={() => setDraft((current) => ({ ...current, questions: [...current.questions, emptyQuestion()] }))}>Add question</button><button className="btn btn-primary" onClick={() => void publish()} disabled={saving}>{saving ? 'Publishing…' : 'Publish'}</button></div>
					</div>
				</div>
			</div>

			<div className="panel" style={{ padding: 22 }}>
				<h3 style={{ margin: 0, fontSize: 18 }}>Bulk CBT / mock import</h3>
				<p className="muted" style={{ marginTop: 8 }}>Paste up to 100 questions and Ndovera will format them into a practice bank for WAEC, NECO, JAMB, scholarship drills, junior exams, and common entrance practice.</p>
				<div style={{ display: 'grid', gap: 12, marginTop: 16, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
					<input className="field" value={importDraft.title} onChange={(event) => setImportDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Practice bank title" />
					<input className="field" value={importDraft.subject} onChange={(event) => setImportDraft((current) => ({ ...current, subject: event.target.value }))} placeholder="Subject" />
					<select className="select" value={importDraft.scope} onChange={(event) => setImportDraft((current) => ({ ...current, scope: event.target.value }))}><option value="cbt">CBT</option><option value="practice">Practice</option><option value="exam">Exam review</option><option value="mid-term">Mid-term</option></select>
					<select className="select" value={importDraft.visibility} onChange={(event) => setImportDraft((current) => ({ ...current, visibility: event.target.value }))}><option value="global">Global</option><option value="school">School</option></select>
					<select className="select" value={importDraft.examFamily} onChange={(event) => setImportDraft((current) => ({ ...current, examFamily: event.target.value }))}><option value="WAEC">WAEC</option><option value="NECO">NECO</option><option value="JAMB">JAMB</option><option value="IGCSE">IGCSE</option><option value="GCE">GCE</option><option value="NABTEB">NABTEB</option><option value="NECO BECE">NECO BECE</option><option value="Junior WAEC">Junior WAEC</option><option value="NCEE">NCEE</option><option value="Scholarship">Scholarship</option><option value="School Practice">School Practice</option></select>
					<select className="select" value={importDraft.classBand} onChange={(event) => setImportDraft((current) => ({ ...current, classBand: event.target.value }))}><option value="Grade 3-6">Grade 3-6</option><option value="JSS 1-3">JSS 1-3</option><option value="SS 1-3">SS 1-3</option><option value="Mixed">Mixed</option></select>
					<input className="field" value={importDraft.level} onChange={(event) => setImportDraft((current) => ({ ...current, level: event.target.value }))} placeholder="Level / class label" />
					<input className="field" value={importDraft.mode} onChange={(event) => setImportDraft((current) => ({ ...current, mode: event.target.value }))} placeholder="Mode label" />
					<textarea className="textarea" value={importDraft.note} onChange={(event) => setImportDraft((current) => ({ ...current, note: event.target.value }))} placeholder="Import note" style={{ gridColumn: '1 / -1' }} />
					<textarea className="textarea" value={importDraft.rawText} onChange={(event) => setImportDraft((current) => ({ ...current, rawText: event.target.value }))} placeholder={"Question 1: The capital of France is?\nA. London\nB. Paris\nC. Rome\nD. Madrid\nAnswer: B\nExplanation: Paris is the capital city of France."} style={{ gridColumn: '1 / -1', minHeight: 240 }} />
				</div>
				<div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginTop: 16 }}>
					<div className="muted" style={{ fontSize: 13 }}>Missing answers are saved with system-assisted defaults so content can still go live and be reviewed later.</div>
					<button className="btn btn-primary" onClick={() => void importPracticeBank()} disabled={importing}>{importing ? 'Importing…' : 'Import to practice bank'}</button>
				</div>
			</div>

			<div className="panel" style={{ padding: 22 }}>
				<h3 style={{ margin: 0, fontSize: 18 }}>Published championships</h3>
				<div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
					{loading ? <div className="muted">Loading championships…</div> : data.competitions.length ? data.competitions.map((competition) => (
						<div key={competition.id} className="panel" style={{ padding: 16 }}>
							<div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
								<div>
									<div style={{ fontWeight: 900, fontSize: 18 }}>{competition.title}</div>
									<div className="muted" style={{ marginTop: 6 }}>{competition.type} • {competition.scope} • {competition.status}{competition.type === 'exam' ? ' • hosted exam' : ''}</div>
								</div>
								<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
									<span className="pill">Questions: {competition.questionCount || 0}</span>
									<span className="pill">Participants: {competition.participantCount || 0}</span>
									{competition.isLive ? <span className="pill">Live</span> : null}
								</div>
							</div>
						</div>
					)) : <div className="muted">No championships published yet.</div>}
				</div>
			</div>

			<div className="panel" style={{ padding: 22 }}>
				<h3 style={{ margin: 0, fontSize: 18 }}>Live practice bank</h3>
				<div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
					{practiceSets.length ? practiceSets.map((set) => (
						<div key={set.id} className="panel" style={{ padding: 16 }}>
							<div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
								<div>
									<div style={{ fontWeight: 900, fontSize: 17 }}>{set.title}</div>
									<div className="muted" style={{ marginTop: 6 }}>{set.subject} • {set.scope} • {set.visibility}{set.examFamily ? ` • ${set.examFamily}` : ''}{set.classBand ? ` • ${set.classBand}` : ''}</div>
									<div className="muted" style={{ marginTop: 8, fontSize: 13 }}>{set.note}</div>
								</div>
								<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
									<span className="pill">Questions: {set.questions}</span>
									<span className="pill">Updated: {new Date(set.updatedAt).toLocaleDateString()}</span>
								</div>
							</div>
						</div>
					)) : <div className="muted">No practice banks yet.</div>}
				</div>
			</div>
		</div>
	)
}