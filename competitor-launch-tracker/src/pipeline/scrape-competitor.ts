import { scrapeMarkdown, type BrightDataClient } from "../brightdata.js";
import type { AnalysisSize, DiscoveredPage, ScrapedPage } from "../types.js";

const MIN_CONTENT = 50;

export async function scrapeCompetitorPages(
  client: BrightDataClient,
  pages: DiscoveredPage[],
  logger: Pick<Console, "log" | "warn"> = console,
  analysisSize: AnalysisSize = "large"
): Promise<ScrapedPage[]> {
  const results: ScrapedPage[] = [];
  const maxChars = analysisSize === "small" ? 8000 : 15000;

  for (const page of pages) {
    try {
      const markdown = await scrapeMarkdown(client, page.url);
      if (!markdown || markdown.length < MIN_CONTENT) {
        logger.warn(`  ⚠ Short/empty scrape (${markdown?.length ?? 0} chars): ${page.url}`);
        continue;
      }
      results.push({
        url: page.url,
        pageType: page.pageType,
        markdown: markdown.slice(0, maxChars),
      });
      logger.log(`  ✓ ${page.pageType}: ${page.url} (${markdown.length} chars)`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`  ✗ Failed ${page.url}: ${msg}`);
    }
  }

  return results;
}
