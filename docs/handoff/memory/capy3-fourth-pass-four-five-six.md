---
name: capy3-fourth-pass-four-five-six
description: "The deep pass over Kyoto, Cali and Rio: the arrival heading nobody had ever set, the barrow that could never be pushed back up, and the locals who finally know what you have done"
metadata: 
  node_type: memory
  type: project
  originSessionId: ae2db74f-613f-42c8-ac6e-165ff64f33d3
  modified: 2026-08-23T19:29:39.789Z
---

Done 24 Aug 2026, a deep pass over chapters 4, 5 and 6 after
[[capy3-chapters-three-four-five]], [[capy3-third-pass-four-five]] and
[[capy3-third-pass-six-seven]] had already been through them. Those passes found
things pointed wrong and ground that was empty. This one found **the first frame
of a chapter, the state that survives travel, and a cast that had no idea what
you had been doing.**

## THE ARRIVAL HEADING WAS NEVER SET, IN ANY OF SEVENTEEN CHAPTERS

Every `*_SPAWN` record in main.js carries a comment describing a HEADING — "the
torii hill in front and Uji behind", "the Atlantic straight ahead", "the Ermita
on one hand and the painted street on the other" — and **not one of them was
ever true.** `teleportCapy` rebuilds the rig from the LIVE `camYaw`, which
simply persists across the white-out, so the opening shot of a chapter points
wherever you happened to be looking in the last one.

Measured, arriving from Sydney: Cali put a rosa wall **four metres** in front of
the lens; Kyoto looked at a hundred and twenty metres of empty lawn; Rio's boom
landed inside a coconut palm and the first frame was green fronds with a
thumbnail-sized capybara behind them.

`sp.yaw` is optional on a spawn record and is the direction the CAMERA sits in
(the same convention `camYaw` already has), so `yaw: 0` means "eye to the south,
looking north". `teleportCapy` adopts it and points the animal with a new
`capy.face(yaw)` — needed because `capyYaw` is integrated and written to the
model every frame, so a caller that sets `group.rotation.y` from outside is
overwritten before it is ever drawn. **Fourteen chapters still have no `yaw` and
behave exactly as before**, which is what makes this additive.

**AND THE SPAWN POINT HAS TO BE CHOSEN FROM THE PICTURE, NOT FROM THE MAP.**
Three iterations each, judged off the rendered PNG:

- **The boom is seven metres long and the camera-clearance ray only tests the
  PHYSICS world.** Gion's machiya are 5 m colliders under a pitched roof that
  reaches 7; the eye goes over the box and inside the drawing. So does the
  crown of a palm, which has no collider at all. *This is systemic and is not
  fixed: any spawn or vantage within ~7 m of a tall drawn thing can put the
  camera inside it.* Cali at (−10, 40) still does.
- Cali's old spawn sat in a **3 m corridor**: `navBlocked(0, 24, 0.8)` is true,
  the band z 22–34 is solid across x −48…+48, and the only clear runs were east
  and west. An ASCII `navBlocked` map at 4 m resolution is the tool — it took
  one probe to see that the whole chapter is dense and that the south bank is
  the only place with room for a shot.
- Final: Kyoto (−16, 52) on the Gion lane looking east down it, Cali (−16.5,
  −19.5) on the grass by the lulada stand looking north over the river, Rio
  unchanged at the origin with a **corridor cut out of the palm placement** —
  the same trick Fushimi Inari's cedars already use. A 7 m gap in a 26-palm row
  reads as the crossing where the pavement meets the beach.

## A LINE POOL IS NOT A FLAT LIST OF STRINGS ANY MORE

Seventy-odd people across sixteen chapters, each a fixed bag of three sentences
chosen with `randInt`, for ever. Two things were wrong and both are "this person
cannot say anything new":

1. **The die roll repeats.** Three lines with only a never-twice-running guard
   means the second thing you hear is the first thing you heard about half the
   time. `localLine` draws from a shuffled BAG now, refilled when empty, with
   one swap so it cannot open on the line just said.
