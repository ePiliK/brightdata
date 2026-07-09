import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { withClient } from "./brightdata.js";
import { discoverCompetitorPages, resolveCompetitor } from "./pipeline/discover-sources.js";
import {
  classifySearchResult,
  enrichWithStructuredPipelines,
  gatherFinancialSnapshot,
  gatherSerpResults,
  inferCompetitors,
} from "./pipeline/enrich-market.js";
import { getResearchStrategy } from "./pipeline/research-strategy.js";
import { scrapeCompetitorPages } from "./pipeline/scrape-competitor.js";
import { extractSignals, summarizeCompetitor } from "./pipeline/extract-signals.js";
import { renderReportMarkdown, synthesizeReport } from "./pipeline/synthesize-report.js";
import { normalizeFinancialSnapshot } from "./finance-utils.js";
import type { AnalysisSize, AnalyzeOptions, CompetitorAnalysis, FinancialSnapshot, ResearchMode, TrackerReport } from "./types.js";

export async function runAnalysisDetailed(
  options: AnalyzeOptions
): Promise<{ markdown: string; report: TrackerReport }> {
  const { competitors, category, outputPath } = options;
  const researchMode = options.researchMode ?? "market";
  const analysisSize = options.analysisSize ?? "small";
  const maxCompetitors = Math.max(1, options.maxCompetitors ?? (analysisSize === "small" ? 1 : 3));
  const strategy = getResearchStrategy(researchMode);
  const logger = options.logger ?? console;
  const analyses: CompetitorAnalysis[] = [];
  let resolvedCompetitors = competitors;
  let autoDiscoveredCompetitors: string[] | undefined;

  logger.log(`\n🔍 Competitor Launch Tracker`);
  logger.log(`   Mode: ${strategy.label}`);
  logger.log(`   Depth: ${analysisSize}`);
  logger.log(`   Max competitors: ${maxCompetitors}`);
  logger.log(`   Category: ${category.trim() || "(auto)"}`);
  logger.log(`   Competitors: ${competitors.join(", ")}\n`);

  await withClient(async (client) => {
    if (competitors.length === 1) {
      const inferred = await inferCompetitors(client, competitors[0], category);
      if (inferred.length) {
        autoDiscoveredCompetitors = inferred;
        const extraSlots = Math.max(0, maxCompetitors - 1);
        resolvedCompetitors = [competitors[0], ...inferred.slice(0, extraSlots)];
        logger.log(`   Auto-discovered competitors: ${inferred.join(", ")}\n`);
      }
    }

    resolvedCompetitors = resolvedCompetitors.slice(0, maxCompetitors);

    for (const name of resolvedCompetitors) {
      const competitor = resolveCompetitor(name);
      logger.log(`→ ${competitor.name} (${competitor.domain})`);

      logger.log("  Gathering Google SERP context...");
      const categorySuffix = category.trim();
      const serpQuery = categorySuffix
        ? `${competitor.name} ${categorySuffix} ${strategy.querySuffix}`
        : `${competitor.name} ${strategy.querySuffix}`;
      const searchResults = await gatherSerpResults(client, serpQuery, analysisSize === "small" ? 4 : 6);

      logger.log("  Discovering pages (Discover + SERP)...");
      const pages = await discoverCompetitorPages(client, competitor, analysisSize);
      logger.log(`  Found ${pages.length} URLs`);

      logger.log("  Scraping live pages...");
      const scraped = await scrapeCompetitorPages(client, pages, logger, analysisSize);
      logger.log(`  Scraped ${scraped.length} pages`);

      logger.log("  Enriching with Bright Data pipelines...");
      const pipelineEnrichment = await enrichWithStructuredPipelines(
        researchMode,
        competitor.name,
        searchResults,
        logger
      );

      const signals = [
        ...extractSignals(competitor.name, scraped, searchResults),
        ...pipelineEnrichment.signals,
      ];
      const summary = summarizeCompetitor(competitor.name, signals);
      let financialSnapshot: FinancialSnapshot | undefined;
      if (researchMode === "financial") {
        const base = await gatherFinancialSnapshot(client, competitor.name);
        const mergedSources = base?.financeSources?.length
          ? base.financeSources
          : searchResults.filter((item) => /finance|yahoo|investor|earnings|stock/i.test(`${item.title} ${item.url}`));
        financialSnapshot = normalizeFinancialSnapshot(competitor.name, {
          ...(base ?? {}),
          ...(pipelineEnrichment.financialPatch ?? {}),
          financeSources: mergedSources.length ? mergedSources : searchResults,
        });
        if (!financialSnapshot.stockSymbol && !financialSnapshot.priceUsd && !financialSnapshot.marketCapUsd && !financialSnapshot.earningsSnippet) {
          financialSnapshot = undefined;
        }
      }
      const socialHighlights = searchResults.filter((item) => classifySearchResult(item).type === "social");
      const reviewHighlights = searchResults.filter((item) => {
        const kind = classifySearchResult(item).type;
        return kind === "review" || kind === "news";
      });

      analyses.push({
        name: competitor.name,
        domain: competitor.domain!,
        pages: scraped,
        searchResults,
        signals,
        summary,
        financialSnapshot,
        socialHighlights,
        reviewHighlights,
      });
    }
  });

  const report = synthesizeReport(
    category,
    analyses,
    autoDiscoveredCompetitors,
    researchMode,
    [...strategy.selectedSources, ...strategy.pipelineTypes]
  );
  const markdown = renderReportMarkdown(report);

  if (outputPath) {
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, markdown, "utf8");
    logger.log(`\n✅ Report saved: ${outputPath}\n`);
  }

  return { markdown, report };
}

export async function runAnalysis(options: AnalyzeOptions): Promise<string> {
  const { markdown } = await runAnalysisDetailed(options);
  return markdown;
}

function parseArgs(argv: string[]): AnalyzeOptions {
  let competitors: string[] = ["Notion", "Coda", "ClickUp"];
  let category = "";
  let researchMode: ResearchMode = "market";
  let analysisSize: AnalysisSize = "small";
  let maxCompetitors: number | undefined;
  let outputPath: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--competitors" && argv[i + 1]) {
        competitors = argv[++i].split(",").map((s) => s.trim()).filter(Boolean);
    } else if (arg === "--category" && argv[i + 1]) {
      category = argv[++i];
    } else if (arg === "--mode" && argv[i + 1]) {
      researchMode = argv[++i] as ResearchMode;
    } else if (arg === "--size" && argv[i + 1]) {
      analysisSize = argv[++i] as AnalysisSize;
    } else if (arg === "--max-competitors" && argv[i + 1]) {
      maxCompetitors = Number(argv[++i]);
    } else if (arg === "--output" && argv[i + 1]) {
      outputPath = argv[++i];
    } else if (arg === "--help" || arg === "-h") {
      console.log(`
Usage: npm run analyze -- [options]

  --competitors "A,B,C"   Competitor names (default: Notion,Coda,ClickUp)
  --category "..."        Market category label
  --mode market|financial|social|hiring|reviews
  --size small|large      Research depth (default: small)
  --max-competitors N     Max companies to analyze (default: 1 small, 3 large)
  --output path.md        Write report to file
`);
      process.exit(0);
    }
  }

  return { competitors, category, researchMode, analysisSize, maxCompetitors, outputPath };
}

const isMain = process.argv[1]?.includes("index.ts") || process.argv[1]?.includes("index.js");

if (isMain) {
  const opts = parseArgs(process.argv.slice(2));
  runAnalysis(opts)
    .then((md) => {
      if (!opts.outputPath) console.log(md);
    })
    .catch((err) => {
      console.error("Error:", err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
