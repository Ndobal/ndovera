// The public legal and compliance documents for ndovera.com.
//
// Each document has a built-in default written against what NDOVERA actually does today.
// Ami can override the title, summary, effective date and body from the Ami console
// (Website -> Legal & Policies); the override is stored in `platform_site_sections`
// under the section key below, so no extra table or endpoint is involved.
//
// The body is deliberately plain text so a non-developer can edit it safely:
//   "## "  starts a section heading
//   "### " starts a sub-heading
//   "- "   starts a bullet
//   **text** is bold
// Blank lines separate blocks. Nothing is rendered as raw HTML.

export const LEGAL_CONTACT_EMAIL = 'support@ndovera.com';

const PRIVACY_BODY = `## Who this policy covers

NDOVERA is a school management and learning platform. Schools sign up as tenants and run
on their own address under ndovera.com. Parents, students, teachers, school leaders,
accountants, operational staff and growth partners all use the same platform through
separate role-based accounts.

This policy covers the public NDOVERA website, the NDOVERA web and installable (PWA)
application, every school subdomain we host, and the NDOVERA API.

## Who is responsible for your information

**Your school is the data controller for school records.** When a school signs up, that
school decides what student, parent and staff information is entered, who inside the
school can see it, and how long it is kept. NDOVERA processes that information on the
school's instructions, as its service provider.

**NDOVERA is the data controller for its own accounts.** That means the public website,
growth partner accounts, platform billing records, and the support conversations you have
with the NDOVERA team.

If you are a parent, student or staff member and you want a school record changed or
removed, ask your school first. If your school cannot resolve it, contact us at
support@ndovera.com and we will work with them.

## Information we collect

### Account information
- Your name, email address, phone number and password (stored only as a one-way hash).
- Your role or roles, and the school you belong to.
- For students: class, arm, subjects and a school-issued student identifier.
- For parents: the students you are linked to.

### School records created inside the platform
Only where your school uses the relevant part of the platform:
- Attendance for students and staff, including sign-in times.
- Assessment scores, results, broadsheets and result comments.
- Assignments, submissions, lesson notes, lesson plans and practice activity.
- Timetables, class lists, subject allocations and promotion records.
- Admissions records and school calendar entries.
- School fee invoices, payments and receipts.
- Payroll and staff bank details, where the school runs payroll on NDOVERA.
- Library loans, store and tuck shop records, clinic, hostel and transport entries.
- Discipline records and staff review notes.
- Messages sent through the in-app messaging and newsroom features.
- Photos, videos and documents uploaded by the school.

### Growth partner information
- Your name, email address, phone number and the area you cover.
- Your National Identification Number (NIN) and a recent utility bill, used to verify
  who you are before any payout is released.
- Your bank name, bank code, account number and account name, used only to pay you.
- Your referral code, referred schools, earnings, payouts and payout acknowledgements.

### Technical information
- Sign-in and session activity, including the sliding 30-day session used to keep you
  signed in across NDOVERA addresses.
- The IP address and browser user agent attached to a password reset request, kept as an
  anti-abuse record.
- An audit trail of significant actions taken in a school, such as changing a result,
  approving a payment or updating school settings, with the account that did it.
- Push notification subscriptions, if you turn on notifications.

## What we do not do

- We do not sell your information, and we do not share it with advertisers.
- We do not use school records, student work or messages to train AI models.
- We do not use student data for marketing.
- We do not share one school's information with another school.

## How we use your information

- To operate the school platform and show each person the records their role allows.
- To authenticate you and keep your session secure.
- To send transactional email, such as password resets, receipts and account notices.
- To send push notifications you have asked for.
- To take payments for platform onboarding and term billing, and to pay growth partners.
- To verify a growth partner's identity before releasing a payout.
- To provide learning support through NDOVERA Tutor, described below.
- To keep audit records so a school can see who changed what.
- To detect abuse, prevent fraud, and protect the platform.
- To meet legal, tax and regulatory obligations.

## NDOVERA Tutor and other AI features

NDOVERA Tutor, practice question generation and similar helpers send the text of your
question, and the academic context needed to answer it, to a model provider for
processing. This runs on Cloudflare Workers AI and, for some student features, on an
NVIDIA-hosted model endpoint.

- Prompts are sent for the purpose of answering that request only.
- We do not send student names, contact details or school records unless you type them in.
- Model providers do not receive your NDOVERA account credentials.
- Your prompts are not used by NDOVERA to train any model.

Tutor answers are learning support, not verified fact. Schools remain responsible for
checking academic content before it is relied on.

## Google and YouTube

NDOVERA uses the YouTube Data API to publish platform and school video. Because that
involves a Google account, it is covered by its own page. See the **YouTube API Services
Disclosure**, and note that Google's own Privacy Policy at
https://policies.google.com/privacy also applies to any Google data involved.

## Payments

School onboarding fees, term billing and growth partner payouts are handled through
Flutterwave. Card and bank credentials are entered on Flutterwave's own checkout, not on
NDOVERA. We receive and store the transaction reference, amount, status and date so a
school or partner has a record of what was paid.

## Where your information is stored

NDOVERA runs on Cloudflare. Records are stored in Cloudflare D1, uploaded files in
Cloudflare R2, and session data in Cloudflare KV. Transactional email is sent through
Zoho Mail. These providers operate globally distributed infrastructure, so your data may
be processed outside the country your school is in.

Our service providers are:
- **Cloudflare** - hosting, database, file storage, sessions and AI inference.
- **Flutterwave** - payment collection and payouts.
- **Zoho Mail** - transactional email.
- **Google (YouTube Data API)** - video publishing, where a channel is connected.
- **NVIDIA** - model inference for some student AI features.

## Cookies and local storage

NDOVERA does not use advertising or tracking cookies. We use:
- **ndovera_token** - a signed session cookie that keeps you signed in across NDOVERA
  addresses. It slides forward for up to 30 days of continued use.
- **Local storage** - your selected role, theme preference, and a short-lived cache of
  recently loaded pages so the app still works on a weak connection. Signing out clears it.
- **Service worker cache** - so the installed app can open offline.

## Children and student data

NDOVERA is supplied to schools, not directly to children. A school enrols its students
and is responsible for having the consent it needs from parents or guardians under the
law that applies to it. Student accounts are limited to their own records and their class.
Parents see only the students they are linked to.

## How long we keep information

School records are kept for as long as the school's account is active, because a school
needs its own history. See the **Data Handling** page for the full retention and deletion
schedule, including what happens when a school closes its account.

## Your rights

Depending on where you are, including under the Nigeria Data Protection Act 2023, you may
ask to:
- see the personal information we hold about you;
- have it corrected;
- have it deleted;
- object to or restrict how it is used;
- receive a copy in a portable format;
- withdraw a consent you gave, such as push notifications.

For school records, send the request to your school first, since the school controls that
data. For anything NDOVERA controls directly, email support@ndovera.com and we will
respond within 30 days.

## Security

- Passwords are stored as one-way hashes, never in readable form.
- Sessions use signed tokens and secure, host-scoped cookies.
- Access is enforced per role and per school on every API request.
- Sensitive growth partner documents are visible only to that partner and NDOVERA staff.
- Significant actions are written to an audit trail.

No system is perfectly secure. If you believe an account has been compromised, change the
password immediately and contact support@ndovera.com.

## Changes to this policy

If we make a material change, we will update the effective date at the top of this page
and, where the change affects how school data is handled, notify school owners in the app.

## Contact

Email support@ndovera.com for any privacy question, access request or complaint.`;

