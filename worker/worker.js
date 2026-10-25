// Принимает заявку с витрины и пересылает её в Telegram.
// Секреты задаются в Cloudflare: BOT_TOKEN, CHAT_ID. Переменная ALLOWED_ORIGIN — адрес сайта.
const LIMITS = { contact: 80, name: 60, message: 1000, business: 40, kind: 30, page: 300 };

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export default {
  async fetch(request, env) {
    const origin = env.ALLOWED_ORIGIN || '*';
    const cors = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return reply(405, { ok: false });
    if (origin !== '*' && request.headers.get('Origin') !== origin) return reply(403, { ok: false });

    let data;
    try { data = await request.json(); } catch { return reply(400, { ok: false, error: 'bad json' }); }
    if (!data || typeof data !== 'object') return reply(400, { ok: false });

    // Скрытое поле заполняют только боты: отвечаем «ок» и ничего не шлём
    if (data.website) return reply(200, { ok: true });

    const f = {};
    for (const k in LIMITS) f[k] = typeof data[k] === 'string' ? data[k].trim().slice(0, LIMITS[k]) : '';
    const digits = f.contact.replace(/\D/g, '').length;
    if (!(digits >= 10 && digits <= 12) && !/^@?[A-Za-z0-9_]{5,32}$/.test(f.contact)) return reply(400, { ok: false, error: 'contact' });

    const lines = ['<b>Новая заявка с витрины</b>', 'Контакт: ' + esc(f.contact)];
    if (f.name) lines.push('Имя: ' + esc(f.name));
    if (f.business) lines.push('Дело: ' + esc(f.business) + (f.kind ? ' (' + esc(f.kind) + ')' : ''));
    else if (f.kind) lines.push('Интересует: ' + esc(f.kind));
    if (f.message) lines.push('', esc(f.message));

    const tg = await fetch('https://api.telegram.org/bot' + env.BOT_TOKEN + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: env.CHAT_ID, text: lines.join('\n'), parse_mode: 'HTML', disable_web_page_preview: true }),
    });
    return tg.ok ? reply(200, { ok: true }) : reply(502, { ok: false });
  },
};
