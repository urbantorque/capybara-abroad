---
name: capy3-the-number
description: "B14: notoriety, why two of the roadmap's four terms were wrong, how a tier table gets calibrated, and the save fixture that cannot be written from a running game"
metadata: 
  node_type: memory
  type: project
  originSessionId: 0399a747-7207-4778-9720-3ffe4ce144bc
  modified: 2026-09-07T14:24:20.335Z
---

Item 6's number, arrival headline, ledger and ending, built 8 Sep 2026 as
`76b3e2b`. B15 (gossip pools + the wanted poster) is the last batch of
ROADMAP-FUN.

**FOUR COUNTERS WERE ON THE SAVE AND NOTHING READ THEM.** `inc`/`scn` since
P3, `pho`/`fed` since B8 — written, saved, restored, shown nowhere. Before
building a projection, check whether the thing being projected has ever been
displayed; two of the four had not.

**A TIER TABLE CALIBRATED ON NOTHING IS A GUESS DRESSED AS A NUMBER.** The
item named five tiers and zero boundaries. Both ends were measured:

- a random masher, six minutes over four chapters → **2 incidents, 1 scene**
- a DIRECTED troublemaker (grab nearest prop, throw it at nearest person,
  every 0.9 s) → Sydney 132 throws / 3 inc / 2 scn in four minutes
- **the ceiling is structural, not behavioural: `sysINC_COOL` is 50 s.** The
  game will not pay a second card inside a minute however chaotic it gets —
  which is what makes a tier table possible: the number cannot run away from
  a player who finds an exploit, because the exploit is a clock.

Twelve minutes of maximum-effort trouble scored 17. Boundaries landed at
3 / 11 / 26 / 48 / 82.

**A MASHER IS THE WRONG INSTRUMENT FOR "HOW FAST CAN A PLAYER EARN X".** It
holds keys at random and almost never picks something up and throws it. Write
a directed probe for the ceiling and use the masher for the floor.

**TWO OF THE ROADMAP'S FOUR TERMS WERE THE WRONG KIND OF NUMBER.** Records
beaten and finds are COMPLETION, not consequence — 60 of each, collected by
being thorough, and the tally and the shelf already count thoroughness twice.
The missing term was **spread** (how many chapters have any trouble in them),
which is the one that makes it a thread rather than a counter. And a scene
needed no weight: a five-chain increments BOTH tallies, so a plain sum is 2:1
by construction. Same family of finding as [[capy3-measure-the-premise]].

**A PROBE IS PART OF THE EXPERIMENT, TWICE OVER.**
- `physRelease` takes an impulse VECTOR; passing B10's scalar multiplier gives
  `set(undefined,undefined,undefined)`, a NaN body, and **1094 non-finite
  AudioParam errors**. The console was full of a defect that did not exist.
- A grab loop that retries the same immovable prop threw once in 240 s in
  Sydney against 128 in Venice. Skip a prop that refuses.

**A SAVE FIXTURE CANNOT BE WRITTEN FROM A RUNNING GAME.** `pagehide` flushes
the save and `page.reload()` fires `pagehide`, so writing a 231-tick fixture
and reloading writes the LIVE state back over it. Write it from a page that
has not started a game. Related: **the `page.mouse.click(400,400)` that opens
every probe in this repo presses *start a new journey* on the title card** —
which is why `qa/pf2-finale.js` does not click.

**"ARMED AND NEVER SAID" IN A NEW COSTUME.** The arithmetic probe reported a
scene was worth nothing: 4 incident chains scored 5, 2 scene chains scored 5.
Both were right; the DIFFERENTIAL was wrong (four chains against two). Hold
the denominator fixed and upgrade some of them. See
[[capy3-routine-and-blame]] for the same lesson about gates.

**UI, MEASURED BY EYE.** A tier name broke across a line on a 390 px phone —
fixed with a non-breaking space, written as ` ` because a literal U+00A0
in source is invisible. The final ledger said the tier twice (chip + sentence)
and the chip now drops out. And `opacity:.85` on `accentInk` undoes the whole
reason that constant exists: it is `#9e5f53` for 4.62:1, where the game's
accent is 2.31:1.

**THE PLACE CARD HAS NEVER ONCE BEEN ANNOUNCED** — arrivals, act breaks,
marquee banners and the finale, all in a plain div, under a white that is
deliberately `aria-hidden` on the grounds the name is "said out loud a moment
later". It is `aria-live="polite"` now.

Instruments: `qa/noto-premise.js`, `qa/noto-ceiling.js`, `qa/the-number.js`,
`qa/the-number2.js`, `qa/the-number3.js`, `qa/b14-shots.js`, `qa/b14-clean.js`.
`game.hud.notoAudit()` and `game.hud.forceNoto(inc, scn, chapters)` are new.

Related: [[capy3-measure-the-premise]], [[capy3-routine-and-blame]],
[[capy3-the-place-remembers]], [[capy3-headless-qa-harness]]
