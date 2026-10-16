---
doc: spec
status: approved
---

# NewsTide - Technical Spec

## How This Works, In Plain Language
NewsTide is two small pieces running on Dima's Mac.

1. **The page** is what you see in the browser: a newspaper-style front page with the market strip on top, the coin field, Long/Short, the timeframe, the **Get data** button and the indicator at the bottom. It is plain HTML, CSS and JavaScript, no framework (a framework is "a pile of decisions already made for you"; one page does not need it).
2. **The little server** is a program on the same Mac. When you press Get data, the page asks the server. The server reads the news feeds (official project blogs and forums, crypto news, Investing, the US Federal Reserve), cuts them down to what matters for your coin and timeframe, and sends them to the AI model with one question: "given this background, where does the tide carry this coin, and is it with or against this plan?" The model answers in a fixed shape (direction, whether it fits the plan, a few words, and the reasoning with citations). The server passes that back to the page, together with what the answer cost.

Why a server at all: the Anthropic key must never be inside the page (anyone could read it), and many sites do not hand their feeds directly to a browser. Why nothing bigger: one person, one Mac, one video. No accounts, no database, no hosting.

You start it with one command, `npm start`, and open `http://localhost:3000`. Nobody outside your Mac can reach it.

## The Core Journey Through the System
PRD ref: `prd.md > The Core Journey`.

1. You open `localhost:3000` → the page asks the server for `/api/market` → the server fetches Bitcoin and Ether (CoinGecko), the S&P 500 and the dollar index (Yahoo Finance) and the newest headlines → the strip fills in.
2. The page shows the X connection notice → in this version X is not built, so the notice says X is not connected and why it matters (see `What Was Simplified and Why`).
3. You type a coin → the page suggests from the coin list it got from `/api/coins` (ETH, SOL, AAVE) → only a listed coin can be submitted.
4. You choose Long or Short → kept in the page.
5. You choose the timeframe → kept in the page; below 4h means intraday, 4h and above means medium-term.
6. You press Get data → the page sends `{coin, plan, timeframe}` to `/api/analyze` and starts a countdown from 60 seconds.
7. The server gathers: the coin's official feeds plus market-wide feeds, keeps items from the last 24 hours (intraday) or the last 14 days (medium-term), numbers them, and sends them to the model.
8. The model returns `direction`, `plan_fit`, `verdict`, `spot_futures_note` and a hidden `chain` of cause and effect that cites item numbers.
9. The server checks the answer against the rules (see `Answer Checker`), computes the cost from the token counts, saves the full run to a log file, and returns the visible parts plus the cost.
10. The page shows the pointing hand, the stamp, the verdict, the bull, bear or hamster, tints the page, and updates the cost counter.

## Stack
- **Node.js 24** (installed: v24.14.1) runs the server. Its built-in `fetch` reads feeds; built-in `--env-file` loads `.env`, so no extra library for that. Docs: https://nodejs.org/docs/latest-v24.x/api/
- **Express 5** for the few server routes. Docs: https://expressjs.com/
- **fast-xml-parser** to read RSS feeds. Docs: https://github.com/NaturalIntelligence/fast-xml-parser
- **@anthropic-ai/sdk** (official Anthropic SDK for JavaScript) to call the model. Docs: https://docs.claude.com/en/api/client-sdks
- **Plain HTML, CSS, JavaScript** for the page.
- **Model:** `claude-haiku-5-5` for tests, `claude-sonnet-5-5` for the video and the final version, switched with one setting `MODEL` in `.env`. Learner decision; prices from the Claude API reference (cached 2026-10-06): Haiku 5.5 $0.10 / $0.50, Sonnet 5.5 $2 / $10 per million input / output tokens.
- **Fallback on refusal:** for Sonnet 5.5 the request includes the server-side `fallbacks: "default"` option (beta `server-side-fallback-2026-07-01`), so a rare safety refusal reroutes instead of failing. Haiku has no server-side fallback.
- **Version numbers** of Express, fast-xml-parser and the SDK: to pin at `npm install` in step 1 of the build (not verified yet).

