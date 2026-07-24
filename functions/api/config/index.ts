import type { Env } from '../_lib/helpers';
import { json, errorJson, getCurrentUser } from '../_lib/helpers';

interface ConfigRow {
  google_key: string;
  elevenlabs_key: string;
  elevenlabs_voice: string;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const user = await getCurrentUser(request, env);
  if (!user) return errorJson('Not signed in', 401);

  const row = await env.DB.prepare('SELECT google_key, elevenlabs_key, elevenlabs_voice FROM app_config WHERE id = 1')
    .first<ConfigRow>();

  return json({
    google: row?.google_key || '',
    elevenlabs: row?.elevenlabs_key || '',
    elevenVoice: row?.elevenlabs_voice || 'JBFqnCBsd6RMkjVDRZzb',
  });
};

export const onRequestPut: PagesFunction<Env> = async ({ request, env }) => {
  const user = await getCurrentUser(request, env);
  if (!user) return errorJson('Not signed in', 401);
  if (user.role !== 'admin') return errorJson('Admins only', 403);

  let body: any;
  try { body = await request.json(); } catch { return errorJson('Invalid request body'); }
  const google = String(body?.google || '').trim();
  const elevenlabs = String(body?.elevenlabs || '').trim();
  const elevenVoice = String(body?.elevenVoice || '').trim() || 'JBFqnCBsd6RMkjVDRZzb';

  await env.DB.prepare(
    `INSERT INTO app_config (id, google_key, elevenlabs_key, elevenlabs_voice) VALUES (1, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET google_key = excluded.google_key, elevenlabs_key = excluded.elevenlabs_key, elevenlabs_voice = excluded.elevenlabs_voice`
  ).bind(google, elevenlabs, elevenVoice).run();

  return json({ success: true });
};
