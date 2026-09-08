# ROADMAP-NEXT.md — five things that would lift the game a notch, from the design chair

8 Sep 2026. Written the morning after B15 closed `ROADMAP-FUN.md`, from a
read-only survey of the tree, the README, CONTRACT.md, every roadmap and the
design memory. **This is a pitch, not a measurement.** ROADMAP-FUN's own
standing note records eighteen of its claims failing on measurement, so every
item below ends with the premises that must be measured before a line of it is
built. Symbols are named so a later batch can grep them; line numbers are not,
because they move by the thousand.

**What this document is for.** The base layer is done. Nineteen places, 231
tasks, 60 finds, 53 records with ghosts, 19 souvenirs, 10 costumes, 9 skills,
the incident chain, notoriety with spread, charm with three gestures, beats
that break, blame, gossip, posters. The question is no longer *is the diorama
reactive* — it is — but **why a player who has seen two places opens the file
again tomorrow, and what makes them send a picture of it to somebody.** That is
a different question from any of the fifty-odd passes so far, and it has
different answers.

**The two things this document refuses to touch**, inherited from ROADMAP-FUN:
the incident chain and the marquee law. And a third of its own: **the fixed
hour.** weather.js says there is no clock in it and never will be, and it is
right — a place you can only ever see at one hour becomes that hour. Nothing
below asks Iceland to have a morning. Where an item wants "a day", it means the
player's day, read off the save, never the world's.

---

## THE HEADLINE

**The game pays a session beautifully and pays a *return* almost nothing.**

Measured against what is there:

- **Nothing changes between two visits to the same place.** Leave Venice at
  eleven rows and come back: the pigeons are where they were, the same lines
  are gated on the same ticks, and the only thing that has moved is your own
  checklist. The one system that remembers you — `fam`, 34 s of calm proximity
  — is not on the save at all (`jrSave` writes `tasks seen recs ms chapms finds
  foundAt inc scn pho fed biome fin slid`; no per-person field). A person you
  spent ten minutes charming has forgotten you by the next session.
- **The capybara is the only animal in the game nothing sits on.** The single
  most-shared fact about this species — that birds, cats, monkeys, turtles and
  ducks use it as furniture — is absent from a game that has a herd system, an
  obey ladder, a loaf timer (`capyRestT`) and 3,700 people who photograph a
  sitting capybara. The animal that is *famous for being sat on* has never once
  been sat on.
- **Stillness is rewarded once and then ignored.** The calm (v23) closes the
  score, opens the camera and sits the animal down; B7 adds the photo. Then
  nothing. A player who leaves the game running gets the same frame for an hour.
  There is no *passive* mode, and cozy games live on one.
- **The chain scores quantity and never names what you did.** Three witnessed
  things in 12 s is AN INCIDENT, five is A SCENE, whatever the three were. A
  hat, a coffee and a flushed ibis score exactly what three kicked bins score.
  The Goat Simulator lesson — the retention is the *catalogue of named things
  you found out you could do* — has no home here. The finds are close but they
  are one-shot and mostly about the clock and the moveset.
- **The only thing that leaves the game is a raw PNG.** `photoShoot` downloads
  the WebGL read with nothing on it: no place, no stamp, no line. The first
  draft of ROADMAP-FUN wrote the shareable postcard up and cut it as "for the
  finished player". It is not; the screenshot moment is the *first* minute
  (the snack, the photo, the flock going up), and today that moment is
  composed by the game and thrown away at the last step.

---

## THE FIVE

Ordered by how much of the value lands in the first hour, then by cost. Each
is 2–4 batches of the repository's usual size. Two of them depend on each
other (2 and 3) and the order below respects that.

---

### 1. THE REGULARS — one friend per place, who remembers you across days

**Concept.** Every chapter names one local — a stallholder, a gardener, the
gondolier, the barista, the doorman, the station cook — as *the regular*: the
person in that place who notices you first and, uniquely in the game, does not
forget. Sit near them, bring them things, show off for them, and over
**visits** (not minutes) they go from *that animal again* to a nickname, a
standing gift, a secret about the place, a favour, and finally a line on the
ledger leaf. Nineteen friends, five tiers each, one tier per visit at most.

