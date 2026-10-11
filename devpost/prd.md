---
doc: prd
status: approved
---

# NewsTide - Product Requirements

NewsTide ("the tide of news": where the wave of the news background is carrying the coin) is a one-page indicator for a crypto trader: before a trade he picks a coin, long or short, and a timeframe, and gets one simple verdict on the news background, shown as an arrow, a traffic light and a few words.
Source: `scope.md > The Unique Kernel`, `scope.md > Who It's For`.

## The Core Journey
Develops `scope.md > The Core Loop` and `scope.md > What "Working" Looks Like`.

1. He opens the page. At the top he sees a market strip: Bitcoin price, Nasdaq, the main news of the day and of the week.
2. First use: he is offered to connect his X account, with a short explanation of why (news from X is read through his account; X is where information appears first). He can connect or skip.
3. In the center he types a coin. Suggestions appear so the coin is entered correctly. In this version the list holds ETH, SOL and AAVE.
4. He chooses Long or Short.
5. He chooses the timeframe. Below 4h means intraday analysis; 4h and above means medium-term analysis.
6. He presses **Get data**. The page shows how much time is left while the background is gathered, up to one minute.
7. The result appears at the bottom: an arrow, a traffic light, a short verdict, a bull, a bear or a hamster, and the whole page tints green, red or yellowish.
8. He makes his trade decision and comes back before the next trade.

## Screens and Layout
One page, top to bottom:
- **Market strip (top):** Bitcoin price, Nasdaq, main news of the day and the week. Nicely designed and easy to read, so the page does not look empty.
- **Input area (center):** coin field with suggestions, Long/Short choice, timeframe choice, in this order, then the **Get data** button.
- **Result (bottom):** the indicator.
- **Theme switch:** dark or light background, chosen by the user.
- **X connection:** offered on first use, with the reason; can be skipped.

## Look and Feel
- Simple and understandable for anyone; not bright, not complicated; few moving parts. RSI is the reference for simplicity only, the indicator does not have to look like RSI (`scope.md > Inspiration & Identity`).
- Not boring or bland: the market strip fills the page with live context.
- The paper is not a flat color: newsprint grain and a faint printed market chart showing through; the page edges are slightly torn and uneven, like a real newspaper lying on a table.
- Dark and light themes.
- The whole page reacts to the verdict: light green when the background is bullish, red when it is bearish, light yellowish when neutral.
- A smiling bull next to the arrow when bullish; a cheerful bear when bearish ("if the mood is bearish, the bear is happy"); a hamster when neutral.
- **Stamp instead of a traffic light** (council, Dima agreed): a round ink stamp "The background FAVOURS / MIXED ON / AGAINST your plan", green, ochre or red. The word also helps colour-blind readers.
- **Pointing hand instead of a plain arrow:** an engraved printer's manicule that turns up, down or sideways.
- **Edition name** in the masthead: Bull Edition, Bear Edition, Hamster Edition.
- **Result on the first screen:** the ask form is one line under the market tape, the verdict is the lead story above the fold.
- **Newspaper style:** the site should look like an old printed newspaper being opened: news columns, a newspaper feel, clearly about crypto and news. It must not look like a typical AI-generated website.
- **Illustrations:** the bull, the bear, the hamster, the arrows and similar elements are custom images in the newspaper style, generated with the learner's Higgsfield account (credit cost to be checked in `4-spec` before generating).

## Features and Behavior

### Coin input
- As the trader, I want suggestions while typing a coin so that I pick exactly the coin I mean.
  - [ ] Typing "et", "so" or "aa" suggests ETH, SOL or AAVE.
  - [ ] Only coins from the list can be submitted.

### Plan and timeframe
- As the trader, I want to state long or short and my timeframe so that the verdict is checked against my plan and my horizon.
  - [ ] Long/Short and a timeframe can be chosen after the coin.
  - [ ] A timeframe below 4h produces an intraday analysis; 4h and above produces a medium-term analysis.

### The indicator (result)
Develops `scope.md > The Unique Kernel`.
- **Pointing hand:** where the background points: up, down, or sideways when neutral.
- **Stamp:** whether the background supports the plan: FAVOURS (green), MIXED ON (ochre), AGAINST (red).
- **Editor's notes:** closed by default; open on click to show the cause-and-effect chain with cited dispatch numbers and titles.
- **Verdict text:** a few words only, for example "growth expected for this coin", "neutral for now", or "correction".
- **Bull, bear or hamster** next to the arrow, and the page tint.
- **Spot/futures note:** a short note where it may play out differently on spot vs futures (`scope.md > The POC Boundary`).
- No percentages. No list of news. No long explanations.
- As the trader, I want one glance to tell me if the background is with my plan or against it, so that I do not have to read and connect dozens of news myself.
  - [ ] After the three choices, the result shows an arrow, a traffic light and a verdict of a few words.
  - [ ] Long on a coin with a bearish background shows an arrow down, a red light, a cheerful bear and a red page.
  - [ ] Long on a coin with a bullish background shows an arrow up, a green light, a smiling bull and a light green page.
  - [ ] Neutral background shows an arrow sideways, a yellow light, a hamster and a light yellowish page.
  - [ ] No number in percent appears anywhere in the result.

