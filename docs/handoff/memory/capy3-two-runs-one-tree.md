---
name: capy3-two-runs-one-tree
description: "The scheduled task fired twice and two Claude sessions worked the same capy3 tree for forty minutes"
metadata:
  node_type: memory
  type: feedback
---

26 Aug 2026. The `capy3-batch-4` scheduled task fired while the FIRST batch-4 run was still
working. Both sessions had the same working directory, the same branch and the same brief.

**Why the second run did not notice for two hours.** It oriented the way the brief tells you
to — `qa/BATCH4.md` plus `git log --oneline` — and both said "job 1 closed". They were
right *at that moment*: the first run had done jobs 2 and 3 but had not committed them yet.
By the time it did, the second run had already read the file and moved on, and it re-derived
the entire triangle baseline and the vsync/cost analysis from scratch before spotting the
divergence.

**How it was spotted, eventually:** a subagent's file inventory listed `qa/b4fz-*.js` and
`qa/b4ui-*.js` — job-3 artefacts that the second run had not written. `git log --all` then
showed six unfamiliar commits sitting *underneath* its own.

**Why:** a handover file is written LAST. It is the one artefact a live run has not got
round to, so it is the worst possible thing to use as a "has this been done" check.

**How to apply:**
- Before starting any batch, `git log --oneline -40 | grep -i "<batch name>"` for commits
  from THIS batch, not just the handover file. If a peer's commits are there, read them.
- `ListAgents` shows peer sessions. `capy3-f3` had been running eight hours; one call would
  have answered it.
- **Never `git add -A` in a shared tree.** It swept `src/monaco.js` — an unfinished
  chapter-18 draft the other session had left untracked — into a commit. Explicit paths
  only.
- A batch that overruns does not delay its successor, it collides with it. The CHAINING
  rule in `qa/PAYOFF-PROMPTS.md` guards the chain but not a re-fire of the same batch.

**It was not a total loss:** the first run measured job 2 and deliberately declined it; the
second did the part that was waste rather than content, and the two analyses agreeing from
independent measurements is worth something on its own. See
[[capy3-payoff-batch-four]] and [[headless-qa-harness]].

---

## It happened again, 27 Aug 2026 — and mtimes answered it in one call

The `c` scheduled task fired `run qa/BATCH8.md` at **09:20:39**. `qa/BATCH8.md` had been
written at **09:18:28** — two minutes earlier, by a run that had just finished it.

**What worked this time**, and it is cheaper than the subagent-inventory route above:

    date; ls -lt --time-style=+"%H:%M:%S" <handover file> CONTRACT.md src/*.js
    git log --oneline -40 | grep -i "<batch name>"      # commits from THIS batch, not the file
    ls -l .git/index .git/index.lock                    # is a peer mid-commit?

Three facts settle it: the handover file's mtime vs now, whether a commit for the batch
exists, and whether any git operation is in flight. Batch 8 was complete in the tree and
**had no commit at all** — the previous run stopped one step short.

**Verify read-only before re-running anything.** Grepping the six claimed fixes out of `src/`
and running `node build.mjs` (writes only to gitignored `dist/`) confirmed the log was true
and the tree was consistent, without opening a browser. Do not re-run the QA suites to check
a peer's numbers: `playwright-cli close-all` from either side kills the other's browsers.

**Peers can be plural and live.** Twelve hours later, three interactive sessions were working
this tree at once, writing `qa/mv-*.js` and `qa/vis-*.js`. A file that appeared **four seconds**
before a status call is somebody's live work. Commit by explicit path, diff the staged list,
and leave everything you did not measure alone — the rule from the first incident holds and is
what kept those five files out of `0c2255c`.

**Precedent lives in `git ls-files`, not in judgement.** Whether the `qa/b8-*.js` probes
belonged in the commit was answered by `git ls-files qa/ | grep -cE 'b4|b5|b6|b7'` → 178
tracked, and `*-before.json` differential artefacts tracked too.

## IT HAPPENED AGAIN, 6 Sep 2026 — AND THIS TIME MID-EDIT

Two sessions took `ROADMAP-AUDIO.md` batch S1 (the mover) in the same tree at the same
time. The peer committed `6f04afd "A1+A2: the mover, and the fun review"` at 23:20:20,
**eleven minutes before** this run's `5c010c5`, and its commit swept up this run's
in-flight `src/environment.js` and `src/systems.js` — my van and my mover — because
`git add -A` cannot tell whose uncommitted work it is staging. Its commit message then
described that code as its own, and got a detail wrong (`outboard`, a recipe that does
not exist; it is a word in two unrelated UI comments).

**The tree stayed coherent by luck of tooling, not by design.** The Edit tool matches an
exact anchor, so an edit written against a stale read fails loudly instead of clobbering.
`node --check`, `qa/xmodule.mjs` (name collisions) and the build's "no collisions" line
all passed, and the final state has exactly one `sfxMover`, one `sysMoverTick`, one call
site and one ten-row recipe table. Two sessions writing whole files instead of anchored
edits would have lost work silently.

**Three checks that would each have caught it in under a minute, none of which was run:**
- `git log --oneline -5` immediately BEFORE committing, not just at session start. The
  peer commit was already there.
- `git status --short` before `git add -A`, and read the list. A file you never touched
  in the staging list — here `ROADMAP-FUN.md` — is the tell, and it is the reason this
  was caught at all.
- `ListAgents` before starting a roadmap batch.

**How to apply:** on this repo, treat `git add -A` as unsafe. Stage the paths you actually
edited by name. And re-run `git log --oneline -5` as the last step before committing —
orienting once at the start of a session is not enough when a peer is live.