const TERMS_BODY = `## Agreement

These terms govern use of the NDOVERA website, application and API. By registering a
school, signing in, or using any part of NDOVERA, you agree to them. If you are agreeing
on behalf of a school, you confirm you are authorised to bind that school.

## The service

NDOVERA is a multi-tenant school management and learning platform. A registered school
receives its own space on the platform and its own public school website, and can use the
modules its plan includes, such as people and class management, attendance, results,
assignments, timetabling, fees, payroll, admissions, messaging, library and media.

## Accounts

- A school owner account is created when a school registers, and is responsible for
  everything done inside that school.
- The school creates accounts for its staff, students and parents.
- You must keep your password confidential and are responsible for activity under your
  account. Tell us immediately if you think it has been compromised.
- NDOVERA support (the Ami role) may access a school's workspace to provide support,
  investigate a fault, or meet a legal obligation. Support sessions are recorded in the
  school's audit trail.

## School responsibilities

The school is responsible for:
- the accuracy of the records it enters;
- having the legal basis and consent it needs to hold student and staff information;
- deciding who inside the school may see which records;
- the content it publishes on its NDOVERA website, its newsroom and its media gallery;
- holding the rights to any photo, video, document or logo it uploads;
- keeping its own copies of anything it must retain by law.

## Acceptable use

You must not:
- upload material you do not have the right to use, or that infringes anyone's rights;
- upload unlawful, abusive, harassing or sexually explicit material, or anything that
  puts a child at risk;
- use NDOVERA to send bulk unsolicited messages;
- attempt to access another school's data, another user's account, or any part of the
  system you have not been granted;
- probe, scan, overload or interfere with the platform, or work around its rate limits;
- copy, resell or white-label the platform without a written agreement with NDOVERA;
- use NDOVERA Tutor to produce work a student then presents as their own where the school
  forbids it, or to generate content that is not academic in nature.

We may suspend an account that breaches this section.

## Fees and billing

- A school pays a one-time onboarding fee to activate its space.
- From the following term, billing moves to a per-term charge based on the number of
  active users in the school. The rate that applies to a school is shown in its billing
  screen before the term is charged.
- Payments are collected through Flutterwave. Prices are in Nigerian Naira unless stated
  otherwise, and are exclusive of any tax that applies to you.
- Onboarding fees are non-refundable once the school space has been activated, except
  where the law requires otherwise.
- If a term bill is unpaid, we may restrict access until it is settled. We will give
  notice before restricting a school.

## Growth partners

A growth partner introduces schools to NDOVERA under a referral code. Separate terms apply:

- Commission is 30% of the onboarding fee for a partner's first 10 schools, and 50%
  after that, plus 5% of what each referred school pays per term.
- Commission is earned only when a referred school actually registers and pays through
  the partner's link or code.
- Identity verification (NIN and a recent utility bill) and valid payout account details
  must be on file before a payout is released.
- Payouts are made to the account the partner supplies, and the partner confirms receipt
  in the app.
- **Tax is the partner's own responsibility.** NDOVERA pays commission gross. It does not
  deduct, withhold, remit or file any tax on a partner's behalf. Each growth partner is
  solely responsible for declaring their NDOVERA earnings and for paying every tax, levy
  and contribution owed to the relevant authorities in their own jurisdiction, including
  registering for tax where they are required to.
- A partner acts as an independent contractor. Nothing here creates employment, agency or
  partnership, and a partner may not make commitments on NDOVERA's behalf.
- We may withhold or reverse commission on a referral obtained through misrepresentation,
  a fraudulent or refunded payment, or self-referral.
- Either side may end the arrangement with notice. Commission already earned and verified
  remains payable.

## Content and ownership

- A school keeps ownership of everything it uploads and enters.
- The school grants NDOVERA the licence needed to host, process, back up and display that
  content in order to run the service, including publishing it on the school's own
  NDOVERA website where the school chooses to.
- NDOVERA keeps ownership of the platform, its software, design and brand. Nothing here
  transfers those rights.

## Third-party services

NDOVERA connects to Cloudflare, Flutterwave, Zoho Mail, Google/YouTube and an AI model
provider in order to work. Your use of those integrations is also subject to their terms.
Where a school connects a Google account for YouTube publishing, the YouTube Terms of
Service at https://www.youtube.com/t/terms and the Google Privacy Policy at
https://policies.google.com/privacy also apply.

## AI features

NDOVERA Tutor and related features produce generated answers. They can be wrong. They are
learning support, not a substitute for a teacher, and not professional, medical, legal or
financial advice. Schools are responsible for reviewing generated academic content before
relying on it.

## Availability

We work to keep NDOVERA available, but we do not promise uninterrupted service. We may
take the platform down for maintenance, and we will avoid school hours where we can.

## Suspension and termination

- A school may close its account at any time by contacting NDOVERA support.
- We may suspend or close an account for breach of these terms, non-payment, or where the
  law requires it.
- On closure, the retention and deletion timetable on the **Data Handling** page applies.
  Export your data before closing.

## Liability

To the extent the law allows, NDOVERA is not liable for indirect or consequential loss,
lost profit, or lost data where you did not keep your own copy. Our total liability in
any 12-month period is limited to the fees that school or partner paid NDOVERA in that
period. Nothing here excludes liability that cannot lawfully be excluded.

## Changes

We may update these terms. Material changes are announced in the app to school owners,
and the effective date at the top of this page is updated. Continuing to use NDOVERA
after that means you accept the change.

## Governing law

These terms are governed by the laws of the Federal Republic of Nigeria, and the courts
of Nigeria have jurisdiction, without affecting any mandatory right you have where you live.

## Contact

Email support@ndovera.com with any question about these terms.`;

