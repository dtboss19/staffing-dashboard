import { useCallback, useEffect, useRef, useState } from 'react'
import './PresentationScroll.css'

const NAV_ITEMS = [
  { id: 's-title', label: 'Title' },
  { id: 's-problem', label: 'Problem' },
  { id: 's-questions', label: 'Questions' },
  { id: 's-data', label: 'Data' },
  { id: 's-cleansing', label: 'Cleansing' },
  { id: 's-pipeline', label: 'Pipeline' },
  { id: 's-specs', label: 'Model Specs' },
  { id: 's-software', label: 'Software' },
  { id: 's-results', label: 'Results' },
  { id: 's-score', label: 'Score' },
  { id: 's-allocation', label: 'Allocation' },
  { id: 's-demo', label: 'Demo' },
  { id: 's-takeaways', label: 'Takeaways' },
  { id: 's-limitations', label: 'Limitations' },
]

const CATEGORY_PILLS = [
  'Violent Persons',
  'Weapons',
  'Property Theft',
  'Property Damage',
  'Narcotics',
  'Proactive Visits',
  'Other',
  'Total',
]

const POI_PILLS = [
  'Bars',
  'Liquor stores',
  'Gas stations',
  'Churches',
  'Schools',
  'Parks',
  'Grocery stores',
  'Pharmacies',
  'Bus stops',
]

const WEIGHT_ROWS = [
  { name: 'Violent Persons', pct: 38.6 },
  { name: 'Property Theft', pct: 29.7 },
  { name: 'Weapons', pct: 13.0 },
  { name: 'Property Damage', pct: 8.8 },
  { name: 'Narcotics', pct: 6.9 },
  { name: 'Proactive Visits', pct: 2.7 },
]

const POLICIES = [
  { name: 'No Weights', march: '0.41', april: '0.38', winner: false },
  { name: 'Current Baseline', march: '0.3452', april: '0.33', winner: false },
  { name: 'Lower 2019', march: '0.39', april: '0.36', winner: false },
  { name: 'Stronger Recency', march: '0.38', april: '0.35', winner: false },
  { name: 'Conservative', march: '0.33', april: '0.36', winner: true },
  { name: 'Manual', march: '0.37', april: '0.34', winner: false },
]

const QUESTION_TEXT_PARTS = [
  ['Which neighborhoods and months', ' show the highest staffing pressure?'],
  ['How close are model', ' predictions to observed crime counts by category?'],
  ['How should finite staff', ' be distributed using a reproducible score?'],
  ['Which year-weighting policy best', ' calibrates 2026 predictions?'],
]

function SectionDivider({ eyebrow, h2, variant }) {
  const isProblem = variant === 'ps-section-head--problem'
  return (
    <header className={`ps-section-head ${variant || ''}`}>
      <p className="ps-eyebrow">{eyebrow}</p>
      {isProblem ? <div className="ps-problem-eyebrow-line" aria-hidden /> : null}
      {isProblem ? null : <hr className="ps-section-rule" />}
      <h2 className="ps-section-h2">{h2}</h2>
    </header>
  )
}

