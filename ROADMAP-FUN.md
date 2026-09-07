# ROADMAP-FUN.md — the fun review, and six things that would lift the game a notch

> **B1-B7 ARE BUILT, 7 Sep 2026.**
>
> **B1** (`5060f0a`): `marquee:` on all nineteen chapters,
> `game.marqueePoint()`, the marquee line on the paper (1b), and the instrument
> (1f, `qa/first-five.js`) with its companions `qa/arrive-see.js` and
> `qa/marq-frame.js`. `qa/p6-static.cjs` now fails the build on a chapter with
> no marquee, a `say` that names a key, or anything but exactly one `wow`.
>
> **B2**: item 1a, the glimpse — the arrival lens swings onto the marquee and
> holds it, and declines where the marquee cannot be seen from the spawn. The
> marquee is in the arrival frame in 14 of 19 now, against 8 before. Item 1c
> turned out to be **built already and wrong about its own premise**; what
> shipped in its place is the half of it nobody had noticed — the countdown, on
> the signpost. Both items' claims are corrected in place below.
>
> **B3**: item 1e, measured and **refused as written** — the chart already
> marks the marquee at 0 m in 13 of 19 and 26 of the 30 minis are already
> within 40 m of a mark. What shipped instead is the one thing that was true
> underneath it: a ring round the mark the chapter is FOR. And half of 1d — the
> 150 s nudge is said by the nearest person now, through `game.sayNear`.
> `lead:` is deferred with a reason.
>
> **B4**: the pips — the chain is legible while it is open, and invisible when
> it is not. Item 2's other two bullets are corrected in place: the arrival
> tick is **refused** (F1 decided it in writing and the argument still holds),
> and the seeded-placement bullet is **three chapters and a city, not
> nineteen**.
>
> **B5**: the gags, measured — **sixteen of nineteen spawn rings already arm
> the incident chain**, and the two that never will are the two chapters with
> nobody in them. Hanoi was the one real hole and is fixed. Underneath it, a
> genuine bug: the witness test walked `game.npcs` with no chapter filter, so
> **twenty-seven of Sydney's thirty-eight counted as witnesses in the Drift**
> on a run that never went to Sydney. `game.peopleNear` now answers it.
>
> **B6**: the table, read. The driver now runs two passes — wander, and
> wander with E and Shift — and the second confirms B4 exactly: Iceland,
> Marrakech and Hong Kong all tick once the verb is pressed. **But the same
> driver gives 13, 10 and 11 across three runs, so the wander column carries
> +/-3 of noise and single-run comparisons of it are not evidence.** Kyoto is
> the one reproducible failure — four runs, both drivers, nothing ticked — and
> it was ORDERING: its nearest act-one row is 19 m and the paper offered the
> 98 m one first. One line moved; nothing in the world did.
>
> **B7**: sit and be noticed. The `photo` state existed and worked — on **at
> most three Sydney tourists and nowhere else**, one chapter of nineteen. The
> locals take the picture now, in all nineteen, gated on the loaf and on heat
> (a square you have made cross does not admire you). **The APPROACH is
> refused**: a local never writes its own x/z, they are fixed by design, and
> walking a hundred and fifty hand-placed people is not a three-hour batch.
>
> See CONTRACT.md for what each measured and the things that measured wrong
> first.
>
> **A STANDING NOTE ON THIS DOCUMENT.** It was written from a reading of the
> systems, not from measurement, and it says so at the top. **Seven of its
> claims have now been checked and failed** (eight with the gags): the count of marquees in act 2+,
> the phasing of the clocks, the existence of a stuck timer, the chart not
> marking the marquee, the minis having no chart presence, the incident chain
> being invisible (it has had a rising note since v51), and the first rows
> needing to be moved in nineteen chapters (five). **Measure the premise
> before building the item.** Every correction is made in place below rather
> than deleted, so a later batch inherits the correction and not the guess.
>
> **B0 — sitting a stranger in front of the title card — has not been
> done and no batch below replaces it.**

6 Sep 2026, revised twice the same day. Written after the character pass
(`ee4a0b2`) and the sound review (`8bfce6f`), from the design chair rather than
the art or audio one. Scope: not "what is broken" — fifty-odd passes have
answered that — but **"what would make a casual player laugh in the first
minute of any place, stay for the first five, and come back tomorrow"**. Three
read-only surveys of the tree (the verbs and props; the people; the meta loop),
the README, CONTRACT.md, every previous roadmap and the design memory. Every
claim below names the symbol it hangs on; line numbers move by the thousand
between batches, so grep the name.

**How this was reviewed, honestly.** It is a reading of the systems, not a
playtest with strangers. Nobody has yet timed a chapter or watched a first-time
player (v53 said so, and it is still true). Item 0 below is the one thing this
document cannot do for you.

**What the revisions changed.** The first draft's items 4–6 (a second lap, a
shareable postcard, a companion capybara) were about the player who has
finished; they are gone. The second draft's item 1 opened chapter doors early —
but the title card's picker is already ungated (`pickDefs` maps all of
`CHAPTERS`; only the in-game departures board reads `jrOpen`), so **a player
can start in any of the nineteen places**, and the real problem is not the door
out but the road *in*: in most chapters the reason the place exists is not on
the paper when you arrive. Items 1 and 2 are now about that, **for every world,
not just Sydney** — because every world is somebody's first.

