import type { Env } from '../../_lib/helpers';
import { json, errorJson, getCurrentUser, publicUser } from '../../_lib/helpers';

const ALLOWED_FIELDS: Record<string, string> = {
  username: 'username',
  isActive: 'is_active',
  role: 'role',
  cefrLevel: 'cefr_level',
  dailyGoal: 'daily_goal',
  fullName: 'full_name',
  country: 'country',
};

export const onRequestPatch: PagesFunction<Env> = async ({ request, env, params }) => {
  const admin = await getCurrentUser(request, env);
  if (!admin) return errorJson('Not signed in', 401);
  if (admin.role !== 'admin') return errorJson('Admins only', 403);

  const id = String(params.id);
  let body: any;
  try { body = await request.json(); } catch { return errorJson('Invalid request body'); }
  const updates = body?.updates && typeof body.updates === 'object' ? body.updates : {};

  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [clientKey, column] of Object.entries(ALLOWED_FIELDS)) {
    if (clientKey in updates) {
      let v = updates[clientKey];
      if (clientKey === 'isActive') v = v ? 1 : 0;
      sets.push(`${column} = ?`);
      values.push(v);
    }
  }
  if (sets.length === 0) return errorJson('No valid fields to update');

  values.push(id);
  await env.DB.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).bind(...values).run();
  const fresh = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
  if (!fresh) return errorJson('User not found', 404);
  return json({ user: publicUser(fresh as any) });
};

export const onRequestDelete: PagesFunction<Env> = async ({ request, env, params }) => {
  const admin = await getCurrentUser(request, env);
  if (!admin) return errorJson('Not signed in', 401);
  if (admin.role !== 'admin') return errorJson('Admins only', 403);

  const id = String(params.id);
  if (id === admin.id) return errorJson("You can't delete your own admin account");

  await env.DB.batch([
    env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id),
    env.DB.prepare('DELETE FROM user_data WHERE user_id = ?').bind(id),
    env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id),
  ]);
  return json({ success: true });
};
