# BATCH 1 — Foundation and comedy (Payoff Pass)

Ran 25 Aug 2026, on `claude-opus-5` as pinned in `.claude/settings.json`.
Full technical detail is in **CONTRACT.md § THE PAYOFF PASS, BATCH ONE (v23)**.
Project memory: `capy3-payoff-batch-one`, `capy3-gust-is-an-impulse`,
`capy3-mischief-radii`.

## Checklist — all done

### Job 1 — baseline audit
- [x] (a) fresh-save journey through all 17 chapters, **twice** — act order and
      reverse. `qa/pf-soak.js`. 199 tasks, 0 issues, 0 console errors both ways.
- [x] (a) save/reload at four hostile moments — mid-act, mid-carrier, mid-dive,
      mid-ceremony. `qa/pf-restore.js`. **Found and fixed the save debounce.**
- [x] (a) extended `qa/fuzz.js` (it was running against a title screen), and
      added the three new systems to it. `qa/pacing.mjs`, `qa/audit-tasks.mjs`
      and `qa/lines.mjs` re-run green and needed no change.
- [x] (b) solidity, phasing and NPC health on 14–17 plus 1–3. No new solidity
      bugs. `qa/audit-solid.js` extended with a reload-stable identity;
      `qa/pf-npchealth.js` is new and audits LOCALS, live-gated.

### Job 2 — the mischief economy
- [x] Ownership, with two hard ceilings and a leash on the prop
- [x] Produce — a line and a shoo, in locals chapters and in Sydney/Pasto
- [x] Chains — one reaction turns every head within 20 m, one answers
- [x] The wind: the turbulent kick plus the speed cap. **Lands its intent.**
- [x] Adoption: **13 of 15** locals chapters carry two of the three chains

### Job 3 — stillness as a verb
- [x] Auto-loaf on `capyRestT` (asserted, with a prop in the mouth)
- [x] Sit posture, camera eases wider, the score leans further
- [x] Critter registry inverts, per species (`bold`), four species adopted
- [x] Iceland's hot spring — **the marquee was 29 cm under the water**

## FOUND AND FIXED

| what | where | how it was found |
|---|---|---|
| **The save debounce ran on the SCALED dt.** 700 ms of promised wall clock became 1046 ms on a marquee (timeScale 0.62) — so the biggest tick in a chapter had the latest save. | `systems.js` | reloading 600 ms after Kyoto's last task lost the whole chapter |
| **Iceland never set `localWater`.** Three bodies of water at two heights, `waterHeightAt` answering for all three since it was written, and `capyWaterY` never asking. The capybara was **29 cm under the drawn surface for the whole seven-second soak**. | `iceland.js` | certifying the loaf's marquee, from the rendered PNG |
| **`qa/fuzz.js` never started the game.** All seventeen chapters returned identical results with no errors — seventeen clean passes against a title screen. | `qa/fuzz.js` | the results were byte-identical per chapter |
| **The blocked-step ray switched retrieval off.** Starting 0.45 m out, a stallholder chasing a hat 4.4 m away moved 0.48 m in 18.5 s, because their own counter is the first solid thing in front of them. | `npc.js` | the ceiling drill reported a state that ran its full clock without moving |
| **`npcOWN_R` at 5.5 m gave five chapters of fifteen nobody who owned anything.** | `npc.js` | the adoption census |
| **The loaf did not reach the calm field in water**, so "the score goes soft" did not happen in the one place it was written for (loaf 1.00, calm 0.00). | `systems.js` | measuring the soak |

## FOUND AND NOT FIXED — for batches 3 and 4

1. **The Drift and Sơn Đoòng carry one reaction chain, not two.** Measured:
   their people and their props are 21–24 m apart and the Drift's closest pair
   of people is 36 m. Not fixable from `npc.js`; it is chapter layout. Both
   chapters get the five pillars in batch 3 (Drift) and batch 4 (Sơn Đoòng) —
   moving one prop or one person a few metres closes it.
2. **Only 6 of 17 chapters have any EDIBLE prop at all** (Sydney 7, Pasto 13,
   Cali 4, Pantanal 3, Kowloon 2, Quay 1). The graze verb, and the produce
   reaction that hangs off it, cannot fire in the other eleven. One `edible`
   flag on an existing `physTYPES` row fixes each — a per-chapter design call,
   so it belongs in the five-pillars passes.
3. **The critter inversion is adopted by four species of five registrations.**
   Kyoto's heron, Manly's gulls, Göreme's cats and Iceland's sheep have `bold`
   and an approach; Circular Quay's gull registers but has neither. Everything
   else in the game that flees does not use the registry at all. Cheap wins for
   pillar 3 in every chapter that has an animal.
