# THE LIFT PASS

11 September 2026. Branch `lift-pass`, off `depth-tier1`.

Brief: review the whole game and take it from "fun and decent" to something
memorable, in one long pass, before release.

---

## THE REVIEW, AND WHAT IT FOUND

Six reviews ran in parallel over the whole tree — game design, art and
animation, audio, writing and narrative, UX and accessibility, and a static
defect audit — and then I played it myself and looked at twelve chapters.

The reviews disagreed about almost everything except two things, and they
reached both independently.

### 1. The camera was showing the player the pavement, not the place

The premise is one capybara in nineteen of the most photographed places on
earth. The frame the game spends its life in contained none of them.

The horizon's height in the picture is `tan(pitch) / tan(halfFov)` in NDC and
depends on nothing else, so it is exact rather than judged. Measured on the
live camera in eighteen chapters, walking and settled:

| | pitch | horizon (1.0 = top edge) | sky, by a 273-ray grid |
|---|---|---|---|
| walking | 28–39° | 1.05–1.80 | 0.0% in 18 of 18 |
| settled | 22.8° | 0.94 | 0.0% in 18 of 18 |

Venice standing between the two columns of San Marco was grey flagstones and
two column stumps: no Basilica, no Campanile, no arcades, no water. Pasto — a
chapter whose entire subject is a volcano — was 70% beige paving with Galeras
nowhere in it.

**An earlier pass measured the same 0% and drew the opposite conclusion from
it**: that clouds in twelve skies would never be seen, so they were not built.
The conclusion to draw from a game whose frame has no sky in it is not that
skies are worthless.

### 2. Nothing could ever be taken away from you

232 tasks, every one of them compulsory, an arrow pointing at each, no health,
no oxygen, no fall damage, no respawn, and one chapter in nineteen with any
real denial in it. The tension curve is flat at zero for the whole game.

The fix is not a fail state — every previous pass rejected one and was right to.
It is that **finishing a chapter and being allowed to leave it were the same
question**, and they should not be.

---

## WHAT WAS DONE

Ten commits. Each one is measured, and where a measurement could not resolve a
change the commit says so rather than claiming the change.

### L1 — four ways this build could fail in front of a player

- **`#err` shipped.** A raw stack-trace panel across the bottom 45% of the
  screen, suppressed only when the boot card was already up. Every other
  window-level throw painted it over a running game, and `textContent +=` had
  no cap and no dedup — a per-frame throw appended ~80 characters sixty times a
  second into a pre-wrap block re-laid-out every frame. Now opt-in on `?debug`,
  capped at 8 kB, repeats counted. `console.error` still gets every one.
- **`game.post.render()` was the one per-frame call outside the strike system.**
  A throw there escapes `game.tick`, and `mainLoop` queues the next frame
  *before* calling tick — so the loop survives and the game simulates behind a
  frozen picture at 60 Hz into the strip above. Wrapped. The `finally` is the
  load-bearing half: `post.render` binds `sceneRT` at its top and unbinds only
  at the end, so a throw mid-pass left the renderer pointed at an offscreen
  target for good and every later recovery path drew to nowhere too.
- **The score runs on its own `setInterval`**, which main.js's never-drop list
  cannot reach. Three consecutive throws now stand it down for two seconds.
- **`palBangkaBody`** was the one kinematic carrier written per frame without
  its `palSyncBody` pair.
- **`build.mjs`'s collision gate** — the only thing between the one-scope
  contract and a silent clobber — did not match generators or top-level
  destructures.

### L2 — the place is in the frame

The right lens was already in the file and had already been validated on
nineteen arrival PNGs: `sysARRIVE_PITCH`, 16 degrees. The game knew what its
good shot was, showed it for 3.6 seconds on arrival, and then eased back to the
floor plan for the next forty minutes. So two numbers move, toward that shot
rather than toward a new one.

```
sysCAM_PITCH   41 -> 34    the driving lens
sysREST_W    0.55 -> 0.80  the settled lens, now ON the arrival composition
sysREST_T     1.5 -> 1.0   players do not stand still for a second and a half
```