const DATA_BODY = `## Why this page exists

Schools, parents and reviewers all ask the same practical questions: what exactly is
stored, who can reach it, how long does it stay, and how do I get it out or get it
deleted. This page answers those in one place. It sits alongside the **Privacy Policy**,
which explains the legal position.

## What is stored, and where

Records such as accounts, attendance, results, fees, payroll, messages and audit entries
are stored in **Cloudflare D1**, our platform database.

Uploaded files - school logos, media gallery images, admissions documents, staff
documents, growth partner utility bills - are stored in **Cloudflare R2**.

Sign-in sessions are stored in **Cloudflare KV** and in a signed **ndovera_token** cookie.

Platform video, and school video where a channel is connected, is published to
**YouTube**. School images and short clips that are not published to YouTube stay in R2.

Transactional email is delivered through **Zoho Mail**. Payments and payouts run through
**Flutterwave**.

## Separation between schools

Every school is a separate tenant. Every API request is checked against the signed-in
account's school and role before any record is returned. A teacher in one school cannot
reach another school's records, and a parent sees only the students they are linked to.
Platform-level roles - NDOVERA support (Ami) and growth partners - do not belong to a
school and are handled separately.

## Who can see what

- **Students** see their own records, their class, and material shared with their class.
- **Parents** see the records of the students they are linked to.
- **Teachers** see the classes and subjects they are assigned.
- **Heads of school, principals and owners** see their school.
- **Accountants** see their school's finance records.
- **Operational staff** see only the module they run, such as library, clinic or transport.
- **Growth partners** see their own referrals, earnings and payouts. They never see
  student, staff or academic records.
- **NDOVERA support (Ami)** can access a school workspace to provide support or meet a
  legal obligation. Those sessions are recorded in the school's audit trail.

## How long we keep things

- **Active school records** - kept while the school's account is active, because a school
  needs its own history for results, transcripts and finance.
- **Sessions** - a session slides forward for up to 30 days of continued use, then expires.
- **Password reset links** - valid for 30 minutes, then unusable.
- **Audit trail** - kept for the life of the school account, since it is the record of who
  changed what.
- **Payment and payout records** - kept for at least 7 years to meet accounting and tax
  obligations, even after an account closes.
- **Growth partner verification documents** - kept while the partner account is active and
  for 7 years after the final payout, as required for financial record keeping.
- **Daily knowledge digest** - the generated digest is kept for its history view only and
  contains no personal information.

## Closing a school account

1. A school owner asks NDOVERA support to close the account.
2. We confirm the request with the registered owner before anything is deleted.
3. The school is given **30 days** to export its records. We will help produce the export.
4. After that, the school's records are deleted from the live platform within **60 days**,
   except payment records we must keep for accounting and tax.
5. Backups roll off within a further **90 days**.

## Deleting an individual

- A student or staff member who leaves is archived by the school, not immediately erased,
  so results and attendance history stay intact for the school's own records.
- A parent, student or staff member may ask their school to correct or delete their
  personal details. The school decides, because the school controls that record.
- If a school will not act and you believe it should, contact support@ndovera.com and
  we will work with the school.
- A growth partner may ask us to delete their account and documents. We delete the
  identity documents and contact details, and keep only the payment records we are
  required to hold.

## Exporting your data

- Results, broadsheets, receipts, payslips and reports can be exported or printed from the
  relevant screen at any time.
- A full school export can be requested from NDOVERA support and is provided in a
  machine-readable format.

## Disconnecting an integration

- **YouTube** - a connected channel can be disconnected from the Media Manager. We delete
  the stored refresh token immediately, and NDOVERA can no longer reach the channel.
  Videos already published stay on the channel and are managed from YouTube. Access can
  also be revoked at any time from https://myaccount.google.com/permissions.
- **Push notifications** - turn them off in the app, or in your browser or device settings.
  The stored subscription is removed.
- **Payments** - a school can stop using card payments at any time; card details were never
  held by NDOVERA in the first place.

## Security practices

- Passwords are stored as one-way hashes.
- Session tokens are signed and scoped to NDOVERA hosts.
- Every API request is authorised against the account's role and school.
- Uploads are type-checked and size-limited.
- Significant actions are written to the school's audit trail with the account that did them.

## Reporting a problem

If you find a security issue, email support@ndovera.com with enough detail to
reproduce it. Please do not test against a live school's data. We will acknowledge within
3 working days.`;