4. **`qa/pacing.mjs` still wants one more ordinary task in Kyoto** to reach the
   20-minute band at 75 s/task. Unchanged from before this batch, and the brief
   for batch 2 explicitly says do not add tasks — so this is a note, not a job.

## WHAT BATCH 2 NEEDS TO KNOW

- **The mischief economy and the auto-loaf are both in the tree**, so job 4's
  pillar 2 has something to certify. `qa/pf-mischief.js` and `qa/pf-loaf.js`
  are the harnesses; both print an `issues` array and are green.
- **`capy.loaf` (0..1) and `capy.loafAsk`** are published. A chapter that wants
  the animal to sit somewhere the rest timer cannot reach writes `loafAsk = 1`
  every frame. The finale in batch 2 job 1 probably wants this.
- **`game.physics.rescue(prop)`** and **`game.physics.typeOf(type)`** are new
  additive exports.
- **`game.hud.calmAudit()`** now also returns `loaf`, and each critter row
  carries `bold` and `appr`.
- **A local may now leave its anchor** while `r.own` is set. Any audit asserting
  "never more than `npcLOC_STEP_R` from the anchor" has to gate on that.
- **The picker/journal/ledger were not touched.** Nothing in this batch changes
  the save format; files written before it restore unchanged.

## HARNESS NOTES THAT COST TIME

- `playwright-cli run-code` scripts cannot `require`/`import` node modules and
  their return value is not printed. Post results to the `/shot` sink as base64
  JSON (`fetch('/shot?name=x.json', …)`) and read `qa/x.json.png`.
- The condor needs **two** `summon()` calls (the first leaves it circling high)
  and the mount reads `input.actionPressed` — a rising edge. Holding
  `input.action` never boards it.
- Palawan's bay is **dry 60 m south** of the spawn and swimmable 60 m north.
- Prop spawn positions are randomised per load, so any chapter-wide prop census
  is different every run. Park one prop by hand for a measurement.
- THREE `object.id` is a global counter and changes on every reload; an audit
  that names a hit by id names nothing an hour later.

## FINAL REGRESSION — all green

| suite | result |
|---|---|
| `qa/audit-tasks.mjs` | 0 blockers, 0 warnings over 199 tasks in 17 chapters |
| `qa/lines.mjs` | 0 blockers, 0 warnings over 426 conditional lines |
| `qa/pf-soak.js` | 199/199 in act order AND in reverse, 0 issues, 0 console errors |
| `qa/pf-restore.js` | 4 hostile moments, all entered, 0 issues |
| `qa/pf-savelag.js` | plain 713 ms · marquee 719 ms · journal open 717 ms |
| `qa/audit-solid.js` | nothing off the cry-wolf list in 14–17 or 1–3 |
| `qa/pf-npchealth.js` | 17 chapters, live-gated: 0 drift, 0 body desync, 0 off-ground |
| `qa/pf-parent.js` | 0 of 224 props detached from the scene |
| `qa/pf-loaf.js` | 0 issues — including the loaf arriving with a prop in the mouth |
| `qa/pf-soak-ice.js` | 0 issues — task at 5.52 s, calm 0.99, sheep inverted |
| `qa/pf-gust2.js` | Manly 2.24 m · Marrakech 0.61 · Antarctica 0.67 · calm chapters 0.00 |
| `qa/pf-mischief.js` | the walk, the two ceilings and the chain all green; 2 adoption notes |
| `qa/fuzz.js` | **ALL CLEAN across 17.** 0 NaN, 0 camera NaN, 0 void frames, 0 errors |

The fuzz's new columns, after eight seconds of random keys per chapter: the
loaf finite and in range everywhere and down in all seventeen; one live
retrieval caught in Manly (`ownT` 2.3 s, the local 1.75 m off its anchor); and
the furthest an untouched light prop got from its home on the wind's account was
**3.2 m in Sydney** — a chapter whose effective wind never reaches the kick
threshold at all, so that one is the ibises — then Antarctica 1.49, Manly 0.87,
Marrakech 0.76, the Drift 0.68, Iceland 0.32 and **0.00 in the other eleven**.

## New qa files

`pf-soak.js` · `pf-restore.js` · `pf-savelag.js` · `pf-probe.js` ·
`pf-npchealth.js` · `pf-solid1417.js` · `pf-mischief.js` · `pf-own-r.js` ·
`pf-gust.js` · `pf-gust2.js` · `pf-gust3.js` · `pf-gust4.js` · `pf-parent.js` ·
`pf-loaf.js` · `pf-loafshot.js` · `pf-loafshot2.js` · `pf-soak-ice.js` ·
`pf-springshot.js` · `pf-springy.js` · `pf-smoke.js`
