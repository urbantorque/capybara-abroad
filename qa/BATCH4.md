# BATCH 4 — Chapters 12-17, performance, release (Payoff Pass, final batch)

Started 26 Aug 2026, on `claude-opus-5`. Brief: `qa/PAYOFF-PROMPTS.md` § BATCH 4.
Predecessor: `qa/BATCH3.md` (chapters 4-11, CONTRACT v26).

Batch 4 chains nothing. It must finish with a found-vs-fixed report across all four batches.

## Job 1 — the five pillars on chapters 12-17

| n | biome | file | notes from the brief |
|---|---|---|---|
| 12 | palawan | src/palawan.js | camera rules differ underwater; test pillar 3 below the surface too |
| 13 | goreme | src/goreme.js | busiest chapter in the game. Route life = TRIM, never pad |
| 14 | manly | src/manly.js | waterline is a function of POSITION — test against `localWater` |
| 15 | pantanal | src/pantanal.js | 207,072 tris, worst in game. ZERO geometry additions |
| 16 | cave | src/cave.js | photo mode in the dark must keep a picture; expose off the wheek |
| 17 | antarctic | src/antarctic.js | stillness by DISPLACEMENT. groundSlip 0.66. 179,788 tris |

- [ ] Baseline sweep (channels, mischief, stillness, tris) before any chapter work
- [ ] **12 Palawan**
- [ ] **13 Cappadocia**
- [ ] **14 Manly**
- [ ] **15 The Pantanal**
- [ ] **16 Sơn Đoòng**
- [ ] **17 Antarctica**

## Job 2 — performance reallocation

- [ ] Re-measure the base build (autoReset=false, shadowMap off, one explicit render)
- [ ] Find the STRUCTURAL offender per over-budget chapter; warp/re-mesh, never delete
- [ ] Screenshot before/after at the marquee viewpoints
- [ ] `qa` audit that FAILS above 130k

## Job 3 — the release sweep

- [ ] (a) new-systems interplay fuzz (keepsakes/rescue/relocation/water/moving floors,
      graze vs task props, photo mode vs ceremony/dive/helm/dark, reverb across borders,
      calm vs chaos)
- [ ] (b) UI + a11y at 1280x720, 1366x768, 1600x900, 1920x1080, 900x620, 390x844
- [ ] (c) full regression: every qa suite, one fresh-save playthrough, finale, ledger

## Finish

- [ ] CONTRACT.md new version section
- [ ] qa audits for new invariants
- [ ] Project memory
- [ ] This file as the closing report (found vs fixed, all four batches)
- [ ] `playwright-cli close-all`
- [ ] Chain NOTHING

## Log

- Started. Oriented on BATCH3.md handover + PAYOFF-PROMPTS.md + headless-qa-harness memory.

### Carried in from batch 3, open and measured

1. Kowloon's roof unreachable (tops out 0.65 m east of the deck; scaffold colliders fill
   the bay). Do NOT lower `hkSCAF.top`.
2. `qa/stillness.js` flags Pasto (2.71 m at spawn, **28.32 m** at spawn+(9,9)), Cave
   (1.33 m on 3°), Drift (4.39 m, may be a fall).
3. Iceland's snowcat track is at x=34 and every glacier run ends at x≈−20.
4. Only 5 of 17 chapters register a critter (quay, kyoto, iceland, manly, goreme).
5. Room tone is keyed per biome, not per space.
6. Five chapters have no event-grade row — run `qa/channels.mjs` for the live list.
7. Drift + Sơn Đoòng carry one mischief chain by design.
8. Venice's collision heightfield went 4,118 → 16,215 samples (collision, not triangles).

### Baseline, before any chapter work (main thread, 26 Aug)

**`qa/channels.mjs`** — all six of this batch's chapters (12-17) call `game.frameShot`
**never**. So *framed*, the channel batch 3 built, has zero adopters among 12-17.
`lit` (event grade row) is present in all six; sydney/pasto/quay still have none.
Critters: still 5 of 17.

**`qa/b4-tris.js` — the triangle baseline is STALE and much worse than the brief says.**
Measured fresh (scene traversal, visible-only, at spawn, so `renderer.info`'s post-chain
trap does not apply). Verified against a single-chapter fresh-page run (`qa/b4-tris1.js`,
quay 200,959 vs 202,391) and against a leak probe (`qa/b4-leak.js`: no cross-biome
residue — `environment` is correctly hidden after `switchTo`, the previous chapter's group
too). The brief's five over-budget chapters are now **ten**:

| chapter | tris | shadow tris | % casting |
|---|---|---|---|
| pantanal | 225,526 | 222,730 | **99%** |
| goreme | 211,230 | 115,362 | 55% |
| drift | 206,538 | 43,040 | 21% |
| iceland | 202,678 | 96,418 | 48% |
| quay | 202,391 | 79,125 | 39% |
| sahara | 197,588 | 116,644 | 59% |
| venice | 181,814 | 179,354 | **99%** |
| antarctic | 180,870 | 77,786 | 43% |
| cave | 158,516 | 156,824 | **99%** |
| kowloon | 154,058 | 151,614 | **98%** |
| palawan | 129,338 | 101,378 | 78% |
| rio | 126,512 | 114,464 | 90% |
| kyoto | 122,022 | 119,406 | 98% |
| pasto | 104,164 | 68,748 | 66% |
| cali | 93,804 | 91,280 | 97% |
| manly | 85,710 | 83,154 | 97% |
| sydney | 74,960 | 49,784 | 66% |