## Where It Runs and How Someone Tries It
- Runs only on Dima's Mac, in the browser at `http://localhost:3000`. Learner decision: a public link could let strangers spend the Anthropic balance.
- Needs: Node.js 24, a `.env` file with `ANTHROPIC_API_KEY`, `MODEL`, `DATA_MODE`. A secret-free `.env.example` is committed; `.env` is in `.gitignore`.
- Start: `npm install` once, then `npm start`.
- Demo recording: `DATA_MODE=live`, `MODEL=claude-sonnet-5-5`, record the screen while running ETH Long 1h, SOL Short 4h, AAVE Long 1d.
- Submission: public GitHub repository plus a 1-3 minute video. No deployment.
- Public repository: https://github.com/DmitriyTopka/newstide (published 2026-10-11, checked without login).
- Demo video: https://youtu.be/9dTlaGs665U (public on YouTube, 1:47, recorded 2026-10-13 on live news). A server for other people is deferred (`What Was Simplified and Why`).

## Public Demo (Replay Mode)
Added 2026-10-16 after the pre-ship council. `REPLAY=1` makes `POST /api/analyze` answer from `data/replay/editions.json`: six archived editions, real runs on live news from 13 and 16 October 2026 (one per coin and horizon). The stamp is recomputed for the visitor's plan with the same rule as the Answer Checker. The AI client is never loaded, so the demo needs no key and costs nothing. The page shows a demo banner and "Archived edition of <date>". Deployed on Vercel (free) at https://newstide-paper.vercel.app via `api/index.js`; live mode still runs locally with `npm start`.

