import type { Env } from '../_lib/helpers';
import { json, errorJson, getCurrentUser, verifyPassword, hashPassword } from '../_lib/helpers';

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const user = await getCurrentUser(request, env);
  if (!user) return errorJson('Not signed in', 401);

  let body: any;
  try { body = await request.json(); } catch { return errorJson('Invalid request body'); }
  const currentPassword = String(body?.currentPassword || '');
  const newPassword = String(body?.newPassword || '');

  if (newPassword.length < 6) return errorJson('New password must be at least 6 characters');
  const ok = await verifyPassword(currentPassword, user.password_hash, user.password_salt);
  if (!ok) return errorJson('Current password is incorrect', 401);

  const { hash, salt } = await hashPassword(newPassword);
  await env.DB.prepare('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?')
    .bind(hash, salt, user.id).run();

  return json({ success: true });
};
