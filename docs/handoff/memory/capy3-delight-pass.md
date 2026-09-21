---
name: capy3-delight-pass
description: "The twelve-item Delight Pass plan and what all four waves shipped on 24 Aug 2026"
metadata:
  node_type: memory
  type: project
  originSessionId: 18cecc6b-fef3-4b34-a694-a790339ba977
  modified: 2026-08-24T12:01:59.498Z
---

A five-pillar audit of capy3 on 24 Aug 2026 produced twelve ranked no-regret opportunities,
published as an artifact ("The Delight Pass") and sequenced into four waves. **All four are
now built.** Waves 1-2 are `15d4ac3` (CONTRACT.md §v21); waves 3-4 followed in the same
day (CONTRACT.md §"THE DELIGHT PASS, WAVES THREE AND FOUR (v22)").

**The theme of waves 1-2 was code written and never wired. The theme of waves 3-4 was
NUMBERS WRITTEN AND NEVER READ** — a mayhem input (`state.chaos`) with nothing on the other
end, seventeen `weather.label()` names with zero call sites, ~110 locals welded to a
coordinate, 614 sfx call sites with no room to be in, and 114k lines about a capybara in
which nothing could eat anything.

**What wave 3-4 shipped, one line each:**
- `game.calm(x,z)` + `game.addCritter` (five chapters adopted) + `musCalm` on the same three
  music writers as `musIntensity`, in the opposite direction + the ambience clock stretches.
- Locals shuffle (0.55 m from their own anchor, never from where they got to), `fam` as the
  positive twin of `wary`, `localsChat` (chatStep's twin for the fixed-point shape), and
  `after:`/`before:` lines in the four chapters that had none. 426 conditional lines now.
- One ConvolverNode on a wet send off a new sfx bus (`sysROOMS`, per chapter, IR regenerated
  on the border) and `sysAmb()` giving all 96 ambience calls a bearing.
- `physKEEPS`: the seventeen souvenirs as real props with `biome: ''`, added through the
  loose hatch, always solo, relocated to the arrival spawn on every crossing.
- The postcard: photo mode on K, Enter saves a PNG, caption built from `weather.label()`.
- The graze: `edible` on eight prop types, four bites, `physHide` + restock, no new button.

**Four traps this pass paid for, all of which generalise:**
1. **`capyStillT` is zeroed by `heldProp`** and that is CORRECT for the soft wheek. Reading it
   for anything else collapses the moment you pick something up. `capyRestT` is the same list
   minus that entry. Two names because they are two questions.
2. **A fixed-point radius must be MEASURED against the actual world before it is chosen.**
   `npcLOC_CHAT_R` at 4.6 m (the honest conversational distance) made the feature exist in
   3 chapters of 15. At 13 m it exists in 12. The closest-pair-per-chapter table is in the
   contract; three chapters will never fire and those three are the right three.
3. **`renderer.info` counts are meaningless with a post chain unless you control
   `autoReset`.** Every `render()` resets them, so a naive read after a frame returns the
   composite quad: 1 call, 1 triangle. Measure with `autoReset = false`, shadow map off, one
   explicit `renderer.render(scene, camera)`.
4. **A relocated prop's `homeX/Y/Z` must move with it**, or `physRescue` returns it to a
   point in a chapter it left — which, in shared coordinate space, is inside something.

**And one standing item this pass measured but did not cause:** the 130k triangle budget in
CONTRACT is exceeded in the BASE build by five chapters (Pantanal 207,072 · Drift 201,886 ·
Antarctica 179,788 · Quay 132,423 · Kowloon 130,390). Seventeen keepsakes add 1,612-2,388
(under 1.2%). Frame time is still a locked 60 everywhere. Do not "fix" this by deleting
content from wave 4; it needs its own reallocation pass, of the kind Palawan and Marrakech
already had.

**The one wave-1 item that still has not landed its intent:** a gust cannot blow a prop
across a square with drag alone — a stiction cliff with no band between its sides, because a
prop's terminal velocity under drag IS the wind speed. Needs a turbulent kick plus a speed
cap. Design task, numbers in the contract.

Related: [[headless-qa-harness]], [[capy3-finds-belong-to-a-place]], [[capy3-the-backlog-closed]],
[[capy3-things-that-are-simply-there]], [[capy3-the-locals]], [[capy3-controls-one-voice]]
