# ROADMAP-LIFT8 — the loop (17 Sep 2026)

The brief, an eighth time, and a different one: not another lift of what is
there but a REASON TO KEEP GOING. Two hundred and fifty-six rows tick, nineteen
places open, and nothing the animal does in one place changes what it can do in
the next. The ask: rewards for doing things, a place to spend them, upgrades
that are felt, cosmetics that do something, and a chaotic element per biome —
power-ups that turn up on a timer with the minimap saying where.

Everything below is anchored to what is already in the tree, because the tree
already has most of the substrate and none of the loop. Every item carries a
file:line, a number to hit, and an instrument. Six features, three waves.

## What the tree already has, said once

- **A stamina bar, and breath is the same bar.** `capyStam` with
  `capySTAM_DRAIN 0.100` (ten seconds of sprint), `_HOP 0.11`, `_REGEN 0.265`,
  `_DELAY 0.55`, `_TIRED 0.90` (capybara.js:1969–1984); diving drains
  `capySTAM_BREATH 0.062`, the snorkel × 0.75 (:5613); the `lungs` skill × 0.71
  drain / × 1.45 regen (:5628–5632). Published as `capy.stamina`/`capy.blown`;
  drawn as "puff"/"breath" (systems.js:26828, :45769). **Every upgrade below is
  a multiplier on one of these, capped, stacked with the skill, never a new
  bar.**
- **The hop apex is 1.37 m and eighteen chapters were built to it**
  (capybara.js:2002–2006). Not for sale. Air control, coyote and grace are.
- **A wardrobe of ten** (`capyWardrobe`, capybara.js:3586; ids sunhat ferrycap
  plumes boater snorkel flycap surfcap cavehelm parka black-tie), earned by
  task (`sysWARDROBE` systems.js:32550), picked on the settings card
  (`wardBuild` :24202), resolved every frame (:43306). **One mechanical effect
  in the game** — the snorkel. The rest gate a find or a line.
- **A single tick event.** `completeTask` emits `task:complete {id}`
  (systems.js:33513) after paying by tier — `wow` (banner), `mini` (moment),
  plain (toast). Finds go through `foundFind` (:33233), not `completeTask`.
  Records through `recordValue` (:31854) with a `par` (shared.js:4336).
- **Somebody keeps turning up.** `addTraveller` (npc.js:3050), a `where()`,
  `game.travMet`, met at 3.2 m emitting `npc:travMet`; four cameos (quay,
  sahara, goreme, hanoi) and the finale; a pseudo-row on the paper
  (`sysTRAV_ID`, systems.js:7615) with a hint (:30296). **This is the shop.**
- **Thirty-eight prop kinds** (`physTYPES`, props.js:1335), eleven of them
  `edible`, spawned by `spawnProp(type, x, z, restY)`, grabbed with a
  `capy:grab {prop}` event (:3332), removed by `removeProp`. **Yuzu and the
  power-up food are both just new prop kinds with a timer on them.**
- **A capped, respawning pool already exists.** Monaco's plaques: max 6,
  `monPlaqueT 2.2` s refill (monaco.js:4256–4310). And a minutes-scale timer
  gated on the chapter being live: `wxFrontT`/`wxFrontPeriod rand(360,540)`
  (weather.js:752, :928). **The drops copy both.**
- **The minimap has no runtime mark API.** `sysMAP_WORLDS[biome].marks` is
  read straight from the static table (systems.js:7616, :26526); a moving
  mark is `{get:'boat'}` resolved at 12 Hz against `game[biome].boat`
  (:26363). The one overlay is the marquee ring (:26400). **The drops need a
  second overlay, twelve lines, beside the ring.**
- **The save is additive, `v` stays 1.** A new key is one row in
  `sysSAVE_SHAPE` (systems.js:4103) plus one clamped restore line in
  `startGame` (:35073–35177). `saveShapeOk` treats absent as fine.
- **There is no economy anywhere.** grep trade/shop/buy/coin/wallet/token:
  prose only. Monaco's chip stack is the one countable thing, and it is a
  record, not a currency.

The tone rule, from the front of the card: *it is taking one thing from every
place. it has not said why.* Nothing below is a coin with a dollar sign on
it. The animal collects YUZU — the one fruit the whole world already puts
next to a capybara — the traveller has a BAG, and the bag is where yuzu
become other things.

## The six features

### F1 · THE YUZU — five kinds of the same fruit, and the joy of picking one up
*A number that goes up when you do something, and is spent when you want
something.* The currency is **yuzu**: one integer, `jrYuzu`, one save key.
Five kinds, and every kind is still obviously the same fruit — a shape and a
colour, not a legend to learn — so the variety reads as "look, a good one"
rather than as a chart to memorise.

**The five.**

| kind | worth | looks | reads at | behaviour | odds |
|---|---|---|---|---|---|
| **a yuzu** | 1 (2 with THE KEEN EYE, F3) | a yellow ball, 0.20 m, a leaf, bobbing 4 cm at 0.8 Hz, a faint warm glow (`sysDrawShapes`, one build fn) | 25 m | sits still — the baseline | 36 % |
| **a rolling yuzu** | 3 (4) | the same fruit, one leaf missing, a faster bob | 30 m | nudged every 2.5–4 s (0.6–1.0 m/s, a random heading, softly tethered 3 m from its spawn — past that the nudge points home instead) — a small chase, never a flee, never faster than a walk | 20 % |
| **a golden yuzu** | 5 (6) | the same fruit in gold, 0.24 m, one sparkle every 0.6 s (`game.sparks`, 3 particles, rgb 1.6/1.3/0.5), the glow twice as wide | 45 m | sits still, grants GULL-PROOF (F4.3) | 17 % |
| **a twin yuzu** | 2 each (3), +4 bonus for taking both within 20 s | a linked pair, 4–8 m apart, a thin drift of pollen motes between them while both are live | 30 m | spawns only when BOTH drop slots are free (it fills them at once); taking the first starts the 20 s window and the second one's motes pulse | 13 % |
| **the yuzu bath** | 25 | a wooden tub, 1.2 m, steam rising, six yuzu floating in it, a lantern on the rim at night | 70 m, and on the map as a star | a ritual pickup — refills the stamina bar; at most one live in the world, at most one per chapter per ten minutes, never in the first two minutes | 4 % |

