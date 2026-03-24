import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Clock3, Globe2, Medal, Plus, Shield, Trophy, Users } from 'lucide-react';
import { Role } from '../types';
import { fetchWithAuth } from '../services/apiClient';
import { useData } from '../hooks/useData';

type Competition = {
	id: string;
	title: string;
	description?: string | null;
	type: string;
	scope: 'school' | 'global';
	mode: 'single' | 'stage';
	status: 'draft' | 'scheduled' | 'active' | 'completed';
	startTime?: string | null;
	endTime?: string | null;
	isLive: boolean;
	liveRoomUrl?: string | null;
	questionCount?: number;
	participantCount?: number;
	joined?: boolean;
	participantStatus?: 'joined' | 'in_progress' | 'submitted' | null;
	currentScore?: number;
	rank?: number | null;
};

type CompetitionDetail = {
	competition: Competition;
	participant: { status: string; score: number; violationCount: number } | null;
	questions: Array<{ id: string; prompt: string; type: string; options: string[]; points: number; answered?: boolean; submittedAnswer?: string | null; isCorrect?: boolean | null; correctAnswer?: string }>;
	leaderboard: Array<{ userId: string; score: number; timeTaken: number; rank: number; name?: string | null }>;
	featureFlags: Array<{ name: string; enabled: boolean }>;
	stats: { questionCount: number; participantCount: number; submittedCount: number; violationCount: number };
};

type PortalResponse = { competitions: Competition[]; currentRole: string | null; canManage: boolean };

const emptyQuestion = () => ({ type: 'quiz', prompt: '', options: ['', '', '', ''], correctAnswer: '', points: 1 });

