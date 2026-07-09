import type { ResearchMode } from "../types.js";

interface ResearchStrategy {
  label: string;
  querySuffix: string;
  selectedSources: string[];
  focusPages: string[];
  pipelineTypes: string[];
  brightDataTools: string[];
}

const STRATEGIES: Record<ResearchMode, ResearchStrategy & { description: string }> = {
  market: {
    label: "Market & competitors",
    description: "Pricing, product pages, positioning and official site content. Best default when you want to understand how a company competes.",
    querySuffix: "pricing competitors reviews product updates",
    selectedSources: ["google.com", "official websites", "linkedin.com", "crunchbase.com"],
    focusPages: ["pricing", "blog", "careers"],
    pipelineTypes: ["linkedin_company_profile", "crunchbase_company"],
    brightDataTools: ["bdata search", "Web Unlocker scrape", "bdata pipelines"],
  },
  financial: {
    label: "Financial & stock",
    description: "Share price, market cap, earnings news and investor sources. Use for a single public company like Apple.",
    querySuffix: "stock price market cap investor relations yahoo finance quarterly results",
    selectedSources: ["finance.yahoo.com", "google.com", "investor relations pages"],
    focusPages: ["investors", "pricing", "news"],
    pipelineTypes: ["yahoo_finance_business"],
    brightDataTools: ["bdata search", "Web Unlocker scrape", "yahoo_finance_business pipeline"],
  },
  social: {
    label: "Social presence",
    description: "LinkedIn, X, YouTube and community visibility — how loud the brand is in public channels.",
    querySuffix: "linkedin x twitter instagram youtube announcements community",
    selectedSources: ["linkedin.com", "x.com", "youtube.com", "instagram.com", "google.com"],
    focusPages: ["blog", "news", "community"],
    pipelineTypes: ["linkedin_posts", "x_posts", "youtube_profiles"],
    brightDataTools: ["bdata search", "social pipelines", "Web Unlocker scrape"],
  },
  hiring: {
    label: "Hiring & growth",
    description: "Careers pages, job listings and hiring signals — useful to see if a company is expanding.",
    querySuffix: "careers jobs hiring linkedin jobs glassdoor indeed",
    selectedSources: ["linkedin.com", "glassdoor.com", "indeed.com", "official careers pages"],
    focusPages: ["careers", "jobs", "team"],
    pipelineTypes: ["linkedin_company_profile", "linkedin_job_listings"],
    brightDataTools: ["bdata search", "linkedin_job_listings pipeline", "Web Unlocker scrape"],
  },
  reviews: {
    label: "Reviews & reputation",
    description: "G2, Reddit, comparisons and complaints — what customers and reviewers say.",
    querySuffix: "reviews g2 capterra reddit complaints customer feedback",
    selectedSources: ["google.com", "reddit.com", "g2.com", "capterra.com"],
    focusPages: ["reviews", "testimonials", "community"],
    pipelineTypes: ["reddit_posts", "google_maps_reviews"],
    brightDataTools: ["bdata search", "Web Unlocker scrape", "review-oriented SERP"],
  },
};

export function getResearchStrategy(mode: ResearchMode = "market") {
  return STRATEGIES[mode];
}

export function getModeDescriptions(): Record<ResearchMode, { label: string; description: string }> {
  return Object.fromEntries(
    Object.entries(STRATEGIES).map(([key, value]) => [key, { label: value.label, description: value.description }])
  ) as Record<ResearchMode, { label: string; description: string }>;
}
