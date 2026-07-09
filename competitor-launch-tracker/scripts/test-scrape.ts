import { createClient, scrapeMarkdown } from "../src/brightdata.js";

const c = createClient();
const urls = [
  "https://example.com",
  "https://www.notion.so/pricing",
  "https://coda.io/pricing",
];

for (const url of urls) {
  try {
    const md = await scrapeMarkdown(c, url);
    console.log(url, "=>", md.length, "chars");
    console.log(md.slice(0, 150).replace(/\n/g, " "));
  } catch (e) {
    console.error(url, "ERR", e);
  }
}
