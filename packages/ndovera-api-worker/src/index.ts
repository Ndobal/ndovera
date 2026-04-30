import { Hono } from "hono";
import { cors } from "hono/cors";
import { readDocument, writeDocument } from "./lib/db";
import type { ApiWorkerEnv } from "./lib/env";
import { resolveAllowedOrigins } from "./lib/env";
import { clearSession, createSession, getSessionUser } from "./lib/session";
import { storeUpload } from "./lib/uploads";

type Bindings = ApiWorkerEnv;

type ProfileState = {
  profiles: Array<{
    schoolId: string;
    logoUrl: string | null;
    websiteUrl: string | null;
    primaryColor: string | null;
    updatedAt: string;
  }>;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use("*", async (c, next) => {
  const allowedOrigins = resolveAllowedOrigins(c.env.CORS_ORIGIN);
  return cors({
    origin: (origin) => {
      if (!origin) return "";
      return allowedOrigins.includes(origin) ? origin : "";
    },
    credentials: true,
    allowHeaders: ["Content-Type", "X-CSRF-Token", "X-Active-School-Id"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  })(c, next);
});

app.get("/health", async (c) => {
  await c.env.APP_DB.exec("SELECT 1;");
  return c.json({ ok: true, service: "ndovera-api-worker" });
});

app.post("/api/auth/login", async (c) => {
  const payload = await c.req.json().catch(() => ({}));
  const email = String(payload?.email || "").trim().toLowerCase();
  if (!email) return c.json({ error: "email is required" }, 400);

  // This is a migration scaffold login. Integrate with your identity provider next.
  const user = await createSession(c, {
    id: String(payload?.id || `user_${crypto.randomUUID()}`),
    schoolId: String(payload?.schoolId || "school-1"),
    roles: Array.isArray(payload?.roles) ? payload.roles.map((entry: unknown) => String(entry)) : ["Owner"],
    activeRole: String(payload?.activeRole || "Owner"),
    name: String(payload?.name || "Ndovera User"),
    email,
  });

  return c.json({ user });
});

app.get("/api/auth/me", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ error: "Unauthenticated" }, 401);
  return c.json({ user });
});

app.post("/api/auth/logout", async (c) => {
  await clearSession(c);
  return c.json({ ok: true });
});

app.get("/api/schools/profile", async (c) => {
  const user = await getSessionUser(c);
  if (!user?.schoolId) return c.json({ error: "Unauthenticated" }, 401);
  const state = await readDocument<ProfileState>(c.env, "school-profiles", "__global__", () => ({ profiles: [] }));
  const profile = state.profiles.find((entry) => entry.schoolId === user.schoolId) || null;
  return c.json({ profile });
});

app.post("/api/schools/profile", async (c) => {
  const user = await getSessionUser(c);
  if (!user?.schoolId) return c.json({ error: "Unauthenticated" }, 401);

  const payload = await c.req.json().catch(() => ({}));
  const state = await readDocument<ProfileState>(c.env, "school-profiles", "__global__", () => ({ profiles: [] }));
  const now = new Date().toISOString();
  const nextRecord = {
    schoolId: user.schoolId,
    logoUrl: payload?.logoUrl ? String(payload.logoUrl) : null,
    websiteUrl: payload?.websiteUrl ? String(payload.websiteUrl) : null,
    primaryColor: payload?.primaryColor ? String(payload.primaryColor) : null,
    updatedAt: now,
  };

  state.profiles = state.profiles.filter((entry) => entry.schoolId !== user.schoolId);
  state.profiles.push(nextRecord);
  await writeDocument(c.env, "school-profiles", "__global__", state);
  return c.json({ profile: nextRecord });
});

app.post("/api/uploads/:category", async (c) => {
  const user = await getSessionUser(c);
  if (!user?.schoolId) return c.json({ error: "Unauthenticated" }, 401);

  const category = String(c.req.param("category") || "general").trim();
  const form = await c.req.formData();
  const fileCandidate = form.get("file") || form.get("logo") || form.get("asset");
  if (!(fileCandidate instanceof File)) {
    return c.json({ error: "file field is required" }, 400);
  }

  const uploaded = await storeUpload(c.env, user.schoolId, category, fileCandidate);
  return c.json({ ok: true, ...uploaded }, 201);
});

app.get("/api/uploads/object/:key", async (c) => {
  const objectKey = decodeURIComponent(c.req.param("key"));
  const object = await c.env.UPLOADS.get(objectKey);
  if (!object) return c.text("Not found", 404);

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  return new Response(object.body, { headers });
});

app.notFound((c) => c.json({ error: "Not found" }, 404));

app.onError((error, c) => {
  console.error("ndovera-api-worker error", error);
  return c.json({ error: "Internal server error" }, 500);
});

export default app;