---

## THE HEADLINE

**The game is a magnificent reactive diorama with a checklist in front of it —
and in most places the checklist hides the best thing in the room.**

Measured against what is there:

- **The marquee is not on the paper on arrival.** All nineteen chapters carry
  `acts:` now, and the paper shows *the lowest act with anything open*. The
  `wow` row sits in act 2 or 3 in **eighteen** of them — counted properly in B1,
  where "at least fifteen" was an estimate; only chapter 4's `uji-run` is in act
  one, and `qa/p6-static.cjs` now prints the split. So a player who picks
  Cappadocia from the title because they want to fly a balloon sees a card,
  three rows about pigeons, and no balloon.
  The arrival card's second line (`showPlace(title, sub)`) says where
  you are, not what it is for. ~~The chart marks landmarks (`sysMARKS`) but not
  the marquee.~~ **Wrong twice over, and measured in B3: `sysMARKS` is the TITLE
  PICKER's postcards, the chart is `sysMAP_WORLDS[biome].marks`, and its nearest
  mark to the marquee is 0.0 m in thirteen of nineteen chapters. What it did not
  do was say WHICH mark; it does now.** **The one thing every chapter was built
  around is the one thing the interface did not point at.**
- **Nobody has measured the first five minutes of any place.** Time to the first
  tick, to the first *sight* of the marquee, to the marquee itself, and where a
  player stalls — none of it exists (**built in B1: `qa/first-five.js`, and the
  starting line is at the foot of this document**). ~~There is no stuck timer
  anywhere.~~ **There is: `sysNUDGE_T`, a banked 150 s timer that says the top
  row's clue again, once per chapter, at `note` weight.** What it does not do is
  the rest of 1d — see there. Nine
  "be there when" marquees ride clocks of 54–205 s (`nextIn` is wired in seven
  chapters) and ~~none of those clocks is phased to your arrival~~ — **wrong,
  and measured in B2: all five chapters whose MARQUEE rides a clock re-phase it
  in their own `onEnter()`, against an authored constant, and the first window
  opens 32–81 s after you land.** What was missing was any way to KNOW: `nextIn`
  is rendered on the clue under the top row, and a clocked marquee is never the
  top row. See 1c below, and the B1/B2 timings in `qa/first-five.js`.
- **There is one economy and it is destructive.** Mischief is witnessed
  (`npcHeat`, the incident chain) and paid. Being a *capybara* — the calmest,
  most-photographed animal on the internet — pays nothing: `fam` takes 34 s of
  calm proximity to earn and buys a warmer line pool. Tourists have a `photo`
  state. **No NPC in the game ever gives the player anything.**
- **Fourteen verbs on six inputs, and most of them are states the world puts you
  in.** The player *chooses* four: move, hop, grab/throw, wheek. Throw is one
  fixed impulse (`capyTryRelease`: `5.0 + (run ? 2.0 : 0)` along `capyYaw`, no
  aim, no charge, no put-down). Of ~50 `physTYPES`, **one** is fragile
  (`cuencobowl`), **three** spill, `receive` is a shadow flag, and **no prop can
  be ridden, pushed, stacked or used as a tool**.
- **The people are an extremely good reaction machine with almost no volition.**
  Two chapters have a steering cast with jobs. The other fifteen have ~150
  *locals* whose job is `beat` — three cosmetic arm shapes that are "outranked
  by everything" and never fail. npc.js says of its own reaction layer: *it does
  not deny anything.* Nobody blames anybody; animals react only to the capybara.
- **Nothing crosses a chapter.** `jrChapInc`/`jrChapScene` are read only by the
  ledger. The Traveller (`addTraveller`) is the one recurring face, four
  chapters, four unrelated lines.

Two things already right that nothing below may touch: **the incident chain**
(three witnessed things in 12 s → AN INCIDENT; five → A SCENE) is the one
unscripted reward loop and it is good; and **the marquee law** (one `wow` per
chapter, sixteen lifts in the game) is what makes the payoffs worth anything.
Item 1 *points at* the marquee; it does not add a second one. And **nothing can
kill you** stays.

---

## 0. FIRST, WATCH SOMEBODY PLAY (2 h, no code)

Before any of the six: sit one person who has never seen it in front of the
title card, let them pick a place, say nothing, and take notes for ten minutes.
Then a second place. Write down the first thing they try that does nothing, the
first time they read the paper for instructions, whether they ever *see* the
marquee, the first laugh and the first sigh. Items 1–3 are *predictions* of
that list; the session either confirms them or replaces them.

---

## THE SIX

Ordered casual-first: 1–3 are cheap, structural, and pay in the first five
minutes of every place; 4–6 are the deeper toys that make the hours after that
funnier. Read the hours as batches of 2–3 h, one commit each.

### 1. THE ROAD TO THE MARQUEE — say what the place is for, then lead there (≈3 batches, 7–8 h)

