import type { LoadedReport } from '../lib/reports';

/** Shown at #/report/<name> while the report loads, or when it is missing or fails validation. */
export function ReportProblem({ name, loaded }: { name: string; loaded: LoadedReport }) {
  if (loaded.state === 'loading') {
    return <main className="report"><p className="report-wait mono">Loading reports/{name}.json…</p></main>;
  }
  return (
    <main className="report">
      <div className="card noflows-card report-problem">
        <p className="eyebrow">reports/{name}.json</p>
        {loaded.state === 'invalid' ? (
          <>
            <h2 className="flow-title">This report doesn't match the format yet.</h2>
            <p>The viewer checked it with the same rules as <code>npm run validate-report</code> and found {loaded.errors.length} problem{loaded.errors.length > 1 ? 's' : ''}. Ask your agent to fix them; this page reloads by itself when the file changes.</p>
            <ul className="problems">{loaded.errors.slice(0, 30).map((e) => <li key={e} className="mono">{e}</li>)}</ul>
            {loaded.errors.length > 30 && <p className="muted small">…and {loaded.errors.length - 30} more.</p>}
          </>
        ) : (
          <>
            <h2 className="flow-title">There's no report called "{name}" yet.</h2>
            <p>Reports are files in the <code>reports/</code> folder of your local GlassBoxAPK repo, served by <code>npm run view</code>. Put an APK in <code>apks/</code> and ask your agent:</p>
            <pre className="problem-cmd mono">Analyze apks/{name || 'your-app'}.apk</pre>
          </>
        )}
        <a className="btn btn-ink" href="#/">See all reports</a>
      </div>
    </main>
  );
}