const YOUTUBE_BODY = `## What this page covers

NDOVERA uses **YouTube API Services** to publish video. This page explains what we access,
why, and how to remove that access. It is required reading before you connect a channel.

By using the NDOVERA features described here, you are agreeing to the
**YouTube Terms of Service** at https://www.youtube.com/t/terms. Google's handling of your
data is governed by the **Google Privacy Policy** at https://policies.google.com/privacy.

## Why NDOVERA uses YouTube at all

School video is large. Storing it as files would consume a school's media allowance
quickly and would stream badly on the connections our schools actually have. Publishing
video to YouTube keeps playback fast and reliable, and keeps a school's file storage for
the documents and images that need it.

So NDOVERA splits media two ways:
- **Video** goes to YouTube.
- **Images and documents** go to NDOVERA file storage.

A school that does not want to use YouTube at all can simply not connect a channel. The
rest of the platform works normally.

## The NDOVERA platform channel

Video used on the public NDOVERA website - the homepage, About, Tutor, Events and Gallery
pages - is published to a YouTube channel owned by NDOVERA. An authorised NDOVERA
administrator connects that channel once, through Google's standard consent screen. No
school or member of the public is involved in that connection.

## When a school connects its own channel

Where a school chooses to connect its own YouTube channel, the school authorises NDOVERA
through Google's consent screen using its own Google account. In that case:

- The school stays the owner of the channel and of every video on it.
- NDOVERA uploads only the video that a member of that school submits through the school's
  Media Manager.
- Video is published to that school's channel and shown back in that school's own NDOVERA
  gallery.
- No other school can see or use that connection.
- The school can disconnect at any time, and can revoke access directly from Google.

Connecting a channel is optional. A school that does not connect one keeps using NDOVERA
file storage for its media.

## What NDOVERA asks permission for

We request the narrowest permissions that let the feature work:

- **https://www.googleapis.com/auth/youtube.upload** - lets NDOVERA upload a video to the
  authorised channel. This is what publishing a school video actually needs.
- **https://www.googleapis.com/auth/youtube.readonly** - lets NDOVERA read the connected
  channel's name so the interface can show which channel is connected, and confirm the
  connection is still valid.

We do not request permission for Gmail, Google Drive, Google Calendar, Google Contacts, or
any other Google service. We do not request permission to delete videos, manage comments,
change monetisation, or read a channel's audience or analytics data.

## What NDOVERA does with the access

**We do:**
- Upload video that a person in the connected organisation submitted through NDOVERA.
- Set the title and description supplied with that video.
- Store the returned video identifier so the video can be embedded in the right page.
- Read the channel name for display in the Media Manager.
- Count uploads per day so we stay inside YouTube's API quota.

**We do not:**
- Upload anything a user did not submit.
- Access, download or store the content of videos already on the channel.
- Change or delete videos we did not create through NDOVERA.
- Read, post or moderate comments.
- Collect channel analytics, subscriber lists or audience data.
- Share the connection, the tokens, or anything derived from them with any other school,
  any advertiser, or any third party.
- Use YouTube data to build a profile of anyone, or to train an AI model.

## Tokens and storage

- The authorisation token Google returns is stored encrypted at rest in NDOVERA's platform
  database, and is never sent to a browser or exposed through the API.
- Only the connection it belongs to can use it. A school's token can only reach that
  school's channel.
- The token is used solely to obtain a short-lived access token when an upload is made.
- Disconnecting deletes the stored token immediately.
- Any YouTube data we hold beyond the token is limited to the video identifier, title and
  upload timestamp of videos published through NDOVERA. Cached YouTube data is refreshed
  or discarded within 30 days.

## Uploading responsibly

Before a video is published, the person uploading it must confirm that their organisation
holds the rights to the content and that it complies with YouTube's policies, including
the **YouTube Community Guidelines**. NDOVERA records that confirmation with the upload.

Schools should not upload footage of identifiable students without the consent their own
law and their own parent agreements require.

## How to disconnect

- **In NDOVERA:** open the Media Manager and choose to disconnect the channel. The stored
  token is deleted straight away.
- **At Google:** visit https://myaccount.google.com/permissions, find NDOVERA, and remove
  its access. This works even if you no longer have an NDOVERA account.

Videos already published remain on the channel, because the channel owner owns them.
Remove them from YouTube Studio if you want them taken down.

## Questions

Email support@ndovera.com with any question about how NDOVERA uses YouTube API
Services, or to request removal of data obtained through them.`;