*The argument.* Every chapter has exactly one line that is the reason it
exists, and the game already knows which (`wow:`). A casual player should
*see* it in the first thirty seconds, *know* it is the point by the first
minute, and be *on the way* by the third — without a tutorial, and without
touching the marquee law. Four mechanisms, all reading the `wow` row that is
already there.

- **1a. The glimpse. BUILT (B2).** `sysGlimpseShot`. It turned out to need four
  gates, not one — the bearing, the look-point RAISE (a bearing-only gate sent
  three chapters' marquees off the top of the screen), the sight line to the
  marquee and the sight line to the boom. The last two are what stop it: without
  them the frustum count is better (18/19 against 14) and Kyoto's first frame is
  a shop window at three metres. **The frustum count is not the metric; the PNG
  is.** Text below as written, for the record.
- ~~**1a. The glimpse.**~~ The arrival lens (`RV-arrive-*` frames, the F1 batch)
  looks at the animal. For three seconds it should look at *the marquee first*
  and pull back to the animal: the condor circling the crater, the sails, the
  scaffold going up the side of the street, the balloons inflating at the
  launch field, the water sitting in the square. Each chapter publishes one
  point — `marquee: {x, y, z}` on `CHAPTERS`, or a `get:` like `way` uses —
  and the arrival dolly frames it, then the animal. Where the marquee is a
  *time* rather than a place (the aurora, the bloom, the Symphony), the glimpse
  is the sky, the water, the far shore, and 1c does the rest. No new camera
  code: the rig already dollies for the crossing and the ceremony.
- **1b. The marquee line on the paper.** A row that is not a row: above act
  one, the `wow` in its own register — the F4 sparkle at full size, the text,
  and *no checkbox* until its act opens. It is the reason you are here and it
  reads that way. Under it, one clue: not how to do it, but *where to look* —
  *"it is circling the crater"*, *"the wharf at the end of the promenade"*.
  Reads `sysHINTS[wow].where` and the `act`; costs nothing on the save.
  Sydney's act one is ten rows and the sparkle is the only thing on that paper
  that says "there is more than this".
- **1c. Phase the clocks to the arrival.** ~~For the nine "be there when"
  marquees, set the cycle's phase on *first* `biome:enter` so the first window
  opens at an authored 150–210 s after arrival.~~ **BUILT ALREADY, and this
  item was wrong about its own premise (B2).** Every one of the five chapters
  whose marquee rides a clock re-phases it in its own `onEnter()`, against an
  authored constant, with a comment explaining it: Venice `venTIDE_START`
  0.055, Cappadocia `gorPhase` 0.06, Hong Kong `hkPhase` 0.06, Palawan
  `palPhase` 0.10, Hanoi `hanTRAIN_GAP2 × 0.30`. Measured off the live
  countdown, the first window opens 81 / 67 / 76 / 48 / 32 s after arrival —
  **sooner than this item's target, not later.** And all five re-phase on
  EVERY entry rather than latching on `seen[]` as this item asked, which is
  the better rule and is written down in all five chapters. Nothing was
  changed.
  What was genuinely missing is the half of this item nobody had noticed:
  `nextIn` has published the countdown since P3 and `todoParLine` renders it —
  **on the clue under the top row, which is exactly the row a clocked marquee
  is never**, because it sits in act two or three. The countdown is on the
  signpost now, after the distance. That shipped as B2.
- **1d. HALF BUILT (B3).** The 150 s nudge is **said by the nearest person**
  now, through `game.sayNear` — which lives in npc.js, because the first cut
  lived in systems.js and filtered `game.npcs` on `r.biome`/`r.fig`, fields
  those records do not have, so it was dead in all nineteen chapters while
  looking alive. The toast stays as the fallback and is not a lesser one:
  Sơn Đoòng has nobody in it at all. **`lead:` is deferred** — the acts already
  order every chapter toward its marquee (this item says so itself), and a
  second ordering system on top of the act machinery is two writers of one
  decision. Build it when B0's stranger stalls with the arrow pointing
  somewhere unhelpful, and not before.
- ~~**1d. Lead, do not push.**~~ When nothing on the paper is pinned, the hint
  arrow (`hintTarget`) points at the next row *on the road to the marquee* —
  `lead:` on the `wow` row, an ordered list of the rows that get you there
  (whistle the condor → the rim → the talons; find the scaffold → climb → the
  roof). The acts already stage most of this; `lead:` makes it explicit so the
  arrow can read it. ~~The stuck timer that does not exist:~~ **it exists —
  `sysNUDGE_T`, 150 s, banked and emptied by a tick, once per chapter, and it
  re-toasts the top row's clue.** And `todoParLine` ALREADY renders `nextIn`
  and the distance for the top row, so the "fourth case" this item asks for at
  75 s is two of the three cases it already has. What is genuinely left of 1d
  is: `lead:` and the arrow, and turning the 150 s toast into **the nearest
  local in earshot saying a version of it** through `sysSay` — which is the
  half that would make it the world talking rather than the UI. Reset on any
  tick; never while a marquee's clock reads 0 (the show is on — the hint is to
  look up). **Check what is built before building it; two of the four things
  in this item already were.**