Growth since 24 Aug is real content (props in every world, the delight pass, the locals),
not measurement drift: quay 132,423 → 202,391, kowloon 130,390 → 154,058.

Structural offenders already visible from the top-14 per chapter:
- **pantanal** — one instanced mesh at `4,286 × 10 tri = 42,860` (19% of the chapter),
  a 27,420-tri single mesh, and a 13,904-tri flat `PlaneGeometry`.
- **drift** — `dri:under` is **50,524 tris, 24% of the chapter**, and it is the island
  KEELS, which batch 3's brief already called "not a place". Plus 7,038 × 2-tri planes.
- **goreme** — a 20,000-tri flat `PlaneGeometry`, `gorValley` 27,816, `gorCliff` 17,024.
- **quay** — foliage: 1,451 + 734 + 734 + 734 + 734 + 553 + 326 + 326 instances of
  20/24-tri spheres and cylinders = ~117k of the 202k.
- **antarctic** — a 33,072-tri flat `PlaneGeometry` + a 12,144-tri one, and
  1,400 + 950 twelve-tri boxes.
- **venice / cave / kowloon / kyoto / cali / manly / rio** — 97-99% of every triangle
  casts a shadow, so the shadow pass re-renders essentially the whole chapter.

### Chapter-neutral finding, found while re-running batch 3's stillness audit

**NPC STEERING HAS NO TERM FOR THE PLAYER, SO A WALKER BULLDOZES A PARKED CAPYBARA.**
This is what batch 3 handed forward as "Pasto drifts 28.32 m on ground its own `slopeAt`
calls flat". It is not the ground.

Measured (`qa/b4-pasto.js` … `qa/b4-pasto4.js`), Pasto at spawn+(9,9), no input, 60 s:

- The animal is displaced **4.30 m, 12.29 m and 28.86 m on three runs of the same build** —
  the spread is the parade's phase, not noise in the physics.
- Throughout, the nearest body is a **kinematic (type 4, mass 0) box, halfExtents
  0.18 x 0.30 x 0.34, `userData.npc`, moving at 1.83–1.91 m/s**, holding station
  0.95–1.07 m away. Nineteen kinematic bodies in the chapter; two of them run this route.
- `capy.frame` is **null** the whole time — the animal is not being CARRIED through the
  reference-frame channel, it is being shoved by narrowphase, which is the channel
  `capy3-external-forces-on-the-capybara` says a body must never be moved through.
- `body.velocity` reads 0.000 at the moment of several of the steps, so a velocity-based
  stillness test cannot see this at all. Displacement can. `capy.loaf` sat at 0.99.

Cause: `npc.js:2578 navBlocked()` forwards only to `game.env.navBlocked` — **static world
geometry**. `steerTo` (npc.js:3175) probes 1.4 m ahead against that and dodges through
`npcAVOID_TRIES`, so a walker steers around a building and walks straight through the
player. The collider is `collisionFilterMask: -1`, so it wins.

Not Pasto-specific: any NPC route that crosses where the player is standing does this.
Fix belongs in `npc.js`, gated OFF for the states that are supposed to reach the player
(chase / flee / cornered / praise / chat), reusing the existing dodge machinery.

**And the audit that found it under-reports.** `qa/stillness.js` prints `slopeAt 0` both
when the ground is flat AND when the chapter publishes no `slopeAt` at all — `pasto`'s
`biome.api()` returns **no keys whatsoever**, so its "on ground its own slopeAt calls flat"
line was measuring nothing. Same false-equivalence as batch 3's `pf-mischief.js`
`ownedProps` bug. To be fixed with the rest.

### Job 1 closed — the six chapters

| ch | commit | headline |
|---|---|---|
| 13 Cappadocia | `59c1080` | the marquee paid out with the sun 103 m under the valley floor |
| 17 Antarctica | `7eba995` | the payout fired 208 times and stacked 29 cards through its own marquee |
| 15 The Pantanal | `fec13b7` | 98.8% of the chapter cast a shadow; the marquee is a LINE shot from astern |
| 14 Manly | `e2c9a93` | the ceremony ran on every qualifying ride; no pair-chat was possible |
| 12 Palawan | `8db31c7` | the bloom only ADDED light, so blue rose LEAST when the water lit up |
| 16 Son Doong | `(this)` | photo mode in the dark kept a thumbnail 41.7% crushed to black |

**Chapter-neutral, and the biggest single finding of the batch:** the idle snap
could not see the physics step that had already happened, so a parked capybara
crept down every slope in the game. 15 of 17 chapters now measure exactly zero
displacement at both stillness sample points.
