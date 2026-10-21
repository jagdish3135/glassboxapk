import { useReportList } from '../lib/reports';
import { Icon } from './Icon';

const ago = (ms: number) => {
  const s = Math.max(0, (Date.now() - ms) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(ms).toLocaleDateString();
};

/** Reports your agent wrote to reports/*.json. Hidden on a static build, where there is no reports folder. */
export function ReportList() {
  const list = useReportList();
  if (!list) return null;

  return (
    <section className="reports-home" aria-labelledby="reports-title">
      <div className="reports-head">
        <div>
          <p className="eyebrow">From your reports/ folder</p>
          <h2 id="reports-title" className="section-title">Your reports</h2>
        </div>
        <p className="muted small">Ask your agent <code>Analyze apks/&lt;file&gt;.apk</code> to add one. This list updates by itself.</p>
      </div>
      {list.length === 0 ? (
        <div className="card reports-empty">
          <p>No reports yet. Drop an APK into the <code>apks/</code> folder, then ask your agent:</p>
          <pre className="problem-cmd mono">Analyze apks/your-app.apk</pre>
          <p className="muted small">Or run <code>npm run sample-report</code> to add the FoodDash sample as a report.</p>
        </div>
      ) : (
        <ul className="reports-grid">
          {list.map((r) => (
            <li key={r.name}>
              <a className={`rcard${r.ok ? '' : ' rcard-bad'}`} href={`#/report/${r.name}`}>
                <span className="rcard-mono" aria-hidden="true">{r.appName.charAt(0)}</span>
                <span className="rcard-id">
                  <span className="rcard-name">{r.appName}{r.versionName && <small> {r.versionName}</small>}</span>
                  <span className="rcard-pkg mono">{r.packageName || `${r.name}.json`}</span>
                </span>
                <span className="rcard-meta">
                  {r.ok ? <>{r.flows} flows · {r.steps} steps</> : <b>{r.errors} problem{r.errors === 1 ? '' : 's'} to fix</b>}
                  <span>{ago(r.updated)}</span>
                </span>
                <Icon name="arrow" size={16} />
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