| | before | after |
|---|---|---|
| settled pitch | 22.8° | **11.2°** |
| horizon | 0.94 (3% from the top) | **0.44 (28% from the top)** |
| animal on screen | — | **19/19 walking, 19/19 settled** |
| where it sits in frame | — | 65% down — subject on the lower third |
| boom cut (`clear`) | 1.00 | 1.00 in 18/19 |
| terrain clamp (`lift2`) | 0 | 0 in 18/19 |

Antarctica is the one exception (`clear` 0.53, `lift2` 0.24) and it is the clamp
doing its job against the slope behind the station.

By eye, on the same spot before and after: Sydney gains the Opera House whole,
sails and harbour and the Bridge behind it. Venice gains the Piazza, the arcades
and the Procuratie facade. Pasto gains Galeras filling the upper third. Mong Kok
gains its neon.

**This is the change everything else in the pass compounds with.** The lighting,
the crease, the people and the sound all now happen somewhere the player can see.

### L3 — a low sun is a warm sun

`sysSUN_BY_BIOME` hands out elevations from 16° to 61°, and sun *colour* knew
nothing about any of it — so the beauty pass brought Antarctica to 28° and the
Pantanal to 30° and left both lit by a Sydney noon.

`sysSunLow` is 0 at a high sun and 1 at the horizon, referenced to
`sin(elevation)` because that is what the air mass goes as. Written in
`sunAxes`, which runs on a chapter change and never per frame.

**Stated at the size it actually is.** Six chapters at 61° are bit-identical;
ten with an authored `sun.color.lerp` are unmoved because the override wins by
design; three move. The frame histogram cannot resolve it — Iceland's frame
improved most on every statistic and Iceland's light did not move at all, which
is proof that those deltas are framing noise. A correctness fix, not a beauty
win, and worth having because it makes the next low-sun chapter right by default.

### L4 — enough is not the same question as finished

`jrOpen` gated chapter *n* on `chapComplete(n-1)`, and `chapComplete` demands
every row. So the whole list stood between a player and the next country.

The fix is a **second predicate**, not a weaker one. `chapComplete` is untouched
and still governs the souvenir, the keep, the ledger, the chapter-done ceremony,
the nineteen-of-nineteen finale and the picker's tick. Only the door moves:

> **the marquee, and seven of every ten rows.**

The marquee because it is the thing the chapter is *for*, and a player who
skipped it has not seen the chapter. A share rather than a count because
chapters run from 8 rows to 19.

Measured both orders, because "the marquee plus seven in ten" has two and only
one of them was thought about when it was written:

- **marquee last** — enough and complete coincide at 11/11. You cannot skip the
  marquee. Correct.
- **marquee first** — enough fires at 8 of 11 and chapter 3 opens three rows
  early, with `complete` still false at 8, 9 and 10, so nothing that belongs to
  a finished chapter fires at the threshold.

**232 compulsory rows become 170.** Sixty-two tasks — 27% of the list, and by
every review the weakest 27% — stop being chores.

Nothing is taken away: the rest stays on the paper, keeps its arrow and its
beacon, and still ticks. The way-on row now appears at ENOUGH rather than only
at complete, because a door the player is not told about is not a door — with
one difference that is the whole of its manners: while anything is still open
here it does **not** take the pointer. Measured; see below.

```
rows 1-7   way row absent, pointer on a real task
row 8      ENOUGH. Way row appears. Pointer stays on 'Ring the church bell
           (badly)', 17 m.
row 11     COMPLETE. The way row takes the pointer, as it did before L4.
```

### L5 — the game never said these existed

Sixty-eight finds, forty of them belonging to a named place, written to three
good rules and in the best voice in the file — and the only surface any of them
had was the ledger at the *end* of the journey, listing the ones you had already
tripped over. A discovery nobody knows is there is not a discovery.

On the paper, under the tally:

> *two things nobody mentions here*

**A count, never a name and never a place.** The moment that line can locate
anything, the finds stop being finds and become two more tasks with the arrow
switched off. The probe asserts it against thirteen words from the finds' own
descriptions.

