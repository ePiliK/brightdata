# Hackathon Build Plan — Competitor Launch Tracker

Piano passo-passo con **prompt pronti** da incollare in Cursor per costruire il progetto in ordine.

Demo case: **Notion vs Coda vs ClickUp** (productivity / workspace tools).

---

## Fase 0 — Setup (fatto ✅)

- [x] Repo Bright Data skills clonato
- [x] `bdata login` completato
- [x] MCP `user-bright-data` attivo
- [x] Cartella progetto `competitor-launch-tracker/`

**Prompt Fase 0** (se serve rifare setup):
```
Verifica che bdata login, bdata budget e bdata zones funzionino.
Configura BRIGHTDATA_API_TOKEN per il progetto competitor-launch-tracker.
```

---

## Fase 1 — Scaffold progetto

**Obiettivo:** TypeScript + SDK, CLI, struttura cartelle.

**Prompt:**
```
In competitor-launch-tracker/ crea un progetto Node TypeScript con:
- @brightdata/sdk
- CLI: npm run analyze -- --competitors "Notion,Coda,ClickUp"
- cartelle src/pipeline, examples, scripts
- .env.example con BRIGHTDATA_API_TOKEN
```

**Checklist:**
- [ ] `package.json` con script `analyze`, `demo`, `build`
- [ ] `tsconfig.json`
- [ ] Entry `src/index.ts`

---

## Fase 2 — Pipeline Bright Data (30 pt rubric)

**Obiettivo:** Uso profondo del live web — non un solo scrape.

**Prompt:**
```
Implementa la pipeline in src/pipeline/:

1. discover-sources.ts — client.discover() per trovare pricing, blog, careers per ogni competitor
2. scrape-competitor.ts — client.scrapeUrl() in batch su homepage, /pricing, /blog o /changelog
3. extract-signals.ts — euristica su markdown: pricing tiers, AI mentions, enterprise, hiring
4. synthesize-report.ts — report markdown con citazioni URL

Usa discover + scrape + search (SERP) dove serve. Parallelizza per competitor.
```

**Bright Data tools usati:**
| Step | Tool SDK / MCP |
|------|----------------|
| Trovare pagine | `discover`, `search.google` |
| Leggere contenuto | `scrapeUrl` (markdown) |
| Multi-pagina | `scrape_batch` / parallel scrape |

---

## Fase 3 — Report & output (Does it work — 25 pt)

**Prompt:**
```
Il report finale deve includere per ogni competitor:
- Positioning (1 frase)
- Pricing signals (tier names, free tier, enterprise)
- Product signals (AI, automation, integrations)
- Hiring / growth signals (se careers page scrapata)
- Vulnerabilities (gap vs altri)
- Strategic recommendations (3 bullet)

Salva in examples/notion-coda-clickup-report.md e supporta --output flag.
```

**Checklist:**
- [ ] `npm run demo` produce file in `examples/`
- [ ] Output leggibile senza UI

---

## Fase 4 — README per la giuria (10 pt)

**Prompt:**
```
Scrivi README.md ottimizzato per la rubric hackathon:
1. What it does (2 paragrafi)
2. Why Bright Data is essential (tabella tool → use case)
3. Architecture (diagramma testuale)
4. How to run (copy-paste commands)
5. Example output (link a examples/)
6. Hackathon demo script (60 secondi)
```

---

## Fase 5 — Polish & submit

**Prompt:**
```
- Aggiungi .gitignore (node_modules, .env, dist)
- Verifica che il repo sia pubblico su GitHub
- Commit message chiari
- Rimuovi segreti dal repo
- Test finale: npm run demo end-to-end
```

**Submit:** form hackathon + URL repo pubblico.

---

## Prompt rapidi per debug

| Problema | Prompt |
|----------|--------|
| Auth fallisce | `Leggi API key da bdata credentials o BRIGHTDATA_API_TOKEN, non hardcodare` |
| Scrape vuoto | `Riprova con scrapeUrl dataFormat markdown, o discover per URL alternativi` |
| Report generico | `Aggiungi citazioni [source](url) per ogni signal estratto` |
| Troppo lento | `Limita a 3 URL per competitor, parallelizza con Promise.all` |

---

## Rubric mapping

| Criterio | Punti | Come lo copriamo |
|----------|-------|------------------|
| Use of Bright Data | 30 | discover + SERP + scrape multi-pagina, live only |
| Does it work | 25 | `npm run demo` → report reale in examples/ |
| Creativity | 20 | Launch tracker, non tutorial scrape |
| Technical execution | 15 | TS pulito, pipeline modulare |
| README & clarity | 10 | README con run + Bright Data + output |

---

## Ordine di esecuzione consigliato

```
Fase 1 → Fase 2 → Fase 3 → npm run demo → Fase 4 → Fase 5 → push GitHub
```

Tempo stimato: **2–4 ore** per MVP completo.
