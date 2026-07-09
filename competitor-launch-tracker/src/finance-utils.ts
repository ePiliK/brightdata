import type { FinancialSnapshot, SearchResult } from "./types.js";

const MULTIPLIERS: Record<string, number> = {
  t: 1e12,
  trillion: 1e12,
  b: 1e9,
  billion: 1e9,
  m: 1e6,
  million: 1e6,
};

export function parseMarketCapUsd(text: string): number | undefined {
  const patterns = [
    /market\s*cap(?:italization)?\.?\s*\$?\s*([\d,.]+)\s*(trillion|t|billion|b|million|m)\b/i,
    /\$\s*([\d,.]+)\s*(trillion|t|billion|b)\s*market\s*cap/i,
    /market\s*cap[^$\d]{0,12}\$?\s*([\d,.]+)\s*(T|B|M)\b/,
    /\$\s*([\d,.]+)\s*(T|B)\b/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const value = Number(match[1].replaceAll(",", ""));
    const unit = match[2].toLowerCase();
    const multiplier = MULTIPLIERS[unit];
    if (Number.isFinite(value) && multiplier) return value * multiplier;
  }

  return undefined;
}

export function parseStockPriceUsd(text: string, symbol?: string): number | undefined {
  const scoped = symbol
    ? text.split(new RegExp(symbol, "i")).slice(0, 3).join(" ")
    : text;

  const patterns = [
    /(?:stock|shares?|trading at|closed at|hit|at)\s+(?:an?\s+)?(?:all-time\s+high\s+at\s+)?\$([\d,]+(?:\.\d+)?)/i,
    /(?:EPS|earnings per share)[^.]{0,30}\$([\d,]+(?:\.\d+)?)/i,
    /\$([\d,]+(?:\.\d+)?)\s+per\s+share/i,
    /price[^$]{0,20}\$([\d,]+(?:\.\d+)?)/i,
  ];

  const prices: number[] = [];
  for (const pattern of patterns) {
    for (const match of scoped.matchAll(new RegExp(pattern.source, pattern.flags + "g"))) {
      const value = Number(match[1].replaceAll(",", ""));
      if (Number.isFinite(value) && value > 1 && value < 100_000) prices.push(value);
    }
  }

  if (!prices.length) return undefined;
  return Math.max(...prices);
}

export function extractSymbolFromSources(sources: SearchResult[], company: string): string | undefined {
  for (const source of sources) {
    const fromUrl = source.url.match(/finance\.yahoo\.com\/quote\/([A-Z0-9.-]+)/i)?.[1];
    if (fromUrl && fromUrl.length <= 6) return fromUrl.toUpperCase();

    const fromTitle = `${source.title} ${source.description ?? ""}`.match(
      new RegExp(`${company.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^()]{0,40}\\(([A-Z.]{1,6})\\)`, "i")
    )?.[1];
    if (fromTitle) return fromTitle.toUpperCase();
  }

  const haystack = sources.map((s) => `${s.title} ${s.description ?? ""}`).join(" ");
  return haystack.match(/\b(?:NASDAQ|NYSE)[:\s-]*([A-Z.]{1,6})\b/)?.[1]
    ?? haystack.match(/\(([A-Z]{2,5})\)/)?.[1];
}

export function extractEarningsSnippet(sources: SearchResult[]): string | undefined {
  for (const source of sources) {
    const text = `${source.title}. ${source.description ?? ""}`;
    if (!/earnings|EPS|revenue|quarter|fiscal/i.test(text)) continue;

    const eps = text.match(/EPS[^$]{0,20}\$([\d,.]+)/i)?.[1];
    const revenue = text.match(/revenue[^$]{0,30}\$([\d,.]+)\s*(billion|million|B|M)?/i);
    const parts: string[] = [];
    if (eps) parts.push(`EPS $${eps}`);
    if (revenue) {
      parts.push(`revenue $${revenue[1]}${revenue[2] ? ` ${revenue[2]}` : ""}`);
    }
    if (parts.length) return parts.join(" · ");
    if (text.length < 220) return text;
    return text.slice(0, 200).trim() + "…";
  }
  return undefined;
}

export function formatUsd(value?: number, decimals = 2): string {
  if (value === undefined || !Number.isFinite(value)) return "—";
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

export function formatStockPrice(value?: number): string {
  if (value === undefined || !Number.isFinite(value)) return "—";
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function buildInvestorBrief(
  company: string,
  finance: FinancialSnapshot,
  sources: SearchResult[]
): string {
  const parts: string[] = [];

  if (finance.stockSymbol) {
    parts.push(`${company} trades as ${finance.stockSymbol}`);
  }

  if (finance.priceUsd) {
    parts.push(`recent price around ${formatStockPrice(finance.priceUsd)}`);
  }

  if (finance.marketCapUsd) {
    parts.push(`market cap near ${formatUsd(finance.marketCapUsd)}`);
  }

  if (finance.earningsSnippet) {
    parts.push(`latest earnings context: ${finance.earningsSnippet}`);
  } else {
    const headline = sources.find((s) => /earnings|revenue|profit|quarter/i.test(`${s.title} ${s.description ?? ""}`));
    if (headline?.description) parts.push(headline.description.slice(0, 160).trim() + "…");
  }

  if (!parts.length) {
    return `Limited live financial data for ${company}. Expand discovery or retry in financial mode with a known ticker.`;
  }

  return parts.join(". ") + ".";
}

export function normalizeFinancialSnapshot(
  company: string,
  raw: Partial<FinancialSnapshot> & { financeSources: SearchResult[] }
): FinancialSnapshot {
  const sources = raw.financeSources;
  const text = sources.map((item) => `${item.title} ${item.description ?? ""}`).join(" ");
  const stockSymbol = raw.stockSymbol ?? extractSymbolFromSources(sources, company);
  const priceUsd = raw.priceUsd ?? parseStockPriceUsd(text, stockSymbol);
  const marketCapUsd =
    raw.marketCapUsd ??
    parseMarketCapUsd(raw.marketCap ?? "") ??
    parseMarketCapUsd(text);

  const earningsSnippet = raw.earningsSnippet ?? extractEarningsSnippet(sources);
  const investorBrief = raw.investorBrief ?? buildInvestorBrief(company, {
    stockSymbol,
    priceUsd,
    marketCapUsd,
    earningsSnippet,
    stockPrice: raw.stockPrice,
    marketCap: raw.marketCap,
    financeSources: sources,
  }, sources);

  return {
    stockSymbol,
    stockPrice: priceUsd ? formatStockPrice(priceUsd) : raw.stockPrice,
    marketCap: marketCapUsd ? formatUsd(marketCapUsd) : raw.marketCap,
    priceUsd,
    marketCapUsd,
    earningsSnippet,
    investorBrief,
    financeSources: sources,
  };
}