- **1e. NOT BUILT AS WRITTEN, AND SHOULD NOT BE (B3).** Measured first
  (`qa/chart-gaps.js`): **the chart already marks the marquee** — its nearest
  existing mark is 0.0 m away in 13 of 19 chapters and inside 30 m in 16 — and
  **26 of the 30 minis are already inside 40 m of a mark, sixteen of them at
  0.0 m**, where the mark simply IS the mini under another name. Thirty more
  marks would bury a 104-pixel chart to repeat what it says. What was true
  underneath: every mark is drawn the same, so the chart never said WHICH ONE
  THE CHAPTER IS FOR. That shipped — one ring, one mark, per chart, with a
  triangle inside it in the six chapters where the nearest mark is 20–52 m off,
  and gone the moment the marquee is ticked.
- ~~**1e. The minis are the second signpost.**~~ Thirty~~-two~~ (**30**) `mini` set pieces
  already carry the smaller sparkle on the paper. Give each a chart mark on
  the minimap in the same glyph, so a player who is not ready for the marquee
  can see the next-best thing from anywhere. Reads `sysHINTS[id].where`;
  drawn at chart build, not ticked.
- **1f. The instrument that does not exist.** `qa/first-five.js`: the
  closed-loop driver enters every chapter *from the title picker*, and reports
  time-to-first-tick, time-to-first-sight-of-the-marquee (its point inside the
  frustum and unoccluded — the visibility-metrics memory says judge this from
  the PNG, so the probe also saves the frame), time-to-wow, and the longest
  gap between ticks. Nobody has timed a chapter; this times nineteen in one
  soak and is the number every later batch is judged against.

*Traps.* A marquee point behind a hill on arrival is a glimpse of a hill:
render every one of the nineteen arrival frames and look (the third-pass
memories are full of marquees that were "built and not seen"). The marquee
line must not count as a row for `win`, `chapComplete` or the act derivation,
or Sydney's paper grows by one and every act opens early. A phased clock must
not re-phase on a *second* entry (a player who leaves and returns should find
the cycle where it was) — latch on `seen[]`. The arrival dolly must respect
`camFloor`/`camCeil` and the exit-board floor, and underwater the four camera
rules are wrong (the water memory) — Palawan's glimpse is from the surface.

### 2. THE FIRST FIVE MINUTES, IN EVERY WORLD (≈3 batches, 8–9 h, half authoring)

*The argument.* Because the picker is free, each of the nineteen places is the
first place for somebody, and each must earn the next five minutes on its own.
Today a chapter arrives on a card and a paper; the nearest prop is 13–26 m off
(v51 fixed the spawn ring for *count*, not for *comedy*); the free arrival tick
is a tick for having walked through a door; and the incident chain, which is
the one goal that is not the paper, is invisible until it pays.

**The loop, the same shape in all nineteen** — a table, one row per chapter,
each cell reachable without reading anything:

| within | what | mechanism |
|---|---|---|
| 10 s | a **gag** you can trip over from the spawn | one authored placement in the spawn ring |
| 30 s | the **first tick** | the arrival tick, *earned* by the first disturbed prop or startled person |
| 60 s | the **first sight of the marquee** | item 1a |
| 3 min | a **ride, a move, or a mini** — the chapter's second-best thing | placement or a phased clock |
| 5 min | the **pips** have filled once, or the marquee's window has opened | the incident chain on screen; item 1c |

- **The gag, per chapter. MOSTLY ALREADY TRUE (B5).** A gag is two conditions —
  something loose within reach AND somebody within 16 m to see it, because
  `incAdd` refuses outright when nobody does. Measured (`qa/gag-ring.js`):
  **sixteen of nineteen rings already meet both**, 2-10 armable props, nearest
  0.7-15 m. The Pantanal and Sơn Đoòng never will and should not — they have
  nobody in them by design, exactly as the Drift does. **Hanoi was the one hole**
  (0 props, 0 people; its clusters are 88 m and 154 m from the spawn) and is
  fixed. What is left of this bullet is authored COMEDY, and this document says
  of its own table: first draft, B0's stranger corrects them.
- ~~**The gag, per chapter.**~~ Written as a `gag:` row in `physBIOME_SCATTER`'s
  `also` annulus so the probe can find it, and **every one is a witnessed
  event** so the chain arms from the first thing you touch. Authored below.
- **The arrival tick is earned. REFUSED (B4), with the argument.** F1 examined
  this and decided it in writing: it removed chapter 3's `arrive` because its
  first row is not a turning-up, and kept the other eighteen because **theirs
  are true** — you did emigrate. This item also replaces eighteen authored row
  texts with one generic *Made an entrance*, and ticking "Get off the train at
  Kyoto" on the frame you barge a bin is a row that no longer describes what
  happened. The complaint underneath — the first tick teaches that ticks are
  free — is real, and is better answered by putting something worth tripping
  over in the spawn ring, which is the gag pass.
