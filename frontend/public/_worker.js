// Cloudflare Pages advanced-mode worker.
//
// Two jobs:
//   1. Serve the SPA shell (index.html, HTTP 200) for client-side routes so deep links work.
//   2. Rewrite the per-page SEO tags into that shell at the edge.
//
// (2) matters because the app is a single-page build: without it every route would ship the
// homepage's <title>, description, canonical and Open Graph tags. Googlebot executes JS and
// would eventually pick up the title we set at runtime, but social crawlers, AI answer
// engines and Bing largely do not — they read the HTML as served. Rewriting here means every
// public page is correctly described whether or not the crawler runs JavaScript.

const SITE_ORIGIN = 'https://ndovera.com';
const DEFAULT_IMAGE = `${SITE_ORIGIN}/android-chrome-512x512.png`;

// Keep this in step with the public routes in src/App.js.
const ROUTE_META = {
  '/': {
    title: 'NDOVERA — School Management Platform, Website Builder & Learning Network',
    description:
      'NDOVERA is an all-in-one school management platform, public website builder and learning-support network for school owners, heads of school, teachers, accountants, parents and students.',
  },
  '/about': {
    title: 'About NDOVERA — Who we are and why the platform exists',
    description:
      'NDOVERA helps schools look professional and run with confidence: clear systems for leadership, trustworthy communication for parents, and better-supported learning for students.',
  },
  '/mission': {
    title: 'Our Mission — NDOVERA',
    description:
      'NDOVERA exists to make school management simpler, clearer and more trusted: fewer blind spots for owners, calmer communication for parents, and stronger support for teaching.',
  },
  '/vision': {
    title: 'Our Vision — NDOVERA',
    description:
      'A future where every school can grow on a stronger digital foundation, with confident leadership, trusted parent communication and better-supported learning.',
  },
  '/growth-partners': {
    title: 'Growth Partners — Introduce schools to NDOVERA and earn',
    description:
      'Become an NDOVERA Growth Partner: earn 30% commission on your first 10 schools and 50% after that, plus 5% of what each referred school pays per term. Apply online.',
  },
  '/partners': {
    title: 'Growth Partners — Introduce schools to NDOVERA and earn',
    description:
      'Become an NDOVERA Growth Partner: earn commission on every school you introduce, plus a share of what each referred school pays per term.',
  },
  '/tutor': {
    title: 'NDOVERA Tutor — AI learning support students and parents can trust',
    description:
      'NDOVERA Tutor helps students with homework, explains hard topics in plain English and supports exam revision, with guidance teachers and parents can trust.',
  },
  '/pricing': {
    title: 'Pricing — NDOVERA school plans and per-term billing',
    description:
      'Pay a single onboarding fee to activate your school, then move to per-term billing based on active users. Choose a standard rollout or a custom launch.',
  },
  '/opportunities': {
    title: 'Opportunities — Build, support and grow with NDOVERA',
    description:
      'Roles, partnerships and collaboration tracks with NDOVERA and its member schools: onboarding, training and deployment, education partnerships, product and growth.',
  },
  '/events': {
    title: 'Events — NDOVERA briefings, demos and roundtables',
    description:
      'NDOVERA events bring school owners, parents, partners and supporters together around practical ideas for running and growing a school.',
  },
  '/gallery': {
    title: 'Gallery — NDOVERA in real school life',
    description:
      'Photos and video from NDOVERA: leadership and planning, parent communication, learning support in motion, and partners driving school progress.',
  },
  '/register-school': {
    title: 'Register a school on NDOVERA',
    description:
      'Onboard your school onto NDOVERA. Reserve your school domain, pay the onboarding fee and start the launch process.',
  },
  '/championships': {
    title: 'NDOVERA Championships — Compete. Excel. Be recognised.',
    description:
      'National and inter-school academic competitions on NDOVERA: mathematics, science, spelling bee, essay, debate and more. Open to school students and independent participants.',
  },
  '/privacy': {
    title: 'Privacy Policy — NDOVERA',
    description:
      'What NDOVERA collects, why, who can see it, where it is stored and the choices you have. Schools control their own records; NDOVERA processes them on the school’s instructions.',
  },
  '/terms': {
    title: 'Terms of Service — NDOVERA',
    description:
      'The agreement between NDOVERA and the schools, staff, families and growth partners who use it: accounts, acceptable use, fees, partner commission, tax responsibility and liability.',
  },
  '/data-handling': {
    title: 'Data Handling and Retention — NDOVERA',
    description:
      'Exactly what NDOVERA stores, where it lives, who can reach it, how long it is kept, and how to export your data, delete an account or disconnect an integration.',
  },
  '/youtube-disclosure': {
    title: 'YouTube API Services Disclosure — NDOVERA',
    description:
      'How NDOVERA uses YouTube API Services: the permissions requested, what we do and do not do with them, how tokens are stored, and how to disconnect a channel.',
  },
  '/contact': {
    title: 'Contact NDOVERA — support, billing, privacy and security',
    description:
      'How to reach the NDOVERA team about your school account, billing, a privacy or deletion request, a security report, or a partnership.',
  },
};