## Look and Feel
Carries `prd.md > Look and Feel` and `scope.md > Inspiration & Identity`.
- **An old printed newspaper being opened.** Off-white newsprint background, black ink, thin column rules, a masthead "NewsTide" at the top like a newspaper title, date line under it.
- **Typography:** a classic newspaper serif for the masthead and headlines (for example Old Standard TT or Playfair Display from Google Fonts), a readable serif for small text. Uppercase small labels like section names.
- **Market strip** as a running tape under the masthead: Bitcoin, Ether, S&P 500, dollar index, then "Today" and "This week" headlines in narrow columns.
- **Dark theme** as a "night edition": dark paper, light ink. A small switch in the masthead corner.
- **Verdict tints:** the paper washes light green (bullish), red (bearish), light yellowish (neutral). Gentle color, not bright.
- **Pointing hand** (engraved manicule, `public/img/hand.jpg`, rotated by CSS) and **round ink stamp** (inline SVG with a rough-edge filter) replace the arrow and the traffic light.
- **Engravings** are black ink on white, blended into the paper with `mix-blend-mode: multiply`; in the night edition they are inverted.
- **Bull, bear, hamster:** engravings generated with Higgsfield (gpt_image_2_5, bear and hamster from the chosen bull as a style reference). Done in slice 1 after the council; cost 3 credits for all 12 variants.
- **Paper:** a newsprint texture with faint ghost text columns (no chart, per Dima), generated with Higgsfield (`public/img/paper.jpg`, gpt_image_2_5, 0.25 credits per image), tinted by the verdict with a multiply blend; torn, uneven page edges (CSS clip-path drawn once per load) on a darker "table" background.
- **Few moving parts:** the market tape scrolls (Dima's request; pauses on hover, static when the system asks for reduced motion); otherwise only the countdown and one soft fade of the result.
- **Disclaimer:** a "Not financial advice" line in the newspaper footer, always visible.
- **Copy tone:** newspaper headline style, a few words: "GROWTH EXPECTED FOR ETH", "NEUTRAL FOR NOW", "CORRECTION".

## Components

### Page
`public/index.html`, `public/styles.css`, `public/app.js`. Shows masthead, market strip, inputs, countdown, result, cost counter. Holds the three choices in memory; nothing is stored between visits except the theme choice (browser `localStorage`).
PRD ref: `prd.md > Screens and Layout`, `prd.md > Coin input`, `prd.md > Plan and timeframe`, `prd.md > Waiting for the result`.

### Indicator View
Part of `public/app.js`: turns the answer into pointing hand, stamp, verdict, animal, page tint, spot/futures note and the "X not connected" note.
- direction `up` → hand points up, bull, green tint; `down` → hand points down, bear, red tint; `sideways` → hand points sideways, hamster, yellowish tint.
- plan_fit `supports` → green light; `mixed` → yellow; `against` → red.
PRD ref: `prd.md > The indicator (result)`, `prd.md > States and Boundaries`.

### Cost Counter
Small line under the result: "This analysis: $0.02 · This session: $0.10". Session total lives in page memory and resets on reload.
PRD ref: learner decision in `4-spec` (see `Decisions and Open Issues`); supports the business model in `prd.md > Possible Later Enhancements`.

### Market Strip Service
`server/market.js`, route `GET /api/market`. A running tape of 4 quotes (cut from 12 after the design council): Bitcoin and Ether from CoinGecko; S&P 500 (^GSPC) and dollar index (DX-Y.NYB) from Yahoo Finance; each headline carries a short summary and link from its feed, opened on click; "Today": 3 newest crypto headlines from the last 24 hours (Cointelegraph, CoinDesk); "This week": 3 newest macro items from the last 7 days (Federal Reserve, Investing, MarketWatch). Cached for 5 minutes.
PRD ref: `prd.md > Market strip`.

### Coin Registry
`config/coins.json`, route `GET /api/coins`. Each coin: symbol, name, CoinGecko id, list of official feeds. Adding a coin means adding one entry, which keeps the list extendable.
PRD ref: `prd.md > Coin input`, `prd.md > Product Decisions` (three coins, extendable list).

### Feed Collector
`server/collect.js`. Reads the coin's official feeds and the market-wide feeds, parses them with fast-xml-parser, keeps title, link, date, source and a short summary, filters by horizon (24 hours or 14 days), removes duplicates, keeps at most about 30 items, numbers them `#1, #2...`. A feed that fails is skipped and listed as missing.
In `DATA_MODE=sample` it reads a saved, clearly labelled snapshot from `data/sample/` instead of the internet, so tests cost nothing extra and give the same input every time.
PRD ref: `prd.md > Background gathering (hidden from the user)`.

### Analyst
`server/analyst.js`. Sends the numbered items, the coin, the plan and the horizon to the model with a fixed instruction and a structured output schema. The instruction asks the model to build the chain from the wider picture (macro, market) down to the coin, citing item numbers, and to judge only from the given items.
PRD ref: `prd.md > The indicator (result)`, `prd.md > Background gathering (hidden from the user)`.

### Answer Checker
`server/check.js`. Checks every answer before it reaches the page:
- all fields present, values from the allowed lists;
- verdict is at most 6 words and has no percent sign;
- plan_fit agrees with direction and plan: Long + up = supports, Long + down = against, Short + down = supports, Short + up = against, sideways = mixed;
- every chain step cites at least one item number that exists in the batch.
If the plan_fit rule is broken, the checker corrects plan_fit from the rule and logs it. If citations are invalid, it logs a warning.
PRD ref: `prd.md > The indicator (result)`; serves the learning outcome (see `Decisions and Open Issues`).

### Run Log
`server/log.js`. Saves each run to `runs/<time>-<coin>.json`: input, collected items, full model answer including the hidden chain, checker result, tokens, cost. The chain is never shown on the page, but Dima can open the file to see why the indicator said what it said. `runs/` is in `.gitignore` except one example run.
PRD ref: `prd.md > Background gathering (hidden from the user)`.

## Data Model
- **Request** `POST /api/analyze`: `{ "coin": "ETH", "plan": "long", "timeframe": "1h" }`.
- **Item** (inside the server): `{ "n": 1, "source": "Federal Reserve", "kind": "macro|crypto|project", "title": "...", "date": "ISO", "link": "...", "summary": "..." }`.
- **Model answer** (structured output):
  `{ "direction": "up|down|sideways", "plan_fit": "supports|mixed|against", "verdict": "...", "spot_futures_note": "...", "chain": [ { "step": "...", "cites": [3, 7] } ] }`.
- **Response to page**: `{ "direction", "plan_fit", "verdict", "spot_futures_note", "notes": { "chain": [{ "step", "cites" }], "dispatches": [{ "n", "title", "source" }] }, "x_connected": false, "missing_sources": [], "cost": { ... } }`. The chain is sent for the closed editor's notes.
- **Where data lives:** feeds are fetched fresh each time (market strip cached 5 minutes in server memory); runs are files in `runs/`; session cost and the three choices live in the page and disappear on reload; theme choice lives in `localStorage`. Nothing else persists.

## File Structure
```
app/
├── package.json          # scripts: start, test; dependencies
├── .env.example          # ANTHROPIC_API_KEY=, MODEL=claude-haiku-5-5, DATA_MODE=sample
├── .gitignore            # .env, devpost/learner-profile.md, node_modules, runs/*
├── README.md             # what it is, how to run, sources, limits
├── config/
│   ├── coins.json        # ETH, SOL, AAVE with official feeds
│   ├── feeds.json        # market-wide feeds (crypto, macro)
│   └── prices.json       # model prices per million tokens for the cost counter
├── server/
│   ├── index.js          # Express app, routes, serves public/
│   ├── market.js         # Market Strip Service
│   ├── collect.js        # Feed Collector (live and sample)
│   ├── analyst.js        # Analyst: prompt, schema, model call
│   ├── check.js          # Answer Checker
│   └── log.js            # Run Log
├── public/
│   ├── index.html        # the newspaper page
│   ├── styles.css        # newspaper look, themes, tints
│   ├── app.js            # page logic, Indicator View, Cost Counter
│   └── img/              # bull, bear, hamster from Higgsfield
├── data/sample/          # saved snapshot of feeds, labelled SAMPLE
├── runs/                 # run logs (one example committed)
├── test/
│   └── check.test.js     # Answer Checker rules, no model calls
├── agent/, .agents/, .claude/   # Skill Pack (course material)
└── devpost/              # scope, prd, spec, checklist
```

## External Services and Dependencies
All free unless marked. Checked from Dima's Mac on 2026-10-11.

- **Anthropic Messages API** (paid, Dima's balance). `POST https://api.anthropic.com/v1/messages` through the SDK `client.messages.create({ model, max_tokens, output_config: { format: { type: "json_schema", schema } }, messages })`. Key in `.env`. Cost estimate per analysis (about 8 000 input, 500 output tokens): Haiku 5.5 about $0.001, Sonnet 5.5 about $0.02; real cost measured on the first run. Docs: https://docs.claude.com/en/api/messages
- **CoinGecko** simple price, no key: `GET https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,aave&vs_currencies=usd` → `{ "bitcoin": { "usd": 82978 } }`. Free tier has rate limits; the 5-minute cache keeps us far below. Docs: https://docs.coingecko.com/
- **Yahoo Finance chart** (unofficial, no key): `GET https://query1.finance.yahoo.com/v8/finance/chart/%5EIXIC?range=1d&interval=1d`, needs a browser User-Agent. May stop working without notice.
- **Official project feeds (RSS):** Ethereum blog `https://blog.ethereum.org/feed.xml`, Ethereum Magicians forum `https://ethereum-magicians.org/latest.rss`, Solana news `https://solana.com/news/rss.xml`, Solana forum `https://forum.solana.com/latest.rss`, Aave governance forum `https://governance.aave.com/latest.rss`.
- **Crypto news (RSS):** Cointelegraph `https://cointelegraph.com/rss`, CoinDesk `https://www.coindesk.com/arc/outboundfeeds/rss/`.
- **Macro (RSS):** Federal Reserve press releases `https://www.federalreserve.gov/feeds/press_all.xml`, Investing news `https://www.investing.com/rss/news_95.rss`, MarketWatch top stories `https://feeds.content.dowjones.io/public/rss/mw_topstories`.
- **Higgsfield** (Dima's account, credits): image generation for the 3 illustrations, model Recraft V4.1. Balance 663 credits on 2026-10-11; cost per image not shown by the tool, to measure on the first image and show Dima before generating the rest.
- **X API** (paid, not built now): pay per use, about $0.005 per post read according to third-party sources; no free reads.

## Important Failure Modes
- **A feed is down or empty** → it is skipped; the analysis runs on the rest; the server lists it in `missing_sources`, and the page shows a small "source unavailable" note.
- **All coin feeds and news fail** → no verdict; the page says "Not enough news to judge right now, try again later". The model is not called, so no money is spent.
- **The model is slow or errors** → the countdown reaches zero, then the page says "Took too long, try again". The server stops waiting at 60 seconds.
- **Yahoo or CoinGecko fails** → that cell in the market strip shows "no data"; the rest of the page works.
- **The model breaks a rule** (percent in the verdict, wrong plan_fit) → the Answer Checker fixes plan_fit from the rule, trims the verdict, and logs it.

## What Was Simplified and Why
- **Official blogs and forums** instead of official Telegram channels: ETH, SOL and AAVE have no open official Telegram channels with readable previews (checked: public addresses empty, solana.com links only to private invite groups, aave.com has no Telegram link). Learner decision: official sources only.
- **No X now:** reading X costs money (no free reads) and the sign-in screen is the riskiest part. The page keeps the "X not connected" note from the PRD. Learner decision: connect X as the last step before shipping, and decide on payment then. The fuller version needs an X developer account, credits, and X sign-in.
- **Three coins in a config file** instead of the full CoinMarketCap list: each coin needs its own official feeds. Adding a coin is one entry in `config/coins.json`.
- **Model fixed in settings** instead of a model picker, and **a cost counter** instead of a balance and payments. The fuller version: accounts, payment, per-user balance ("used N requests, spent $X, left $Y"), optional own keys. Learner decision: described in the submission as the business plan.
- **Runs on the Mac** instead of a server: nobody else uses it yet, and a public link risks the balance. Server later, with accounts and limits.
- **Sample data mode** for most of the build: a saved snapshot, clearly labelled, so tests are cheap and repeatable. The video uses live data.

## Decisions and Open Issues

**Learner decisions in this spec**
- Official blogs and forums replace Telegram; official sources only.
- X deferred to just before shipping; pay only then.
- Haiku 5.5 for tests, Sonnet 5.5 for video and final.
- Business model (pay us, everything on our side, visible balance; optional own keys) goes to Later and to the submission text.
- Cost counter in the prototype.
- Mac now, server later.
- Timeframes in the picker: 15m, 1h, 4h, 1d.
- A "Not financial advice" line is mandatory on the page (footer of the newspaper).
- Stack confirmed: plain page + small Node.js server.
- Design must not look like the review pages: the newspaper look is a priority in the build, and Dima checks it early.

**Implementation details derived from those decisions (agent)**
- Node.js 24 + Express + plain HTML/CSS/JS; fast-xml-parser for feeds; official Anthropic SDK; structured output schema; Answer Checker rules; Run Log; sample mode; 5-minute strip cache; 24 h / 14 day horizon windows.

**One genuine uncertainty: how do we check that the model did what we meant?**
Dima's learning goal is to check the model's work precisely. Nobody can check in advance that a forecast is right. What we can check, and will, is that the model followed our intent: (1) the answer has the right shape and no percentages; (2) the light agrees with the arrow and the plan by a fixed rule; (3) every step of the hidden chain points to a real collected item, so it is not invented. These are automatic checks in `test/check.test.js` and in the Answer Checker. During the build, Dima opens one run log in `runs/` and reads the chain himself to judge whether the reasoning makes sense.

**Prompt decision (Dima, after the pre-ship council)**
- When the wider picture is mixed but the coin's own official news is clearly positive or negative, that news decides the direction; sideways only when the coin's news is thin or balanced. Effect on the Sunday snapshot with Sonnet: SOL up, ETH and AAVE sideways.
- The video is recorded on a weekday with live news.

**Still open**
- Higgsfield cost per image: measure on the first image, show Dima before the rest.
- Library versions: pin at install.
- Yahoo Finance is unofficial; if it fails during recording, the S&P 500 and dollar index cells show "no data".
- X official pricing page: verify before paying.
