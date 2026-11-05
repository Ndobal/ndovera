# Ndovera Reach — Product specification

## Purpose
A standalone admin platform for acquiring, organising and engaging prospects via official WhatsApp Business messaging and email. Primary initial audience: Ndovera's school outreach activity, with general-purpose contact groups supported.

## Navigation
- Overview
- Contacts
- Audiences
- Campaigns
- Templates
- Automations
- Activity
- Settings

## Contact fields
- Full name
- E.164 phone number
- Email address
- Organisation/school
- Country and state
- Source and external reference
- Tags and custom notes
- WhatsApp consent status, timestamp, source and wording version
- Email consent status, timestamp, source and wording version
- Suppression status and reason
- Created/updated timestamps

Consent must be channel-specific. A phone number or email address collected publicly is not, by itself, marketing consent. Importing contacts must not silently mark them opted in.

## Campaign workflow
1. Create a draft and choose WhatsApp, email or both.
2. Select a saved audience or filters.
3. Validate audience consent and suppression state.
4. Compose using approved WhatsApp templates or email HTML/text.
5. Preview personalisation and test-send to an authorised test contact.
6. Schedule or submit for an explicit admin send action.
7. Queue in bounded batches with per-provider rate limits.
8. Record accepted, delivered, read, bounced, failed and opted-out events as available.
9. Pause, cancel or retry only eligible transient failures.

Campaign creation does not automatically send a message. Dispatch remains disabled until provider credentials, sender identity, templates and sending settings pass health checks.

## WhatsApp rules
- Use Meta WhatsApp Business Platform / Cloud API only.
- Use approved templates for business-initiated messages outside the 24-hour customer-service window.
- Store the WhatsApp message ID and provider status; process webhook events idempotently.
- Handle STOP, STOPALL, UNSUBSCRIBE and equivalent opt-out phrases.
- Do not rotate numbers or evade quality controls, messaging limits or enforcement.
- Apply per-contact frequency caps and global throughput controls.

## Email rules
- Send only to contacts with email marketing consent.
- Include a clear unsubscribe mechanism in every marketing email.
- Process provider bounce, complaint and unsubscribe webhooks.
- Maintain a global suppression list and avoid sending to suppressed addresses.
- Configure SPF, DKIM and DMARC before production volume.

## Roles
- Owner: settings, providers, team and all data.
- Admin: manage contacts, audiences and campaigns.
- Campaign operator: draft and schedule; cannot edit provider secrets.
- Analyst: read-only dashboards and activity.

## Data protection
- Collect only necessary contact data.
- Provide export and deletion workflows.
- Record admin actions in an audit log.
- Encrypt secrets at rest using Cloudflare secret bindings.
- Avoid putting message content, tokens or full contact details in application logs.
- Define retention periods before production launch.

## Explicit non-goals for the first release
- Scraping phone numbers or email addresses.
- Unsolicited bulk messaging.
- Sending from a personal WhatsApp session or unofficial WhatsApp Web automation.
- Automatic enrolment into marketing because a number was imported.
