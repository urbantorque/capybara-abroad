# ROADMAP-FUN.md — the fun review, and six things that would lift the game a notch

6 Sep 2026, revised the same day. Written after the character pass (`ee4a0b2`)
and the sound review (`8bfce6f`), from the design chair rather than the art or
audio one. Scope: not "what is broken" — fifty-odd passes have answered that —
but **"what would make a casual player laugh in the first minute, stay for the
first hour, and come back tomorrow"**. Three read-only surveys of the tree (the
verbs and props; the people; the meta loop), the README, CONTRACT.md, every
previous roadmap and the design memory. Every claim below names the symbol it
hangs on; line numbers move by the thousand between batches, so grep the name.

**How this was reviewed, honestly.** It is a reading of the systems, not a
playtest with strangers. Nobody has yet timed a chapter or watched a first-time
player (v53 said so, and it is still true). Item 0 below is the one thing this
document cannot do for you.

**What this revision changed.** The first draft's items 4–6 (a second lap, a
shareable postcard, a companion capybara) were about the *end* of the game and
the player who has already finished it. They are gone. Everything that replaced
them is about the first ten minutes of a place and the first hour of the game,
because that is where a casual player is won or lost, and nothing in fifty
passes has measured it.

---

## THE HEADLINE

**The game is a magnificent reactive diorama with a checklist in front of it —
and a wall at the end of every chapter after the first.**

Measured against what is there:

- **Every chapter from Pasto on is a 100 % wall.** `jrOpen(n)` opens Sydney,
  anything already seen, and *the lowest incomplete chapter*; `chapComplete` is
  every row ticked. So a player may leave Sydney unfinished (and is never told
  so), but must finish all eleven rows of Pasto before the harbour exists, all
  eight of the Quay before Kyoto, and so on for eighteen doors. `def.win` is a
  paper window size, not a threshold. **Nothing is optional, ever, and the best
  things in the game — the condor, the ferry, the tide — sit behind a chore
  list.** For a casual player this is the whole retention problem in one rule.
- **Nobody has measured the first ten minutes.** Time to the first tick, to the
  first lift, to the first door, and where a new player stalls — none of it
  exists. `qa/eng-rate.js` counts toasts and startles over 45 s of driven play
  and is the nearest thing; it cannot see a stall. There is no stuck timer
  anywhere: a player who has not ticked anything for two minutes gets exactly
  what a player who is flying gets.
- **There is one economy and it is destructive.** Mischief is witnessed
  (`npcHeat`, the incident chain) and paid. Being a *capybara* — the calmest,
  most-photographed animal on the internet — pays nothing: `fam` exists, takes
  34 s of calm proximity to earn, and buys a warmer line pool and a shorter
  cooldown. Tourists have a `photo` state. **No NPC in the game ever gives the
  player anything.** A casual player who sits down in front of a crowd, which is
  the first thing most of them will do, gets a line.
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
chapter) is what makes the payoffs worth anything. Every item feeds the first
and obeys the second. And **nothing can kill you** stays: item 1 removes a wall,
it does not add a fail state.

---

## 0. FIRST, WATCH SOMEBODY PLAY (2 h, no code)

Before any of the six: sit one person who has never seen it in front of Sydney,
say nothing, and take notes for twenty minutes. Then Pasto. Write down the first
thing they try that does nothing, the first time they look at the paper for
instructions, the first laugh, and the first sigh. Items 1–3 are *predictions*
of that list; the session either confirms them or replaces them, and either is
worth more than the prediction.

---

## THE SIX

Ordered casual-first: 1–3 are cheap, structural, and pay in the first ten
minutes of every place; 4–6 are the deeper toys that make the hours after that
funnier. Read the hours as batches of 2–3 h, one commit each, as this repository
works.

### 1. OPEN THE DOOR EARLY (≈2 batches, 4–5 h)

*The argument.* The condor is eleven rows into chapter two. A casual player who
has enjoyed six of them and is bored by the seventh should be *on the harbour*,
not on the paper. Completion is the collector's layer and should stay one; the
door should open when the chapter has *paid*, not when it is *empty*.

