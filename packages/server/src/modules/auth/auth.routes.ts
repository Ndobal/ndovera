import { Router } from 'express';
import { createSessionCookie, clearSessionCookie } from '../../../rbac.js';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { findUserByIdentifier, isIdentityUserActive, loadIdentityState, verifyStoredPassword } from '../../../../../identity-state.js';

export const authRouter = Router();

const loginSchema = z.object({
  identifier: z.string().trim().min(1).optional(),
  email: z.string().trim().min(3).optional(),
  password: z.string().min(1),
});

function normalizeEnv(name: string, fallback: string) {
  return (process.env[name] || process.env[fallback] || '').trim();
}

function passwordMatches(password: string, stored: string) {
  if (!stored) return false;
  if (stored.startsWith('$2')) {
    return bcrypt.compareSync(password, stored);
  }
  return password === stored;
}

authRouter.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid login payload.' });
  }

  const identifier = (parsed.data.identifier || parsed.data.email || '').trim().toLowerCase();
  const password = parsed.data.password;
  const bootstrapEmail = normalizeEnv('BOOTSTRAP_ADMIN_EMAIL', 'NDOVERA_BOOTSTRAP_ADMIN_EMAIL').toLowerCase();
  const passwordHash = normalizeEnv('BOOTSTRAP_ADMIN_PASSWORD_HASH', 'NDOVERA_BOOTSTRAP_ADMIN_PASSWORD_HASH');
  const role = (process.env.NDOVERA_BOOTSTRAP_ADMIN_ROLE || 'HOS').trim();
  const bootstrapId = normalizeEnv('BOOTSTRAP_ADMIN_ID', 'NDOVERA_BOOTSTRAP_ADMIN_ID') || 'bootstrap-admin';
  const bootstrapSchoolId = normalizeEnv('BOOTSTRAP_ADMIN_SCHOOL_ID', 'NDOVERA_BOOTSTRAP_ADMIN_SCHOOL_ID') || 'school-1';

  const state = await loadIdentityState();
  const storedUser = identifier ? findUserByIdentifier(state, identifier) : undefined;

  if (storedUser) {
    if (!isIdentityUserActive(storedUser)) {
      return res.status(403).json({ error: 'This account has been deactivated. Contact your school administrator.' });
    }
    if (!verifyStoredPassword(password, storedUser.passwordHash)) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const user = {
      id: storedUser.id,
      name: storedUser.name,
      email: storedUser.email || undefined,
      school_id: storedUser.schoolId,
      school_name: storedUser.schoolName,
      roles: storedUser.roles,
      activeRole: storedUser.activeRole,
    };

    res.setHeader('Set-Cookie', createSessionCookie(user));
    return res.json({ user });
  }

  if (!bootstrapEmail || !passwordHash) {
    return res.status(503).json({ error: 'Authentication is not configured.' });
  }

  const bootstrapIdentifiers = new Set([bootstrapEmail, bootstrapId.toLowerCase()]);
  if (!bootstrapIdentifiers.has(identifier) || !passwordMatches(password, passwordHash)) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  const user = {
    id: bootstrapId,
    name: process.env.NDOVERA_BOOTSTRAP_ADMIN_NAME || 'Ndovera Admin',
    email: bootstrapEmail,
    school_id: bootstrapSchoolId,
    role,
    roles: [role],
    activeRole: role,
  };

  res.setHeader('Set-Cookie', createSessionCookie(user));
  res.json({ user });
});

authRouter.post('/logout', (_req, res) => {
  res.setHeader('Set-Cookie', clearSessionCookie());
  res.json({ ok: true });
});