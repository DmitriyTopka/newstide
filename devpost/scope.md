---
doc: scope
status: approved
---

# NewsTide

Before a trade, a crypto trader states their plan, and the assistant pulls the whole news background into one clear conclusion: does it support the plan or work against it, and why.

## The Unique Kernel
Everything in one place, already analyzed and tailored to how *you* trade: news, macro data, statements by influential people, geopolitics, and news from the coin's own project and community. It is all reduced to one short, concrete conclusion: the direction and the reason in a few words ("for a medium-term plan: this way, because of X"), checked against the trade you are about to make. Nobody should have to read and reread a wall of text; that would defeat the purpose. It is an indicator, and simplicity is the core: as easy to understand as an RSI indicator is for any person (the comparison is about simplicity only, not about looking like RSI). The simpler it is and the fewer moving parts it has, the easier and more interesting it is for another person.

## Who It's For
The learner himself: a trader on spot and futures, usually trading coins from the top 100. He does technical analysis well (patterns, retests, Fibonacci levels, buyer/seller blocks, highs and lows, liquidity sweeps), but he cannot cover the entire news flow and turn it into one conclusion. In his words, there are gaps in his knowledge of how macro data and geopolitics move the market, and "this is where it often lets me down." Today he tries to piece the background together himself; "only top specialists can analyze all this and bring it together."

## The Core Loop
1. He is about to enter a trade: picks a coin, says long or short, and picks the timeframe he is trading (the timeframe decides intraday vs medium-term analysis).
2. The assistant gathers the relevant news and data for that coin and that horizon (about 20 items).
3. It compresses them into one short conclusion: a direction, whether it supports or contradicts the plan, and the reason in a few words.
4. He makes his decision with the background in view.

He comes back before every trade.

## Inspiration & Identity
- Simple and understandable for anyone. Not bright, not complicated.
- Reference: an RSI indicator, only for its simplicity and clarity. It does not have to look like RSI.
- Fewer moving parts: as little motion and clutter as possible.
- Inspired by Elon Musk's projects: an unconventional approach, building something new that helps people.

## Why This Matters to the Learner
It targets his own weakest spot as a trader: "the news background, geopolitics, macro data, the stock market, how all of this affects the crypto market. It often goes completely differently from how you plan." He wants to build something other people will use and enjoy.

## What "Working" Looks Like
He picks a coin, enters a long or short plan and the timeframe, and within a minute sees:
- one short conclusion: direction, and the reason in a few words;
- whether the background supports or contradicts his plan;
- a short note where it may play out differently on spot vs futures.

The "oh, that's cool" moment: about twenty scattered headlines collapse into one short line that anyone understands at a glance, such as "your plan is long, the background says down, because of X" (or it confirms the plan).

## The POC Boundary
- Coins: ETH, SOL, AAVE.
- Both horizons, chosen by the chart timeframe: below 4h means intraday news and statements of the day; 4h and above means project data, macro and the wider background.
- One combined view for spot and futures, with a note where they may differ.
- A separate simple web page.
- Input: coin, long/short, timeframe. Output: short conclusion, verdict vs plan, spot/futures note.

## Later
- Any coin from the top 100.
- A TradingView indicator: analyzes the coin on the chart the user is viewing, reacts to the timeframe, may show arrows and an RSI-like line. Needs an outside service, because Pine Script indicators cannot fetch news or call an AI model themselves (to verify in `4-spec`).

## Explicitly Cut
- Separate spot and futures analyses: not needed, the learner said one view with a note is enough.
- Long explanations and cause-and-effect essays: the learner wants a few words, not reading.
- A guaranteed correct forecast: no tool can promise it, and a demo video cannot prove it. The assistant gives a reasoned opinion with causes.

## Open Questions for the PRD
- Probability in percent: a language model would invent the number. Remove it, replace it with words (for example "background leans bullish, medium confidence"), or show both with a label. The learner wants this weak spot either removed or made strong.
- The visual form of the indicator on the simple page (simple, understandable for anyone, not necessarily RSI-like).
- Whether the ~20 collected items are visible at all (for example hidden behind the conclusion), given the rule "don't make people read a lot".