const CONTACT_BODY = `## Talk to NDOVERA

We would rather hear from you early than have you work around a problem. Every message
below reaches a person.

## General and support

**Email:** support@ndovera.com

Use this for anything about your school account, a fault in the platform, help getting
started, or a question about how something works. We aim to reply within one working day.

If you already have an NDOVERA account, the fastest route is the messaging area inside the
app. It reaches NDOVERA support with your school and role already attached, so nobody has
to ask you which school you are from.

## Billing

**Email:** billing@ndovera.com

Onboarding fees, term billing, receipts, and questions about what a school has been charged.

## Privacy, data and deletion

**Email:** support@ndovera.com

Access requests, correction requests, deletion requests, and anything else covered by the
**Privacy Policy** or the **Data Handling** page. Mark the subject line "Privacy request"
so it is routed correctly. We respond within 30 days.

If your request is about a school record - a result, an attendance mark, a student or staff
profile - contact your school first. The school controls that record. If your school cannot
resolve it, write to us and we will work with them.

## Security reports

**Email:** support@ndovera.com, subject line "Security".

Please include enough detail to reproduce the issue, and do not test against a live
school's data. We acknowledge security reports within 3 working days.

## Schools that want to join

Register directly at https://ndovera.com/register-school, or write to
support@ndovera.com and we will walk your leadership team through it. Pricing is
published at https://ndovera.com/pricing.

## Growth partners

Apply at https://ndovera.com/growth-partners. Existing partners should use the messaging
area inside the partner workspace, which reaches the NDOVERA team directly.

## Press and partnerships

**Email:** support@ndovera.com, subject line "Partnership".`;

