import { useEffect, useMemo, useState } from 'react';
import { Bot, CheckCircle2, ReceiptText, Sparkles } from 'lucide-react';

import { consumeAiCredits, getAiCreditBalance, type AiCreditBalanceResponse } from '../../../services/monetizationApi';

type AssistantDepth = 'quick' | 'standard' | 'deep';

const depthCreditCost: Record<AssistantDepth, number> = {
	quick: 1,
	standard: 2,
	deep: 4,
};

function buildLessonAssist(input: {
	subject: string;
	topic: string;
	className: string;
	objective: string;
	depth: AssistantDepth;
}) {
	const subject = input.subject.trim() || 'General Studies';
	const topic = input.topic.trim() || 'the topic';
	const className = input.className.trim() || 'your class';
	const objective = input.objective.trim() || `Help learners understand ${topic}`;
	const detail = input.depth === 'deep'
		? 'Include modelling, guided practice, independent checks, and differentiation.'
		: input.depth === 'standard'
			? 'Balance explanation, guided examples, and exit checks.'
			: 'Keep it concise and practical for a single period.';
	return {
		headline: `${subject} lesson support for ${className}`,
		objectives: [
			`State the lesson goal clearly: ${objective}.`,
			`Teach ${topic} with one concrete example before abstract rules.`,
			`Check understanding with a short exit task tied to ${topic}.`,
		],
		flow: [
			`Starter: connect prior knowledge to ${topic}.`,
			`Mini-teach: model one strong example and one common mistake.`,
			`Practice: pair learners for guided correction and short explanation.`,
			`Assessment: ask learners to solve or explain one prompt independently.`,
		],
		detail,
	};
}

