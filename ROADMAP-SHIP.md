# ROADMAP-SHIP — seven decisions that make this a game people finish (21 Sep 2026)

The brief: review the game and the codebase in detail and name the five to
seven things that would take it a notch or two up in enjoyment — mechanics,
story, performance and polish, art, progression — and the decisions that
make it market ready. Four answers were given before this was written and
they shape every item below: **free web only** (GitHub Pages / itch, no
commerce — so no wrapper, no store, no licence-as-product; the licence is
still the one decision left, see S5); **keep all nineteen chapters and
restructure them into a shorter spine**; **the why is answered in one
image and never in words**; the player is **cozy first, goose-game
second** — no fail states, mischief as comedy, ambience and music that
carry a mood.

This file is written to be executed later, in the house method (waves,
one agent per file set, every claim measured, a Closed section). Where a
decision is genuinely the author's it is marked **DECISION** with the
options and a recommendation, and nothing under it is built until it is
made. ROADMAP-SCORE (the music, running now) lands before this starts.

## What the review found — the state of the game in ten lines

1. It is finished. Thirteen lifts, twenty-five roadmaps, 256 task rows in
   nineteen places, a spine (the keepsakes, the shelf, the traveller, the
   companion, the regulars, an ending), a tutorial, a governor, a save, a
   soak that passes, a single 6.9 MB file that opens from `file://`.
2. It is long and flat. Every chapter is the same shape: arrive, do about
   nine of thirteen rows (the door is 70 % everywhere but Sydney's 10 of
   20), three wheeks at the board, choose any of eighteen. The finale
   needs a keepsake from all nineteen. That is six to ten hours with no
   middle — the first chapter is as big as the last and the road never
   narrows or widens. A cozy player stops at the third border; a goose
   player has seen the whole loop by the second.
3. The first three minutes work and the first thirty do not. T's walk
   teaches the six verbs (two blind agents named them). After it: rows
   tick without saying why (the photo, the flat white, a swim — the
   stranger could not attribute three of five ticks), E and Q with nothing
   in reach do nothing and say nothing, the picnic lawn is fenced and the
   minimap draws a route through the fence, a mid-journey restore gives
   no re-orientation (the first blind agent spent three minutes on an
   Antarctic boat with a truncated controls line and never found the
   jetty), and at 800 px the pills sit under the minimap.
4. The mischief is a real system nobody can read. Wariness, blame, the
   incident meter, the heat field, chases, the carry-out, the regulars'
   tiers, the getaway — all built, all measured, all invisible from the
   outside. The stranger's own words: "scoring felt disconnected from my
   inputs." Goose works because you can see the groundskeeper decide.
5. The why has a shape now and no last image. The shelf, the glimpse, the
   companion's home, the absence line, the opening with the bag — the
   pieces are on the board; the finale still ends on nineteen keepsakes
   and a ledger.
6. The picture is done. After the three beauty passes the honest visual
   list is short: Kowloon and Hanoi's far layers (deferred twice), the
   six weakest chapters' locals against the ONE PERSON standard, a HUD
   glyph language the stranger could not relate to the screen, no key
   art, no loading screen.
7. The frame is fine and the load is not. On the reference GPU the live
   frame is 6–10 ms (Part H of WOW3); the governor's ladder is built.
   The single file takes **5.7 s to a title card on localhost** (parse,
   compile, build Sydney) with nothing on screen for any of it.
8. The audio is being redone now (ROADMAP-SCORE): the tune in front, the
   beds and the people quieter.
9. Progression is deep and illegible at the start: yuzu, the bag, the
   shop, upgrades, wear, boons, records, the album, the journal, the
   notebook, the wallet — eleven systems, and the stranger's second
   sentence about yuzu was "it climbs on its own."
10. Ship items: no LICENSE (LICENSING.md says why and stops), no itch
    page, no key art, no trailer, no feedback route, no save export, no
    tested browser matrix, no loading screen.

## The seven, ranked by notches per week

Each item: the evidence, what to build, the decision if there is one,
the number that proves it.

### S1 — THE ROAD (progression and shape; the biggest single notch)

Nineteen places of equal weight is a museum, not a journey. Keep all
nineteen; give the game a road through ten of them and make the other
nine detours.

- **The road.** A fixed order of ten (DECISION below). Sydney first, the
  Quay second (the ferry is the first "the world is bigger" beat and it
  is already the way on). The board at each road chapter offers the next
  road chapter *and* the detours reachable from it; the picker on the
  title shows the road as a line with the detours hanging off it.
