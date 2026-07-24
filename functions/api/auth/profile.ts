import type { Env } from '../_lib/helpers';
import { json, errorJson, getCurrentUser, publicUser } from '../_lib/helpers';

// Fields a signed-in learner is allowed to change about themselves.
// (role/isActive/email changes go through admin endpoints instead.)
const ALLOWED_FIELDS: Record<string, string> = {
  username: 'username',
  avatar: 'avatar',
  cefrLevel: 'cefr_level',
  dailyGoal: 'daily_goal',
  currentStreak: 'current_streak',
  longestStreak: 'longest_streak',
  lastStudyDate: 'last_study_date',
  pretestDone: 'pretest_done',
  pretestScore: 'pretest_score',
  pretestLevel: 'pretest_level',
  pretestDate: 'pretest_date',
  fullName: 'full_name',
  country: 'country',
};

export const onRequestPatch: PagesFunction<Env> = async ({ request, env }) => {
  const user = await getCurrentUser(request, env);
  if (!user) return errorJson('Not signed in', 401);

  let body: any;
  try { body = await request.json(); } catch { return errorJson('Invalid request body'); }
  const updates = body?.updates && typeof body.updates === 'object' ? body.updates : {};

  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [clientKey, column] of Object.entries(ALLOWED_FIELDS)) {
    if (clientKey in updates) {
      let v = updates[clientKey];
      if (clientKey === 'pretestDone') v = v ? 1 : 0;
      sets.push(`${column} = ?`);
      values.push(v);
    }
  }
  if (sets.length === 0) return json({ user: publicUser(user) });

  values.push(user.id);
  await env.DB.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).bind(...values).run();
  const fresh = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first();
  return json({ user: publicUser(fresh as any) });
};
