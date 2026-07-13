// Collapsible "How this page works" box shown at the top of every CRM page.
// Plain <details> — works in server and client components alike.
export default function HelpBox({ title = 'ℹ️ How this page works', children }: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <details className="rounded-xl border border-sky-500/20 bg-sky-500/[0.06] mb-5 group">
      <summary className="cursor-pointer select-none px-4 py-2.5 text-sm font-semibold text-sky-300 hover:text-sky-200">
        {title} <span className="text-sky-500/60 font-normal">(click to open)</span>
      </summary>
      <div className="px-4 pb-4 pt-1 text-sm text-slate-300 leading-relaxed space-y-2 [&_b]:text-white [&_code]:text-amber-300 [&_code]:bg-black/30 [&_code]:px-1 [&_code]:rounded">
        {children}
      </div>
    </details>
  );
}
