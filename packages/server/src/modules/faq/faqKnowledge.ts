const SUPPORT_EMAIL = 'support@ndovera.com';

type RoleGuide = {
	label: string;
	summary: string;
	can: string[];
	cannot: string[];
	howToUse: string[];
};

export type FaqVerifiedUser = {
	id?: string;
	name?: string;
	schoolName?: string;
	activeRole?: string;
	roles?: string[];
} | null;

export type FaqAnswerContext = {
	mode: 'public' | 'verified';
	verifiedUser?: FaqVerifiedUser;
};

export type FaqAnswerResult = {
	answer: string;
	matched: boolean;
};

export type EnquiryPathKey =
	| 'school-onboarding'
	| 'growth-and-opportunities'
	| 'public-website-and-events'
	| 'finance-and-billing'
	| 'privacy-and-compliance'
	| 'technical-support'
	| 'general-support';

export type EnquiryRouting = {
	path: EnquiryPathKey;
	label: string;
	primaryResponsibleRole: string;
	responsibleRoles: string[];
	note: string;
};

const platformHighlights = [
	'Lessons and learning: classroom work, assignments, live lessons, lesson planning, timetables, and released results.',
	'School services: attendance, library, clinic, hostel, tuck shop, file sharing, notices, and reports.',
	'Leadership and admin: role-based dashboards, school setup, finance pages, public website pages, and onboarding support.',
	'Guided help: simple study help for students and lesson help for teachers when the school turns it on.',
	'Communication: announcements, parent updates, contact forms, and public school pages.',
];

const howItWorks = [
	'A school signs up from the public page and completes the first setup steps.',
	'The school then adds users such as students, teachers, parents, finance staff, and leaders.',
	'Each person signs in and sees the tools meant for their role.',
	'Daily school work then happens in one place: lessons, attendance, fees, notices, and reports.',
	'If guided help tools are turned on, the school can track how they are used.',
];

const signupGuide = [
	'For a new school: use Register School on the landing page, then follow the setup steps.',
	'For a student, teacher, parent, or staff member: your school must create your account before you can sign in.',
	'For growth partners: use the public Join Growth Team form.',
	'If you cannot find your account yet, ask your school first or email support@ndovera.com.',
];

const specialPoints = [
	'Each school has its own space.',
	'Lessons, fees, reports, notices, and public pages can all be handled in one place.',
	'People only see the parts meant for their role, so the workspace stays clear.',
	'The same public site can handle school sign-up, contact, opportunities, and help requests.',
];

