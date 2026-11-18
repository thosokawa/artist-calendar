// "Report" on a comment: hides it right away; the weekly summary lists hidden ones for a look.
export async function onRequestPost({ request, env }) {
  if (!env.DB) return new Response(null, { status: 503 });
  const form = await request.formData().catch(() => null);
  const id = Number(form?.get('id'));
  if (!Number.isInteger(id) || id <= 0) return new Response(null, { status: 400 });
  await env.DB.prepare("UPDATE comments SET reports = reports + 1, status = CASE WHEN status = 'ok' THEN 'hidden' ELSE status END WHERE id = ?").bind(id).run();
  return new Response(null, { status: 204 });
}
