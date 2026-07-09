import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

function loadFromBdataCli(): string | undefined {
  const paths = [
    join(homedir(), "Library", "Application Support", "brightdata-cli", "credentials.json"),
    join(homedir(), ".config", "brightdata-cli", "credentials.json"),
  ];
  for (const p of paths) {
    if (!existsSync(p)) continue;
    try {
      const raw = JSON.parse(readFileSync(p, "utf8")) as { api_key?: string };
      if (raw.api_key) return raw.api_key;
    } catch {
      /* try next */
    }
  }
  return undefined;
}

export function resolveApiToken(): string {
  const fromEnv =
    process.env.BRIGHTDATA_API_TOKEN ??
    process.env.BRIGHTDATA_API_KEY;
  if (fromEnv?.trim()) return fromEnv.trim();

  const fromCli = loadFromBdataCli();
  if (fromCli) return fromCli;

  throw new Error(
    "Missing API token. Run `bdata login` or set BRIGHTDATA_API_TOKEN in .env"
  );
}
