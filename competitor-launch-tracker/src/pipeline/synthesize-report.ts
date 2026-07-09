import type { CompetitorAnalysis, ResearchMode, TrackerReport } from "../types.js";

function formatSignalsTable(analyses: CompetitorAnalysis[]): string {
  const lines = ["| Competitor | Pricing | Product | Hiring |", "|------------|---------|---------|--------|"];
  for (const a of analyses) {
    const count = (cat: string) => a.signals.filter((s) => s.category === cat).length;
    lines.push(`| ${a.name} | ${count("pricing")} | ${count("product")} | ${count("hiring")} |`);
  }
  return lines.join("\n");
}

function crossInsights(analyses: CompetitorAnalysis[]): string[] {
  const insights: string[] = [];
  const withCap = analyses.filter((a) => a.financialSnapshot?.marketCapUsd);
  if (withCap.length >= 2) {
    const sorted = [...withCap].sort(
      (a, b) => (b.financialSnapshot!.marketCapUsd ?? 0) - (a.financialSnapshot!.marketCapUsd ?? 0)
    );
    const leader = sorted[0];
    const lagger = sorted[sorted.length - 1];
    insights.push(
      `Largest market cap in this set: ${leader.name} (${leader.financialSnapshot!.marketCapUsd! >= 1e12 ? `$${(leader.financialSnapshot!.marketCapUsd! / 1e12).toFixed(2)}T` : `$${(leader.financialSnapshot!.marketCapUsd! / 1e9).toFixed(2)}B`}). Smallest: ${lagger.name}.`
    );
  }

  const withEarnings = analyses.filter((a) => a.financialSnapshot?.earningsSnippet);
  if (withEarnings.length) {
    insights.push(
      `Recent earnings context available for: ${withEarnings.map((a) => `${a.name} (${a.financialSnapshot!.earningsSnippet})`).join("; ")}.`
    );
  }

  const allProduct = analyses.flatMap((a) =>
    a.signals.filter((s) => s.category === "product").map((s) => ({ name: a.name, s }))
  );
  const aiPlayers = [...new Set(allProduct.filter((p) => /AI/i.test(p.s.title)).map((p) => p.name))];
  if (aiPlayers.length >= 2) {
    insights.push(`AI positioning is crowded: ${aiPlayers.join(", ")} all emphasize AI-related capabilities.`);
  } else if (aiPlayers.length === 1) {
    insights.push(`${aiPlayers[0]} leads on explicit AI messaging — differentiation opportunity for others.`);
  }

  const withFree = analyses.filter((a) =>
    a.signals.some((s) => s.category === "pricing" && /free tier/i.test(s.detail))
  );
  if (withFree.length) {
    insights.push(`Free tier present for: ${withFree.map((a) => a.name).join(", ")}.`);
  }

  const hiring = analyses.filter((a) => a.signals.some((s) => s.category === "hiring"));
  if (hiring.length) {
    insights.push(`Hiring signals at: ${hiring.map((a) => a.name).join(", ")} — likely investing in growth.`);
  }

  const listed = analyses.filter((a) => a.financialSnapshot?.stockSymbol || a.financialSnapshot?.stockPrice);
  if (listed.length) {
    insights.push(
      `Finance signals found for: ${listed
        .map((a) => `${a.name}${a.financialSnapshot?.stockSymbol ? ` (${a.financialSnapshot.stockSymbol})` : ""}`)
        .join(", ")}.`
    );
  }

  if (!insights.length) {
    insights.push("Run with more competitors or deeper page discovery for richer cross-market patterns.");
  }
  return insights;
}

function recommendations(analyses: CompetitorAnalysis[], category: string): string[] {
  const marketLabel = category.trim() || "this market";
  const recs: string[] = [
    `Double down on a wedge in **${marketLabel}** that incumbents under-serve (e.g. speed, pricing transparency, or vertical workflows).`,
  ];

  const weakPricing = analyses.filter((a) =>
    a.signals.some((s) => s.category === "risk" && /pricing visibility/i.test(s.title))
  );
  if (weakPricing.length) {
    recs.push(
      `Consider transparent pricing vs ${weakPricing.map((a) => a.name).join(", ")} — buyers in this space compare plans early.`
    );
  }

  const aiHeavy = analyses.filter((a) =>
    a.signals.some((s) => s.category === "product" && /AI/i.test(s.title))
  );
  if (aiHeavy.length >= 2) {
    recs.push("Avoid generic 'AI assistant' messaging; ship a concrete workflow (templates, automations, integrations).");
  } else {
    recs.push("AI is not saturated in scraped messaging — room to own 'intelligent workspace' narrative.");
  }

  recs.push("Re-run weekly with this tool to catch pricing and changelog moves within days of publication.");
  return recs.slice(0, 4);
}

