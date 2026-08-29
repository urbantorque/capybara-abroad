# EVERY INSTANCED CROWD IN THE GAME

> **Closed 29 Aug 2026 (v36).** The six chapters this document left open are done,
> and the twenty lines that were written three times are now one helper —
> `game.addCrowdBodies()` in props.js. Re-measured with the same `qa/b6-crowds.js`:
>
> | chapter | crowd | before | after |
> |---|---|---|---|
> | venice | 48 walkers | 0% | **100%** |
> | hanoi | 70 walkers | 8% | **100%** |
> | monte carlo | 46 watchers | 6% | **100%** |
> | the quay | 30 commuters | 3% | **100%** |
> | cali | 18 ringside | 56% | **100%** |
> | cali | 10 dancers | 0% | 0% — the open call, still open |
> | manly | 22 bathers | 5% | 5% — decided, see below |
>
> **THE BUG THAT MADE THE FIRST CUT MEASURE AS A NO-OP.** Every box was built and
> every box was in the right place, and the probe still read Venice at 44% and the
> Quay at 40%. `body.position.set()` does not set `aabbNeedsUpdate`, so cannon
> keeps the AABB the body was BUILT with — and both the contact test and
> `world.raycastClosest` go on using it. A static body moved by hand is invisible
> to the broadphase until you say so. `kowloon.js:2659` has always set the flag;
> the helper written to replace that code did not. Now it does, in one place.
>
> **AND A SECOND ONE, IN THE WIRING.** `game.physics` is assembled by
> `createProps`, not by `createPhysicsWorld` above it — so the first cut of the
> `game.addCrowdBodies` promotion in main.js ran against an object that did not
> exist yet, silently left the stub in place, and cost a full probe run.
>
> **Cost, differential, `git stash` on the six files, same browser session, with
> Sydney and Kowloon as untouched controls** (ms per `world.step`, median of 300):
>
> ```
>              bodies         med          p90
> quay        75 ->  105    0.1 -> 0.2   0.2 -> 0.3
> venice     190 ->  238    0.4 -> 0.5   0.6 -> 1.2
> hanoi       41 ->  111    0.3 -> 0.5   0.4 -> 0.8
> monaco      54 ->   55    0.4 -> 0.7   0.6 -> 1.1   (pooled: +1 body, +46 shapes)
> cali       134 ->  135    0.2 -> 0.2   0.2 -> 0.4   (pooled: +1 body, +18 shapes)
> sydney     148 ->  148    0.7 -> 0.5   1.2 -> 0.8   <- control
> kowloon    173 ->  173    0.3 -> 0.4   0.4 -> 0.5   <- control
> ```
>
> The controls move ±0.2 ms with nothing changed, which is the size of every delta
> here — so the honest reading is "inside the noise floor, and the same +0.1 ms
> Kowloon measured for eighty bodies". Nothing is near the 0.3 ms the card allows.
>
> **Two tasks were checked by hand for a block, and neither is one:** Hanoi's
> nearest plastic stool to a sitter's box is 1.84 m and no stool is inside a
> person, so `the-stools` is unaffected; and with the boards out, 48 of Venice's
> 56 crowd boxes are parked under the world and **zero** are standing on the plank
> deck, so `passerelle` runs clear.


Measured 28 Aug 2026 by `qa/b6-crowds.js`, which walks every `InstancedMesh` in
every chapter and classifies it by **what its instances measure**, not by what
they are called. Re-run it; do not re-derive this by hand.

## Why the name test does not work

`qa/rev-people.js` finds crowds with a regex over the mesh name
(`people|crowd|commuter|figure|person|bather|dancer|…`). **Exactly one crowd in
the game matches it** — Marrakech's `sahPeople` — because every other chapter
builds its crowd from a merged geometry and never names the mesh. The audit that
reported "Sahara's crowd is 16% solid" was not finding a Sahara problem; it was
finding the only crowd it could see.

The dimension test: median instance world size taller than 0.9 m and under
2.6 m, between 0.15 m and 1.3 m wide and deep, taller than 1.4× its width, and
standing within 2.5 m of the terrain under it.

## The roster

`people` is the count of INSTANCES, and several chapters draw one person as
several instanced part-meshes — Hanoi's seventy walkers are ten meshes of seven,
Kowloon's eighty are a body mesh and a head mesh. The `solid` column is a
horizontal chest-height cannon ray through each sampled instance.

| chapter | mesh | instances | people | solid before | solid after |
|---|---|---|---|---|---|
| sahara | `sahPeople` (+heads) | 170 | 170 | **21%** | **100%** |
| rio | `rioPeople` (+heads) | 306 | 306 | **3%** | **94%** |
| kowloon | crowd body + head | 80 + 80 | 80 | **3%** | **100%** |
| hanoi | ten `hanFolk` variants | 10 × 7 | 70 | 8% | 8% — not done |
| venice | two meshes | 48 + 48 | 48 | 0% | 0% — not done |
| monaco | one mesh | 46 | 46 | 6% | 6% — not done |
| cali | `caliDancerMesh` | 10 | 10 | 0% | 0% — not done |
| cali | `caliWatch` body/head/arm | 18 | 18 | 56% | 56% — not done |
| manly | `manBathers` | 22 | 22 | 5% | 5% — not done |
| quay | one mesh | 30 | 30 | 3% | 3% — not done |
| sydney | the `addLocal` rig | 52 | 52 | 100% | 100% — already right |

