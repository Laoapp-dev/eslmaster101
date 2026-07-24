import type { Env } from '../_lib/helpers';
import { json, errorJson, getCurrentUser, publicUser } from '../_lib/helpers';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const user = await getCurrentUser(request, env);
  if (!user) return errorJson('Not signed in', 401);
  return json({ user: publicUser(user) });
};
