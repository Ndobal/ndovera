import { setCookie, getCookie, deleteCookie } from "hono/cookie";
import type { Context } from "hono";
import type { ApiWorkerEnv } from "./env";
import { resolveSessionCookieName, resolveSessionTtl } from "./env";

export type SessionUser = {
  id: string;
  schoolId?: string;
  roles: string[];
  activeRole?: string;
  name?: string;
  email?: string;
};

function sessionKey(token: string) {
  return `session:${token}`;
}

function randomToken() {
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
}

export async function createSession(c: Context<{ Bindings: ApiWorkerEnv }>, user: SessionUser) {
  const env = c.env;
  const token = randomToken();
  const ttl = resolveSessionTtl(env);
  const cookieName = resolveSessionCookieName(env);
  await env.SESSIONS.put(sessionKey(token), JSON.stringify(user), { expirationTtl: ttl });
  setCookie(c, cookieName, token, {
    httpOnly: true,
    secure: true,
    sameSite: "None",
    path: "/",
    maxAge: ttl,
  });
  return user;
}

export async function getSessionUser(c: Context<{ Bindings: ApiWorkerEnv }>) {
  const env = c.env;
  const cookieName = resolveSessionCookieName(env);
  const token = getCookie(c, cookieName);
  if (!token) return null;
  const raw = await env.SESSIONS.get(sessionKey(token));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export async function clearSession(c: Context<{ Bindings: ApiWorkerEnv }>) {
  const env = c.env;
  const cookieName = resolveSessionCookieName(env);
  const token = getCookie(c, cookieName);
  if (token) await env.SESSIONS.delete(sessionKey(token));
  deleteCookie(c, cookieName, { path: "/" });
}
