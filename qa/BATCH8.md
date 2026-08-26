# BATCH 8 — the independent list: nine things that contend with nothing

> **Prompt:** `run qa/BATCH8.md`

Brief: `qa/LIFT-PROMPTS.md`. Predecessors: `qa/BATCH5.md` … `qa/BATCH7.md`, and
`qa/CLOSEOUT.md`, which is where rows 1-6 were last measured and left open.

Read `headless-qa-harness` in project memory first.

**None of this touches the shared controller, the camera rig or the reaction layer**, so this
batch may run at any point — before, between or after the other three, or split across two
sittings. It is a list, not a sequence. Rows are ordered by how much they cost a player, not
by how hard they are.

Three of them are the same defect in three chapters: **a thing that was drawn, published and
never once asked after.**

---

## The rows

- [ ] **1 · Pasto — the spawn drift, and it is not the walker shove**

      Measured parked at spawn+(9,9) with **no input**: ~8 m of travel in 60 s, three runs
      consistent (7.97 · 8.11 · 7.97). `npcBlockedFor` landed last pass and took the shoves to
      **0 in three consecutive runs** — and the drift did not move (7.97-9.71 without, 7.97-8.11
      with). An earlier run with **14 shoves drifted 1.22 m**, so the shove was never the
      dominant term.

      What is left is a steady straight slide on ground where `gradX`, `gradZ` and `slopeAt`
      all read **0.0000**, with the body holding *exact* velocities — `vz = -3.000` for five
      seconds, then `vx = -0.368` for five more — while its position barely changes. A held
      exact value is a **bare velocity write**, which `capy3-external-forces-on-the-capybara`
      says is the one channel a body must never be moved through. Find the writer.

      This is the second thing anybody touches in the game. It should not still be here.

- [ ] **2 · Hong Kong — the neon reads as a carpet from the game's own camera**

      `hkGlowMesh` sizes each pool as `rr = (w + h) * 0.42`, drawn at `rr * u * 1.5` — a
      **radius of (w + h) × 0.63**, up to roughly 15 m across for a large sign, sixty of them,
      overlapping. Observed from the default rig: the carriageway is a quilt of translucent
      discs rather than a wet road with lights over it.

      The code's own comment warns of exactly this — *"Big overlapping patches tile the whole
      carriageway and the road stops being tarmac and becomes a rug."* The fix that comment
      documents changed the **shape** (nested boxes → 16-gons, because a pool of light is
      round) and left the **size**. Both halves are needed.

      Judge it from the PNG at the arrival camera and from the roof, not from the number.

- [ ] **3 · Hong Kong — the roof, still 0.65 m out of reach**

      Tops out 0.65 m east of the deck; the scaffold colliders fill the bay. `symphony` is not
      blocked by it, so nothing is unwinnable — but the chapter's last verb and its best
      picture are supposed to be the same gesture, and they are not.

      **Do not lower `hkSCAF.top`.** Carried unchanged through v27, v28 and v30 with that
      warning each time.

- [ ] **4 · Palawan — `inZone('shaft')` has no readers repo-wide**

      The chamber with the hole in the roof and one shaft of light coming down onto white sand
      is drawn, is published as a zone, and nothing in the game has ever asked about it. It is
      the picture the chapter's whole argument resolves into.

- [ ] **5 · Sơn Đoòng — `nearestDrip()` and `echoReady()` have no readers repo-wide**

      Two published APIs, unread, in the one chapter whose entire argument is sound and
      dripping water. Twenty-six drips that ring the floor and tick, and nothing asks where the
      nearest one is.

- [ ] **6 · Iceland — the snowcat is parked where nobody goes**

      Track at `x = 34`; every glacier run ends at `x ≈ -20`. Moving it moves the beacon, the
      headlights, the ramp meshes and the fox's orbit centre, all derived from `iceCAT_X` —
      which is why three passes have written it down instead of moving it. Either move all five
      together or move the runs; do not move the track alone.

- [ ] **7 · Route density — Monte Carlo 11, Kyoto 10**

      Measured on the nineteen-chapter `route.js` (see `qa/BATCH5.md` job 1a; the version in
      the repo before that fix reads only eight chapters). Everything else is 0-4.

      **Kyoto at 10 is new** — the Gion → torii → Uji walk is the emptiest sustained route in
      the game, and it lands in chapter four, before a player has any reason to be patient.
      Monte Carlo's dead cells all sit on one walk: the climb from the port to the Casino,
      which is how act one becomes act two. Fifteen instanced lamps closed it from 14 to 12 by
      differential; the rest is content on that hillside.

      **TRIM, never pad** — batch 4's rule. And remember the probe's own history: it once
      reported 48 dead cells and adding fifteen lamps on the exact line it complained about
      moved the number **up** to 53. A detector that gets worse when you fix what it points at
      is not measuring what it says.

- [ ] **8 · Manly — 617 drawn objects, by far the fewest in the game**

      Median is around 2,700; Marrakech is 13,279. Manly passes the route audit only because
      most of the chapter is water, which is the one place a dead cell is not a fault. That
      makes the audit's green a fact about the geometry rather than about the chapter.
      Decide deliberately whether a surf zone wants more in it, and record the decision either
      way.

- [ ] **9 · Ambient life — 5 of 19 chapters register a critter**

      `quay`, `kyoto`, `iceland`, `manly`, `goreme`. Chapters 18 and 19 have no ground animal
      drawn at all, so for them this is content and not a flag. The seven "things that are
      simply there" — the floatplane, the heron, the storks, the vencejos, the cometas, the
      arctic fox, the skein over the Drift — are the cheapest delight in the game per line, and
      two-thirds of the chapters have none.

      This row is the one that can be trimmed if the batch runs long. It is also the one most
      likely to be worth more than it looks.

- [ ] **10 · Room tone is keyed per biome, not per space** *(declined twice; restate, do not
      re-litigate)*

      Venice and Palawan remain its worst cases. Carried unchanged from v27. Either build it or
      restate it — do not write the finding down a fourth time as though it were new.

---

## Done when

- [ ] Every row above either **fixed and proved by differential**, or **restated as open with a
      current measurement**. A row that is neither is not finished.
- [ ] Row 1 in particular: the writer named, or the search recorded with what was ruled out.
      "Still drifting" without a narrowed cause is not a result.
- [ ] `qa/stillness.js` — Pasto's entry gone, or its residual re-measured and stated
- [ ] `qa/fuzz.js` 19 chapters 0 errors · `route.js` re-run and the table recorded
- [ ] Any unread API from rows 4 and 5 now has a reader, or is deleted — **a published API with
      no reader is either a missing feature or dead weight, and it should not stay ambiguous**
- [ ] Log written below: found vs fixed, and what was declined
- [ ] `CONTRACT.md` new version section · project memory · `playwright-cli close-all`

**Chain nothing.** The Lift Pass ends here.

---

## Log
