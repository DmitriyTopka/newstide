---
doc: checklist
status: approved
---

# Build Checklist

Build mode: fast

## Slices

- [x] **1. The newspaper front page works with a sample result**
  Becomes usable: `npm start` opens NewsTide at `localhost:3000` as a newspaper front page: masthead, market strip (sample values, labelled SAMPLE), coin field with suggestions (ETH, SOL, AAVE), Long/Short, timeframe 15m/1h/4h/1d, Get data, a countdown, and a sample result with arrow, traffic light, verdict, bull/bear/hamster placeholder, page tint, X-not-connected note and the "Not financial advice" line. Dark/light switch works. No AI and no live news yet.
  Why now: Dima asked to see and judge the design first, before anything else is built on top of it. Also bootstraps the project (package.json, Express server, coin registry) so every later slice has a home.
  PRD ref: `prd.md > Screens and Layout`, `prd.md > Look and Feel`, `prd.md > Coin input`, `prd.md > Plan and timeframe`, `prd.md > The indicator (result)`, `prd.md > States and Boundaries`
  Spec ref: `spec.md > Look and Feel`, `spec.md > Page`, `spec.md > Indicator View`, `spec.md > Coin Registry`, `spec.md > File Structure`, `spec.md > Where It Runs and How Someone Tries It`
  Build: Create package.json (start/test scripts), `.env.example`, Express server serving `public/` and `GET /api/coins`, `config/coins.json`; build `index.html`, `styles.css`, `app.js` in the newspaper style; a temporary sample endpoint returns one of three sample answers (up/sideways/down) so all three looks can be seen.
  Verify (mechanical): `npm start` runs without errors; `curl localhost:3000` returns 200; `curl localhost:3000/api/coins` returns 3 coins; a browser screenshot shows each of the three result states and both themes; percent sign absent from the result.
  Learner check: Run `npm start`, open `localhost:3000`, pick ETH, Long, 1h, press Get data, switch the theme. Say whether it feels like a newspaper and what you would change in the look.
  Commit: `Newspaper front page with sample result`

- [ ] **2. A real verdict from a saved batch of news (the kernel)**
  Becomes usable: Get data sends the saved sample batch of news for the chosen coin and horizon to the model (Haiku 5.5) and shows its real answer: arrow, light, a few words, spot/futures note. The cost of the analysis and of the session appears under the result. Each run is saved to `runs/` with the hidden cause-and-effect chain.
  Why now: This is the unique kernel and the biggest risk (does the model return the fixed answer shape and a sensible chain?). It runs on saved data, so it costs about $0.001 per try and gives the same input every time.
  PRD ref: `prd.md > The indicator (result)`, `prd.md > Background gathering (hidden from the user)`, `prd.md > Waiting for the result`
  Spec ref: `spec.md > Analyst`, `spec.md > Answer Checker`, `spec.md > Run Log`, `spec.md > Cost Counter`, `spec.md > Feed Collector` (sample mode), `spec.md > Data Model`, `spec.md > External Services and Dependencies`
  Build: Save one real snapshot of all feeds to `data/sample/` (labelled SAMPLE); `collect.js` sample mode with horizon windows; `analyst.js` with the structured output schema; `check.js` rules; `log.js`; `config/prices.json`; `POST /api/analyze`; page shows real answer and cost; `test/check.test.js`.
  Verify (mechanical): `npm test` passes (light rule, percent, word limit, citations); `curl -X POST /api/analyze` for ETH long 1h and SOL short 4h returns valid JSON with no chain field; a run file exists with chain steps citing existing item numbers; cost is shown and matches tokens times price.
  Learner check: Run ETH Long 1h and AAVE Short 1d. Then open the newest file in `runs/` and read the chain: does the reasoning from the news to the coin make sense to you as a trader?
  Commit: `Real verdict from saved news with checker and cost`

- [ ] **3. Live news from the official and market feeds**
  Becomes usable: With `DATA_MODE=live`, Get data reads the live feeds (official project blogs and forums, Cointelegraph, CoinDesk, Federal Reserve, Investing, MarketWatch) for the chosen coin and horizon. A source that fails is skipped with a small note; if nothing usable is found, the page says so and the model is not called.
  Why now: Live data is the second risk (feeds change shape, go down). Doing it after the kernel means the model part is already proven on known input.
  PRD ref: `prd.md > Background gathering (hidden from the user)`, `prd.md > States and Boundaries`
  Spec ref: `spec.md > Feed Collector`, `spec.md > External Services and Dependencies`, `spec.md > Important Failure Modes`
  Build: Live mode in `collect.js` with fast-xml-parser, `config/feeds.json`, timeouts, de-duplication, `missing_sources`, the "not enough news" path, 60-second server limit.
  Verify (mechanical): A script prints item counts per source for ETH, SOL, AAVE in both horizons; one live analysis per coin returns a valid answer; with one feed URL broken on purpose the analysis still works and lists it as missing; with all feeds broken the model is not called.
  Learner check: Switch to live, run SOL Long 4h. Compare the verdict with what you know about Solana news this week.
  Commit: `Live news gathering with source fallbacks`

