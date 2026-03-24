import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Bot, CheckCircle2, Download, FileWarning, Landmark, Plus, ReceiptText, Sparkles } from 'lucide-react';

import { consumeAiCredits, getAiCreditBalance, type AiCreditBalanceResponse } from '../../../services/monetizationApi';

const weeks = Array.from({ length: 10 }, (_, index) => `Week ${index + 1}`);
const STORAGE_KEY = 'ndovera.lesson-plan-builder.v2';
const LATE_FINE_NAIRA = 5000;

type RoleMode = 'teacher' | 'sectional' | 'hos';
type AiTier = 'basic' | 'standard' | 'premium';

type LessonStep = {
	stage: string;
	teacher: string;
	pupils: string;
	point: string;
};

type LessonReviews = {
	sectionalHead: string;
	hos: string;
};

type LessonPlan = {
	id: string;
	subject: string;
	theme: string;
	topic: string;
	class: string;
	date: string;
	duration: string;
	numberInClass: string;
	averageAge: string;
	sex: string;
	learningMaterials: string;
	referenceMaterials: string;
	rationale: string;
	prerequisite: string;
	objectives: string;
	assessment: string;
	homework: string;
	notes: string;
	status: string;
	submittedAt: string | null;
	reviews: LessonReviews;
	steps: LessonStep[];
	aiTier: AiTier;
	aiUsageCount: number;
	aiRevenue: number;
	fineApplied: number;
	exportReadyCount: number;
};

type LessonPlanState = Record<string, LessonPlan[]>;

const aiPricing: Record<AiTier, number> = {
	basic: 50,
	standard: 100,
	premium: 200,
};

const aiCreditCost: Record<AiTier, number> = {
	basic: 1,
	standard: 2,
	premium: 4,
};

const baseFieldClass = 'w-full rounded-2xl border border-violet-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-200';
const baseTextAreaClass = `${baseFieldClass} min-h-[92px] resize-y`;

function createTeachingSteps(count: number, existing?: LessonStep[]) {
	const safeCount = Math.max(3, count);
	const intro = existing?.[0] || { stage: 'Introduction (5 min)', teacher: '', pupils: '', point: '' };
	const evaluation = existing?.[existing.length - 2] || { stage: 'Evaluation (5 min)', teacher: '', pupils: '', point: '' };
	const conclusion = existing?.[existing.length - 1] || { stage: 'Conclusion (5 min)', teacher: '', pupils: '', point: '' };
	const mappedSteps = Array.from({ length: safeCount }, (_, index) => {
		const existingStep = existing?.[index + 1];
		const stage = index === 0 ? 'Presentation: Step 1 (10 min)' : `Step ${index + 1} (10 min)`;
		return {
			stage,
			teacher: existingStep?.teacher || '',
			pupils: existingStep?.pupils || '',
			point: existingStep?.point || '',
		};
	});
	return [intro, ...mappedSteps, evaluation, conclusion];
}

function createLesson(): LessonPlan {
	return {
		id: crypto.randomUUID(),
		subject: '',
		theme: '',
		topic: '',
		class: '',
		date: '',
		duration: '40 mins',
		numberInClass: '',
		averageAge: '',
		sex: '',
		learningMaterials: '',
		referenceMaterials: '',
		rationale: '',
		prerequisite: '',
		objectives: '',
		assessment: '',
		homework: '',
		notes: '',
		status: 'Draft',
		submittedAt: null,
		reviews: {
			sectionalHead: '',
			hos: '',
		},
		steps: createTeachingSteps(3),
		aiTier: 'basic',
		aiUsageCount: 0,
		aiRevenue: 0,
		fineApplied: 0,
		exportReadyCount: 0,
	};
}

function parseNumberedLines(value: string) {
	return value
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean)
		.map((line) => line.replace(/^\d+[.)-]\s*/, '').trim());
}

function formatAssessment(objectives: string[]) {
	return objectives.map((objective, index) => `${index + 1}. ${objective}?`).join('\n');
}

function getTeachingSteps(lesson: LessonPlan) {
	return lesson.steps.slice(1, Math.max(lesson.steps.length - 2, 1));
}