// Signed-in application surfaces and one-time links. These should never be indexed.
const NOINDEX_PREFIXES = ['/roles/', '/login', '/change-password', '/reset-password', '/settings', '/classroom', '/assignments', '/exams', '/ai-tutor', '/attendance', '/rewards', '/news'];

function normalizePath(pathname) {
  if (pathname.length > 1 && pathname.endsWith('/')) return pathname.slice(0, -1);
  return pathname;
}

// Only the marketing site gets these tags. Tenant school sites live on their own subdomain
// and must never be handed NDOVERA's own titles, descriptions or canonical URLs.
function isPlatformHost(hostname) {
  const host = String(hostname || '').toLowerCase();
  return host === 'ndovera.com' || host === 'www.ndovera.com' || host === 'localhost';
}

// Rewrites one attribute on the element it is attached to.
class AttributeSetter {
  constructor(attribute, value) {
    this.attribute = attribute;
    this.value = value;
  }
  element(element) {
    element.setAttribute(this.attribute, this.value);
  }
}

class TextSetter {
  constructor(value) {
    this.value = value;
  }
  element(element) {
    element.setInnerContent(this.value);
  }
}

function buildRewriter(meta, canonicalUrl) {
  return new HTMLRewriter()
    .on('title', new TextSetter(meta.title))
    .on('meta[name="description"]', new AttributeSetter('content', meta.description))
    .on('link[rel="canonical"]', new AttributeSetter('href', canonicalUrl))
    .on('meta[property="og:title"]', new AttributeSetter('content', meta.title))
    .on('meta[property="og:description"]', new AttributeSetter('content', meta.description))
    .on('meta[property="og:url"]', new AttributeSetter('content', canonicalUrl))
    .on('meta[property="og:image"]', new AttributeSetter('content', meta.image || DEFAULT_IMAGE))
    .on('meta[name="twitter:title"]', new AttributeSetter('content', meta.title))
    .on('meta[name="twitter:description"]', new AttributeSetter('content', meta.description))
    .on('meta[name="twitter:image"]', new AttributeSetter('content', meta.image || DEFAULT_IMAGE));
}

const noindexRewriter = () => new HTMLRewriter()
  .on('meta[name="robots"]', new AttributeSetter('content', 'noindex, nofollow'));

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const isDocumentRequest = request.method === 'GET' || request.method === 'HEAD';
    const looksLikeStaticAsset = /\.[^/]+$/.test(url.pathname);
    const isRoot = url.pathname === '/' || url.pathname === '/index.html';
    const shouldServeAppShell = isDocumentRequest && !looksLikeStaticAsset && !isRoot;

    // The homepage is served directly from assets but still needs its canonical set, so it
    // goes through the same rewrite path rather than being returned untouched.
    if (!isDocumentRequest || looksLikeStaticAsset) {
      return env.ASSETS.fetch(request);
    }

    const path = normalizePath(url.pathname === '/index.html' ? '/' : url.pathname);

    const shellUrl = new URL(url.toString());
    if (shouldServeAppShell) shellUrl.pathname = '/index.html';

    const appShellResponse = await env.ASSETS.fetch(new Request(shellUrl.toString(), {
      method: 'GET',
      headers: request.headers,
    }));

    const headers = new Headers(appShellResponse.headers);
    headers.delete('location');
    headers.delete('content-length');

    if (request.method === 'HEAD') {
      return new Response(null, { status: 200, statusText: 'OK', headers });
    }

    const body = await appShellResponse.arrayBuffer();
    const baseResponse = new Response(body, { status: 200, statusText: 'OK', headers });

    // A signed-in surface must never be indexed, whatever host it was reached on.
    if (NOINDEX_PREFIXES.some(prefix => path === prefix || path.startsWith(prefix))) {
      return noindexRewriter().transform(baseResponse);
    }

    // Everything below is marketing-site metadata, so it applies only on the platform host.
    // On a tenant subdomain the shell is served untouched and the school's own site controls
    // its titles — stamping NDOVERA's canonical there would deindex the school.
    if (!isPlatformHost(url.hostname)) return baseResponse;

    const canonicalUrl = `${SITE_ORIGIN}${path}`;
    const meta = ROUTE_META[path];
    if (meta) return buildRewriter(meta, canonicalUrl).transform(baseResponse);

    // A dynamic public page (a single championship, for example) has no entry in the static
    // map. Leaving index.html untouched would point its canonical at the homepage, which tells
    // Google the page is a duplicate and stops it being indexed at all. Correct the canonical
    // and let the app set the title at runtime.
    return new HTMLRewriter()
      .on('link[rel="canonical"]', new AttributeSetter('href', canonicalUrl))
      .on('meta[property="og:url"]', new AttributeSetter('content', canonicalUrl))
      .transform(baseResponse);
  },
};
