// Minimal iCalendar (RFC 5545) writer: all-day events for exhibition openings and closing reminders.

const pad = (n) => String(n).padStart(2, '0');
const stamp = (d) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
const dateValue = (iso) => iso.replace(/-/g, '');

export function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function escapeText(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

// Lines longer than 75 octets must be folded; fold on characters so UTF-8 is never split.
function fold(line) {
  const out = [];
  let cur = '';
  let bytes = 0;
  for (const ch of line) {
    const b = Buffer.byteLength(ch);
    if (bytes + b > 74) {
      out.push(cur);
      cur = ' ';
      bytes = 1;
    }
    cur += ch;
    bytes += b;
  }
  out.push(cur);
  return out.join('\r\n');
}

/** events: [{ uid, date: 'YYYY-MM-DD', title, description, url }] (all-day) */
export function buildCalendar(events, { name, prodId = '-//Artist Calendar//JA', now = new Date() }) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:${prodId}`, 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${escapeText(name)}`, 'X-WR-TIMEZONE:Asia/Tokyo', 'REFRESH-INTERVAL;VALUE=DURATION:PT12H', 'X-PUBLISHED-TTL:PT12H'];
  for (const e of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.uid}`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART;VALUE=DATE:${dateValue(e.date)}`,
      `DTEND;VALUE=DATE:${dateValue(addDays(e.date, 1))}`,
      `SUMMARY:${escapeText(e.title)}`,
      `DESCRIPTION:${escapeText(e.description ?? '')}`,
      'TRANSP:TRANSPARENT',
    );
    if (e.url) lines.push(`URL:${e.url}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

/** Two events per exhibition: the opening day, and one week before it closes. */
export function exhibitionEvents(e, { museum, siteUrl, host, today }) {
  const page = `${siteUrl}/exhibitions/${e.id}/`;
  const desc = `${e.title}\n会場: ${museum.name}\n会期: ${e.startDate} 〜 ${e.endDate}\n${page}\n公式: ${e.detailUrl ?? museum.exhibitionsUrl}`;
  const out = [{ uid: `${e.id}-open@${host}`, date: e.startDate, title: `開幕: ${e.title}（${museum.name}）`, description: desc, url: page }];
  const lastWeek = addDays(e.endDate, -7);
  if (lastWeek > e.startDate && e.endDate >= today) {
    out.push({ uid: `${e.id}-closing@${host}`, date: lastWeek, title: `終了まで1週間: ${e.title}（${museum.name}）`, description: desc, url: page });
  }
  return out;
}

/** Links that subscribe a calendar (not a one-off import), so new exhibitions appear by themselves. */
export function subscribeLinks(icsUrl) {
  const webcal = icsUrl.replace(/^https?:/, 'webcal:');
  return { google: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`, webcal, ics: icsUrl };
}