export default function TeacherAiLessonAssistant() {
	const [subject, setSubject] = useState('');
	const [topic, setTopic] = useState('');
	const [className, setClassName] = useState('');
	const [objective, setObjective] = useState('');
	const [depth, setDepth] = useState<AssistantDepth>('quick');
	const [result, setResult] = useState<ReturnType<typeof buildLessonAssist> | null>(null);
	const [balance, setBalance] = useState<AiCreditBalanceResponse | null>(null);
	const [loading, setLoading] = useState(false);
	const [message, setMessage] = useState<string | null>(null);

	useEffect(() => {
		void getAiCreditBalance().then(setBalance).catch(() => null);
	}, []);

	const creditCost = depthCreditCost[depth];
	const schoolCredits = balance?.schoolWallet.balanceCredits ?? 0;
	const canRun = Boolean(subject.trim() || topic.trim() || objective.trim()) && !loading;
	const creditLabel = useMemo(() => `${creditCost} AI credit${creditCost === 1 ? '' : 's'}`, [creditCost]);

	const generate = async () => {
		if (!canRun) return;
		setLoading(true);
		setMessage(null);
		try {
			await consumeAiCredits({
				credits: creditCost,
				featureKey: 'teacher-ai-lesson-assistant',
				ownerType: 'school',
				referenceId: crypto.randomUUID(),
				metadata: {
					subject: subject.trim() || null,
					topic: topic.trim() || null,
					className: className.trim() || null,
					depth,
				},
			});
			const refreshedBalance = await getAiCreditBalance();
			setBalance(refreshedBalance);
			setResult(buildLessonAssist({ subject, topic, className, objective, depth }));
			setMessage(`Lesson assistant run recorded. Remaining school credits: ${refreshedBalance.schoolWallet.balanceCredits}.`);
		} catch (error) {
			setMessage(error instanceof Error ? error.message : 'Assistant run failed.');
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="space-y-6">
			<section className="rounded-3xl border border-sky-500/20 bg-linear-to-br from-sky-500/10 via-slate-900 to-slate-950 p-6">
				<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
					<div>
						<p className="text-[10px] font-bold uppercase tracking-[0.3em] text-sky-300">Teacher AI Assistant</p>
						<h2 className="mt-2 text-2xl font-black text-white">Generate lesson scaffolds against the new credit ledger</h2>
						<p className="mt-2 max-w-2xl text-sm text-slate-300">Each assistant run debits school AI credits first, then returns a structured lesson scaffold teachers can adapt inside Ndovera.</p>
					</div>
					<div className="rounded-2xl border border-sky-400/20 bg-slate-950/70 px-4 py-3 text-sm text-slate-200">
						<div className="flex items-center gap-2 text-sky-300"><ReceiptText className="h-4 w-4" /> School credits</div>
						<p className="mt-2 text-3xl font-black text-white">{schoolCredits}</p>
						<p className="mt-1 text-xs text-slate-400">This run costs {creditLabel}.</p>
					</div>
				</div>
			</section>

			<section className="grid gap-4 xl:grid-cols-2">
				<div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
					<div className="grid gap-4 md:grid-cols-2">
						<label className="space-y-2 text-sm text-slate-300">
							<span className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500">Subject</span>
							<input value={subject} onChange={(event) => setSubject(event.target.value)} className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-sky-500" placeholder="Mathematics" />
						</label>
						<label className="space-y-2 text-sm text-slate-300">
							<span className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500">Class</span>
							<input value={className} onChange={(event) => setClassName(event.target.value)} className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-sky-500" placeholder="JSS 2 Gold" />
						</label>
					</div>
					<div className="mt-4 grid gap-4 md:grid-cols-2">
						<label className="space-y-2 text-sm text-slate-300">
							<span className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500">Topic</span>
							<input value={topic} onChange={(event) => setTopic(event.target.value)} className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-sky-500" placeholder="Linear equations" />
						</label>
						<label className="space-y-2 text-sm text-slate-300">
							<span className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500">Depth</span>
							<select value={depth} onChange={(event) => setDepth(event.target.value as AssistantDepth)} className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-sky-500">
								<option value="quick">Quick assist • 1 credit</option>
								<option value="standard">Standard assist • 2 credits</option>
								<option value="deep">Deep assist • 4 credits</option>
							</select>
						</label>
					</div>
					<label className="mt-4 block space-y-2 text-sm text-slate-300">
						<span className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500">Lesson goal</span>
						<textarea value={objective} onChange={(event) => setObjective(event.target.value)} className="min-h-30 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-sky-500" placeholder="Help learners solve one-step equations confidently and explain each step." />
					</label>
					<div className="mt-4 flex items-center gap-3">
						<button onClick={() => void generate()} disabled={!canRun} className="inline-flex items-center gap-2 rounded-2xl bg-sky-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50">
							<Bot className="h-4 w-4" />
							{loading ? 'Running assistant...' : `Run assistant • ${creditLabel}`}
						</button>
						{message ? <p className="text-sm text-slate-300">{message}</p> : null}
					</div>
				</div>

				<div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5 text-slate-200">
					<div className="flex items-center gap-2 text-sky-300">
						<Sparkles className="h-4 w-4" />
						<p className="text-[10px] font-bold uppercase tracking-[0.25em]">Generated support</p>
					</div>
					{result ? (
						<div className="mt-4 space-y-5">
							<div>
								<h3 className="text-xl font-black text-white">{result.headline}</h3>
								<p className="mt-2 text-sm text-slate-400">{result.detail}</p>
							</div>
							<div>
								<p className="text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-300">Objectives</p>
								<div className="mt-3 space-y-2">
									{result.objectives.map((item) => (
										<div key={item} className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-50">{item}</div>
									))}
								</div>
							</div>
							<div>
								<p className="text-[10px] font-bold uppercase tracking-[0.25em] text-sky-300">Suggested flow</p>
								<div className="mt-3 space-y-2">
									{result.flow.map((item) => (
										<div key={item} className="rounded-2xl border border-sky-500/20 bg-sky-500/5 px-4 py-3 text-sm text-sky-50">{item}</div>
									))}
								</div>
							</div>
							<div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-50">
								<div className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-4 w-4" /> Ledger-backed assistant run completed</div>
							</div>
						</div>
					) : (
						<div className="mt-6 rounded-3xl border border-dashed border-slate-700 px-5 py-8 text-center text-sm text-slate-500">Run the assistant to generate a lesson scaffold and record the debit in the AI credit ledger.</div>
					)}
				</div>
			</section>
		</div>
	);
}