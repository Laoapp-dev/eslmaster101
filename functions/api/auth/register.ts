import type { Env } from '../_lib/helpers';
import { json, errorJson, hashPassword, newToken, sessionCookieHeader, publicUser, isValidEmail } from '../_lib/helpers';

const SESSION_DAYS = 30;

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: any;
  try { body = await request.json(); } catch { return errorJson('Invalid request body'); }

  const username = String(body?.username || '').trim();
  const email = String(body?.email || '').trim().toLowerCase();
  const password = String(body?.password || '');
  const fullName = String(body?.fullName || '').trim();
  const country = String(body?.country || '').trim();

  if (!username) return errorJson('Username is required');
  if (!isValidEmail(email)) return errorJson('A valid email is required');
  if (password.length < 6) return errorJson('Password must be at least 6 characters');
  if (!fullName) return errorJson('Full name is required');
  if (!country) return errorJson('Please select your country');

  const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (existing) return errorJson('An account with this email already exists', 409);

  // The very first account ever created on this deployment becomes the
  // admin. Everyone after that is a regular learner.
  const countRow = await env.DB.prepare('SELECT COUNT(*) as c FROM users').first<{ c: number }>();
  const role = (countRow?.c || 0) === 0 ? 'admin' : 'user';

  const id = crypto.randomUUID();
  const { hash, salt } = await hashPassword(password);
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO users (id, username, email, password_hash, password_salt, role, full_name, country, cefr_level, daily_goal, current_streak, longest_streak, join_date, last_login, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'A2', 10, 0, 0, ?, ?, 1)`
  ).bind(id, username, email, hash, salt, role, fullName, country, now, now).run();

  await env.DB.prepare('INSERT INTO user_data (user_id, data, updated_at) VALUES (?, ?, ?)')
    .bind(id, '{}', now).run();

  const token = newToken();
  const expiresAt = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  await env.DB.prepare('INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .bind(token, id, expiresAt, Date.now()).run();

  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();

  return json({ user: publicUser(user as any) }, 200, {
    'Set-Cookie': sessionCookieHeader(token, SESSION_DAYS * 24 * 60 * 60),
  });
};
