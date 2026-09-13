# qa/

Two different things used to live in one directory, and nothing said which was
which.

## The suite — `node qa/run.mjs`, which is `npm test`

Eleven static checks that need no browser. Nine of them ASSERT: they exit
non-zero and can turn the build red. Two REPORT: they print an inventory that
has no right answer and deliberately cannot fail anything. `run.mjs`'s own
header says which is which and why each one is on the side it is on.

Everything the suite runs is a `.mjs` or a `.cjs` at this level.

## The instruments — re-runnable, and named by something

Browser probes at this level are ones that a document, a skill, `package.json`
or a static audit actually points at. They are meant to be run again:

    node server.mjs                                   # port 5188
    playwright-cli -s=x open http://localhost:5188/
    playwright-cli -s=x run-code --filename=qa/fuzz.js

The ones worth knowing about: `fuzz.js` (random-input soak per biome — NaN,
void falls, solver saves), `npchealth.js` (states visited and distance
travelled per NPC), `props.js` (props under the terrain or asleep in mid-air),
`pointers.js` (every task the card cannot point at), `audio2.js` (real keys and
a real clock, so the score and the ambience are actually running), `kine.js`
(kinematic bodies moving with zero velocity), `gag-ring.js` (what
`p8-spawn.cjs` says to check before believing it), `r10-soak.js` (the R10
shipping soak, by hand). `npm run soak` is `soak.mjs` (L6): it opens
playwright itself, runs `fuzz.js`, `l4-ks.js` and `l6-load.js`, appends one
line per run to `soak-history.jsonl` and then runs `soak-diff.mjs`, which
fails on any column that moved more than 30 % against the last three rows.

`nr-travel.js` is item 5, customs. It is the file that found the dead
confiscation: props.js has a carefully-argued block for a held prop at the
border and `biomeGo` empties the mouth before `switchTo`, so it had never once
run. Read its header before touching anything about carrying a prop between
chapters.

`nr-err.js` is item 4, the standing order. It seeds a regular's TIER through the
save file and drives one errand end to end. Its header carries the two
measurement traps that cost the most: `wary` decays over 26 s so it must be read
either side of the delivery rather than either side of the run, and heat is
bumped by anything banging nearby so it must be read on the two ADJACENT frames.

`nr-verbs.js` and `nr-pairs.js` are item 2. The first MEASURES THE PREMISE and
half of it was wrong — hop-then-grab and grab-then-slide already work — and the
second checks the reactions that were built instead. Between them they record
four separate ways a movement probe lies: a camera-relative key is not a
direction, a local is a solid body you will run into, Shift and G are wrapped by
one latch, and a chapter made of cliffs leaves the animal wedged for the next
run.

`nr-march.js` is item 3, push your luck: it builds a chain out of stamped props
and watches somebody walk over about it. Read its header before writing any
probe about a local who is supposed to be walking somewhere — three separate
wrong answers came out of it, and the last one (`gave up: gesturing` two metres
short) was a real defect the probe found rather than a probe fault.

`nr-noto.js` is item 6, the reputation that arrives before you do: it seeds a
tier through the SAVE FILE and restores, because a played tier 3 is twenty
minutes of trouble a row. Its header is the record of two traps — `addInitScript`
persists per browser context, and a LIVE game overwrites a seeded save with its
own counts before you can reload onto it.

`nr-look.js`, `nr-keep.js`, `nr-led.js` and `nr-soak.js` are the no-regret
batch: the flow look and its hold (`npcFLOW_LOOK`/`npcFLOW_HOLD`), customs
(`npcKeepStep`), the longest line on the ledger (`jrChapLine`), and the
nineteen-chapter soak that covers all three. `nr-look.js`'s header is worth
reading before writing any probe about npc attention — it measures the RADIUS
rather than the population, and it says why the two obvious instruments both
gave confident wrong answers first.

Three of them do not hold a line and CONTRACT.md says by how much:
`audit-solid.js`, `stillness.js` and `budget.js` move on their own between two
runs with nothing changed. Read their numbers as a range, never as a value.

`rv-geom.js` and `rv-cmp.cjs` are the geometry differential: they fingerprint
every merged batch in all nineteen chapters under a seeded `Math.random` and
compare a run against a baseline. That is what proved the merger consolidation
changed no pixels. `rv-cmp.cjs`'s header explains the noise floor and why a
single red run has to be re-run before it is believed.

## `qa/probes/` — one-shots from a batch that is over

1396 scripts, and the rule that put them there is: **nothing in the repository
names this file.** Not the runner, not `package.json`, not a document at the
root, not a skill, not another audit. Each was written to answer one question
during one session, it answered it, and the answer is in a commit message or a
roadmap or CONTRACT.md.

They are kept rather than deleted because a probe that measured something once
is the cheapest possible starting point for measuring it again, and `git log
--follow` still reaches every one of them. But they are not maintained, most of
them assume a world that has since moved, and none of them runs as part of
anything.

**If you write a probe and it turns out to be worth keeping, name it somewhere
— that is the whole rule, and it is what decides where the next sort puts it.**

## Captures

`qa/**/*.png` is gitignored at every depth, which includes the JSON that
`server.mjs`'s `/shot` sink writes with a forced `.png` suffix. Nothing in
`qa/` that a probe produces is the repository's problem.