export const LEGAL_DOCUMENTS = [
  {
    key: 'privacy',
    path: '/privacy',
    sectionKey: 'legal-privacy',
    label: 'Privacy Policy',
    eyebrow: 'Legal',
    title: 'Privacy Policy',
    summary:
      'What NDOVERA collects, why, who can see it, where it is stored, and the choices you have. Schools control their own records; NDOVERA processes them on the school’s instructions.',
    effective: '9 August 2026',
    body: PRIVACY_BODY,
  },
  {
    key: 'terms',
    path: '/terms',
    sectionKey: 'legal-terms',
    label: 'Terms of Service',
    eyebrow: 'Legal',
    title: 'Terms of Service',
    summary:
      'The agreement between NDOVERA and the schools, staff, families and growth partners who use it. Covers accounts, acceptable use, fees, partner commission and liability.',
    effective: '9 August 2026',
    body: TERMS_BODY,
  },
  {
    key: 'data',
    path: '/data-handling',
    sectionKey: 'legal-data',
    label: 'Data Handling',
    eyebrow: 'Transparency',
    title: 'Data Handling and Retention',
    summary:
      'The practical detail behind the Privacy Policy: exactly what is stored, where, who can reach it, how long it is kept, and how to export, delete or disconnect.',
    effective: '9 August 2026',
    body: DATA_BODY,
  },
  {
    key: 'youtube',
    path: '/youtube-disclosure',
    sectionKey: 'legal-youtube',
    label: 'YouTube API Disclosure',
    eyebrow: 'Integrations',
    title: 'YouTube API Services Disclosure',
    summary:
      'How NDOVERA uses YouTube API Services: the permissions we ask for, what we do and do not do with them, how tokens are stored, and how to disconnect.',
    effective: '9 August 2026',
    body: YOUTUBE_BODY,
  },
  {
    key: 'contact',
    path: '/contact',
    sectionKey: 'legal-contact',
    label: 'Contact',
    eyebrow: 'Get In Touch',
    title: 'Contact NDOVERA',
    summary:
      'How to reach the NDOVERA team about your school account, billing, a privacy request, a security report, or a partnership.',
    effective: '9 August 2026',
    body: CONTACT_BODY,
  },
];