- **The threshold.** `chapOpen(n)` = the chapter's `wow` ticked **and** at least
  half its rows (per-chapter override `open:` on `CHAPTERS` for the two or three
  where the wow is late — Iceland's aurora is act 3 and should not be the gate).
  `jrOpen` reads `chapOpen` for the frontier and `chapComplete` for nothing but
  the record board, the clean-sheet edge and the finale. Sydney's rule — always
  leavable — becomes every chapter's rule, *said out loud*: the departures board
  already lists what is left per row.
- **The door is announced.** The moment `chapOpen` flips, one toast in the
  place-card voice — *"The ferry wharf will take you on whenever you like."* —
  and the way mark's label on the chart (`sysMAP_WORLDS.t`, wired in F4) gains a
  small open glyph. The paper's footer counter reads *7 / 11 · the door is
  open* rather than a bare fraction.
- **The stuck timer.** There is none. Add one: if the top open row has not
  changed and no tick has landed for 75 s of unpaused play, the clue on the
  paper gains its `nextIn` or the hint arrow's distance (`todoParLine` already
  renders three cases; this is a fourth), and at 150 s the nearest local within
  earshot says a version of the clue through the existing `sysSay` substitution
  (so it reads WHEEK on a phone). Reset on any tick. **Never on a marquee whose
  clock is running** — `nextIn` returning 0 means the show is on and the hint is
  to look up.
- **The resume card.** The title card shows the album postcard; make it also say
  where you are and *the next row* — *"Pasto · 7 of 11 · the condor is waiting
  on the rim"* — read from the save and the paper's own top-row logic. A player
  who closes the tab mid-chapter should open it to a sentence, not a shelf.
- **The instrument that does not exist.** `qa/first-ten.js`: the closed-loop
  driver plays each chapter from spawn following the paper's top row, and reports
  time-to-first-tick, time-to-wow, time-to-door, and the longest gap between
  ticks. Nobody has timed a chapter; this times all nineteen in one soak and
  becomes the number every later batch is judged against.

*Traps.* A chapter left at 60 % must still stage its souvenir only on
`chapComplete` (`keep` is a projection of ticks and must stay one). The finale
gate is `chapComplete` for all nineteen and must not read `chapOpen`. The
departures board caches on open (the "not a live view" comment above `jrOpen`);
the open glyph is drawn at build, not ticked. `jrOpen`'s loop must still find
the *lowest* open frontier or a player could hold two open doors and the
progression memory's "always three whistles" contract breaks.

### 2. THE FIRST LAUGH IN EVERY PLACE (≈2 batches, 5–6 h, half authoring)

*The argument.* The first thirty seconds of a place decide whether a casual
player explores it. Today a chapter arrives on a card and a paper; the nearest
prop is 13–26 m off (v51 fixed the spawn ring for *count*, not for *comedy*),
and the eighteen free arrival ticks are a tick for having walked through a door.

- **One authored gag in the spawn ring, per chapter.** Reachable inside ten
  seconds without reading anything: a stack of fragile things at the edge of the
  path (Cali's paint tins, Monaco's champagne pyramid, a pile of Hanoi's
  conical hats); a person doing something with a tool six metres away (item 5's
  hook, but the *placement* is this item); a flock that goes up if you run at
  it (Venice already has one; Sydney's ibis, Antarctica's gentoo, the Quay's
  gulls can be sited nearer). Written as a row in `physBIOME_SCATTER`'s `also`
  annulus with a `gag:` marker so the probe can find it. **Every one must be a
  witnessed event** so the incident chain arms from the first thing you touch.
- **The free arrival ticks become the first action.** `ROADMAP-FINISH` already
  lists this (2–8 h). The `arrive:` row on `CHAPTERS` ticks on `biome:enter`
  today; make it tick on the *first disturbed prop or startled person in the
  chapter*, and let its text say what you did — *"Made an entrance"*. Same tick,
  same paper scraps, but earned, and now the first tick in every chapter lands
  in the first thirty seconds by construction.
- **The chain is visible.** The incident chain ticks on the way up and pays at
  three; between, a casual player has no idea a meter exists. Three small pips
  beside the stamina bar that fill with `incN` and drain on the same clock the
  chain uses. Nothing new is counted; the number that already decides a card is
  simply on screen. This gives the casual player *a goal that is not the paper*
  from minute one in every chapter: fill the pips.
