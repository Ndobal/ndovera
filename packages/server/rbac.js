import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME?.trim() || 'ndovera_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 8;
const normalizeRole = (role) => {
    if (!role)
        return role;
    const lower = role.toLowerCase();
    if (lower === 'hos')
        return 'HoS';
    return role;
};
const rolesPath = path.resolve(process.cwd(), 'roles', 'ndovera-roles.json');
let rolesMap = {};
try {
    const raw = fs.readFileSync(rolesPath, 'utf8');
    rolesMap = JSON.parse(raw);
}
catch (err) {
    // fallback empty map
    rolesMap = {};
}
function getAuthSecret() {
    return process.env.NDOVERA_AUTH_SECRET?.trim() || null;
}
function base64UrlEncode(value) {
    return Buffer.from(value).toString('base64url');
}
function base64UrlDecode(value) {
    return Buffer.from(value, 'base64url').toString('utf8');
}
function signSession(payload, secret) {
    return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}
function parseCookies(cookieHeader) {
    const cookies = {};
    if (!cookieHeader)
        return cookies;
    for (const part of cookieHeader.split(';')) {
        const [name, ...rest] = part.trim().split('=');
        if (!name)
            continue;
        cookies[name] = rest.join('=');
    }
    return cookies;
}
function readSessionUser(req) {
    const secret = getAuthSecret();
    if (!secret)
        return undefined;
    const cookies = parseCookies(req.header('cookie'));
    const rawSession = cookies[SESSION_COOKIE];
    if (!rawSession)
        return undefined;
    const [encodedPayload, signature] = rawSession.split('.');
    if (!encodedPayload || !signature)
        return undefined;
    const expectedSignature = signSession(encodedPayload, secret);
    if (signature.length !== expectedSignature.length)
        return undefined;
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature)))
        return undefined;
    try {
        const payload = JSON.parse(base64UrlDecode(encodedPayload));
        if (!payload.id || !Array.isArray(payload.roles) || payload.roles.length === 0)
            return undefined;
        if (typeof payload.exp === 'number' && payload.exp < Date.now())
            return undefined;
        const roles = payload.roles.map((role) => normalizeRole(role) || role);
        const activeRole = normalizeRole(payload.activeRole) || payload.activeRole || roles[0];
        return {
            id: payload.id,
            name: payload.name,
            email: payload.email,
            school_id: payload.school_id,
            roles,
            activeRole,
        };
    }
    catch {
        return undefined;
    }
}
export function createSessionCookie(user, rememberMe = false) {
    const secret = getAuthSecret();
    if (!secret) {
        throw new Error('NDOVERA_AUTH_SECRET is not configured.');
    }
    const ttl = rememberMe ? SESSION_TTL_MS * 7 : SESSION_TTL_MS;
    const payload = base64UrlEncode(JSON.stringify({
        id: user.id,
        name: user.name,
        email: user.email,
        school_id: user.school_id,
        roles: user.roles,
        activeRole: user.activeRole,
        exp: Date.now() + ttl,
    }));
    const signature = signSession(payload, secret);
    const cookieParts = [
        `${SESSION_COOKIE}=${payload}.${signature}`,
        process.env.SESSION_COOKIE_HTTPONLY === 'false' ? '' : 'HttpOnly',
        'Path=/',
        `SameSite=${(process.env.SESSION_COOKIE_SAMESITE || 'strict').trim()}`,
        `Max-Age=${Math.floor(ttl / 1000)}`,
    ];
    const secureFlag = process.env.SESSION_COOKIE_SECURE;
    if (secureFlag === 'true' || (secureFlag !== 'false' && process.env.NODE_ENV === 'production'))
        cookieParts.splice(2, 0, 'Secure');
    return cookieParts.filter(Boolean).join('; ');
}
export function clearSessionCookie() {
    const cookieParts = [`${SESSION_COOKIE}=`, process.env.SESSION_COOKIE_HTTPONLY === 'false' ? '' : 'HttpOnly', 'Path=/', `SameSite=${(process.env.SESSION_COOKIE_SAMESITE || 'strict').trim()}`, 'Max-Age=0'];
    const secureFlag = process.env.SESSION_COOKIE_SECURE;
    if (secureFlag === 'true' || (secureFlag !== 'false' && process.env.NODE_ENV === 'production'))
        cookieParts.splice(2, 0, 'Secure');
    return cookieParts.filter(Boolean).join('; ');
}
export function attachUserFromHeaders(req, res, next) {
    const user = readSessionUser(req);
    if (user) {
        ;
        req.user = user;
    }
    next();
}
export function requireRoles(...allowed) {
    return (req, res, next) => {
        const user = req.user;
        if (!user)
            return res.status(401).json({ error: 'Unauthenticated' });
        const roleToCheck = normalizeRole(user.activeRole) || normalizeRole(user.roles[0]);
        if (!roleToCheck)
            return res.status(403).json({ error: 'No active role selected' });
        if (allowed.includes(roleToCheck))
            return next();
        return res.status(403).json({ error: 'Forbidden - insufficient role' });
    };
}
export function hasPermission(user, permission) {
    if (!user)
        return false;
    const active = normalizeRole(user.activeRole) || normalizeRole(user.roles[0]);
    if (!active)
        return false;
    const perms = rolesMap[active] || [];
    if (perms.includes('*'))
        return true;
    return perms.includes(permission);
}
