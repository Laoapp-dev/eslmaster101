import type { Env } from '../_lib/helpers';
import { json, errorJson, getCurrentUser } from '../_lib/helpers';

// Everything a learner accumulates (their own words, progress, sessions,
// profile stats, settings, practice submissions, spelling streak, etc.)
// travels as one flat JSON object — see src/lib/cloudStorage.ts on the
// client, which mirrors the old localStorage key→value shape so the
// server never needs a schema change when the app adds a new local key.

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const user = await getCurrentUser(request, env);
  if (!user) return errorJson('Not signed in', 401);

  const row = await env.DB.prepare('SELECT data FROM user_data WHERE user_id = ?')
    .bind(user.id).first<{ data: string }>();

  let data: Record<string, string> = {};
  if (row?.data) {
    try { data = JSON.parse(row.data); } catch { data = {}; }
  }
  return json({ data });
};

async function saveData(request: Request, env: Env): Promise<Response> {
  const user = await getCurrentUser(request, env);
  if (!user) return errorJson('Not signed in', 401);

  let body: any;
  try { body = await request.json(); } catch { return errorJson('Invalid request body'); }
  const data = body?.data && typeof body.data === 'object' ? body.data : {};

  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO user_data (user_id, data, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
  ).bind(user.id, JSON.stringify(data), now).run();

  return json({ success: true, updatedAt: now });
}

export const onRequestPut: PagesFunction<Env> = ({ request, env }) => saveData(request, env);
// navigator.sendBeacon() can only issue POST requests, so the client uses
// POST as a fire-and-forget alias for the same save when the page is
// being unloaded (e.g. tab close) and a normal PUT might get cancelled.
export const onRequestPost: PagesFunction<Env> = ({ request, env }) => saveData(request, env);

export const onRequestDelete: PagesFunction<Env> = async ({ request, env }) => {
  const user = await getCurrentUser(request, env);
  if (!user) return errorJson('Not signed in', 401);
  await env.DB.prepare('DELETE FROM user_data WHERE user_id = ?').bind(user.id).run();
  return json({ success: true });
};
