// Shared helpers for every /functions/api/* route.
// A leading underscore ("_lib") excludes this folder from Cloudflare
// Pages Functions' file-based routing — it's a plain importable module,
// not an endpoint.

export interface Env {
  DB: D1Database;
}

export interface DbUser {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  password_salt: string;
  role: 'admin' | 'user';
  full_name: string | null;
  country: string | null;
  avatar: string | null;
  cefr_level: string;
  daily_goal: number;
  current_streak: number;
  longest_streak: number;
  last_study_date: string | null;
  join_date: string;
  last_login: string | null;
  is_active: number;
  pretest_done: number;
  pretest_score: number | null;
  pretest_level: string | null;
  pretest_date: string | null;
}

// Shape returned to the client — matches src/types/auth.ts AuthUser,
// never includes password_hash/password_salt.
export function publicUser(u: DbUser) {
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    role: u.role,
    avatar: u.avatar || undefined,
    joinDate: u.join_date,
    lastLogin: u.last_login || undefined,
    isActive: !!u.is_active,
    cefrLevel: u.cefr_level,
    dailyGoal: u.daily_goal,
    currentStreak: u.current_streak,
    longestStreak: u.longest_streak,
    lastStudyDate: u.last_study_date || undefined,
    dataKey: `lexicon_data_${u.id}`,
    pretestDone: !!u.pretest_done,
    pretestScore: u.pretest_score ?? undefined,
    pretestLevel: u.pretest_level || undefined,
    pretestDate: u.pretest_date || undefined,
    fullName: u.full_name || undefined,
    country: u.country || undefined,
  };
}

export function json(data: unknown, status = 200, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...(extraHeaders || {}) },
  });
}

export function errorJson(message: string, status = 400): Response {
  return json({ error: message }, status);
}

// ── Cookies ──────────────────────────────────────────────────────────────
const COOKIE_NAME = 'esl_session';

export function parseCookie(request: Request, name: string): string | null {
  const header = request.headers.get('Cookie') || '';
  const parts = header.split(';');
  for (const part of parts) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    if (key === name) return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return null;
}

export function sessionCookieHeader(token: string, maxAgeSeconds: number): string {
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

export function clearSessionCookieHeader(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function getSessionToken(request: Request): string | null {
  return parseCookie(request, COOKIE_NAME);
}

// ── Password hashing (PBKDF2-SHA256 via Web Crypto, available in Workers) ──
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes;
}

const PBKDF2_ITERATIONS = 100_000;

export async function hashPassword(password: string, saltHex?: string): Promise<{ hash: string; salt: string }> {
  const salt = saltHex ? hexToBytes(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return { hash: bytesToHex(new Uint8Array(bits)), salt: bytesToHex(salt) };
}

export async function verifyPassword(password: string, hash: string, salt: string): Promise<boolean> {
  const check = await hashPassword(password, salt);
  return timingSafeEqual(check.hash, hash);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function newToken(): string {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
}

// ── Session lookup ───────────────────────────────────────────────────────
export async function getCurrentUser(request: Request, env: Env): Promise<DbUser | null> {
  const token = getSessionToken(request);
  if (!token) return null;
  const now = Date.now();
  const session = await env.DB
    .prepare('SELECT user_id, expires_at FROM sessions WHERE token = ?')
    .bind(token)
    .first<{ user_id: string; expires_at: number }>();
  if (!session || session.expires_at < now) return null;
  const user = await env.DB
    .prepare('SELECT * FROM users WHERE id = ?')
    .bind(session.user_id)
    .first<DbUser>();
  return user || null;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
