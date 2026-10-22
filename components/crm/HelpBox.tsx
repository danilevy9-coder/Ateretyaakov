// Collapsible "How this page works" box shown at the top of every CRM page.
// Plain <details> — works in server and client components alike.
export default function HelpBox({ title = 'How this page works', children }: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <details className="rounded-xl border border-sky-200 bg-sky-50 mb-5 group">
      <summary className="cursor-pointer select-none px-4 py-2.5 text-[15px] font-semibold text-sky-900">
        {title} <span className="text-sky-700 font-normal">(tap to open)</span>
      </summary>
      <div className="px-4 pb-4 pt-1 text-[15px] text-slate-800 leading-relaxed space-y-2 [&_b]:text-slate-900 [&_code]:text-amber-900 [&_code]:bg-amber-50 [&_code]:px-1 [&_code]:rounded">
        {children}
      </div>
    </details>
  );
}
