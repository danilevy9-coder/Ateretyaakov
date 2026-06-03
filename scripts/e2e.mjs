/**
 * End-to-end browser test of the CRM against the local dev server.
 * Run: node scripts/e2e.mjs   (dev server must be on http://localhost:3001)
 */
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:3001';
const EMAIL = 'danilevy9@gmail.com';
const PASS = 'Danidev456..789';

let pass = 0, fail = 0;
const results = [];
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; results.push(`${cond ? '✓' : '✗ FAIL'} ${name}${extra ? ' — ' + extra : ''}`); };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.setDefaultTimeout(15000);
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

try {
  // ── 1. Login ──
  await page.goto(`${BASE}/crm`, { waitUntil: 'networkidle' });
  ok('redirected to login when logged out', page.url().includes('/crm/login'), page.url());
  await page.fill('input[type=email]', EMAIL);
  await page.fill('input[type=password]', PASS);
  await page.click('button[type=submit]');
  await page.waitForURL('**/crm', { timeout: 15000 });
  await page.waitForLoadState('networkidle');
  ok('logged in -> dashboard', page.url().endsWith('/crm'));

  // ── 2. Dashboard numbers ──
  const body = await page.locator('body').innerText();
  ok('dashboard shows donor count 4,224', /4,?224/.test(body), body.match(/[\d,]+/)?.[0]);
  ok('dashboard shows ₪ currency', body.includes('₪'));
  ok('dashboard shows Failed payments label', /failed payments/i.test(body));

  // ── 3. Donors grid ──
  await page.goto(`${BASE}/crm/donors`, { waitUntil: 'networkidle' });
  await page.waitForSelector('table tbody tr', { timeout: 15000 });
  const recordsText = await page.locator('p:has-text("records")').first().innerText();
  ok('donors grid shows record count', /4,?224/.test(recordsText), recordsText);
  const rowCount = await page.locator('table tbody tr').count();
  ok('grid renders a page of rows', rowCount >= 40 && rowCount <= 51, `${rowCount} rows`);

  // ── 4. Search ──
  await page.fill('input[placeholder*="Search"]', 'Kamiyansky');
  await page.waitForTimeout(1500);
  const afterSearch = await page.locator('table tbody tr').count();
  const searchBody = await page.locator('table tbody').innerText();
  ok('search filters down', afterSearch < rowCount, `${afterSearch} rows`);
  ok('search finds Kamiyansky', /Kamiyansky/i.test(searchBody));
  await page.fill('input[placeholder*="Search"]', '');
  await page.waitForTimeout(1200);

  // ── 5. Failed-payment filter ──
  await page.selectOption('select >> nth=2', 'failed_payment');
  await page.waitForTimeout(1500);
  const failText = await page.locator('p:has-text("records")').first().innerText();
  ok('failed-payment filter ~56', /5[0-9]\b/.test(failText) || /56/.test(failText), failText);

  // ── 6. Bulk select ──
  await page.click('thead input[type=checkbox]');
  await page.waitForTimeout(400);
  const bulkBar = await page.locator('text=/selected/').first().innerText().catch(() => '');
  ok('bulk select shows selection bar', /selected/.test(bulkBar), bulkBar);
  const emailBtn = await page.locator('button:has-text("Email")').filter({ hasText: 'selected' }).count();
  ok('bulk "Email selected" button present', emailBtn > 0);

  // ── 7. Donor drawer ──
  await page.click('thead input[type=checkbox]'); // deselect
  await page.click('table tbody tr td:nth-child(2) button');
  await page.waitForTimeout(800);
  const drawer = await page.locator('text=/Pledged|Contributions|Issues/').count();
  ok('donor drawer opens with details', drawer > 0);
  // Close drawer (click overlay)
  await page.keyboard.press('Escape').catch(() => {});
  await page.mouse.click(50, 400);
  await page.waitForTimeout(500);

  // ── 8. Templates ──
  await page.goto(`${BASE}/crm/templates`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const tBody = await page.locator('body').innerText();
  ok('templates page lists templates', /Pledge reminder|Thank you|We miss you/.test(tBody));
  ok('templates show Hebrew variants', tBody.includes('עברית') || /[֐-׿]/.test(tBody));

  // ── 9. Students ──
  await page.goto(`${BASE}/crm/students`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  ok('students page loads', (await page.locator('h1:has-text("Yeshiva")').count()) > 0);
  ok('add student button present', (await page.locator('button:has-text("Add student")').count()) > 0);

  // ── 10. Import ──
  await page.goto(`${BASE}/crm/import`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const iBody = await page.locator('body').innerText();
  ok('import page shows modes', iBody.includes('Donors') && iBody.includes('Yeshiva students'));
  ok('import upload zone present', iBody.includes('choose a file') || iBody.includes('drag'));

  // ── 11. Logout ──
  await page.goto(`${BASE}/crm`, { waitUntil: 'networkidle' });
  await page.click('button:has-text("Sign out")');
  await page.waitForURL('**/crm/login', { timeout: 10000 });
  ok('sign out returns to login', page.url().includes('/crm/login'));

} catch (e) {
  fail++; results.push('✗ EXCEPTION: ' + e.message);
} finally {
  console.log(results.join('\n'));
  if (errors.length) { console.log('\nJS errors on page:'); console.log([...new Set(errors)].slice(0, 10).join('\n')); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  await browser.close();
  if (fail) process.exitCode = 1;
}