- [ ] **4. Live market strip**
  Becomes usable: The strip under the masthead shows the real Bitcoin price, Nasdaq, "Today" crypto headlines and "This week" macro items, refreshed every 5 minutes. A failed source shows "no data" in its cell only.
  Why now: It is visible context, not the kernel, and depends on the feed code from slice 3.
  PRD ref: `prd.md > Market strip`
  Spec ref: `spec.md > Market Strip Service`, `spec.md > Important Failure Modes`
  Build: `server/market.js`, `GET /api/market` with 5-minute cache; page renders it in the newspaper ticker style.
  Verify (mechanical): `curl /api/market` returns BTC, Nasdaq, 3 + 3 headlines; the page shows them; with Yahoo blocked the Nasdaq cell shows "no data" and the rest works.
  Learner check: Open the page and compare BTC with your exchange. Say whether the strip reads easily.
  Commit: `Live market strip`

- [ ] **5. Illustrations, final model and demo readiness**
  Becomes usable: The smiling bull, cheerful bear and hamster are real engraving-style illustrations from Higgsfield; `MODEL=claude-sonnet-5-5` gives the final-quality verdict; the README explains how to run it, the sources and the limits.
  Why now: Images cost credits, so they come once the design is settled; Sonnet costs more, so it is switched on only for the finished app.
  PRD ref: `prd.md > Look and Feel`, `prd.md > What We're Building`
  Spec ref: `spec.md > Look and Feel`, `spec.md > Stack`, `spec.md > External Services and Dependencies`, `spec.md > Where It Runs and How Someone Tries It`
  Build: (Illustrations already done in slice 1 after the council.) Switch to Sonnet 5.5 with the refusal fallback; write README with screenshots.
  Verify (mechanical): Images load (HTTP 200) in all three states; one live Sonnet run per coin returns a valid answer with cost about $0.02; `git ls-files` shows no `.env` and no learner profile.
  Learner check: Run the three demo cases from the spec (ETH Long 1h, SOL Short 4h, AAVE Long 1d) as if recording the video.
  Commit: `Illustrations, Sonnet verdicts and README`

## Hands-on Checkpoints

- [ ] Early usable behavior explored - after slice 1: Dima judges the newspaper design before the rest is built on it
- [ ] Final kick-the-tires exploration and feedback completed

## Final Review

- [ ] Final review complete - feedback resolved and learner confirms ready to ship

## Code Tour and App Map

- [ ] Learning activity complete - guided route, focused alternative, prior practice connected, or brief recap
- [ ] Optional edit and transfer reflection addressed - offered/declined/already covered/not applicable as appropriate
- [ ] `devpost/app-map.html` generated from finished code, checked, and shown, including a project-grounded practice to reuse

Activity and evidence:
Route and stops:
Edit outcome:
Reflection:
Activity mode:

## Revisions

- Market strip became a running tape of 12 major quotes with expandable market news; paper got grain, a faint printed chart and torn edges - Dima's design feedback at the slice 1 checkpoint ("all known quotes as a running line", "news short, click to open", "background not monotone, edges like a newspaper"). PRD Look and Feel, Market strip and spec Market Strip Service, Look and Feel updated.
- Paper texture is now a Higgsfield image instead of a CSS-drawn chart; "+" became a small "read more"; torn edges made gentler - Dima's second design feedback ("plus too big", "edges too ragged", "background charts look ugly, use design skills or generate images"). Higgsfield cost measured: 0.25 credits per image on gpt_image_2_5.
- Council (5 advisors + peer review) on design and contest fit; Dima agreed: stamp replaces the traffic light, 4 quotes instead of 12, a closed "Show the editor's notes" with cited dispatches. Also: result moved above the fold (ask form became one line), engraved manicule replaces the arrow, bull/bear/hamster engravings generated now (moved from slice 5), edition name in the masthead, paper texture without the chart (Dima). Higgsfield spent 4 credits in total so far (663 -> 659).
