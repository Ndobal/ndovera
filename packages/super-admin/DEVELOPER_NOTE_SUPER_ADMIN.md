DEVELOPER NOTE — Super Admin Access Policy

Purpose:
- The `super-admin` UI is for internal administrative use only. It must NOT be exposed publicly or linked from the public website.

Guidelines for developers:
- Do not host `packages/super-admin` on public routes or subdomains without authentication and RBAC protections.
- Any deployment of `super-admin` must be protected by an authentication gateway (VPN, SSO, or an internal auth-proxy).
- Remove or avoid adding direct links to `super-admin` from the public `web` site, landing pages, or marketing pages.
- Treat the `super-admin` code as privileged; review changes thoroughly and ensure audit logging for admin actions.

Quick checklist before merging changes that affect access:
- [ ] Ensure login and RBAC guard are present on every route in `super-admin`.
- [ ] Confirm the site is not reachable anonymously on the staging or production domain.
- [ ] Add integration test(s) verifying unauthorized requests receive 401/403.

If you need `super-admin` to be accessible to a third party, consult the security team and follow the approved access review process.