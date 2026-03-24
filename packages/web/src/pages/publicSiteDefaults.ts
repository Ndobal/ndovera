import type { WebsitePage, WebsiteSection } from '../types';

export const CORE_PUBLIC_PAGE_ORDER = [
  'home',
  'about-us',
  'vision-values',
  'admissions',
  'academics',
  'curriculum',
  'student-life',
  'boarding-life',
  'leadership-team',
  'parents-corner',
  'growth-partners',
  'mission',
  'school-calendar',
  'announcements',
  'faq',
  'pricing',
  'vacancies',
  'events-gallery',
  'contact-us',
  'become-a-tutor',
] as const;

export const LEGAL_PUBLIC_PAGE_ORDER = ['privacy-policy', 'terms-of-service'] as const;
export const PUBLIC_NAV_PAGE_ORDER = [...CORE_PUBLIC_PAGE_ORDER, ...LEGAL_PUBLIC_PAGE_ORDER] as const;

export const CORE_PUBLIC_PAGE_SET = new Set<string>(CORE_PUBLIC_PAGE_ORDER);

export const ABOUT_US_CONTENT = `At Ndovera, we believe every student deserves a fair chance to succeed.

We know that learning is not always easy. Some students feel left behind. Some try their best but still struggle. Others simply need a little more time, support, or encouragement.

Ndovera was created for them and for everyone who believes education should work for all.

Ndovera is more than just a platform. It is a helping hand. We built Ndovera to support students, teachers, and schools in a simple and meaningful way. It helps teachers track progress, guide their students better, and stay organised. It helps students stay focused, practise more, and grow with confidence.

But beyond the technology, Ndovera is about people. It is about the student who stays up late trying to understand a topic. It is about the teacher who wants to do more but has limited tools. It is about the quiet effort, the small improvements, and the big dreams.

We understand that behind every result is a story of effort, hope, and determination. That is why Ndovera is designed to be simple, fair, and supportive. No confusion. No pressure. Just clear tools to help learning happen better.

We are building a future where:
Every student feels seen.
Every teacher feels supported.
Every school can do more with less.

Ndovera is not perfect. But it is honest. And it is built with care.

Because in the end, education is not just about scores. It is about growth, confidence, and believing in what is possible.

That is what Ndovera stands for.`;

export const VISION_CONTENT = `Vision Statement
To create a world where every student, no matter their background, has the support, confidence, and opportunity to succeed in learning and in life.

Core Values
1. Care
We believe learning should feel human. Every student and teacher matters, and we design with empathy and understanding.

2. Simplicity
We keep things clear and easy to use, so no one feels confused or overwhelmed.

3. Fairness
Every student deserves a fair chance to succeed, regardless of their starting point.

4. Growth
We value progress over perfection. Small steps forward matter.

5. Support
We stand by both students and teachers, giving them the tools and confidence to do their best.

6. Integrity
We are honest, transparent, and committed to doing what is right.

Tagline
Helping every learner grow

Motto
Learn better. Grow stronger.`;

export const MISSION_CONTENT = `Mission Statement
Our mission is to make learning simpler, fairer, and more supportive by providing tools that help students grow with confidence and help teachers guide with clarity and care.

We aim to remove barriers in education, encourage steady progress, and make every learner feel seen, supported, and capable.

Our Promise
We promise to always build with students and teachers in mind.
We promise to keep things simple, honest, and helpful.
And we promise to never forget that behind every screen is a real person trying to learn, improve, and succeed.`;

export const VISION_VALUES_CONTENT = `${VISION_CONTENT}

${MISSION_CONTENT}`;

function createSection(id: string, type: WebsiteSection['type'], content: Record<string, unknown>): WebsiteSection {
  return { id, type, content };
}

