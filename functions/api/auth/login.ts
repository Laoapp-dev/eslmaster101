import type { Env, DbUser } from '../_lib/helpers';
import { json, errorJson, verifyPassword, newToken, sessionCookieHeader, publicUser } from '../_lib/helpers';

const REMEMBER_DAYS = 30;
const DEFAULT_DAYS = 1;

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: any;
  try { body = await request.json(); } catch { return errorJson('Invalid request body'); }

  const email = String(body?.email || '').trim().toLowerCase();
  const password = String(body?.password || '');
  const remember = !!body?.remember;

  if (!email || !password) return errorJson('Email and password are required');

  const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<DbUser>();
  if (!user) return errorJson('No account found with this email', 401);
  if (!user.is_active) return errorJson('Account is deactivated. Contact admin.', 403);

  const ok = await verifyPassword(password, user.password_hash, user.password_salt);
  if (!ok) return errorJson('Incorrect password', 401);

  const now = new Date().toISOString();
  await env.DB.prepare('UPDATE users SET last_login = ? WHERE id = ?').bind(now, user.id).run();

  const token = newToken();
  const days = remember ? REMEMBER_DAYS : DEFAULT_DAYS;
  const expiresAt = Date.now() + days * 24 * 60 * 60 * 1000;
  await env.DB.prepare('INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .bind(token, user.id, expiresAt, Date.now()).run();

  const updated = { ...user, last_login: now };
  return json({ user: publicUser(updated) }, 200, {
    'Set-Cookie': sessionCookieHeader(token, days * 24 * 60 * 60),
  });
};