Set in italic, lower case, unspaced — the only line on the card that is not
uppercase, not letterspaced and not an instruction, because it is the only line
that is not part of the list. And the journey sheet's footer, which read
`N noticed` and was hidden entirely at zero, now reads `0 of 68 noticed` from
the first minute.

### L6 — the readable ink was already there, and the HUD was not using it

`sysBuildCSS` splits the coral into `accent` (decorative) and `accentInk`
(4.62:1) precisely because the coral is 2.28:1 on the paper. `accentInk` was
used at ten sites, all on the title card. `accent` was still the *text* colour
at twenty-five others, all small, most uppercase and bold, all on opaque paper.

This is exactly what the existing check could not catch: `qa/uicontrast.js`
measures the title card, which is the one place the readable ink was already
being used.

Measured in play on rendered colour against the nearest opaque ancestor: eight
of eight pass at 4.62–11.52 against a 4.5 requirement.

### L7 — two names that were never declared

Started as one feature and found a shipped bug on the way.

**The feature.** Air takes the top off a sound before it takes the level, and
that was true of the ten continuous movers and of none of the four hundred
one-shots. Same curve, same three constants, same node as the mover, folded
into the existing back-cue branch so the node count is unchanged.

**The bug.**

```js
f.type = lowpass;      f.type = highshelf;
```

Bare identifiers. There is no `lowpass` and no `highshelf` anywhere in the tree;
these are the only two such uses in the file. So a ReferenceError, on the line
after the node was created, every time.

The whole of A2 was dead, and it failed in the worst available way: the throw is
inside the panner's try, and that catch is `{ node = null; acMaster = bus; }` —
so **a sound behind you or above you lost its filter and its stereo panner** and
arrived as flat centred mono. The cue that exists to tell you something is
behind you was the one thing guaranteeing you could not tell where it was.

It stayed invisible because nothing looked: the failure is swallowed by a catch
written for a genuinely expected condition, the branch only fires past `back`
0.15, and the audit hook reports `sysSfxBack` — the *input* to the branch, which
was always correct. Same shape as every other flag in this repo that answered a
table instead of a count.

```
in front   2 m none · 6 m none · 9 m 17618 Hz · 20 m 11841 · 55 m 1505 · 80 m 780
behind     6 m 4500 · 20 m 4500 · 80 m 780
```

4500 is exactly 20000 − `sysSFX_BACK_LP`, so the back cue is live for the first
time. **`sysSFX_BACK_LP` has never been heard by anybody**, because it never
ran. It is left at the authored value and it is worth a listen.

### L8 — people get a knee and an elbow

760 people, and a leg was one box pivoting at the hip and an arm was one box at
the shoulder. Everything else about them was years ahead of their bodies, and L2
had just made them much more visible.

The knee is driven by `max(0, -cos(walkPhase))²`, which *is* the swing half of
the cycle. A knee that bends on the stance leg reads as a limp, so it was
measured rather than asserted: 0.07 rad across the whole of stance. The ankle
counter-rotates and holds the sole within 0.09 rad of level, where before it
rode the full 1.15 rad of hip swing. Shoulders oppose hips, with the head taking
0.8 of it back out so a walk does not become a head-shake.

`handR` is now a child of `elbowR`, and `handR` carries every held prop, so
props follow the forearm for free. Worst offset: 0.069 m.

Cost: +11 to +24 draw calls, 4–6%.

**Left open, and it is visible:** the big background crowds in `venice.js`,
`kowloon.js`, `quay.js` and `cali.js` are separate `InstancedMesh` casts outside
`npc.js`. They are the majority of the 760, they still have one-box limbs, and
they stand next to people who no longer do.

### L9 — somebody was there for all of it

The ending is the best-designed thing in the game: come home, find every
souvenir in a horseshoe on the lawn, sit down with it, and five people wander
over. All five are strangers who were already in the gardens — so the journey is
closed by an audience that did not see any of it.

The person who did see it already exists and their arc simply stops. THE
TRAVELLER has six months and a very bad map and turns up in four chapters, and
this is the last line of it.

Built at the end, not in Sydney's own file: a traveller registered in Sydney
would be on that lawn in the first minute of a new game, before the Quay, before
the map, before they have any reason to know you — which would spend the whole
arc for nothing.

