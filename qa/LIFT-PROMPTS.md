# THE LIFT PASS — the brief, and the four prompts

Written 26 Aug 2026, on `claude-opus-5`, from a design read of the finished nineteen-chapter
game. Predecessor: the Payoff Pass (`qa/BATCH1.md` … `qa/BATCH4.md`, `qa/CLOSEOUT.md`).

## What this pass is for

The Payoff Pass finished the game. Nineteen worlds, 229 tasks, 58 finds, 53 records, six to
eight hours, every chapter in the pacing band. Nothing on this pass is a repair of that work.

The argument is one sentence: **the moveset, the camera and the consequences all stopped
travelling.** Each is locked inside the chapter that invented it, so the game is measurably
poorer at hour six than the same nineteen worlds would allow. The dive already had this shape
and was already fixed by making it a property of the world instead of a property of a
chapter — three chapters became twelve. Everything below is that same move, applied to the
three things still waiting for it, plus the two cheap surfaces that make them legible.

## The five findings, measured

All numbers taken from the running game under `playwright-cli`, real keys, real clock, from a
cleared save. Never read off the source.

| | finding | measured |
|---|---|---|
| **P1** | The climb never left Hong Kong | 3 of 19 chapters publish `climbHold`. Climbable ground plan **150 m² · 528 m² · 1,157 m²**, and **0 m² in the other sixteen** — 0.12% of the game. `sysCLIMB_TAUGHT = {11,13,16}` is the same set, so the find `brought-climb` is **unreachable by construction** |
| **P2** | The default camera cannot see the horizon | idle pitch **42.8°** vs half-FOV **24.0°** → horizon **18.8° above the top edge**. Walking 38.3/25.6 → 12.7. Full run 35.6/26.9 → **8.7°**. In no state of ordinary play is the horizon in frame |
| **P3** | Mischief does not accumulate | one wheek: `state.chaos` **0 → 0.21**, back to **0.07 in 8.7 s**. Readers repo-wide: **a music gain and the calm counter**. Failable tasks: **2 of 229** |
| **P4** | The mastery layer is invisible while in use | 53 records, announced **only after the run** and **only if it beat a previous one**. ~20 are timed or measured runs with no live target |
| **P5** | The arrival is a shot and is not framed | `frameShot` frames the marquee. The arrival is the only shot every player is guaranteed to see. `yaw` is set on **5 of 19** spawns |

## The four batches

Ordered. The order is not a preference — batch 5 retakes every picture in the game and batch
7 perturbs the NPCs every earlier batch measures against, so running them out of order means
nothing downstream can be attributed to anything.

| batch | what | why it is its own run |
|---|---|---|
| **5** | the instruments, then the lens, then the wall (P2, P1) | both change how the player perceives and traverses, both are verified by PNG, and the camera must land first or the baseline is shot twice |
| **6** | the two shallow sweeps (P4, P5) | many small edits across biome files, neither can break the other, both verified by a table; P5 needs batch 5's camera settled |
| **7** | escalation (P3) | the only one with real design uncertainty, the only one that touches `npc.js`, and it moves the background everything else was measured against |
| **8** | the independent per-chapter list | none of it touches the shared controller, so it contends with nothing and may run at any time |

**Not scheduled, and deliberately:** Monte Carlo's climb, Monte Carlo's arrival, Cali's and
Rio's beat counters, Iceland's aurora. Every one of them falls out of batch 5 or 6 for free.
That is the whole argument for doing these as systems rather than as nineteen pieces of
content — if any of them still needs hand-work afterwards, the system was built wrong.

## The prompts

One line each. Each batch file is self-contained: a cold session needs the file, the harness
memory and nothing else.

```
run qa/BATCH5.md
```
```
run qa/BATCH6.md
```
```
run qa/BATCH7.md
```
```
run qa/BATCH8.md
```

## The rules every batch keeps

Carried forward from the Payoff Pass because all four were paid for at least once.

1. **Prove a fix with a differential, never with a single green run.** `git stash push -- src/x.js`,
   `node build.mjs`, re-open, run the *same* clean script, `git stash pop`. It is the only thing
   that separates "my fix works" from "this was never broken".
2. **Derive a chapter count, never spell it.** Six audits carried a hard-coded 17 for a
   fortnight after chapters 18-19 shipped and every one printed a confident `17/17`.
   `qa/route.js` still carries a hard-coded list of **eight**. See batch 5, job 1.
3. **A green run from an instrument nobody has checked is worth less than no run**, because it
   is believed. Check the instrument before you believe the number, and remember that a stale
   audit does not merely fail to find things — **it invents them**, and the invented ones cost
   most because they look urgent.
4. **A number says the subject is present. Only the PNG says the shot is good.** Every framing
   claim in this pass is settled from the rendered picture.
5. **Nothing may be gated, nothing may be denied, nothing may be lost.** This is a game about
   being a nuisance and it must never become an exam. P3 in particular is escalation, not
   failure — see batch 7.

## Finishing a batch

Every batch ends the same way, and a batch that skips this is not finished:

- [ ] Full regression: every suite in `qa/`, plus one fresh-save run through the affected chapters
- [ ] The batch file's own Log section written — **found vs fixed**, with what was declined and why
- [ ] `CONTRACT.md` new version section
- [ ] Project memory updated
- [ ] `playwright-cli close-all`

Record an open finding as open. Do not fake it, do not round it up, and do not re-litigate
something a previous pass declined — restate it.