2. **Nobody knew what you had done.** An entry in any pool may now be
   `{ t, after: 'task-id' }`, `{ t, before: 'task-id' }` or `{ t, when: fn }`,
   and a pool may be a function. `localResolve` flattens to what is true RIGHT
   NOW into one module-level scratch array, so it allocates nothing. This needs
   `game.taskDone(id)`, which did not exist — `completeTask` was write-only.
   Bare strings resolve to themselves, so nothing already written changed.

Two more channels on top of that:

- **`task:complete` → the nearest person reacts.** One person, not the crowd:
  a square that applauds in unison is a cutscene, one bloke turning round and
  saying "…was that deliberate?" is the joke. `onTask: { id: [...] }` per
  local, `praise: [...]` per person, and a chapter-neutral default under both.
  They take the flinch spring's turn-toward with them so it reads from across
  a square.
- **`game.addExchange({a, b, lines: [[first, second], …]})`** — two locals who
  trade a two-line scrap when the player is 6–26 m away (near enough to read
  both bubbles, far enough not to be the subject) on a ~30 s jittered gap. Six
  pairs registered across the three chapters. **They compete with the greeting
  cooldown**, which is correct — somebody who has just said hello does not also
  start a conversation with the person opposite — but it means an exchange
  typically needs 15–20 s of the player standing back before it fires.

## FIVE THINGS THAT WERE STATE SURVIVING TRAVEL, AND ONE SOFT-LOCK

The `onExit` blocks in these files all carry the comment "ARMED FLAGS DO NOT
SURVIVE TRAVEL" and all three were incomplete.

- **`kyoToriiSeq` was on neither list.** Leave Kyoto twenty gates up Fushimi
  Inari and come back: the chapter is still waiting for gate twenty-one, the
  paper's arrow points sixty metres up the mountain, and walking back into the
  bottom of the tunnel passes twenty gates that no longer count. Also
  `kyoBambooIn` (holds a z from a previous visit) and `kyoSwamT`.
- **Cali's dance floor kept `caliLastYaw`** — the animal's heading in another
  country — so the first frame back on the boards differences a Cali yaw
  against a Rio one and scores a step the player did not take. Plus
  `caliOffFloorT`, `caliStepCool` and a lit `caliFlash`.
- **`caliCartReset()` was called from exactly one place and that place was the
  build.** The chapter's `mini` — 'Run the fruit barrow off the ridge' — could
  be spent in three seconds and never come back: the toast says "get in." AFTER
  the chock is out, so the commonest outcome is watching it leave without you,
  and it then sat at the bottom of a 465 m hill it cannot climb for the life of
  the page with the hint arrow pointing at it. The stop branch's own comment
  claimed it "put the chock back and let it be tried again" and that was true
  of the flags and false of the position. It walks itself back up after five
  seconds now, and never while somebody is standing in it. **Measured: 54 s of
  descent, stop at (−32, 0), back at (−83, 18) six seconds later.**
- **Rio's futevolei ball stayed in the Atlantic.** Fourth instance of the
  one-shot-mini family (Quay's chip basket, Kyoto's matcha heap, Cali's lulada
  jug). Come back and the court is four people, a net and no ball, with the
  rally permanently stopped because `rioVoleiDone` gates it. Re-armed on entry
  *only if it has left the court* — a ball the player carried up the beach is
  theirs. Same argument put the Globo man's yaw back.
- **Rio's parade wrapped out from under you.** The column teleports 216 m up
  the avenue at the end of the road and the chapter's one `wow` is scored on
  being inside it. It marks time at the east end instead while the animal is
  within `rioCOL_HX + 14`, capped at 24 s.

Plus: **`kyoCheckZen`'s paw prints stopped dead at twenty-six** (the pool
`return`ed instead of recycling, so running laps of the garden produced
nothing — which reads as the mechanic having broken, not as a budget being
spent), and the 0.9 m spacing test indexed `kyoTrackN - 1`, which is wrong the
moment a ring buffer wraps.

## EVERY ESCALATION IN THESE THREE CHAPTERS WAS A FLAT LINE

The same finding four times, and the cure is always a rising note:

- **44 gates** through the torii tunnel: one line of text on the 11th, 22nd and
  33rd, and twenty-five seconds of the chapter's second-biggest set piece with
  nothing under it. A soft positional block per gate, climbing about an octave
  over the run.
- **The bonshō's four seconds ARE the mechanic** and there was no clock at all
  between the pull and the strike. One knock a second, rising. And the rope
  refused for nine seconds after a strike **while saying nothing**, so a player
  who missed the run under the rim pressed E at a rope that had simply stopped
  working.
- **132 m of the calçadão** — the chapter's first task — in total silence.
  Quarter marks, plus a note when you step off, because 'without stepping off
  it' was being failed invisibly.
- **Cali's combo paid out at eight and nowhere else**; Rio's at six. Both now
  answer from the third step: one voice at a time out of the crowd, positional,
  a step brighter each beat — and in Rio the section's own `rioBateriaPulse` is
  forced, so a hundred and fifty drummers visibly come UP under you.

Two more of the same family: **nine stone lanterns fired one identical toast
nine times** (nine escalating lines now, and the topple emits `prop:impact` so
the garden monk actually flinches — a kinematic body the chapter animates
itself was invisible to npc.js), and **clearing a cable on the chiva was worth
nothing at all** — seven of them over 465 m and the only thing the mechanic
could do was take you off the roof. A skill test with a punishment and no
reward is a hazard, not a game.

## AND TWO PIECES OF GROUND THAT WERE THE WRONG THING

- **Lapa was a lawn.** `rioGroundColor`'s `if (z > 64)` ramp reached 0.75
  forestP at z = 84, so the square under a forty-two arch aqueduct, the tram
  alignment and Selarón's steps stood on bright green grass. Same class as the
  beach-sand `else` that function was written to fix, one district inland: *a
  rule about the hill applied to the flat thing at the bottom of it.*
- **Thirty-five metres of nothing between Gion and the pond**, and it is the
  only route from where the chapter puts you down to its first four tasks —
  `kyoBuildMaples` refuses to plant within sixteen metres of the lane, which is
  what left it bare. A **sando**: gravel between two lengths of yotsume-gaki
  (the four-eyed bamboo fence, nine boxes a bay), maples over it, a stone at the
  turn. Deliberately NOT solid — colliders would turn the one route out of the
  arrival into a funnel. Routed to miss the bell tower at (−15, 24), which the
  first cut ran straight through.

**Cali had nothing in the air at all** — the only one of the three cities with
no flying thing, over a valley of two and a half million people. 38 instanced
loros, flapping constantly (a parakeet that soars is a paper aeroplane), and
the whole flock crosses the valley at once on the rising edge of
`caliNightT > 0.30`, which turns the chapter's own lighting change into an
event that happens in the world.

## HARNESS

`preview_start` is not the route: `playwright-cli -s=capy` plus the `/shot`
sink. **`page.screenshot()` works and `canvas.toDataURL()` returns a blank
frame** unless `game.tick(1/60, true)` is called in the same JS task — the
drawing buffer is not preserved. The chapter picker at the title card
(`page.keyboard.press('Digit4')`) is the only way to exercise the REAL arrival
path from a script; `biome.switchTo` does not teleport and therefore never runs
`teleportCapy`.

**`capy3.journey.v1` persists in localStorage across `page.reload()`**, so a
soak that ticks nine tasks silently poisons every later test that calls
`completeTask` — it returns false, never emits, and a working feature looks
broken. Cost twenty minutes.

`node build.mjs` clean (5225 top-level declarations, no collisions);
`qa/audit-tasks.mjs` 0 blockers over 199 tasks; `qa/pointers.js` returns `[]`
for all three; a 40-key random soak per biome is NaN-free with no void falls;
all seventeen biomes switch and run with `state.lastError` null.

Related: [[capy3-third-pass-four-five]], [[capy3-third-pass-six-seven]],
[[capy3-the-locals]], [[capy3-catch-all-state]], [[headless-qa-harness]],
[[capy3-visibility-metrics]], [[capy3-things-that-are-simply-there]]