```
before staging   0 on the ring
after staging    1, at 7.7 m, on the ground
in Marrakech     1, visible false — hidden, not detached
staged again     1. Not two.
```

### The writing pass

48 task names rewritten. All seventeen "Ride the ⟨noun⟩" rows are gone, each
replaced with a different shape; the verb census went from Get ×25 / Take ×20 /
Ride ×17 to a spread. No `id` was touched — ids are referenced across 27 files,
the save file and the hint table.

Four factual and tonal fixes: Monte Carlo's roulette line no longer makes a
false claim about payouts; Cali is no longer used as a punchline; Palawan's one
mystical-elder trope is gone; two of six Pasto market tables sold only things
you wear.

**Iceland was two seasons at once** — midnight sun and puffins (summer) with an
aurora as its marquee payoff (winter). You cannot see an aurora under the
midnight sun. Moved to late August, which also resolves a contradiction with a
street local's existing line.

---

## WHAT IS STILL OPEN

- **The background crowds** in four chapters still have one-box limbs and stand
  beside people who do not (L8).
- **`sysSFX_BACK_LP`** is audible for the first time and has never been tuned by
  ear (L7).
- **Venice is the washed-out outlier** by measurement — IQR 36 and only 54% of
  the frame carrying colour, against Pasto's 49 and 94%. It may be intentional
  (acqua alta, lagoon mist) and it may be a grade tuned against a frame that no
  longer exists, because L2 changed what is in it. Judge it by eye first.
- **The wide crease octave.** The art review named a second AO ring at ~1.6 m
  world radius as the largest single beauty term still available, reusing
  `mainCrW` verbatim for 8 extra taps. Not attempted here.
- **The theft class.** The design review's strongest remaining idea: gate the 24
  theft rows on "held four seconds and outside the owner's heat site", so a
  theft ticks when you get *away* with it. It reuses the heat field and the
  chase state machine unchanged, and it is the one change that would put stakes
  into the flattest quarter of the game. Not attempted here; the risk is a task
  becoming unwinnable if the retrieval chase does not reliably give the prop
  back.
- **A hide verb.** Three separate systems already ask for one.

---

## THE INSTRUMENTS THIS PASS ADDED

- **`qa/pnghist.mjs`** — frame statistics from a PNG with no dependencies: parse
  IHDR, inflate IDAT, undo the five scanline filters. Every previous attempt at
  a histogram in this repo went through the canvas and came back black, because
  the renderer has no `preserveDrawingBuffer` and the read is never in the same
  JS turn as the draw. A screenshot is already a raster PNG and node has zlib.
  Excludes the two HUD panels, which are opaque paper in fixed corners and would
  otherwise put a constant error into every frame.
- **`game.gateInfo(n)`** — both chapter predicates and the id list, one getter,
  no setter. They live inside the journal's closure and the only surface the
  harness had was the picker's own pixels; a dimmed row on a canvas is not
  evidence about a rule.
- **`qa/rd-contrast.js`** — measures the in-play HUD rather than the title card,
  so L6 cannot silently regress the way it silently persisted.
- **`qa/rd-onscreen.js`** — the gate on any camera change: is the animal in the
  picture, walking and settled, in all nineteen.

## WHAT COST TIME, AND WHAT IT COST

**The rest lens measured as dead in all nineteen chapters, and it was not.**
`state.started` was false for the whole sweep — `hud.cross()` and body writes
work perfectly without it, and the rest voice is gated on it, so a rig that
opens out correctly read as one that never fires. Harness trap 40, again, and it
nearly produced a fix for a feature that was working.

**The air-absorption curve read 350 Hz at every distance**, which is not on the
curve at any distance. Reasoning about the arithmetic for twenty minutes
produced nothing; one temporary line writing the computed values to a global
produced the answer immediately — the maths was exactly right, and 350 is the
Web Audio *default*, which means a node created and never configured. That is
what pointed at the undeclared identifiers. **When a measured value is not on
the curve at any point, stop reasoning about the curve.**

**A frame histogram cannot resolve a small lighting term.** Two runs walk the
animal to slightly different places and the framing delta swamps it. The
controlled instrument for a light is the light.