- ~~**The arrival tick is earned.**~~ `ROADMAP-FINISH` already lists this. The
  `arrive:` row on `CHAPTERS` ticks on `biome:enter` today; tick it on the
  first disturbed prop or startled person instead, with text that says what
  you did — *"Made an entrance"*. Now the first tick lands in the first thirty
  seconds of every chapter by construction.
- **The chain is visible. BUILT (B4)** — five pips, not three (`sysINC_N2`),
  with the third ringed while unlit because it is the one that makes a card,
  and a window bar that drains with `incT`. **Nothing at rest**: v51 already
  gave the chain a rising note per event and said in its own comment that it
  adds no HUD, so the pips appear when a chain opens and go when it closes.
  What a note cannot carry is HOW MANY and HOW LONG; that is all this adds.
- ~~**The chain is visible.**~~ Three small pips beside the stamina bar, filled by
  `incN` and drained on the chain's own clock. Nothing new is counted; the
  number that already decides a card is on screen. A goal that is not the
  paper, from minute one, everywhere.
- **The people are where the first rows need them. MUCH SMALLER THAN THIS (B4).**
  Measured (`qa/first-rows.js`): **thirteen of eighteen first rows are already
  inside 30 m**, median about 18 m. Five are not — Hanoi 117.8 m, Kyoto 98.5 m,
  Cappadocia 96.1 m, Venice 48 m, Palawan 35.6 m — and **Hanoi has zero props
  within 14 m of its spawn**. That is the list, and it is three chapters and a
  city, not nineteen.
- ~~**The people are where the first rows need them.**~~ At boot, per chapter,
  guarantee that the *first two rows of act one* have their subject inside 12 m
  of spawn, facing away — a seeded placement through `physSpotOk`, not a
  script. Sydney: a hat-wearer and a coffee-holder. Pasto: a vendor with fruit
  on the counter. Venice: the pigeons on this side of the square.

**The nineteen gags** (first draft; B3 places them, B0's stranger corrects
them):

| ch | place | the gag in the ring | the second-best thing by 3 min |
|---|---|---|---|
| 1 | Sydney | a hat-wearer and a flat white in reach; the first wheek turns four heads | Mr Whippy passes the spawn on his first lap |
| 2 | Pasto | a pyramid of `cuencobowl`s on the market's end stall (the one fragile type, finally used) | the street dog orbits you inside 20 s; the condor is overhead from the spawn |
| 3 | Quay | the apron gulls flush if you run at them | the ferry horn at the wharf; the busker mid-song |
| 4 | Kyoto | a stack of tea bowls on the terrace rail | the bonshō, the torii tunnel's mouth visible from spawn |
| 5 | Cali | paint tins at the foot of the painted street | the band is audible from spawn; the chiva passes |
| 6 | Rio | a beach ball among bathers who react (item 4e) | the surdo audible; frigatebirds overhead |
| 7 | Iceland | three sheep to wheek into a line (obey 1, already wired) | Strokkur's first warning phased to 120 s |
| 8 | Marrakech | the orange cart is the gag *and* the chase — put it 8 m from spawn | the acrobats |
| 9 | the Drift | the first gap is the gag: 4 m, off the spawn island's lip, wind behind you | the weathervane swings; a lampfly finds you |
| 10 | Venice | two hundred pigeons on *this* side of the square | the siren's four tones phased to 150 s |
| 11 | Hong Kong | a laundry pole low enough to knock a shirt off | the scaffold's foot 10 m from spawn; the first climb |
| 12 | Palawan | the reef edge two strokes off the beach; a crab that scuttles | the clam; `first-dive` teaches the verb |
| 13 | Cappadocia | a crew's basket you can climb into on the launch field | a balloon leaves; the burner is audible |
| 14 | Manly | gulls on the chips | the first set of the swell; a surfer wipes out |
| 15 | Pantanal | the capybara family in view; one wheek and a pup looks up | a cow to herd; a caiman surfaces |
| 16 | Sơn Đoòng | the dark itself: the first wheek lights the wall | a drip, a bat, the first daylight shaft |
| 17 | Antarctica | six gentoo on the rock, herdable on one wheek | the orange boat at the jetty, engine running |
| 18 | Monte Carlo | a champagne pyramid on the terrace | a Grand Prix car passes the steps; the doorman speaks |
| 19 | Hanoi | the road is the spawn: 240 bikes, the first step onto it | the pho; the flower bicycle |

*Traps.* A gag that repeats is an irritation (the ambient-movers rule): fragile
stacks do not restock; flocks re-arm on the flock's own timer. The pips must
not be a fourth writer on the stamina bar's element — sibling node, own class,
`less motion` stops the fill animation. The seeded placement must go through
`physSpotOk` or the coffee-holder is inside the kiosk. A gag must never sit on
the road to the marquee (1d) or the arrow points at a stack of bowls.

### 3. CHARM — THE OTHER ECONOMY (≈3 batches, 7–8 h)

*The argument.* Half the people who open a capybara game do not want to steal
a hat; they want to be a capybara. The game should pay that from the first
minute in any place, with the same crowd the mischief economy uses — so the
two loops *interlock*, and being cute is the casual player's way out of a
square they have made angry.