export function synthesizeReport(
  category: string,
  analyses: CompetitorAnalysis[],
  autoDiscoveredCompetitors?: string[],
  researchMode?: ResearchMode,
  selectedSources?: string[]
): TrackerReport {
  return {
    generatedAt: new Date().toISOString(),
    category,
    competitors: analyses,
    crossCompetitorInsights: crossInsights(analyses),
    strategicRecommendations: recommendations(analyses, category),
    autoDiscoveredCompetitors,
    researchMode,
    selectedSources,
  };
}

export function renderReportMarkdown(report: TrackerReport): string {
  const lines: string[] = [
    "# Competitor Launch Tracker Report",
    "",
    `**Category:** ${report.category || "auto"}  `,
    `**Mode:** ${report.researchMode ?? "market"}  `,
    `**Generated:** ${report.generatedAt}  `,
    `**Data source:** Bright Data (Discover + SERP + Web Unlocker) — live web only`,
    "",
    "---",
    "",
    "## Executive summary",
    "",
    formatSignalsTable(report.competitors),
    "",
  ];

  if (report.autoDiscoveredCompetitors?.length) {
    lines.push(
      `**Auto-discovered competitors:** ${report.autoDiscoveredCompetitors.join(", ")}`,
      ""
    );
  }
  if (report.selectedSources?.length) {
    lines.push(`**Targeted Bright Data source families:** ${report.selectedSources.join(", ")}`, "");
  }

  for (const c of report.competitors) {
    lines.push(`## ${c.name}`, "", c.summary, "", "### Signals", "");
    if (!c.signals.length) {
      lines.push("_No signals extracted — check network or API quota._", "");
      continue;
    }
    for (const s of c.signals) {
      lines.push(
        `- **${s.title}** (${s.category}, ${s.confidence}) — ${s.detail} [source](${s.sourceUrl})`
      );
    }
    if (c.financialSnapshot) {
      lines.push("", "### Financial snapshot", "");
      if (c.financialSnapshot.stockSymbol) lines.push(`- Ticker: **${c.financialSnapshot.stockSymbol}**`);
      if (c.financialSnapshot.priceUsd) lines.push(`- Share price: **$${c.financialSnapshot.priceUsd.toFixed(2)}**`);
      else if (c.financialSnapshot.stockPrice) lines.push(`- Share price mention: ${c.financialSnapshot.stockPrice}`);
      if (c.financialSnapshot.marketCapUsd) {
        const cap = c.financialSnapshot.marketCapUsd;
        const capLabel = cap >= 1e12 ? `$${(cap / 1e12).toFixed(2)}T` : cap >= 1e9 ? `$${(cap / 1e9).toFixed(2)}B` : `$${cap}`;
        lines.push(`- Market cap: **${capLabel}**`);
      } else if (c.financialSnapshot.marketCap) {
        lines.push(`- Market cap mention: ${c.financialSnapshot.marketCap}`);
      }
      if (c.financialSnapshot.earningsSnippet) lines.push(`- Earnings: ${c.financialSnapshot.earningsSnippet}`);
      if (c.financialSnapshot.investorBrief) lines.push(`- Investor brief: ${c.financialSnapshot.investorBrief}`);
      for (const item of c.financialSnapshot.financeSources.slice(0, 3)) {
        lines.push(`- Finance source: [${item.title}](${item.url})`);
      }
    }
    lines.push("", "### Google SERP context", "");
    for (const item of c.searchResults.slice(0, 5)) {
      lines.push(`- [${item.title}](${item.url})${item.description ? ` — ${item.description}` : ""}`);
    }
    lines.push("", "### Pages analyzed", "");
    for (const p of c.pages) {
      lines.push(`- \`${p.pageType}\` — ${p.url}`);
    }
    lines.push("");
  }

  lines.push("## Cross-competitor insights", "");
  for (const i of report.crossCompetitorInsights) lines.push(`- ${i}`);
  lines.push("", "## Strategic recommendations", "");
  for (const r of report.strategicRecommendations) lines.push(`- ${r}`);

  lines.push(
    "",
    "---",
    "",
    "_Built for Bright Data hackathon — Competitor Launch Tracker_"
  );

  return lines.join("\n");
}
