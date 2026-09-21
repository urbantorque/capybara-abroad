# HANDOFF — state of play, 21 Sep 2026

Written when the project moved from Claude Code to Codex. Everything a new
agent needs to resume is in this repository; nothing lives outside it any
more except the author's own ear.

## Read in this order

1. `AGENTS.md` (repo root) — the rules, the gates, the harness in one page.
2. This file — what is done, what is in flight, where the branches are.
3. `docs/handoff/memory/MEMORY.md` — the index of 210 memory notes the
   previous agent kept across the whole project. The ones that matter
   most: `headless-qa-harness.md` (55 traps in the test harness — read
   it before running any probe), `capy3-third-beauty-pass.md` (how
   parallel agents were run), `capy3-the-mix.md` / `capy3-the-mix-
   measured.md` / `capy3-sounds-people-make.md` (the audio decisions the
   open roadmap reverses). Each note has a `**Why:**` and `**How to
   apply:**`.
4. `docs/handoff/AGENT-BRIEF.md` — the common brief every wave agent was
   given (harness, gates, commit format, what "done" means). Reuse it
   verbatim as the preamble of any task prompt.
5. `CONTRACT.md` — the top three entries (THE THIRTEENTH, TWELFTH,
   ELEVENTH LIFT) for what shipped last; `ROADMAP-WOW2.md` and
   `ROADMAP-WOW3.md` Closed sections for every honest miss.

## Branches

- `master` — the published build (GitHub Pages builds from it:
  https://urbantorque.github.io/capybara-abroad/). Behind `lift-pass`.
- `lift-pass` — all work since the eleventh lift; clean, green, pushed
  (`f4c995b` at handoff). Merge to `master` when the author wants the
  public build updated.
- `score-w2-wip` — ONE unfinished, unmeasured commit (`befaf28`): the
  first third of ROADMAP-SCORE Part Q1 in `src/systems.js`. Either
  finish Q1 from it or discard it; do not merge it as is.

## Closed (nothing to do)

ROADMAP-WOW2 (L12, 26 commits) and ROADMAP-WOW3 (L13, 20 commits +
Part H). Both have a Closed section with numbers and named misses.

## In flight — ROADMAP-SCORE (the audio pass)

The player asked for the music in front and the world quieter. The
roadmap is `ROADMAP-SCORE.md`; its "shipped" blocks say what landed.

- **W1 (Part M) — DONE**, 8 commits on `lift-pass` (`ff9e5c1`…`774a0c1`):
  the full 20-note theme (`sysMUS_THEME` + B + tag, `sysMUS_PROG`), the
  ocarina voice, statements at 19/19 arrivals, four motifs, the progress
  arc, the finale coda re-pitched to the theme, a settings-card row
  "score: in front / as before" (`sc` in `capy3.prefs.v1`). Flags:
  `noTheme`, `noOcarina`, `noMotif`, `noArc`. Instruments:
  `qa/score-theme.js`, `qa/score-frametime-w1.js`.
- **W0 (the mix, before) — KILLED mid-run.** It was measuring today's
  music-over-world dB and ambience/NPC/notification events per minute in
  an isolated worktree. Its partial results were in
  `.claude/worktrees/agent-aafc83388fc4aa7c0/qa/` on the author's machine
  (not pushed). Re-run from scratch: the roadmap's W0 bullet says exactly
  what to build (`qa/score-mix.js`, `qa/score-events.js`). Do it on the
  commit BEFORE W2 lands anything, so the "before" is honest.
- **W2 (Part Q, the quiet) — STARTED, not landed.** See `score-w2-wip`.
  Q1 (the inversion undone), Q2 (the beds −5 dB, the "wavy" halved, beds
  duck under a statement), Q3 (the ambience ring rate-limited), Q4 (the
  people quieter and rate-limited), Q5 (notifications −3 dB, queued).
  Every row keeps its old value behind `game.state.noQuiet`.
- **W3 (the closeout)** — not started: the six numbers in ROADMAP-SCORE's
  "What this pass measures", CONTRACT.md's entry, a build for the author
  to LISTEN to (no agent can). Part L of the roadmap is the author's own
  checklist to answer.

## Not started (proposed, then withdrawn by the author)

A market-readiness roadmap was drafted as `ROADMAP-SHIP.md` and deleted
at the author's request (`f4c995b`); its content is in that commit's
parent if ever wanted. The four decisions the author gave for it still
stand as facts: free web only; keep all nineteen chapters, restructure
into a shorter spine; the why answered in one image and never in words;
the player is cozy first, goose-game second.

## Two facts a new agent will not guess

1. **Every frame-time budget before 21 Sep was headless and wrong.** On the
   reference GPU (Intel Arc 130V, in a real browser) the thirty visual
   terms of the last three passes cost a median 1.6 ms together, over
   the 0.6 ms rule they were written under — the rule was never testable
   in software GL. Absolute frames are 6–10 ms; the governor's rung
   ladder is the answer and is built. Measure new terms in a real browser
   (`ROADMAP-WOW3.md` Part H has the method: pin rung 0 via
   `capy3.prefs.v1 = {v:1, pf:1}`, time `game.tick(1/60, true)`).
2. **A stranger can learn the game from its own pills.** Two blind runs
   (agents that read nothing) named every verb the tutorial teaches. What
   they could not do: attribute ticks that fire without intent, read the
   incident meter, or find the gate in Sydney's picnic-lawn fence. The
   Esc menu "not appearing" in those runs was the harness (a throttled
   hidden tab), not the game.

## Tooling that does not carry over

- The previous agent published test builds as private claude.ai
  artifacts. Use GitHub Pages (`master`) or open
  `dist/untitled-capybara-game.html` from `file://` instead.
- The previous agent ran up to five subagents in parallel on disjoint
  file sets. Codex runs one task per thread/sandbox; run waves
  sequentially, or open one Codex thread per wave with the file sets
  from the roadmap's "Order and ownership" section and merge in order.
- The previous agent's browser pane gave a real GPU for measurements;
  the playwright harness is headless. Real-GPU numbers need the author's
  own browser with the game open and `window.__capy` in the console.