- **Sit, and be noticed. BUILT WITHOUT THE APPROACH (B7).** The `photo` state
  was real and worked — and `hasCamera` is set on **at most three
  `kind === 'tourist'` records, a roster only Sydney has**, so it lived in one
  chapter of nineteen on three people. Locals photograph a loafing capybara in
  all nineteen now: they turn, both arms come up, the flash leaves the hand, and
  they say something if their mouth is free. Gated on `capy.restT`, on the
  3–11 m band, and on `placeHeat < 0.5` — which is the interlock this item is
  really about. **The approach is refused**: a local never writes its own `x` or
  `z`, they are placed by hand behind specific counters, and giving a hundred
  and fifty of them locomotion is not three hours. Half a walk is worse than
  none.
- ~~**Sit, and be noticed.**~~ Loaf (`capyRestT` gates it at 6.5 s) within 8 m of
  people whose `wary` is low: the nearest one turns (the F4 head turn), then
  *approaches* — the first time anybody in fifteen chapters walks toward you
  for a nice reason — crouches at 1.5 m, and takes the photo the `photo` state
  already knows how to take. One per person per 90 s; two at once at most.
- **Somebody gives you something.** At `fam ≥ npcFAM_HEAT` (0.45), the person
  who has warmed to you tosses a **snack**: one new `edible` type per chapter's
  palette (a chip, a mochi, an arepa, a rice cake, melon), lobbed from the
  hand. The first gift in the game; it makes `graze` — and the produce reaction
  behind it — reachable in the eleven chapters with no edible prop (6 of 17
  measured in the mischief-radii memory); and it is the moment a casual player
  screenshots without being asked.
- **The pat.** Loaf beside a *familiar* person for 4 s and they reach down:
  the `reach` beat as a hand on the head, the wheek's calm row at a whisper,
  an ear flick. Nothing is scored.
- **Charm and mischief share the crowd.** Nobody approaches while `npcHeat` at
  your position is over 0.5, and a hot person's `fam` earns at half rate. A
  player who caused a SCENE cannot be adored until it cools — and *can* cool it
  faster by sitting still in full view, which the finds already reward. Heat
  spends only on attention; charm spends only on approach. Neither blocks a
  task.
- **It is counted where notoriety is.** `pho`/`fed` beside `inc`/`scn` on the
  save, per chapter; item 6's arrival line gets a twin.

*Traps.* An approaching person takes the owner-retrieval's blocked-step ray
(start it 1.20 m out — most people who could give you something are behind a
counter). A snack in water must float (`physRHO`). `photo` and `give` sit below
every state in `npcREACH_ST`. Stop the approach at 1.5 m *and* off the camera's
axis (radius is a composition number).

### 4. THE TOYBOX — give the four chosen verbs depth (≈4 batches, 10–12 h)

*The argument.* A slapstick physics game is only as funny as the worst thing
you can do with an object, and right now the worst thing you can do is throw it
five metres in the direction you are facing. No new key; `E` already does six
jobs by context.

- **4a. Put it down, and put it IN.** Tap `E` = throw as now; *hold* `E` past
  ~0.35 s while stationary = set it down, snapped to the nearest `receive` prop
  within 1.2 m. Make `receive` mean something: a bin, a basket, a boat, a
  fountain, a pram, a gondola, a bowl of pho. A prop placed *in* another
  travels with it (one level of the `capyRideBody` frame). The Goose's bucket.
- **4b. Aim and charge the throw.** Hold `E` *while moving* = charge, a faint
  arc drawn as the hint arrow is; release at 5–11 m/s with pitch from the
  camera's elevation. Tap throw unchanged to the decimal.
- **4c. The nudge, and three rideable props.** Below `physBarge`'s 3.2 m/s, a
  steady push so a ball rolls and a trolley starts down a slope. Then a
  shopping trolley, a wheelbarrow and a loose crate on water become passive
  carriers with weak steering — the mini set pieces' own contract.
- **4d. More things break and spill.** `fragile:` on ten more types, `spill:`
  on five more; each is already a witnessed event. Measure `qa/eng-rate.js`
  incidents per 45 s per chapter before and after.
- **4e. People have bodies.** *Stumble* (barged ≥3.2 m/s, drops what they hold
  via `physBarge`), *sit down hard* (barged while startled, or walked through a
  spill), *fall in* (stumble at a quay edge → `plunge`). Gate on `r.fig`; once
  per person per 40 s.

*Traps.* The hop arc is untouchable (`capyHOP_VEL`); the trolley is a carrier,
not a launch. Never snap a put-down to a container the animal is standing in.
The nudge skips `planted` and kinematic props. Check `physShatter`'s shard-pool
cap before adding ten fragile types.

### 5. PEOPLE WITH JOBS YOU CAN RUIN (≈3 batches, 8–10 h, half authoring)

*The argument.* The comedy of the Goose Game is not that people react — it is
that people were *doing something*, and now they cannot. All five hooks exist.