**The delight factor.** Cozy games run on exactly one fuel: *somebody in the
world is glad you came back.* Animal Crossing sells that with a letter; here
it is a person behind a counter turning round when you land and saying the
thing they only say to you. The tier lines are the joke — the capybara is
famous, the person is not impressed, and the friendship is the slow collapse
of their composure: tier 1 *"Oh. It's you."*; tier 3 they have named you
(and the name is theirs — Sydney's barista calls you *Flat White*, the
Pantanal cook calls you *Primo*, Monte Carlo's doorman *Sir*); tier 5 they
have a chair out for you. The gifts escalate from B8's snack to a thing off
their stall you can *carry away* — the one theft in the game somebody
consents to — and at tier 4 they **look the other way**: your mischief in
their sightline no longer raises *their* wariness, which is the interlock
running in reverse and the first time charm has ever bought a mischief
player anything.

**The retention hook.** One tier per `biome:enter`, full stop. Five visits to
best-friend a place; ninety-five visits for all nineteen; and the paper's
finished-chapter record board grows one line — *the regular: tier 2 of 5,
come back* — so a finished chapter has a reason to be travelled to that is
not a number to beat. The tier line is said on arrival by the regular (B15's
gossip already waits for a person in earshot; this one *is* the person, and
every regular is placed within earshot of the spawn by authoring). A returning
player hears, inside ten seconds, that the place knows them — the thing the
save currently proves only with a checklist.

**Mechanical synergy.** It is B7 + B8 + B15 with a memory, and it obeys the
refusal that shaped all three: **a local never moves.** Tiers are lines
(`game.sayNear`, own pool), gestures (`photo`, `give`, the pat — all in
`npcREACH_ST` already), a spawned-and-lobbed gift (B8's snack path with a
prop type instead of an edible), a wariness multiplier (`npcQUIET_K`'s shape,
per person), and a ledger line. Nothing walks. The Traveller (`npcTRAV_FIG`,
four chapters, lines gated on other chapters' ticks) is the proof the game
can already do a recurring character whose lines know history; this is
nineteen of them with a counter. Capybara trope: the animal everyone wants to
be friends with, finally with somebody who *is*.

**Premises to measure first.**
- `fam` is per record and lives only in memory — **MEASURED, 8 Sep:** npc.js
  initialises `fam: 0, famWas: false` on the record and `jrSave` writes no
  per-person field, so nothing about a person survives a reload. Adding
  `pal: {chapter: tier}` is additive with no version bump, by the pattern of
  `pho`/`fed`.
- Is there a local within `sayNear`'s earshot of the spawn in all nineteen? B15
  measured **fourteen of nineteen**; the other five need their regular placed
  or re-chosen, and two chapters (the Pantanal, Sơn Đoòng) have nobody by
  design. Nineteen may honestly be seventeen. Decide, do not assume.
- A gift that is a carryable prop needs a `physTYPES` entry per chapter
  palette. Count how many chapters already have a stall prop that reads as
  *theirs*; write the rest, or cap the gift at the snack where nothing fits.
- The "looks the other way" favour must scale *wariness written*, not
  `alarm` — the nine-skills memory found soft feet had to do the same or the
  world goes unresponsive.

---

### 2. THE PERCH — everything sits on the capybara

> **BUILT, first half, 8 Sep 2026 (N1). See CONTRACT.md.** The mechanic, the
> six chapters and the debug API are in. What the measurement changed about
> what is written below:
>
> - **The carrier premise was right and cost nothing.** A passenger is a pose,
>   not a body; position error against the seat is 0.000 m through four seconds
>   of walking in all six chapters.
> - **`put` did not need to grow a `y`.** The offer takes an optional
>   `lift(i, y)` and an optional `span`, and a kind without `lift` simply
>   cannot be perched — which is the honest answer for a cow, and it means the
>   refusals are a property of the registry rather than a rule somebody has to
>   remember.
> - **The seats came off `capyHULL`, not out of the air.** Three, all aft of
>   the ears, at 0.72 m over the feet standing and 0.57 loafing.
> - **Eight chapters offer an animal; SIX may be ridden.** Iceland's ewe and
>   the Pantanal's cow are refused on weight. Eleven chapters offer nothing,
>   which is one more than the item's "nine" — measured, all nineteen.
> - **The heron can be perched, and only by an animal that can FLOAT.** Both
>   its wade points are inside a 68 × 44 m pond and the herd's earshot is 15 m,
>   so there is no dry ground to sit still on within reach of it. The Pantanal's
>   skill, ten chapters later, is what buys you a heron. Nobody wrote that gate.
> - **Two of the eight offers had never worked**, and both reported a healthy
>   count while doing nothing: Antarctica's forty-two gentoos all read as being
>   at the origin, and Manly's gulls joined and could not be moved off their
>   awnings. Both fixed. An offer that registers, counts correctly and moves
>   nothing is the failure mode this whole contract keeps producing.
> - **The per-chapter record cannot be built as written.** A `RECORDS` key has
>   to be a task id, and "most on at once" is not a task. N2's problem.
> **BUILT, second half, 8 Sep 2026 (N2).** Three finds, the number the place
> keeps, and the people's reaction. What the measurement changed:
>
> - **"Stand up and walk and they stay on" was false, everywhere but a lawn.**
>   The median carry was **3.5 metres**, and every one of fifteen dismounts was
>   the hop rule firing on a kerb. `!grounded` is not a hop — the animal is off
>   the floor for 51 to 100 per cent of a normal walk. Nor is upward velocity:
>   something in the walk cycle is worth 2.9 m/s. The test is the jump INPUT.
>   After: fourteen of fifteen legs held the passenger for the whole walk.
> - **A pebble was reading as a barge.** `prop:impact` also fires when a prop
>   LANDS, so a stone the animal scuffed a second earlier unseated its
>   passenger. A barge is now something you did, at speed, at arm's length.
> - **The passenger book is not a grid.** Every ridable animal exists in exactly
>   one chapter, so nineteen places by six species is six cells and thirteen
>   blank rows. The honest surface is the ledger leaf, one line per place, which
>   is where the four counters that answer the same question already live.
> - **The record is not a `RECORDS` row.** See above; it is `pas` on the save.
> - The reaction is B7's photograph with a different pool and a quarter of the
>   wait, not a new gesture — and it needed no new cast, no new timer and no
>   new event.
>
> Still open: **the stowaway** (one animal crossing a border), which is the one
> part of this item that asks the herd to break its own rule, and the passenger
> COUNT as a shareable number, which belongs with item 5.


**Concept.** Loaf for a few seconds within earshot of the chapter's animals
and the ones that obey (the herd ladder: ibis, sheep, pigeon, cow, gentoo on
one wheek; cat and silver gull on two; the heron on three) do the thing the
species is famous for: they **climb on**. Then stand up and walk, and they
stay on. A pigeon on the head across San Marco. Three ibis in a row down the
back in the Botanic Gardens. The Göreme cat, asleep, through a hot-air balloon
launch. A gentoo, on a capybara, on an orca. The passenger count is a record
per chapter, and the **passenger book** in the journal is a grid — nineteen
places by every animal that has ever ridden — filled in by doing it.

**The delight factor.** This is the capybara meme, verbatim, and it is
laugh-out-loud on sight because it needs no explanation: the game does the
thing the internet already knows about. It is also the *screenshot*, more
than any single frame the game currently composes — B7's photographers turn
and raise their arms at a loafing capybara today, and a loafing capybara with
a heron on it is the same code and ten times the picture. The comedy compounds
with mischief: walk into the casino with a pigeon on your head and the doorman
(who already denies things, ch18) has a new problem; a stack of three ibis
barging into a spill is three startles from one gesture (B11 already routes a
*led, moving* animal through `game.startlePeople`). Nothing in the wardrobe
has an animal in it, and a living hat is funnier than any hat.

**The retention hook.** The passenger book is a collection with a
*discoverable* shape — nobody tells you the heron will sit on you, you find
out by sitting still for long enough at twelve metres, which is exactly the
obey-3 lesson the herd already teaches. Sixty-odd cells, each one a photo you
took by accident. The record per chapter (*most on at once*) is a par the
game can defend by construction (the count of animals that obey there), and
it gets a ghost for free where the run covers ground. And the **stowaway**:
one animal, and only one, may ride the three whistles to the next chapter —
the arrival card notices (*"You have brought a pigeon to Antarctica."*), the
regular (item 1) has a line about it, and the poster gets a second silhouette.
This is a deliberate exception to the herd's own rule that nothing crosses a
border, and it is proposed *because* that rule was written about fourteen
Venetian pigeons in a Vietnamese mountain; one on your head is a gag, not a
system. If the owner keeps the rule, the item loses one bullet and nothing
else.

**Mechanical synergy.** It is the herd with a vertical. `game.herdOffer`'s
contract gives systems.js `count()`, `at(i,out)` and `put(i,x,z,yaw)` — a
perch needs the offer to grow `put` by one `y` (or a parallel `lift(i,y)`),
and the general trick that made the herd chapter-neutral applies unchanged:
systems.js is last in the frame, so its write lands after the chapter's own
wander and wins. The animal is drawn by its chapter exactly as before; only
its position is dictated. Mounting is gated on `capyRestT` (the loaf) and the
obey tier the animal already has; dismounting on the hop, the dive, the slide,
a barge over `physBarge`'s 3.2 m/s and a wheek with feet off the ground. The
back has room: the costume memory measured the skull top at 0.18 and the
ears to 0.278, so a rider sits on the *back*, aft of the ears, on the one
part of this animal that reads from every angle. Capybara trope: the animal
that is furniture to every other species.

**Premises to measure first.**
- **The capybara is a carrier and every carrier in this game is kinematic**
  (the toybox memory: capybara.js damps anything it stands on to a stop). A
  perched animal is *not* a body on the animal's collider — it is a pose
  written every frame — so the carrier problem should not arise. Confirm by
  measuring the rider's position error over a run, a hop and a swim, and its
  behaviour when `capyRideBody` is set (the ferry, the balloon, the orca:
  three frames deep).
- `put` is called only for followers today; a perched animal may need a
  visibility or pose override the chapter does not expose (a walking pigeon is
  drawn walking). Ask each of the eight wired chapters what pose channel they
  publish; a rider drawn mid-stride is the cheap version and may be fine.
- The camera: the shoulder rig's "radius is a composition number" rule.
  Measure that a rider on the back is never between the boom and the animal's
  head at the resting elevation (29.3–29.8°).
- Whether the *heron* can be perched at all: it flushes at 9 m, earshot is
  15 m, and it must walk to you from twelve. The herd memory says it joins on
  the third wheek and walks the trail; a perch is one more step of the same
  walk. Measure before promising it.
- Nine chapters offer no herd animal. The passenger book is honest about that
  or it is a grid with nine grey rows; consider whether the Pantanal's native
  family (not offered — two systems would fight) can be the one exception the
  species story needs.

---

### 3. SLEEP ON IT — the nap, and the picture you come back to

**Concept.** Leave the capybara alone. After the calm and the loaf (6.5 s),
at about twenty seconds of no input, it **falls asleep** — the loaf tucks, the
breath slows, the score goes to the chapter's calm bed and stays there — and
the game becomes the diorama it always was underneath: the camera drifts on a
slow orbit inside its own floor and ceiling, the ambient movers do their
circuits, the marquee clock keeps counting (and the lens turns to it when its
window opens, the glimpse's own dolly), the animals climb on (item 2), the
regular comes to the counter's edge and says nothing. **Every ninety seconds
the game takes a photograph** into the album. Any key wakes it, and the
nearest person tells you what you missed — *"A heron stood on you for a full
minute. It looked disappointed."* — and the paper shows the frames.

**The delight factor.** The capybara in the yuzu bath, eyes closed, with a
tangerine on its head, is the second most-shared thing about this species and
the whole reason "cozy" attaches to it. Iceland already has the hot spring and
the seven-second sit; this makes the sleeping animal the game's own
screensaver in nineteen places, with the sky breathing (weather.js's `pulse`),
the floatplane doing its circuit, the storks turning on the Koutoubia. And the
wake-up line is the joke: the world was busy while you were not, and it has
opinions. Passive engagement is the ask, and this is the honest form of it —
not offline accrual, which the save cannot do and the fixed hour forbids, but
**a mode you can leave on a second monitor and come back to something.**

**The retention hook.** The nap shots are the *cheapest good photographs in
the game* and the album is what the ledger is made of (README: "the ledger is
made of your own photographs"). A player who has never pressed K comes back to
an album with a sleeping capybara in every place they have been, each with
whatever climbed on it — and a place that has not been slept in is a place
the album is missing. It also pays a family of finds that already exist in
spirit (*a full minute of doing nothing*, *twenty seconds in the rookery being
ignored*) and one new record per chapter that costs no authoring: *longest
nap with something on you*.

**Mechanical synergy.** The calm (v23), `capyRestT`, the loaf pose and the
breath (R5) are all built; the nap is a fourth rest tier on the same timer.
The orbit is the title pose's own slow camera (T1, the world behind the card)
put back in the world, bounded by `camFloor`/`camCeil` and the four underwater
rules. The photograph is `albAdd` on a timer instead of a key, keyed so it
does not evict a player's own thirty-six (the ghost cap lesson, v51). The
wake-up line is `game.sayNear` with a pool that reads what actually happened
— the perch count, a marquee window that opened, an ambient mover that
passed, a person who photographed you — which are all events the systems
already emit. Capybara trope: the animal whose entire brand is *relaxed*.

**Premises to measure first.**
- `capyRestT` and the calm: confirm a fourth tier does not re-trigger the
  photo/pat/gift gestures every ninety seconds (B7's per-person 90 s gate
  should hold it; measure a ten-minute nap in Sydney and count flashes).
- The album is thirty-six deep and the nap must never evict a hand-taken
  shot: either a second key or a tag with its own cap. Also `albAdd` blits at
  288×180 — a sleeping capybara at that size is a brown oval; the nap camera
  must frame *tight*, not the marquee-wide title orbit.
- A drifting camera for minutes will find every clipping fault the boom
  sweeps missed. Run the orbit in all nineteen for five minutes headless and
  read `camBoomCut` (or its equivalent) per chapter before anything else.
- A nap on a carrier (the ferry under way, the balloon, the orca): refuse it
  or measure it. The seven-ways memory says a carrier is where passengers are
  lost; falling asleep at the helm is a row somebody will try.
- Idle detection on touch and pad must not fire while the player is reading
  the journal or the ledger (both are surfaces you sit on for a while).

---

### 4. THE REPERTOIRE — named stunts, found out by doing them

**Concept.** The incident chain counts *how many* witnessed things happened
in twelve seconds. The Repertoire reads the same window and asks *which*.
Forty-odd authored patterns over the event kinds the chain already sees —
`bang`, `startled`, `spilt`, a shatter, a flush, a theft, a perch dismount, a
tool taken — each with a name, a line, and a count on the save. Do a hat, a
coffee and a flushed ibis inside a chain and the card that says AN INCIDENT
says, underneath, **THE FLAT WHITE** — and the nearest person says the name
too, because in this square it has one now. Do it again anywhere and it is
still the Flat White, and the count ticks. The Repertoire page in the journal
is a list of names with the ones you have not found out yet drawn as
silhouettes, exactly as the shelf draws unearned souvenirs.

**The delight factor.** This is Tony Hawk's trick list and Goat Simulator's
achievement wall, in a game that already has the ingredients and never names
the dish. The comedy is in the naming — the game deadpan-christening a
sequence of petty crimes as if it were a figure-skating element (*the Double
Spill*, *the Long Flush*, *the Gondolier's Farewell*, *the Hat Trick*, which
must be three hats) — and in the people repeating it: blame (B13) already has
the nearest pair arguing about who did it; with a name, they argue about
*what* it was called. It converts the chain from a meter into a language.

**The retention hook.** Forty silhouettes is forty *questions*, and unlike the
finds they are repeatable and scored, so the loop is discover → name → do it
somewhere harder. Most patterns are chapter-neutral (a hat is a hat in
sixteen chapters), which is what makes the second and third visit to a place
a hunt rather than a replay: *can the Flat White be done in Hanoi?* A handful
are chapter-locked by construction (a stunt with a gondola in it) and those
are the marquee-adjacent ones. Notoriety (B14) gains a term it is honestly
missing — *variety*, the count of distinct names — which is the difference
between a masher and a stylist, and the ledger foot can say which you were.

**Mechanical synergy.** It is a read-only consumer of the chain: `incAdd` and
the 12 s window are untouched, `sysINC_COOL` (50 s) stays the ceiling on how
fast anybody can earn anything, and the pattern-matcher runs on the event
list the chain already keeps for its own count. The names are said through
`game.sayNear` and shown on the incident card's second line, which the card
has (B14 added a fourth line to the arrival card the same way). The save field
is `rep: {id: n}`, additive. The journal page is the shelf's own drawing rule
(nineteen slots, grey until earned) with forty slots. Capybara trope: the
world's calmest animal, with a criminal record that reads like a dance card.

**Premises to measure first.**
- **What the chain actually stores — MEASURED, 8 Sep.** `incAdd(x, z, key)`
  keeps a count (`incN`), a window (`incT`), the first event's position and a
  per-prop last-counted time (`incSeen`, keyed by prop id, for `sysINC_SAME`).
  **No kind, no list.** `key` is the prop's id, not what happened to it. The
  matcher needs a ring of the last five witnessed events — kind, prop type,
  person — that the chain does not keep, and the kind has to be added at the
  four call sites that feed `incAdd` ("the four handlers below"), which is
  where it is known. Additive; the chain's own arithmetic is untouched.
- The kinds are coarser than the names need, and it is worse than a `bang`
  not saying hat from bin: **`npc:startled` emits the person record and not
  the cause** (npc.js, three emit sites plus the loudest-reaction collapse
  D3 asked for), so today nothing downstream can tell a barge from a wheek
  from a led animal from a spill. Prop type is on `prop:impact` (the body).
  The cause must ride the startle event before the Double Spill can be told
  from two bangs.
- Author forty names *against the eng-rate baseline*: a pattern the random
  masher completes in its first minute is a freebie, and one nobody completes
  in ten is a silhouette for ever. The B6 lesson — the masher's numbers move
  ±3 run to run — means the calibration needs three runs a side, not one.
- The card's second line and the pips are a fixed layout; a long name at
  phone width wraps. The touch memory's rule: measure the longest name on the
  narrowest layout before writing the thirty-ninth.

---

### 5. WISH YOU WERE HERE — the postcard that leaves the game

**Concept.** `K` composes a *postcard* instead of downloading a frame: the
letterbox, the chapter name in its own register, the souvenir drawn in the
corner as a stamp if you hold it, the notoriety tier as a second stamp, the
passenger count if something is on you (item 2), and one line of **caption
in the world's voice** — the gossip pool, the blame pair's accusation, the
regular's nickname, the Repertoire name of the last thing you did. Copy to
clipboard, share on a phone, download as the fallback. And the shots the game
takes *for* you — the nap (item 3), the scene card, the marquee lift — are
postcards too, so the shareable moment never depends on somebody having
pressed a key at the right frame.

**The delight factor.** The frame is already the game's best argument for
itself — flat-shaded, high-key, a rodent with a hat in a Venetian flood — and
the caption is what makes it *land* in a feed: a picture of a capybara on a
gondola is nice; a picture captioned *"the gondolier is not going to talk
about this"* is a joke somebody sends to a friend. It is the one item in this
document that reaches people who are not playing, and the first draft of
ROADMAP-FUN wrote it up and cut it for the wrong reason: the moments worth
sending are the *first* minutes — the snack, the flock, the animal on your
head — not the ending.

**The retention hook.** Twofold. The contact sheet — the album as one image,
nineteen tiles, the journey clock, the tier, the shelf — is the *"I finished
it"* picture and the one thing that has ever made somebody else open a game
like this. And the caption pool is a reason to *earn* captions: a postcard
from a place where you have a tier-3 regular says your nickname; one from a
place where you have done nothing says the arrival line. The picture is
better the more the world knows you, which turns items 1, 2 and 4 into things
you can show.

**Mechanical synergy.** `photoShoot` already reads the canvas in the same JS
turn as the render and calls `toDataURL` — the composite is a 2D canvas drawn
over that read before the download, not a new capture. Text on a 2D canvas is
DOM-side, so the repository's rule that the *world* has no font atlas is not
touched (the paper, the cards and the ledger are already text). The stamps are
the souvenir polygons (`physKEEPS`, a dozen flat shapes each) and the
picker's postcard glyphs (`sysMARKS`), redrawn on a canvas — the same "drawn,
not photographed" answer B15 gave the poster. `navigator.share` where the
touch layer already knows it is on a phone; `clipboard.write` with a blob
elsewhere. Capybara trope: the animal whose whole cultural existence is
*pictures of it, sent to people*.

**Premises to measure first.**
- The album's 288×180 thumbnails are *not* the source — the postcard
  composites from the full read in `photoShoot`, or it is a brown oval with
  a stamp on it. The nap and scene auto-shots therefore need the full read
  kept for one turn, which is a memory question at 1800×1200: measure.
- `document.fonts.ready` before the first draw, or the first postcard of a
  session prints in a fallback face (the first draft's own trap; still true).
- The QA harness sandbox blocks share and clipboard; the game's own does not.
  Verify under playwright-cli with a real key, and accept that the headless
  soak can only prove the download path.
- The caption must never be a line that names a key or a task id
  (`qa/p6-static.cjs` already fails a `say` that does; extend it to the
  caption pool).

---

## HOW THEY FIT

| item | first-minute value | return value | shareable | depends on |
|---|---|---|---|---|
| 1 The Regulars | a person turns round on arrival | one tier per visit, ×19 | the nickname on a postcard | — |
| 2 The Perch | the meme, on sight | the passenger book, a par per chapter | the best frame in the game | herd offer + `y` |
| 3 Sleep On It | — | an album that fills itself | the nap shot | 2 for the payload |
| 4 The Repertoire | the first named stunt | forty silhouettes, variety in notoriety | the name as caption | the chain's event ring |
| 5 Wish You Were Here | the first snack, sent | the contact sheet | *is* the share | 1, 2, 4 for captions |

Three of the five write one additive field on the save (`pal`, `rep`, the
passenger book) in the exact shape `pho`/`fed` used — no version bump, and a
missing key reads as zero. Item 3 writes nothing. Item 5 writes nothing.

**The order.** 2 then 3 (the perch is the nap's payload and its best
photograph); 1 in parallel because it shares no code with them; 4 after the
chain's storage is measured; 5 last, because every earlier item makes its
captions better and it is the one that should ship with the most to say.

---

## WHAT THIS DOES NOT PROPOSE, AND WHY

- **The pup, stage one.** Written up in `git show 6f04afd:ROADMAP-FUN.md`
  and the argument stands; it is the largest single lift available and the
  most-asked question about the Goose Game. It is not here because item 2
  gets most of the *comedy double act* for a fraction of the cost (a rider
  reacts, dismounts, startles people, crosses one border), and the answer to
  "should the pup exist" is what B0's stranger says when a heron sits on
  them. Build the perch, watch, then decide the pup.
- **The second lap and a daily.** Also in that draft. The daily needs a real
  date on the card and gives two people something to compare; it is a good
  item and it is a *tenth* one. The Regulars' one-tier-per-visit gives the
  return cadence a daily would, without a calendar the fixed hour would
  resent.
- **A twentieth chapter.** ROADMAP-FUN said it and it is still true. Every
  hour here is worth more than a city.
- **Anything that moves a local.** Three items in the last roadmap were
  refused for one architectural reason — a local never writes its own x/z —
  and nothing above needs one to. The day somebody funds locomotion for a
  hundred and fifty hand-placed people, the approach, the plunge and the
  denial come back on their own.
- **A fail state, a timer, a tutorial.** Same answer as before.

**And B0 still has not been done.** Every item above is a prediction about
what a stranger laughs at. Sit one down first.