- **Sydney's first ninety seconds specifically.** The three rows a new player
  sees first are the hat, the flat white and the sandwich. The props are within
  20 m (9 measured); the *people* are wherever the walker put them. At boot,
  guarantee one hat-wearer and one coffee-holder inside 12 m of spawn, facing
  away — a seeded placement, not a script. And the very first wheek startles
  the whole park: make sure at least four people are in `physWHEEK_R` of the
  spawn so that first Q is a *picture* (heads turn, a hat comes off) and not a
  sound.

*Traps.* A gag that repeats is an irritation (the ambient-movers rule): the
fragile stack does not restock, the flock re-arms on the flock's own timer. The
pips must not become a fourth writer on the stamina bar's element — sibling
node, own class, and the `less motion` switch stops their fill animation. The
seeded placement must go through `physSpotOk` or a coffee-holder will be
placed inside the kiosk.

### 3. CHARM — THE OTHER ECONOMY (≈3 batches, 7–8 h)

*The argument.* Half the people who open a capybara game do not want to steal
a hat; they want to be a capybara. The game should pay that from the first
minute in Sydney, with the same crowd the mischief economy uses — so the two
loops *interlock* rather than coexist, and being cute is the casual player's
way out of a square they have made angry.

- **Sit, and be noticed.** Loaf (`capyRestT` already gates the loaf at 6.5 s)
  within 8 m of people whose `wary` is low: the nearest one turns (the F4 head
  turn), then *approaches* — the first time anybody in fifteen chapters walks
  toward you for a nice reason — crouches at 1.5 m, and takes the photo the
  `photo` state already knows how to take. One per person per 90 s; two people
  at most at once, so it never becomes a crowd scene (that is item 6's job).
- **Somebody gives you something.** At `fam ≥ npcFAM_HEAT` (0.45), the person
  who has warmed to you tosses a **snack**: one new `edible` prop type per
  chapter's palette (a chip, a mochi, an arepa, a rice cake, a piece of melon),
  spawned from their hand on a lob, `physKEEPS`-less so it is eaten or lost.
  This is the first gift in the game, it makes `graze` — and the produce
  reaction that hangs off it — reachable in the eleven chapters that have no
  edible prop at all (the mischief-radii memory measured 6 of 17), and it is
  the one moment a casual player will screenshot without being asked.
- **The pat.** Loaf beside a *familiar* person for 4 s and they reach down: a
  hand on the head from the existing `reach` beat, the wheek's calm row at a
  whisper, and the animal's ear flick. Nothing is scored. It is there because
  it is the thing the animal is famous for.
- **Charm and mischief share the crowd.** Nobody approaches while `npcHeat` at
  your position is over 0.5, and a hot person's `fam` earns at half rate. So a
  player who has caused a SCENE cannot be adored until it has cooled — and *can*
  cool it faster by sitting still in full view, which is a thing the finds
  already reward ("did nothing for a full minute"). The heat field spends only
  on attention (proved by the guard-shuffle measurement); charm spends only on
  approach. Neither may block a task.
- **It shows up where notoriety does.** Item 6's tier line on the arrival card
  and the ledger has a twin: *photographed by 31 people · fed 9 times*. Counted
  into the save beside `inc`/`scn` as `pho`/`fed`, additive per chapter.

*Traps.* A person who approaches must go through the same blocked-step ray as
the owner's retrieval (start it 1.20 m out — most people who could give you
something are behind a counter). A snack that is a physics body in the water
must float (`physRHO`) or Venice's gift is a sinking mochi. The photo pose must
not fire during a chase, a shoo or an `own` errand — `npcREACH_ST` already
lists the states that override; add `photo` and `give` below all of them. And
the approach must never bring a person between the shoulder camera and the
animal: stop them at 1.5 m *and* off the camera's axis (the souvenir-ring
lesson — radius is a composition number).

### 4. THE TOYBOX — give the four chosen verbs depth (≈4 batches, 10–12 h)

*The argument.* A slapstick physics game is only as funny as the worst thing you
can do with an object, and right now the worst thing you can do is throw it five
metres in the direction you are facing. Nothing here needs a new key; `E`
already does six jobs by context.

- **4a. Put it down, and put it IN.** Tap `E` = throw as now; *hold* `E` past
  ~0.35 s while stationary = set it down (zero impulse, snapped to the nearest
  `receive` prop within 1.2 m). Make `receive` mean something: a bin, a basket,
  a boat, a fountain, a pram, a gondola, a bowl of pho. A prop placed *in*
  another travels with it (one level of the `capyRideBody` frame trick). This is
  the Goose's bucket, and a whole class of rows nothing can express today.