const roleGuides: Record<string, RoleGuide> = {
	student: {
		label: 'Student',
		summary: 'Students work mainly inside classroom, assignments, results visibility, attendance visibility, tutorials, and selected wallet or service features enabled by the school.',
		can: [
			'Open classroom materials, assignments, practice tools, and live class experiences provided by the school.',
			'Submit assignment answers and view teacher feedback where enabled.',
			'View attendance and results that the school has released to the student account.',
			'Use approved AI explanation flows when the school has AI credits available.',
		],
		cannot: [
			'Create school-wide users, manage billing, publish results, appoint heads, or access other users’ restricted data.',
			'Operate leadership, finance, or global administration tools.',
		],
		howToUse: [
			'Sign in with the account created by your school.',
			'Open Classroom first for lessons, assignments, practice, and live learning.',
			'Use Dashboard, Notifications, and any school-enabled student modules to track updates.',
		],
	},
	teacher: {
		label: 'Teacher',
		summary: 'Teachers run classroom delivery, lesson planning, assignments, grading flows, attendance, and teacher AI assistance.',
		can: [
			'Create or manage lessons, assignments, and classroom content.',
			'Mark attendance and review student work.',
			'Use the teacher AI lesson assistant to draft structured lesson support when credits are available.',
			'Work with practice banks, classroom messaging, and class-facing resources.',
		],
		cannot: [
			'Run tenant-wide billing decisions, owner-only oversight, or global platform administration unless separately assigned.',
			'Appoint the HoS without owner or platform-level authority.',
		],
		howToUse: [
			'Open Dashboard or Teacher view to manage daily teaching work.',
			'Use Classroom, Attendance, Lesson Planning, and Messaging during normal teaching operations.',
			'Coordinate with HoS, HOD, or School Admin for approvals and wider school settings.',
		],
	},
	parent: {
		label: 'Parent',
		summary: 'Parents monitor wards, review academic and attendance information made available by the school, and can interact with selected child-facing services.',
		can: [
			'View linked children or wards where the account is connected by the school.',
			'Check results, attendance-related information, notifications, and selected child service history.',
			'Manage parent-side controls in enabled flows such as tuck shop restrictions or child spending oversight.',
		],
		cannot: [
			'Grade assignments, publish results, create school users, or manage school-wide billing and operations.',
			'Edit restricted academic records directly unless the school exposes a specific workflow for it.',
		],
		howToUse: [
			'Sign in with the parent account linked to your child by the school.',
			'Use Dashboard first, then switch into ward-specific views when needed.',
			'Contact the school if your ward link, results access, or attendance data is missing.',
		],
	},
	hos: {
		label: 'HoS',
		summary: 'The Head of School oversees school-wide operations, reports, and attendance overrides, and can drive sectional leadership workflows.',
		can: [
			'Manage school-wide reports and oversight decisions.',
			'Use leadership dashboards across academics, operations, and finance visibility.',
			'Assign sectional head roles where allowed by the platform workflow.',
			'Coordinate attendance overrides and school management actions.',
		],
		cannot: [
			'Operate global super-admin functions unless also assigned a platform-wide role.',
			'Be appointed by ordinary staff; that appointment is controlled by owner or platform-level authority.',
		],
		howToUse: [
			'Start from Dashboard, then move into Management, Reports, Finance, Attendance, and Classroom oversight as needed.',
			'Use role assignment carefully for school leadership structure.',
		],
	},
	owner: {
		label: 'Owner',
		summary: 'Owners sit above daily workflows and focus on school management, billing visibility, and strategic oversight.',
		can: [
			'Oversee school management and billing-related visibility.',
			'Appoint the HoS or leadership structure through the supported workflow.',
			'Review operational and financial performance from high-level dashboards.',
		],
		cannot: [
			'Use global platform administration unless separately granted a super or platform-wide role.',
			'Bypass support for unsupported account-specific technical actions that the FAQ assistant cannot perform.',
		],
		howToUse: [
			'Use Dashboard, Finance, Reports, and Management for oversight.',
			'Coordinate with HoS, School Admin, and finance staff for execution.',
		],
	},
	schooladmin: {
		label: 'School Admin',
		summary: 'School Admin covers front-desk or administrative coordination, approvals, directory work, and selected finance or management workflows depending on setup.',
		can: [
			'Operate administrative dashboards and approval workflows.',
			'Support finance or reports actions when the school configuration allows it.',
			'Help coordinate communication, onboarding, and day-to-day school processes.',
		],
		cannot: [
			'Act as a global super-admin without platform-level assignment.',
			'Perform owner-only or unsupported technical escalations inside this FAQ assistant.',
		],
		howToUse: [
			'Start from Dashboard, Management, Notifications, and any assigned finance or operations modules.',
		],
	},
	accountant: {
		label: 'Accountant',
		summary: 'Accountants handle fee visibility, payment creation, and finance reporting.',
		can: [
			'View fees, create payment records, and review finance reports.',
			'Work inside finance workflows such as invoices, balances, and payment proof handling where configured.',
		],
		cannot: [
			'Run global pricing control unless assigned a platform-wide finance role.',
			'Access unrelated academic administration outside granted permissions.',
		],
		howToUse: [
			'Use Finance first, then open history or reports depending on the task.',
		],
	},
	classteacher: {
		label: 'Class Teacher',
		summary: 'Class Teachers focus on their class attendance, class management, and student visibility.',
		can: [
			'Mark attendance and view class attendance patterns.',
			'View students in the assigned class and manage class-specific workflows.',
		],
		cannot: [
			'Run whole-school finance, owner actions, or global admin actions unless separately assigned.',
		],
		howToUse: [
			'Use Dashboard, Attendance, Classroom, and class-specific management flows.',
		],
	},
	hod: {
		label: 'HOD',
		summary: 'Heads of Department coordinate departmental academics, exams, and results publishing flows.',
		can: [
			'Manage department processes, create exams, and publish results where enabled.',
			'View students relevant to departmental work.',
		],
		cannot: [
			'Act as owner or global super-admin without additional roles.',
		],
		howToUse: [
			'Use Classroom, Reports, and departmental workflows from the leadership workspace.',
		],
	},
	operations: {
		label: 'Operations Staff',
		summary: 'Operations roles such as librarian, tuck shop manager, transport manager, and clinic officer run service-specific modules.',
		can: [
			'Librarian: manage library stock and borrowing flows.',
			'Tuckshop Manager: manage products, sales, and service transactions.',
			'Transport Manager: manage transport workflows.',
			'Clinic Officer: manage clinic workflows and student health visibility allowed by the role.',
		],
		cannot: [
			'Use unrelated global, owner, or restricted academic leadership tools without extra permissions.',
		],
		howToUse: [
			'Open the service module tied to your job function and work from the operations dashboard.',
		],
	},
	superadmin: {
		label: 'Platform-Wide Roles',
		summary: 'Platform-wide roles include Super Admin, Ami, and specialist global roles such as infrastructure, privacy, onboarding, growth, support, and QA.',
		can: [
			'Operate global oversight beyond a single school, depending on the exact platform role.',
			'Manage system-wide governance, onboarding, escalations, compliance, partnerships, or infrastructure according to the role definition.',
		],
		cannot: [
			'Use the school portal as if it were an ordinary school account when the platform intentionally separates those workspaces.',
		],
		howToUse: [
			'Use the super-admin environment or platform-wide tools assigned to your role.',
		],
	},
};

