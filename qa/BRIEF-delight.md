# BRIEF — the Delight Pass

Measured 24 Aug 2026 against the shipped build, the session after chapters 16
and 17 got the upward camera and the climbable Hand.

---

## What a delight is, in this game

The nineteen versions so far have built every channel that TELLS the player
something: the paper, the arrow, the beacon, the distance, the banner, the
moment card, the ceremony, the souvenir, the ledger. Delight is the opposite
half — the game turning out to have noticed something you did for your own
reasons, with no card, no arrow and no number in front of it.

There is exactly one system in the game for that, and it is the finds. It is
also the only one that was shipped half-built.

## The measured gap

**All twenty finds are chapter-neutral, and the place half of the design was
never written.** The design comment above `FINDS` in shared.js reserves two
fields for it, in writing:

> `where` is the line the ledger prints under the place it happened. `chapter`
> is 0 for the ones that can happen anywhere and a number for the ones that
> belong to a place.

Neither field appears on a single one of the twenty rows, and neither string
appears anywhere in systems.js: `FINDS[i].chapter` and `FINDS[i].where` are
never read. `findTick` sweeps all twenty predicates in every chapter, and every
one of them is a question about the MOVESET or the CLOCK — diving, climbing,
cold, breath, stillness, distance walked, people watching, highest ground, far
corner, long drop.

The consequence, stated plainly: **seventeen dense hand-built worlds and not one
secret belongs to any of them.** A player who notices something in Venice is
shown the identical sentence they were shown in Iceland. The generic twenty are
good and they stay — but "Stood on the highest ground there is here" is a fact
about a heightfield, and this game's worlds are not heightfields.

Two supporting numbers, both from the same read:

- `qa/audit-tasks.mjs` enforces four things about finds and none of them is
  about place, because place did not exist.
- The ledger already groups a find under the chapter it happened in
  (`findWhere`), and already gives them a line of their own
  (`capyui-ledfind`) — so the whole presentation half is built and waiting.

## The ask

### Stage A — the engine (one small change, in two files)

1. `chapter: n` on a FINDS row means the predicate is only swept in chapter `n`.
   This is a saving as well as a feature: the alternative is ~40 predicates
   evaluated four times a second in all seventeen places.
2. `where` is an optional ledger line, used only where the toast reads wrong
   under a place name.
3. Extend `qa/audit-tasks.mjs`: a `chapter` must be 0..17, a place find must
   have a predicate that its own chapter can actually reach, and the existing
   four checks must keep passing. **Watch the parse** — the audit's regex is
   `id` immediately followed by `text`, so any new field goes AFTER `text`.

### Stage B — the content

One or two place finds per chapter. The rule that made the sixteen backlog
tasks cheap is the rule here too: **use something the chapter has already drawn
and never asked about.** A find may not need new geometry to be a find, and the
best ones are a question about a place the player was already standing in.

The three rules in shared.js are law and none of them bends for a place find:
nothing is listed, nothing can be missed, nothing is blocked by one.

And one more that is specific to Stage B: **a place find may not be a task with
the paper taken away.** If it can be described as an objective it is a task. The
test is whether a player could plausibly do it without ever knowing it was
there.

## Hard constraints

- **CONTRACT.md is law.** Read it first. One module per file, every top-level
  name prefixed with the module tag, `mat()` only, colours from `PALETTE`.
- **Nothing in `findTick` may allocate.** It is the cheapest thing in the game
  and forty rows swept four times a second is where that stops being true.
- **Do not add tasks.** Chapter registration is fourteen places.
- **Do not change a published biome API** without checking every reader.
- Predicates must be robust to a missing API: `findTick` swallows a throw per
  predicate, which means a broken find is a SILENT find. Prove each one fires.

## Traps
1. The audit's FINDS regex needs `id` then `text` adjacent (above).
2. `findS` is wiped on every chapter change — a place find's accumulator is
   safe, but it cannot span a departure.
3. `localStorage["capy3.journey.v1"]` persists finds across a reload, so every
   find asserted in an earlier QA run reads back true for ever. Clear it in an
   init script before any run that asserts on a find.
4. A find is awarded once, ever, for the whole journey — so a place find that
   is reachable in two chapters is a bug, not a bonus.

## Verification protocol
Headless harness (`headless-qa-harness` in memory), `PORT=5188 node server.mjs`,
`playwright-cli -s=capy`. Every find must be proven to FIRE, by teleporting the
animal to the place and driving the state — a find that throws is indistinguishable
from a find that is simply not met.

Re-run `node qa/audit-tasks.mjs`, `qa/fuzz.js`, `qa/pointers.js`, and the
frame-time probe `qa/cc-perf17.js` — **16.3–16.7 ms median / ≤20 ms p95 band**.
`playwright-cli close-all` at the end.
