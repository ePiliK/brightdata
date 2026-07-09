import { searchGoogleJson, runPipelineViaCli, scrapeMarkdown, type BrightDataClient } from "../brightdata.js";
import {
  normalizeFinancialSnapshot,
  parseMarketCapUsd,
  parseStockPriceUsd,
} from "../finance-utils.js";
import type { FinancialSnapshot, ResearchMode, SearchResult, Signal } from "../types.js";
import { getResearchStrategy } from "./research-strategy.js";

const AUTO_COMPETITOR_MAP: Record<string, string[]> = {
  apple: ["Samsung", "Google", "Microsoft"],
  notion: ["Coda", "ClickUp", "Asana"],
  slack: ["Microsoft Teams", "Discord", "Google Chat"],
  salesforce: ["HubSpot", "Zoho", "Microsoft Dynamics"],
  spotify: ["Apple Music", "YouTube Music", "Amazon Music"],
};

const BRAND_CANDIDATES = [
  "Samsung",
  "Google",
  "Microsoft",
  "Amazon",
  "Meta",
  "Netflix",
  "Apple Music",
  "YouTube Music",
  "Coda",
  "ClickUp",
  "Asana",
  "Monday",
  "Slack",
  "Discord",
  "Microsoft Teams",
  "HubSpot",
  "Zoho",
  "Microsoft Dynamics",
  "Adobe",
  "Figma",
  "Canva",
  "Shopify",
  "BigCommerce",
  "HubSpot CRM",
  "Zendesk",
  "Intercom",
  "WhatsApp",
  "Telegram",
  "Google Workspace",
  "Perplexity",
  "OpenAI",
];

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}