function normalize(value: string) {
	return value.trim().toLowerCase();
}

function compactWhitespace(value: string) {
	return normalize(value).replace(/\s+/g, ' ');
}

function hasAny(text: string, terms: string[]) {
	return terms.some((term) => text.includes(term));
}

function formatList(title: string, items: string[]) {
	return `${title}\n- ${items.join('\n- ')}`;
}

function resolveRoleKey(role?: string | null) {
	const normalized = compactWhitespace(String(role || ''));
	if (!normalized) return null;
	if (['student', 'alumni'].includes(normalized)) return 'student';
	if (normalized === 'teacher') return 'teacher';
	if (normalized === 'parent') return 'parent';
	if (['hos', 'ho s', 'head of school'].includes(normalized)) return 'hos';
	if (['owner', 'tenant school owner'].includes(normalized)) return 'owner';
	if (normalized === 'school admin') return 'schooladmin';
	if (normalized === 'accountant' || normalized === 'bursar' || normalized === 'finance officer') return 'accountant';
	if (normalized === 'class teacher') return 'classteacher';
	if (['hod', 'head of department'].includes(normalized)) return 'hod';
	if (['librarian', 'tuckshop manager', 'transport manager', 'clinic officer'].includes(normalized)) return 'operations';
	if (['super admin', 'ami', 'system infrastructure monitor', 'database reliability engineer', 'security & compliance auditor', 'global finance controller', 'growth & partnership director', 'global support escalation lead', 'school onboarding verifier', 'public relations & event broadcaster', 'platform qa overseer', 'data privacy officer', 'scholarship programme director'].includes(normalized)) return 'superadmin';
	return null;
}

function findRoleFromQuestion(question: string, verifiedUser?: FaqVerifiedUser) {
	const normalizedQuestion = compactWhitespace(question);
	const explicitRoles = [
		'Student',
		'Teacher',
		'Parent',
		'HoS',
		'Owner',
		'School Admin',
		'Accountant',
		'Finance Officer',
		'Class Teacher',
		'HOD',
		'Librarian',
		'Tuckshop Manager',
		'Transport Manager',
		'Clinic Officer',
		'Super Admin',
		'Ami',
	];
	for (const role of explicitRoles) {
		if (normalizedQuestion.includes(compactWhitespace(role))) return role;
	}
	return verifiedUser?.activeRole || verifiedUser?.roles?.[0] || null;
}

