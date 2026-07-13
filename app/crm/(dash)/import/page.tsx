'use client';

import { useState } from 'react';
import * as XLSX from 'xlsx';
import HelpBox from '@/components/crm/HelpBox';
import { DONOR_FIELDS, STUDENT_FIELDS } from '@/lib/crm/types';

type Kind = 'donors' | 'students';
type Mode = 'donors' | 'students' | 'issues';

interface ParsedSheet {
  name: string;
  headers: string[];
  rows: Record<string, unknown>[];
}

const SEGMENTS = [
  { v: 'monthly_regular', l: 'Monthly regulars' },
  { v: 'campaign_oneoff', l: 'Campaign — one-off' },
  { v: 'campaign_monthly', l: 'Campaign — monthly' },
  { v: 'other', l: 'Other' },
];
const ISSUE_TYPES = [
  { v: 'unfulfilled_pledge', l: 'Unfulfilled pledge' },
  { v: 'lapsed', l: 'Lapsed donor' },
  { v: 'failed_payment', l: 'Failed payment' },
  { v: 'manual', l: 'Needs follow-up (manual)' },
];

export default function ImportPage() {
  const [mode, setMode] = useState<Mode>('donors');
  const [step, setStep] = useState<'upload' | 'map' | 'done'>('upload');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [sheets, setSheets] = useState<ParsedSheet[]>([]);
  const [sheetIdx, setSheetIdx] = useState(0);
  const [filename, setFilename] = useState('');

  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [aiNotes, setAiNotes] = useState('');
  const [confidence, setConfidence] = useState(0);
  const [defaultSegment, setDefaultSegment] = useState('other');
  const [defaultLanguage, setDefaultLanguage] = useState<'en' | 'he'>('en');
  const [issueType, setIssueType] = useState('unfulfilled_pledge');

  const [result, setResult] = useState<any>(null);

  const kind: Kind = mode === 'students' ? 'students' : 'donors';
  const fields = kind === 'students' ? STUDENT_FIELDS : DONOR_FIELDS;
  const sheet = sheets[sheetIdx];

  // ── 1. Parse the uploaded file ──────────────────────────────────
  const onFile = async (file: File) => {
    setError('');
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { cellDates: true });
      const parsed: ParsedSheet[] = wb.SheetNames.map((name) => {
        const ws = wb.Sheets[name];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });
        const headers = rows.length ? Object.keys(rows[0]) : [];
        return { name, headers, rows };
      }).filter((s) => s.headers.length);
      if (!parsed.length) {
        setError('No readable data found in that file.');
        return;
      }
      setSheets(parsed);
      setSheetIdx(0);
      setFilename(file.name);
      await analyze(parsed[0]);
    } catch (e) {
      setError('Could not read file: ' + String(e));
    } finally {
      setBusy(false);
    }
  };

  // ── 2. Ask the AI to map columns ────────────────────────────────
  const analyze = async (s: ParsedSheet) => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/crm/import/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, headers: s.headers, sampleRows: s.rows.slice(0, 6) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Analysis failed');
      // Keep only mappings for columns that exist in this sheet.
      const clean: Record<string, string | null> = {};
      for (const h of s.headers) clean[h] = data.mapping?.[h] ?? null;
      setMapping(clean);
      setAiNotes(data.notes || '');
      setConfidence(data.confidence || 0);
      if (data.defaultSegment) setDefaultSegment(data.defaultSegment);
      if (data.defaultLanguage) setDefaultLanguage(data.defaultLanguage);
      setStep('map');
    } catch (e) {
      // Fall back to a manual (empty) mapping so the user can still proceed.
      const clean: Record<string, string | null> = {};
      for (const h of s.headers) clean[h] = null;
      setMapping(clean);
      setAiNotes('');
      setError('AI mapping unavailable — map the columns manually. (' + String(e) + ')');
      setStep('map');
    } finally {
      setBusy(false);
    }
  };

  const switchSheet = async (idx: number) => {
    setSheetIdx(idx);
    await analyze(sheets[idx]);
  };

  // ── 3. Commit the import ────────────────────────────────────────
  const commit = async () => {
    if (!sheet) return;
    setBusy(true);
    setError('');
    try {
      const chunks: Record<string, unknown>[][] = [];
      for (let i = 0; i < sheet.rows.length; i += 1000) chunks.push(sheet.rows.slice(i, i + 1000));

      const agg = { inserted: 0, updated: 0, skipped: 0, issuesCreated: 0, rowCount: 0, errors: [] as string[] };
      for (const part of chunks) {
        const res = await fetch('/api/crm/import/commit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind,
            mapping,
            rows: part,
            defaultSegment,
            defaultLanguage,
            filename,
            sheetName: sheet.name,
            issueType: mode === 'issues' ? issueType : null,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Import failed');
        agg.inserted += data.inserted;
        agg.updated += data.updated;
        agg.skipped += data.skipped;
        agg.issuesCreated += data.issuesCreated;
        agg.rowCount += data.rowCount;
        if (data.errors?.length) agg.errors.push(...data.errors);
      }
      setResult(agg);
      setStep('done');
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setStep('upload');
    setSheets([]);
    setMapping({});
    setResult(null);
    setError('');
  };

  const mappedCount = Object.values(mapping).filter(Boolean).length;

  return (
    <div className="p-6 md:p-8 max-w-5xl">
      <h1 className="text-2xl font-bold mb-1">Import</h1>
      <p className="text-slate-400 text-sm mb-6">
        Upload an Excel or CSV file — the AI reads your columns and sorts them automatically.
      </p>

      <HelpBox>
        <p><b>Three steps:</b> ① choose what you&apos;re importing (donors / issues / students) and upload any Excel or CSV —
        exact column names don&apos;t matter · ② the AI proposes which column means what — check and correct it · ③ Import.</p>
        <p><b>No duplicates:</b> rows are matched to existing donors by email → phone → ID, and update them instead of adding twice.</p>
        <p><b>Note:</b> Nedarim Plus data (standing orders, bounces, payments) now arrives automatically every day — you no
        longer upload bounce files. Use this page for campaign lists and student enrollment.</p>
      </HelpBox>

      {/* Mode selector */}
      <div className="flex flex-wrap gap-2 mb-6">
        {([
          ['donors', '🤝 Donors'],
          ['issues', '⚠️ Monthly issues'],
          ['students', '🎓 Yeshiva students'],
        ] as [Mode, string][]).map(([m, label]) => (
          <button
            key={m}
            onClick={() => { setMode(m); reset(); }}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${
              mode === m ? 'bg-amber-500 text-black font-semibold' : 'bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === 'issues' && step === 'upload' && (
        <p className="text-xs text-amber-300/80 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 mb-4">
          Monthly issues: matches each row to an existing donor and flags them with the chosen issue type.
        </p>
      )}

      {error && (
        <div className="text-red-300 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {/* ── Step: upload ── */}
      {step === 'upload' && (
        <label className="block border-2 border-dashed border-white/15 rounded-2xl p-12 text-center cursor-pointer hover:border-amber-500/50 hover:bg-white/[0.02] transition-colors">
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
          <div className="text-4xl mb-3">📥</div>
          <p className="text-white font-semibold">{busy ? 'Reading…' : 'Click to choose a file, or drag it here'}</p>
          <p className="text-slate-500 text-sm mt-1">.xlsx, .xls or .csv</p>
        </label>
      )}

      {/* ── Step: mapping ── */}
      {step === 'map' && sheet && (
        <div className="space-y-5">
          {sheets.length > 1 && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-400">Sheet:</span>
              <select
                value={sheetIdx}
                onChange={(e) => switchSheet(Number(e.target.value))}
                className="bg-black/40 border border-white/10 rounded-lg px-3 py-1.5"
              >
                {sheets.map((s, i) => (
                  <option key={s.name} value={i}>{s.name} ({s.rows.length} rows)</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="text-slate-300">
              <strong className="text-white">{sheet.rows.length}</strong> rows ·{' '}
              <strong className="text-white">{mappedCount}</strong>/{sheet.headers.length} columns mapped
            </span>
            {confidence > 0 && (
              <span className="text-emerald-300/80">AI confidence: {Math.round(confidence * 100)}%</span>
            )}
          </div>

          {aiNotes && (
            <p className="text-xs text-slate-400 bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2">
              🧠 {aiNotes}
            </p>
          )}

          {/* Defaults */}
          <div className="flex flex-wrap gap-4">
            {mode !== 'students' && (
              <label className="text-sm">
                <span className="text-slate-400 block mb-1">Default segment</span>
                <select value={defaultSegment} onChange={(e) => setDefaultSegment(e.target.value)}
                  className="bg-black/40 border border-white/10 rounded-lg px-3 py-1.5">
                  {SEGMENTS.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
                </select>
              </label>
            )}
            {mode !== 'students' && (
              <label className="text-sm">
                <span className="text-slate-400 block mb-1">Default language</span>
                <select value={defaultLanguage} onChange={(e) => setDefaultLanguage(e.target.value as 'en' | 'he')}
                  className="bg-black/40 border border-white/10 rounded-lg px-3 py-1.5">
                  <option value="en">English</option>
                  <option value="he">Hebrew</option>
                </select>
              </label>
            )}
            {mode === 'issues' && (
              <label className="text-sm">
                <span className="text-slate-400 block mb-1">Flag everyone as</span>
                <select value={issueType} onChange={(e) => setIssueType(e.target.value)}
                  className="bg-black/40 border border-white/10 rounded-lg px-3 py-1.5">
                  {ISSUE_TYPES.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
                </select>
              </label>
            )}
          </div>

          {/* Mapping table */}
          <div className="border border-white/10 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-slate-400 text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-2.5">Your column</th>
                  <th className="text-left px-4 py-2.5">Sample</th>
                  <th className="text-left px-4 py-2.5">Maps to</th>
                </tr>
              </thead>
              <tbody>
                {sheet.headers.map((h) => {
                  const sample = sheet.rows.find((r) => r[h] != null)?.[h];
                  return (
                    <tr key={h} className="border-t border-white/5">
                      <td className="px-4 py-2 font-medium text-white">{h}</td>
                      <td className="px-4 py-2 text-slate-500 truncate max-w-[180px]">
                        {sample != null ? String(sample) : <span className="opacity-40">—</span>}
                      </td>
                      <td className="px-4 py-2">
                        <select
                          value={mapping[h] ?? ''}
                          onChange={(e) => setMapping({ ...mapping, [h]: e.target.value || null })}
                          className={`bg-black/40 border rounded-lg px-3 py-1.5 w-full max-w-xs ${
                            mapping[h] ? 'border-emerald-500/30 text-emerald-200' : 'border-white/10 text-slate-500'
                          }`}
                        >
                          <option value="">— skip this column —</option>
                          {Object.entries(fields).map(([k, label]) => (
                            <option key={k} value={k}>{label}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3">
            <button onClick={reset} className="px-4 py-2.5 rounded-lg bg-white/5 text-slate-300 hover:bg-white/10 text-sm">
              ← Start over
            </button>
            <button
              onClick={commit}
              disabled={busy || mappedCount === 0}
              className="px-6 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/40 text-black font-bold text-sm"
            >
              {busy ? 'Importing…' : `Import ${sheet.rows.length} rows →`}
            </button>
          </div>
        </div>
      )}

      {/* ── Step: done ── */}
      {step === 'done' && result && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6">
            <div className="text-4xl mb-2">✅</div>
            <h2 className="text-lg font-bold text-white mb-3">Import complete</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div><p className="text-2xl font-bold text-emerald-300">{result.inserted}</p><p className="text-slate-400">Added</p></div>
              <div><p className="text-2xl font-bold text-sky-300">{result.updated}</p><p className="text-slate-400">Updated</p></div>
              <div><p className="text-2xl font-bold text-slate-300">{result.skipped}</p><p className="text-slate-400">Skipped (empty)</p></div>
              {result.issuesCreated > 0 && (
                <div><p className="text-2xl font-bold text-amber-300">{result.issuesCreated}</p><p className="text-slate-400">Flagged</p></div>
              )}
            </div>
            {result.errors?.length > 0 && (
              <details className="mt-4 text-xs text-red-300">
                <summary className="cursor-pointer">{result.errors.length} error(s)</summary>
                <ul className="mt-2 space-y-1">{result.errors.slice(0, 20).map((e: string, i: number) => <li key={i}>• {e}</li>)}</ul>
              </details>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={reset} className="px-4 py-2.5 rounded-lg bg-white/5 text-slate-300 hover:bg-white/10 text-sm">Import another file</button>
            <a href="/crm/donors" className="px-6 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm">View donors →</a>
          </div>
        </div>
      )}
    </div>
  );
}
