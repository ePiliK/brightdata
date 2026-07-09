import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { bdclient } from "@brightdata/sdk";
import { resolveApiToken } from "./auth.js";

const execFileAsync = promisify(execFile);

export type BrightDataClient = InstanceType<typeof bdclient>;

export function createClient(): BrightDataClient {
  return new bdclient({
    apiKey: resolveApiToken(),
    webUnlockerZone: process.env.BRIGHTDATA_UNLOCKER_ZONE ?? "cli_unlocker",
    serpZone: process.env.BRIGHTDATA_SERP_ZONE ?? "cli_unlocker",
    autoCreateZones: true,
    logLevel: "ERROR",
  });
}

export async function withClient<T>(
  fn: (client: BrightDataClient) => Promise<T>
): Promise<T> {
  const client = createClient();
  return fn(client);
}

export async function scrapeMarkdown(
  client: BrightDataClient,
  url: string
): Promise<string> {
  const result = await client.scrape(url, { dataFormat: "markdown", timeout: 60000 });
  if (typeof result === "string") return result;
  if (result && typeof result === "object" && "body" in result) {
    return String((result as { body: string }).body ?? "");
  }
  return String(result ?? "");
}

export interface DiscoverResult {
  link?: string;
  url?: string;
  title?: string;
  relevance_score?: number;
}

export interface SearchOrganicResult {
  link?: string;
  title?: string;
  description?: string;
  source?: string;
}

export async function discoverViaCli(
  query: string,
  intent?: string,
  numResults = 5
): Promise<DiscoverResult[]> {
  const args = ["discover", query, "--json", "--num-results", String(numResults)];
  if (intent) args.push("--intent", intent);

  const { stdout } = await execFileAsync("bdata", args, {
    env: process.env,
    maxBuffer: 10 * 1024 * 1024,
  });

  const parsed = JSON.parse(stdout) as DiscoverResult[] | { results?: DiscoverResult[] };
  if (Array.isArray(parsed)) return parsed;
  return parsed.results ?? [];
}

export async function searchGoogleJson(
  client: BrightDataClient,
  query: string
): Promise<{ organic?: SearchOrganicResult[] }> {
  const combined: SearchOrganicResult[] = [];

  try {
    const { stdout } = await execFileAsync(
      "bdata",
      ["search", query, "--json"],
      {
        env: process.env,
        maxBuffer: 10 * 1024 * 1024,
      }
    );
    const parsed = JSON.parse(stdout) as { organic?: SearchOrganicResult[] };
    if (parsed.organic?.length) combined.push(...parsed.organic);
  } catch {
    /* fall through to SDK */
  }

  try {
    const raw = await client.search(query, {
      searchEngine: "google",
      format: "json",
      timeout: 60000,
    });

    const body =
      typeof raw === "string"
        ? raw
        : (raw as { body?: string }).body ?? JSON.stringify(raw);

    const parsed = JSON.parse(body) as { organic?: SearchOrganicResult[] };
    if (parsed.organic?.length) combined.push(...parsed.organic);
  } catch {
    /* ignore */
  }

  const seen = new Set<string>();
  const organic = combined.filter((item) => {
    const key = item.link ?? "";
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { organic };
}

export async function runPipelineViaCli(
  pipelineType: string,
  url: string
): Promise<Record<string, unknown> | Record<string, unknown>[]> {
  const { stdout } = await execFileAsync(
    "bdata",
    ["pipelines", pipelineType, url, "--json", "--pretty"],
    {
      env: process.env,
      maxBuffer: 10 * 1024 * 1024,
      timeout: 120000,
    }
  );

  const parsed = JSON.parse(stdout) as Record<string, unknown> | Record<string, unknown>[];
  return parsed;
}
