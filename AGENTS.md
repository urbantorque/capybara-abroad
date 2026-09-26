# AGENTS.md — how to work on Capybara Abroad

This file is read by coding agents (Codex, and any other) before touching
the repository. It is the distilled version of a month of rules; the long
form is docs/CONTRACT.md (the living contract, newest entry at the top) and
docs/handoff/ (the previous agent's memory and briefs). Read
docs/handoff/HANDOFF.md first for the state of play.

## What this is

A single-file browser game (Three.js + cannon-es, no bundler, no
dependencies): a capybara loose in nineteen real places. `npm start`
serves `src/` unbundled on a port; `node build.mjs` inlines thirty
modules into `dist/untitled-capybara-game.html`; `npm test` runs 81
static checks in about two minutes. `master` is the published build
(GitHub Pages builds from it); the latest pass (ROADMAP-AAA) was worked
on `aaa-polish` and merged.

## The laws (do not argue with these; they are measured decisions)

- Low-poly flat Lambert for the built world (`flatShading: true`), smooth
  normals only for what breathes. `PALETTE` (src/shared.js) only — no
  textures, no images, no samples, no hex literals outside PALETTE.
  Synthesised audio only.
- Every new visual or audio term is a `game.state.noX` flag (falsy = live),
  costs ≤ 0.1 ms when cut, and parks at governor rung ≥ 1
  (`game.state.perfRung`). Frame-time budgets are measured on the reference
  GPU in a real browser, not headless (see docs/roadmaps/ROADMAP-WOW3.md
  Part H; qa/aaa-ab.mjs is the one-command flag A/B with GPU timer queries).
- Never re-base a grade, sun, fog, mote, spawn, chord, root, next, dwell,
  cut or instrument row. New things are laid over them.
- No new save field without a roadmap naming it (`sysSAVE_SHAPE`,
  src/systems.js ~4341). One writer per parameter / AudioParam.
- The writing voice: third person, the animal is "it", the why is never
  said. Every line goes through the pools and passes `qa/lines.mjs` and
  `qa/l6-tics.mjs` (no phrase in more than three files).
- Match the surrounding comment density and voice: short, concrete, the
  why beside the number. The files are heavily commented on purpose.

## Gates before every commit

1. `node --check src/<every file you edited>.js`
2. `node build.mjs`
3. `npm test` (81 checks, 0 failed — the "reports" section cannot fail;
   the soak-diff staleness line is informational)
4. `git status`, then `git add` only your files BY NAME. Never `git add
   -A`, never stash while another agent is live, never amend or rebase.
5. Commit message: `ROADMAP-<NAME> <item>: <what and the measured
   number>`, a body with the budget and the flag name.

## The harness (the game is tested by driving it, not by reading it)

Full detail: docs/handoff/memory/headless-qa-harness.md (55 traps, each
one cost hours). The short version:

- Dev server: `PORT=5188 node server.mjs`. It has a QA sink: POST base64
  to `/shot?name=X` writes `qa/X` (a `.png` suffix is forced; JSON goes in
  as `X.json` → `qa/X.json.png`, readable as text). `qa/**/*.png` is
  gitignored on purpose — instruments are committed, results are not.
- Playwright: `playwright-cli -s=<session> open http://localhost:5188/`
  then `playwright-cli -s=<session> run-code --filename=qa/<script>.js`.
  A script is a bare `async page => { ... }`. run-code prints nothing;
  get data out through the `/shot` sink from inside `page.evaluate`, and
  pictures with `page.screenshot({ path })` (`canvas.toDataURL` is blank).
  Copy an existing instrument (qa/wow-frametime.js, qa/wow-still.js,
  qa/wow2-alive.js) rather than writing from scratch.
- Start the game with `document.querySelector('.capyui-go').click()`
  and assert `window.__capy.state.started`. Enter a chapter with
  `window.__capy.hud.cross('<name>')` and wait ~9 s. Names: sydney, pasto,
  quay, kyoto, cali, rio, iceland, sahara, drift, venice, kowloon,
  palawan, goreme, manly, pantanal, cave, antarctic, monaco, hanoi.
- `window.__capy` is the game: `.state`, `.capy` (the animal), `.camera`,
  `.scene`, `.renderer`, `.input`, `.biome.current`, `.tick(dt, render)`.
- One chapter per run-code invocation, under ~4 minutes. `close` only
  your own session, never `close-all` (it is global). After a source
  edit, close and reopen the session — ES modules cache across goto.
- The save is `localStorage["capy3.journey.v1"]`; a task assertion needs
  `page.addInitScript(() => localStorage.clear())` before goto, and a
  write-then-reload test must NOT install that script.
- Prove every visual term by a per-pixel diff inside a mask (hide-and-
  diff) and a screenshot read by eye; every story term by a count the
  save keeps; every timing/audio term under real keys and a real clock.
- The resting lens is not deterministic between arrivals — pin the
  camera for any before/after.

## Working in parallel

The method that held clean for forty-six commits across two passes: one
agent per disjoint file set, never two live edits to the same file, stage
by name, `git status` right before every commit. If you cannot guarantee
that, work sequentially. `src/systems.js` (51k lines) and `src/npc.js`
(16k) are the contended files; a wave that needs both runs alone.

## Where things are

- docs/CONTRACT.md — every pass, newest first; grep `^## ` for the list.
- docs/roadmaps/ROADMAP-*.md — one per pass; closed passes keep a
  `## Closed` section and are never deleted (they are what the contract's
  entries cite). ROADMAP-AAA.md is the latest.
- docs/archive/ — retired reviews, the old handoffs and the long README.
- src/rival.js — the ibis (AAA A4): talks to systems.js only through
  game.dropNearest / dropSteal / dropGive / groundY / rivalOK.
- src/shared.js — PALETTE, CHAPTERS (~3741), TASKS (~2945), grain(), the
  reflection pass, the tracks pool. src/systems.js — everything else
  (HUD, save, score, sfx, finale, tutorial, camera). src/npc.js — people
  and animals. src/capybara.js — the rig. src/weather.js — motes, beds,
  mist. src/far.js — far planes. One file per chapter.
- qa/ — instruments (committed) and results (ignored); `npm run soak`
  is the long fuzz, run alone.
