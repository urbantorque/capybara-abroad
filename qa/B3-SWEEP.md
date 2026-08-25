# BATCH 3 — the per-chapter sweep brief (for delegated measurement agents)

You are measuring ONE chapter of capy3 against the five pillars. You are a
MEASUREMENT agent: **do not edit anything under `src/`.** Fixes are applied on
the main thread. You may create probe scripts under `qa/` and screenshots.

## Environment — already set up, do not redo

- A dev server is ALREADY RUNNING on `http://localhost:5188/`. Do not start one.
  If it is down, start it with `PORT=5188 node server.mjs &` from the repo root.
- Build with `node build.mjs` ONLY if you find the dist stale; you are not editing
  src, so you should not need to.
- Use YOUR OWN playwright session name, given in your prompt, on every command:
  `playwright-cli -s=<yoursession> open http://localhost:5188/`
- **NEVER run `playwright-cli close-all`** — other agents share this machine.
  Finish with `playwright-cli -s=<yoursession> close`.

## Harness recipe (this project's, learned the hard way)

- `window.__capy` is the game. `game.tick(dt, render)` advances it by hand.
- Park in a chapter:
  ```js
  g.biome.switchTo(name); const sp = g.biome.spawnOf(name), b = g.capy.body;
  b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0);
  b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
  for (let i=0;i<120;i++) g.tick(1/60,false);
  ```
- `qa/pf-loaf.js`, `qa/pf-mischief.js` are worked examples of a probe script.
  A `run-code` file must be a bare `async page => { ... }` — no leading comment
  block outside it, no trailing semicolon.
- `run-code` prints neither console.log nor the return value. Get data out by
  POSTing `btoa(unescape(encodeURIComponent(JSON.stringify(out))))` to
  `/shot?name=<name>.json` and reading `qa/<name>.json.png`.
- Pictures: let rAF run and use `playwright-cli -s=<s> screenshot <path>`.
  `toDataURL` gives a stretched projection and a camera caught mid-transition.
- Start any run that asserts on TASK state with
  `await page.addInitScript(() => { try { localStorage.clear() } catch(e){} })`
  before the reload — the game saves to `capy3.journey.v1` and completed tasks
  survive reloads. But do NOT use addInitScript for a write-then-reload test.
- First `run-code` after a `goto` often fails; wait 6-8 s, and just run it again.
- `page.evaluate` longer than ~20-30 s dies. Split soaks.
- Do not read whole source files — `systems.js` is 17k lines. Grep and read ranges.

## THE FIVE PILLARS — what to measure

1. **Marquee certification.** Name this chapter's ONE wow moment (look for the
   `wow` flag on its task rows). Verify all four "that landed" channels from
   CONTRACT.md §THE FOUR CHANNELS (line ~64) **at the moment itself**:
   - *framed* — camera yaw/distance/pitch at the payout, judged from a rendered
     PNG, not from metrics. Note: no chapter can currently frame its own marquee
     (no public setter for `camYawTarget`/`camDistTarget`) — the main thread is
     building one, so REPORT what framing the moment actually wants: a target
     point, a yaw in degrees, a distance in metres, and a hold in seconds.
   - *lit* — does the event grade layer (`systems.js` ~13830-13905) have a row
     for this chapter, and does the moment change bloom/threshold/vignette?
   - *audible* — is the payout cue positional (`game.sfx(name, { at: pos })`)?
     The loudest cue in a chapter is the most likely to be mono.
   - *acknowledged* — does a local, a critter, the card or the score mark it?
2. **The cast.** Pair-chat actually fires (13 m radius). `after:`/`before:` lines
   present. At least one local acknowledges the player unprompted. Batch 1's two
   mischief chains work here (`qa/pf-mischief.js` measures ownership/produce/
   witness per chapter — run it and read this chapter's row).
   **`addCritter` with no `bold` is a DEAD REGISTRATION** — the v23 inversion is
   silently absent. Check every `addCritter` call in the chapter file.
3. **Feel of the ground.** Per-surface footfall pitch, slip, particles; wetness
   interplay; room tone in interiors; mood-table coverage; the auto-loaf reads
   right here (`capy.loaf` arrives, camera eases, score leans). **A surface
   ladder must ask the chapter where things are, not guess from one axis** —
   check `capySurfacePitch`'s branch for this chapter against the real extents.
4. **The signature toy.** Name this chapter's unique interaction. Is it thin?
   Does it have READERS — an NPC line, a camera change, a task, a record — or is
   it a timer and a chime? (Sydney's `vanRiding()` had zero readers repo-wide.)
   If thin, propose a deepening that uses something the chapter has ALREADY
   DRAWN and never used. That rule made sixteen earlier tasks cheap.
5. **Route life.** Walk the main route (spawn -> task rows in order). Report any
   purposeless dead 20 m cell — no scenery, no prop, no NPC waypoint, no
   landmark in view. Every return toll must have a ride. Landmarks visible from
   the route.

## Your report — THIS IS THE ONLY THING THAT COMES BACK

At most ~35 lines. No preamble, no narration of what you tried. For each pillar,
one of: `OK` with the number that proves it, or a FINDING as:

`P<n> <one-line title> — <file>:<line> — <the measured number> — FIX: <one sentence>`

Rank findings by how much a player would feel them. Say plainly which pillars you
could NOT measure and why. Do not propose work you did not measure the need for.
