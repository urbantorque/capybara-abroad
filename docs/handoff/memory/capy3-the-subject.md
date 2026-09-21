---
name: capy3-the-subject
description: "P1 — the look raise is an angle not a height, the rim's direction is the sign of the contrast, and the two features that measured as nothing"
metadata: 
  node_type: memory
  type: project
  originSessionId: 58965c1c-b475-4eb2-bd2b-46df963489e0
  modified: 2026-09-02T09:32:34.533Z
---

Batch P1 of `ROADMAP-POLISH.md`, 2 Sep 2026, commit `0965e68`. Contract section
**THE SUBJECT — P1**.

## THE INSTRUMENT, WHICH IS THE WHOLE BATCH

**Render the frame, hide the capybara, render again, count the pixels that
changed.** That is exactly how much of the animal you can see, with nothing
classified as fur or leaf; the mean luma of those pixels against what replaced
them is the silhouette contrast. Both from one pair of renders, and `readPixels`
works if the render and the read are in ONE `page.evaluate` (harness trap 12's
constraint, satisfied). `qa/p1-see.js`.

## THE FIX: A RAISE IS AN ANGLE, NOT A HEIGHT

The occlusion ray shortens the boom and moves nothing else, so the eye comes in
while `sysLook` stays 0.6–1.6 m above the animal's feet — and the closer the eye,
the bigger that offset is in degrees. Measured at 21 stations:

| clear | animal below centre |
|---|---|
| 1.00 | −0.21 (sixteen chapters) |
| 0.54 | −0.39 Manly |
| 0.26 | −0.78 Antarctica |
| 0.16 | **−1.40, off screen, 0 px** |

`sysLOOK_RAISE` × `camClearF`. Under the pine **0 px → 57,412 px**. At clear = 1
it is arithmetically the old line. Reads LAST frame's `camClearF` deliberately.
Also: `camClearF` was never reset in `teleportCapy`, so a chapter left from
somewhere tight handed its cut to the next arrival.

## A RIM IS LIGHT, AND THAT DECIDES ITS SIGN

`matSelf` = `mat()` with the rim's uniform objects swapped for the animal's pair
— **same source, same `customProgramCacheKey`, so no new program**. Six body
materials; nose and eyes stay on `mat()`.

**The first table was wrong in ten of nineteen** because it lifted hardest where
contrast measured lowest. A rim can only move an edge toward white: it separates
her from a background she is BRIGHTER than and closes the gap on one she is
darker than. Paired A/B, sign of change = sign of contrast, no exceptions —
antarctic +9.2, drift +8.9, pantanal +8.3, iceland +8.1, cave +6.6, kowloon +4.6
against venice −4.2, sydney −4.1, hanoi −3.2, sahara −2.9. `sysSELF` keeps a
lift only where it held across TWO paired runs; Kyoto gave +0.5 then −2.7 and was
demoted. The darker-animal chapters want a DARKER edge, i.e. a contact-occlusion
term, not this one negated.

## TWO FEATURES THAT MEASURED AS NOTHING, AND WERE REPORTED AS NOTHING

- **The canopy dissolve** (a cone from lens to animal, dithered discard in
  `leaf()`, reaching every plant through the one shared material). Built, worked,
  removed: 84,479 px of capybara with it off vs 84,627 with it on, over 96 yaw
  samples and 30 walk legs. The frame that motivated it was the look raise.
- **Skipping people and traffic in `sysCamRayHit`** (the ignore list
  `capyClimbRayHit` already keeps). Four crowd stations, 25 s, 10–32 people:
  `clear` 1.000 before and after, zero dips. Kept as contract alignment, recorded
  as a no-op. The boom sits ~8 m up and passes over heads.

## THE BUG THE INSTRUMENT FOUND

`RangeError: setValueAtTime … -0.000127775` in Cali and Marrakech, on the
UNMODIFIED tree. That is the size of `musFeel`'s own humanising jitter.
`musStart` calls `musTick()` synchronously on the line that builds the graph,
`ac.currentTime` is still exactly 0, the band guard is `musBarAt < now` so
`0 < 0` leaves the anchor at zero, and half the first bar lands before the
origin. Coin toss per note — **which is why R10's soak said the console was
clean: it read `state.lastError` and console messages, and an uncaught
RangeError out of a `setInterval` callback is neither.** `musFeel` clamps to
`ac.currentTime`.

## THREE MEASUREMENT LESSONS THAT COST TIME

1. **TWO RUNS OF THIS GAME ARE NOT COMPARABLE.** People, props and carriers are
   not in the same places, and cross-run contrast differences of ±20 levels are
   ordinary (sahara's capy pixel count went 2662 → 451 on an unrelated run).
   Every verdict must be a **paired A/B inside one session**, toggling the term
   between two reads of the same pixels — hence `game.state.noSelfRim`, on the
   `noLeaf` pattern already in the file.
2. **A ZERO-WIDTH RAY IS THE WRONG DETECTOR FOR A VOLUME.** `canopyAudit`'s
   raycast said "nothing in the way" in 17 Göreme frames where the dissolve was
   plainly changing the picture, because the cone is 1.7 m across.
3. **`|mean(A) − mean(B)|` CANCELS.** Half the pixels brighter and half darker
   reads as zero contrast. Use `mean(|A − B|)` as well.
4. The dev server serves `src/*.js` unbundled with `no-store`, so **editing
   source mid-probe silently contaminates the run.** Baselines must be taken
   with `git stash`, exactly as [[headless-qa-harness]] trap 9 says.

Also: canopies are **InstancedMesh**, so "fade the mesh the ray hit" fades every
tree of that kind in the chapter. Any future occlusion work on foliage is a
shader-side or per-instance job, never a mesh registry.

Verified: 19/19 soak clean, 0 NaN/errors/orphans, no page or console errors in
all nineteen, R1 and R4 green, build 9121.2 KB.

Related: [[capy3-the-polish-review]], [[capy3-the-resting-lens]],
[[capy3-lens-and-wall]], [[headless-qa-harness]], [[capy3-clone-eats-the-shader]],
[[capy3-instruments-that-cannot-hold-a-line]], [[capy3-the-mix]]
