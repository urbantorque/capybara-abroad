# ROADMAP-WOW2 — common brief for every wave agent (20 Sep 2026)

Repo: C:/Users/roger/OneDrive/Desktop/capy3 (branch `lift-pass`). The roadmap is
ROADMAP-WOW2.md in the repo root — READ YOUR SECTION IN FULL FIRST, then the
"Rules for every agent" and "Held" sections. CONTRACT.md's section list (grep
`^## `) is the record of what already exists: this game has the thing more often
than not. Audit the code before building each item; when an item turns out stale
or already shipped, do not build it twice — write the finding into
ROADMAP-WOW2.md under your section in the file's own "reality check" voice.

## The laws (unchanged from L11)
- Low-poly flat Lambert for the built world (`flatShading: true`); smooth normals
  only for what breathes. `PALETTE` colours only (src/shared.js) — no textures, no
  hex literals outside PALETTE.
- Every new visual term is a `game.state.noX` flag (default falsy = live), cut
  to ≤ 0.1 ms when `noX` is true, and PARKED at governor rung ≥ 1 the way
  `sysFAR_SHARE`/`sysFarOn` and `reflectRender(..., rung)` are (read
  `game.state.perfRung`; anything > 0 means park). Never re-base a grade, sun,
  fog, mote or spawn row.
- No new save field except the three the roadmap names (`travSeen`, `kept`,
  `tut`). The third-person "it" voice for any line; the why is never said.
- Mote-pool consumers share `wxMOTE_MAX` (src/weather.js) and yield to the
  chapter's own weather row: a burst never takes more than a quarter of the pool.
- Match the surrounding code's comment density and idiom (the files are heavily
  commented, in a particular voice: short, concrete, says why). File ownership:
  edit ONLY the files your wave names. If you need a hook in another wave's file,
  make it minimal and say so in your report.

## The harness (from the memory note headless-qa-harness; the traps that bite)
- The dev server is ALREADY RUNNING on http://localhost:5188/ serving src/
  unbundled (node server.mjs, PORT=5188). Do not start another on 5188. It has a
  QA sink: POST base64 to `/shot?name=X` writes qa/X (a `.png` suffix is forced,
  cosmetic; JSON goes in as `X.json` -> qa/X.json.png, readable with cat).
- Use playwright-cli with YOUR OWN session name: `playwright-cli -s=<yourname> open http://localhost:5188/`
  then `playwright-cli -s=<yourname> run-code --filename=qa/<script>.js`. The script
  is a bare `async page => { ... }` (no leading comment before the arrow, no
  trailing semicolon). run-code prints nothing: get data out through the /shot
  sink from INSIDE a page.evaluate (btoa exists only in the page), and pictures
  with `await page.screenshot({ path: 'qa/<name>.png' })` (canvas.toDataURL is
  blank white). Read PNGs with the Read tool. Copy an existing instrument as a
  template: qa/wow-frametime.js (the A/B), qa/wow-still.js (masked two-frame
  diff), qa/wow-sheet.js (arrival frames), qa/wow-grass.js (on/off per-pixel diff).
- NEVER run `playwright-cli close-all` — it is global and kills the other agents'
  browsers. Close only your own: `playwright-cli -s=<yourname> close`.
- ONE CHAPTER PER run-code INVOCATION, under ~4 minutes. A single tool call past
  ~600 s kills you ("Agent stalled"). Commit after each verified increment so a
  stall loses nothing.
- Start the game with the Begin button: `document.querySelector('.capyui-go').click()`
  (page.mouse.click is unreliable), then assert `window.__capy.state.started`.
  Enter a chapter honestly with `window.__capy.hud.cross('<name>')` and wait ~9 s
  (`biome.switchTo` does not move the animal). Chapter names: sydney, pasto,
  quay, kyoto, cali, rio, iceland, sahara, drift, venice, kowloon, palawan,
  goreme, manly, pantanal, cave, antarctic, monaco, hanoi.