function buildRoleGuideAnswer(roleLabel: string) {
	const key = resolveRoleKey(roleLabel) || 'superadmin';
	const guide = roleGuides[key];
	return [
		`${guide.label}\n${guide.summary}`,
		formatList('Can do', guide.can),
		formatList('Cannot do', guide.cannot),
		formatList('How to use', guide.howToUse),
	].join('\n\n');
}

function buildRoleDirectoryAnswer() {
	return [
		'Core school roles',
		'- Student: learns, submits work, sees released updates and results.',
		'- Parent: monitors wards and parent-facing services.',
		'- Teacher and Class Teacher: delivers teaching, attendance, and class workflows.',
		'- HOD and Exam Officer: departmental and examination workflows.',
		'- HoS, Principal, Head Teacher, Nursery Head, School Admin, Owner: school leadership and oversight.',
		'- Accountant: finance and payment workflows.',
		'- Librarian, Tuckshop Manager, Transport Manager, Clinic Officer: operations modules.',
		'- Super Admin, Ami, and other platform-wide roles: global governance, support, onboarding, privacy, growth, QA, and infrastructure.',
	].join('\n');
}

function buildFeatureAnswer() {
	return [
		'Ndovera capabilities',
		...platformHighlights.map((item) => `- ${item}`),
	].join('\n');
}

function buildHowItWorksAnswer() {
	return [
		'How Ndovera works',
		...howItWorks.map((item) => `- ${item}`),
	].join('\n');
}

function buildSignupAnswer() {
	return [
		'Signup and access',
		...signupGuide.map((item) => `- ${item}`),
	].join('\n');
}

function buildSpecialAnswer() {
	return [
		'What makes Ndovera special',
		...specialPoints.map((item) => `- ${item}`),
	].join('\n');
}

function buildFallback(context: FaqAnswerContext) {
	if (context.mode === 'verified') {
		return `I can explain what Ndovera does, how it works, how sign-up works, and what each role can do. If you need help with your own account, please contact ${SUPPORT_EMAIL}.`;
	}
	return `I can explain what Ndovera does, how sign-up works, and what each role can do. To get started, register your school or contact ${SUPPORT_EMAIL}.`;
}

