/**
 * Detailed report on bouncing recurring donors from the source spreadsheet.
 * Run: node scripts/bounce-report.mjs
 */
import * as XLSX from 'xlsx';
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = './Ateret Yaakov Campaigns/Bouncing_Recurring_Donors (1).xlsx';
const wb = XLSX.read(readFileSync(FILE), { cellDates: true });
const s = (v) => (v == null ? '' : String(v).trim());
const n = (v) => { const x = parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, '')); return Number.isFinite(x) ? x : 0; };

const genuine = XLSX.utils.sheet_to_json(wb.Sheets['Genuine Bounces'], { range: 3, defval: null })
  .filter((r) => s(r['Name']) || s(r['Email']) || s(r['Phone']))
  .map((r) => ({
    name: s(r['Name']), email: s(r['Email']), phone: s(r['Phone']),
    monthly: n(r['Monthly Amount (ILS)']), cause: s(r['Donated To (Cause)']),
    brand: s(r['Brand']), lastCard: s(r['Last Card']),
    firstCharge: s(r['First Charge']), lastCharge: s(r['Last Charge']),
    charges: n(r['# Charges']), monthsBouncing: n(r['Months Bouncing']),
  }));

// ── Summary ──
const totalMonthly = genuine.reduce((a, r) => a + r.monthly, 0);
const annualAtRisk = totalMonthly * 12;
const bucket = (m) => (m >= 12 ? '12+ months' : m >= 6 ? '6–11 months' : m >= 3 ? '3–5 months' : '2 months');
const byBucket = {};
for (const r of genuine) byBucket[bucket(r.monthsBouncing)] = (byBucket[bucket(r.monthsBouncing)] || 0) + 1;
const oneCharge = genuine.filter((r) => r.charges <= 1).length;

console.log('═══ BOUNCING RECURRING DONORS — SUMMARY ═══\n');
console.log('Donors bouncing:        ', genuine.length);
console.log('Total monthly at risk:   ₪' + totalMonthly.toLocaleString());
console.log('Annualised at risk:      ₪' + annualAtRisk.toLocaleString());
console.log('Charged only once:      ', oneCharge, '(signed up but barely charged)');
console.log('\nHow long they have been bouncing:');
for (const k of ['12+ months', '6–11 months', '3–5 months', '2 months'])
  if (byBucket[k]) console.log('  ' + k.padEnd(12) + byBucket[k]);

// ── Ranked list (worst first: longest bouncing, then biggest monthly) ──
genuine.sort((a, b) => b.monthsBouncing - a.monthsBouncing || b.monthly - a.monthly);
console.log('\n═══ TOP 20 (longest-bouncing) ═══');
console.log('Months  ₪/mo   Charges  Last charge   Name');
for (const r of genuine.slice(0, 20))
  console.log(
    String(r.monthsBouncing).padStart(4) + '   ' +
    ('₪' + r.monthly).padEnd(7) +
    String(r.charges).padStart(4) + '     ' +
    (r.lastCharge || '—').padEnd(13) +
    ' ' + r.name
  );

// ── Full CSV ──
const cols = [
  ['Name', 'name'], ['Email', 'email'], ['Phone', 'phone'], ['Monthly (ILS)', 'monthly'],
  ['Cause', 'cause'], ['Card brand', 'brand'], ['Last card', 'lastCard'],
  ['First charge', 'firstCharge'], ['Last charge', 'lastCharge'],
  ['# Charges', 'charges'], ['Months bouncing', 'monthsBouncing'],
];
const esc = (v) => { const x = v == null ? '' : String(v); return /[",\n]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; };
const lines = [cols.map((c) => c[0]).join(',')];
for (const r of genuine) lines.push(cols.map((c) => esc(r[c[1]])).join(','));
const out = './Ateret Yaakov Campaigns/bouncing-donors-report.csv';
writeFileSync(out, '﻿' + lines.join('\n'));
console.log('\n✓ Full report CSV written: ' + out + ' (' + genuine.length + ' donors)');