const CORE_PUBLIC_PAGE_TEMPLATES: WebsitePage[] = [
  {
    id: 'home',
    title: 'Home',
    slug: 'home',
    sections: [
      createSection('home_hero', 'hero', { title: 'Run your school from one simple, trusted place', subtitle: 'Ndovera helps schools manage lessons, fees, updates, reports, public pages, and parent communication in one clear system.' }),
      createSection('home_about', 'about', { text: 'The Ndovera home page introduces the platform, the core school value it provides, and the main actions visitors can take next.' }),
    ],
  },
  {
    id: 'about-us',
    title: 'About Us',
    slug: 'about-us',
    sections: [
      createSection('about_hero', 'hero', { title: 'Built with care for students, teachers, and schools', subtitle: 'Ndovera exists to make learning simpler, fairer, and more supportive.' }),
      createSection('about_body', 'about', { text: ABOUT_US_CONTENT }),
      createSection('about_cards', 'features', {
        title: 'Ndovera works across the full school journey',
        cards: [
          { title: 'For teaching', body: 'Share class work, track progress, and help every learner move forward.' },
          { title: 'For operations', body: 'Handle attendance, records, and updates without confusion.' },
          { title: 'For finance', body: 'Keep fees, payment records, and follow-up work neat and easy to check.' },
          { title: 'For families', body: 'Give parents and students clear updates, notices, and public school information.' },
        ],
      }),
    ],
  },
  {
    id: 'vision-values',
    title: 'Vision',
    slug: 'vision-values',
    sections: [
      createSection('vision_hero', 'hero', { title: 'The vision guiding Ndovera', subtitle: 'The long view, values, and learner-centered direction behind the work.' }),
      createSection('vision_body', 'about', { text: VISION_CONTENT }),
    ],
  },
  {
    id: 'mission',
    title: 'Mission',
    slug: 'mission',
    sections: [
      createSection('mission_hero', 'hero', { title: 'The mission behind everyday work', subtitle: 'The practical promise Ndovera makes to schools, teachers, and learners.' }),
      createSection('mission_body', 'about', { text: MISSION_CONTENT }),
    ],
  },
  {
    id: 'admissions',
    title: 'Admissions',
    slug: 'admissions',
    sections: [
      createSection('admissions_hero', 'hero', { title: 'Admissions made clear for families', subtitle: 'Show application steps, entry requirements, and what parents should expect next.' }),
      createSection('admissions_body', 'about', { text: 'Use this page to explain how new families apply, what documents are needed, when interviews happen, and how final confirmation works.' }),
      createSection('admissions_features', 'features', {
        title: 'Admission highlights',
        cards: [
          { title: 'Simple application steps', body: 'Break the process into short, easy-to-follow stages.' },
          { title: 'Required documents', body: 'List the exact records a parent must prepare before submitting.' },
          { title: 'Clear timelines', body: 'State decision windows, interview days, and resumption expectations.' },
        ],
      }),
    ],
  },
  {
    id: 'academics',
    title: 'Academics',
    slug: 'academics',
    sections: [
      createSection('academics_hero', 'hero', { title: 'Academic structure that keeps learners progressing', subtitle: 'Present the school approach to teaching, assessment, support, and measurable growth.' }),
      createSection('academics_body', 'about', { text: 'This page explains how the school organizes teaching, class support, assessments, and the expectations for steady learner progress.' }),
      createSection('academics_features', 'features', {
        title: 'Academic strengths',
        cards: [
          { title: 'Steady assessment', body: 'Track progress through classwork, tests, and guided review.' },
          { title: 'Teacher support', body: 'Show how teachers monitor learners and respond early to gaps.' },
          { title: 'Clear reporting', body: 'Explain how results and progress updates reach parents and students.' },
        ],
      }),
    ],
  },
  {
    id: 'curriculum',
    title: 'Curriculum',
    slug: 'curriculum',
    sections: [
      createSection('curriculum_hero', 'hero', { title: 'A curriculum built for real understanding', subtitle: 'Describe the learning pathway, subject balance, and practical outcomes your school prioritizes.' }),
      createSection('curriculum_body', 'about', { text: 'Use this page to explain subjects offered, curriculum pathways, enrichment opportunities, and how classroom learning translates into long-term growth.' }),
    ],
  },
  {
    id: 'student-life',
    title: 'Student Life',
    slug: 'student-life',
    sections: [
      createSection('student_life_hero', 'hero', { title: 'A school experience that supports the whole learner', subtitle: 'Show what daily life feels like beyond lessons and exams.' }),
      createSection('student_life_features', 'features', {
        title: 'Student life highlights',
        cards: [
          { title: 'Clubs and activities', body: 'Highlight music, sports, debate, coding, arts, and leadership groups.' },
          { title: 'Pastoral care', body: 'Explain how students receive guidance, care, and emotional support.' },
          { title: 'Belonging and culture', body: 'Show how the school encourages responsibility, confidence, and respect.' },
        ],
      }),
    ],
  },
  {
    id: 'boarding-life',
    title: 'Boarding Life',
    slug: 'boarding-life',
    sections: [
      createSection('boarding_hero', 'hero', { title: 'Boarding life with structure, care, and safety', subtitle: 'Give families a clear picture of routines, supervision, and student wellbeing.' }),
      createSection('boarding_body', 'about', { text: 'Explain accommodation standards, study periods, meals, supervision, weekend life, and the support systems available to boarders.' }),
    ],
  },
  {
    id: 'leadership-team',
    title: 'Leadership Team',
    slug: 'leadership-team',
    sections: [
      createSection('leadership_hero', 'hero', { title: 'Meet the leadership team guiding the school', subtitle: 'Introduce the people responsible for direction, standards, and school culture.' }),
      createSection('leadership_features', 'features', {
        title: 'Leadership page highlights',
        cards: [
          { title: 'School direction', body: 'Show who sets the vision and keeps the mission practical.' },
          { title: 'Operational leadership', body: 'Explain who supports student welfare, staff work, and daily standards.' },
          { title: 'Academic leadership', body: 'Introduce the team guiding teaching quality and learner outcomes.' },
        ],
      }),
    ],
  },
  {
    id: 'parents-corner',
    title: 'Parents Corner',
    slug: 'parents-corner',
    sections: [
      createSection('parents_hero', 'hero', { title: 'A dedicated page for parents and guardians', subtitle: 'Share communication expectations, parent resources, and how families stay informed.' }),
      createSection('parents_body', 'about', { text: 'Use this page to explain parent-school communication channels, meeting schedules, fee support information, and how guardians can stay actively involved.' }),
    ],
  },
  {
    id: 'growth-partners',
    title: 'Growth Partners',
    slug: 'growth-partners',
    sections: [
      createSection('growth_hero', 'hero', { title: 'Growth partner applications are open', subtitle: 'Approved partners help more schools discover Ndovera and support first conversations responsibly.' }),
      createSection('growth_body', 'about', { text: 'Growth partners introduce schools to Ndovera in a clear and honest way, support early onboarding conversations, and work within a limited approved scope.' }),
      createSection('growth_features', 'features', {
        title: 'Growth partner highlights',
        cards: [
          { title: 'Clear introductions', body: 'Help schools understand Ndovera without exaggeration or pressure.' },
          { title: 'Safe onboarding support', body: 'Guide first questions and connect schools to the right internal team.' },
          { title: 'Approved access only', body: 'Partner access is reviewed before any workspace tools are granted.' },
        ],
      }),
    ],
  },
  {
    id: 'school-calendar',
    title: 'School Calendar',
    slug: 'school-calendar',
    sections: [
      createSection('calendar_hero', 'hero', { title: 'Important dates in one clear place', subtitle: 'Publish term timelines, breaks, assessments, and major school events.' }),
      createSection('calendar_features', 'features', {
        title: 'Calendar page highlights',
        cards: [
          { title: 'Term milestones', body: 'Share opening days, breaks, exams, and resumption dates.' },
          { title: 'Event planning', body: 'Help families prepare early for ceremonies and school gatherings.' },
          { title: 'Clear visibility', body: 'Reduce confusion by keeping dates updated in one public location.' },
        ],
      }),
    ],
  },
  {
    id: 'announcements',
    title: 'Announcements',
    slug: 'announcements',
    sections: [
      createSection('announcements_hero', 'hero', { title: 'Public announcements and updates', subtitle: 'Use this page for important notices that visitors and families should see quickly.' }),
      createSection('announcements_body', 'news', { title: 'Latest updates', items: [] }),
    ],
  },
  {
    id: 'faq',
    title: 'FAQ',
    slug: 'faq',
    sections: [
      createSection('faq_hero', 'hero', { title: 'Frequently asked questions', subtitle: 'Answer the questions families, visitors, and partners ask most often.' }),
      createSection('faq_features', 'features', {
        title: 'FAQ page highlights',
        cards: [
          { title: 'Admissions answers', body: 'Clarify common application and document questions.' },
          { title: 'Fees and support', body: 'Summarize key billing or support expectations before parents ask.' },
          { title: 'Communication guidance', body: 'Point visitors to the right team or next step quickly.' },
        ],
      }),
    ],
  },
  {
    id: 'pricing',
    title: 'Pricing',
    slug: 'pricing',
    sections: [
      createSection('pricing_hero', 'hero', { title: 'Transparent school pricing with launch discounts', subtitle: 'Every published discount shows the original amount, the current amount, and the percentage saved.' }),
      createSection('pricing_notes', 'features', {
        title: 'Pricing page highlights',
        cards: [
          { title: 'Tier-based pricing', body: 'Schools choose the range that fits their current learner size.' },
          { title: 'Launch discounts', body: 'Published reductions can appear directly on the public pricing page.' },
          { title: 'Discount codes', body: 'Eligible schools can also apply temporary codes during payment.' },
        ],
      }),
    ],
  },
  {
    id: 'vacancies',
    title: 'Opportunities',
    slug: 'opportunities',
    sections: [
      createSection('vacancies_hero', 'hero', { title: 'Opportunities to work with Ndovera', subtitle: 'Current openings and other ways to support schools through the platform.' }),
      createSection('vacancies_notes', 'features', {
        title: 'Opportunity page highlights',
        cards: [
          { title: 'Public openings', body: 'Visitors can see active opportunities and ask follow-up questions.' },
          { title: 'Application tracking', body: 'Submitted applications can be reviewed and followed up later.' },
          { title: 'Clear expectations', body: 'Each opportunity shows its type, category, and pay summary.' },
        ],
      }),
    ],
  },
  {
    id: 'events-gallery',
    title: 'Events Gallery',
    slug: 'events-gallery',
    sections: [
      createSection('events_hero', 'hero', { title: 'Events that show school life and support in action', subtitle: 'From school launch days to family sessions, this page shows the kind of public events Ndovera supports.' }),
      createSection('events_notes', 'features', {
        title: 'Event page highlights',
        cards: [
          { title: 'Launch days', body: 'Showcase the first onboarding moments for new schools.' },
          { title: 'Family sessions', body: 'Give parents and students a clear look at how the platform works.' },
          { title: 'Training clinics', body: 'Highlight school team training and support events.' },
        ],
      }),
    ],
  },
  {
    id: 'contact-us',
    title: 'Contact Us',
    slug: 'contact-us',
    sections: [
      createSection('contact_hero', 'hero', { title: 'Get help from the right Ndovera team', subtitle: 'Send your message here and it will be routed to the most appropriate team.' }),
      createSection('contact_form', 'contact', {}),
    ],
  },
  {
    id: 'become-a-tutor',
    title: 'Become a Tutor',
    slug: 'become-a-tutor',
    sections: [
      createSection('tutor_hero', 'hero', { title: 'Start with a 7-day trial, then move to upfront access', subtitle: 'Independent tutors can register, test the workspace for one week, then keep creating classes and students after payment is activated.' }),
      createSection('tutor_notes', 'features', {
        title: 'Tutor page highlights',
        cards: [
          { title: '7-day trial', body: 'New tutors can explore the workspace before committing.' },
          { title: 'Tutor billing', body: 'Monthly access, included students, and extra-student fees are shown clearly.' },
          { title: 'Tutor dashboard', body: 'Registered tutors can manage students, classes, and subscription status.' },
        ],
      }),
    ],
  },
  {
    id: 'privacy-policy',
    title: 'Privacy Policy',
    slug: 'privacy-policy',
    sections: [
      createSection('privacy_hero', 'hero', { title: 'Privacy Policy', subtitle: 'How Ndovera handles school, student, staff, and public website data.' }),
      createSection('privacy_body', 'about', { text: 'This page explains, in simple words, how Ndovera collects, uses, stores, and protects data across the platform and public website.' }),
    ],
  },
  {
    id: 'terms-of-service',
    title: 'Terms of Service',
    slug: 'terms-of-service',
    sections: [
      createSection('terms_hero', 'hero', { title: 'Terms of Service', subtitle: 'The main rules and responsibilities for using the Ndovera platform and website.' }),
      createSection('terms_body', 'about', { text: 'This page explains account use, access rules, school responsibilities, platform limitations, and the governing terms for continued use.' }),
    ],
  },
];