function validateLesson(lesson: LessonPlan) {
	const objectives = parseNumberedLines(lesson.objectives);
	const assessments = parseNumberedLines(lesson.assessment);
	const teachingSteps = getTeachingSteps(lesson);
	const issues: string[] = [];

	if (objectives.length < 3) issues.push('Minimum of 3 objectives is required.');
	if (objectives.length !== teachingSteps.length) issues.push('The number of objectives must equal the number of teaching steps, excluding introduction, evaluation, and conclusion.');
	if (assessments.length < objectives.length) issues.push('Provide one evaluation question for each objective.');

	objectives.forEach((objective, index) => {
		const step = teachingSteps[index];
		const question = assessments[index];
		if (!step?.teacher.trim()) issues.push(`Step ${index + 1} must include a teacher activity aligned to Objective ${index + 1}.`);
		if (!step?.pupils.trim()) issues.push(`Step ${index + 1} must include a pupil activity.`);
		if (!step?.point.trim()) issues.push(`Step ${index + 1} must include a learning point.`);
		if (!question?.trim()) issues.push(`Evaluation question ${index + 1} is required for Objective ${index + 1}.`);
		if (!objective.trim()) issues.push(`Objective ${index + 1} cannot be empty.`);
	});

	return {
		isValid: issues.length === 0,
		issues,
		objectiveCount: objectives.length,
	};
}

function getSubmissionStatus(lesson: LessonPlan) {
	if (!lesson.submittedAt) return 'Draft';
	return lesson.status;
}

function getSubmissionDeadline(dateValue: string) {
	const deadline = dateValue ? new Date(dateValue) : new Date();
	deadline.setHours(12, 0, 0, 0);
	return deadline;
}

function safeReadState() {
	if (typeof window === 'undefined') return { 'Week 1': [createLesson()] } satisfies LessonPlanState;
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (!raw) return { 'Week 1': [createLesson()] } satisfies LessonPlanState;
		const parsed = JSON.parse(raw) as LessonPlanState;
		if (!parsed || typeof parsed !== 'object') return { 'Week 1': [createLesson()] } satisfies LessonPlanState;
		return parsed;
	} catch {
		return { 'Week 1': [createLesson()] } satisfies LessonPlanState;
	}
}

function getAiObjectives(lesson: LessonPlan, count: number) {
	const topicLabel = lesson.topic.trim() || 'the concept';
	const subjectLabel = lesson.subject.trim() || 'the subject matter';
	const themeLabel = lesson.theme.trim() || topicLabel;
	const library = [
		`Define ${topicLabel} within ${subjectLabel}.`,
		`Explain the key components of ${themeLabel}.`,
		`Apply ${topicLabel} correctly in guided examples.`,
		`Differentiate correct and incorrect uses of ${topicLabel}.`,
		`Evaluate learner responses about ${themeLabel}.`,
	];
	return Array.from({ length: Math.max(3, count) }, (_, index) => library[index] || `Demonstrate mastery objective ${index + 1} for ${topicLabel}.`);
}

type LessonPlanBuilderSystemProps = {
	goBack?: () => void;
	showBackButton?: boolean;
};