- **5a. A routine that can be broken.** `beat` gets a `tool:`; take it and the
  beat *fails* — arm on nothing, a look at the hand, the pool switches (`tool:`
  as a third `before:`/`after:` condition). Put it back (4a) and they resume;
  `localOwnStart` already makes them come and get it.
- **5b. Wariness finally denies something.** Once per chapter, a wait not a
  loss: Monaco's doorman in the doorway (`monLocDoor` + `npcREACH_ST`) while
  `npcHeat` at the steps is over 0.6; the Cali band stopping; the Kyoto
  shutter. Item 3 is the way to end it. Never on a marquee.
- **5c. Blame.** `npcWitnessHold` knows who saw what; rewrite the nearest
  `addExchange` pair's next exchange into an accusation of the wrong person.
  ~12 neutral pairs, no line naming what was done.
- **5d. Animals startle people.** Route every flock, dog and `herdOffer` flush
  through `localsReact` with the animal as source; the witness chain counts it.
- **5e. The Traveller becomes a character.** Six chapters, one arc, lines that
  know where they have seen you (`seen[]`).

*Traps.* A failed beat plays once. Every gated door has a clock and never
covers a `wow`. Blame pairs must face each other.

### 6. NOTORIETY — the thread that crosses chapters (≈2 batches, 5–6 h)

*The argument.* Nineteen places, and the only thing you carry between them is
a box. Consequence should travel — as a projection of counts already saved,
exactly as `keep` is a projection of ticks.

- **The number.** `notoriety = f(Σ jrChapInc, Σ jrChapScene, records beaten,
  finds)`, five tiers (*a rumour · a nuisance · a menace · a legend · a natural
  disaster*), on the departures board and the ledger; item 3's `pho`/`fed`
  beside it.
- **The arrival card knows.** From tier 2, a headline as the card's second
  line: *"SIGHTINGS OF A LARGE RODENT REPORTED IN PASTO"*. Ship tiers 2 and 4
  if authoring time is short.
- **Gossip.** `npcPLACE_SAY` gets a `heard:` pool about the *previous* place,
  chosen by whether you did anything there.
- **The poster.** From tier 3, one grabbable `wanted-poster` per chapter near
  the spawn ring, textured with the player's own album thumbnail; stealing it
  is an unlisted find. Fall back to the `sysMARKS` glyph when the album read
  throws (declare the read above the constructor).
- **The ending reads it.**

*Traps.* Notoriety spends only on attention; 5b's denial reads *heat*, which
decays.

---

## WHAT THIS DOES NOT PROPOSE, AND WHY

- **Opening chapter doors early.** The second draft proposed a threshold on
  `jrOpen`. Dropped: the title picker already opens every place, and a player
  inside a chapter is better led to its marquee (item 1) than let out of it.
  If B0's stranger asks to leave a place before finishing it, revisit.
- **More chapters.** Nineteen is plenty; every hour here is worth more than a
  twentieth city.
- **A fail state, a score, or a timer on the screen.** The pips show a number
  the game already keeps; `nextIn` is a countdown the paper already had.
- **A tutorial.** Item 1 leads by a camera move, a sparkle and a person
  speaking; item 2 teaches by placement. A card that says "press E" is the
  thing the touch pass spent a batch removing.
- **A second lap, a shareable postcard, a companion.** All three are for the
  player who has finished; written down in `git show 6f04afd:ROADMAP-FUN.md`
  for when the first five minutes are measured and right.
- **A second marquee per chapter.** The law stands. Item 1e points at the minis
  because they are already there.

---

## THE ORDER

| batch | item | hours | one commit each |
|---|---|---|---|
| 0 | watch somebody play two places from the picker; rewrite 1–2 from what they tried | 2 | notes only |
| B1 | 1f `qa/first-five.js` · 1b the marquee line · `marquee:` points for all nineteen, arrival frames rendered and looked at | 3 | `5060f0a` |
| B2 | 1a the glimpse · 1c the nine clocks phased | 3 | `a91a725` |
| B3 | 1d `lead:` on every wow, the arrow, the stuck timer · 1e mini marks | 2.5 | `ecec89c` |
| B4 | 2 the arrival tick earned · the pips · seeded people for the first rows | 3 | `d1f5e82` |
| B5 | 2 the nineteen gags placed, half of them | 3 | `76e13ec` |
| B6 | 2 the other half · re-run first-five, read the table | 3 | `13bd69e` `f3bae00` |
| B7 | 3 sit-and-be-noticed: approach, crouch, photo | 3 | |
| B8 | 3 the snack · the pat · heat interlock · `pho`/`fed` | 3 | |
| B9 | 4a put down + receive · 4d breakables and spills · eng-rate A/B | 3 | |
| B10 | 4b aimed throw · 4c nudge + one rideable prop | 3 | |
| B11 | 4e people have bodies · 5d animals startle people | 3 | |
| B12 | 5a the tool and the broken beat (12 locals, four chapters) | 3 | |
| B13 | 5c blame · 5e the Traveller's arc · 5b one denial (Monaco) | 3 | |
| B14 | 6 the number, the headline, the ledger | 3 | |
| B15 | 6 gossip pools + the poster | 3 | |

