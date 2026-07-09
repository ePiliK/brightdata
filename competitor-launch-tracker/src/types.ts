export interface CompetitorInput {
  name: string;
  domain?: string;
}

export interface DiscoveredPage {
  url: string;
  title: string;
  relevanceScore?: number;
  pageType: PageType;
}

export type PageType = "homepage" | "pricing" | "blog" | "careers" | "changelog" | "other";

export interface ScrapedPage {
  url: string;
  pageType: PageType;
  markdown: string;
}

export interface SearchResult {
  title: string;
  url: string;
  description?: string;
  source?: string;
}

export type ResearchMode = "market" | "financial" | "social" | "hiring" | "reviews";
export type AnalysisSize = "small" | "large";

export interface Signal {
  category: "pricing" | "product" | "hiring" | "positioning" | "risk";
  title: string;
  detail: string;
  sourceUrl: string;
  confidence: "high" | "medium" | "low";
}

export interface CompetitorAnalysis {
  name: string;
  domain: string;
  pages: ScrapedPage[];
  searchResults: SearchResult[];
  signals: Signal[];
  summary: string;
  financialSnapshot?: FinancialSnapshot;
  socialHighlights?: SearchResult[];
  reviewHighlights?: SearchResult[];
}

export interface FinancialSnapshot {
  stockSymbol?: string;
  marketCap?: string;
  stockPrice?: string;
  priceUsd?: number;
  marketCapUsd?: number;
  earningsSnippet?: string;
  investorBrief?: string;
  financeSources: SearchResult[];
}

export interface TrackerReport {
  generatedAt: string;
  category: string;
  competitors: CompetitorAnalysis[];
  crossCompetitorInsights: string[];
  strategicRecommendations: string[];
  autoDiscoveredCompetitors?: string[];
  researchMode?: ResearchMode;
  selectedSources?: string[];
}

export interface AnalyzeOptions {
  competitors: string[];
  category: string;
  researchMode?: ResearchMode;
  analysisSize?: AnalysisSize;
  maxCompetitors?: number;
  outputPath?: string;
  logger?: {
    log: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
  };
}