export function classifyEnquiryPath(message: string): EnquiryRouting {
	const normalizedMessage = compactWhitespace(message);

	if (hasAny(normalizedMessage, ['register school', 'school registration', 'onboarding', 'set up school', 'setup school', 'subdomain', 'owner account', 'school approval', 'school verification'])) {
		return {
			path: 'school-onboarding',
			label: 'School onboarding and registration',
			primaryResponsibleRole: 'School Onboarding Verifier',
			responsibleRoles: ['School Onboarding Verifier', 'Super Admin'],
			note: 'Use this route for school sign-up, verification, activation, subdomain, and onboarding issues.',
		};
	}

	if (hasAny(normalizedMessage, ['growth partner', 'growth team', 'partner', 'partnership', 'referral', 'referrals', 'opportunities', 'vacancy', 'vacancies', 'jobs', 'careers'])) {
		return {
			path: 'growth-and-opportunities',
			label: 'Growth partnerships and opportunities',
			primaryResponsibleRole: 'Growth & Partnership Director',
			responsibleRoles: ['Growth & Partnership Director', 'Super Admin'],
			note: 'Use this route for partner applications, referrals, public opportunities, and growth requests.',
		};
	}

	if (hasAny(normalizedMessage, ['website', 'landing page', 'public page', 'about us', 'contact us', 'gallery', 'event', 'events', 'announcement', 'branding', 'public content'])) {
		return {
			path: 'public-website-and-events',
			label: 'Public website, branding, and events',
			primaryResponsibleRole: 'Public Relations & Event Broadcaster',
			responsibleRoles: ['Public Relations & Event Broadcaster', 'Super Admin'],
			note: 'Use this route for public website pages, events, announcements, and branding questions.',
		};
	}

	if (hasAny(normalizedMessage, ['billing', 'invoice', 'payment', 'payments', 'pricing', 'subscription', 'finance', 'fee', 'fees', 'credit', 'ai credit', 'wallet'])) {
		return {
			path: 'finance-and-billing',
			label: 'Finance, billing, and pricing',
			primaryResponsibleRole: 'Global Finance Controller',
			responsibleRoles: ['Global Finance Controller', 'Super Admin'],
			note: 'Use this route for invoices, pricing, billing questions, payment proof, and credit questions.',
		};
	}

	if (hasAny(normalizedMessage, ['privacy', 'data protection', 'data export', 'compliance', 'policy', 'terms', 'gdpr', 'consent'])) {
		return {
			path: 'privacy-and-compliance',
			label: 'Privacy, terms, and compliance',
			primaryResponsibleRole: 'Data Privacy Officer',
			responsibleRoles: ['Data Privacy Officer', 'Security & Compliance Auditor', 'Super Admin'],
			note: 'Use this route for privacy policy, terms, data export, and compliance questions.',
		};
	}

	if (hasAny(normalizedMessage, ['login', 'sign in', 'cannot access', 'can\'t access', 'error', 'issue', 'bug', 'problem', 'technical', 'not working', 'failed'])) {
		return {
			path: 'technical-support',
			label: 'Technical support and escalations',
			primaryResponsibleRole: 'Global Support Escalation Lead',
			responsibleRoles: ['Global Support Escalation Lead', 'Super Admin'],
			note: 'Use this route for access issues, broken flows, technical bugs, and unresolved support cases.',
		};
	}

	return {
		path: 'general-support',
		label: 'General support',
		primaryResponsibleRole: 'Global Support Escalation Lead',
		responsibleRoles: ['Global Support Escalation Lead', 'Super Admin'],
		note: 'Default route for enquiries that do not clearly match a more specific path.',
	};
}

export function buildFaqAnswer(question: string, context: FaqAnswerContext): FaqAnswerResult {
	const normalizedQuestion = compactWhitespace(question);
	const intro = context.mode === 'verified'
		? `Hi${context.verifiedUser?.name ? ` ${context.verifiedUser.name}` : ''}, welcome to Ndovera${context.verifiedUser?.schoolName ? ` at ${context.verifiedUser.schoolName}` : ''}.`
		: 'Hi, welcome to Ndovera.';

	let body = '';
	let matched = true;
	if (hasAny(normalizedQuestion, ['what can ndovera do', 'features', 'modules', 'capabilities', 'all that ndovera can do'])) {
		body = buildFeatureAnswer();
	} else if (hasAny(normalizedQuestion, ['how it works', 'how ndovera works', 'workflow', 'how to use ndovera', 'use ndovera'])) {
		body = buildHowItWorksAnswer();
	} else if (hasAny(normalizedQuestion, ['signup', 'sign up', 'register', 'registration', 'create account', 'join ndovera'])) {
		body = buildSignupAnswer();
	} else if (hasAny(normalizedQuestion, ['special', 'different', 'unique', 'why ndovera', 'what makes it special'])) {
		body = buildSpecialAnswer();
	} else if (hasAny(normalizedQuestion, ['all roles', 'roles', 'permissions', 'who can use'])) {
		body = buildRoleDirectoryAnswer();
	} else {
		const roleLabel = findRoleFromQuestion(question, context.verifiedUser);
		if (roleLabel && (hasAny(normalizedQuestion, ['can and cannot', 'can do', 'cannot do', 'student', 'teacher', 'parent', 'hos', 'owner', 'role']) || context.mode === 'verified')) {
			body = buildRoleGuideAnswer(roleLabel);
		}
	}
	if (!body) {
		body = buildFallback(context);
		matched = false;
	}
	const outro = context.mode === 'verified'
		? `If you need help with your own account, contact ${SUPPORT_EMAIL}.`
		: `If you want a school account or I cannot verify you here, use Register School or contact ${SUPPORT_EMAIL}.`;

	return {
		answer: `${intro}\n\n${body}\n\n${outro}`,
		matched,
	};
}