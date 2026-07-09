import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { formatStockPrice, formatUsd } from "./finance-utils.js";
import { runAnalysisDetailed } from "./index.js";
import type { CompetitorAnalysis, TrackerReport } from "./types.js";

const PORT = Number(process.env.PORT ?? 3000);
const downloads = new Map<string, { markdown: string; report: TrackerReport }>();

const DEMO_PRESETS = [
  { label: "Apple · financial", competitors: "Apple", mode: "financial" },
  { label: "Notion · market", competitors: "Notion", mode: "market" },
  { label: "Slack · reviews", competitors: "Slack", mode: "reviews" },
  { label: "Figma · social", competitors: "Figma", mode: "social" },
] as const;

const MODE_DESCRIPTIONS: Record<string, string> = {
  market: "Pricing, product pages and competitive positioning. Default choice to understand how a company competes.",
  financial: "Stock price, market cap and earnings news. Enter one public company (e.g. Apple) — peers are discovered automatically.",
  social: "LinkedIn, X, YouTube visibility — how present the brand is in public channels.",
  hiring: "Careers pages and job listings — signals of team growth.",
  reviews: "G2, Reddit, comparisons — customer sentiment and reputation.",
};

const SIZE_DESCRIPTIONS: Record<string, string> = {
  small: "Fast scan: fewer sources, fewer pages, quicker answer.",
  large: "Deep research: more sources, more scraping, slower but richer.",
};

const SIZE_ESTIMATES: Record<string, string> = {
  small: "Usually ~30-60s",
  large: "Usually ~2-4 min",
};

const COMPETITOR_COUNT_HINTS: Record<string, string> = {
  "1": "Only the company you entered. Fastest option.",
  "2": "Your company + 1 inferred competitor.",
  "3": "Your company + up to 2 inferred competitors.",
  "4": "Your company + up to 3 inferred competitors. Slowest.",
};

type PageOptions = { stickyCta?: boolean };

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function metricCount(competitor: CompetitorAnalysis, category: string): number {
  return competitor.signals.filter((item) => item.category === category).length;
}