- **A lighter door on the road.** The door on a road chapter is **the
  marquee plus four rows** (about twelve minutes), not 70 %. The 70 %
  stays as "finished" — the keepsake's own rule (`keepHeld`) does not
  move, so the finale still asks for all nineteen keepsakes and the
  completionist's game is untouched. A road-only run is ~2½ h and ends
  at a shorter ending (S4) — the shelf with ten on it, the traveller,
  no coda; the full ending is the nineteen.
- **The detours' pull.** Each road board names one detour by its verb
  ("the condor is over the volcano, one border west"), and the shelf in
  Sydney shows nineteen slots with nine empty — the gaps are the
  invitation. The detours keep their 70 % door; a detour's board always
  offers the road back.
- **The middle.** Road chapters 4–7 each add one thing the earlier ones
  did not have, on the row list itself: a row that needs the companion,
  a row that needs a bought upgrade, a row that needs two chapters (the
  `to-` rows exist for this). Rising shape, not rising difficulty.
- **The end of the road.** Chapter 10's board does not offer "anywhere":
  it offers home. Sydney's second arrival is the shorter ending, and the
  board there offers the nine.

**DECISION S1 — which ten.** Both lists keep Sydney and the Quay first
and end on Hanoi (the best "you have learned to move" test in the game).
- *Option A, the verbs (recommended):* Sydney, the Quay, Pasto (the
  condor), Kyoto (the river, the stillness), Cali (the party bus),
  Palawan (the dive), Cappadocia (the balloon), Antarctica (the boat and
  the orcas), Monte Carlo (the car, the casino), Hanoi (the traffic).
  Every road chapter introduces a movement verb or a carrier; the detours
  are the atmospheric ones (Rio, Iceland, the Sahara, the Drift, Venice,
  Kowloon, Manly, the Pantanal, Son Doong).
- *Option B, the arc:* swap Cali → Rio (Carnival as the midpoint high),
  Monte Carlo → the Pantanal (home before the last leg, so the finale's
  "where you are from" is a place you have stood). Softer, more story,
  one fewer vehicle.
- *Option C, let the data pick:* the soak's per-chapter play-time and
  the records' attempt counts (`qa/soak-history.jsonl`, `recs`) rank the
  nineteen by how long players stay; take the top ten. Honest, and it
  may put Iceland on the road and Cali off it.

- **Measured:** a bot on the road alone reaches Sydney's second arrival
  in ≤ 3 h of game time and ticks exactly (marquee + 4) × 10; the
  picker draws the road; every detour is reachable from at least one road
  board and every road chapter from every detour; the nineteen-keepsake
  finale still fires from a full file. `qa/ship-road.js`.
- **Cost:** `CHAPTERS` gains `road: n` and `door` per row (the field
  exists), the board's list, the picker's drawing, one shorter ending
  branch in the finale block. No new chapter, no row moved.

### S2 — THE FIRST HOUR, LEGIBLE (onboarding; the second notch)

Everything the two blind agents hit after the tutorial, plus T's own
named misses. None of it is new mechanics; all of it is the game saying
what it just did.

1. **A tick says why.** Every `completeTask` toast names the cause in the
   game's voice ("in the photo — the one with the phone", "the flat white
   went over when you barged the table"), from a `why` field on the row
   for the rows that can fire without the player's intent (the photo,
   the spill, the swim rows, the chased row). Zero unattributed ticks in
   a stranger's first hour.
2. **A verb with nothing in reach answers.** E with nothing grabbable: a
   short reach and a small "nothing" sound (the rig has the lunge); Q
   with nobody within earshot: the wheek and one head turning anyway
   (the nearest local at any distance looks up). Never silent.