Every batch is verified the way this repository verifies: a paired A/B in one
session, a rendered PNG judged by eye, `npm test` green, the 19-chapter soak at
0 errors / 0 NaN, frame time flat at 16.5–16.8 ms. The instruments that matter
here are `qa/first-five.js` (B1 builds it: first tick, first sight of the
marquee, time-to-wow, longest gap — per chapter, entered from the picker),
`qa/eng-rate.js` (incidents and startles per 45 s — fun-per-minute), and, for
anything that toasts, a `MutationObserver` on `.capyui-toasts` rather than a
wrapped `toast()` (module-local; sees nothing).

**The three numbers this document is betting on**, read off `qa/first-five.js`
after B6, for all nineteen chapters entered from the picker: the marquee in
frame inside 60 s, the first tick inside 30 s, and the marquee's window open or
its road begun inside five minutes. If B0's stranger disagrees with the driver
about where they stalled, the stranger is right.

---

## THE STARTING LINE (measured in B1, 7 Sep 2026)

`qa/first-five.js`, nineteen chapters, ninety seconds each, entered through
`hud.cross`, driven by a random walk. A floor and not a forecast — but it is
the first time anybody has timed a chapter of this game, and every batch below
moves these numbers or does not.

| ch | first tick | first sight of the marquee | seen in | longest gap |
|---|---|---|---|---|
| 1 Sydney | 11.0 s | 0.5 s | 4.9 % | 51.0 s |
| 2 Pasto | 5.0 s | 25.0 s | 71.7 % | 65.0 s |
| 3 Quay | **never** | 3.5 s | 15.6 % | 90.0 s |
| 4 Kyoto | **never** | never | 0 | 91.5 s |
| 5 Cali | 28.5 s | never | 0 | 62.0 s |
| 6 Rio | 0.6 s | never | 0 | 75.5 s |
| 7 Iceland | **never** | never | 0 | 90.5 s |
| 8 Marrakech | **never** | never | 0 | 90.0 s |
| 9 the Drift | 0.7 s | never | 0 | 70.5 s |
| 10 Venice | 18.0 s | 0.5 s | 2.2 % | 60.5 s |
| 11 Hong Kong | **never** | never | 0 | 90.0 s |
| 12 Palawan | **never** | never | 0 | 91.0 s |
| 13 Cappadocia | 9.5 s | never | 0 | 74.0 s |
| 14 Manly | 26.0 s | 26.5 s | 4.9 % | 42.5 s |
| 15 the Pantanal | 16.0 s | 0.5 s | 23.6 % | 75.0 s |
| 16 Sơn Đoòng | 22.5 s | never | 0 | 31.0 s |
| 17 Antarctica | 2.0 s | never | 0 | 88.0 s |
| 18 Monte Carlo | 2.5 s | never | 0 | 88.5 s |
| 19 Hanoi | 26.5 s | never | 0 | 35.0 s |

**B6 re-ran this with two drivers. Read the note under the table before quoting
any row of it.**

| | first tick ≤ 30 s | marquee seen | rows ticked | signpost |
|---|---|---|---|---|
| B1, wander | 13 / 19 | 6 / 19 | — | 19 / 19 |
| post-B2, wander | 10 / 19 | 7 / 19 | — | 19 / 19 |
| B6, wander | 11 / 19 | 7 / 19 | 27 | 19 / 19 |
| **B6, wander + E + Shift** | **15 / 19** | 8 / 19 | 35 | 19 / 19 |

**Three runs of the SAME driver gave 13, 10 and 11.** That is ±3 of run-to-run
noise on a nineteen-chapter sample, and it means the verbs column at 15 —
above all three, but a single sample — is *suggestive and not measured*. What
the two columns establish is the driver's blind spot, not the size of it. The
only row here that is not noisy is the signpost, at 19/19 in every run since B1.

- **The signpost is up in 19 of 19.** Item 1b is done and it is done everywhere.
- **The marquee is seen at all in 6 of 19.** In thirteen chapters it is never
  once on screen in ninety seconds of wandering. That is item 1a's number.
- **On the arrival frame itself** (`qa/arrive-see.js`, sampled inside the
  3.60 s shot): the marquee point is in the frustum in **8 of 19** and
  unoccluded in **2** — Venice and the Pantanal. Nothing else.
- **The first tick lands inside 30 s in 13 of 19** — and in six chapters (the
  Quay, Kyoto, Iceland, Marrakech, Hong Kong, Palawan) a wandering player ticks
  NOTHING in ninety seconds. **B4 qualifies this and it should not be quoted
  bare:** only two of the six are distance problems. Iceland's first row is
  8.0 m away, Marrakech's 11.4 m and Hong Kong's 12.0 m — what those three need
  is a VERB (they are thefts) and **the random walk never presses E**. The
  number is as much a fact about the driver as about the game.
- **The longest quiet run is 31–91.5 s**, over a minute in twelve chapters.

One thing the baseline changed about the plan: the arrival tick being *earned*
(item 2) was written as a polish item. In six chapters it is the difference
between a first minute with something in it and a first minute with nothing.
