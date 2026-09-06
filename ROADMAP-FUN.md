# ROADMAP-FUN.md — the fun review, and six things that would lift the game a notch

6 Sep 2026. Written after the character pass (`ee4a0b2`) and the sound review
(`8bfce6f`), from the design chair rather than the art or audio one. Scope: not
"what is broken" — fifty-odd passes have answered that — but **"what would make a
player laugh, come back, and show somebody"**. Three read-only surveys of the tree
(the verbs and props; the people; the meta loop) plus the README, CONTRACT.md,
every previous roadmap and the design memory. Every claim below names the symbol
it hangs on; line numbers move by the thousand between batches, so grep the name.

**How this was reviewed, honestly.** It is a reading of the systems, not a
playtest with strangers. Nobody has yet timed a chapter or watched a first-time
player (v53 said so, and it is still true). Item 0 below is the one thing this
document cannot do for you.

---

## THE HEADLINE

**The game is a magnificent reactive diorama with a checklist in front of it.**

That is meant as a diagnosis, not an insult. Measured against what is there:

- **Fourteen verbs on six inputs, and most of them are states the world puts you
  in.** The player *chooses* four things: move, hop, grab/throw, wheek. Throw is
  one fixed impulse (`capyTryRelease`: `5.0 + (run ? 2.0 : 0)` along `capyYaw`,
  no aim, no charge, no gentle put-down). Barge and bonk are automatic. Of ~50
  `physTYPES`, **one** is fragile (`cuencobowl`), **three** spill, `receive` is a
  shadow flag and nothing in the game accepts a deposited object, and **no prop
  can be ridden, pushed, stacked or used as a tool**. "Wreck the place" mostly
  means "nudge the place".