(The remaining 10 % of ground rolls are the chapter's own food — the boons
of F4. One pool, one timer; see F4 for the mechanics behind rolling, twin
and the bath's own refusal rules. The odds above are already tuned toward
the exciting tiers rather than a flat spread — a new player's first ten
minutes on the ground should feel generous, not like a slot machine that
mostly pays out lint.)

1. **Earned just for showing up.** THE FIRST LOOK: the first time a chapter
   is ever entered (`game.biome`'s own `enter` event, gated on this being
   the first frame `jrChapInc[n]` — or the existing `seen` bookkeeping,
   whichever the restore already trusts — reads 0 for this chapter) pays 8
   yuzu before the animal has done anything at all. `arrivedAt:'object'`,
   one bool per chapter, so a reload or a return visit never pays it twice.
   Nineteen chapters, 152 yuzu total, and it is the single most front-loaded
   row in the whole table: a curious player who spends their first hour
   hopping between chapters just to see them is earning the whole time,
   before they have found the bag or ticked a single task.
2. **Earned by tier, on the one event.** A listener on `task:complete`
   (systems.js:33513) pays by the row's tier: plain 3, `mini` 8, `wow` 20;
   `foundFind` (:33233) pays 2; `recordValue` (:31854) pays 5 the first time a
   record beats its `par`, 10 for a wow record; a chapter's keepsake
   (`chapterCeremony` :34612) pays 15; meeting the traveller (`npc:travMet`)
   pays 5 (up from an earlier 3 — he is often the first NPC a new arrival
   meets, and a slightly better first handshake is cheap and front-loads
   well), once per chapter.