- `window.__capy` is the game: `.state`, `.capy` (the animal; `.body.position`),
  `.camera`, `.scene`, `.renderer`, `.THREE`, `.input` (`camYaw`, keys), `.biome`
  (`.current`), `.locals`, `.tick(dt, render)`. Drive deterministic time with
  `game.tick(1/60,false)` loops inside a page.evaluate (≤ 20 s per evaluate).
  Real keys: `page.keyboard.down/up` — a dispatched press must be a HOLD (~0.35 s)
  and a held movement key re-sent each step. `input.camYaw` is the bearing from
  the animal TO the camera; W walks along minus (sin camYaw, cos camYaw).
- The resting lens is NOT deterministic between arrivals: pin the camera
  (`g.camera.clone()` with updateMatrixWorld, or write position/quaternion) for
  any before/after or any two-frame diff.
- Forcing weather: see wow-mist.js / trap 35 — `odds: 1, hold: 14` and SAMPLE
  the term; a slow attack reads as zero for the first fifth of the hold.
- A per-pixel diff: render twice through one pinned camera into a 2d canvas via
  drawImage(renderer.domElement), compare `getImageData` channels with a
  threshold (~8), count inside a MASK (hide-and-diff: hide the subject, render,
  show, render; the changed pixels are the mask).
- After a source edit, `close` then `open` your session before measuring — ES
  modules cache across page.goto.
- The game saves to localStorage["capy3.journey.v1"]; task-state assertions need
  `page.addInitScript(() => localStorage.clear())` BEFORE goto (and that init
  script then persists for your whole session — for write-then-reload tests use
  page.evaluate(() => localStorage.clear()) once instead).
- Backslashes: Bash heredocs eat them; never put a backtick in a Bash argument.
  Use the Write/Edit tools for any file containing a backslash escape or a
  backtick, including qa scripts.
- If the console's first lines show a module error, ANOTHER agent's half-edit
  may have broken src/ (the server serves it unbundled). Check
  `node --check src/<file>.js` on the file it names; if it is not your file,
  wait 60 s and retry rather than "fixing" someone else's file. Keep your own
  file syntactically valid at every save (edit in small, complete steps; run
  `node --check` after each).

## Gates before every commit
1. `node --check src/<each file you edited>.js`
2. `node build.mjs` (must succeed — the one-file build)
3. `npm test` (25 checks green; the "reports" section cannot fail)
4. `git status` right before committing; `git add` ONLY your files BY NAME
   (the index is shared with the other agents — never `git add -A`, never `git
   add src`); commit immediately after staging.
5. Commit message: `ROADMAP-WOW2 <Vn/Nn/T> <short title>: <one line of what and the
   measured number>`, a body with the budget (ms live-minus-cut, triangles, draw
   calls) and the flag name, ending with the line
   `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
   Never amend, never rebase, never stash while other agents are live
   (a stash removes THEIR uncommitted work from the tree too). For a before/after
   differential use your `noX` flag (live vs cut) — not git stash.

## What "done" means for your wave
- Every item built (or written up as stale with the code line that proves it),
  every term proved by a per-pixel diff inside a mask AND a screenshot read by
  eye (Read the PNG; describe what you see honestly — "I see the umbrellas as
  eight dark rectangles over the crowd" not "verified").
- The instrument the roadmap names under your section written to qa/ and its
  result JSON/PNGs left in qa/ (committed with the code).
- The frame-time A/B for your flags: copy qa/wow-frametime.js to
  qa/wow2-frametime-<wave>.js with your flag list and the chapters you touched;
  live-minus-cut median ≤ 0.6 ms total for all your terms together, rung 0 held.
- A "### Vn — shipped (20 Sep 2026)" (or Nn / T) block appended at the END of
  your section in ROADMAP-WOW2.md (Edit tool, insert before the next `### `
  heading) with: what shipped, what was found stale, the measured numbers, the
  flags, the budget, and any honest miss by name. Nothing in CONTRACT.md — the
  closeout writes that.
- Your final report to the orchestrator: ≤ 40 lines — commits (hashes), flags
  added, numbers measured, misses, anything another wave must know (hooks you
  added in shared files, names you exported).