3. **The tutorial confirms.** Each of T's eight beats acknowledges on
   completion (a tick sound and the pill's own check, half a second)
   before the next pill — the roadmap's own open item. Tab's beat points
   at the paper with the arrow, not at a key.
4. **The route is walkable.** The minimap's route line follows the nav
   grid, not a straight line; Sydney's picnic-lawn fence gets a gate on
   the path from the bench (it is a two-post edit), and the same audit
   runs on every chapter's first three rows: a straight line from the
   spawn to the row's target crosses no fence, water or wall — or the
   line bends. `qa/pointers.js` extended with a walk.
5. **Coming back.** A restore opens on a card that says where you are,
   what you were doing (the last armed row) and the way on — the place
   card's `again` line plus one sentence, and the paper unfolded for ten
   seconds. A restore *on a carrier* (the boat, the ferry, the bus) says
   the carrier's own controls line in full, not truncated.
6. **The HUD at every width.** The pills, the paper, the minimap and the
   wallet laid out and screenshotted at 1280×720, 1366×768, 1920×1080,
   1024×768 and a phone in both orientations; no pill under the minimap,
   no carrier line cut, the paper never covering the animal. Today's
   layout was authored at one size.
7. **The loading screen.** 5.7 s of white is the first thing every player
   sees. A static splash inline in the HTML (the capybara mark, the title,
   a three-word line) shown before the 7 MB script parses, with a
   progress hint from `build.mjs`'s own module order — and the Sydney
   build moved off the first frame where it can be (the title card does
   not need the world).

- **Measured:** a stranger agent in a *visible* pane names the six verbs
  and attributes every tick it saw; zero truncations at six sizes; the
  splash is on screen within 300 ms of navigation; `qa/ship-first-hour.js`.
- **Cost:** copy on 40 rows, one `why` field, HUD CSS, a gate, an inline
  splash. A week.

### S3 — THE REACTION LAYER, VISIBLE (mechanics; the goose notch)

The system is built. Make it readable, then make it chain.

1. **Intent, telegraphed.** Every NPC state the game already tracks gets
   a two-frame tell the player can see at 10 m: *noticed* (a head turn
   and a small "!" above the head, in the HUD's own glyph language),
   *watching* (the head follows), *coming* (the walk starts before the
   run), *given up* (the shrug, existing). The incident meter's "1 OF 5 ·
   A HEAD TURNS" line becomes a thing you can see on the person.
2. **Consequence, visible.** A witnessed row leaves a mark on the place
   for the chapter: the tourist without a hat keeps a hand on their head
   for five minutes; the spilled table stays spilled; the bin stays over
   until a gardener rights it (and the righting is a beat you can
   interrupt). The heat field (`the place remembers`) already knows; the
   world shows it.
3. **Chains, three per chapter.** Authored two-step gags on the existing
   rows: the bin → the ibis → the tourist's chips; the rose → the gardener
   → the carry-out → the wharf; the flat white → the phone → the photo.
   Written as a `chain` field between rows; a chain ticked in order in
   one minute gets its own line and a yuzu bonus. Fifty-seven lines.
4. **The getaway, as play.** The carry-out is the game's only fail-like
   beat and it is a cutscene. Make it a chase you can win: a gardener
   who runs you down carries you out; one you outrun (or lose behind a
   hedge — the hide exists) gives up with a line. Cozy rule kept: being
   carried out costs nothing but the walk back.

**DECISION S3 — how far toward Goose.**
- *Option A, legible only (recommended for cozy-first):* items 1–2, the
  chains as authored surprises, the getaway stays as it is. No stealth.
- *Option B, the alert model:* items 1–4 plus a per-chapter "on edge"
  state after three incidents where locals watch the animal at twice
  the radius for five minutes — the goose loop proper. More comedy, more
  friction; a cozy player may feel hunted.

- **Measured:** a stranger attributes every reaction to a cause; chains
  ticked in order in ≥ 40 % of a bot's chapters; frame-time A/B for the
  tells ≤ 0.2 ms. `qa/ship-react.js`.
- **Cost:** npc.js tells on existing states, `chain` on rows, fifty-odd
  lines, one getaway branch. Two weeks.

### S4 — THE WHY, IN ONE IMAGE (story)

Everything needed is built: the traveller seen nineteen times, reading
each board; the shelf; the companion's home; the opening with the bag.
The finale needs a last image that lets the player put it together and
a throughline so the image lands.

**The throughline (built regardless of the option):** each glimpse's
line (N2's fifteen, third person, "what the traveller was looking at")
names, obliquely, the chapter's keepsake — the thing the traveller
looked at and did not take. The shelf's earn order is the traveller's
route. The notebook's last page (already the finale's text) stays.

**DECISION S4 — the image.**
- *Option A, the bag (recommended):* at the horseshoe the traveller opens
  the bag from the opening — the one the animal slept beside — and it is
  empty; the animal sets the nineteen down in front of them one by one
  (the coda's own pans, already built), and the last frame is the
  traveller and the animal and a full bag. They were carrying it for
  them. No line. The title's "it has not said why" stays; the ending has
  shown it.
- *Option B, home:* the last crossing is not to Sydney. Chapter 10's
  board (S1) offers the Pantanal; the shelf is there, on the bank, with
  the herd; the traveller arrives last, with the bad map, and sits. The
  animal was never abroad — everyone else was. Stronger, and it moves
  the finale out of Sydney (the horseshoe, the gardener, the lawn all
  move — a week of work the other options do not need).
- *Option C, the drawing:* the traveller's notebook, read at the finale,
  ends on a page the player sees rendered — a capybara, drawn nineteen
  times from behind. They were following it. Cheapest; a twist rather
  than a reason.

- **Measured:** a stranger who has seen the opening and three glimpses
  is shown the ending and asked "why was it taking things?" — the answer
  the image intends, unprompted, in ≥ 3 of 4 readers (agents that read
  nothing; a person if one exists). The ending never says the word.
- **Cost:** Option A: the coda's pans re-aimed, one bag prop, one sit;
  the glimpse lines rewritten (fifteen). A week. Option B: three.

### S5 — THE SHIP LIST (release; free web)

None of this is a notch in play; all of it is the difference between a
game and a file.

1. **The licence** — LICENSING.md's own three edits, once the author
   decides. DECISION S5: *CC BY-NC-SA 4.0* (play, share, remix, no
   commercial use — the natural fit for free web with the door left open
   to a paid release later) / *GPL-3.0* (code-open, the vendor libraries
   are already MIT) / *all rights reserved, play only* (the LICENSING.md
   default, formalised — nobody may redistribute). Recommended: CC
   BY-NC-SA for the game and MIT for `qa/` and `build.mjs`, which is
   what the vendor README already implies.
2. **The page.** An itch.io page with the GitHub Pages build embedded and
   the single file downloadable; six screenshots from the real GPU (the
   pane, not headless — the arrival frames re-shot at 1920×1080); a 20 s
   GIF of the ferry, the condor and a chase; the one-paragraph
   description the README already has; a feedback link (a GitHub
   Discussions or a form).
3. **Key art and a title.** The title card is typography; the page needs
   an image. One painted-in-engine frame (the animal on the lawn with the
   shelf and the Opera House, composed on the real GPU with the photo
   mode) at 1920×1080 and 630×500.
4. **Save export and import.** The journey lives in `localStorage` and a
   cleared browser is a lost journey. One button on the pause card
   writes the save as a file (the camera already knows how to hand a
   file over); one accepts it. Ten lines.
5. **The browser matrix.** Chrome, Edge, Firefox, Safari (WebGL2, the
   AudioContext unlock, `file://`), one integrated GPU and one four-year
   laptop, measured: time to title, live frame at rung 0, the governor's
   first step. Safari has never been run. A "runs best in" line on the
   page if one fails.
6. **The settings card, complete.** Volume, the score row (SCORE), fast /
   pretty / auto, reduced motion, a 30 fps cap for laptops on battery,
   invert look, key list (rebinding is out of scope — the keys are fixed
   and few). A version string from the build.
7. **The soak, green on the shipped commit.** `qa/soak-history.jsonl`'s
   last row is stale by thirty commits; `npm run soak` alone, once, on
   the tag.

- **Measured:** the page is live; the file opens from `file://` on all
  four browsers; a save survives export → clear → import; the soak's row
  is the ship commit.
- **Cost:** two days of engineering, one of art, one decision.

### S6 — THE SECOND VISIT (progression and rewards)

Eleven reward systems and no first purchase. Make the economy legible in
ten minutes and give the detours their own pull.

1. **The first yuzu is spent.** The stall's first offer on a fresh file
   is the cheapest upgrade (puff I, 25) and the wallet's first bump past
   25 arms the pill "the traveller's stall buys things for yuzu" (T's own
   clause) with the arrow on the stall. A player who has bought one
   thing understands the whole economy; a player who has not never will.
2. **A price you can see.** The wallet pill shows the next affordable
   thing's icon when the wallet crosses its price — one glyph, the bag's
   own.
3. **The detours reward return.** Each detour's keepsake is also a
   wearable or a boon (the wardrobe and the boons exist — nine of the
   nineteen keepsakes map to nothing the animal can use). The shelf's
   nine gaps say what is missing by silhouette.
4. **Again, with a ghost.** The records (`recs`) and the marquee's "again"
   line exist; a ghost of the best run exists for one marquee. Every
   marquee with a time gets the ghost and a target ("under the minute";
   the tune plays when you beat it — SCORE's lift).
5. **The album is a share.** One click on a photo writes a PNG with the
   chapter's name and the place card's line on it. Cozy players share
   pictures; that is the whole marketing budget.

- **Measured:** a bot's first purchase in ≤ 10 min from Begin on a fresh
  file; every keepsake maps to a wearable, boon or ghost; a ghost on 19/19
  marquees. `qa/ship-economy.js`.
- **Cost:** a week; the systems exist.

### S7 — THE LAST FIVE PERCENT OF THE PICTURE (art)

1. **Kowloon and Hanoi from arrival.** Deferred twice. Either the arrival
   lens gains 4° of pitch in those two (a camera row, not a scene edit)
   so the far layer reads, or the far layer is declared a helicopter-ring
   and bridge-deck beat and the arrival frame gets its own middle plane
   instead. DECISION S7 (small): lens / middle plane / leave.
2. **The six weakest, one person each.** Sahara, Iceland, Goreme, Venice,
   the cave and Manly's locals against the ONE PERSON standard
   (`npcPERSON`) — the standard reached Marrakech and Rio; the other
   hand-built locals were never re-based. The stranger's eye lands on a
   face in every chapter.
3. **A glyph language.** The compass arrow, the route line, the pill's
   attribution, the incident meter, the wallet, the paper's tick — one
   set of eight glyphs, drawn once, used everywhere, with the HUD
   vocabulary test (`qa/p7-tokens.cjs`) extended to count them. The
   stranger "could not relate ◄ ▸ ▼ to screen direction with a camera
   that keeps reorienting" — the arrow becomes a compass needle in the
   minimap's frame, not a glyph in the paper's.
4. **Key art, the splash, the itch banner** — S5's art items, done by the
   same hand as the picture so they match.
5. **The arrival frames on the real GPU.** Nineteen arrivals shot in the
   pane at 1920×1080 with the score's statement playing, read by eye;
   the three beauty passes' numbers were headless. Any frame that reads
   differently on real hardware (bloom, mist and rays are the likely
   ones) gets its row re-based against the pane.

- **Measured:** nineteen frames read and filed; `wow-person.mjs` green
  on all nineteen; the glyph count in `p7-tokens`.
- **Cost:** a week and a half.

## Performance, one paragraph

The live frame on the reference GPU is 6–10 ms at dpr 1.5 with every
term on (WOW3 Part H); the governor parks every term at rung ≥ 1 and
halves the shadow map; the far cascade is the first thing to go. What
this pass adds: a measured floor on an integrated GPU (S5.5), a 30 fps
cap (S5.6), the loading screen (S2.7), and a rule for every wave here —
no new per-frame term without the pane's number beside it. The soak
runs once on the ship commit.

## Order and ownership

Six waves after ROADMAP-SCORE closes. The decisions S1, S3, S4, S5 and
S7.1 are made before W1 starts.

- **W0 — the decisions and the baselines.** The author answers the five
  DECISIONs above. A visible-pane stranger run (the T instrument in the
  pane, not headless) and the six-size HUD screenshot set are the
  before for S2; the soak runs.
- **W1 — S1 the road + S2 items 1–5** (shared.js's `CHAPTERS`/`TASKS`
  fields; systems.js's board, picker, restore card, tick toasts; the
  finale's shorter branch). The shape first, because every later wave
  is tested on the road.
- **W2 — S2 items 6–7 + S5 items 4–7** (index.html's splash, the HUD
  CSS, the settings card, save export, the browser matrix).
- **W3 — S3 the reaction layer** (npc.js, the rows' `chain` field,
  systems.js's toasts).
- **W4 — S4 the ending + S6** (systems.js's finale and shop, npc.js's
  glimpse lines, props.js's wearable mapping).
- **W5 — S7 the picture** (chapter files, the HUD glyphs, the pane's
  arrival frames).
- **W6 — the ship.** S5's page, art and licence; the soak; CONTRACT.md's
  entry; a tag; the build published; this file's Closed section with
  the numbers.

## Rules for every agent

- Read CONTRACT.md's section list and the three WOW roadmaps' Closed
  sections before building: most of this file is legibility over
  systems that exist.
- A DECISION not yet made blocks its item, not the wave.
- No new per-frame term without the pane's number; no new save field
  beyond `road` progress (which the existing `seen`/`tasks` arrays may
  already imply — check before adding).
- The voice: third person, the why never said, every line through the
  pools and the tics test.
- One chapter per playwright run; own session; stage by name; never two
  live edits to one file.

## Held (named, not built)

Multiplayer; a level editor; new chapters; a Steam build (a later
roadmap if the free release finds its players); localisation; key
rebinding; a difficulty setting; a fail state of any kind; a voice for
the animal; a why said out loud.