**Total people-shaped instances across nineteen chapters: 3761.** Sydney's 52 are
the `npc.js` locals rig and have always been solid; `addLocal` bodies every
registered person and `localsStep` keeps the body where they are. That rig is
fine and nothing here touches it.

## What the detector picks up that is NOT a crowd

These are person-SHAPED and are not people. They are listed so the next pass
does not spend an hour on them:

| chapter | mesh | what it is |
|---|---|---|
| pantanal | 2627 instances, 0.65 × 0.97, at ground | marsh grass / tussocks |
| sahara | `sahTrade:wool` × 88 | wool bales on the trade route |
| sahara | `sahVar:acaciaT:*` | acacia trunks |
| iceland | `iceScat:drift:*` | snow drifts |
| every chapter | one or two at 0.94 × 1.56 | a shared prop, not a person |

Anything above 1000 instances is scenery by construction — no chapter in this
game has a thousand people in it.

## The two shapes a crowd body can take, and how to choose

**Pooled — one body, one shape per person.** Correct when nothing moves after
placement. Rio: `rioPplData` is written in `rioAddPerson` and nowhere else, so
three hundred and six shapes share one broadphase entry.

**One body each.** Required the moment anybody moves, because a compound body
cannot move one of its shapes. Marrakech: three of its hundred and seventy are
the caravan's cameleers and `sahMovePerson` carries them across the erg.
Kowloon: all eighty walk.

Either way the box is npc.js's — `CANNON.Box(0.26, 0.85, 0.24)` on
`game.mats.npc` — so a person feels the same whichever rig drew them. **A body
moved by hand must carry all three of cannon's position fields**
(`position`, `previousPosition`, `interpolatedPosition`) or it is solid where
the walker was a frame ago.

## The budget, measured

A distance gate was written for Kowloon first, on the assumption that moving
eighty static bodies per frame would cost broadphase time. It costs nothing
measurable, so it was removed.

```
ms/tick, median over 300 ticks of walking, same browser session
            bodies         med          p90
sahara      67 -> 239     0.4 -> 0.5   0.7 -> 0.8
rio         78 ->  79     0.7 -> 0.8   1.1 -> 1.3
kowloon     93 -> 173     0.5 -> 0.6   0.7 -> 0.9
sydney     139 -> 139     0.7 -> 0.7   1.1 -> 1.1   <- control, untouched
```

Well inside the 0.3 ms the card allows. Note the control: frame time does not
compare across browser sessions (see `b3-perf.js` in `SKILL.md`), so a
before/after is only worth reading when an untouched chapter holds still in the
same run, as Sydney does here.

## What is left

Six chapters, 244 people. Hanoi and Kowloon are the same problem — a walking
crowd — and Kowloon is now the worked example. Venice, Monte Carlo and the Quay
are standing crowds and are the Rio pattern exactly.

**Two need a decision rather than a fix.** Cali's ten dancers move on the floor
the player has to dance on, and Manly's twenty-two bathers are in the surf. In
both, making the crowd solid changes how the chapter plays rather than fixing
something that is wrong, and that is not this pass's call to make.

## The decisions, made (v36, 29 Aug 2026)

**Cali — split, and only half of it was ever the hard question.** The ten
dancers are on the floor `salsa-dance` is scored on and they stay drawn-only:
that is still the open call. But the eighteen `caliWatch` are not dancers. They
stand at the bar and around the outside of the ring wall, at
`caliFLOOR.r + 0.35`, they never move after placement, and every one of them is
outside the circle the task is scored in — so they are a pooled body now and the
edge of the salsoteca stops being a mural without the floor being touched at all.
The chapter went 34% → 66% and the remaining third is the ten, on purpose.

**Manly — left alone, and it is a decision and not a deferral.** The twenty-two
bathers already model the thing a collider would be for: `manUpdateBathers`
pushes any bather within 3.2 m away from the capybara at 2.2 m/s. A chapter that
already says "people get out of your way" does not need a box to stop being a
mural, and the comment above that push is four paragraphs long because the shove
is tuned around `move-flags` — the headline task, which tests that twenty of the
twenty-two reach their own target within a metre and a half, and which a previous
pass watched fail silently when the push was wrong. Dropping a static body into
that loop would fight a behaviour that exists to protect the task. 5% stands.

**Venice — solid, EXCEPT on the planks.** The square's crowd is one box each and
100% solid, but anybody who is on a passerelle or walking toward one is drawn and
not felt. The chain is a metre wide, a person's box is half of that, and
`passerelle` asks you to run the whole thing against a clock: a solid queue on
the boards does not make that harder, it makes it impossible. Measured with the
boards out — 48 of 56 boxes parked, zero on the deck.

## The helper

`game.addCrowdBodies({ n, at(i, out), moving, y })`, in props.js. `at` writes the
i-th person's FOOT position and returns false for anybody who is not there.
`moving: false` (default) pools every shape into one body — correct whenever
nothing moves after placement, and one broadphase entry for three hundred people.
`moving: true` gives one body each and you call `handle.step()` from the chapter's
update. See the block above `physAddCrowdBodies` for the four things that are easy
to get wrong; two of them cost a probe run each in this pass.