export function PresentationScroll({ onSwitchTab = () => {}, layout = 'default' }) {
  const scrollRef = useRef(null)
  const [progress, setProgress] = useState(0)
  const [activeSectionId, setActiveSectionId] = useState(NAV_ITEMS[0].id)

  const updateScrollMetrics = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const { scrollTop, scrollHeight, clientHeight } = el
    const max = scrollHeight - clientHeight
    const ratio = max > 0 ? Math.min(1, Math.max(0, scrollTop / max)) : 0
    setProgress(ratio * 100)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return undefined
    updateScrollMetrics()
    el.addEventListener('scroll', updateScrollMetrics, { passive: true })
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateScrollMetrics) : null
    ro?.observe(el)
    return () => {
      el.removeEventListener('scroll', updateScrollMetrics)
      ro?.disconnect()
    }
  }, [updateScrollMetrics])

  useEffect(() => {
    const root = scrollRef.current
    if (!root) return undefined

    const elements = NAV_ITEMS.map(({ id }) => document.getElementById(id)).filter(Boolean)
    if (!elements.length) return undefined

    const observer = new IntersectionObserver(
      (entries) => {
        const intersecting = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        if (intersecting[0]?.target?.id) {
          setActiveSectionId(intersecting[0].target.id)
        }
      },
      {
        root,
        rootMargin: '-32% 0px -38% 0px',
        threshold: [0, 0.05, 0.15, 0.25, 0.35, 0.5, 0.65, 0.8, 1],
      },
    )

    elements.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [])

  function handleNavClick(sectionId) {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className={`presentation-scroll-mount${layout === 'home' ? ' presentation-scroll-mount--home' : ''}`}>
    <div className="presentation-scroll-root">
      <nav className="presentation-scroll-sidenav" aria-label="Presentation sections">
        {NAV_ITEMS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={`presentation-scroll-nav-btn ${activeSectionId === id ? 'active' : ''}`}
            onClick={() => handleNavClick(id)}
          >
            <span className="ps-nav-dot" aria-hidden />
            <span className="ps-nav-text">{label}</span>
          </button>
        ))}
      </nav>

      <div ref={scrollRef} className="presentation-scroll-viewport">
        <div className="presentation-scroll-progress-track" aria-hidden>
          <div className="presentation-scroll-progress-fill" style={{ width: `${progress}%` }} />
        </div>

        <section id="s-title" className="ps-section ps-section--hero">
          <div className="ps-section-inner ps-section-inner--hero">
            <p className="ps-hero-eyebrow">University of St. Thomas · DASC 400</p>
            <h1>Police Staffing Needs in St. Paul</h1>
            <p className="ps-hero-sub">Predicting crime counts and type with Machine Learning</p>
            <p className="ps-hero-team">Dylan Thomas · Sambhav Lamichhane · University of St. Thomas · DASC 400</p>
            <div className="ps-stat-row">
              <div className="ps-stat-card">
                <strong>17</strong>
                <span>Neighborhoods</span>
              </div>
              <div className="ps-stat-card">
                <strong>12+</strong>
                <span>Years of Data</span>
              </div>
              <div className="ps-stat-card">
                <strong>742</strong>
                <span>Staff Pool</span>
              </div>
              <div className="ps-stat-card">
                <strong>8</strong>
                <span>ML Models</span>
              </div>
            </div>
          </div>
        </section>

        <section id="s-problem" className="ps-section ps-section--problem">
          <div className="ps-section-inner">
            <SectionDivider variant="ps-section-head--problem" eyebrow="Introduction" h2="Problem & Solution" />
            <div className="ps-two-col">
              <article className="ps-card">
                <p className="ps-card-kicker">The Problem</p>
                <ul className="ps-list ps-list--square">
                  <li>742 staff (572 sworn + 170 civilian) deployed across 17 St. Paul neighborhoods with no data-driven framework</li>
                  <li>Monthly staffing decisions are reactive not tied to forecasted crime demand</li>
                  <li>No reproducible framework to guide monthly officer distribution</li>
                  <li>Crime pressure varies by neighborhood season and crime type</li>
                </ul>
              </article>
              <article className="ps-card">
                <p className="ps-card-kicker">Our Solution</p>
                <ul className="ps-list ps-list--square">
                  <li>ML pipeline predicting monthly crime counts by neighborhood and category</li>
                  <li>Bootstrap Forest models trained on 11 years of historical data</li>
                  <li>Staffing score weighted by crime severity and model reliability R-squared</li>
                  <li>Reproducible proportional allocation of all 742 staff</li>
                </ul>
              </article>
            </div>
          </div>
        </section>

        <section id="s-questions" className="ps-section">
          <div className="ps-section-inner">
            <SectionDivider eyebrow="Introduction · 1a" h2="Four Research Questions" />
            <div className="ps-q-grid">
              {['01', '02', '03', '04'].map((num, index) => (
                <article key={num} className="ps-q-card">
                  <div className="ps-q-num" aria-hidden>
                    {num}
                  </div>
                  <p className="ps-q-text">
                    <strong>{QUESTION_TEXT_PARTS[index][0]}</strong>
                    {QUESTION_TEXT_PARTS[index][1]}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="s-data" className="ps-section">
          <div className="ps-section-inner">
            <SectionDivider eyebrow="Introduction · 1b" h2="Data and Sources" />
            <div className="ps-two-col">
              <article className="ps-card">
                <h3 className="ps-card-title">Crime Data</h3>
                <p className="ps-muted">City of St. Paul open records</p>
                <div className="ps-timeline-wrap">
                  <div className="ps-timeline-bar" aria-hidden>
                    <div className="ps-timeline-fill" />
                  </div>
                  <div className="ps-timeline-labels">
                    <span>2014</span>
                    <span>Apr 2026</span>
                  </div>
                </div>
                <p className="ps-data-meta">17 neighborhoods · 8 crime categories · 12+ years</p>
                <div className="ps-pill-wrap">
                  {CATEGORY_PILLS.map((label) => (
                    <span key={label} className="ps-pill">
                      {label}
                    </span>
                  ))}
                </div>
              </article>
              <article className="ps-card">
                <h3 className="ps-card-title">Points of Interest</h3>
                <p className="ps-muted">Spatially engineered from open geospatial sources</p>
                <div className="ps-pill-wrap">
                  {POI_PILLS.map((label) => (
                    <span key={label} className="ps-pill">
                      {label}
                    </span>
                  ))}
                </div>
                <p className="ps-footnote ps-footnote--asterisk">
                  * Bus stops significant only for narcotics, property damage, and weapons models.
                </p>
                <p className="ps-footnote">VIF less than 5 across all predictors — no multicollinearity.</p>
              </article>
            </div>
          </div>
        </section>

        <section id="s-cleansing" className="ps-section">
          <div className="ps-section-inner">
            <SectionDivider eyebrow="Introduction · 1c" h2="Data Cleansing" />
            <div className="ps-cleanse-grid">
              <article className="ps-cleanse-card ps-cleanse-card--violet">
                <h4>COVID Year Handling</h4>
                <p>2020-2021 crime patterns severely distorted; down-weighted to 0.4× in forecast aggregation to reduce anomaly influence.</p>
              </article>
              <article className="ps-cleanse-card ps-cleanse-card--cyan">
                <h4>Train / Validation Split</h4>
                <p>Strict out-of-time split: 2014-2024 training, 2025-Feb 2026 held out entirely for validation; no data leakage.</p>
              </article>
              <article className="ps-cleanse-card ps-cleanse-card--green">
                <h4>Neighborhood Standardization</h4>
                <p>Naming inconsistencies across source files resolved into 17 canonical IDs used consistently across all data products.</p>
              </article>
              <article className="ps-cleanse-card ps-cleanse-card--amber">
                <h4>Multicollinearity Check</h4>
                <p>Regression run per target to screen POIs; all predictors passed VIF less than 5; no multicollinearity issues.</p>
              </article>
            </div>
          </div>
        </section>

        <section id="s-pipeline" className="ps-section">
          <div className="ps-section-inner">
            <SectionDivider eyebrow="Models · 2a · 2b" h2="Four-Stage Pipeline" />
            <div className="ps-pipeline">
              <article className="ps-pipeline-stage">
                <span className="ps-stage-pill">Stage 1</span>
                <h3 className="ps-stage-name">Variable Selection</h3>
                <p className="ps-stage-desc">
                  Regression models per target identify statistically significant POIs; bus stops significant only for 3 of 8 models.
                </p>
              </article>
              <div className="ps-pipeline-connector" aria-hidden>
                <span className="ps-pipeline-line" />
                <span className="ps-pipeline-arrow ps-pipeline-arrow--horizontal">›</span>
                <span className="ps-pipeline-arrow ps-pipeline-arrow--vertical">↓</span>
              </div>
              <article className="ps-pipeline-stage">
                <span className="ps-stage-pill">Stage 2</span>
                <h3 className="ps-stage-name">Bootstrap Forest</h3>
                <p className="ps-stage-desc">8 separate models trained one per crime category; 300 trees, min split 30, boost rate 1.0, seed 123.</p>
              </article>
              <div className="ps-pipeline-connector" aria-hidden>
                <span className="ps-pipeline-line" />
                <span className="ps-pipeline-arrow ps-pipeline-arrow--horizontal">›</span>
                <span className="ps-pipeline-arrow ps-pipeline-arrow--vertical">↓</span>
              </div>
              <article className="ps-pipeline-stage">
                <span className="ps-stage-pill">Stage 3</span>
                <h3 className="ps-stage-name">Weighted Median Forecast</h3>
                <p className="ps-stage-desc">
                  Frozen 2026 forecasts via weighted-median aggregation across historical rows calibrated by year-weight policy.
                </p>
              </article>
              <div className="ps-pipeline-connector" aria-hidden>
                <span className="ps-pipeline-line" />
                <span className="ps-pipeline-arrow ps-pipeline-arrow--horizontal">›</span>
                <span className="ps-pipeline-arrow ps-pipeline-arrow--vertical">↓</span>
              </div>
              <article className="ps-pipeline-stage">
                <span className="ps-stage-pill">Stage 4</span>
                <h3 className="ps-stage-name">Staffing Score</h3>
                <p className="ps-stage-desc">
                  Composite score synthesizes category pressure, severity weights, and model reliability R-squared into a 0 to 100 metric.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section id="s-specs" className="ps-section">
          <div className="ps-section-inner">
            <SectionDivider eyebrow="Models · 2a · 2c" h2="Model Specifications" />
            <div className="ps-two-col">
              <article className="ps-card">
                <h3 className="ps-card-title">Bootstrap Forest — Identical Specs Across All 8 Models</h3>
                <table className="ps-table ps-table--zebra">
                  <tbody>
                    <tr><th scope="row">Number of trees</th><td>300</td></tr>
                    <tr><th scope="row">Min split size</th><td>30</td></tr>
                    <tr><th scope="row">Max splits</th><td>300</td></tr>
                    <tr><th scope="row">Min splits per tree</th><td>10</td></tr>
                    <tr><th scope="row">Boost rate</th><td>1.0</td></tr>
                    <tr><th scope="row">Random seed</th><td>123</td></tr>
                    <tr><th scope="row">Software</th><td>JMP Pro</td></tr>
                  </tbody>
                </table>
                <p className="ps-footnote">Same explanatory variables for all models — month, year, neighborhood census tract count, POIs.</p>
              </article>
              <article className="ps-card">
                <h3 className="ps-card-title">8 Separate Target Models</h3>
                <div className="ps-model-pills">
                  <div className="ps-model-pill">Total Crime Count</div>
                  <div className="ps-model-pill">Violent Persons</div>
                  <div className="ps-model-pill">Weapons</div>
                  <div className="ps-model-pill">Property Theft</div>
                  <div className="ps-model-pill">Property Damage</div>
                  <div className="ps-model-pill">Narcotics</div>
                  <div className="ps-model-pill">Proactive Police Visits</div>
                  <div className="ps-model-pill">Other</div>
                </div>
                <p className="ps-footnote">Each model generates monthly predictions per neighborhood — frozen and stored in SQLite for dashboard consumption.</p>
              </article>
            </div>
          </div>
        </section>

        <section id="s-software" className="ps-section">
          <div className="ps-section-inner">
            <SectionDivider eyebrow="Software · 3a" h2="Software Stack" />
            <div className="ps-soft-rows">
              <div className="ps-soft-row">
                <div className="ps-soft-nameblock">
                  <span className="ps-soft-tool">JMP Pro</span>
                  <span className="ps-soft-role">Statistical Modeling</span>
                </div>
                <span className="ps-soft-arrow" aria-hidden>
                  →
                </span>
                <p className="ps-soft-desc">Bootstrap Forest models for 8 targets; regression for variable selection; R-squared reliability weights.</p>
              </div>
              <div className="ps-soft-row">
                <div className="ps-soft-nameblock">
                  <span className="ps-soft-tool">Python</span>
                  <span className="ps-soft-role">Data Pipeline + API</span>
                </div>
                <span className="ps-soft-arrow" aria-hidden>
                  →
                </span>
                <p className="ps-soft-desc">Data build scripts; forecast aggregation; FastAPI backend; SQLite query layer.</p>
              </div>
              <div className="ps-soft-row">
                <div className="ps-soft-nameblock">
                  <span className="ps-soft-tool">SQLite</span>
                  <span className="ps-soft-role">Analytics Database</span>
                </div>
                <span className="ps-soft-arrow" aria-hidden>
                  →
                </span>
                <p className="ps-soft-desc">
                  staffing_analytics.db; stores actuals predictions forecast and staffing scores; queried live by API.
                </p>
              </div>
              <div className="ps-soft-row">
                <div className="ps-soft-nameblock">
                  <span className="ps-soft-tool">React + Vite</span>
                  <span className="ps-soft-role">Interactive Dashboard</span>
                </div>
                <span className="ps-soft-arrow" aria-hidden>
                  →
                </span>
                <p className="ps-soft-desc">Custom SVG charts; neighborhood hotspot map timelapse; forecast trend views; category breakdown.</p>
              </div>
              <div className="ps-soft-row">
                <div className="ps-soft-nameblock">
                  <span className="ps-soft-tool">Vercel</span>
                  <span className="ps-soft-role">Deployment</span>
                </div>
                <span className="ps-soft-arrow" aria-hidden>
                  →
                </span>
                <p className="ps-soft-desc">
                  Static frontend hosting; dataminingfinal.vercel.app; production-deployed publicly accessible.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="s-results" className="ps-section">
          <div className="ps-section-inner">
            <SectionDivider eyebrow="Analysis · 3b" h2="Policy Comparison Results" />
            <div className="ps-winner-banner">
              <strong className="ps-win-title">
                <span className="ps-win-check" aria-hidden>
                  ✓
                </span>{' '}
                Winner: Conservative Policy
              </strong>
              <p className="ps-win-body">
                Only policy to improve both March AND April 2026 vs current baseline · Combined APE 0.3434 vs 0.3452 · 34 neighborhood-month rows evaluated
              </p>
            </div>
            <div className="ps-policy-grid">
              {POLICIES.map((policy) => (
                <article key={policy.name} className={`ps-policy-card ${policy.winner ? 'ps-policy-card--winner' : ''}`}>
                  <p className="ps-policy-name">{policy.name}</p>
                  <p className="ps-ape-meta">
                    <span className="ps-ape-label">March APE</span>
                    <span className={`ps-ape-value ${policy.winner ? 'ps-ape-value--win' : ''}`}>{policy.march}</span>
                  </p>
                  <p className="ps-ape-meta">
                    <span className="ps-ape-label">April APE</span>
                    <span className={`ps-ape-value ${policy.winner ? 'ps-ape-value--win' : ''}`}>{policy.april}</span>
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="s-score" className="ps-section">
          <div className="ps-section-inner">
            <SectionDivider eyebrow="Analysis · 3c" h2="Staffing Score Methodology" />
            <div className="ps-formula-box">
              <span className="ps-formula-label">Formula</span>
              <p className="ps-formula-body">
                Score = 100 × (0.70 × Category Pressure + 0.20 × Underprediction Gap + 0.10 × Underprediction %)
              </p>
            </div>
            <div className="ps-two-col">
              <article className="ps-card">
                <h3 className="ps-card-title">Effective Category Weights (Severity × R-squared)</h3>
                <table className="ps-weight-table">
                  <tbody>
                    {WEIGHT_ROWS.map((row) => (
                      <tr key={row.name}>
                        <td>{row.name}</td>
                        <td className="ps-bar-cell">
                          <div className="ps-bar-track">
                            <div className="ps-bar-fill" style={{ width: `${row.pct}%` }} />
                          </div>
                        </td>
                        <td className="ps-weight-pct">{row.pct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </article>
              <article className="ps-card">
                <h3 className="ps-card-title">Five Quantile-Based Tiers</h3>
                <div className="ps-tier-badges">
                  <div className="ps-tier-badge ps-tier-badge--5">5 — Very High</div>
                  <div className="ps-tier-badge ps-tier-badge--4">4 — High</div>
                  <div className="ps-tier-badge ps-tier-badge--3">3 — Moderate</div>
                  <div className="ps-tier-badge ps-tier-badge--2">2 — Low</div>
                  <div className="ps-tier-badge ps-tier-badge--1">1 — Very Low</div>
                </div>
                <p className="ps-footnote">Frozen 2026 forecast scores dominated by category pressure — underprediction terms = 0 for future months.</p>
              </article>
            </div>
          </div>
        </section>

        <section id="s-allocation" className="ps-section">
          <div className="ps-section-inner">
            <SectionDivider eyebrow="Analysis · 3c · Conclusion · 4a" h2="Staffing Allocation" />
            <div className="ps-two-col">
              <div>
                <div className="ps-mini-stats">
                  <div className="ps-mini-card">
                    <strong>572</strong>
                    <span>Sworn Officers</span>
                  </div>
                  <div className="ps-mini-card">
                    <strong>170</strong>
                    <span>Civilian Staff</span>
                  </div>
                  <div className="ps-mini-card">
                    <strong>742</strong>
                    <span>Total Pool</span>
                  </div>
                </div>
                <div className="ps-formula-box ps-formula-box--compact">
                  <span className="ps-formula-label">Formula</span>
                  <p className="ps-formula-body">Staff = (Neighborhood Mean Score ÷ Sum of All Scores) × 742</p>
                </div>
              </div>
              <article className="ps-card">
                <h3 className="ps-card-title">How It Works</h3>
                <ul className="ps-list ps-list--square">
                  <li>Each neighborhood mean staffing score computed across all forecast months Mar-Dec 2026</li>
                  <li>Scores normalized to sum to 1.0 for proportional share</li>
                  <li>Very High tier neighborhoods receive largest officer counts</li>
                  <li>Score and allocation update automatically as new forecast data arrives</li>
                  <li>Full allocation table visible in Forecast tab of the dashboard</li>
                </ul>
              </article>
            </div>
          </div>
        </section>

        <section id="s-demo" className="ps-section ps-section--demo">
          <div className="ps-section-inner ps-demo-inner">
            <p className="ps-demo-eyebrow">Software · 3a · 3b</p>
            <h2 className="ps-demo-h2">Live Dashboard Demo</h2>
            <a className="ps-demo-url" href="https://dataminingfinal.vercel.app" target="_blank" rel="noopener noreferrer">
              dataminingfinal.vercel.app
            </a>
            <p className="ps-demo-desc">
              Full-stack dashboard — FastAPI backend · React frontend · 10 live API endpoints · SQLite analytics database
            </p>
            <div className="ps-demo-cards">
              <button type="button" className="ps-demo-card" onClick={() => onSwitchTab('analytics')}>
                <span className="ps-demo-icon" aria-hidden>
                  📊
                </span>
                <span className="ps-demo-title">Analytics View</span>
                <span className="ps-demo-sub">Actuals vs Predicted</span>
              </button>
              <button type="button" className="ps-demo-card" onClick={() => onSwitchTab('forecast')}>
                <span className="ps-demo-icon" aria-hidden>
                  🔮
                </span>
                <span className="ps-demo-title">Forecast View</span>
                <span className="ps-demo-sub">2026 Allocation Table</span>
              </button>
              <button type="button" className="ps-demo-card" onClick={() => onSwitchTab('map')}>
                <span className="ps-demo-icon" aria-hidden>
                  🗺️
                </span>
                <span className="ps-demo-title">Spatial Map</span>
                <span className="ps-demo-sub">Hotspot Timelapse</span>
              </button>
            </div>
          </div>
        </section>

        <section id="s-takeaways" className="ps-section">
          <div className="ps-section-inner">
            <SectionDivider eyebrow="Conclusion · 4a" h2="Key Takeaways" />
            <div className="ps-take-grid">
              <article className="ps-take-card">
                <span className="ps-take-stat">0.3434</span>
                <p className="ps-take-label">Conservative Policy APE</p>
                <p className="ps-take-copy">
                  Outperformed all 5 other year-weighting policies on real March and April 2026 actuals — the only policy to improve both months.
                </p>
              </article>
              <article className="ps-take-card">
                <span className="ps-take-stat">742</span>
                <p className="ps-take-label">Staff Allocated</p>
                <p className="ps-take-copy">
                  572 sworn officers + 170 civilian staff distributed proportionally across 17 neighborhoods by a reproducible data-driven score.
                </p>
              </article>
              <article className="ps-take-card">
                <span className="ps-take-stat">8</span>
                <p className="ps-take-label">ML Models Trained</p>
                <p className="ps-take-copy">
                  One Bootstrap Forest model per crime category — each contributing its accuracy-weighted share to the composite staffing metric.
                </p>
              </article>
              <article className="ps-take-card">
                <span className="ps-take-stat">38.6%</span>
                <p className="ps-take-label">Violent Person Weight</p>
                <p className="ps-take-copy">
                  Highest effective category weight — severity times model reliability ensures the most dangerous reliably-predicted crimes drive staffing pressure.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section id="s-limitations" className="ps-section">
          <div className="ps-section-inner">
            <SectionDivider eyebrow="Conclusion · 4b · 4c" h2="Limitations and Future Work" />
            <div className="ps-two-col">
              <article className="ps-limits-card ps-limits-card--risk">
                <p className="ps-limits-kicker ps-limits-kicker--red">Current Limitations</p>
                <ul className="ps-list ps-list--circles-red">
                  <li>Model accuracy varies by neighborhood</li>
                  <li>Frozen at 2024 training cutoff with no live retraining loop</li>
                  <li>POI data is static and does not reflect real-time neighborhood changes</li>
                  <li>2026 forecast scores driven solely by category pressure</li>
                </ul>
              </article>
              <article className="ps-limits-card ps-limits-card--future">
                <p className="ps-limits-kicker ps-limits-kicker--blue">Future Research Directions</p>
                <ul className="ps-list ps-list--circles-blue">
                  <li>Real-time crime data feeds for continuous model retraining</li>
                  <li>Deep learning LSTM and Transformer for richer temporal patterns</li>
                  <li>Dynamic POI updates via live geospatial APIs</li>
                  <li>Expand pipeline to other Minnesota cities</li>
                </ul>
              </article>
            </div>
          </div>
        </section>
      </div>
    </div>
    </div>
  )
}
