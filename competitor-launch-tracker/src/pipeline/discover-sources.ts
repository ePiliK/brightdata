import {
  discoverViaCli,
  searchGoogleJson,
  type BrightDataClient,
} from "../brightdata.js";
import type { AnalysisSize, CompetitorInput, DiscoveredPage, PageType } from "../types.js";

const KNOWN_DOMAINS: Record<string, string> = {
  notion: "notion.so",
  coda: "coda.io",
  clickup: "clickup.com",
  slack: "slack.com",
  asana: "asana.com",
  monday: "monday.com",
};

const PAGE_PATTERNS: { type: PageType; keywords: string[] }[] = [
  { type: "pricing", keywords: ["pricing", "plans", "price"] },
  { type: "careers", keywords: ["careers", "jobs", "hiring"] },
  { type: "blog", keywords: ["blog", "news", "changelog", "updates", "product"] },
  { type: "homepage", keywords: ["home", "official", "website"] },
];

function guessDomain(name: string): string {
  const key = name.toLowerCase().replace(/\s+/g, "");
  if (KNOWN_DOMAINS[key]) return KNOWN_DOMAINS[key];
  return `${key}.com`;
}

function classifyUrl(url: string, title: string): PageType {
  const hay = `${url} ${title}`.toLowerCase();
  for (const { type, keywords } of PAGE_PATTERNS) {
    if (keywords.some((k) => hay.includes(k))) return type;
  }
  return "other";
}

function dedupePages(pages: DiscoveredPage[]): DiscoveredPage[] {
  const seen = new Set<string>();
  return pages.filter((p) => {
    try {
      const u = new URL(p.url);
      const key = `${u.hostname}${u.pathname.replace(/\/$/, "")}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    } catch {
      return false;
    }
  });
}

export function resolveCompetitor(name: string): CompetitorInput {
  return { name: name.trim(), domain: guessDomain(name.trim()) };
}

export async function discoverCompetitorPages(
  client: BrightDataClient,
  competitor: CompetitorInput,
  analysisSize: AnalysisSize = "large"
): Promise<DiscoveredPage[]> {
  const domain = competitor.domain ?? guessDomain(competitor.name);
  const base = `https://www.${domain.replace(/^www\./, "")}`;

  const fallbackPages: DiscoveredPage[] = [
    { url: base, title: `${competitor.name} homepage`, pageType: "homepage" },
    { url: `${base}/pricing`, title: `${competitor.name} pricing`, pageType: "pricing" },
    { url: `${base}/blog`, title: `${competitor.name} blog`, pageType: "blog" },
    { url: `${base}/careers`, title: `${competitor.name} careers`, pageType: "careers" },
  ];

  const discovered: DiscoveredPage[] = [...fallbackPages];

  const queries = analysisSize === "small"
    ? [
        {
          query: `${competitor.name} pricing plans`,
          intent: `Official ${competitor.name} pricing page on ${domain}`,
        },
      ]
    : [
    {
      query: `${competitor.name} pricing plans`,
      intent: `Official ${competitor.name} pricing page on ${domain}`,
    },
    {
      query: `${competitor.name} product updates blog`,
      intent: `${competitor.name} product news or changelog`,
    },
  ];

  for (const { query, intent } of queries) {
    try {
      const items = await discoverViaCli(query, intent, analysisSize === "small" ? 3 : 5);
      for (const row of items) {
        const url = row.link ?? row.url;
        if (!url || !url.includes(domain)) continue;
        const title = row.title ?? url;
        discovered.push({
          url,
          title,
          relevanceScore: row.relevance_score,
          pageType: classifyUrl(url, title),
        });
      }
    } catch {
      /* discover optional */
    }
  }

  try {
    const serp = await searchGoogleJson(
      client,
      analysisSize === "small"
        ? `${competitor.name} site:${domain} pricing OR homepage`
        : `${competitor.name} site:${domain} pricing OR careers OR blog`
    );
    for (const row of serp.organic?.slice(0, analysisSize === "small" ? 3 : 5) ?? []) {
      if (!row.link) continue;
      discovered.push({
        url: row.link,
        title: row.title ?? row.link,
        pageType: classifyUrl(row.link, row.title ?? ""),
      });
    }
  } catch {
    /* SERP optional */
  }

  return dedupePages(discovered)
    .sort((a, b) => {
      const priority: Record<PageType, number> = {
        pricing: 0,
        homepage: 1,
        blog: 2,
        changelog: 3,
        careers: 4,
        other: 5,
      };
      return priority[a.pageType] - priority[b.pageType];
    })
    .slice(0, analysisSize === "small" ? 2 : 4);
}
