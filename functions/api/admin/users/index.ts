import type { Env, DbUser } from '../../_lib/helpers';
import { json, errorJson, getCurrentUser, publicUser } from '../../_lib/helpers';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const admin = await getCurrentUser(request, env);
  if (!admin) return errorJson('Not signed in', 401);
  if (admin.role !== 'admin') return errorJson('Admins only', 403);

  const { results } = await env.DB.prepare('SELECT * FROM users ORDER BY join_date ASC').all<DbUser>();
  return json({ users: (results || []).map(publicUser) });
};