### Waiting for the result
- As the trader, I want to see how long the gathering will take so that I know the page is working.
  - [ ] After pressing Get data, the page shows the time remaining.
  - [ ] The result appears within one minute.

### Background gathering (hidden from the user)
The mechanics are not shown, but they are the heart of the product and must be worked out carefully. Sources in this version:
- the coin's official open Telegram channel;
- the coin's X, read through the user's connected X account;
- macroeconomic sites (for example Investing);
- general crypto market news.

Inside, the indicator builds a logical chain: one factor affects another, that affects a third, down to our coin, plus the coin's own news (what is planned, what is done) and how it may affect the price.
- [ ] For each of ETH, SOL, AAVE the gathering uses the coin's Telegram channel and the other sources above.

### Market strip
- [ ] The top of the page shows a running line of 4 quotes: Bitcoin, Ether, S&P 500, dollar index. It scrolls, fades out at the edge and repeats.
- [ ] Main news of the day and the week are short headlines; clicking one opens a short summary and a link to the full story. These are market-wide news, not tied to one coin.

### X connection
- [ ] On first use the page offers to connect X and explains why.
- [ ] Without X, the indicator still gives a verdict from the other sources, with a note that X is not connected and that X is one of the main sources, where information appears first.

## States and Boundaries
- **First use:** X connection offer with the reason; skip is allowed.
- **Without X:** verdict from the other sources plus the "X not connected" note.
- **Bullish result:** arrow up, light green page, smiling bull.
- **Bearish result:** arrow down, red page, cheerful bear.
- **Neutral result:** arrow sideways, yellow light, light yellowish page, hamster.
- **Waiting for the result:** time remaining is shown after Get data; up to one minute, faster if `4-spec` finds a way.

## Product Decisions
- No percentages: a model would invent the number; the learner called them "a bad idea" and chose a graphical direction.
- Arrow plus traffic light together: the arrow shows direction, the light shows support for the plan.
- News list is not shown: "the main thing is that a person sees just the conclusion"; the gathering is hidden. Exception agreed after the council: a closed "Show the editor's notes" line under the verdict opens the reasoning chain with the numbers of the cited dispatches, so a judge can see the verdict is not invented.
- Name NewsTide: chosen from checked candidates; CoinPulse was rejected as heavily used (535 GitHub repos, an App Store crypto tracker, a Coinpulse token platform), and three-letter acronyms as mostly taken.
- Neutral is a light yellowish page with a hamster.
- Waiting shows the time remaining, up to one minute.
- Newspaper-style design with custom illustrations: the review page looked "written by AI"; the learner wants a look tied to crypto and news, like an old newspaper.
- Three coins now (ETH, SOL, AAVE), with suggestions; the list must be easy to extend later.
- Telegram instead of Discord: Discord is closed to non-members; the official Telegram channel is open.
- The official website is skipped: projects usually do not publish news there.
- X through the user's account; without X the indicator still works, with a note.
- The timeframe decides intraday vs medium-term analysis. Picker: 15m, 1h, 4h, 1d.
- A "Not financial advice" line is always on the page.
- Separate simple page now; TradingView later.

## What We're Building
- One page with the market strip, coin input with suggestions (3 coins), Long/Short, timeframe, and the indicator result.
- Dark and light themes; page tint and bull/bear by result.
- Background gathering from Telegram, X (when connected), macro sites, crypto news, reduced to one verdict.
- X connection offer and the "without X" fallback.

## Deferred From the POC
- Full coin list from CoinMarketCap: each coin needs its own Telegram and X sources; three coins prove the idea. The list must be extendable.
- Discord: closed to non-members.
- Geopolitics, stock market news, Bitcoin dominance, gold, oil: second stage, after the first sources work.
- TradingView indicator: Pine Script cannot fetch news itself (to verify in `4-spec`).

## Possible Later Enhancements
- Any coin from the top 100.
- TradingView indicator that reads the coin and timeframe from the chart, with arrows and a simple line.

## Non-Goals
- A guaranteed correct forecast: no tool can promise it.
- Percent probabilities: invented numbers.
- Showing the collected news or long explanations: defeats "one glance".
- Separate spot and futures analyses.

## Open Questions
- **Reading X through the user's account:** whether X allows it for free is unknown; check in `4-spec`.
- **Investing and news sites as sources:** which can be read freely and fairly; check in `4-spec`.