- **4b. Aim and charge the throw.** Hold `E` past the put-down threshold *while
  moving* = charge, with a faint arc drawn the way the hint arrow is; release at
  5–11 m/s with pitch from the camera's elevation. Tap throw unchanged to the
  decimal — verify on the `throw-in-canal` class of rows.
- **4c. The nudge, and three rideable props.** Below `physBarge`'s 3.2 m/s, a
  steady push along the heading so a ball rolls and a trolley starts down a
  slope. Then a shopping trolley (Sydney/Quay), a wheelbarrow (Pasto) and a
  loose crate on water become passive carriers with weak steering — the mini
  set pieces' own contract. A capybara in a trolley on the Selarón steps is the
  screenshot this game does not have.
- **4d. More things break and spill.** `fragile:` on ten more types, `spill:`
  on five more. Each is already a witnessed event (`physShatter`, `physSpill` →
  `disturbed`), so this is the cheapest way to make INCIDENTs reachable
  everywhere: measure `qa/eng-rate.js` incidents-per-45 s per chapter before and
  after, target ≥1 from the spawn ring in all nineteen.
- **4e. People have bodies.** Not ragdoll: *stumble* (barged ≥3.2 m/s, drops
  what they hold via the `physBarge` path), *sit down hard* (barged while
  startled, or walked through a spill), *fall in* (stumble at a quay edge →
  `plunge`, which exists). Gate on `r.fig`. Once per person per 40 s.

*Traps.* The hop arc is untouchable (`capyHOP_VEL`); the trolley is a carrier,
not a launch. A put-down must never snap to a container the animal is standing
in. The nudge must skip `planted` and kinematic props or you will push a jetty.
Check `physShatter`'s shard-pool cap before adding ten fragile types.

### 5. PEOPLE WITH JOBS YOU CAN RUIN (≈3 batches, 8–10 h, half authoring)

*The argument.* The comedy of the Goose Game is not that people react — it is
that people were *doing something*, and now they cannot. This game has the
reaction; it needs the something. All five hooks exist.

- **5a. A routine that can be broken.** `beat` gets a `tool:` — the prop the
  person works with (cleaver, guitar, trowel, brush; ~40 locals already stand
  beside one). Take it and the beat *fails*: the arm comes down on nothing, the
  person looks at their hand, the pool switches (`before:`/`after:` already
  resolves a condition; `tool:` is a third). Put it back (4a) and they resume.
  The retrieval (`localOwnStart`) already makes them *come and get it*.
- **5b. Wariness finally denies something.** Once per chapter: Monaco's doorman
  steps into the doorway (`monLocDoor` + `npcREACH_ST`) while `npcHeat` at the
  steps is over 0.6; the Cali bandleader stops the band at a third knocked-over
  instrument; the Kyoto tea lady closes the shutter. **Denial is a wait, not a
  loss** — and item 3 gives the casual player the way to end it. Never on a
  marquee.
- **5c. Blame.** `npcWitnessHold` knows who saw what. When a witnessed event has
  a person within 3 m of the prop, rewrite the nearest `addExchange` pair's next
  exchange into an accusation of the wrong person — ~12 neutral pairs, no line
  naming what was done. Humans arguing about the goose.
- **5d. Animals startle people.** Route the Venice flock, Murray, the Pasto dog
  and every `herdOffer` flush through `localsReact(kind, x, z, strength,
  radius)` with the animal as source. Two hundred pigeons going up should make
  a square flinch, and the witness chain then counts it.
- **5e. The Traveller becomes a character.** Six chapters, one arc, lines that
  know where they have seen you (reads `seen[]`, already saved).

*Traps.* A failed beat plays once, then the person stands and looks (a beat
that fails every 3 s is a metronome). Every gated door has a clock and never
covers a `wow`. Blame pairs must face each other or the joke has no subject.

### 6. NOTORIETY — the thread that crosses chapters (≈2 batches, 5–6 h)

*The argument.* Eight hours, nineteen places, and the only thing you carry
between them is a box. Consequence should travel — without one new save field,
because it is a projection of counts already there, exactly as `keep` is a
projection of ticks.

