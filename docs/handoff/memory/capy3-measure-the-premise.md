---
name: capy3-measure-the-premise
description: "B3 of ROADMAP-FUN, and the standing rule the fun pass produced: five of that document's claims failed on measurement"
metadata: 
  node_type: memory
  type: project
  originSessionId: 0399a747-7207-4778-9720-3ffe4ce144bc
  modified: 2026-09-07T02:01:26.428Z
---

**B3, 7 Sep 2026** (`ecec89c`). Items 1e and half of 1d.

**THE RULE THIS PASS PRODUCED. `ROADMAP-FUN.md` was written from a reading of
the systems, not from measurement — it says so at the top — and FIVE of its
claims have now been checked and failed:**

1. "the `wow` sits in act 2 or 3 in at least fifteen" — it is **eighteen**.
2. "none of those clocks is phased to your arrival" — **all five are**, each in
   its own `onEnter()`, 32–81 s after landing (sooner than the item's target).
3. "there is no stuck timer anywhere" — `sysNUDGE_T`, 150 s, banked, has been
   one since F4.
4. "the chart marks landmarks but not the marquee" — the chart's nearest mark
   to the marquee is **0.0 m in thirteen of nineteen chapters**, 30 m in
   sixteen. (And `sysMARKS` is the TITLE PICKER's postcards; the chart is
   `sysMAP_WORLDS[biome].marks`.)
5. "give each of the 32 minis a chart mark" — there are **30**, and **26 are
   already inside 40 m of an existing mark, sixteen at 0.0 m**, where the mark
   IS the mini under another name.

**Measure the premise before building the item.** Corrections go IN PLACE in
the roadmap, struck through rather than deleted, so a later batch inherits the
correction and not the guess.

**What B3 shipped instead.**

  - **The ring.** Every chart mark is drawn the same, so the chart said WHERE
    the interesting places are and never WHICH ONE THE CHAPTER IS FOR. One ring
    round one mark per chart (`marqChartPoint`), with a triangle inside it in
    the six chapters whose nearest mark is 20–52 m off, and gone the moment the
    marquee is ticked. A ring and not a seventh shape: the chart already spends
    five on landmarks and a sixth on the door, and a seventh would need a
    legend. `mapMarkAudit()` returns resolved `pts` now — it could say whether a
    mark resolves and nothing about where it ended up, which is why 1e's
    premise had never been checkable.
  - **`game.sayNear(x, z, r, text)`, in npc.js.** The 150 s nudge is said by the
    nearest person instead of toasted.

**THE TRAP, AND IT IS THE MOST REUSABLE THING HERE. A FIELD THAT EXISTS ON ONE
OF A MODULE'S COLLECTIONS DOES NOT EXIST ON THE OTHERS.** The first cut of the
spoken nudge lived in systems.js and filtered `game.npcs` with npc.js's own
`r.biome !== live || !r.fig` test. **Both halves reject every record**:
`game.npcs` entries carry neither field — those belong to `locals`, a different
array of a different shape whose voice hangs off `anchor` because a fixed local
has no head node. The gate was dead in all nineteen chapters and the toast fell
through every time, which looks exactly like a feature that works. **The tell
was a probe reporting `people: 0` in Sydney, which has thirty-eight.** The fix
is not a better filter — it is that the question belongs to the module that owns
the collections. npc.js keeps its people in `humans`, `paHumans` and `locals`,
and only npc.js knows which is which.

Also: `sayNear` refuses animals (the six ibises in `game.npcs` publish a `speak`
that is a comment — *'bin chickens do not speak. they judge.'* — and a no-op
would swallow the line in silence), refuses `talkCd`, refuses a chapter you have
left, and makes the speaker look at you. The toast stays as the fallback and is
not a lesser one: Sơn Đoòng has nobody in it at all.

`lead:` deferred: the acts already order every chapter toward its marquee, and a
second ordering system on top is two writers of one decision.

Related: [[capy3-the-glimpse]], [[capy3-what-the-place-is-for]],
[[capy3-pasto-by-name]], [[capy3-names-nothing-publishes]], [[capy3-the-fun-review]]
