# ROADMAP-LIFT10 — the picture and the purse (19 Sep 2026)

Written after a deep visual review of all nineteen chapters (a live-camera
sweep, `qa/vr-sweep.js`, arrival + run + orbit frames and per-chapter
metrics — bins, ambient motion, light rigs, triangle counts) plus two
things the player asked for directly, quoted where they anchor an item:
the moment of picking up a yuzu or power-up needs to read as a bigger
deal than it does today, and the shop is still hard for a new player to
find on the minimap even after LIFT9 gave it a mark. Two items, both
additive to systems already in the tree — no new mechanic, no new asset
pipeline.

## What the review found, said once

- **The pickup already has four layers of juice (`dropCollect`,
  `systems.js:43914`) — the ladder, the burst, the flight-in, the
  count-up — and every one of them is the SAME SIZE regardless of what
  was picked up.** A golden yuzu gets a second sound and a flash
  (`yuzuFlash`, `:44036`); nothing gets a shake, a lens punch or a
  freeze, and the game already has exactly that primitive one call away
  — `punch(a, freeze)` (`:36426`, "the one call for 'that landed'"),
  used today only by hard landings and the wheek. A pickup is currently
  the one high-frequency reward event in the whole game that never
  touches it.
- **The shop's minimap glyph has no legend entry.** `mapLegendRows`
  (`:26630`) documents five landmark shapes — triangle, boat, ring,
  leaf, faint dot — built for M6 in LIFT9. The shop's coin-and-ring
  glyph (`:27330`–`27373`, LIFT9 S3) shipped after the legend was
  written and was never added to it, so the one UI surface built to
  teach a new player what the marks mean stays silent about the newest
  one. `qa/l9-shop-map-poor-zoom.png` (this session, teleported to the
  shop's own position) shows why that matters at a glance: the coin is
  the same dark ink as the triangle landmark six pixels to its left, and
  the affordance that is supposed to set it apart — the pulse — is off
  by design whenever the wallet can't afford the cheapest row, which is
  the exact moment a new player is standing there wondering what it is.
- **The sweep's own numbers name where a global "juice" pass would read
  as most different from most static**: five chapters move less than a
  tenth of their own frame at rest with the camera still and the world
  otherwise live (Iceland 4.2%, Monaco 6.3%, Drift 6.9%, Kyoto 7.1%,
  Goreme 10.3%, `qa/vr-sweep.json.png`) against Hanoi's 78.6% and
  Palawan's 44%. Not this roadmap's scope to fix — named here because a
  louder pickup effect will read loudest in exactly the chapters that
  need it least (Hanoi, Quay) unless it scales with how busy the frame
  already is, which is the same lesson THE SECOND BEAUTY PASS learned
  about the bounce term ("one gain could not serve both ends").

## The two features

### J — THE PICKUP, FELT

*Player: "The visual and audio juice for collecting a yuzu or power-up
needs to also be much more enjoyable and noticeable for the player."*

1. **Scale the existing four layers by worth, not just by golden/not.**
   `dropCollect` already computes `worth` before any of the juice fires
   (`:43931`) — thread it through as a 0..1 `mag = clamp(worth /
   sysDROP_MAG_REF, 0, 1)` and multiply the spark counts, the aura's
   after-flash radius and the flight peak scale by `0.7 + 0.5*mag`
   instead of the current binary `golden ? … : …` ternaries at
   `:43945–43948`. A plain yuzu stays exactly what it is today at the
   low end of the range — this is additive at the top, not a re-tune of
   the baseline.
2. **A punch, gated on worth, not on every pickup.** One call,
   `punch(clamp(mag * sysDROP_PUNCH_K, 0, sysPUNCH_MIN * 1.4), false)`,
   right after the existing `if (golden) { … yuzuFlash(); … }` block
   (`:43950–43955`). `sysPUNCH_MIN` already floors out anything too small to
   read as a dropped frame (see punch's own doc comment, `:36411`), so a
   single plain yuzu picked up alone is very unlikely to cross it — the
   run-ladder (`yuzuLadderStep`, `:43847`) already tracks a same-second
   streak, so the punch can additionally scale with `run.n`, meaning a
   fast run of five reads as an escalating series of little hits, which
   is the "noticeable" the player asked for, not a constant added tax on
   every single fruit.
3. **A worth-scaled wallet bump.** `.capyui-wallet.bump`
   (`systems.js:9418`, the CSS keyframe) is one fixed animation today —
   add a `.big` modifier class (toggled alongside `.bump`, cleared on
   the same timeout) with a taller overshoot, applied when `mag` crosses
   a threshold, so the number itself sells a big pickup even for a
   player looking at the corner of the screen rather than the fruit.
4. **Respect the room already built for this.** `shake()` already
   refuses under `sysCalmOn()` (`:36402`) and `yuzuFlash`'s own CSS was
   the LIFT9 C3 fix for exactly this class of miss (`.capy-calm
   .capyui-yzflash{opacity:0 !important}`, `:10140`) — a new punch call
   inherits the guard for free through `punch()` itself; the new bump
   class must be added to the SAME calm-mode rule block, not a new one,
   or it repeats the bug C3 already closed once.
5. **Instrument:** `qa/l10-pickup-juice.js` — spawn one of each drop
   kind in Sydney, read `game.shakeNow()` and the wallet element's class
   list synchronously after `dropCollect` fires, confirm the scaling
   ladder (plain < twin < rolling < golden) is monotonic and that a calm
   toggle zeroes every added channel, not just the pre-existing flash.

### Z — THE SHOP, UNMISTAKABLE

*Player: "The shop to purchase upgrades with yuzu needs to be more
clearly marked or obvious for the player in the minimap (some of the
markings are not user-friendly or clear to someone who is new to the
game)."*

LIFT9's S landed the fixture and M6's legend; this closes the gap
between them rather than redoing either.

1. **Add the shop to `mapLegendRows` (`systems.js:26630`).** A sixth
   row, `{ shape: 'coin', color: sysHex(PALETTE.yuzuGold), label:
   'the shop' }`, with a `.capyui-mlswatch-coin` CSS rule next to the
   other four swatch shapes — the legend was built to be read once and
   remembered; right now it teaches four shapes that were never the
   question and stays silent on the one glyph that's new enough to
   need it.
2. **Decouple the glyph's legibility from affordability.** The shop
   mark's only visual distinction from the door and the landmark
   triangles today is a pulse that is specifically OFF when the wallet
   can't afford the cheapest row (`shopPr = shopAfford ? mapPulse(0.8) :
   0`, `:27353`) — correct as a "worth a detour" signal, wrong as the
   ONLY signal, because a brand-new player with 8 yuzu (this session's
   own arrival screenshot) can't afford anything and sees a plain dark
   dot. Give the coin a **standing** visual identity independent of the
   pulse — the gold ring it already draws at `:27358` stays gold at
   all times rather than reading as part of the pulse math, and the
   base disc radius goes from flat `2.8 * u` to a fraction bigger than
   the door's own dot so it doesn't camouflage against the landmark
   triangles at `qa/l9-shop-map-poor-zoom.png`'s resolution.
3. **First-visit callout, once, biome-neutral.** The paper already has
   the pattern for this (`sysSHOP_ID = '__shop'`, `dropFirstPillSaid`
   style one-shot toasts) — fire `mapBadge('the shop: ' + shopHint)`
   (the corner badge M6 already renders scaffolding for) the first time
   `shopWhere()` resolves in a session, so a new player is told once,
   unambiguously, in words, rather than asked to infer a glyph from a
   legend they may not have hovered.
4. **Instrument:** `qa/l10-shop-legend.js` — assert the legend DOM has
   six rows not five, assert the shop dot's rendered alpha/size at
   0 yuzu vs at an affordable balance are within a small tolerance of
   each other (the standing identity, not just the pulse), and that the
   first-visit badge fires exactly once per session across a biome
   change and a reload.

## Held (named, not built)

The review's six global beauty/depth ideas, not part of either player
ask above and not sized this pass: a shared low ambient-motion floor for
the five chapters that measured under 10% frame motion at rest (Iceland,
Monaco, Drift, Kyoto, Goreme); a second depth layer glimpsed past the
near geometry in the three chapters that measured the flattest reads
(the cave's arrival bin was **100% near, 0% everywhere else** —
`qa/vr-sweep.json.png` — worse than any other chapter measured; Kyoto's
lane and Sahara's plaza follow it); a third, narrowly-scoped colour pass
on just Kyoto/Pantanal/Sahara, the three that still read greyest after
the second beauty pass; a brief held establishing beat on arrival for
the four highest-scoring set-pieces (Rio, Palawan, Goreme, Hanoi) so the
game's own best compositions get looked at; an up-sized atmospheric
mote/dust layer specifically for the landscape chapters that read
static where the crowd chapters read alive; and pointing the five flat
chapters' arrival cameras a few degrees toward their one existing far
landmark rather than dead ahead, which is camera work, not new art.

## Rules for every agent

- `punch()`, `shake()` and the calm-mode gates are load-bearing and
  already correct — route new juice through them, never re-implement.
- The shop legend and glyph both live in the same ~150-line region of
  `mapDraw`/its setup as M6/M7 did — one agent, not two, or sequence
  strictly.
- No new save key for either item; J reads `worth`/`dropKind` already on
  the prop, Z reads `shopWhere()`/`jrYuzu` already published.
- Stage by name, never `git add -A`; do not run `playwright-cli
  close-all` while another agent may hold a session.
