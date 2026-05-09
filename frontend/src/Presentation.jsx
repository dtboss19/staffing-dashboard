import { useEffect, useState, useCallback } from 'react'
import './Presentation.css'

// ─── SLIDE 1: TITLE ──────────────────────────────────────────────────────────
function SlideTitle() {
  return (
    <div className="slide">
      <div className="slide-title-hero">
        <p className="title-hero-eyebrow">University of St. Thomas · DASC 400</p>
        <h1 className="title-hero-h1">Police Staffing Needs<br />in St. Paul</h1>
        <p className="title-hero-sub">Predicting crime counts and type with Machine Learning</p>
        <p className="title-team">Dylan Thomas &nbsp;·&nbsp; Sambhav Lamichhane</p>
        <div className="title-stats">
          {[
            { num: '17', label: 'Neighborhoods' },
            { num: '12+', label: 'Years of Data' },
            { num: '742', label: 'Staff Pool' },
            { num: '8', label: 'ML Models' },
          ].map((s) => (
            <div className="title-stat" key={s.label}>
              <span className="title-stat-num">{s.num}</span>
              <span className="title-stat-label">{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── SLIDE 2: PROBLEM ─────────────────────────────────────────────────────────
function SlideProblem() {
  return (
    <div className="slide">
      <div className="slide-header">
        <p className="slide-eyebrow">Introduction</p>
        <h2 className="slide-title-text">The Problem We Set Out to Solve</h2>
      </div>
      <div className="two-col slide-body">
        <div className="s-card">
          <p className="s-card-label">The Problem</p>
          <ul className="s-bullets" style={{ marginTop: '0.75rem' }}>
            <li>St. Paul must allocate <strong style={{ color: '#a78bfa' }}>742 staff</strong> (572 sworn + 170 civilian) across 17 neighborhoods</li>
            <li>Staffing decisions today are <strong>reactive</strong> — not tied to forecasted crime demand</li>
            <li>No reproducible, data-driven framework exists to guide monthly officer distribution</li>
            <li>Crime pressure varies significantly by neighborhood, season, and crime type</li>
          </ul>
        </div>
        <div className="s-card">
          <p className="s-card-label">Our Solution</p>
          <ul className="s-bullets" style={{ marginTop: '0.75rem' }}>
            <li>ML pipeline predicting <strong style={{ color: '#a78bfa' }}>monthly crime counts</strong> by neighborhood and category</li>
            <li>Bootstrap Forest models trained on <strong>11 years</strong> of historical data</li>
            <li>Staffing score weighted by crime severity and model reliability (R²)</li>
            <li>Reproducible proportional allocation of all 742 staff across all 17 neighborhoods</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

// ─── SLIDE 3: RESEARCH QUESTIONS ──────────────────────────────────────────────
function SlideQuestions() {
  const qs = [
    'Which neighborhoods and months show the highest staffing pressure?',
    'How close are model predictions to observed crime counts by category?',
    'How should finite staff be distributed using a reproducible score?',
    'Which year-weighting policy best calibrates 2026 predictions?',
  ]
  return (
    <div className="slide">
      <div className="slide-header">
        <p className="slide-eyebrow">Introduction · 1a</p>
        <h2 className="slide-title-text">Four Research Questions</h2>
      </div>
      <div className="q-grid slide-body">
        {qs.map((q, i) => (
          <div className="q-card" key={i}>
            <span className="q-num">0{i + 1}</span>
            <p className="q-text">{q}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── SLIDE 4: DATA & SOURCES ──────────────────────────────────────────────────
function SlideData() {
  const categories = ['Violent Persons', 'Weapons', 'Property Theft', 'Property Damage', 'Narcotics', 'Proactive Visits', 'Other', 'Total']
  const pois = ['Bars', 'Liquor stores', 'Gas stations', 'Churches', 'Schools', 'Parks', 'Grocery stores', 'Pharmacies', 'Bus stops*']
  return (
    <div className="slide">
      <div className="slide-header">
        <p className="slide-eyebrow">Introduction · 1b</p>
        <h2 className="slide-title-text">Data: Crime Records + Points of Interest</h2>
      </div>
      <div className="two-col slide-body">
        <div className="s-card">
          <p className="s-card-label">Crime Data · City of St. Paul</p>
          <div className="timeline-bar"><div className="timeline-fill" /></div>
          <div className="timeline-labels"><span>2014</span><span>2018</span><span>2022</span><span>Apr 2026</span></div>
          <p style={{ fontSize: '0.82rem', color: '#94a3b8', marginBottom: '0.75rem' }}>17 neighborhoods · monthly aggregated counts</p>
          <div>
            {categories.map((c) => <span className="data-tag" key={c}>• {c}</span>)}
          </div>
        </div>
        <div className="s-card">
          <p className="s-card-label">Points of Interest (POI)</p>
          <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: '0 0 0.75rem' }}>Spatially engineered from open geospatial sources</p>
          <div style={{ marginBottom: '0.75rem' }}>
            {pois.map((p) => <span className="data-tag" key={p}>• {p}</span>)}
          </div>
          <p style={{ fontSize: '0.76rem', color: '#6d28d9', fontStyle: 'italic' }}>*Bus stops significant only for narcotics, property damage &amp; weapons models</p>
        </div>
      </div>
    </div>
  )
}

// ─── SLIDE 5: DATA CLEANSING ──────────────────────────────────────────────────
function SlideCleansing() {
  const items = [
    {
      label: 'COVID Year Handling',
      text: '2020–2021 crime patterns severely distorted. Down-weighted to 0.4× in forecast aggregation to reduce anomaly influence on 2026 predictions.',
      accent: '#7c3aed',
    },
    {
      label: 'Train / Validation Split',
      text: 'Strict out-of-time split: 2014–2024 for training, 2025–Feb 2026 held out entirely for validation. No data leakage.',
      accent: '#06b6d4',
    },
    {
      label: 'Neighborhood Standardization',
      text: 'Neighborhood naming inconsistencies across source files resolved into 17 canonical IDs used consistently across all data products.',
      accent: '#10b981',
    },
    {
      label: 'Multicollinearity Check',
      text: 'Regression run per target to screen POIs. All predictors passed VIF < 5 — no multicollinearity issues identified in any model.',
      accent: '#f59e0b',
    },
  ]
  return (
    <div className="slide">
      <div className="slide-header">
        <p className="slide-eyebrow">Introduction · 1c</p>
        <h2 className="slide-title-text">Data Cleansing &amp; Preparation</h2>
      </div>
      <div className="four-grid slide-body">
        {items.map((item) => (
          <div className="s-card" key={item.label} style={{ borderLeft: `3px solid ${item.accent}` }}>
            <p className="s-card-label" style={{ color: item.accent }}>{item.label}</p>
            <p style={{ fontSize: '0.87rem', color: '#cbd5e1', lineHeight: 1.5, margin: 0 }}>{item.text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── SLIDE 6: 4-STAGE PIPELINE ────────────────────────────────────────────────
function SlidePipeline() {
  const steps = [
    {
      num: 'Stage 1',
      name: 'Variable Selection',
      desc: 'Regression models per target identify statistically significant POIs. Bus stops: significant only for 3 of 8 models.',
    },
    {
      num: 'Stage 2',
      name: 'Bootstrap Forest',
      desc: '8 separate models trained — one per crime category. 300 trees, min split 30, boost rate 1.0, seed 123.',
    },
    {
      num: 'Stage 3',
      name: 'Weighted Median Forecast',
      desc: 'Frozen 2026 forecasts built via weighted-median aggregation across historical rows, calibrated by year-weight policy.',
    },
    {
      num: 'Stage 4',
      name: 'Staffing Score',
      desc: 'Composite score synthesizes category pressure, severity weights, and model reliability (R²) into a 0–100 metric.',
    },
  ]
  return (
    <div className="slide">
      <div className="slide-header">
        <p className="slide-eyebrow">Models · 2a · 2b</p>
        <h2 className="slide-title-text">Four-Stage Modeling Pipeline</h2>
      </div>
      <div className="flow slide-body">
        {steps.map((s) => (
          <div className="flow-step" key={s.num}>
            <p className="flow-num">{s.num}</p>
            <p className="flow-name">{s.name}</p>
            <p className="flow-desc">{s.desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── SLIDE 7: MODEL SPECIFICATIONS ───────────────────────────────────────────
function SlideModelSpecs() {
  const targets = [
    'Total Crime Count', 'Violent Persons', 'Weapons',
    'Property Theft', 'Property Damage', 'Narcotics',
    'Proactive Visits', 'Other',
  ]
  const specs = [
    { key: 'Number of trees', val: '300' },
    { key: 'Min split size', val: '30' },
    { key: 'Max splits', val: '300' },
    { key: 'Min splits / tree', val: '10' },
    { key: 'Boost rate', val: '1.0' },
    { key: 'Random seed', val: '123' },
    { key: 'Software', val: 'JMP Pro' },
  ]
  return (
    <div className="slide">
      <div className="slide-header">
        <p className="slide-eyebrow">Models · 2a · 2c</p>
        <h2 className="slide-title-text">Model Specifications · 8 Targets</h2>
      </div>
      <div className="specs-grid slide-body">
        <div className="s-card">
          <p className="s-card-label">Bootstrap Forest — Identical Specs Across All 8 Models</p>
          <table className="spec-table" style={{ marginTop: '0.75rem' }}>
            <tbody>
              {specs.map((s) => (
                <tr key={s.key}>
                  <td>{s.key}</td>
                  <td>{s.val}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.75rem', fontStyle: 'italic' }}>
            Same explanatory variables: month, year, neighborhood census tract count, POIs
          </p>
        </div>
        <div className="s-card">
          <p className="s-card-label">8 Separate Target Models</p>
          <div className="targets-grid" style={{ marginTop: '0.75rem' }}>
            {targets.map((t) => (
              <div className="target-pill" key={t}>{t}</div>
            ))}
          </div>
          <p style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.75rem' }}>
            Each model generates monthly predictions per neighborhood — frozen and stored in SQLite for dashboard consumption.
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── SLIDE 8: SOFTWARE STACK ──────────────────────────────────────────────────
function SlideSoftware() {
  const stack = [
    { name: 'JMP Pro', role: 'Statistical Modeling', desc: 'Bootstrap Forest models (8 targets) · Regression for variable selection · R² reliability weights' },
    { name: 'Python', role: 'Data Pipeline + API', desc: 'Data build scripts · Forecast aggregation · FastAPI backend · SQLite query layer' },
    { name: 'SQLite', role: 'Analytics Database', desc: 'staffing_analytics.db · Stores actuals, predictions, forecast, and staffing scores · Queried live by API' },
    { name: 'React + Vite', role: 'Interactive Dashboard', desc: 'Custom SVG charts · Neighborhood hotspot map timelapse · Forecast trend views · Category breakdown' },
    { name: 'Vercel', role: 'Deployment', desc: 'Static frontend hosting · dataminingfinal.vercel.app · Production-deployed, publicly accessible' },
  ]
  return (
    <div className="slide">
      <div className="slide-header">
        <p className="slide-eyebrow">Software &amp; Analysis · 3a</p>
        <h2 className="slide-title-text">Software Stack &amp; Tool Choices</h2>
      </div>
      <div className="stack-flow slide-body" style={{ maxWidth: 900 }}>
        {stack.map((s, i) => (
          <div className="stack-row" key={s.name}>
            <div className="stack-tool">
              <div className="stack-tool-name">{s.name}</div>
              <div className="stack-tool-role">{s.role}</div>
            </div>
            {i < stack.length - 1 && <span className="stack-arrow">↓</span>}
            <p className="stack-desc">{s.desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── SLIDE 9: POLICY RESULTS ──────────────────────────────────────────────────
function SlidePolicyResults() {
  const policies = [
    { name: 'No Weights', mar: '0.41', apr: '0.38' },
    { name: 'Current Baseline', mar: '0.3452', apr: '0.33', note: 'Current' },
    { name: 'Lower 2019', mar: '0.39', apr: '0.36' },
    { name: 'Stronger Recency', mar: '0.38', apr: '0.35' },
    { name: 'Conservative', mar: '0.33', apr: '0.36', winner: true },
    { name: 'Manual', mar: '0.37', apr: '0.34' },
  ]
  return (
    <div className="slide">
      <div className="slide-header">
        <p className="slide-eyebrow">Software &amp; Analysis · 3b</p>
        <h2 className="slide-title-text">Results: Year-Weight Policy Comparison</h2>
      </div>
      <div style={{ width: '100%', maxWidth: 1000 }}>
        <div className="winner-banner">
          <span className="winner-badge">✓</span>
          <div className="winner-text">
            <strong>Winner: Conservative Policy</strong>
            <p>Only policy to improve both March AND April 2026 vs current baseline · Combined APE 0.3434 vs 0.3452 · 34 neighborhood-month rows evaluated</p>
          </div>
        </div>
        <div className="policy-grid">
          {policies.map((p) => (
            <div className={`policy-card ${p.winner ? 'winner' : ''}`} key={p.name}>
              <p className="policy-card-name">{p.winner ? '★ ' : ''}{p.name}</p>
              <div className="policy-ape-row">
                <span style={{ color: '#64748b' }}>Mar APE</span>
                <span className="policy-ape-val">{p.mar}</span>
              </div>
              <div className="policy-ape-row">
                <span style={{ color: '#64748b' }}>Apr APE</span>
                <span className="policy-ape-val">{p.apr}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── SLIDE 10: STAFFING SCORE ─────────────────────────────────────────────────
function SlideScore() {
  const weights = [
    { cat: 'Violent Persons', pct: 38.6 },
    { cat: 'Property Theft', pct: 29.7 },
    { cat: 'Weapons', pct: 13.0 },
    { cat: 'Property Damage', pct: 8.8 },
    { cat: 'Narcotics', pct: 6.9 },
    { cat: 'Proactive Visits', pct: 2.7 },
  ]
  const tiers = [
    { label: '5 — Very High', bg: '#7f1d1d' },
    { label: '4 — High', bg: '#7c2d12' },
    { label: '3 — Moderate', bg: '#3b3200' },
    { label: '2 — Low', bg: '#0c1a3a' },
    { label: '1 — Very Low', bg: '#052e16' },
  ]
  return (
    <div className="slide">
      <div className="slide-header">
        <p className="slide-eyebrow">Analysis · 3c</p>
        <h2 className="slide-title-text">Staffing Score Methodology</h2>
      </div>
      <div style={{ width: '100%', maxWidth: 1000 }}>
        <div className="formula-box">
          <p className="formula-label">Scoring Formula</p>
          <p className="formula-text">Score = 100 × (0.70 × Category Pressure &nbsp;+&nbsp; 0.20 × Underprediction Gap &nbsp;+&nbsp; 0.10 × Underprediction %)</p>
        </div>
        <div className="score-body">
          <div className="s-card">
            <p className="s-card-label" style={{ marginBottom: '0.75rem' }}>Effective Category Weights (Severity × R²)</p>
            <table className="weights-table">
              <tbody>
                {weights.map((w) => (
                  <tr key={w.cat}>
                    <td>{w.cat}</td>
                    <td>
                      <div className="weight-bar-wrap">
                        <div className="weight-bar">
                          <div className="weight-bar-fill" style={{ width: `${w.pct}%` }} />
                        </div>
                        <span style={{ minWidth: '3.2em', textAlign: 'right', color: '#a78bfa', fontFamily: 'Fraunces, serif', fontWeight: 700 }}>{w.pct}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="s-card">
            <p className="s-card-label" style={{ marginBottom: '0.75rem' }}>Five Quantile-Based Tiers</p>
            <div className="tiers">
              {tiers.map((t) => (
                <div className="tier" key={t.label} style={{ background: t.bg }}>
                  {t.label}
                </div>
              ))}
            </div>
            <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.75rem', fontStyle: 'italic' }}>
              Frozen 2026 forecast scores dominated by category pressure — underprediction terms = 0 for future months
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── SLIDE 11: STAFFING ALLOCATION ───────────────────────────────────────────
function SlideAllocation() {
  return (
    <div className="slide">
      <div className="slide-header">
        <p className="slide-eyebrow">Analysis · 3c · Conclusion · 4a</p>
        <h2 className="slide-title-text">Staffing Allocation Results</h2>
      </div>
      <div className="two-col slide-body">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
            {[{ n: '572', l: 'Sworn Officers' }, { n: '170', l: 'Civilian Staff' }, { n: '742', l: 'Total Pool' }].map((s) => (
              <div className="s-card" key={s.l} style={{ textAlign: 'center' }}>
                <span className="s-card-value">{s.n}</span>
                <span className="s-card-desc" style={{ display: 'block' }}>{s.l}</span>
              </div>
            ))}
          </div>
          <div className="s-card">
            <p className="s-card-label">Allocation Formula</p>
            <div className="formula-box" style={{ marginBottom: 0 }}>
              <p className="formula-text" style={{ fontSize: '0.92rem' }}>
                Staff = (Neighborhood Mean Score ÷ Sum of All Scores) × 742
              </p>
            </div>
          </div>
        </div>
        <div className="s-card">
          <p className="s-card-label">How It Works</p>
          <ul className="s-bullets" style={{ marginTop: '0.75rem' }}>
            <li>Each neighborhood's mean staffing score computed across all forecast months (Mar–Dec 2026)</li>
            <li>Scores normalized to sum to 1.0 — each neighborhood gets a proportional share</li>
            <li>Very High tier neighborhoods receive the largest officer counts</li>
            <li>Score and allocation update automatically as new forecast data arrives</li>
            <li>Full allocation table visible in the Forecast tab of the dashboard</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

// ─── SLIDE 12: LIVE DEMO ──────────────────────────────────────────────────────
function SlideLiveDemo({ onSwitchTab, onExit }) {
  const tabs = [
    { key: 'analytics', icon: '📊', label: 'Analytics View', sub: 'Actuals vs Predicted' },
    { key: 'forecast', icon: '🔮', label: 'Forecast View', sub: '2026 Allocation Table' },
    { key: 'map', icon: '🗺️', label: 'Spatial Map', sub: 'Hotspot Timelapse' },
  ]
  return (
    <div className="slide">
      <div className="demo-slide">
        <div>
          <p className="slide-eyebrow">Software &amp; Analysis · 3a · 3b</p>
          <h2 className="slide-title-text" style={{ marginTop: '0.4rem' }}>Live Dashboard Demo</h2>
        </div>
        <p className="demo-url">dataminingfinal.vercel.app</p>
        <p className="demo-desc">Full-stack dashboard — FastAPI backend · React frontend · 10 live API endpoints · SQLite analytics database</p>
        <div className="demo-btns">
          {tabs.map((t) => (
            <button
              key={t.key}
              className="demo-btn"
              onClick={() => { onSwitchTab(t.key); onExit(); }}
            >
              <span className="demo-btn-icon">{t.icon}</span>
              {t.label}
              <span className="demo-btn-label">{t.sub}</span>
            </button>
          ))}
        </div>
        <p style={{ fontSize: '0.78rem', color: '#334155' }}>
          Click any view to jump directly to that section of the dashboard
        </p>
      </div>
    </div>
  )
}

// ─── SLIDE 13: KEY TAKEAWAYS ──────────────────────────────────────────────────
function SlideTakeaways() {
  const items = [
    {
      num: '0.3434',
      label: 'Conservative Policy APE',
      desc: 'Outperformed all 5 other year-weighting policies on real March & April 2026 actuals — the only policy to improve both months.',
    },
    {
      num: '742',
      label: 'Staff Allocated',
      desc: '572 sworn officers + 170 civilian staff distributed proportionally across 17 neighborhoods by a reproducible, data-driven score.',
    },
    {
      num: '8',
      label: 'ML Models Trained',
      desc: 'One Bootstrap Forest model per crime category — each contributing its accuracy-weighted share to the composite staffing metric.',
    },
    {
      num: '38.6%',
      label: 'Violent Person Weight',
      desc: 'Highest effective category weight — severity × model reliability ensures the most dangerous and reliably-predicted crimes drive staffing pressure.',
    },
  ]
  return (
    <div className="slide">
      <div className="slide-header">
        <p className="slide-eyebrow">Conclusion · 4a</p>
        <h2 className="slide-title-text">Key Takeaways</h2>
      </div>
      <div className="takeaways-grid slide-body">
        {items.map((item) => (
          <div className="takeaway-card" key={item.label}>
            <p className="takeaway-num">{item.num}</p>
            <p className="takeaway-label">{item.label}</p>
            <p className="takeaway-desc">{item.desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── SLIDE 14: LIMITATIONS & FUTURE ──────────────────────────────────────────
function SlideLimitations() {
  const limits = [
    'Model accuracy varies by neighborhood — localized factors not fully captured by POIs alone',
    'Frozen at 2024 training cutoff — no live retraining loop as new crime data is published',
    'POI data is static — does not reflect real-time changes (bar closures, new schools, etc.)',
    '2026 forecast scores driven solely by category pressure — underprediction terms unavailable for future months',
  ]
  const future = [
    'Real-time crime data feeds for continuous model retraining as actuals are published',
    'Deep learning (LSTM / Transformer) for richer temporal and seasonal patterns',
    'Dynamic POI updates via live geospatial APIs (OpenStreetMap, Google Places)',
    'Expand the full pipeline to other Minnesota cities using the same reproducible framework',
  ]
  return (
    <div className="slide">
      <div className="slide-header">
        <p className="slide-eyebrow">Conclusion · 4b · 4c</p>
        <h2 className="slide-title-text">Limitations &amp; Future Work</h2>
      </div>
      <div className="limits-grid slide-body">
        <div className="s-card">
          <p className="limits-col-label red">Current Limitations</p>
          <ul className="s-bullets">
            {limits.map((l) => <li key={l}>{l}</li>)}
          </ul>
        </div>
        <div className="s-card">
          <p className="limits-col-label blue">Future Research Directions</p>
          <ul className="s-bullets">
            {future.map((f) => <li key={f}>{f}</li>)}
          </ul>
        </div>
      </div>
    </div>
  )
}

// ─── SLIDE REGISTRY ───────────────────────────────────────────────────────────
const SLIDES = [
  { Component: SlideTitle,       label: 'Title' },
  { Component: SlideProblem,     label: 'Problem' },
  { Component: SlideQuestions,   label: 'Questions' },
  { Component: SlideData,        label: 'Data' },
  { Component: SlideCleansing,   label: 'Cleansing' },
  { Component: SlidePipeline,    label: 'Pipeline' },
  { Component: SlideModelSpecs,  label: 'Models' },
  { Component: SlideSoftware,    label: 'Software' },
  { Component: SlidePolicyResults, label: 'Policy Results' },
  { Component: SlideScore,       label: 'Score' },
  { Component: SlideAllocation,  label: 'Allocation' },
  { Component: SlideLiveDemo,    label: 'Demo' },
  { Component: SlideTakeaways,   label: 'Takeaways' },
  { Component: SlideLimitations, label: 'Limitations' },
]

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export function Presentation({ onExit, onSwitchTab }) {
  const [current, setCurrent] = useState(0)

  const next = useCallback(() => setCurrent((c) => Math.min(c + 1, SLIDES.length - 1)), [])
  const prev = useCallback(() => setCurrent((c) => Math.max(c - 1, 0)), [])

  useEffect(() => {
    const handleKey = (e) => {
      if (['ArrowRight', 'ArrowDown', ' '].includes(e.key)) { e.preventDefault(); next() }
      if (['ArrowLeft', 'ArrowUp'].includes(e.key)) { e.preventDefault(); prev() }
      if (e.key === 'Escape') onExit()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [next, prev, onExit])

  const { Component } = SLIDES[current]

  return (
    <div className="pres-overlay">
      {/* Top bar */}
      <div className="pres-topbar">
        <span className="pres-logo">St. Paul Police Staffing Analysis · DASC 400</span>
        <span className="pres-breadcrumb" aria-current="step">
          {SLIDES[current].label}
        </span>
        <div className="pres-top-right">
          <span className="pres-counter">{current + 1} / {SLIDES.length}</span>
          <button type="button" className="pres-exit" onClick={onExit} aria-label="Exit presentation slide mode">
            ✕ Exit Presentation
          </button>
        </div>
      </div>

      {/* Slide stage */}
      <div className="pres-stage">
        <Component
          key={current}
          onSwitchTab={onSwitchTab}
          onExit={onExit}
        />
      </div>

      {/* Bottom nav */}
      <div className="pres-controls">
        <button type="button" className="pres-btn" onClick={prev} disabled={current === 0} aria-label="Previous slide">
          ←
        </button>
        <div className="pres-dots">
          {SLIDES.map((s, i) => (
            <button
              type="button"
              key={s.label}
              className={`pres-dot ${i === current ? 'active' : ''}`}
              aria-label={`Go to slide ${i + 1}: ${s.label}`}
              aria-current={i === current ? 'step' : undefined}
              onClick={() => setCurrent(i)}
              title={s.label}
            />
          ))}
        </div>
        <button type="button" className="pres-btn" onClick={next} disabled={current === SLIDES.length - 1} aria-label="Next slide">
          →
        </button>
      </div>

      <span className="pres-hint">← → to navigate · Esc to exit</span>
    </div>
  )
}