export default function LessonPlanBuilderSystem({ goBack, showBackButton = false }: LessonPlanBuilderSystemProps) {
	const [activeWeek, setActiveWeek] = useState('Week 1');
	const [role, setRole] = useState<RoleMode>('teacher');
	const [data, setData] = useState<LessonPlanState>(() => safeReadState());
	const [creditBalance, setCreditBalance] = useState<AiCreditBalanceResponse | null>(null);
	const [activeAiLessonId, setActiveAiLessonId] = useState<string | null>(null);

	useEffect(() => {
		if (typeof window === 'undefined') return;
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
	}, [data]);

	useEffect(() => {
		void getAiCreditBalance().then(setCreditBalance).catch(() => null);
	}, []);

	const lessons = data[activeWeek] || [];
	const allLessons = useMemo(() => Object.values(data).flat(), [data]);
	const dashboardMetrics = useMemo(() => {
		const lateSubmissions = allLessons.filter((lesson) => lesson.status === 'Late ❌ Fine Applied').length;
		const totalFines = allLessons.reduce((total, lesson) => total + lesson.fineApplied, 0);
		const totalAiRevenue = allLessons.reduce((total, lesson) => total + lesson.aiRevenue, 0);
		const aiUsageTotal = allLessons.reduce((total, lesson) => total + lesson.aiUsageCount, 0);
		const compliantLessons = allLessons.filter((lesson) => validateLesson(lesson).isValid).length;
		const submittedLessons = allLessons.filter((lesson) => lesson.submittedAt).length;
		return {
			lateSubmissions,
			totalFines,
			totalAiRevenue,
			aiUsageTotal,
			submittedLessons,
			compliantLessons,
		};
	}, [allLessons]);

	const updateWeekLessons = (nextLessons: LessonPlan[]) => {
		setData((current) => ({
			...current,
			[activeWeek]: nextLessons,
		}));
	};

	const updateField = (lessonIndex: number, field: keyof LessonPlan, value: string) => {
		const updated = [...lessons];
		const lesson = { ...updated[lessonIndex] };
		(lesson as Record<string, unknown>)[field] = value;
		if (field === 'objectives') {
			const objectiveCount = Math.max(3, parseNumberedLines(value).length || 3);
			lesson.steps = createTeachingSteps(objectiveCount, lesson.steps);
		}
		updated[lessonIndex] = lesson;
		updateWeekLessons(updated);
	};

	const updateStep = (lessonIndex: number, stepIndex: number, field: keyof LessonStep, value: string) => {
		const updated = [...lessons];
		updated[lessonIndex] = {
			...updated[lessonIndex],
			steps: updated[lessonIndex].steps.map((step, index) => (index === stepIndex ? { ...step, [field]: value } : step)),
		};
		updateWeekLessons(updated);
	};

	const updateReview = (lessonIndex: number, field: keyof LessonReviews, value: string) => {
		const updated = [...lessons];
		updated[lessonIndex] = {
			...updated[lessonIndex],
			reviews: {
				...updated[lessonIndex].reviews,
				[field]: value,
			},
		};
		updateWeekLessons(updated);
	};

	const addLesson = () => {
		updateWeekLessons([...lessons, createLesson()]);
	};

	const submitLesson = (lessonIndex: number) => {
		const updated = [...lessons];
		const lesson = { ...updated[lessonIndex] };
		const validation = validateLesson(lesson);
		if (!validation.isValid) {
			window.alert(`Lesson plan is not compliant yet:\n\n${validation.issues.join('\n')}`);
			return;
		}

		const now = new Date();
		const deadline = getSubmissionDeadline(lesson.date);
		const isLate = now > deadline;
		lesson.submittedAt = now.toISOString();
		lesson.status = isLate ? 'Late ❌ Fine Applied' : 'Submitted ✅';
		lesson.fineApplied = isLate ? LATE_FINE_NAIRA : 0;
		updated[lessonIndex] = lesson;
		updateWeekLessons(updated);
	};

	const generateAI = async (lessonIndex: number) => {
		const updated = [...lessons];
		const lesson = { ...updated[lessonIndex] };
		setActiveAiLessonId(lesson.id);
		try {
			await consumeAiCredits({
				credits: aiCreditCost[lesson.aiTier],
				featureKey: 'teacher-ai-lesson-plan-builder',
				ownerType: 'school',
				referenceId: lesson.id,
				metadata: {
					aiTier: lesson.aiTier,
					subject: lesson.subject || null,
					topic: lesson.topic || null,
					week: activeWeek,
				},
			});
			const refreshedBalance = await getAiCreditBalance();
			setCreditBalance(refreshedBalance);
		} catch (error) {
			window.alert(error instanceof Error ? error.message : 'AI credit debit failed.');
			setActiveAiLessonId(null);
			return;
		}
		const objectiveCount = Math.max(3, parseNumberedLines(lesson.objectives).length || 3);
		const objectives = getAiObjectives(lesson, objectiveCount);
		const steps = createTeachingSteps(objectiveCount, lesson.steps).map((step, index, source) => {
			if (index === 0) {
				return {
					...step,
					teacher: `Activate prior knowledge on ${lesson.topic || 'the topic'} and link it to today's lesson.`,
					pupils: 'Respond to starter questions and connect prior knowledge to the new topic.',
					point: 'Learners connect prior knowledge to the lesson focus.',
				};
			}
			if (index === source.length - 2) {
				return {
					...step,
					teacher: `Ask ${objectives.length} evaluation questions mapped directly to the objectives.`,
					pupils: 'Answer each evaluation question orally or in writing.',
					point: 'Evaluation checks each objective directly.',
				};
			}
			if (index === source.length - 1) {
				return {
					...step,
					teacher: `Summarise the core learning points on ${lesson.topic || 'the lesson topic'}.`,
					pupils: 'State one key takeaway and note the homework task.',
					point: 'The lesson closes with a concise recap and next action.',
				};
			}
			const objective = objectives[index - 1];
			return {
				...step,
				teacher: `Teach Objective ${index}: ${objective}`,
				pupils: `Participate in guided practice for Objective ${index}.`,
				point: objective,
			};
		});

		const aiCost = aiPricing[lesson.aiTier];
		lesson.objectives = objectives.map((objective, index) => `${index + 1}. ${objective}`).join('\n');
		lesson.steps = steps;
		lesson.assessment = formatAssessment(objectives);
		lesson.aiUsageCount += 1;
		lesson.aiRevenue += aiCost;
		lesson.status = lesson.status === 'Draft' ? `Draft • AI ${lesson.aiTier}` : lesson.status;
		updated[lessonIndex] = lesson;
		updateWeekLessons(updated);
		window.alert(`AI usage billed at ₦${aiCost.toLocaleString()} (${lesson.aiTier}) and ${aiCreditCost[lesson.aiTier]} credit(s) debited.`);
		setActiveAiLessonId(null);
	};

	const exportWord = (lessonIndex: number) => {
		const updated = [...lessons];
		updated[lessonIndex] = {
			...updated[lessonIndex],
			exportReadyCount: updated[lessonIndex].exportReadyCount + 1,
		};
		updateWeekLessons(updated);
		window.alert('Word export hook is ready for backend docx integration.');
	};

	return (
		<div className="min-h-screen bg-linear-to-br from-indigo-50 via-fuchsia-50 to-violet-100 p-4 md:p-6">
			<div className="mx-auto max-w-7xl space-y-6">
				{showBackButton && goBack ? (
					<button onClick={goBack} className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white px-4 py-2 text-sm font-semibold text-violet-700 shadow-sm transition hover:border-violet-300 hover:bg-violet-50">
						<ArrowLeft className="h-4 w-4" />
						Back to Lesson Plans
					</button>
				) : null}

				<section className="rounded-4xl border border-white/70 bg-white/90 p-6 shadow-xl shadow-violet-200/40 backdrop-blur">
					<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
						<div>
							<p className="text-xs font-black uppercase tracking-[0.35em] text-violet-500">School Lesson Plan System</p>
							<h1 className="mt-3 text-3xl font-black text-violet-900">Lesson planning, compliance, AI billing, and review workflow in one surface</h1>
							<p className="mt-3 max-w-4xl text-sm text-slate-600">
								The builder enforces pedagogical mapping: minimum 3 objectives, one teaching step per objective, and one evaluation question per objective.
							</p>
						</div>
						<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
							<div className="rounded-3xl bg-violet-950 px-5 py-4 text-white shadow-lg">
								<p className="text-xs font-black uppercase tracking-[0.28em] text-violet-200">Late submissions</p>
								<p className="mt-3 text-3xl font-black">{dashboardMetrics.lateSubmissions}</p>
							</div>
							<div className="rounded-3xl bg-rose-600 px-5 py-4 text-white shadow-lg">
								<p className="text-xs font-black uppercase tracking-[0.28em] text-rose-100">Total fines</p>
								<p className="mt-3 text-3xl font-black">₦{dashboardMetrics.totalFines.toLocaleString()}</p>
							</div>
							<div className="rounded-3xl bg-sky-600 px-5 py-4 text-white shadow-lg">
								<p className="text-xs font-black uppercase tracking-[0.28em] text-sky-100">AI revenue</p>
								<p className="mt-3 text-3xl font-black">₦{dashboardMetrics.totalAiRevenue.toLocaleString()}</p>
							</div>
							<div className="rounded-3xl bg-slate-950 px-5 py-4 text-white shadow-lg">
								<p className="text-xs font-black uppercase tracking-[0.28em] text-slate-300">School AI credits</p>
								<p className="mt-3 text-3xl font-black">{creditBalance?.schoolWallet.balanceCredits ?? 0}</p>
							</div>
							<div className="rounded-3xl bg-emerald-600 px-5 py-4 text-white shadow-lg">
								<p className="text-xs font-black uppercase tracking-[0.28em] text-emerald-100">Compliant plans</p>
								<p className="mt-3 text-3xl font-black">{dashboardMetrics.compliantLessons}/{allLessons.length || 1}</p>
							</div>
						</div>
					</div>

					<div className="mt-6 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
						<div className="rounded-[28px] border border-violet-100 bg-linear-to-br from-violet-100 via-white to-fuchsia-50 p-5">
							<div className="flex items-center gap-2 text-violet-700">
								<ReceiptText className="h-4 w-4" />
								<p className="text-xs font-black uppercase tracking-[0.3em]">Payment logic ready</p>
							</div>
							<p className="mt-3 text-sm text-slate-700">Basic AI ₦50, Standard ₦100, Premium ₦200. Monthly subscription can zero out cost at the pricing rule layer.</p>
						</div>
						<div className="rounded-[28px] border border-emerald-100 bg-linear-to-br from-emerald-50 via-white to-sky-50 p-5">
							<div className="flex items-center gap-2 text-emerald-700">
								<Landmark className="h-4 w-4" />
								<p className="text-xs font-black uppercase tracking-[0.3em]">Operational summary</p>
							</div>
							<p className="mt-3 text-sm text-slate-700">Submitted plans: {dashboardMetrics.submittedLessons}. AI runs: {dashboardMetrics.aiUsageTotal}. Late plans automatically carry a ₦{LATE_FINE_NAIRA.toLocaleString()} fine.</p>
						</div>
					</div>
				</section>

				<div className="flex flex-wrap items-center justify-between gap-4">
					<div className="flex flex-wrap gap-2">
						{(['teacher', 'sectional', 'hos'] as RoleMode[]).map((entry) => (
							<button
								key={entry}
								onClick={() => setRole(entry)}
								className={`rounded-full px-4 py-2 text-sm font-bold capitalize transition ${role === entry ? 'bg-violet-700 text-white shadow-lg shadow-violet-200' : 'bg-white text-violet-700 border border-violet-200 hover:bg-violet-50'}`}
							>
								{entry}
							</button>
						))}
					</div>
					<div className="flex flex-wrap gap-2">
						{weeks.map((week) => (
							<button
								key={week}
								onClick={() => setActiveWeek(week)}
								className={`rounded-full px-4 py-2 text-sm font-semibold transition ${activeWeek === week ? 'bg-violet-700 text-white shadow-lg shadow-violet-200' : 'bg-white text-slate-700 border border-violet-100 hover:bg-violet-50'}`}
							>
								{week}
							</button>
						))}
					</div>
				</div>

				{lessons.map((lesson, lessonIndex) => {
					const compliance = validateLesson(lesson);
					return (
						<section key={lesson.id} className="rounded-4xl border border-white/70 bg-white/95 p-6 shadow-xl shadow-violet-200/30">
							<div className="flex flex-col gap-4 border-b border-violet-100 pb-5 lg:flex-row lg:items-start lg:justify-between">
								<div>
									<p className="text-xs font-black uppercase tracking-[0.3em] text-violet-500">{activeWeek}</p>
									<h2 className="mt-2 text-2xl font-black text-violet-900">Lesson Plan Builder</h2>
									<p className="mt-2 text-sm text-slate-600">Strict alignment is enforced across objectives, teaching steps, and evaluation questions.</p>
								</div>
								<div className="flex flex-wrap items-center gap-3">
									<span className={`rounded-full px-4 py-2 text-sm font-bold ${compliance.isValid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{getSubmissionStatus(lesson)}</span>
									<span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">AI tier: {lesson.aiTier}</span>
								</div>
							</div>

							{!compliance.isValid ? (
								<div className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
									<div className="flex items-center gap-2 font-bold"><FileWarning className="h-4 w-4" /> Compliance issues</div>
									<ul className="mt-3 space-y-1">
										{compliance.issues.map((issue) => <li key={issue}>• {issue}</li>)}
									</ul>
								</div>
							) : null}

							<div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
								{[
									['subject', 'Subject'],
									['theme', 'Theme'],
									['topic', 'Topic'],
									['class', 'Class'],
									['date', 'Date'],
									['duration', 'Duration'],
									['numberInClass', 'Number in Class'],
									['averageAge', 'Average Age'],
									['sex', 'Sex'],
									['learningMaterials', 'Learning Materials'],
									['referenceMaterials', 'Reference Materials'],
								].map(([field, label]) => (
									<label key={field} className="space-y-2">
										<span className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">{label}</span>
										<input
											type={field === 'date' ? 'date' : 'text'}
											value={(lesson as unknown as Record<string, string>)[field] || ''}
											onChange={(event) => updateField(lessonIndex, field as keyof LessonPlan, event.target.value)}
											className={baseFieldClass}
											placeholder={label}
										/>
									</label>
								))}
								<label className="space-y-2">
									<span className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">AI tier</span>
									<select value={lesson.aiTier} onChange={(event) => {
										const updated = [...lessons];
										updated[lessonIndex] = { ...updated[lessonIndex], aiTier: event.target.value as AiTier };
										updateWeekLessons(updated);
									}} className={baseFieldClass}>
										<option value="basic">Basic • ₦50 • 1 credit</option>
										<option value="standard">Standard • ₦100 • 2 credits</option>
										<option value="premium">Premium • ₦200 • 4 credits</option>
									</select>
								</label>
							</div>

							<div className="mt-5 grid gap-4 lg:grid-cols-2">
								<label className="space-y-2">
									<span className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">Rationale</span>
									<textarea className={baseTextAreaClass} value={lesson.rationale} onChange={(event) => updateField(lessonIndex, 'rationale', event.target.value)} placeholder="Why the lesson matters for this class." />
								</label>
								<label className="space-y-2">
									<span className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">Prerequisite knowledge</span>
									<textarea className={baseTextAreaClass} value={lesson.prerequisite} onChange={(event) => updateField(lessonIndex, 'prerequisite', event.target.value)} placeholder="What learners should already know." />
								</label>
							</div>

							<div className="mt-5 grid gap-4 lg:grid-cols-2">
								<label className="space-y-2">
									<span className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">Learning objectives</span>
									<textarea className={baseTextAreaClass} value={lesson.objectives} onChange={(event) => updateField(lessonIndex, 'objectives', event.target.value)} placeholder={'1. Objective one\n2. Objective two\n3. Objective three'} />
								</label>
								<label className="space-y-2">
									<span className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">Assessment</span>
									<textarea className={baseTextAreaClass} value={lesson.assessment} onChange={(event) => updateField(lessonIndex, 'assessment', event.target.value)} placeholder={'1. Evaluation question one\n2. Evaluation question two\n3. Evaluation question three'} />
								</label>
							</div>

							<div className="mt-5 overflow-x-auto rounded-[28px] border border-violet-100 bg-violet-50/50">
								<table className="min-w-full text-sm">
									<thead className="bg-violet-200/70 text-violet-900">
										<tr>
											<th className="border-b border-violet-100 px-4 py-3 text-left font-black uppercase tracking-[0.2em]">Step / Time</th>
											<th className="border-b border-violet-100 px-4 py-3 text-left font-black uppercase tracking-[0.2em]">Teacher</th>
											<th className="border-b border-violet-100 px-4 py-3 text-left font-black uppercase tracking-[0.2em]">Pupils</th>
											<th className="border-b border-violet-100 px-4 py-3 text-left font-black uppercase tracking-[0.2em]">Learning point</th>
										</tr>
									</thead>
									<tbody>
										{lesson.steps.map((step, stepIndex) => (
											<tr key={`${lesson.id}-${step.stage}`} className="align-top">
												<td className="border-b border-violet-100 px-4 py-3 font-semibold text-slate-700">{step.stage}</td>
												<td className="border-b border-violet-100 p-3"><textarea className={baseTextAreaClass} value={step.teacher} onChange={(event) => updateStep(lessonIndex, stepIndex, 'teacher', event.target.value)} /></td>
												<td className="border-b border-violet-100 p-3"><textarea className={baseTextAreaClass} value={step.pupils} onChange={(event) => updateStep(lessonIndex, stepIndex, 'pupils', event.target.value)} /></td>
												<td className="border-b border-violet-100 p-3"><textarea className={baseTextAreaClass} value={step.point} onChange={(event) => updateStep(lessonIndex, stepIndex, 'point', event.target.value)} /></td>
											</tr>
										))}
									</tbody>
								</table>
							</div>

							<div className="mt-5 grid gap-4 lg:grid-cols-2">
								<label className="space-y-2">
									<span className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">Homework</span>
									<textarea className={baseTextAreaClass} value={lesson.homework} onChange={(event) => updateField(lessonIndex, 'homework', event.target.value)} placeholder="Homework or follow-up task." />
								</label>
								<label className="space-y-2">
									<span className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">Teacher notes</span>
									<textarea className={baseTextAreaClass} value={lesson.notes} onChange={(event) => updateField(lessonIndex, 'notes', event.target.value)} placeholder="Delivery notes, differentiation, or reflection." />
								</label>
							</div>

							<div className="mt-5 flex flex-wrap gap-3">
								{role === 'teacher' ? (
									<>
										<button onClick={() => void generateAI(lessonIndex)} disabled={activeAiLessonId === lesson.id} className="inline-flex items-center gap-2 rounded-2xl bg-sky-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-sky-200/60 transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"><Bot className="h-4 w-4" /> {activeAiLessonId === lesson.id ? 'Using AI...' : `Use AI • ${aiCreditCost[lesson.aiTier]} credit${aiCreditCost[lesson.aiTier] === 1 ? '' : 's'}`}</button>
										<button onClick={() => submitLesson(lessonIndex)} className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-200/60 transition hover:bg-emerald-500"><CheckCircle2 className="h-4 w-4" /> Submit</button>
										<button onClick={() => exportWord(lessonIndex)} className="inline-flex items-center gap-2 rounded-2xl bg-violet-700 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-violet-200/60 transition hover:bg-violet-600"><Download className="h-4 w-4" /> Export Word</button>
									</>
								) : null}
							</div>

							{role === 'sectional' ? (
								<label className="mt-5 block space-y-2">
									<span className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">Sectional head comment</span>
									<textarea className={baseTextAreaClass} value={lesson.reviews.sectionalHead} onChange={(event) => updateReview(lessonIndex, 'sectionalHead', event.target.value)} placeholder="Sectional Head Comment" />
								</label>
							) : null}

							{role === 'hos' ? (
								<label className="mt-5 block space-y-2">
									<span className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">HOS comment</span>
									<textarea className={baseTextAreaClass} value={lesson.reviews.hos} onChange={(event) => updateReview(lessonIndex, 'hos', event.target.value)} placeholder="HOS Comment" />
								</label>
							) : null}

							<div className="mt-5 grid gap-4 lg:grid-cols-4">
								<div className="rounded-3xl border border-violet-100 bg-violet-50 p-4">
									<p className="text-xs font-black uppercase tracking-[0.24em] text-violet-500">AI runs</p>
									<p className="mt-2 text-2xl font-black text-violet-900">{lesson.aiUsageCount}</p>
								</div>
								<div className="rounded-3xl border border-sky-100 bg-sky-50 p-4">
									<p className="text-xs font-black uppercase tracking-[0.24em] text-sky-600">AI revenue</p>
									<p className="mt-2 text-2xl font-black text-sky-900">₦{lesson.aiRevenue.toLocaleString()}</p>
								</div>
								<div className="rounded-3xl border border-rose-100 bg-rose-50 p-4">
									<p className="text-xs font-black uppercase tracking-[0.24em] text-rose-600">Fine applied</p>
									<p className="mt-2 text-2xl font-black text-rose-900">₦{lesson.fineApplied.toLocaleString()}</p>
								</div>
								<div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-4">
									<p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-600">Word export hooks</p>
									<p className="mt-2 text-2xl font-black text-emerald-900">{lesson.exportReadyCount}</p>
								</div>
							</div>

							<p className="mt-5 text-sm font-semibold text-slate-700">Status: {lesson.status}</p>
						</section>
					);
				})}

				<div className="text-center">
					<button onClick={addLesson} className="inline-flex items-center gap-2 rounded-full bg-violet-800 px-6 py-3 text-sm font-bold text-white shadow-xl shadow-violet-200/60 transition hover:bg-violet-700">
						<Plus className="h-4 w-4" />
						Add Subject
					</button>
				</div>

				<section className="rounded-4xl border border-white/70 bg-white/90 p-6 shadow-xl shadow-violet-200/30">
					<div className="flex items-center gap-2 text-violet-700">
						<Sparkles className="h-4 w-4" />
						<p className="text-xs font-black uppercase tracking-[0.3em]">Compliance and SaaS readiness</p>
					</div>
					<div className="mt-4 grid gap-4 lg:grid-cols-3">
						<div className="rounded-3xl border border-violet-100 bg-violet-50 p-4 text-sm text-slate-700">Late submissions are flagged automatically and fines are aggregated live for school accountability.</div>
						<div className="rounded-3xl border border-sky-100 bg-sky-50 p-4 text-sm text-slate-700">AI usage is billed per click and the payment rule is ready for Paystack, Stripe, or subscription overrides.</div>
						<div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-slate-700">Word export is intentionally hooked for a future backend `docx` integration without changing the builder UX.</div>
					</div>
				</section>
			</div>
		</div>
	);
}