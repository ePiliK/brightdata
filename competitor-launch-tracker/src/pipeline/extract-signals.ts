import type { ScrapedPage, SearchResult, Signal } from "../types.js";

const PRICING_PATTERNS = [
  /\$[\d,]+(?:\.\d{2})?/g,
  /\bfree\b/gi,
  /\benterprise\b/gi,
  /\bper user\b/gi,
  /\bper month\b/gi,
  /\bannual\b/gi,
];

const PRODUCT_PATTERNS: { label: string; re: RegExp }[] = [
  { label: "AI features", re: /\b(AI|artificial intelligence|GPT|copilot|assistant)\b/gi },
  { label: "Automation", re: /\b(automation|automate|workflow)\b/gi },
  { label: "Integrations", re: /\b(integration|API|Slack|Zapier)\b/gi },
  { label: "Collaboration", re: /\b(collaborat|team|workspace|docs)\b/gi },
];

const HIRING_PATTERNS = [
  /\b(hiring|open roles|join our team|careers)\b/gi,
  /\b(engineer|product manager|sales|marketing)\b/gi,
];

function countMatches(text: string, patterns: RegExp[]): number {
  let n = 0;
  for (const re of patterns) {
    const m = text.match(re);
    if (m) n += m.length;
  }
  return n;
}

function excerptAround(text: string, index: number, len = 120): string {
  const start = Math.max(0, index - 40);
  return text.slice(start, start + len).replace(/\s+/g, " ").trim();
}

export function extractSignals(
  competitorName: string,
  pages: ScrapedPage[],
  searchResults: SearchResult[] = []
): Signal[] {
  const signals: Signal[] = [];
  const allText = pages.map((p) => p.markdown).join("\n");

  for (const page of pages) {
    const text = page.markdown;

    if (page.pageType === "pricing" || /\$|pricing|plan/i.test(text.slice(0, 2000))) {
      const prices = [...new Set(text.match(/\$[\d,]+(?:\.\d{2})?/g) ?? [])].slice(0, 5);
      const hasFree = /\bfree\b/i.test(text);
      const hasEnterprise = /\benterprise\b/i.test(text);
      signals.push({
        category: "pricing",
        title: "Pricing structure detected",
        detail: [
          prices.length ? `Price points: ${prices.join(", ")}` : "Tiered pricing page found",
          hasFree ? "Offers free tier" : "No explicit free tier in scraped content",
          hasEnterprise ? "Enterprise tier mentioned" : "",
        ]
          .filter(Boolean)
          .join(". "),
        sourceUrl: page.url,
        confidence: page.pageType === "pricing" ? "high" : "medium",
      });
    }

    for (const { label, re } of PRODUCT_PATTERNS) {
      const match = re.exec(text);
      if (match) {
        signals.push({
          category: "product",
          title: `${label} emphasis`,
          detail: excerptAround(text, match.index),
          sourceUrl: page.url,
          confidence: "medium",
        });
      }
      re.lastIndex = 0;
    }

    if (page.pageType === "careers" || countMatches(text, HIRING_PATTERNS) >= 3) {
      signals.push({
        category: "hiring",
        title: "Active hiring / growth signal",
        detail: "Careers or hiring language detected — possible expansion in product or GTM.",
        sourceUrl: page.url,
        confidence: page.pageType === "careers" ? "high" : "medium",
      });
    }
  }

  const positioningIdx = allText.search(/\b(for teams|for everyone|all-in-one|workspace|productivity)\b/i);
  if (positioningIdx >= 0) {
    const home = pages.find((p) => p.pageType === "homepage") ?? pages[0];
    signals.push({
      category: "positioning",
      title: "Market positioning",
      detail: excerptAround(allText, positioningIdx),
      sourceUrl: home?.url ?? pages[0]?.url ?? "",
      confidence: "medium",
    });
  }

  if (countMatches(allText, PRICING_PATTERNS) === 0 && pages.length > 0) {
    signals.push({
      category: "risk",
      title: "Limited pricing visibility",
      detail: `${competitorName}: pricing signals weak in scraped pages — may use sales-led GTM.`,
      sourceUrl: pages.find((p) => p.pageType === "pricing")?.url ?? pages[0].url,
      confidence: "low",
    });
  }

  for (const item of searchResults) {
    const hay = `${item.title} ${item.description ?? ""} ${item.url}`.toLowerCase();
    if (/(reddit|g2|capterra|review|comparison|vs)/.test(hay)) {
      signals.push({
        category: "positioning",
        title: "External review / comparison coverage",
        detail: `${item.title}${item.description ? ` — ${item.description}` : ""}`,
        sourceUrl: item.url,
        confidence: "medium",
      });
    }
    if (/(linkedin|twitter|x\.com|instagram|youtube|tiktok|facebook)/.test(hay)) {
      signals.push({
        category: "product",
        title: "Social visibility signal",
        detail: `${item.title}${item.description ? ` — ${item.description}` : ""}`,
        sourceUrl: item.url,
        confidence: "low",
      });
    }
    if (/(complaint|issue|problem|lawsuit|negative)/.test(hay)) {
      signals.push({
        category: "risk",
        title: "Negative reputation signal",
        detail: `${item.title}${item.description ? ` — ${item.description}` : ""}`,
        sourceUrl: item.url,
        confidence: "medium",
      });
    }
  }

  const seen = new Set<string>();
  return signals.filter((s) => {
    const key = `${s.category}:${s.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function summarizeCompetitor(name: string, signals: Signal[]): string {
  const pricing = signals.filter((s) => s.category === "pricing");
  const product = signals.filter((s) => s.category === "product");
  const hiring = signals.filter((s) => s.category === "hiring");

  const parts: string[] = [`**${name}**`];
  if (pricing.length) parts.push(`Pricing: ${pricing[0].detail}`);
  if (product.length) parts.push(`Product focus: ${product.map((p) => p.title).join(", ")}`);
  if (hiring.length) parts.push("Shows hiring/growth activity.");
  if (parts.length === 1) parts.push("Limited live signals — expand URL discovery.");

  return parts.join(" · ");
}