function clonePage(page: WebsitePage): WebsitePage {
  return {
    ...page,
    sections: Array.isArray(page.sections)
      ? page.sections.map((section) => ({
          ...section,
          content: section.content && typeof section.content === 'object'
            ? { ...section.content }
            : section.content,
        }))
      : [],
  };
}

export function createCorePublicPages(): WebsitePage[] {
  return CORE_PUBLIC_PAGE_TEMPLATES.map(clonePage);
}

export function ensureCorePublicPages<T extends WebsitePage>(pages: T[] | null | undefined): T[] {
  const currentPages = Array.isArray(pages) ? pages : [];
  const byId = new Map(currentPages.map((page) => [page.id, page]));
  const merged: T[] = [];

  for (const template of CORE_PUBLIC_PAGE_TEMPLATES) {
    const existing = byId.get(template.id);
    if (existing) {
      const nextSections = Array.isArray(existing.sections) && existing.sections.length > 0
        ? existing.sections
        : clonePage(template).sections;
      merged.push(({
        ...clonePage(template),
        ...existing,
        title: existing.title || template.title,
        slug: existing.slug || template.slug,
        sections: nextSections,
      }) as T);
    } else {
      merged.push(clonePage(template) as T);
    }
    byId.delete(template.id);
  }

  for (const page of currentPages) {
    if (!CORE_PUBLIC_PAGE_SET.has(page.id)) {
      merged.push(page);
    }
  }

  return merged;
}

export function isCorePublicPageId(pageId: string) {
  return CORE_PUBLIC_PAGE_SET.has(pageId);
}