- **The people are an extremely good reaction machine with almost no volition.**
  Two chapters have a steering cast with jobs (Quay's waiter/gardener/busker,
  Pasto's vendor/abuela/farmer/dog). The other fifteen have ~150 *locals* whose
  job is `beat` — three cosmetic arm shapes that are "outranked by everything" and
  never fail. npc.js says of its own reaction layer: *it does not deny anything;
  no grab fails, nothing is taken away.* Wariness, familiarity and the heat field
  gate **radii and lines** and never a door. The funniest thing in Untitled Goose
  Game — humans arguing about the goose — cannot happen: nobody blames anybody,
  and animals react only to the capybara, never to each other's panic.
- **Nothing crosses a chapter.** `jrChapInc`/`jrChapScene` are saved per chapter
  and read only by the ledger. The Traveller (`addTraveller`) is the one recurring
  face, in four chapters, with four unrelated lines. The `before:`/`after:` line
  channel — the best writing in the game, 315 uses — resolves only task ids inside
  the current chapter.
- **A finished chapter is a dead room and the ending closes rather than opens.**
  `chapComplete` is all-or-nothing, 231 of 231, nothing optional. The 19-souvenir
  horseshoe (`sysFinaleStage`) is the best asset in the game and it ends in
  `location.reload()`. No NG+, no seed, no variance between playthroughs, no
  player-set goal, no aggregate but the total.
- **The only thing that leaves the game leaves it un-styled.** `photoShoot`
  composes a caption and draws a frame, then downloads a bare canvas: the ticks,
  the letterbox and the caption are DOM and are not in the PNG. No clipboard, no
  share, no free camera.

And two things that are already right and must not be touched by any of this:
**the incident chain** (three witnessed things in 12 s → AN INCIDENT; five → A
SCENE) is the one unscripted reward loop and it is good; and **the marquee law**
(one `wow` per chapter, sixteen lifts in the game) is what makes the payoffs worth
anything. Every item below feeds the first and obeys the second.

---

## 0. FIRST, WATCH SOMEBODY PLAY (2 h, no code)

Before any of the six: sit one person who has never seen it in front of Sydney,
say nothing, and take notes for twenty minutes. Then Pasto. Write down the first
thing they try that does nothing, the first time they look at the paper for
instructions, and the first laugh. Gap 1 below is a *prediction* of that list;
the session either confirms it or replaces it, and either is worth more than the
prediction. `qa/eng-rate.js` (45 s of driven free play, counting toasts, tasks,
impacts, startles) is the closest instrument and it cannot laugh.

---

## THE SIX

Ordered by value over cost. 1, 2 and 5 are the ones that change what the game
*is* for the money; 3 and 4 make the eight hours cohere and give them a second
lap; 6 is the swing.

### 1. THE TOYBOX — give the four chosen verbs depth (≈4 batches, 10–12 h)

*The argument.* A slapstick physics game is only as funny as the worst thing you
can do with an object, and right now the worst thing you can do is throw it five
metres in the direction you are facing. Every one of these is a change to
props.js or capybara.js against a hook that already exists. Nothing here needs a
new key; `E` already does six jobs by context and these are the seventh and
eighth.

**1a. Put it down, and put it IN.** Tap `E` = throw as now; *hold* `E` past
~0.35 s while stationary = set it down in front of you (release with zero
impulse, snapped to the nearest `receive` prop within 1.2 m if there is one).
Make `receive` mean something: a bin, a basket, a boat, a fountain, a pram, a
gondola, a bowl of pho. Ten types already read as containers; the flag is at
`physTYPES` and is currently a shadow. A prop placed *in* another travels with
it (parent the body: same `capyRideBody` frame trick, one level). This is the
Goose's bucket, and it creates a whole class of authored rows nothing can
express today: *put the gardener's trowel in the bin*, *load the flower bicycle*
(Hanoi's `unload` row gets its opposite).

**1b. Aim and charge the throw.** Hold `E` past the put-down threshold *while
moving* = charge; a faint arc on the ground the way the hint arrow is drawn; release
throws at 5–11 m/s with the pitch from the camera's elevation. Keeps the tap
throw exactly as it is so nineteen chapters of "throw it in the canal" tasks are
untouched. Verify by A/B on `throw-in-canal`-class rows: tap distance unchanged
to the decimal.

**1c. The nudge.** Walking into a prop below barge speed applies a *steady* push
along your heading rather than the solver's incidental contact — so a ball rolls,
a barrow moves, a trolley starts down a slope. `physBarge` already discriminates
on speed (≥3.2 m/s); this is the branch below it. Then **make three props
rideable**: a shopping trolley (Sydney/Quay), a wheelbarrow (Pasto has one you can
push), and a loose floe or crate on water. Hop on = `capyRideBody` with weak
steering, exactly the passive carrier contract the mini set pieces already use.
A capybara in a trolley going down the Selarón steps is the screenshot this game
does not yet have.

**1d. More things break and spill.** `fragile:` on ten more types (glasses,
plates, the clay pots of every market, a champagne flute in Monaco, a lantern),
`spill:` on five more (paint in Cali's painted street, a bucket of fish in
Manly, the pho). Each shatter and spill already counts as a witnessed event for
the incident chain (`physShatter`, `physSpill` → `disturbed`), so this is the
cheapest way to make INCIDENTs reachable in the fifteen chapters where they are
currently rare: **measure `qa/eng-rate.js` incidents-per-45 s before and after
per chapter**, target ≥1 in every chapter from the spawn ring.

**1e. People have bodies.** The missing punchline. Not ragdoll: three
authored states on the existing figure — *stumble* (barged ≥3.2 m/s: two steps,
arms out, drops what they hold via the existing `physBarge` path), *sit down
hard* (barged while startled, or slipped on a spill they walk through), *fall in*
(stumble at a quay edge → `plunge`, which already exists). Gate on `r.fig` as the
walk does. Each is a line-pool moment and an incident event. **Do not let a
person fall in more than once per 40 s** — the rule from the ambient movers
applies: an irritation is a delight that repeats.

*Traps.* Any change to the hop arc is forbidden (`capyHOP_VEL` is the apex
eighteen chapters are sized against); the trolley must be a *carrier* not a
launch. A put-down that snaps to a container must never snap to a container the
animal is standing in. The nudge must not apply to `planted` or kinematic props
or you will push a jetty. Every new fragile type is a new shard pool: check
`physShatter`'s pool cap before adding ten.

### 2. PEOPLE WITH JOBS YOU CAN RUIN (≈3 batches, 8–10 h, half of it authoring)

*The argument.* The comedy of the Goose Game is not that people react — it is
that people were *doing something*, and now they cannot. This game has the
reaction; it needs the something. All five hooks exist.

**2a. A routine that can be broken.** `beat` gets a `tool:` — the prop id the
person is working with (the fishmonger's cleaver, the busker's guitar, the
gardener's trowel, the artist's brush; ~40 of the ~150 locals stand next to one
already, that is why they are there). Take the tool and the beat *fails*: the
arm comes down on nothing, the person looks at their hand, and the pool switches
(`before:`/`after:` already resolves a condition; add `tool:` as a third). Give
it back (1a: put it down within 2 m) and they pick it up and resume. The single
highest comedy-per-line change available; the retrieval already exists
(`localOwnStart`) so the person also *comes and gets it*, which is the scene.

**2b. Wariness finally denies something.** Once, per chapter, something a hot
crowd will not let you have: Monaco's doorman steps into the doorway
(`monLocDoor` + `npcREACH_ST`) while `npcHeat` at the steps is over 0.6 and
stays there twenty seconds after it drops; the Cali bandleader stops the band
when you have knocked over a third instrument; the Kyoto tea lady closes the
terrace shutter. **Denial is a puzzle, not a punishment**: the way in is always
*wait or go round*, which is the thing this game already asks for exactly twice
(the Drift's wind, Venice's tide), and it gives the shed-heat-and-return loop a
reason to exist. Never gate a marquee on it.

**2c. Nobody blames anybody else — fix that.** `npcWitnessHold` already knows who
saw what. When a witnessed event has a *person* within 3 m of the prop who was
not the capybara, rewrite the nearest `addExchange` pair's next exchange into an
accusation of the wrong person — one pool of ~12 neutral pairs (*"That was
you." / "I was holding a coffee!"*), chapter-agnostic, obeying the incident pool's
own rule that **no line may name what was done**. The busker blamed for the
pigeons is the joke; the capybara sitting between them is the picture.

**2d. Animals startle people.** Route the Venice flock's launch, Murray, the
Pasto dog and every `herdOffer` animal's flush through `localsReact(kind, x, z,
strength, radius)` with the *animal* as the source. Two hundred pigeons going up
should make a square flinch. Chain reactions are free comedy and the plumbing is
already there; the witness chain then counts the flinch. Measure: a flock launch
in Venice arms the incident chain on its own (it cannot today).

**2e. The Traveller becomes a character.** Four chapters, same shirt and hat,
four unrelated lines. Give them one *arc* — four escalating lines that know
where they have seen you (Quay: *"Oh, hello."* → Hanoi: *"I am not going to ask
how you got here."*) and put them in two more chapters so a player meets them
six times in eight hours. Reads `seen[]`, which is already on the save. Zero new
state.

*Traps.* A tool-less beat that plays every 3 s is a metronome (the ambience
lesson): the failed beat plays *once*, then the person stands and looks. A
doorman who blocks while a task needs the door is a wall — assert every gated
door has a `nextIn`-style clock and never covers a `wow`. Blame exchanges need
the two people to *face each other* (addExchange does this) or the joke has no
subject.

### 3. NOTORIETY — the thread that crosses chapters (≈2 batches, 5–6 h)

*The argument.* Eight hours, nineteen places, and the only thing you carry between
them is a box. Skills travel (by design), costumes don't (by design), and
*consequence* doesn't (by omission). This gives the journey a spine that is not
a shelf of objects — without one new save field, because it is a projection of
the counts that are already there, exactly as `keep` is a projection of ticks.

- **The number.** `notoriety = f(Σ jrChapInc, Σ jrChapScene, records beaten, finds)`
  — one derived scalar, five named tiers (*a rumour · a nuisance · a menace · a
  legend · a natural disaster*). Shown on the departures board and the ledger
  header where the journey clock is.
- **The arrival card knows.** `showPlace` already carries a second line on
  arrival. At tier ≥2 it is a headline: *"SIGHTINGS OF A LARGE RODENT REPORTED
  IN PASTO"*. One line per tier per chapter, authored (19 × 4 = 76 lines, the
  most expensive part of this item).
- **Gossip.** `npcPLACE_SAY` gets a `heard:` pool, three lines per chapter that
  refer to the *previous* chapter by name — the locals in Kyoto have heard about
  Circular Quay. Reads `seen[]` and the previous chapter's `inc` count; the line
  is chosen by whether you actually did anything there.
- **The poster.** From tier 3, one grabbable `wanted-poster` prop appears per
  chapter, on a wall near the spawn ring, with the *capybara's own album photo*
  from the previous chapter on it (the thumbnails are 288×180 and already a
  texture-sized JPEG). Stealing it is an unlisted find. This is the one place
  the game would look back at the player with their own picture.
- **The ending reads it.** `ROADMAP-FINISH` already asks for the ending keyed on
  `Σ jrChapInc`; the ledger's last line becomes the tier, and the lawn ceremony's
  crowd line is chosen by it.

*Traps.* Notoriety must **never cost anything** — it spends only on attention
(the rule from the heat field, proved by the guard shuffle measurement). A
poster texture from `localStorage` must fall back to the chapter's `sysMARKS`
glyph when the album is empty or the read throws (trap 3 in the album memory:
declare the read above the constructor). Headlines are written per chapter and
tier; if authoring time is short, ship tiers 2 and 4 only.

### 4. THE SECOND LAP — reasons to come back (≈3 batches, 7–9 h)

*The argument.* Everything a replay mode needs is already data: 47 pars, 24
ghosts, 60 finds, per-chapter incident counts, 19 souvenirs, 10 skills. Nothing
assembles it into a goal, and a finished chapter turns into a record board with
no reason to travel to it.

- **The clean sheet.** Per chapter, a second row on the record board: *every par
  beaten · both place finds · one SCENE*. Three ticks, a gold edge on the
  departures-board thumbnail, and the paper's finished-chapter board shows what
  is left. Turns 19 dead rooms into 19 short lists. Reads only existing tables.
- **"Do this place again"** — already on `ROADMAP-FINISH`'s open list with the
  in-paper confirm (3 h). Ship it here, because a clean sheet without a reset is
  a taunt.
- **The lawn opens instead of closing.** After the finale, `Enter` does not
  reload: it hands the player Sydney with **every costume wearable anywhere**
  (`sysWARDROBE` gets a `lap ≥ 2` column; the rule "a costume that travels is
  fancy dress" is exactly right, and fancy dress is exactly what the second lap
  is), all ten skills on from the first frame, and the clean-sheet board as the
  new paper. NG+ with no new content and no new save field beyond `lap`.
- **The postcard run.** A seeded daily: from the date, pick three chapters and
  one goal in each (a par, a find, an incident target), presented as three
  postcards on the title card with a stamp. Scored on the ledger as one line, with
  its own ghost. It is a whole replay mode built from four tables that exist, and
  it is the only thing in this list that gives two people something to compare.

*Traps.* Ghosts are keyed by task id and capped at 24; a second lap must not
evict a first-lap ghost by playing (v51's `sysGHOST_KEEP` lesson — raise the cap
or key by `lap`). A chapter reset must clear `inc`/`scn` for that chapter only and
must *not* touch `finds` (a find is a thing you turned out to have done; you did).
The daily seed must be derived from the date in the *player's* zone and printed
on the card, or two players' "same day" differ silently.

### 5. THE POSTCARD THAT LEAVES THE GAME (≈2 batches, 4–5 h)

*The argument.* This is the cheapest item and the only one that reaches people
who are not playing. The frame, the caption and the ticks are composed today and
thrown away at the last step.

- **Bake the postcard.** In `photoShoot`, draw the letterbox, the four ticks, the
  chapter name, the weather label, the journey clock, the chapter's `sysMARKS`
  glyph as a stamp and the souvenir as a second stamp if you hold it — onto a 2D
  canvas over the WebGL read, and download *that*. Same 3:2, 1800×1200.
- **Clipboard and share.** `navigator.clipboard.write` with an image blob, and
  `navigator.share({files})` where it exists (phones — the touch layer already
  knows it is on one). The download stays as the fallback. The game's own
  sandbox does not block these; the QA harness's does, so verify under
  `playwright-cli` with a real key.
- **The free camera.** Photo mode uses the play camera with a lens damp. Give
  `K` an orbit: left stick orbits, right stick raises and dollies, within the
  camera's own floor/ceiling (`camFloor`/`camCeil` are already published per
  chapter). The rig can dolly and never does for a player.
- **Poses on demand.** In photo mode, `Q` cycles four holds — loaf, the shake,
  the wheek face, the head-up alert — from the animations that already exist,
  paused on their best frame (the character pass measured which frame that is
  for each).
- **The contact sheet.** The album exports as one image: 19 tiles, the journey
  clock, the notoriety tier (item 3), the souvenir shelf. This is the "I finished
  it" picture and it is the one people post.

*Traps.* Reading the WebGL canvas must happen in the same JS turn as the render
(`photoShoot` already does this; the 2D composite must not defer it). Fonts on a
2D canvas must be loaded before the draw or the first postcard of a session
prints in a fallback face — `document.fonts.ready`. The free camera must obey
the underwater rules (four of the camera rules are wrong underwater — see the
water memory) and the exit-board floor.

### 6. THE PUP — a companion, and the seed of local co-op (the swing; ≈4 batches
for stage one, unknown for stage two)

*The argument.* This game has a herd you keep for 21 s, a flock you can whistle,
a dog that orbits you in Pasto and a native capybara family in the Pantanal —
and the animal spends eight hours alone. A second capybara is the thing that
turns a solitary sandbox into a comedy double act, and it is also the honest
answer to the most-asked question about the Goose Game after it shipped.

**Stage one — the pup follows you (all of the value, none of the refactor).**
In the Pantanal, the one chapter the animal is from, `gather` teaches the herd;
the chapter's last row hands you a *pup* instead of a keepsake — or as well as
one. It follows on your trail (the herd's own no-flocking walk, `panHerd`'s
polyline follower is the template), crosses chapters with you (it is
`physKEEPS`-class, not `herdOffer`-class — the one animal that is not confiscated
at a border), makes a small wheek a beat after yours, copies your loaf, and can
be picked up and carried (a held prop with a face; put it *in* things per 1a —
a pup in a pram in Venice is a row). It gets its own three-state reaction from
the crowd (*"Oh no, there are two of them."*), which is an incident line and a
photo. It is scenery that loves you, and the whole thing is built out of the
follower, the keepsake and the `localsReact` source hooks.

**Stage two — a second pad drives it.** `padPoll` binds exactly one pad
(`padIdx`). capybara.js is a singleton with module-level state, so a second
controlled body means factoring the animal's state into an instance — the
biggest refactor this list proposes and the reason it is last. The camera frames
the midpoint and widens with the spread (the ferry's helm camera and the condor
rig already solve "two things in one frame"). Everything in items 1 and 2 becomes
twice as funny with two of you, and the incident chain already counts any
`disturbed` prop regardless of who disturbed it. **Decide on stage two after
stage one has been played by two people sharing one keyboard**: if they fight
over it, build it.

*Traps.* A follower on a carrier (the ferry, the balloon, the orca) is the
seven-ways-a-carrier-drops-its-passenger problem again — the pup must be *reported
as ground* on a raft exactly as the herd memory says, or it falls through every
ride. A pup must never be between the shoulder camera and the animal (the
souvenir-ring lesson: radius is a composition number). And a pup that wheeks
every time you do is a metronome; it answers one in three.

---

## WHAT THIS DOES NOT PROPOSE, AND WHY

- **More chapters.** Nineteen is plenty; the game's problem is depth per place,
  not count of places. Every hour in this list is worth more than a twentieth
  city.
- **A fail state or a score that punishes.** "Nothing can kill you" is the
  design's best decision and item 2b's denial is deliberately a wait, not a loss.
- **Online anything.** No server, no leaderboards. Item 4's daily gives two people
  something to compare across a table; that is the right size.
- **More payoff spectacle.** The lift, the acts, the cards and the mix are done
  and measured. Another celebration would devalue the sixteen that exist.
- **Voice or assets.** The synthesised score and the no-asset rule are the
  identity. The Traveller's arc and the gossip pools are text.

---

## THE ORDER

| batch | item | hours | one commit each |
|---|---|---|---|
| 0 | watch somebody play; rewrite gap 1 from what they tried | 2 | notes only |
| B1 | 1a put down + receive · 1d breakables and spills · eng-rate before/after | 3 | |
| B2 | 1b aimed throw · 1c nudge + one rideable prop | 3 | |
| B3 | 1e people have bodies · 2d animals startle people | 3 | |
| B4 | 5 the postcard baked, clipboard, share | 2.5 | |
| B5 | 2a the tool and the broken beat (12 locals, four chapters) | 3 | |
| B6 | 2c blame · 2e the Traveller's arc · 2b one denial (Monaco) | 3 | |
| B7 | 3 notoriety: the number, the arrival headline, the ledger | 3 | |
| B8 | 3 gossip pools + the poster · 5 free camera + poses | 3 | |
| B9 | 4 clean sheet + do-this-place-again + the lawn opens | 3 | |
| B10 | 4 the postcard run (daily) · 5 contact sheet | 3 | |
| B11–14 | 6 stage one: the pup | ~12 | |
| — | 6 stage two: decide after B14 has been played by two people | ? | |

Every batch is verified the way this repository verifies: a paired A/B in one
session, a rendered PNG judged by eye, `npm test` green, the 19-chapter soak at
0 errors / 0 NaN, and frame time flat at 16.5–16.8 ms. The instruments that
matter here are `qa/eng-rate.js` (incidents and startles per 45 s of free play
per chapter — the fun-per-minute proxy) and, for items 2 and 3, a
`MutationObserver` on `.capyui-toasts` rather than a wrapped `toast()` (which
is module-local and sees nothing).

**The one instrument this needs that does not exist:** a per-chapter
*chosen-verb* count — how often, in 45 s of free play, the player throws, puts
down, nudges, wheeks and grabs. If item 1 is right, that histogram goes from
"grab, throw, grab, throw" to something with five bars in it, and that is the
number that says the toybox worked.
