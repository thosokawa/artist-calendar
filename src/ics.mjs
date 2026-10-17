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

/** events: [{ uid, date: 'YYYY-MM-DD', endDate?: 'YYYY-MM-DD', title, description, url }] (all-day; endDate inclusive) */
export function buildCalendar(events, { name, prodId = '-//Artist Calendar//JA', now = new Date() }) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:${prodId}`, 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${escapeText(name)}`, 'X-WR-TIMEZONE:Asia/Tokyo', 'REFRESH-INTERVAL;VALUE=DURATION:PT12H', 'X-PUBLISHED-TTL:PT12H'];
  for (const e of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.uid}`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART;VALUE=DATE:${dateValue(e.date)}`,
      `DTEND;VALUE=DATE:${dateValue(addDays(e.endDate ?? e.date, 1))}`,
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

/** One all-day event covering the whole run, for "add to my calendar" links. */
export function exhibitionEvent(e, { museum, siteUrl, host }) {
  const page = `${siteUrl}/exhibitions/${e.id}/`;
  return {
    uid: `${e.id}@${host}`,
    date: e.startDate,
    endDate: e.endDate,
    title: `${e.title}（${museum.name}）`,
    description: `会期: ${e.startDate} 〜 ${e.endDate}\n会場: ${museum.name}\n${page}\n公式: ${e.detailUrl ?? museum.exhibitionsUrl}`,
    url: page,
  };
}

/** Google Calendar "add event" link for the same event. */
export function googleCalendarUrl(e, { museum, siteUrl }) {
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${e.title}（${museum.name}）`,
    dates: `${e.startDate.replace(/-/g, '')}/${addDays(e.endDate, 1).replace(/-/g, '')}`,
    details: `会期: ${e.startDate} 〜 ${e.endDate}\n${siteUrl}/exhibitions/${e.id}/`,
    location: museum.name,
  });
  return `https://calendar.google.com/calendar/render?${p}`;
}
