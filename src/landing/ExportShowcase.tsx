/** Two export targets, each with a small illustration built from CSS (no screenshots). */
export function ExportShowcase() {
  return (
    <div className="exports">
      <article className="xcard">
        <div className="xart deck" aria-hidden="true">
          <div className="slide s3">
            <span className="sl-k">Step 04 / 11</span>
            <span className="sl-t">POST /v1/auth/verify</span>
            <span className="sl-route"><i className="r1" /><b /><i className="r2" /></span>
            <span className="sl-ref">AuthApi (Retrofit)</span>
          </div>
          <div className="slide s2">
            <span className="sl-k">System map</span>
            <span className="sl-grid">{Array.from({ length: 12 }, (_, i) => <i key={i} className={i === 4 || i === 7 ? 'hot' : ''} />)}</span>
          </div>
          <div className="slide s1">
            <span className="sl-k">GlassBox report</span>
            <span className="sl-title">FoodDash</span>
            <span className="sl-sub">System design · 8 flows</span>
          </div>
        </div>
        <div className="xcopy">
          <p className="eyebrow">Export · .pptx</p>
          <h3>PowerPoint deck</h3>
          <ul className="xlist">
            <li>A title slide, the system map, then one slide per flow step</li>
            <li>Real text and shapes, so you can edit everything</li>
            <li>Ready for design reviews, onboarding and handovers</li>
          </ul>
        </div>
      </article>

      <article className="xcard">
        <div className="xart pdf" aria-hidden="true">
          <div className="page p2"><i /><i /><i className="short" /><span className="pg-chart" /><i /><i className="short" /></div>
          <div className="page p1">
            <span className="pg-k">GlassBox report</span>
            <span className="pg-title">FoodDash 4.12.0</span>
            <span className="pg-tiles"><b /><b /><b /></span>
            <i /><i /><i className="short" /><i />
          </div>
        </div>
        <div className="xcopy">
          <p className="eyebrow">Export · .pdf</p>
          <h3>PDF report</h3>
          <ul className="xlist">
            <li>The full report: stack, SDKs, permissions, entry points and every flow</li>
            <li>Each flow as a numbered step list with code references</li>
            <li>Print-ready, and easy to attach to a ticket or an email</li>
          </ul>
        </div>
      </article>
    </div>
  );
}