function uniqueResults(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  return results.filter((item) => {
    if (!item.url || seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}

export async function gatherSerpResults(
  client: BrightDataClient,
  query: string,
  limit = 5
): Promise<SearchResult[]> {
  try {
    const data = await searchGoogleJson(client, query);
    return uniqueResults(
      (data.organic ?? [])
        .filter((row) => row.link && row.title)
        .slice(0, limit)
        .map((row) => ({
          title: row.title ?? row.link ?? "",
          url: row.link ?? "",
          description: row.description,
          source: row.source,
        }))
    );
  } catch {
    return [];
  }
}

export async function inferCompetitors(
  client: BrightDataClient,
  company: string,
  category?: string
): Promise<string[]> {
  const direct = AUTO_COMPETITOR_MAP[normalizeName(company)];
  if (direct) return direct;

  const scoped = category?.trim();
  const querySet = scoped
    ? [
        `${company} competitors ${scoped}`,
        `${company} alternatives ${scoped}`,
        `${company} vs competitors ${scoped}`,
      ]
    : [
        `${company} competitors`,
        `${company} alternatives`,
        `${company} vs`,
        `who competes with ${company}`,
      ];

  const results = uniqueResults(
    (await Promise.all(querySet.map((query) => gatherSerpResults(client, query, 8)))).flat()
  );

  const haystack = results
    .map((r) => `${r.title} ${r.description ?? ""}`)
    .join(" \n ")
    .toLowerCase();

  const picks = BRAND_CANDIDATES.filter((candidate) => {
    const normalized = candidate.toLowerCase();
    return normalized !== company.toLowerCase() && haystack.includes(normalized);
  });

  return picks.slice(0, 3);
}

export function classifySearchResult(item: SearchResult): {
  type: "news" | "review" | "social" | "finance" | "generic";
  sentiment: "positive" | "negative" | "neutral";
} {
  const hay = `${item.title} ${item.description ?? ""} ${item.url}`.toLowerCase();
  const type =
    /(reddit|g2|capterra|review|comparison|vs)/.test(hay) ? "review" :
    /(linkedin|twitter|x\.com|instagram|youtube|tiktok|facebook)/.test(hay) ? "social" :
    /(finance|yahoo finance|nasdaq|nyse|market cap|stock)/.test(hay) ? "finance" :
    /(news|launch|announcement|update|release)/.test(hay) ? "news" :
    "generic";

  const sentiment =
    /(complaint|issue|problem|drop|lawsuit|negative|bad)/.test(hay) ? "negative" :
    /(best|leader|top|award|growth|record|positive)/.test(hay) ? "positive" :
    "neutral";

  return { type, sentiment };
}

export async function gatherFinancialSnapshot(
  client: BrightDataClient,
  company: string
): Promise<FinancialSnapshot | undefined> {
  const financeQueries = [
    `${company} stock price market cap site:finance.yahoo.com`,
    `${company} earnings revenue EPS investor relations`,
    `${company} (AAPL OR stock) market cap nasdaq nyse`,
  ];

  const financeSources = uniqueResults(
    (await Promise.all(financeQueries.map((query) => gatherSerpResults(client, query, 6)))).flat()
  ).slice(0, 10);

  if (!financeSources.length) return undefined;

  const yahooUrl = financeSources.find((item) => /finance\.yahoo\.com\/quote\/[A-Z0-9.-]+/i.test(item.url))?.url;
  let yahooText = "";
  if (yahooUrl) {
    try {
      yahooText = await scrapeMarkdown(client, yahooUrl);
    } catch {
      /* SERP fallback */
    }
  }

  const text = [
    ...financeSources.map((item) => `${item.title} ${item.description ?? ""}`),
    yahooText.slice(0, 4000),
  ].join(" ");

  const stockSymbol =
    financeSources
      .map((item) => item.url.match(/finance\.yahoo\.com\/quote\/([A-Z0-9.-]+)/i)?.[1])
      .find(Boolean)
    ?? text.match(new RegExp(`${company.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^()]{0,30}\\(([A-Z.]{1,6})\\)`, "i"))?.[1]
    ?? text.match(/\b(?:NASDAQ|NYSE)[:\s-]*([A-Z.]{1,6})\b/)?.[1];

  const priceUsd = parseStockPriceUsd(text, stockSymbol);
  const marketCapUsd = parseMarketCapUsd(text);
  const stockPrice = priceUsd ? undefined : text.match(/\$[\d,.]+(?:\.\d+)?/g)?.find((v) => {
    const n = Number(v.replace("$", "").replaceAll(",", ""));
    return n > 5 && n < 5000;
  });
  const marketCap =
    marketCapUsd
      ? undefined
      : text.match(/\b(?:market cap|mkt cap)[^\d$]{0,20}\$?[\d.,]+\s?(?:T|B|M|trillion|billion)?\b/i)?.[0];

  return normalizeFinancialSnapshot(company, {
    stockSymbol,
    stockPrice,
    marketCap,
    priceUsd,
    marketCapUsd,
    financeSources,
  });
}

const PIPELINE_URL_MATCHERS: Record<string, RegExp> = {
  linkedin_company_profile: /linkedin\.com\/company\/[^/?#]+/i,
  crunchbase_company: /crunchbase\.com\/organization\/[^/?#]+/i,
  yahoo_finance_business: /finance\.yahoo\.com\/quote\/[^/?#]+/i,
  linkedin_job_listings: /linkedin\.com\/(company\/[^/?#]+|jobs)/i,
  linkedin_posts: /linkedin\.com\/(company|in)\/[^/?#]+/i,
  x_posts: /(x\.com|twitter\.com)\/[^/?#]+/i,
  youtube_profiles: /youtube\.com\/(channel|c|@)[^/?#]+/i,
  reddit_posts: /reddit\.com\/r\/[^/?#]+/i,
};

function findPipelineUrl(searchResults: SearchResult[], pipelineType: string): string | undefined {
  const pattern = PIPELINE_URL_MATCHERS[pipelineType];
  if (!pattern) return undefined;
  return searchResults.find((item) => pattern.test(item.url))?.url;
}

function summarizePipeline(pipelineType: string, data: unknown): string | undefined {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return undefined;
  const record = row as Record<string, unknown>;

  if (pipelineType === "linkedin_company_profile") {
    const parts = [
      record.name,
      record.industry,
      record.company_size,
      record.followers_count ? `${record.followers_count} followers` : undefined,
      record.about,
    ].filter(Boolean);
    return parts.length ? parts.map(String).join(" · ") : undefined;
  }

  if (pipelineType === "crunchbase_company") {
    const parts = [
      record.name,
      record.short_description,
      record.funding_total ? `Funding: ${record.funding_total}` : undefined,
      record.num_employees_enum,
    ].filter(Boolean);
    return parts.length ? parts.map(String).join(" · ") : undefined;
  }

  if (pipelineType === "yahoo_finance_business") {
    const parts = [
      record.symbol ?? record.ticker,
      record.regularMarketPrice ? `Price: ${record.regularMarketPrice}` : undefined,
      record.marketCap ? `Market cap: ${record.marketCap}` : undefined,
      record.longName ?? record.shortName,
    ].filter(Boolean);
    return parts.length ? parts.map(String).join(" · ") : undefined;
  }

  const fallback = Object.entries(record)
    .filter(([key, value]) => typeof value === "string" && value.length < 180 && !key.includes("image"))
    .slice(0, 4)
    .map(([, value]) => String(value));

  return fallback.length ? fallback.join(" · ") : undefined;
}

function pipelineSignalCategory(pipelineType: string): Signal["category"] {
  if (pipelineType.includes("job")) return "hiring";
  if (pipelineType.includes("finance") || pipelineType.includes("yahoo")) return "positioning";
  if (pipelineType.includes("review") || pipelineType.includes("reddit")) return "risk";
  return "product";
}

export async function enrichWithStructuredPipelines(
  mode: ResearchMode,
  companyName: string,
  searchResults: SearchResult[],
  logger: { warn: (...args: unknown[]) => void }
): Promise<{ signals: Signal[]; financialPatch?: Partial<FinancialSnapshot> }> {
  const strategy = getResearchStrategy(mode);
  const signals: Signal[] = [];
  let financialPatch: Partial<FinancialSnapshot> | undefined;

  for (const pipelineType of strategy.pipelineTypes) {
    const url = findPipelineUrl(searchResults, pipelineType);
    if (!url) continue;

    try {
      const data = await runPipelineViaCli(pipelineType, url);
      const summary = summarizePipeline(pipelineType, data);
      if (!summary) continue;

      signals.push({
        category: pipelineSignalCategory(pipelineType),
        title: `${pipelineType.replaceAll("_", " ")}`,
        detail: summary,
        sourceUrl: url,
        confidence: "high",
      });

      if (pipelineType === "yahoo_finance_business") {
        const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown>;
        const price = Number(row.regularMarketPrice);
        const cap = Number(row.marketCap);
        financialPatch = normalizeFinancialSnapshot(companyName, {
          ...(financialPatch ?? { financeSources: searchResults }),
          stockSymbol: String(row.symbol ?? row.ticker ?? financialPatch?.stockSymbol ?? ""),
          priceUsd: Number.isFinite(price) ? price : financialPatch?.priceUsd,
          marketCapUsd: Number.isFinite(cap) ? cap : financialPatch?.marketCapUsd,
          financeSources: financialPatch?.financeSources ?? searchResults,
        });
      }
    } catch (error) {
      logger.warn(`  Pipeline ${pipelineType} skipped for ${companyName}:`, error);
    }
  }

  return { signals, financialPatch };
}
