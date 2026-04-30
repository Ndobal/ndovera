import { setCookie, getCookie, deleteCookie } from "hono/cookie";
import type { Context } from "hono";
import type { AmiWorkerEnv } from "./env";
import { resolveSessionCookieName, resolveSessionTtl } from "./env";

export type SuperSessionUser = {
  id: string;
  name: string;
  email: string;
  roles: string[];
  activeRole: string;
};

function sessionKey(token: string) {
  return `session:${token}`;
}

function randomToken() {
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
}

export async function createSession(c: Context<{ Bindings: AmiWorkerEnv }>, user: SuperSessionUser) {
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

export async function getSessionUser(c: Context<{ Bindings: AmiWorkerEnv }>) {
  const cookieName = resolveSessionCookieName(c.env);
  const token = getCookie(c, cookieName);
  if (!token) return null;
  const raw = await c.env.SESSIONS.get(sessionKey(token));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SuperSessionUser;
  } catch {
    return null;
  }
}

export async function clearSession(c: Context<{ Bindings: AmiWorkerEnv }>) {
  const cookieName = resolveSessionCookieName(c.env);
  const token = getCookie(c, cookieName);
  if (token) await c.env.SESSIONS.delete(sessionKey(token));
  deleteCookie(c, cookieName, { path: "/" });
}