export function ChampionshipsView({ role }: { role: Role }) {
	const { data, loading, error, refetch } = useData<PortalResponse>('/api/championships/portal');
	const [selectedId, setSelectedId] = useState('');
	const [detail, setDetail] = useState<CompetitionDetail | null>(null);
	const [detailLoading, setDetailLoading] = useState(false);
	const [message, setMessage] = useState('');
	const [submitBusy, setSubmitBusy] = useState<string | null>(null);
	const [joining, setJoining] = useState(false);
	const [isCreating, setIsCreating] = useState(false);
	const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});
	const [createBusy, setCreateBusy] = useState(false);
	const [draft, setDraft] = useState({
		title: '',
		description: '',
			type: 'quiz',
		mode: 'single',
		entryFee: 0,
		status: 'scheduled',
		startTime: '',
		endTime: '',
		isLive: false,
		liveRoomUrl: '',
		questions: [emptyQuestion()],
	});

	const competitions = data?.competitions || [];
	const canManage = Boolean(data?.canManage) && role !== 'Student';

	useEffect(() => {
		if (!selectedId && competitions[0]?.id) setSelectedId(competitions[0].id);
		if (selectedId && !competitions.some((entry) => entry.id === selectedId) && competitions[0]?.id) setSelectedId(competitions[0].id);
	}, [competitions, selectedId]);

	useEffect(() => {
		if (!selectedId) return;
		let active = true;
		setDetailLoading(true);
		fetchWithAuth(`/api/championships/${encodeURIComponent(selectedId)}`)
			.then((payload) => {
				if (!active) return;
				setDetail(payload as CompetitionDetail);
				setAnswerDrafts({});
			})
			.catch((err) => { if (active) setMessage(err instanceof Error ? err.message : 'Unable to load championship.'); })
			.finally(() => { if (active) setDetailLoading(false); });
		return () => { active = false; };
	}, [selectedId]);

	useEffect(() => {
		if (role !== 'Student' || !detail?.competition?.id || !detail.participant || detail.participant.status === 'submitted') return;
		const onHidden = () => {
			if (!document.hidden) return;
			void fetchWithAuth(`/api/championships/${encodeURIComponent(detail.competition.id)}/violations`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ type: 'tab_hidden', metadata: { hiddenAt: new Date().toISOString() } }),
			}).then((payload) => setDetail(payload as CompetitionDetail)).catch(() => {});
		};
		document.addEventListener('visibilitychange', onHidden);
		return () => document.removeEventListener('visibilitychange', onHidden);
	}, [detail, role]);

	const selectedCompetition = useMemo(() => competitions.find((entry) => entry.id === selectedId) || null, [competitions, selectedId]);
	const stats = useMemo(() => ({
		live: competitions.filter((entry) => entry.isLive).length,
		joined: competitions.filter((entry) => entry.joined).length,
		global: competitions.filter((entry) => entry.scope === 'global').length,
		active: competitions.filter((entry) => entry.status === 'active').length,
	}), [competitions]);

	const refreshAll = async (nextSelectedId?: string) => {
		await refetch();
		const currentId = nextSelectedId || selectedId;
		if (!currentId) return;
		const nextDetail = await fetchWithAuth(`/api/championships/${encodeURIComponent(currentId)}`);
		setDetail(nextDetail as CompetitionDetail);
	};

	const joinSelected = async () => {
		if (!selectedCompetition) return;
		setJoining(true);
		setMessage('');
		try {
			const payload = await fetchWithAuth(`/api/championships/${encodeURIComponent(selectedCompetition.id)}/join`, { method: 'POST' });
			setDetail(payload as CompetitionDetail);
			await refetch();
			setMessage('Competition joined. You can start answering now.');
		} catch (err) {
			setMessage(err instanceof Error ? err.message : 'Unable to join championship.');
		} finally {
			setJoining(false);
		}
	};

	const submitAnswer = async (questionId: string) => {
		if (!detail?.competition?.id || !answerDrafts[questionId]?.trim()) return;
		setSubmitBusy(questionId);
		setMessage('');
		try {
			const payload = await fetchWithAuth(`/api/championships/${encodeURIComponent(detail.competition.id)}/answers`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ questionId, answer: answerDrafts[questionId], timeTaken: 30 }),
			});
			setDetail(payload as CompetitionDetail);
			await refetch();
			setMessage('Answer recorded. Leaderboard refreshed.');
		} catch (err) {
			setMessage(err instanceof Error ? err.message : 'Unable to submit answer.');
		} finally {
			setSubmitBusy(null);
		}
	};

	const createCompetition = async () => {
		setCreateBusy(true);
		setMessage('');
		try {
			const payload = await fetchWithAuth('/api/championships', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					...draft,
					questions: draft.questions.map((question) => ({ ...question, options: question.options.filter((option) => option.trim()) })),
				}),
			});
			setMessage('Championship published to the school workspace.');
			setIsCreating(false);
			setDraft({ title: '', description: '', type: 'quiz', mode: 'single', entryFee: 0, status: 'scheduled', startTime: '', endTime: '', isLive: false, liveRoomUrl: '', questions: [emptyQuestion()] });
			const nextId = (payload as any)?.competition?.id as string | undefined;
			if (nextId) setSelectedId(nextId);
			await refreshAll(nextId);
		} catch (err) {
			setMessage(err instanceof Error ? err.message : 'Unable to create championship.');
		} finally {
			setCreateBusy(false);
		}
	};

	return (
		<div className="space-y-6">
			<div className="rounded-4xl border border-white/10 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.18),rgba(15,23,42,0.92)_55%)] p-6">
				<div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
					<div>
						<div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-emerald-300"><Trophy size={14} /> Championships</div>
						<h2 className="mt-4 text-3xl font-black text-white">Competitive learning, ranked in real time</h2>
						<p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-300">Students can join active championships and hosted exams from the sidebar, while Scholarships Admin can publish scholarship-focused contests with questions, timing, and leaderboard tracking backed by the production database layer.</p>
					</div>
					{canManage ? <button onClick={() => setIsCreating((current) => !current)} className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-xs font-bold uppercase tracking-[0.18em] text-white hover:bg-emerald-500"><Plus size={16} /> {isCreating ? 'Close Builder' : 'Create Championship'}</button> : null}
				</div>
				<div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
					<div className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400">Active</div><div className="mt-2 text-2xl font-black text-white">{stats.active}</div></div>
					<div className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400">Joined</div><div className="mt-2 text-2xl font-black text-white">{stats.joined}</div></div>
					<div className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400">Global</div><div className="mt-2 text-2xl font-black text-white">{stats.global}</div></div>
					<div className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400">Live</div><div className="mt-2 text-2xl font-black text-white">{stats.live}</div></div>
				</div>
			</div>

			{message ? <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{message}</div> : null}
			{error ? <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">{error}</div> : null}

			{canManage && isCreating ? (
				<div className="rounded-4xl border border-white/10 bg-white/5 p-5">
					<h3 className="text-lg font-black text-white">Publish school championship</h3>
					<div className="mt-4 grid gap-4 md:grid-cols-2">
						<input value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Championship title" className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" />
						<select value={draft.type} onChange={(event) => setDraft((current) => ({ ...current, type: event.target.value }))} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"><option value="quiz">Quiz</option><option value="spelling">Spelling</option><option value="essay">Essay</option><option value="math">Math</option><option value="exam">Exam</option><option value="live">Live</option></select>
						<select value={draft.mode} onChange={(event) => setDraft((current) => ({ ...current, mode: event.target.value }))} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"><option value="single">Single stage</option><option value="stage">Multi-stage</option></select>
						<select value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value }))} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"><option value="draft">Draft</option><option value="scheduled">Scheduled</option><option value="active">Active</option><option value="completed">Completed</option></select>
						<input type="datetime-local" value={draft.startTime} onChange={(event) => setDraft((current) => ({ ...current, startTime: event.target.value }))} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" />
						<input type="datetime-local" value={draft.endTime} onChange={(event) => setDraft((current) => ({ ...current, endTime: event.target.value }))} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" />
						<input type="number" min="0" value={draft.entryFee} onChange={(event) => setDraft((current) => ({ ...current, entryFee: Number(event.target.value) || 0 }))} placeholder="Entry fee" className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" />
						<label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white"><input type="checkbox" checked={draft.isLive} onChange={(event) => setDraft((current) => ({ ...current, isLive: event.target.checked }))} /> Live competition</label>
						<textarea value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Purpose, eligibility, scholarship notes, or exam instructions" className="min-h-28 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none md:col-span-2" />
						<input value={draft.liveRoomUrl} onChange={(event) => setDraft((current) => ({ ...current, liveRoomUrl: event.target.value }))} placeholder="Live room URL for monitored competitions" className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none md:col-span-2" />
					</div>
					<div className="mt-5 space-y-4">
						{draft.questions.map((question, index) => (
							<div key={`question_${index}`} className="rounded-2xl border border-white/10 bg-black/20 p-4">
								<div className="flex items-center justify-between gap-3"><div className="text-sm font-bold text-white">Question {index + 1}</div>{draft.questions.length > 1 ? <button onClick={() => setDraft((current) => ({ ...current, questions: current.questions.filter((_, itemIndex) => itemIndex !== index) }))} className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400">Remove</button> : null}</div>
								<div className="mt-3 grid gap-3 md:grid-cols-2">
									<input value={question.prompt} onChange={(event) => setDraft((current) => ({ ...current, questions: current.questions.map((entry, itemIndex) => itemIndex === index ? { ...entry, prompt: event.target.value } : entry) }))} placeholder="Question prompt" className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none md:col-span-2" />
									{question.options.map((option, optionIndex) => <input key={`opt_${index}_${optionIndex}`} value={option} onChange={(event) => setDraft((current) => ({ ...current, questions: current.questions.map((entry, itemIndex) => itemIndex === index ? { ...entry, options: entry.options.map((item, nestedIndex) => nestedIndex === optionIndex ? event.target.value : item) } : entry) }))} placeholder={`Option ${optionIndex + 1}`} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" />)}
									<input value={question.correctAnswer} onChange={(event) => setDraft((current) => ({ ...current, questions: current.questions.map((entry, itemIndex) => itemIndex === index ? { ...entry, correctAnswer: event.target.value } : entry) }))} placeholder="Correct answer" className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" />
									<input type="number" min="1" value={question.points} onChange={(event) => setDraft((current) => ({ ...current, questions: current.questions.map((entry, itemIndex) => itemIndex === index ? { ...entry, points: Number(event.target.value) || 1 } : entry) }))} placeholder="Points" className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" />
								</div>
							</div>
						))}
						<button onClick={() => setDraft((current) => ({ ...current, questions: [...current.questions, emptyQuestion()] }))} className="rounded-2xl border border-dashed border-white/15 px-4 py-3 text-xs font-bold uppercase tracking-[0.18em] text-zinc-300">Add question</button>
					</div>
					<div className="mt-5 flex justify-end gap-3"><button onClick={() => setIsCreating(false)} className="rounded-2xl border border-white/10 px-4 py-3 text-xs font-bold uppercase tracking-[0.18em] text-zinc-300">Cancel</button><button onClick={() => void createCompetition()} disabled={createBusy} className="rounded-2xl bg-emerald-600 px-4 py-3 text-xs font-bold uppercase tracking-[0.18em] text-white disabled:opacity-60">{createBusy ? 'Publishing...' : 'Publish championship'}</button></div>
				</div>
			) : null}

			<div className="grid gap-6 xl:grid-cols-[360px,1fr]">
				<div className="space-y-4">
					<div className="rounded-4xl border border-white/10 bg-white/5 p-4">
						<div className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-zinc-400">Competition board</div>
						{loading ? <div className="text-sm text-zinc-400">Loading competitions...</div> : competitions.length ? competitions.map((competition) => (
							<button key={competition.id} onClick={() => setSelectedId(competition.id)} className={`mb-3 w-full rounded-2xl border p-4 text-left transition ${selectedId === competition.id ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-white/10 bg-black/20 hover:border-white/20'}`}>
								<div className="flex items-start justify-between gap-3"><div><div className="text-sm font-black text-white">{competition.title}</div><div className="mt-1 text-xs text-zinc-400">{competition.type} • {competition.scope}{competition.type === 'exam' ? ' • hosted exam' : ''}</div></div><div className="rounded-full bg-white/8 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-300">{competition.status}</div></div>
								<div className="mt-3 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-400"><span className="inline-flex items-center gap-1"><Users size={12} /> {competition.participantCount || 0}</span><span className="inline-flex items-center gap-1"><Clock3 size={12} /> {competition.questionCount || 0} questions</span>{competition.joined ? <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-emerald-300">Joined</span> : null}{competition.scope === 'global' ? <span className="rounded-full bg-blue-500/15 px-2 py-1 text-blue-300">Global</span> : null}</div>
							</button>
						)) : <div className="text-sm text-zinc-400">No championships published yet.</div>}
					</div>
				</div>

				<div className="space-y-4">
					{detailLoading ? <div className="rounded-4xl border border-white/10 bg-white/5 p-6 text-sm text-zinc-400">Loading selected championship...</div> : selectedCompetition && detail ? (
						<>
							<div className="rounded-4xl border border-white/10 bg-white/5 p-5">
								<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
									<div>
										<h3 className="text-2xl font-black text-white">{detail.competition.title}</h3>
										<p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-300">{detail.competition.description || 'Competition details are available below.'}</p>
										<div className="mt-3 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-300"><span className="rounded-full bg-white/8 px-3 py-1">{detail.competition.type}</span><span className="rounded-full bg-white/8 px-3 py-1">{detail.competition.mode}</span><span className="rounded-full bg-white/8 px-3 py-1">{detail.competition.scope}</span>{detail.competition.type === 'exam' ? <span className="rounded-full bg-amber-500/15 px-3 py-1 text-amber-200">Hosted exam</span> : null}{detail.competition.isLive ? <span className="rounded-full bg-blue-500/15 px-3 py-1 text-blue-200">Live mode</span> : null}</div>
									</div>
									<div className="grid gap-2 text-sm text-zinc-300">
										<div className="inline-flex items-center gap-2"><Users size={16} /> {detail.stats.participantCount} participants</div>
										<div className="inline-flex items-center gap-2"><Medal size={16} /> Your rank: {selectedCompetition.rank || 'Unranked'}</div>
										<div className="inline-flex items-center gap-2"><Shield size={16} /> Violations: {detail.participant?.violationCount || 0}</div>
										{detail.competition.scope === 'global' ? <div className="inline-flex items-center gap-2"><Globe2 size={16} /> Global access</div> : null}
										{detail.competition.liveRoomUrl ? <a href={detail.competition.liveRoomUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-emerald-300">Open live room</a> : null}
									</div>
								</div>
								{role === 'Student' && !selectedCompetition.joined ? <button onClick={() => void joinSelected()} disabled={joining} className="mt-5 rounded-2xl bg-emerald-600 px-4 py-3 text-xs font-bold uppercase tracking-[0.18em] text-white disabled:opacity-60">{joining ? 'Joining...' : 'Join competition'}</button> : null}
							</div>

							<div className="grid gap-4 lg:grid-cols-[1.2fr,0.8fr]">
								<div className="rounded-4xl border border-white/10 bg-white/5 p-5">
									<div className="mb-4 flex items-center gap-2 text-sm font-black text-white"><Trophy size={18} /> Questions</div>
									<div className="space-y-4">
										{detail.questions.map((question, index) => (
											<div key={question.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
												<div className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-400">Question {index + 1} • {question.points} pts</div>
												<div className="mt-2 text-sm font-semibold text-white">{question.prompt}</div>
												{question.options.length ? <div className="mt-3 grid gap-2">{question.options.map((option) => <button key={option} onClick={() => setAnswerDrafts((current) => ({ ...current, [question.id]: option }))} className={`rounded-xl border px-3 py-2 text-left text-sm ${answerDrafts[question.id] === option ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100' : 'border-white/10 bg-white/5 text-zinc-200'}`}>{option}</button>)}</div> : <textarea value={answerDrafts[question.id] || ''} onChange={(event) => setAnswerDrafts((current) => ({ ...current, [question.id]: event.target.value }))} placeholder="Type your answer" className="mt-3 min-h-24 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none" />}
												<div className="mt-3 flex flex-wrap items-center gap-3">{role === 'Student' && detail.participant && detail.participant.status !== 'submitted' && !question.answered ? <button onClick={() => void submitAnswer(question.id)} disabled={submitBusy === question.id || !answerDrafts[question.id]?.trim()} className="rounded-xl bg-emerald-600 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-white disabled:opacity-60">{submitBusy === question.id ? 'Saving...' : 'Submit answer'}</button> : null}{question.answered ? <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${question.isCorrect ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}`}>{question.isCorrect ? 'Correct' : 'Submitted'}</span> : null}{question.correctAnswer ? <span className="text-xs text-zinc-400">Answer: <span className="font-semibold text-zinc-200">{question.correctAnswer}</span></span> : null}</div>
											</div>
										))}
									</div>
								</div>

								<div className="space-y-4">
									<div className="rounded-4xl border border-white/10 bg-white/5 p-5">
										<div className="mb-4 flex items-center gap-2 text-sm font-black text-white"><Medal size={18} /> Leaderboard</div>
										<div className="space-y-3">{detail.leaderboard.length ? detail.leaderboard.map((entry) => <div key={`${entry.userId}_${entry.rank}`} className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3"><div><div className="text-sm font-bold text-white">#{entry.rank} {entry.name || entry.userId}</div><div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">{entry.timeTaken}s total time</div></div><div className="text-lg font-black text-white">{entry.score}</div></div>) : <div className="text-sm text-zinc-400">Leaderboard populates as participants join and submit.</div>}</div>
									</div>
									<div className="rounded-4xl border border-white/10 bg-white/5 p-5">
										<div className="mb-3 flex items-center gap-2 text-sm font-black text-white"><AlertTriangle size={18} /> Integrity</div>
										<p className="text-sm leading-6 text-zinc-300">Students who switch tabs while participating are logged to the violations table automatically. The current run shows {detail.stats.violationCount} recorded violations for this competition.</p>
									</div>
								</div>
							</div>
						</>
					) : <div className="rounded-4xl border border-white/10 bg-white/5 p-6 text-sm text-zinc-400">Select a championship to view details.</div>}
				</div>
			</div>
		</div>
	);
}