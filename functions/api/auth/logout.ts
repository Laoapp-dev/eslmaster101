import type { Env } from '../_lib/helpers';
import { json, getSessionToken, clearSessionCookieHeader } from '../_lib/helpers';

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const token = getSessionToken(request);
  if (token) {
    await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
  }
  return json({ success: true }, 200, { 'Set-Cookie': clearSessionCookieHeader() });
};
