import { decodeHtml } from './text.mjs';
// Fetch a page's HTML as ArtPingBot: plain HTTP first, a real browser for pages drawn by scripts.
export const USER_AGENT = 'ArtPingBot/0.1 (+https://github.com/thosokawa; reads exhibition lists a few times a week)';

let browser;
async function withBrowser(url) {
  const { chromium } = await import('playwright');
  browser ??= await chromium.launch();
  const page = await browser.newPage({ userAgent: USER_AGENT });
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(4000);
    return await page.content();
  } catch (e) {
    await browser.close().catch(() => {});
    browser = undefined;
    throw e;
  } finally {
    await page.close().catch(() => {});
  }
}

/** HTML of a page. `enough(html)` says whether the plain response is usable; otherwise a browser is tried. */
export async function fetchHtml(url, { enough = (h) => h.length > 3000, browser: useBrowser = true } = {}) {
  let html = '';
  try {
    const res = await fetch(url, { headers: { 'user-agent': USER_AGENT, 'accept-language': 'ja,en;q=0.8' }, redirect: 'follow', signal: AbortSignal.timeout(30000) });
    if (res.ok) html = await decodeHtml(res);
  } catch {
    // fall through to the browser
  }
  if (enough(html) || !useBrowser) return html;
  try { return await withBrowser(url); } catch { return html; }
}

export async function closeBrowser() {
  await browser?.close().catch(() => {});
  browser = undefined;
}