3. **Earned in one lump, for finishing a place.** THE FULL PLATE: the
   moment a chapter's last task ticks (`chapComplete`, the same signal that
   fires `chapterCeremony`), a bonus pays BEFORE the keepsake's own 15 —
   `max(12, floor(taskCount(n) * 1.2))` (`tasksInChapter(n).length`, already
   read by the paper's own counter, :24840) — a twelve-task chapter pays 14,
   a twenty-task chapter pays 24, and the smallest chapters still pay a
   floor of 12 rather than a forgettable single digit. One formula, no
   per-chapter authored number, so it is right for a twentieth chapter
   without anybody remembering to add a row. Summed over the whole table
   (rows, records, keepsakes, full plates, one arrival and one traveller
   meeting per chapter) that is ~1 850 yuzu for a completionist and ~170 in
   the first hour — up from an earlier design's ~1 350/~120 specifically
   because the first hour is where the arrival bonus and the richer
   traveller payout both land. `qa/l8-yuzu.mjs` (static) prints the sum and
   fails outside 1 700–2 000.
4. **Earned by looking, not just doing.** The ground (F4's pool, the odds
   above, a 60–120 s refill per empty slot) averages ~3.7 yuzu per roll —
   the tiers were tuned toward the exciting end on purpose (F1's table
   note) so a plain one is still the MOST common thing but no longer the
   overwhelming majority of what turns up. Over an unhurried hour that is
   ~130–165 yuzu to a player who actually goes and gets them, ~45–60 to one
   who only grabs what's convenient on the way — the rows pay for DOING,
   the ground pays for LOOKING, and neither is required to afford the
   other. The everyday shelf (F3's six base upgrades + F5's six cosmetics)
   is ~1 165, so the first hour of rows alone buys two or three small
   things, and a completionist's ~1 850 buys the everyday shelf several
   times over before the ground even counts. Above the everyday shelf sit
   three CAPSTONES (F3) — big, expensive, and reachable well inside a
   single session without finishing the game — which is what the ground
   and a completionist's later hours are actually saving toward once the
   small stuff is bought out; F6's consumables are the shelf that never
   closes, for everything after that.
5. **THE JUICE.** Picking one up has to be the best small thing in the game,
   and every piece of it is a system that already exists, aimed:
   - **the pop** — the fruit scales 1 → 1.35 → 0 over 220 ms
     (`sysSpring`'s own curve) and eight confetti in its colour from
     `game.sparks` (the plain-row payoff uses twelve; this is smaller than
     a tick, by design);
   - **the plink** — one `chime` at 0.11, and THE LADDER: every yuzu taken
     within 6 s of the last steps the plink up one degree of the chapter's
     own scale (`musThemeOff`, the tune's degrees, so a run of five plays
     the first five notes of the theme in the chapter's key), and the sixth
     starts over. A golden one plays the degree AND its fifth; a twin's
     SECOND fruit (whether or not the bonus lands) plays a third above; the
     bath plays the whole first bar. `capy.yuzuRun` counts, and resets at
     6 s — a rolling yuzu counts toward the ladder the moment it is finally
     caught, same as any other, so the chase does not cost the streak;
   - **the flight** — a `+1` (`+3`, `+5`, `+25`) leaves the pickup's screen
     point and flies to the wallet on a 420 ms quadratic bezier that arcs
     up first (a DOM span, `capyui-fly`, positioned from `worldToScreen`,
     removed on `animationend`); the wallet BUMPS when it lands (scale 1.25
     → 1 over 180 ms, a 120 ms yellow wash), and the number counts up
     rather than jumps (25 ticks over 600 ms for the bath);
   - **the golden** — the pop's confetti is sixteen and gold, the sparkle
     ring runs once more at 2× radius, the plink carries a shimmer
     (`musShimmer` at 0.3 for 1.5 s), and the `note` pill says "a golden
     one.";
   - **the rolling one** — no special pop, on purpose: the reward for a
     rolling yuzu is the fifteen seconds of chasing it, not a bigger fanfare
     at the end. A single soft `pop` sfx plays on each of its own nudges
     (volume 0.06, easy to miss over footsteps, there for players who play
     with headphones) so it reads as a live thing rather than a glitching one;
   - **the twin** — taking the first plays the pop and plink as normal and
     the second fruit's motes brighten and quicken (0.6 Hz → 1.4 Hz) for the
     20 s window; taking the second INSIDE the window adds one extra beat —
     a rising two-note flourish, the bonus `+4` flying a half-second behind
     the base `+2` in a brighter gold-green — and the pill says "the pair.";
     taking it AFTER the window is the ordinary plink for 2, no pill, no
     penalty — a miss here is just a yuzu, never a scolding;
   - **the bath** — the animal does what the picture does: within 1.5 m
     and grounded, it HOPS IN (`capy.loafAsk = 1` and a 2.6 s hold on the
     tub's own `carriedBy`, the Iceland spring's soak in miniature,
     iceland.js:4209), steam thickens round it (`game.sparks`, white, slow
     rise, 20/s), the stamina bar REFILLS over the soak (the one time the
     bar is given rather than earned), the score takes half a swell
     (`musSwell(0.5)`), the camera eases back the way the loaf's does, and
     the pill says "the yuzu bath." — then the +25 flies. Rare, and worth
     turning round for. The tub stays as scenery for 30 s, empty, then goes.
   - **the miss** — a yuzu nobody took despawns after 150 s (240 s for the
     bath, 20 s past the window for an unclaimed twin) with no sound and no
     pill. The world is not littered and nobody is nagged.
6. **THE WALLET, ALWAYS ON.** A small pill top-left under the paper's tab —
   the yuzu glyph (the `'e'` ellipse primitive from the masthead plus a
   leaf) and the count in the HUD's own type, `capyui-wallet` — visible
   whether the paper is out or tucked, hidden only under a banner and
   during the coda. It is a BUTTON: a press opens the bag (F2). It carries a
   `title` of "the bag · B". The count is also on the paper's line
   (`todoRefresh` :31350, `· 47 yuzu`), the journey card (`jrCountPre`
   :28848) and the title card's corner beside "19 of 256 done" — the four
   places the game already counts things. F6's equipped-item slot sits
   immediately right of the wallet, same row, same pill shape, so the two
   things you glance at — what you have, what you can spend right now —
   read as one instrument rather than two.
7. **Saved.** `yuzu:'number'` in `sysSAVE_SHAPE`; `jrYuzu = clamp(int, 0,
   99999)` in the restore branch; `saveSoon()` on every change; `bathAt`
   (a per-chapter object of the last bath's wall time) so a reload does not
   re-roll a bath; `platedAt:'object'` and `arrivedAt:'object'`, one bool
   per chapter each, so the full plate and the first-look bonus cannot pay
   twice. Spent yuzu are gone; owned things are their own key.

Instrument: `qa/l8-yuzu.js` — enter a chapter never entered before and
assert the arrival bonus pays exactly once, surviving a `page.reload()`
and a second entry without paying again. Then tick one plain, one mini,
one wow, one find and one record-under-par by force in Sydney; assert
3+8+20+2+5 = 38, the pill text, the wallet's textContent, and that
`page.reload()` restores 38. Then force every remaining task in a small
chapter (fewest rows) done and assert the full-plate bonus equals
`max(12, floor(taskCount*1.2))`, fires once, and a second forced
completion of an already-done task does not pay it again.
Then force a yuzu, a rolling one, a golden, a twin pair (both within the
window) and a bath at 3 m: assert the flight span appears and is gone
within 600 ms each time, the wallet class flips `bump` and back, the count
lands correctly after each (including the twin's +2 then +4 bonus), the
rolling yuzu's position changes over 10 s without leaving its 3 m tether,
`capy.stamina` reads 1.0 after the bath, the ladder's pitch rises on three
taken inside 6 s and resets after, and 0 console errors.

### F2 · THE BAG — the traveller sells things
*Somebody keeps turning up, and they have a bag.*

1. **In every chapter, at the way out.** The traveller today stands in four
   chapters. Add a cameo to the other fifteen at each chapter's `way` mark
   (`sysMAP_WORLDS[biome].way`, systems.js:7616 — already a labelled point on
   every map, already where the animal ends up), through the same
   `addTraveller` (npc.js:3050) with `figure: npcTRAV_FIG` and two lines each
   in the traveller's own voice ("Six months and a very bad map" is the
   register; one line before the chapter's `wow`, one after). They appear
   after the chapter's FIRST tick (`jrChapInc` :33572 > 0), so the first
   minute of a place is still the place. `sysTRAV_PLACE` (:28631) gains
   fifteen rows.
2. **Two doors to the same card.** E within 3.2 m of the traveller
   (`npc:travMet` already fires at `npcTRAV_MET_R`) opens it in person; so
   does a press on the wallet pill (F1.3) from anywhere, any time, not
   paused on a chapter's own action (blocked mid-hop/mid-dive/mid-carry the
   way `pauseShow` already is, :24391) — the whole point of a pocket you can
   always see is a shop you do not have to walk to. Either door opens the
   same card — the picker's own class (`capyui-pick`, systems.js:23231) so
   it is the same paper — titled *the bag*, with rows: name, one line of
   what it does, the price, and OWNED / WORN / HAVE IT where that applies.
   It pauses the world and closes on Esc or a second press on the wallet.
   Nothing in it is a timer or limited stock: the bag has everything,
   always, and the only question is yuzu.
3. **Three shelves.** Upgrades (F3 — 6 everyday rows plus 3 capstone rows,
   the capstones visually set apart with a divider and a "worth saving for"
   label rather than mixed in) and wear (F5, 6 for-sale rows) buy with a
   single press each — a row you cannot afford is greyed with "N more",
   buying is one press, one chime, "yours." — no confirm. Everyday rows
   never cost more than 130; the three capstones (300–380) are the one
   deliberate exception, priced to be a real save-toward-it goal rather
   than an impulse buy, and yuzu come back to the wallet either way. The
   pocketed kind (F6, 3 rows) is a stepper instead of a single button:
   press to add one to that id's bank, its price shown per unit, no cap on
   how many sit in the bag's OWN list (the 20-per-id ceiling is on `inv`,
   after buying). Opening it from the wallet away from the traveller gets
   one extra line at the top, in his voice, picked at random from four
   ("you found the bag on your own. fine by me.") — so the shortcut does
   not feel like it skipped a person.
4. **The bag is also on the settings card.** A fourth `capyui-setsplit`
   ("and what it has bought") under `pauseSet` (:23956) lists what is owned
   and what is banked, read-only, so a player can see the ledger without
   walking to the way out.
5. **Saved.** `owned:'array'` of ids, restored through an allowlist of the
   catalogue's ids (the `seen` lesson from E7: never write an unvalidated id
   into a keyed table); `gifted:'number'`, `jrGifted = clamp(int, 0, 99999)`,
   only ever rises.
6. **THE GIFT.** Holding E on the traveller for 1.2 s (the companion's own
   hold-to-release gesture, npc.js's `stow` mechanism, L6 F1) instead of
   tapping it gives him 5 yuzu — no shop screen, one line picked at random
   ("he nods. that's kind of you."), the wallet counts down the ordinary
   way. It is tracked separately, `jrGifted`, a number that only rises —
   spendable yuzu and the relationship are not the same ledger. At 100
   lifetime, ONE TIME, a mini-tier payoff (`showMoment`, the same shape a
   chapter's own mini task gets) unlocks **the peel pouch** — a small
   satchel worn at the hip, not sold in the bag at any price, raising every
   F6 bank's ceiling by 2 (mango 5→7, feather 3→5, thermos gets a matching
   cap of 3→5 so the pouch has three things to widen, not two). It shows
   in the wardrobe (F5) tagged `giftOnly:true` so `wardBuild` renders it
   without a price, and it does not count toward the everyday shelf's
   1 165 or the three capstones' 1 020 — it was never for sale.

Instrument: `qa/l8-bag.js` — teleport to Venice's way mark after forcing one
tick, hold E briefly, assert the card is on screen with all three shelves
and their stated row counts; separately, press the wallet from 200 m away
mid-chapter and assert the same card opens with the "found it on your own"
line. Buy the cheapest upgrade and one unit of the cheapest consumable with
forced yuzu, assert `owned`/`inv` and the yuzu fall correctly, reload,
assert both survive. Then hold E for 1.2 s twenty times (forcing `jrYuzu`
each time so it never runs out): assert `jrGifted` reaches 100 exactly
once triggers the peel-pouch moment, all three F6 caps rise, and a
twenty-first hold past 100 just gifts with no repeat moment. `qa/l8-trav.js`
— for all 19 chapters, `game.travWhere()` resolves to a point within 6 m
of the way mark and on ground (`terrainHeight` probed, the Kyoto-miller
rule).

### F3 · THE ANIMAL GETS BETTER — cheaper to start, permanent either way
*Six everyday things, priced to be bought early and often, plus three
CAPSTONES — expensive, splashy, and gated on yuzu (and, for one, on owning
the line beneath it) rather than on finishing the game. Every one of the
nine is a multiplier on a constant that exists, each capped, none of them
the hop. Bought once, `owned` forever, read in all nineteen chapters — the
whole point of a journey is that Sydney's animal and Antarctica's animal
are the same one, a little stronger for everything in between.*

**The everyday six — cut from an earlier pass's prices specifically so the
first purchase happens in the first half hour, not the second.**

| id | name | what it multiplies | tiers (price) | cap |
|---|---|---|---|---|
| `puff` | MORE PUFF | `capySTAM_DRAIN` × 0.88 / 0.78 / 0.70 | 25 / 70 / 130 | with `lungs` (× 0.71) the floor is 0.50 — twenty seconds of sprint, never infinite |
| `wind` | SECOND WIND | `capySTAM_REGEN` × 1.15 / 1.30 | 30 / 95 | with `lungs` (× 1.45) ceiling 1.9 |
| `legs` | LONG LEGS | `capyRUN` 7.4 → 7.7 / 8.0 | 35 / 115 | 8.0; `sysFUZZ_SPEED_MAX 30` untouched; Drift/Göreme have their own ceilings (qa/fuzz.js) |
| `slide` | THE LONG SLIDE | `capySLIDE_MIN`/`_OUT` × 1.12 / 1.25 | 25 / 80 | — |
| `breath` | DEEP BREATH | `capySTAM_BREATH` × 0.85 | 55 | with the snorkel (× 0.75) floor 0.64 |
| `feet` | SURE FEET | `capyCOYOTE` 0.12 → 0.18, `capyJUMP_GRACE` 0.14 → 0.20, `capyAIR_CONTROL` 0.35 → 0.45 | 70 | one tier; feel, not reach |

**The three capstones — no prerequisite except yuzu, unless stated; nothing
in the game gates these behind chapters completed.**

| id | name | effect | price | prerequisite |
|---|---|---|---|---|
| `puff2` | BOTTOMLESS PUFF | while sprinting, `capySTAM_REGEN` now applies at 0.15× instead of 0 — the animal barely has to stop to catch its breath; the stamina bar gains a thin gold rim, permanently, the one deliberate exception to "never a new HUD element" (see below) | 340 | `puff` III and `wind` II both owned |
| `eye` | THE KEEN EYE | every ground yuzu (not the bath) is worth one more: a yuzu 1→2, a rolling one 3→4, a golden one 5→6, a twin's fruits 2→3 each (its +4 bonus is unchanged) — the one purchase that pays part of itself back, for the rest of the journey | 380 | none |
| `seat` | THE SPARE SEAT | `sysDrops`'s live-drop ceiling rises from 2 to 3 per biome — visibly more dots on the map at once | 300 | none |

1. **One table, two shelves of it.** `sysUPGRADES` in systems.js beside
   `sysSKILLS` (:32510) — `{id, name, line, tiers:[{price, k}], prereq?}`.
   `capy.mods` is an object of multipliers the capybara reads at the SAME
   lines the skill is read (capybara.js:5628–5632 for stamina, :6149–6159
   for `topSpeed`, :5283 for the slide, :449–454 for the hop timing) —
   `k = base * skillK * mods.x`; `capy.dropCap` (read by `sysDrops`, F4) is
   2 plus 1 if `owned` has `seat`. Written every frame from `owned`, the way
   `capySkill` is written from `taskRec` (:43349–43385), so a restore needs
   nothing extra. A capstone with a `prereq` is greyed in the bag (not
   hidden) with the prerequisite named, so a player who hasn't bought
   `wind` II yet knows exactly what BOTTOMLESS PUFF is waiting on.
2. **Never a new number on the HUD — except the one capstone that earns
   it.** The bar is the bar; the one legible change from the everyday six
   is the label ("puff III" for its first three shows, `puffEver`'s own
   mechanism, :26845). BOTTOMLESS PUFF is the single stated exception: a
   capstone is meant to be SEEN, and a gold rim on the bar is the one
   moment this pass earns the right to add something the HUD didn't have —
   spent exactly once, not set as a precedent for the everyday six.
3. **Skills are not for sale.** `lungs`, `vault`, `herd` and the other seven
   stay chapter-taught (`sysSKILLS`). A bought thing multiplies; a learned
   thing enables. The bag says so on its first open: "the things a place
   teaches you, it teaches you."
4. **Reachable without finishing anything.** None of the nine — everyday or
   capstone — reads a chapter-completion count, a task id, or `jrChapInc`.
   The everyday six are cheap because the first hour should afford one; the
   capstones are expensive because they should feel earned, but "earned"
   here means yuzu saved (and, for one, a line bought out), never "played
   for N hours" or "finished M chapters." A player who farms hard in one
   rich biome could reach a capstone in a single sitting, and that is a
   feature, not an exploit.

Instrument: `qa/l8-upgrades.js` — in Manly (flat prom, the movement pass's
own track): sprint a fixed 40 m with no mods, read `capy.stamina` at the end
and the wall time; force `owned` to each everyday tier and repeat; assert
drain falls monotonically, run time falls 7.4 → 8.0 within 2 %, and the hop
apex is 1.37 ± 0.02 m at every tier including all three capstones (the one
thing that must not move — `capy.body.position.y` max over a standing hop).
Then force `puff` III + `wind` II and buy `puff2`: assert regen during a
sprint is > 0 (was exactly 0) and the stamina bar carries the gold-rim
class; assert `puff2` is REFUSED without both prerequisites owned. Force
`eye` and check three forced ground pickups (yuzu, rolling, golden) land
at 2/4/6 instead of 1/3/5. Force `seat` and assert `sysDrops`'s live cap
reads 3 in a chapter with three simultaneous forced spawns, none rejected.
`qa/l8-catalogue.mjs` (static) — every `sysUPGRADES` id (everyday and
capstone) is read by `capy.mods`/`capy.dropCap` somewhere (the xmodule
unread-const rule, applied to the catalogue); the everyday six sum to
730 (225+125+150+105+55+70), F5's six sum to 435 — the everyday shelf is
1 165, matching F1's stated figure — and the three capstones add 1 020
(340+380+300) for an everything-total of 2 185.

### F6 · THE POCKETED KIND — short-term, spent on purpose
*F3 is the animal getting stronger forever. This is the animal carrying one
trick it chooses when to use — some running out on a CLOCK once triggered,
some running out in COUNT regardless of the clock. Both are single-use in
the sense that asks: press it, and it is spent — never a passive buff, never
armed by itself.*

Also the answer to a question F3 leaves open: once a player owns the
everyday six, the good hats, and even all three capstones, ground yuzu (F4)
have nothing left to buy. Consumables are restocked, not owned — the
everyday shelf plus the three capstones (2 185 total) is a ceiling on the
CAPITAL shelf; the pocketed kind is the shelf that never closes, so a full
wallet late in the journey still means something.

**The three, one of each shape.**

| id | name | shape | effect | price/charge |
|---|---|---|---|---|
| `thermos` | THE THERMOS | time-based — one trigger starts a window, unused time is lost if you dawdle | instant full `capy.stamina`, then drain × 0 for 45 s | 30, bank up to 3 |
| `mango` | A WRAPPED MANGO | use-based — a bank of charges, no clock until triggered | one instant SECOND WIND boon (regen × 2.0, drain × 0.5, 75 s) — the golden yuzu's food boon, on demand | 15, bank up to 5 |
| `feather` | A LUCKY FEATHER | use-based, one charge at a time | consumed by the NEXT chaos roll (`sysChaosTick`) in this chapter, cancelling it silently — a ward you spend before a crossing you'd rather not be interrupted on | 25, bank up to 3 |

All three caps rise by 2 (thermos and feather 3→5, mango 5→7) with F2.6's
gift-only peel pouch — the one thing in the whole catalogue that widens the
shelf instead of filling it.

1. **One slot, chosen in the bag.** `capy.item = {id, n}` — the bag (F2) has
   a third shelf, "the pocketed kind": buying a unit adds to that id's bank
   (`inv[id]`, a plain count) and, if nothing is equipped, equips it.
   Switching the equipped id in the bag is free and instant; banks of the
   other two ids sit untouched. Only one id is live at a time — the game's
   own rule against a second voice for one idea (no hotbar, no cycling key).
2. **One press, and it is gone.** A single key — provisionally **F**,
   verify unbound against the live map (`systems.js:43250–43276`; **R** is
   the fallback if not — triggers the equipped item if `inv[id] > 0`:
   `inv[id]--`, the effect starts, the HUD slot (a small ring beside the
   wallet, icon + count) flashes and the count ticks down. At `inv[id] === 0`
   the slot dims and F does nothing — no toast for a press that does
   nothing, the dimmed icon already says so.
3. **The thermos is a bigger, chosen version of a boon**, sharing
   `capy.boon`'s machinery (F4.3) so the stamina label already knows how to
   show "the thermos · 41 s" — no new display code. The mango IS the food
   boon, just started by a press instead of a pickup — same `capy.boon`
   path, same label. The feather touches nothing visible until it fires:
   `sysChaosTick`'s roll checks `capy.ward > 0` first, decrements it,
   and skips the roll for that turn — a `note` pill says "close call." only
   when it actually cancels something, so a feather that outlives a whole
   quiet chapter is not a wasted-looking purchase.
4. **The cap is soft, the storage is hard.** `capy.itemCap(id)` returns the
   table's base (3/5/3) plus 2 per id if `owned` has `peel-pouch` — the bag
   refuses a purchase past the live cap, so the shelf itself teaches the
   pouch exists ("bank full — the pouch would take three more") before the
   player has met the traveller a hundred times. `inv:'object'` in
   `sysSAVE_SHAPE` — `{thermos:n, mango:n, feather:n}`, each clamped 0–20 on
   restore (the hard technical ceiling, separate from the soft gameplay
   cap) through an allowlist of the three ids (the same `seen`-validation
   rule as everywhere else this pass); `item:'string'`, restored only if it
   is one of the three ids and its bank is > 0, else cleared.

Instrument: `qa/l8-item.js` — force-buy 2 thermos, equip, press F: assert
`capy.stamina` hits 1.0 within one frame and drain reads 0 for 45 ± 1 s,
`inv.thermos` falls 2→1, the HUD slot text matches. Force-buy 3 mango,
equip, press F twice: assert two 75 s boons (sequential, not stacked) and
`inv.mango` falls to 1. Force-buy 1 feather, equip, force a chaos roll:
assert it is skipped, the pill fires once, `inv.feather` is 0, and a SECOND
forced roll in the same chapter is NOT skipped. Without the pouch, assert a
fourth thermos purchase is refused at the cap; force `owned` to include
`peel-pouch` and assert the same purchase now succeeds up to 5.
`page.reload()` after all three: banks and the equipped id survive; a bank
forced to a made-up id is dropped, not restored.

### F4 · THINGS THAT TURN UP — five kinds of yuzu and food on a timer, and the map says where
*Two things, somewhere in the chapter, every one to two minutes — most of
them a plain yuzu, some of them worth a detour, one of them worth stopping
whatever you were doing.*

1. **The pool.** `sysDrops` in systems.js: per live biome, at most
   `capy.dropCap` live drops — 2 normally, 3 with THE SPARE SEAT (F3)
   owned; when below cap, a timer `dropT = rand(60, 120)` counts down only
   while the chapter is live (the `wxFrontT` pattern, weather.js:928) — the
   first drop 20–40 s after arrival so the first minute is the place. Kind,
   rolled per spawn, matching F1's table — tuned toward the exciting tiers
   on purpose, not a flat spread: yuzu 36 %, rolling yuzu 20 %, golden yuzu
   17 %, the chapter's own food (Pasto's empanada, Kyoto's dango, Cali's
   arepa — the eleven `edible` rows of `physTYPES`, a plain `orange` for
   chapters without one) 10 %, twin yuzu 13 %, the yuzu bath 4 %. Two rolls
   are conditional, both re-rolled to a plain yuzu on refusal: the BATH
   refuses if one is already live anywhere, if this chapter had one in the
   last 10 minutes (`bathAt[biome]`), or in the first two minutes of the
   chapter; the TWIN refuses unless both of its slots are currently empty
   (it fills both at once, so it cannot roll against a slot something else
   already occupies). Spawn point: a random `sysMAP_WORLDS[biome]` mark's
   position ± 6 m (the bath needs ± 3 m and flat ground, `navSlope` under
   0.15; a twin's second point is 4–8 m from its first, same checks),
   re-rolled until `navBlocked` is false and `terrainHeight` is above water
   — never the spawn ring, never inside `sysWHY_R` of the marquee point.
   Despawn if unclaimed: 150 s for a plain/rolling/golden yuzu or food,
   240 s for the bath, and for a twin, 150 s from spawn for the FIRST fruit
   and 20 s past the first being taken for the second (so an abandoned
   twin does not squat on a slot forever). Values read `capy.mods` the same
   way F3's movement multipliers do: with THE KEEN EYE owned a yuzu pays 2
   instead of 1, rolling 4, golden 6, a twin's fruits 3 each — rolled at
   pickup, not at spawn, so a drop that spawned before the capstone was
   bought still pays the new rate if it's still live when taken.
2. **Behaviour, not just size.** A rolling yuzu's tick (inside `sysDrops`,
   tagged `rolling:true` at spawn — no new prop kind, the same `yuzu` mesh
   and body) applies a lateral impulse to its existing CANNON body every
   2.5–4 s: 0.6–1.0 m/s in a random heading, or straight back toward its
   spawn point if it has drifted past 3 m — a meander, never an evasion,
   never faster than the animal's walk. A twin is two ordinary props with a
   shared `pairId`; taking the first starts a 20 s window on the second
   (read by the map overlay and the juice in F1.4) and does not otherwise
   change how it is grabbed.
3. **Yuzu is F1's currency; food is the power-up.** `capy:grab` on a food
   drop `removeProp`s it and starts one of two boons, 75 s each, by which
   pool the chapter drew it from: the chapter's own food → SECOND WIND
   (regen × 2.0, drain × 0.5); the generic `orange` → QUICK (run × 1.12,
   the slide × 1.2). A third boon, GULL-PROOF (thieves and gulls ignore
   held props — the `thief` state and the wake gulls read one flag), rides
   on a GOLDEN yuzu specifically, on top of its +5 — the rare pickup is
   worth stopping for twice. Boons stack with F3 mods and cap at the F3
   caps × 1.5; `capy.boon` is `{id, t}` and the stamina label shows the
   boon's name while it runs ("second wind · 61 s").
4. **The map says where, and the bath says louder.** A second overlay in
   `mapDraw` beside the marquee ring (systems.js:26400): a `dot`-kind mark
   for a live yuzu of any kind or food, a `star`-kind mark for a live bath,
   pulsing at the front's own 0.7 Hz, from `game.drops.where()` — an array
   of `{x,z,kind}` published by `sysDrops`, no static-table entry. A hint
   row, pseudo-id `__drop` (the `sysWAY_ID` pattern, :7610) in `sysHINTS`
   (:29197), `where()` = `hintProp` over the drop kinds (bath first if one
   is live, then a twin whose window is still open, then whatever is
   nearest), so the arrow points at the thing most worth going to. The bath
   ALSO gets a one-time `note` pill the moment it spawns, from wherever the
   animal is: "the yuzu bath, somewhere near." — the one drop worth
   interrupting the paper for.
5. **Said once for the ordinary ones.** The first yuzu of a session, of
   any kind, gets one `note` pill: "yuzu turn up. the map has them." Never
   again; the bath's own pill (above) is the only one that repeats, because
   it is rare enough to earn it.

Instrument: `qa/l8-drops.js` — in three chapters (Sydney, Venice, Kowloon)
run 400 s at `dropT` forced to 6 s: assert live count never exceeds 2 with
`seat` unowned, the kind mix over 300 spawns is within 4 points of
36/20/17/10/13/4, no bath spawns inside 10 min of a prior one in the same
chapter or inside the first 2 min, a twin never spawns while a slot is
occupied, every spawn point has `navBlocked` false and is > 8 m from the
spawn ring and the marquee point, `game.drops.where().length` equals the
live count, a rolling yuzu's position changes but stays within 3 m of its
recorded spawn over 60 s, eating a food starts a boon and `capy.mods`
shows it, a golden also sets GULL-PROOF, taking a twin's second fruit
inside/outside the 20 s window pays 4/0 bonus correctly, and boons end at
75 ± 1 s. Then force `seat` owned and assert live count can reach 3; force
`eye` owned and assert a yuzu/rolling/golden picked up pays 2/4/6.
`qa/fuzz.js` in all nineteen with drops on (both with and without `seat`):
no chapter's maxSpeed leaves its ceiling (a rolling yuzu's own impulse
included).

### F5 · WEAR THAT DOES SOMETHING — cosmetics with a line each
*Ten costumes, one effect. Make it ten effects, sell six more, and gift a
seventeenth nobody can buy.*

1. **Each earned costume gets one small, legible effect**, read at the
   same line the snorkel is (capybara.js:5613) or the one consumer that
   already exists for it: sunhat — gulls keep 2 m further off (the flock's
   flee radius, `calmAudit`'s `near`); ferrycap — the helm hold
   (`quayTakeHelm`) costs no puff; plumes — Rio's crowd bed rises 0.1
   nearer; boater — Venice's tide hurry is × 0.85; snorkel — as now, plus
   DEEP BREATH stacks; flycap — Göreme's balloon rises 6 % faster; surfcap
   — the barrel window is +0.4 s; cavehelm — the dark's wheek-torch radius
   × 1.25; parka — the cold chapters' stamina drain × 0.85 (Iceland,
   Antarctica; `wxMOOD` says which are cold); black-tie — the doorman's
   carry cooldown doubles. Each is one multiplier on a constant that exists
   and each is written on the wardrobe picker (`wardBuild`, systems.js:24202)
   as its one line.
2. **Six for sale in the bag** (F2), built the way the ten are
   (`capyCostume`, capybara.js:3586 — two Groups on `capySquash`/`head`,
   PALETTE colours, no textures), priced down from an earlier pass for the
   same reason F3's everyday six were: a scarf (SECOND WIND × 1.1, 50), a
   bandana (GULL-PROOF always, 100), bells (the herd's hold 21 → 30 s, 75),
   a lantern (the cave's torch × 1.5, 65), a medal (the record ghost shows
   in every chapter, 85), a bow tie (every local's greeting is their
   `praise` line, 60) — 435 total. `sysWEAR_NAMES` (:32545) and
   `sysWARDROBE` gain the six; a bought costume's `task` field is `null`
   and `owned` is its gate.
3. **A seventeenth, not for sale.** The peel pouch (F2.6) is built the same
   way — a satchel at the hip, no head slot, so it stacks with any hat worn
   at the same time — but carries `giftOnly:true` instead of a price;
   `wardBuild` (:24202) renders it in its own row at the bottom, "the peel
   pouch — a gift, not a purchase", greyed with a lifetime-gifted count
   until `jrGifted` clears 100. It is armour for the bag's OTHER shelf
   (F6's caps), not for the animal, so it is the one wardrobe entry with no
   line about gulls, cold or hurry — the wardrobe picker says so plainly
   rather than inventing a movement effect it doesn't have.
4. **Two rules from the wardrobe's own memory.** A hat must clear the head
   at every pose (the four ways a hat fails); and the chapter-scoped default
   (:43306) still wins unless the player has picked (`sysWearPick`), so a
   bought scarf does not override Palawan's snorkel unless asked.

Instrument: `qa/l8-wear.js` — for each of the sixteen WITH an effect, force
it worn and read the one number it claims to move against the bare figure
(flee radius, hurry factor, drain, hold) — sixteen rows, each a before/after
pair, none equal; separately assert the peel pouch moves nothing on the
figure and only the two F6 caps (already covered by `qa/l8-item.js`).
`qa/l8-hats.js` — the wardrobe's existing pose sweep over the seven new
ones (six bought plus the pouch), no clipping at the four poses.

## The chaos, said separately
*Not a feature with a shelf. A roll.* The brief asked for a chaotic element
and F4 is the constructive half. The other half is **THE INCIDENT,
UNPROMPTED**: every 150–240 s while a chapter is live and no `wow` is live
(`wowLiveOn`), a 40 % roll picks one from the chapter's own table — a gust
(the impulse system, `sysIMPULSE_BY`, already named per chapter), a thief
run (the `thief` NPC state, already written in six chapters), a stampede
(the chapter's critters flee THROUGH the animal rather than from it, one
sign flip on `calmAudit`'s vector), a squall (`hud.front(0)` — F4 of L7,
already forceable), a runaway (spawn a `ball`/`cone` 12 m upslope of the
animal with a push). Named by a `note` pill. Never twice the same in a
row; never inside `sysWHY_R` of the marquee point; never in the first
minute. This is one function, `sysChaosTick`, and a per-biome table of
five booleans. Instrument: `qa/l8-chaos.js` — 600 s in Sydney at the roll
forced to 20 s: count ≥ 20 incidents, no two consecutive the same, none
with `wowLiveOn` true, 0 console errors, and `qa/fuzz.js`'s speed ceiling
holds under the gust.

## Order and ownership

**Wave 0 — the yuzu (one agent, half a day).** F1 whole: the key, the
listener, the five-kind art and behaviour (including the rolling nudge and
the twin pair, though their SPAWNING is *drops*'s job in wave 1 — wave 0
builds the props and their pickup logic so *drops* has something to spawn),
the juice (pop, plink, ladder, flight, wallet bump), the always-on wallet,
the instrument. Nothing else can be measured until yuzu exist. Commit.

**Wave 1 — three agents, disjoint regions.**
- *bag*: F2 — npc.js (fifteen cameos, the gift's hold-E gesture reusing
  the companion's own hold-to-release code, L6 F1), systems.js (the card,
  the wallet's second door, the settings split, `sysTRAV_PLACE`,
  `jrGifted`), the three instruments. References `giftOnly:true`/
  `peel-pouch` before *wear* builds it (wave 2) — guard the reference
  (`sysWARDROBE['peel-pouch']` may not exist yet mid-wave) so *bag* can
  land first without throwing.
- *body*: F3 (the everyday six AND the three capstones, `puff2`/`eye`/`seat`
  with `eye`'s and `seat`'s effects published as `capy.mods`/`capy.dropCap`
  even though F4 is the one that reads them — see below) + F6 —
  capybara.js (`capy.mods` at the four read sites, `capy.boon`,
  `capy.item`/`capy.ward`, `capy.itemCap`), systems.js (`sysUPGRADES`, the
  prereq check for `puff2`, `sysCONSUM`, the every-frame writer, the F key,
  the HUD slot, the stamina bar's gold-rim class), `qa/l8-upgrades.js`,
  `qa/l8-catalogue.mjs`, `qa/l8-item.js`.
- *drops*: F4 — systems.js (`sysDrops`, the map overlay, the hint row, the
  bath's soak-in behaviour, the rolling nudge and twin-pair spawn rules,
  reading `capy.dropCap` for the live-drop ceiling and `capy.mods` for
  THE KEEN EYE's value bump at pickup time — both published by *body* in
  this same wave; default to 2 live / base values if `capy.dropCap`/`mods`
  aren't there yet so *drops* can land first too), props.js (the five
  yuzu-kind builds, the bath prop, `orange`), `qa/l8-drops.js`.
The bag sells F3 and F6's tables by id; if *bag* lands first it sells an
empty shelf and says so. One commit per agent, `npm test` green, fuzz in
the chapters touched.

**Wave 2 — two agents.**
- *wear*: F5 — capybara.js (six bought builds plus the peel pouch's satchel
  build), the ten effect lines in their chapters, `wardBuild`, the peel
  pouch's `giftOnly` row and its cap-raise on `capy.itemCap` (closing the
  guard *bag* left in wave 1), the three instruments.
- *chaos*: the roll — systems.js (`sysChaosTick`, the table, one
  `capy.ward` check at the top of it for F6's feather), `qa/l8-chaos.js`.

**Wave 3 — the balance pass (one agent).** Play three chapters start to
finish naive (the L7 fresh-eyes probe, `qa/l7r-*`), read yuzu earned per
half-hour — rows and ground separately — against the everyday shelf's
1 165 and the capstones' 1 020, move prices and the five kinds' odds — not
effects — until the first HALF HOUR buys at least one everyday thing, the
first hour buys two or three, and the first capstone is reachable by hour
3 for an engaged player without needing anything close to a finished game.
The three capstones are the number most worth getting wrong in either
direction: too cheap and they arrive as an afterthought before the player
has felt the everyday six matter; too dear and "expensive but not
completion-gated" reads as a lie. Then keep playing past "everyday shelf
bought out" for one more chapter and confirm yuzu still have somewhere to
go: the pocketed kind's three prices (30/15/25) against ground income
(~3.7/roll, richer still with THE KEEN EYE owned) should read as "one
thermos every ten minutes of looking", not "never worth it" and not "buy
fifty on arrival"; and confirm the gift is a genuine long-tail goal, not a
rounding error — 100 lifetime at 5 a gift is twenty deliberate holds,
which should feel like a habit a player picked up, not a grind imposed on
them. `npm run soak` twice so `soak-diff` has rows. The closeout in
CONTRACT.md with the numbers as measured.

## Rules for every agent
- A new save key is a `sysSAVE_SHAPE` row AND a clamped restore line; ids
  restored through an allowlist; `v` stays 1.
- A bought PERMANENT thing (F3, F5) MULTIPLIES a constant that exists; it
  never adds a branch to a chapter's own state machine. A bought POCKETED
  thing (F6) is a single, player-timed trigger — never a passive buff, never
  armed by anything but a press.
- A CAPSTONE (F3) is gated on yuzu and, at most, on owning another purchase
  — never on a task id, a chapter-completion count, or `jrChapInc`. If a
  balance-pass change would make a capstone read chapter progress to slow
  it down, lower the price instead.
- The hop apex is 1.37 m before and after every commit; `qa/l8-upgrades.js`
  says so or fails.
- Nothing pays out inside the first minute of a chapter, except THE FIRST
  LOOK (F1), which is deliberately the one payout that fires on arrival
  itself — it rewards showing up, so waiting a minute would defeat it.
  Nothing turns up inside `sysWHY_R` of the marquee point.
- Every earn, every drop, every incident is a `note` pill. The banners
  belong to the rows. A consumable firing is a HUD change (the slot, the
  boon label), not a pill — the player already knows, they just pressed F.
- One equipped consumable at a time; no hotbar, no cycling key — switching
  is a bag decision, not a live one.
- Each instrument writes its JSON through `POST /shot?name=` and the probe
  opens with `qa/_boot.js`. `PORT=5188`.

## Held (named, not built)
A second currency; a shop with stock or timers; selling skills; a jump
upgrade; a leaderboard; daily anything. Named so nobody builds them in
wave 3 because the numbers looked thin.

Added at the close (18 Sep 2026): the bath's camera ease and 2.6 s hold
on `carriedBy` (F1.5/F4); the `+n`'s bezier arc (F1.5); an always-on
paper row for a live drop (F4.4); a second "empty tub" mesh for the bath's
30 s tail; the roadmap's full 400 s × 3-chapter drops soak in real time;
a thief that actually runs at you (the chaos table has `thief` false in
every chapter — nothing in the tree makes one); a real-time cross-check
of the balance bot (`qa/l8-balance.js` has SPEED = 0 for it, unrun).

## Closed (18 Sep 2026)
Six features and the incident built and measured across two sessions and
seven agents; the closeout with the numbers is the L8 section at the top
of CONTRACT.md. The pickup itself was reworked mid-pass (0cfefb7: the
fruit floats, is walked into, and is caught — no E) after a playtest, and
wave 3 was measured against the new mechanic: per half hour, rows / ground
Sydney 51 / 45, Kyoto 37 / 21, Quay 28 / 94; the first half hour buys three
everyday rungs, the first hour four to six, THE SPARE SEAT lands between
hour 2 and hour 3. No price, odds or worth moved in wave 3; the balance
nudge (4891f65) before it is where the ground was retuned. `soak-history`
has its post-rework row and `soak-diff` compares.