export const LEGAL_DOCUMENTS_BY_KEY = Object.fromEntries(
  LEGAL_DOCUMENTS.map(document => [document.key, document]),
);

// Merge an Ami-saved `platform_site_sections` row over the built-in default. The saved row
// stores the body in `content` and the summary/effective date in `metadata`, matching the
// shape the existing website-section endpoints already accept.
export function resolveLegalDocument(docKey, savedSection) {
  const fallback = LEGAL_DOCUMENTS_BY_KEY[docKey] || LEGAL_DOCUMENTS[0];
  let metadata = {};

  if (savedSection?.metadata) {
    if (typeof savedSection.metadata === 'object') {
      metadata = savedSection.metadata;
    } else {
      try {
        metadata = JSON.parse(savedSection.metadata) || {};
      } catch {
        metadata = {};
      }
    }
  }

  return {
    ...fallback,
    title: String(savedSection?.title || '').trim() || fallback.title,
    summary: String(metadata.summary || '').trim() || fallback.summary,
    effective: String(metadata.effective || '').trim() || fallback.effective,
    body: String(savedSection?.content || '').trim() || fallback.body,
  };
}

// Turn the plain-text body into blocks the renderer and the editor preview can both use.
export function parseLegalBody(body) {
  const blocks = [];
  let bullets = null;

  const flushBullets = () => {
    if (bullets && bullets.length) blocks.push({ type: 'list', items: bullets });
    bullets = null;
  };

  String(body || '')
    .split('\n')
    .forEach(rawLine => {
      const line = rawLine.trim();

      if (!line) {
        flushBullets();
        return;
      }

      if (line.startsWith('- ')) {
        if (!bullets) bullets = [];
        bullets.push(line.slice(2).trim());
        return;
      }

      // An indented continuation line belongs to the bullet above it. Without this a
      // bullet that wraps in the source would be split off into its own paragraph.
      if (bullets && bullets.length && /^\s/.test(rawLine)) {
        bullets[bullets.length - 1] = `${bullets[bullets.length - 1]} ${line}`;
        return;
      }

      flushBullets();

      if (line.startsWith('### ')) {
        blocks.push({ type: 'subheading', text: line.slice(4).trim() });
        return;
      }

      if (line.startsWith('## ')) {
        blocks.push({ type: 'heading', text: line.slice(3).trim() });
        return;
      }

      // A wrapped paragraph continues the previous one rather than starting a new block.
      const previous = blocks[blocks.length - 1];
      if (previous?.type === 'paragraph') {
        previous.text = `${previous.text} ${line}`;
        return;
      }

      blocks.push({ type: 'paragraph', text: line });
    });

  flushBullets();
  return blocks;
}

// Split on **bold** so the renderer can emit React nodes instead of raw HTML.
export function parseInlineEmphasis(text) {
  return String(text || '')
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(part => part !== '')
    .map(part =>
      part.startsWith('**') && part.endsWith('**')
        ? { bold: true, text: part.slice(2, -2) }
        : { bold: false, text: part },
    );
}