- **The number.** `notoriety = f(Σ jrChapInc, Σ jrChapScene, records beaten,
  finds)` — one derived scalar, five tiers (*a rumour · a nuisance · a menace ·
  a legend · a natural disaster*), on the departures board and the ledger
  header. Item 3's `pho`/`fed` is its twin, shown beside it.
- **The arrival card knows.** From tier 2 the card's second line is a headline:
  *"SIGHTINGS OF A LARGE RODENT REPORTED IN PASTO"*. One line per tier per
  chapter (the expensive part; ship tiers 2 and 4 if short).
- **Gossip.** `npcPLACE_SAY` gets a `heard:` pool, three lines per chapter about
  the *previous* place, chosen by whether you actually did anything there.
- **The poster.** From tier 3, one grabbable `wanted-poster` prop per chapter
  near the spawn ring, textured with the player's own album thumbnail from the
  previous chapter (288×180 JPEG, already texture-sized). Stealing it is an
  unlisted find. Fall back to the chapter's `sysMARKS` glyph when the album is
  empty or the read throws (declare the read above the constructor).
- **The ending reads it.** The ledger's last line is the tier; the lawn
  ceremony's crowd line is chosen by it.

*Traps.* Notoriety spends only on attention, never on access — item 5b's denial
reads *heat*, which decays, not notoriety, which does not.

---

## WHAT THIS DOES NOT PROPOSE, AND WHY

- **More chapters.** Nineteen is plenty; every hour here is worth more than a
  twentieth city.
- **A fail state, a score, or a timer on the screen.** Item 1 removes a wall;
  nothing adds one. The pips in item 2 show a number the game already keeps.
- **A tutorial.** Item 2's gags and item 1's stuck timer teach by placement and
  by a person speaking; a card that says "press E" is the thing the touch pass
  spent a batch removing.
- **A second lap, a shareable postcard, a companion.** All three are real and
  all three are for the player who has finished. Written down in the first
  draft of this file (`git show 6f04afd:ROADMAP-FUN.md`) for when the first
  hour is measured and right.
- **More payoff spectacle.** The lift, the acts, the cards and the mix are done
  and measured. Another celebration would devalue the sixteen that exist.

---

## THE ORDER

| batch | item | hours | one commit each |
|---|---|---|---|
| 0 | watch somebody play; rewrite items 1–3 from what they tried | 2 | notes only |
| B1 | 1 `chapOpen` + `jrOpen` + the door announced · `qa/first-ten.js` | 3 | |
| B2 | 1 the stuck timer · the resume card | 2.5 | |
| B3 | 2 the spawn-ring gag in all nineteen · the arrival tick earned | 3 | |
| B4 | 2 the pips · Sydney's first ninety seconds · re-run first-ten | 2.5 | |
| B5 | 3 sit-and-be-noticed: approach, crouch, photo | 3 | |
| B6 | 3 the snack (one edible per chapter) · the pat · heat interlock | 3 | |
| B7 | 4a put down + receive · 4d breakables and spills · eng-rate A/B | 3 | |
| B8 | 4b aimed throw · 4c nudge + one rideable prop | 3 | |
| B9 | 4e people have bodies · 5d animals startle people | 3 | |
| B10 | 5a the tool and the broken beat (12 locals, four chapters) | 3 | |
| B11 | 5c blame · 5e the Traveller's arc · 5b one denial (Monaco) | 3 | |
| B12 | 6 the number, the arrival headline, the ledger, `pho`/`fed` | 3 | |
| B13 | 6 gossip pools + the poster | 3 | |

Every batch is verified the way this repository verifies: a paired A/B in one
session, a rendered PNG judged by eye, `npm test` green, the 19-chapter soak at
0 errors / 0 NaN, frame time flat at 16.5–16.8 ms. The instruments that matter
here are `qa/first-ten.js` (B1 builds it: time-to-first-tick, time-to-wow,
time-to-door, longest gap, per chapter — the retention proxy), `qa/eng-rate.js`
(incidents and startles per 45 s of free play — the fun-per-minute proxy), and,
for anything that toasts, a `MutationObserver` on `.capyui-toasts` rather than a
wrapped `toast()` (module-local; sees nothing).

**The two numbers this whole document is betting on**, to be read off
`qa/first-ten.js` after B4: the first tick in every chapter under 30 s, and the
first door in Sydney under twelve minutes. If B0's stranger disagrees with the
driver about where they stalled, the stranger is right.
