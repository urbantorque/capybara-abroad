# EVERY INSTANCED CROWD IN THE GAME

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