function pageTemplate(content: string, title = "Company Intelligence Platform", options: PageOptions = {}): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #0b1020;
        --panel: #141b34;
        --panel-2: #1b2548;
        --text: #eef2ff;
        --muted: #a5b4fc;
        --accent: #7c3aed;
        --accent-2: #22c55e;
        --border: rgba(255,255,255,0.08);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: Inter, ui-sans-serif, system-ui, sans-serif;
        background: radial-gradient(circle at top, #182247 0%, var(--bg) 55%);
        color: var(--text);
      }
      .wrap { max-width: 1220px; margin: 0 auto; padding: 28px 20px 64px; }
      body.has-sticky { padding-bottom: 88px; }
      .nav { display:flex; justify-content:space-between; align-items:center; gap: 16px; margin-bottom: 28px; flex-wrap: wrap; }
      .nav-brand { font-size: 1.05rem; font-weight: 800; letter-spacing: 0.02em; }
      .nav-links { display:flex; align-items:center; gap: 10px; flex-wrap: wrap; }
      .nav a { text-decoration:none; color: var(--text); padding: 8px 12px; border-radius: 10px; background: rgba(255,255,255,0.04); }
      .nav-cta {
        background: linear-gradient(135deg, var(--accent), #2563eb);
        font-weight: 800;
        color: white !important;
      }
      .sticky-cta {
        position: fixed;
        left: 50%;
        bottom: 18px;
        transform: translateX(-50%);
        z-index: 50;
        text-decoration: none;
        color: white;
        font-weight: 800;
        padding: 14px 22px;
        border-radius: 999px;
        background: linear-gradient(135deg, var(--accent), #2563eb);
        box-shadow: 0 18px 50px rgba(37, 99, 235, 0.35);
        border: 1px solid rgba(255,255,255,0.12);
      }
      .accordion {
        margin-top: 18px;
        border: 1px solid var(--border);
        border-radius: 16px;
        background: rgba(20, 27, 52, 0.72);
        overflow: hidden;
      }
      .accordion summary {
        cursor: pointer;
        padding: 16px 18px;
        font-weight: 800;
        list-style: none;
      }
      .accordion summary::-webkit-details-marker { display: none; }
      .accordion-body { padding: 0 18px 18px; }
      .feature-grid { display:grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 16px; }
      .feature-card {
        background: rgba(20, 27, 52, 0.72);
        border: 1px solid var(--border);
        border-radius: 16px;
        padding: 18px;
      }
      .mode-explainer {
        margin-top: 10px;
        padding: 12px 14px;
        border-radius: 12px;
        background: rgba(124, 58, 237, 0.12);
        border: 1px solid var(--border);
        color: #dbeafe;
        line-height: 1.45;
        font-size: 0.92rem;
      }
      .hero { margin-bottom: 22px; }
      .hero h1 { margin: 0 0 10px; font-size: 3rem; line-height: 1.02; max-width: 820px; }
      .hero p { margin: 0; color: var(--muted); max-width: 820px; line-height: 1.55; font-size: 1.05rem; }
      .home-grid { display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 20px; margin-bottom: 20px; }
      .grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 20px; }
      .card, .mini-card {
        background: rgba(20, 27, 52, 0.9);
        border: 1px solid var(--border);
        border-radius: 18px;
        padding: 20px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.25);
      }
      .mini-card { padding: 16px; background: var(--panel-2); box-shadow: none; }
      label { display: block; margin-bottom: 8px; font-weight: 700; }
      input, textarea {
        width: 100%;
        border: 1px solid var(--border);
        border-radius: 12px;
        background: var(--panel-2);
        color: var(--text);
        padding: 12px 14px;
        font: inherit;
      }
      textarea { min-height: 92px; resize: vertical; }
      .field { margin-bottom: 16px; }
      select {
        width: 100%;
        border: 1px solid var(--border);
        border-radius: 12px;
        background: var(--panel-2);
        color: var(--text);
        padding: 12px 14px;
        font: inherit;
      }
      .hint { margin-top: 6px; color: var(--muted); font-size: 0.92rem; }
      .inline-note { display:flex; gap:10px; flex-wrap:wrap; align-items:center; margin-top: 8px; }
      .inline-note a { color: #c4b5fd; }
      button {
        width: 100%;
        border: 0;
        border-radius: 12px;
        background: linear-gradient(135deg, var(--accent), #2563eb);
        color: white;
        font: inherit;
        font-weight: 800;
        padding: 14px 16px;
        cursor: pointer;
      }
      .pill, .chip {
        display: inline-block;
        padding: 6px 10px;
        border-radius: 999px;
        background: rgba(124, 58, 237, 0.18);
        color: #d8b4fe;
        font-size: 0.84rem;
        margin-right: 8px;
        margin-bottom: 8px;
      }
      .chip-green { background: rgba(34, 197, 94, 0.18); color: #bbf7d0; }
      .report {
        white-space: pre-wrap;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        line-height: 1.5;
      }
      .tabs, .actions, .chips { display: flex; flex-wrap: wrap; gap: 10px; }
      .tabs { margin-bottom: 18px; }
      .tabs a, .button-link {
        text-decoration: none;
        color: white;
        padding: 10px 12px;
        border-radius: 10px;
        background: rgba(124, 58, 237, 0.2);
        border: 1px solid var(--border);
      }
      .button-link.secondary { background: rgba(37, 99, 235, 0.15); }
      .empty { color: var(--muted); line-height: 1.7; }
      .success, .error {
        padding-left: 12px;
        margin-bottom: 16px;
        border-left: 4px solid;
      }
      .success { border-color: var(--accent-2); }
      .error { border-color: #ef4444; color: #fecaca; }
      .panel-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; margin-bottom: 18px; }
      .mini-grid, .stack { display: grid; gap: 16px; }
      .mini-grid { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
      .preset-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
      .preset {
        text-align:left;
        width: 100%;
        border: 1px solid var(--border);
        border-radius: 14px;
        background: linear-gradient(180deg, rgba(124,58,237,0.14), rgba(37,99,235,0.08));
        color: var(--text);
        padding: 14px;
      }
      .preset strong {
        display:block;
        margin-bottom: 4px;
      }
      .preset span {
        color: var(--muted);
        font-size: 0.9rem;
      }
      .hero-strip {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 12px;
        margin-top: 18px;
      }
      .hero-metric {
        background: rgba(20, 27, 52, 0.72);
        border: 1px solid var(--border);
        border-radius: 14px;
        padding: 14px;
      }
      .hero-metric span {
        display: block;
        color: var(--muted);
        font-size: 0.82rem;
        margin-bottom: 4px;
      }
      .hero-metric strong {
        font-size: 1.08rem;
      }
      .mode-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 10px;
        margin-bottom: 16px;
      }
      .mode-card {
        background: rgba(124,58,237,0.08);
        border: 1px solid var(--border);
        border-radius: 14px;
        padding: 12px;
      }
      .mode-card strong {
        display: block;
        margin-bottom: 4px;
      }
      .loader-overlay {
        position: fixed;
        inset: 0;
        z-index: 80;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 20px;
        background: rgba(4, 8, 20, 0.74);
        backdrop-filter: blur(10px);
      }
      .loader-overlay.active { display: flex; }
      .loader-card {
        width: min(560px, 100%);
        border: 1px solid var(--border);
        border-radius: 22px;
        background: linear-gradient(180deg, rgba(20,27,52,0.98), rgba(11,16,32,0.98));
        box-shadow: 0 30px 80px rgba(0,0,0,0.45);
        padding: 28px;
      }
      .loader-head { display:flex; align-items:center; gap:14px; margin-bottom: 14px; }
      .loader-orb {
        width: 18px;
        height: 18px;
        border-radius: 999px;
        background: linear-gradient(135deg, #7c3aed, #22c55e);
        box-shadow: 0 0 24px rgba(124,58,237,0.8);
        animation: pulse 1.2s infinite ease-in-out;
      }
      .loader-bar {
        height: 10px;
        border-radius: 999px;
        overflow: hidden;
        background: rgba(255,255,255,0.08);
        margin: 16px 0 12px;
      }
      .loader-bar-fill {
        width: 42%;
        height: 100%;
        border-radius: 999px;
        background: linear-gradient(90deg, #7c3aed, #2563eb, #22c55e);
        animation: shimmer 1.4s infinite ease-in-out;
      }
      .loader-steps { display:grid; gap: 10px; margin-top: 14px; }
      .loader-step {
        padding: 10px 12px;
        border-radius: 12px;
        background: rgba(255,255,255,0.04);
        color: var(--muted);
      }
      .loader-step.active {
        color: white;
        background: rgba(124,58,237,0.16);
        border: 1px solid rgba(124,58,237,0.22);
      }
      @keyframes pulse {
        0%, 100% { transform: scale(0.92); opacity: 0.85; }
        50% { transform: scale(1.15); opacity: 1; }
      }
      @keyframes shimmer {
        0% { transform: translateX(-40%); }
        50% { transform: translateX(80%); }
        100% { transform: translateX(180%); }
      }
      .cta-row {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        margin-top: 14px;
      }
      .cta {
        text-decoration: none;
        color: white;
        padding: 10px 12px;
        border-radius: 12px;
        background: linear-gradient(135deg, rgba(124,58,237,0.25), rgba(37,99,235,0.18));
        border: 1px solid var(--border);
      }
      table { width: 100%; border-collapse: collapse; }
      th, td { text-align: left; padding: 10px 8px; border-bottom: 1px solid var(--border); vertical-align: top; }
      a { color: #c4b5fd; }
      .bar-row { display: grid; grid-template-columns: 120px 1fr 40px; gap: 10px; align-items: center; margin-bottom: 12px; }
      .bar-track { height: 12px; background: rgba(255,255,255,0.08); border-radius: 999px; overflow: hidden; }
      .bar-fill { height: 100%; background: linear-gradient(90deg, #7c3aed, #2563eb); border-radius: 999px; }
      .stats-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-bottom: 14px; }
      .stat { background: var(--panel-2); border: 1px solid var(--border); border-radius: 12px; padding: 12px; }
      .stat span { display: block; color: var(--muted); font-size: 0.85rem; margin-bottom: 6px; }
      .stat strong { font-size: 1.05rem; }
      .results-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 16px;
        flex-wrap: wrap;
        margin-bottom: 18px;
        padding: 18px;
        border-radius: 18px;
        background: rgba(20, 27, 52, 0.95);
        border: 1px solid var(--border);
      }
      .results-meta h2 { margin: 0 0 8px; }
      .results-meta p { margin: 0; color: var(--muted); }
      .download-toolbar { display: flex; flex-wrap: wrap; gap: 10px; }
      .dl-btn {
        text-decoration: none;
        color: white;
        padding: 12px 16px;
        border-radius: 12px;
        font-weight: 800;
        border: 1px solid var(--border);
        background: linear-gradient(135deg, var(--accent), #2563eb);
      }
      .dl-btn.secondary { background: rgba(37, 99, 235, 0.22); }
      .dl-btn.ghost { background: rgba(255,255,255,0.06); }
      .report-section {
        margin-bottom: 14px;
        border: 1px solid var(--border);
        border-radius: 16px;
        background: rgba(20, 27, 52, 0.72);
        overflow: hidden;
      }
      .report-section summary {
        cursor: pointer;
        padding: 16px 18px;
        font-weight: 800;
        font-size: 1.02rem;
        list-style: none;
      }
      .report-section summary::-webkit-details-marker { display: none; }
      .report-section-body { padding: 0 18px 18px; }
      .metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
      .metric-card {
        background: var(--panel-2);
        border: 1px solid var(--border);
        border-radius: 14px;
        padding: 14px;
      }
      .metric-label { display: block; color: var(--muted); font-size: 0.82rem; margin-bottom: 6px; }
      .metric-value { display: block; font-size: 1.35rem; line-height: 1.1; margin-bottom: 6px; }
      .metric-hint { display: block; color: var(--muted); font-size: 0.8rem; line-height: 1.35; }
      .investor-card {
        background: linear-gradient(180deg, rgba(124,58,237,0.12), rgba(20,27,52,0.9));
        border: 1px solid var(--border);
        border-radius: 16px;
        padding: 18px;
      }
      .investor-card h3 { margin: 0 0 8px; }
      .investor-brief { color: #dbeafe; line-height: 1.55; margin: 0 0 14px; }
      .chart-wrap { margin-top: 12px; }
      .chart-title { color: var(--muted); font-size: 0.9rem; margin-bottom: 10px; }
      .chart-row { display: grid; grid-template-columns: 110px 1fr 70px; gap: 10px; align-items: center; margin-bottom: 10px; }
      .chart-bar-track { height: 18px; background: rgba(255,255,255,0.08); border-radius: 999px; overflow: hidden; }
      .chart-bar-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, #22c55e, #2563eb); }
      .chart-bar-fill.alt { background: linear-gradient(90deg, #7c3aed, #ec4899); }
      .signal-list li { margin-bottom: 12px; line-height: 1.45; }
      .report pre {
        white-space: pre-wrap;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        line-height: 1.5;
        margin: 0;
        padding: 14px;
        background: rgba(0,0,0,0.22);
        border-radius: 12px;
        max-height: 420px;
        overflow: auto;
      }
      @media (max-width: 900px) {
        .home-grid, .grid, .panel-grid, .stats-grid, .hero-strip, .feature-grid { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body class="${options.stickyCta ? "has-sticky" : ""}">
    <div class="wrap">
      <div class="nav">
        <div class="nav-brand">Company Intelligence Platform</div>
        <div class="nav-links">
          <a href="/">Home</a>
          <a href="/about">How it works</a>
          <a href="/search" class="nav-cta">Run live search</a>
        </div>
      </div>
      ${content}
    </div>
    ${options.stickyCta ? `<a href="/search" class="sticky-cta">Run live company search</a>` : ""}
  </body>
</html>`;
}

function renderPresetAccordion(): string {
  const cards = DEMO_PRESETS.map((preset) => `
    <button
      type="button"
      class="preset"
      onclick="applyPreset('${escapeHtml(preset.competitors)}','${escapeHtml(preset.mode)}')"
    >
      <strong>${escapeHtml(preset.label)}</strong>
      <span>${escapeHtml(preset.competitors)} · ${escapeHtml(preset.mode)}</span>
    </button>
  `).join("");

  return `<details class="accordion" open>
    <summary>Quick demo presets</summary>
    <div class="accordion-body">
      <p class="hint">Click a preset to fill the form instantly.</p>
      <div class="preset-grid">${cards}</div>
    </div>
  </details>`;
}

function presetScript(): string {
  const modesJson = JSON.stringify(MODE_DESCRIPTIONS);
  const sizesJson = JSON.stringify(SIZE_DESCRIPTIONS);
  const estimatesJson = JSON.stringify(SIZE_ESTIMATES);
  const competitorHintsJson = JSON.stringify(COMPETITOR_COUNT_HINTS);
  return `<script>
    const MODE_DESCRIPTIONS = ${modesJson};
    const SIZE_DESCRIPTIONS = ${sizesJson};
    const SIZE_ESTIMATES = ${estimatesJson};
    const COMPETITOR_COUNT_HINTS = ${competitorHintsJson};
    function applyPreset(competitors, mode) {
      const c = document.getElementById('competitors');
      const m = document.getElementById('researchMode');
      if (c) c.value = competitors;
      if (m) m.value = mode;
      updateModeHint();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    function updateModeHint() {
      const m = document.getElementById('researchMode');
      const hint = document.getElementById('modeHint');
      if (!m || !hint) return;
      hint.textContent = MODE_DESCRIPTIONS[m.value] || '';
    }
    function updateSizeHint() {
      const s = document.getElementById('analysisSize');
      const hint = document.getElementById('sizeHint');
      const estimate = document.getElementById('sizeEstimate');
      if (!s || !hint) return;
      hint.textContent = SIZE_DESCRIPTIONS[s.value] || '';
      if (estimate) estimate.textContent = SIZE_ESTIMATES[s.value] || '';
      const max = document.getElementById('maxCompetitors');
      if (max && s.value === 'small' && Number(max.value) > 2) max.value = '2';
      updateCompetitorCountHint();
    }
    function updateCompetitorCountHint() {
      const max = document.getElementById('maxCompetitors');
      const hint = document.getElementById('competitorCountHint');
      if (!max || !hint) return;
      hint.textContent = COMPETITOR_COUNT_HINTS[max.value] || '';
    }
    function startLoader() {
      const overlay = document.getElementById('loaderOverlay');
      if (!overlay) return true;
      overlay.classList.add('active');
      const steps = Array.from(document.querySelectorAll('.loader-step'));
      let current = 0;
      steps.forEach((step, index) => step.classList.toggle('active', index === 0));
      window.__loaderInterval = window.setInterval(() => {
        current = (current + 1) % steps.length;
        steps.forEach((step, index) => step.classList.toggle('active', index === current));
      }, 1800);
      return true;
    }
    document.addEventListener('DOMContentLoaded', () => {
      updateModeHint();
      updateSizeHint();
      updateCompetitorCountHint();
      const form = document.getElementById('searchForm');
      if (form) form.addEventListener('submit', startLoader);
    });
  </script>`;
}

function renderReportSection(title: string, body: string, open = false): string {
  return `<details class="report-section" ${open ? "open" : ""}>
    <summary>${escapeHtml(title)}</summary>
    <div class="report-section-body">${body}</div>
  </details>`;
}

function renderMetricCard(label: string, value: string, hint: string): string {
  return `<div class="metric-card">
    <span class="metric-label">${escapeHtml(label)}</span>
    <strong class="metric-value">${escapeHtml(value)}</strong>
    <span class="metric-hint">${escapeHtml(hint)}</span>
  </div>`;
}

function renderCompanyMetrics(competitor: CompetitorAnalysis, isFinancial: boolean): string {
  const finance = competitor.financialSnapshot;
  if (isFinancial && finance) {
    return `<div class="metric-grid">
      ${renderMetricCard("Ticker", finance.stockSymbol ?? "—", "Stock symbol from Yahoo Finance / SERP")}
      ${renderMetricCard("Share price", finance.priceUsd ? formatStockPrice(finance.priceUsd) : (finance.stockPrice ?? "—"), "Latest price mention from live finance sources")}
      ${renderMetricCard("Market cap", finance.marketCapUsd ? formatUsd(finance.marketCapUsd) : (finance.marketCap ?? "—"), "Estimated total market value")}
      ${renderMetricCard("Web pages scraped", String(competitor.pages.length), "Official site pages analyzed (pricing, blog, careers)")}
      ${renderMetricCard("Finance articles", String(finance.financeSources.length), "Google / Yahoo finance results reviewed")}
      ${renderMetricCard("Intelligence signals", String(competitor.signals.length), "Structured findings extracted from pages and search")}
    </div>`;
  }

  return `<div class="metric-grid">
    ${renderMetricCard("Web pages scraped", String(competitor.pages.length), "Live pages pulled via Bright Data Web Unlocker")}
    ${renderMetricCard("Search results", String(competitor.searchResults.length), "Google results analyzed for this company")}
    ${renderMetricCard("Intelligence signals", String(competitor.signals.length), "Pricing, product, hiring and risk findings")}
    ${renderMetricCard("Pricing signals", String(metricCount(competitor, "pricing")), "Evidence about plans, tiers, free trial")}
    ${renderMetricCard("Product signals", String(metricCount(competitor, "product")), "Feature, AI, integration and positioning clues")}
    ${renderMetricCard("Hiring signals", String(metricCount(competitor, "hiring")), "Careers language or growth indicators")}
  </div>`;
}

function renderMarketCapChart(report: TrackerReport): string {
  const items = report.competitors
    .map((competitor) => ({
      name: competitor.name,
      cap: competitor.financialSnapshot?.marketCapUsd,
    }))
    .filter((item) => item.cap && item.cap > 0) as Array<{ name: string; cap: number }>;

  if (items.length < 2) {
    return `<p class="hint">Not enough comparable market-cap data yet to render a chart. Try financial mode with public companies that have Yahoo Finance coverage.</p>`;
  }

  const max = Math.max(...items.map((item) => item.cap));
  const rows = items.map((item, index) => {
    const width = Math.max(8, Math.round((item.cap / max) * 100));
    return `<div class="chart-row">
      <div>${escapeHtml(item.name)}</div>
      <div class="chart-bar-track"><div class="chart-bar-fill ${index % 2 ? "alt" : ""}" style="width:${width}%"></div></div>
      <div>${escapeHtml(formatUsd(item.cap))}</div>
    </div>`;
  }).join("");

  return `<div class="chart-wrap">
    <div class="chart-title">Market cap comparison (USD, from live finance sources)</div>
    ${rows}
  </div>`;
}

function renderPriceComparisonChart(report: TrackerReport): string {
  const items = report.competitors
    .map((competitor) => ({
      name: competitor.name,
      price: competitor.financialSnapshot?.priceUsd,
      symbol: competitor.financialSnapshot?.stockSymbol,
    }))
    .filter((item) => item.price && item.price > 0) as Array<{ name: string; price: number; symbol?: string }>;

  if (!items.length) {
    return `<p class="hint">No reliable share prices extracted yet. The app reads live Yahoo Finance / earnings SERP snippets — not a full trading terminal.</p>`;
  }

  const max = Math.max(...items.map((item) => item.price));
  const rows = items.map((item, index) => {
    const width = Math.max(8, Math.round((item.price / max) * 100));
    return `<div class="chart-row">
      <div>${escapeHtml(item.symbol ?? item.name)}</div>
      <div class="chart-bar-track"><div class="chart-bar-fill ${index % 2 ? "alt" : ""}" style="width:${width}%"></div></div>
      <div>${escapeHtml(formatStockPrice(item.price))}</div>
    </div>`;
  }).join("");

  return `<div class="chart-wrap">
    <div class="chart-title">Share price snapshot (USD, from live sources)</div>
    ${rows}
  </div>`;
}

function renderInvestorDashboard(report: TrackerReport): string {
  const primary = report.competitors[0];
  const cards = report.competitors.map((competitor) => {
    const finance = competitor.financialSnapshot;
    return `<div class="investor-card">
      <h3>${escapeHtml(competitor.name)}${finance?.stockSymbol ? ` · ${escapeHtml(finance.stockSymbol)}` : ""}</h3>
      <p class="investor-brief">${escapeHtml(finance?.investorBrief ?? competitor.summary.replace(/\*\*/g, ""))}</p>
      <div class="metric-grid">
        ${renderMetricCard("Share price", finance?.priceUsd ? formatStockPrice(finance.priceUsd) : "—", "Live price mention")}
        ${renderMetricCard("Market cap", finance?.marketCapUsd ? formatUsd(finance.marketCapUsd) : "—", "Estimated valuation")}
        ${renderMetricCard("Earnings", finance?.earningsSnippet ?? "—", "Latest EPS / revenue context from news")}
      </div>
    </div>`;
  }).join("");

  return `<div class="stack">
    ${primary ? `<div class="success"><strong>Investor view:</strong> focused on ${escapeHtml(primary.name)}${report.category.trim() ? ` in <em>${escapeHtml(report.category)}</em>` : ""} and auto-discovered peers.</div>` : ""}
    ${renderMarketCapChart(report)}
    ${renderPriceComparisonChart(report)}
    <div class="mini-grid">${cards}</div>
  </div>`;
}

function renderOverview(report: TrackerReport): string {
  const isFinancial = report.researchMode === "financial";
  const cards = report.competitors.map((competitor) => {
    const finance = competitor.financialSnapshot;
    const headline = isFinancial && finance?.investorBrief
      ? finance.investorBrief
      : competitor.summary.replace(/\*\*/g, "");
    return `<div class="mini-card">
      <h3>${escapeHtml(competitor.name)}${finance?.stockSymbol ? ` <span class="chip chip-green">${escapeHtml(finance.stockSymbol)}</span>` : ""}</h3>
      <p>${escapeHtml(headline)}</p>
      ${renderCompanyMetrics(competitor, isFinancial)}
    </div>`;
  }).join("");

  const insights = report.crossCompetitorInsights.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const recommendations = report.strategicRecommendations.map((item) => `<li>${escapeHtml(item)}</li>`).join("");

  const investorBlock = isFinancial ? renderInvestorDashboard(report) : "";

  return `${investorBlock}
    <div class="panel-grid">
      <div class="card"><h2>${isFinancial ? "Company snapshots" : "Competitor overview"}</h2><div class="mini-grid">${cards}</div></div>
      <div class="card"><h2>What this means</h2><ul>${insights}</ul><h2>Recommended next steps</h2><ul>${recommendations}</ul></div>
    </div>`;
}

function renderComparison(report: TrackerReport): string {
  const isFinancial = report.researchMode === "financial";
  const rows = report.competitors.map((competitor) => {
    const finance = competitor.financialSnapshot;
    if (isFinancial) {
      return `<tr>
        <td>${escapeHtml(competitor.name)}</td>
        <td>${escapeHtml(finance?.stockSymbol ?? "—")}</td>
        <td>${finance?.priceUsd ? escapeHtml(formatStockPrice(finance.priceUsd)) : escapeHtml(finance?.stockPrice ?? "—")}</td>
        <td>${finance?.marketCapUsd ? escapeHtml(formatUsd(finance.marketCapUsd)) : escapeHtml(finance?.marketCap ?? "—")}</td>
        <td>${escapeHtml(finance?.earningsSnippet ?? "—")}</td>
        <td>${competitor.pages.length}</td>
        <td>${competitor.signals.length}</td>
      </tr>`;
    }
    return `<tr>
      <td>${escapeHtml(competitor.name)}</td>
      <td>${competitor.pages.length}</td>
      <td>${competitor.searchResults.length}</td>
      <td>${competitor.signals.length}</td>
      <td>${metricCount(competitor, "pricing")}</td>
      <td>${metricCount(competitor, "product")}</td>
      <td>${metricCount(competitor, "hiring")}</td>
    </tr>`;
  }).join("");

  const tableHead = isFinancial
    ? `<thead><tr><th>Company</th><th>Ticker</th><th>Share price</th><th>Market cap</th><th>Earnings context</th><th>Pages scraped</th><th>Signals</th></tr></thead>`
    : `<thead><tr><th>Company</th><th>Pages scraped</th><th>Search hits</th><th>Signals</th><th>Pricing</th><th>Product</th><th>Hiring</th></tr></thead>`;

  const chart = isFinancial
    ? `${renderMarketCapChart(report)}${renderPriceComparisonChart(report)}`
    : report.competitors.map((competitor) => {
        const total = competitor.signals.length || 1;
        return `<div class="chart-row">
          <div>${escapeHtml(competitor.name)}</div>
          <div class="chart-bar-track"><div class="chart-bar-fill" style="width:${Math.min(100, total * 12)}%"></div></div>
          <div>${total} signals</div>
        </div>`;
      }).join("");

  return `<div class="panel-grid">
    <div class="card">
      <h2>${isFinancial ? "Financial comparison" : "Side-by-side comparison"}</h2>
      <table>${tableHead}<tbody>${rows}</tbody></table>
    </div>
    <div class="card"><h2>${isFinancial ? "Valuation charts" : "Signal volume"}</h2>${chart}</div>
  </div>`;
}

function renderSignalBreakdown(report: TrackerReport): string {
  const categoryLabels: Record<string, string> = {
    pricing: "Pricing",
    product: "Product",
    hiring: "Hiring",
    positioning: "Positioning",
    risk: "Risk",
  };
  const categories = ["pricing", "product", "hiring", "positioning", "risk"] as const;
  const rows = report.competitors.map((competitor) => {
    const bars = categories.map((category) => {
      const count = metricCount(competitor, category);
      return `<div class="chart-row">
        <div>${categoryLabels[category]}</div>
        <div class="chart-bar-track"><div class="chart-bar-fill" style="width:${Math.min(100, count * 28)}%"></div></div>
        <div>${count}</div>
      </div>`;
    }).join("");

    const signals = competitor.signals.slice(0, 8).map((signal) =>
      `<li><strong>${escapeHtml(signal.title)}</strong> <span class="chip">${escapeHtml(categoryLabels[signal.category] ?? signal.category)}</span><br />${escapeHtml(signal.detail.slice(0, 220))}${signal.detail.length > 220 ? "…" : ""}</li>`
    ).join("");

    return `<div class="card">
      <h2>${escapeHtml(competitor.name)}</h2>
      ${bars}
      <h3>Key findings</h3>
      <ul class="signal-list">${signals || "<li>No structured findings yet — try market or reviews mode, or add more source URLs.</li>"}</ul>
    </div>`;
  }).join("");

  return `<div class="stack">${rows}</div>`;
}

function renderFinance(report: TrackerReport): string {
  return `<div class="stack">${report.competitors.map((competitor) => {
    const finance = competitor.financialSnapshot;
    if (!finance) {
      return `<div class="card"><h2>${escapeHtml(competitor.name)}</h2><p class="hint">No finance data found for this company in the current run.</p></div>`;
    }
    const sources = finance.financeSources.slice(0, 5).map((source) =>
      `<li><a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.title)}</a>${source.description ? ` — ${escapeHtml(source.description.slice(0, 120))}…` : ""}</li>`
    ).join("");
    return `<div class="investor-card">
      <h2>${escapeHtml(competitor.name)}${finance.stockSymbol ? ` · ${escapeHtml(finance.stockSymbol)}` : ""}</h2>
      <p class="investor-brief">${escapeHtml(finance.investorBrief ?? "No investor summary available.")}</p>
      <div class="metric-grid">
        ${renderMetricCard("Share price", finance.priceUsd ? formatStockPrice(finance.priceUsd) : (finance.stockPrice ?? "—"), "USD, from live finance sources")}
        ${renderMetricCard("Market cap", finance.marketCapUsd ? formatUsd(finance.marketCapUsd) : (finance.marketCap ?? "—"), "Estimated market value")}
        ${renderMetricCard("Earnings", finance.earningsSnippet ?? "—", "EPS / revenue mentions from earnings news")}
      </div>
      <h3>Finance sources used</h3>
      <ul>${sources || "<li>No finance sources captured</li>"}</ul>
    </div>`;
  }).join("")}</div>`;
}

function renderSerp(report: TrackerReport): string {
  return `<div class="stack">${report.competitors.map((competitor) => {
    const rows = competitor.searchResults.slice(0, 6).map((item) => `<tr>
      <td><a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.title)}</a></td>
      <td>${escapeHtml(item.description ?? "-")}</td>
    </tr>`).join("");
    const social = (competitor.socialHighlights ?? []).slice(0, 4).map((item) =>
      `<li><a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.title)}</a></li>`
    ).join("");
    return `<div class="card">
      <h2>${escapeHtml(competitor.name)} SERP</h2>
      <table><thead><tr><th>Result</th><th>Description</th></tr></thead><tbody>${rows}</tbody></table>
      <h3>Social highlights</h3>
      <ul>${social || "<li>No strong social SERP matches yet.</li>"}</ul>
    </div>`;
  }).join("")}</div>`;
}

function renderNewsReviews(report: TrackerReport): string {
  const cards = report.competitors.map((competitor) => {
    const newsLike = (competitor.reviewHighlights?.length ? competitor.reviewHighlights : competitor.searchResults).filter((item) => {
      const hay = `${item.title} ${item.description ?? ""}`.toLowerCase();
      return /(news|review|reddit|g2|capterra|launch|update|announcement|complaint)/.test(hay);
    });

    const rows = newsLike.slice(0, 8).map((item) => {
      const tone =
        /complaint|issue|problem|negative/i.test(`${item.title} ${item.description ?? ""}`) ? "Negative / risk" :
        /review|comparison|vs|rating/i.test(`${item.title} ${item.description ?? ""}`) ? "Review / comparison" :
        "News / update";

      return `<tr>
        <td><a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.title)}</a></td>
        <td>${escapeHtml(tone)}</td>
        <td>${escapeHtml(item.description ?? "-")}</td>
      </tr>`;
    }).join("");

    return `<div class="card">
      <h2>${escapeHtml(competitor.name)} news / reviews</h2>
      <table>
        <thead><tr><th>Item</th><th>Type</th><th>Context</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="3">No strong news/review SERP matches yet for this mode.</td></tr>`}</tbody>
      </table>
    </div>`;
  }).join("");

  return `<div class="stack">${cards}</div>`;
}

function renderSources(report: TrackerReport): string {
  return `<div class="stack">${report.competitors.map((competitor) => {
    const pages = competitor.pages.map((page) => `<li><strong>${escapeHtml(page.pageType)}</strong> — <a href="${escapeHtml(page.url)}" target="_blank" rel="noreferrer">${escapeHtml(page.url)}</a></li>`).join("");
    return `<div class="card"><h2>${escapeHtml(competitor.name)} sources</h2><ul>${pages}</ul></div>`;
  }).join("")}</div>`;
}

function renderResults(report: TrackerReport, markdown: string, downloadId: string): string {
  const isFinancial = report.researchMode === "financial";
  const generated = new Date(report.generatedAt).toLocaleString();
  const modeLabel = report.researchMode ?? "market";

  const metaBits = [
    report.autoDiscoveredCompetitors?.length
      ? `Auto-discovered peers: ${escapeHtml(report.autoDiscoveredCompetitors.join(", "))}`
      : "",
    report.selectedSources?.length
      ? `Bright Data routing: ${escapeHtml(report.selectedSources.slice(0, 6).join(" · "))}`
      : "",
  ].filter(Boolean).join(" · ");

  const header = `<div class="results-header">
    <div class="results-meta">
      <h2>Analysis results</h2>
      <p><strong>Mode:</strong> ${escapeHtml(modeLabel)}${report.category.trim() ? ` · <strong>Category:</strong> ${escapeHtml(report.category)}` : ""} · <strong>Generated:</strong> ${escapeHtml(generated)}</p>
      ${metaBits ? `<p>${metaBits}</p>` : ""}
    </div>
    <div class="download-toolbar">
      <a class="dl-btn" href="/download/${downloadId}.md">↓ Download Markdown report</a>
      <a class="dl-btn secondary" href="/download/${downloadId}.json">↓ Download JSON data</a>
      <a class="dl-btn ghost" href="/search">↻ Run new search</a>
    </div>
  </div>`;

  const sections = [
    renderReportSection(isFinancial ? "Investor dashboard" : "Executive summary", renderOverview(report), true),
    renderReportSection(isFinancial ? "Financial comparison & charts" : "Comparison & charts", renderComparison(report), isFinancial),
    renderReportSection("Signals & findings", renderSignalBreakdown(report)),
    ...(isFinancial ? [renderReportSection("Financial detail", renderFinance(report), true)] : []),
    renderReportSection("Google / search evidence", renderSerp(report)),
    renderReportSection("News & reviews", renderNewsReviews(report)),
    renderReportSection("Source pages scraped", renderSources(report)),
    renderReportSection("Full markdown export", `<pre>${escapeHtml(markdown)}</pre>`),
  ].join("");

  return `${header}${sections}`;
}

function renderSearchForm(competitors: string, researchMode: string, analysisSize: string, maxCompetitors: string): string {
  const options = Object.entries(MODE_DESCRIPTIONS).map(([value, description]) => {
    const labels: Record<string, string> = {
      market: "Market & competitors",
      financial: "Financial & stock",
      social: "Social presence",
      hiring: "Hiring & growth",
      reviews: "Reviews & reputation",
    };
    return `<option value="${value}" ${researchMode === value ? "selected" : ""}>${labels[value] ?? value}</option>`;
  }).join("");
  const sizeOptions = Object.entries(SIZE_DESCRIPTIONS).map(([value, description]) =>
    `<option value="${value}" ${analysisSize === value ? "selected" : ""}>${value === "small" ? "Small / fast" : "Large / deep"}</option>`
  ).join("");

  const initialHint = escapeHtml(MODE_DESCRIPTIONS[researchMode] ?? "");
  const initialSizeHint = escapeHtml(SIZE_DESCRIPTIONS[analysisSize] ?? "");
  const initialSizeEstimate = escapeHtml(SIZE_ESTIMATES[analysisSize] ?? "");
  const competitorOptions = [
    ["1", "1 company only"],
    ["2", "Up to 2 companies"],
    ["3", "Up to 3 companies"],
    ["4", "Up to 4 companies"],
  ].map(([value, label]) => `<option value="${value}" ${maxCompetitors === value ? "selected" : ""}>${label}</option>`).join("");
  const initialCompetitorHint = escapeHtml(COMPETITOR_COUNT_HINTS[maxCompetitors] ?? "");

  return `<form method="post" action="/search" id="searchForm">
    <div class="field">
      <label for="competitors">Company name</label>
      <input id="competitors" name="competitors" value="${escapeHtml(competitors)}" placeholder="Apple" />
      <div class="hint"><strong>One company is enough.</strong> Enter e.g. <em>Apple</em> or <em>Notion</em> — we auto-discover competitors for you. You can also list several names separated by commas.</div>
    </div>
    <div class="field">
      <label for="researchMode">What do you want to learn?</label>
      <select id="researchMode" name="researchMode" onchange="updateModeHint()">
        ${options}
      </select>
      <div id="modeHint" class="mode-explainer">${initialHint}</div>
      <div class="hint">Not sure which one to pick? <a href="/about#mode-guide">See how each research type works</a>.</div>
    </div>
    <div class="field">
      <label for="analysisSize">Research depth</label>
      <select id="analysisSize" name="analysisSize" onchange="updateSizeHint()">
        ${sizeOptions}
      </select>
      <div id="sizeHint" class="mode-explainer">${initialSizeHint}</div>
      <div class="inline-note">
        <div class="hint">Choose <strong>Small / fast</strong> for a quick answer, or <strong>Large / deep</strong> when you want more source coverage.</div>
        <div class="hint"><strong>Expected time:</strong> <span id="sizeEstimate">${initialSizeEstimate}</span></div>
      </div>
    </div>
    <div class="field">
      <label for="maxCompetitors">How many companies should we analyze?</label>
      <select id="maxCompetitors" name="maxCompetitors" onchange="updateCompetitorCountHint()">
        ${competitorOptions}
      </select>
      <div id="competitorCountHint" class="mode-explainer">${initialCompetitorHint}</div>
      <div class="hint">More competitors = more search + more scraping + more waiting time. If you only want Apple, choose <strong>1 company only</strong>.</div>
    </div>
    <button type="submit">Run live analysis</button>
  </form>`;
}

function renderInformativeHome(): string {
  return pageTemplate(`
    <section class="hero">
      <h1>Company intelligence from live web data.</h1>
      <p>Discover competitors, collect evidence across search and official pages, and export a structured report — powered by Bright Data search, Web Unlocker, and structured pipelines.</p>
      <div class="chips" style="margin-top:14px">
        <span class="chip">Market &amp; reviews</span>
        <span class="chip">Hiring &amp; social</span>
        <span class="chip">SERP + page scraping</span>
        <span class="chip">Markdown &amp; JSON export</span>
      </div>
      <div class="cta-row">
        <a class="cta nav-cta" href="/search" style="display:inline-block">Run live search</a>
        <a class="cta" href="/about">How it works</a>
      </div>
    </section>
    <section class="feature-grid">
      <div class="feature-card">
        <h2>One company → full landscape</h2>
        <p>Enter a single company and the platform infers likely competitors, then researches each with the same pipeline.</p>
      </div>
      <div class="feature-card">
        <h2>Mode-aware Bright Data routing</h2>
        <p>Market, reviews, social, and hiring modes use the right mix of SERP, official pages, and structured scrapers like LinkedIn and Crunchbase.</p>
      </div>
      <div class="feature-card">
        <h2>Evidence you can export</h2>
        <p>Every run produces a multi-tab dashboard plus downloadable Markdown and JSON for decks, docs, or further analysis.</p>
      </div>
    </section>
    <section class="hero-strip" style="margin-top:24px">
      <div class="hero-metric"><span>Best demos</span><strong>Notion · Slack · Figma</strong></div>
      <div class="hero-metric"><span>Pipeline</span><strong>Discover → scrape → signals</strong></div>
      <div class="hero-metric"><span>Sources</span><strong>Google · LinkedIn · official sites</strong></div>
      <div class="hero-metric"><span>Output</span><strong>Dashboard + downloads</strong></div>
    </section>
    <section class="card" style="margin-top:24px">
      <h2>How a run works</h2>
      <ol>
        <li>Enter <strong>one company</strong> (e.g. Apple) on the <a href="/search">search page</a> — competitors are inferred automatically.</li>
        <li>Choose <strong>what you want to learn</strong> (market, financial, reviews…).</li>
        <li>Bright Data discovers sources and scrapes live pages.</li>
        <li>Signals are extracted and synthesized into a report.</li>
        <li>Explore tabs or download the full output.</li>
      </ol>
    </section>
  `, "Company Intelligence Platform", { stickyCta: true });
}

function renderSearchPage(initial?: {
  competitors?: string;
  researchMode?: string;
  analysisSize?: string;
  maxCompetitors?: string;
  report?: TrackerReport;
  markdown?: string;
  error?: string;
  downloadId?: string;
}): string {
  const competitors = initial?.competitors ?? "Apple";
  const researchMode = initial?.researchMode ?? "market";
  const analysisSize = initial?.analysisSize ?? "small";
  const maxCompetitors = initial?.maxCompetitors ?? "1";
  const resultSection = initial?.report && initial?.markdown && initial?.downloadId
    ? renderResults(initial.report, initial.markdown, initial.downloadId)
    : initial?.error
      ? `<div class="error"><strong>Analysis failed.</strong><br />${escapeHtml(initial.error)}</div>`
      : `<div class="card empty">
           <h2 style="margin-top:0">Ready when you are</h2>
           <p>Fill the form above and run a live analysis. Results appear here with tabs, charts, and download links.</p>
         </div>`;

  return pageTemplate(`
    <section class="hero" style="padding-bottom:18px">
      <h1>Run a live company search</h1>
      <p>Type one company — we find the competitors. Pick what you want to learn; Bright Data does the rest.</p>
    </section>
    <div class="search-layout">
      <div class="card">
        <h2>Search parameters</h2>
        ${renderSearchForm(competitors, researchMode, analysisSize, maxCompetitors)}
      </div>
      ${renderPresetAccordion()}
      <div>${resultSection}</div>
    </div>
    <div id="loaderOverlay" class="loader-overlay" aria-live="polite" aria-busy="true">
      <div class="loader-card">
        <div class="loader-head">
          <div class="loader-orb"></div>
          <div>
            <strong>Running live Bright Data research</strong>
            <div class="hint">This can take longer in large mode because we search, discover pages, scrape them, and synthesize the report.</div>
          </div>
        </div>
        <div class="loader-bar"><div class="loader-bar-fill"></div></div>
        <div class="loader-steps">
          <div class="loader-step active">Discovering competitors and web sources</div>
          <div class="loader-step">Searching live results and official pages</div>
          <div class="loader-step">Scraping content and extracting signals</div>
          <div class="loader-step">Building charts, report, and downloads</div>
        </div>
      </div>
    </div>
    ${presetScript()}
  `, "Run live search");
}

function renderSourcesTable(): string {
  const rows = [
    ["Market & competitors", "You want pricing, product pages, positioning and likely competitors", "google.com, official sites, linkedin.com, crunchbase.com", "SERP + page scrape + LinkedIn/Crunchbase pipelines", "Strong"],
    ["Reviews & reputation", "You want customer sentiment, complaints, comparisons and review sites", "google.com, reddit.com, g2.com", "SERP + review-oriented queries + page scrape", "Strong"],
    ["Social presence", "You want to see visibility across public channels", "linkedin.com, x.com, youtube.com", "SERP + linkedin_posts / x_posts pipelines", "Strong"],
    ["Hiring & growth", "You want job openings and expansion signals", "linkedin.com, glassdoor.com, careers pages", "SERP + linkedin_job_listings pipeline", "Strong"],
    ["Financial & stock", "You want price, market cap, earnings and investor context", "finance.yahoo.com, investor pages", "SERP + yahoo_finance_business pipeline", "Partial"],
  ].map(([mode, bestWhen, domains, usage, level]) =>
    `<tr><td><strong>${escapeHtml(mode)}</strong></td><td>${escapeHtml(bestWhen)}</td><td>${escapeHtml(domains)}</td><td>${escapeHtml(usage)}</td><td>${escapeHtml(level)}</td></tr>`
  ).join("");

  return `<div class="card">
    <h2>Which research type should I choose?</h2>
    <p class="hint">Use this guide to choose the right research type before running the search. Each row maps a user goal to the Bright Data routing used behind the scenes.</p>
    <table>
      <thead><tr><th>Research type</th><th>Best when...</th><th>Main sources</th><th>Bright Data routing</th><th>Support</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

function renderAbout(): string {
  return pageTemplate(`
    <section class="hero">
      <h1>How it works</h1>
      <p>Enter <strong>one company</strong> — we find competitors automatically. Pick what you want to learn; Bright Data routes the right searches and scrapers.</p>
      <div class="cta-row">
        <a class="cta nav-cta" href="/search" style="display:inline-block">Run live search</a>
      </div>
    </section>
    <div class="panel-grid">
      <div class="card" id="mode-guide">
        <h2>What do you want to learn?</h2>
        <ul>
          <li><strong>Market &amp; competitors:</strong> pricing, product pages, positioning — default for competitive research.</li>
          <li><strong>Financial &amp; stock:</strong> share price, market cap, earnings — best with one public company (e.g. Apple).</li>
          <li><strong>Social presence:</strong> LinkedIn, X, YouTube visibility.</li>
          <li><strong>Hiring &amp; growth:</strong> careers pages and job listings.</li>
          <li><strong>Reviews &amp; reputation:</strong> G2, Reddit, customer sentiment.</li>
        </ul>
      </div>
      <div class="card">
        <h2>Pipeline steps</h2>
        <ol>
          <li>You enter a company name (one is enough)</li>
          <li>Bright Data SERP via <code>bdata search</code></li>
          <li>Official page discovery and Web Unlocker scrape</li>
          <li>Structured pipeline calls where URLs match (LinkedIn, Crunchbase, Yahoo Finance)</li>
          <li>Signal extraction and report synthesis</li>
        </ol>
      </div>
    </div>
    ${renderSourcesTable()}
  `, "How it works", { stickyCta: true });
}

async function readBody(req: AsyncIterable<Buffer>): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

function parseForm(body: string): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(body).entries());
}

const server = createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(renderInformativeHome());
    return;
  }

  if (req.method === "GET" && req.url === "/search") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(renderSearchPage());
    return;
  }

  if (req.method === "GET" && req.url === "/about") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(renderAbout());
    return;
  }

  if (req.method === "GET" && req.url?.startsWith("/download/")) {
    const match = req.url.match(/^\/download\/([a-z0-9-]+)\.(md|json)$/i);
    if (!match) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    const [, id, ext] = match;
    const entry = downloads.get(id);
    if (!entry) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("Download expired");
      return;
    }
    if (ext === "md") {
      res.writeHead(200, {
        "content-type": "text/markdown; charset=utf-8",
        "content-disposition": `attachment; filename="competitor-launch-tracker-${id}.md"`,
      });
      res.end(entry.markdown);
      return;
    }
    res.writeHead(200, {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="competitor-launch-tracker-${id}.json"`,
    });
    res.end(JSON.stringify(entry.report, null, 2));
    return;
  }

  const handleSearch = async (form: Record<string, string>) => {
    const competitors = (form.competitors ?? "").split(",").map((item) => item.trim()).filter(Boolean);
    const category = (form.category ?? "").trim();
    const researchMode = (form.researchMode ?? "market").trim();
    const analysisSize = (form.analysisSize ?? "small").trim();
    const maxCompetitors = Math.max(1, Number(form.maxCompetitors ?? (analysisSize === "small" ? 1 : 3)));
    if (competitors.length < 1) throw new Error("Enter at least one company or competitor.");

    const { markdown, report } = await runAnalysisDetailed({
      competitors,
      category,
      researchMode: researchMode as never,
      analysisSize: analysisSize as never,
      maxCompetitors,
      logger: {
        log: (...args) => console.log("[web]", ...args),
        warn: (...args) => console.warn("[web]", ...args),
      },
    });

    const downloadId = randomUUID();
    downloads.set(downloadId, { markdown, report });

    return {
      competitors: competitors.join(", "),
      researchMode,
      analysisSize,
      maxCompetitors: String(maxCompetitors),
      report,
      markdown,
      downloadId,
    };
  };

  if (req.method === "POST" && (req.url === "/search" || req.url === "/analyze")) {
    try {
      const form = parseForm(await readBody(req));
      const result = await handleSearch(form);
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(renderSearchPage(result));
      return;
    } catch (error) {
      res.writeHead(500, { "content-type": "text/html; charset=utf-8" });
      res.end(renderSearchPage({
        competitors: "Apple",
        researchMode: "market",
        analysisSize: "small",
        maxCompetitors: "1",
        error: error instanceof Error ? error.message : String(error),
      }));
      return;
    }
  }

  res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`Competitor Launch Tracker web app running at http://localhost:${PORT}`);
});
