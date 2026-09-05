# The title pass: the front of the game, six things

Written 5 Sep 2026 as a hand-off for execution on Opus 5. One read-only audit
of the title card as it renders today: both pages, five viewports, one hover
frame, one measurement script. Everything below cites a symbol, a number or a
PNG in `qa/`. Line numbers in `systems.js` move by the thousand between
batches, so grep for the name.

The headline: **the card is finished and the screen around it is not.** Fifty
passes have gone into the card itself: it has a cut wordmark, a stack of two
sheets, three shadows, a breathing ornament, a shelf of nineteen lit
postcards, a score, and a contrast table that was measured rather than
chosen. None of that is touched here. What a player actually sees on first
launch is a small tilted dialog in the middle of a blurred green smear, with
the manual printed on it and three chat bubbles leaking through from behind,
and the game's one unarguable asset, the world with the animal in it, is
underneath the card where nobody can see it.

Six opportunities, ordered by what a player sees first. Three batches of
2 to 3 hours, one commit each, verified from rendered PNGs with the headless
harness (`headless-qa-harness` in memory) and `playwright-cli`. This is a
redesign in preserve mode: the paper, the palette, the tilt, the shelf, the
wordmark and the score all stay. What changes is composition, hierarchy,
copy and choreography.

---

## The design read

Reading this as: a game title screen for players who have never seen the game,
in the game's own printed-paper, Goose-Game-adjacent language, built in native
CSS inside `sysBuildCSS()` with no framework, no dependencies and no asset
files. Dials, inferred from the existing screen: variance 6 (the card may sit
off-centre on a wide screen; the tilt stays), motion 5 (one arrival, one page
turn, one drifting camera; nothing loops except the breath), density 3.

Two constraints override taste and are restated in "Constraints" below: the
aesthetic law in `CONTRACT.md` (no textures, no image files, colours from
`PALETTE`), and `dist/` running from `file://` with the network off.

---

## The measured state

Shot with `qa/title-audit.js` (both pages at 1440x900, 1920x1080, 1280x720,
390x844, plus a hover frame) and measured with `qa/title-measure.js`. Both
need the dev server on 5188 and `playwright-cli close-all` first.

| what | value | where |
|---|---|---|
| card, page one, at 1920x1080 | 647 x 486 px: 34 % of the width, 45 % of the height | `AUD-p1-1920.png` |
| wordmark at 1920 | 414 px wide, 21.5 % of the viewport | `.capyui-mast svg`, `min(78%,560px)` |
| card ceiling, page one | `max-width:640px`, fixed | `.capyui-card` |
| camera while the title is up | `[0, 7.6, 29.2]`, the play rig at `sysCAM_DEF` 9.5 and its ~35 deg pitch, yaw 0 | `sysCamPos` |
| capybara while the title is up | `[0, 0.3, 22]`: directly under the centre of the card | |
| wash over the world | fog 0.34 at the top, 0.62 at 38 %, `skyBottom` 0.84 at the foot, plus `blur(5px)` | `.capyui-title` |
| NPC bubbles visible through the wash at 1920 | three ("He drove off. He actually drove off.") | `npc.js` `sayBubble` pool, `AUD-p1-1920.png` |
| small-caps labels on page one | 3 plus keycaps: subtitle, "how to be a capybara", "19 of them, in any order" | |
| small-caps labels on page two | 4 plus keycaps: "19 places / in any order", "chapter one · start here", "19 things to do, and nobody watching", "or go straight somewhere else" | |
| "nineteen places, any order" | said three times: page-one subtitle, page-one button subline, page-two header stat | |
| hero row at 1920 | picture 411 px (40 %), word panel 617 px holding four short lines | `AUD-p2-1920.png` |
| console | 0 errors, 0 warnings | |
| type | `"Trebuchet MS","Segoe UI",system-ui` | `.capyui-font` |

The card itself passes every check that was run on it in v38 (`qa/uicontrast.js`,
worst row 5.16:1) and nothing here lowers that.

---

## The six opportunities

### 1. The world behind the card is thrown away

**What you see.** `AUD-p1-1440.png`, `AUD-p1-1920.png`: a green and lilac
smear, a bench, a sign, a blurred purple slab filling the right third, and the
tops of three speech bubbles. It does not read as Sydney, or as a harbour, or
as anywhere. The animal the game is about is not in the picture: it is at
`[0, 0.3, 22]`, under the card.

**Why.** Nothing composes this shot. Before `started` the rig is the ordinary
follow camera (`sysCAM_DEF` 9.5 m back, ~35 deg down, yaw 0), which is the
right lens for playing and the wrong one for a poster: it is a photograph of
the lawn. Over that, `.capyui-title` lays a fog gradient that reaches 84 %
opacity at the foot of the screen and blurs the rest by 5 px, so the world
survives as colour only. And the locals keep talking: `sayBubble` in `npc.js`
mounts its pool of inline-styled divs into the HUD root under z 60, and the
ice-cream van's departure fires its lines whether or not anybody has pressed
a key.

**Build.**
- A title pose for the rig, active while `!started`: lower (a pitch around
  14 to 18 deg rather than 35), further (a `camDist` of 13 to 14, inside
  `sysCAM_MAX` 16), and at a hand-picked yaw for chapter one. Pick the yaw by
  shooting eight frames at 45 deg steps and choosing the one with the harbour,
  the figs and the animal in it; the animal should land on the right third of
  the frame (opportunity 2 puts the card on the left third). Keep the idle
  behaviours running so it is a capybara and not a statue.
- A drift: yaw ±0.04 rad and dist ±0.3 m on a 40 s sinusoid. Under 0.1 deg/s,
  so it is felt and not seen. `html.capy-calm` switches it off.
- On `startGame`, no cut: leave `camYaw` and `camYawTarget` at the title yaw
  (the rule at `if (!mounted) { camYaw = flyYaw; ... }` is the precedent) and
  let the existing `damp(camDist, camDistTarget, 6, dt)` bring the distance in
  behind the card's 0.75 s fade; the pitch needs its own damp over ~1.2 s.
- The wash: replace the full-screen fog with a light global tint (0.12 to
  0.18 of `fog`, so the palette stays pastel), a soft directional scrim behind
  and below the card only (the card is opaque; the scrim's job is to give its
  shadows something to fall on), and a corner vignette at about 0.18. Blur:
  A/B 0, 2 and 5 px from PNGs and keep the lowest that still separates the
  card from the world. The composite pass already grades and vignettes the
  render; do not double it.
- Bubbles: the pool must not show while the title is up. Cheapest is a class
  on the pool's elements and `#hud:has(.capyui-title:not(.gone)) .that-class
  {display:none}`; or gate the mount in `sayBubble` on `game.state.started`.
  Either is one line. Leave the world alive; hide the text.

**Trap.** The title pose has to pass `sysCamClear` and stay above
`sysCAM_FLOOR` (1.7) or the boom will pull it in on frame one and the drift
will fight the collision solver: see `capy3-deck-is-not-a-wall` in memory. The
shadow follow snaps to texels of the camera; a drifting camera must not
shimmer the shadow, so check a 40 s soak for `sunFollow` jitter. And measure
the title pose from a screenshot with rAF running, never from a hand-ticked
`toDataURL` (harness trap 12).

**Verify.** `qa/title-audit.js` before and after. Count bubble elements with
`offsetParent` while the title is up: must be 0. The frame outside the card
must be recognisable as a harbour to a person looking at the PNG, and the
animal must be visible in the 1440 and 1920 frames. Frame time unchanged
(the world was ticking anyway). Start a chapter from the card and screenshot
at 0.4 s and 1.2 s: no cut in the camera, no swing.

### 2. The card neither scales nor sits with the world

**What you see.** At 1920x1080 the card is a third of the width and the
wordmark is 414 px. It reads as a dialog box, and on a 27-inch monitor as a
small one. It is dead centre at every size, so whatever the camera is showing
is behind it.

**Why.** `.capyui-card{max-width:640px}` on page one, and every type size on
the card is a `clamp()` on `vw` that reaches its ceiling long before 1920.
`.capyui-title` is `justify-content:center` with `margin:auto` on the card.

**Build.**
- A scale token. `zoom` is standard in every current browser and scales layout
  and text together without touching a single rule inside the card:
  `.capyui-card{zoom:var(--ui)}`. Write `--ui` from JS in the same resize path
  that writes `--cols` (`sysPickCols`), as
  `clamp(1, min(innerWidth / 1440, innerHeight / 900), 1.35)`. Page two's
  1140 px shelf is already sized to the window; scale it by the same token
  and re-check the 720p shelf budget (`@media (max-height:900px)` and `770px`)
  still wins.
- An offset on page one, wide screens only (`min-width:1280px` and
  `min-aspect-ratio:3/2`): `.capyui-title.p1{justify-content:flex-start;
  padding-left:clamp(48px,7vw,140px)}`. The card keeps its tilt and its second
  sheet; the world gets the right two-thirds; the animal from opportunity 1
  stands in it. Page two stays centred: the shelf is a shop window and it is
  the content. Portrait and phone stay centred.
- The glow wash (`.capyui-glow`, `left:50%`) follows the card: write its
  centre from the same JS as `--ui`.
- Shoot both (centred-and-scaled versus offset) and pick from the PNGs. The
  recommendation is offset; the argument against it is only that a card the
  player has learnt to find in the middle has moved, and this is the front
  door, so nobody has learnt anything yet.

**Trap.** `picksFade()` and `pickMove` read `getBoundingClientRect()`; under
`zoom` Chrome reports zoomed values and Firefox 126+ does too, but measure the
"N more below" count after, not before. The card's `transition` on
`max-width` and `transform` fires on the page turn; a padding change on the
container must not animate or the card slides sideways on every turn. The
memory list of sizes at which the footer must stay above the fold is
1280x720, 1280x760, 1366x768, 1600x900, 1920x1080, 900x620, 390x844; every one
of them is re-shot, not assumed.

**Verify.** A table of card-width / viewport-width at 1280, 1440, 1920, 2560:
the wordmark should be 26 to 30 % of the width at 1920 and the card should
never exceed 46 % at any size. `qa/uimobile.js` unchanged at 390.
`qa/uiwide.js` (it is a phone overflow probe despite its name) still reports
no child past the viewport edge.

### 3. Page one leads with the manual, and the primary verb has no button

**What you see.** `AUD-p1-1440.png`: wordmark, subtitle, ornament, then the
largest block on the sheet is an eight-row key legend, then a fold, then one
button that says "Choose a place". The action that actually starts the game
(Sydney, or carry on) is Enter, a click on the backdrop, or the footnote "tap
to begin". There is no button for it.

**Why.** A deliberate earlier decision ("THE LEGEND IS THE CONTENT OF THIS
PAGE") promoted the six verbs to the body of the card. That was right against
the alternative at the time, a 10 px footnote. It is wrong against a release
title screen, where the decision sits above the reference and the biggest
control is the thing most players want. Two intents also collide: the filled
button turns the page, while the invisible action begins.

**Build.** Page one, top to bottom:
1. masthead, subtitle, ornament (unchanged);
2. the carry-on row if there is a file (unchanged, `.capyui-carry`);
3. **Begin**: on a fresh file a filled `.capyui-go` labelled "Begin" with no
   subline, calling the same path Enter does (`startGame('sydney', false)`);
   on a file this slot is the carry-on row already, so the button is not
   drawn twice;
4. **Choose a place** as the outline variant (`.capyui-go.alt`, which exists
   and is already what the button becomes when a file is present), no
   subline;
5. the six verbs, one size down (`.capyui-legend` metrics rather than
   `.capyui-legbig`), still two columns, still with the "how to be a capybara"
   label, and the "and a few extras" fold under them;
6. the rail: drop "Enter begin" and "→ choose a place" (both are now buttons),
   and move M and N into the extras fold if they are not there already. On
   touch the footnote loses "tap to begin" for the same reason.

`titlePage(1)` currently focuses `goEl`; it focuses Begin. Enter on page one
keeps starting the game. The backdrop click stays.

**Trap.** The stack must still fit 1280x720 and 900x620 with the footer above
the fold; the legend shrinking pays for the extra button. Two filled accent
buttons on one card is the thing the `.alt` variant was written to prevent;
on a file the pair is carry-on (filled) and choose (outline), on a fresh file
it is Begin (filled) and choose (outline). Never two filled.

**Verify.** Buttons on page one: exactly two on a fresh file, two on a file.
`qa/uimobile.js` click-through starts a chapter from the new button. Tab
order: Begin, Choose, then the fold. `AUD-p1-*` re-shot at all five sizes.

### 4. The same fact three times, and six small-caps labels a screen

**What you see.** "19 places, in any order" on the page-one subtitle, on the
page-one button subline and on the page-two header. Four small-caps labels on
page two above the tiles. At 390 the subtitle wraps to leave "SUPERVISION"
alone on a line and the rail leaves "N MUSIC" alone on another
(`AUD-p1-390.png`).

**Build.** Every visible string, with a disposition:
- page one subtitle "one capybara, 19 places, no supervision": keep; add
  `text-wrap:balance` to `.capyui-sub` and `.capyui-h2`;
- page one button subline "19 of them, in any order": cut (opportunity 3);
- page one "how to be a capybara": keep, it becomes the only label on the page;
- touch footnote "tap to begin · sound and settings are behind MENU, once you
  are in": becomes "Sound and settings are behind MENU once you are in";
- page two header stat on a fresh file, "19 places / in any order": cut; the
  shelf shows nineteen. On a file the stat ("N of M done / N of 19 places
  seen") is information and stays;
- page two "or go straight somewhere else": cut; the shelf under a hero that
  says "start here" is already the alternative;
- page two hero eyebrow "chapter one · start here": keep, single-spaced around
  the dot, the one eyebrow on the page;
- page two hero third line "19 things to do, and nobody watching": keep the
  words, lose the small caps and the accent colour; set it in the tile's own
  italic hint style so the hero has an eyebrow, a name, a hint and one line
  of voice;
- page two footnote "every place has its own key, printed on the corner of
  its picture": keep.

Middle dots inside the legend ("dive · deep water", "look around · zoom") are
verb lists and stay; the double-spaced `  ·  ` in the eyebrow and the
footnote go.

**Trap.** `.capyui-p2head` is a three-column grid with the heading optically
centred by equal outer columns; cutting the stat's text must leave the third
column in place or the heading drifts left. The strings live in
`systems.js` (`'one capybara, '`, `'of them, in any order'`, `'chapter one'`,
`'or go straight somewhere else'`), and one of them in `sysTitleFoot`'s touch
note; grep rather than scroll.

**Verify.** `qa/title-measure.js` lists every uppercase leaf under the card:
page one at most 2 labels plus keycaps, page two at most 2. No orphaned
single word on any line at 390. Re-read every string on both pages once,
aloud, before committing.

### 5. The hero on page two is a picture and 600 px of paper

**What you see.** `AUD-p2-1920.png`, `AUD-p2-hover-1440.png`: the chapter-one
row is a 411 px picture on the left and a 617 px panel on the right holding
four short lines pinned to its left edge, an arrow 500 px away on its right
edge, and the tint wash running down the panel over the paper's diagonal
rake, which at that width reads as a stain rather than as light.

**Why.** The hero was widened to 1140 with the card; its picture stayed at
40 %. The `--pt` wash is `180deg`, a vertical fade meant for a 150 px tile
where the picture sits above the words; on the hero the picture is beside
them.

**Build.**
- Picture to 56 to 58 % (`.capyui-pick.hero .capyui-pickart{flex:0 0 57%}`);
  the `64 / 25` letterbox keeps the height, the `xMidYMid slice` crop shows
  more harbour.
- The word panel gets `max-width:36ch` and the wash turns through 90 deg on
  the hero only: `linear-gradient(90deg, var(--pt) 0%, transparent 32%)`,
  light spilling out of the picture's right edge into the words.
- The arrow stays on the far edge (the whole row is one press and the arrow
  says so) but the panel's right padding is relaxed now the text block is
  narrower.
- The 520 px column layout (`flex-direction:column`) is untouched.

**Trap.** `.capyui-pick.hero .capyui-pickart{aspect-ratio:64 / 25}` is
restated later in the sheet at equal specificity on purpose (the v-notes on
source order); a new width rule must be stated after it or it loses. The 770
px budget sets the hero to `min-height:96px` and the art to `64 / 20`; shoot
1280x720 as well as 1440.

**Verify.** `qa/uiclose.js`'s hero clip at 1440 and a 1920 clip. The Opera
House in the crop, the text block inside 36ch, no diagonal band across the
panel. `qa/uicontrast.js` unchanged (the hero body's text sits on the same
`--pt` 0.15 as before).

### 6. The arrival and the page turn are cuts

**What you see.** On boot the card is simply there; only the shelf's tiles
deal in. Pressing "Choose a place" swaps one page for the other in a single
frame (`titlePage` toggles `hidden` and a class). The exit, a 0.75 s fade and
scale to 1.06, is the one transition on the screen and it is good.

**Why.** Nobody wrote the other two. The card's whole conceit is a printed
sheet dealt onto a table, and a sheet that is dealt arrives.

**Build.**
- Boot: `.capyui-card` from `translateY(14px) rotate(-2.2deg)` and opacity 0
  to rest over `dSlow` on `mGlide`; the second sheet (`:before`) 80 ms behind
  it; masthead, subtitle, ornament, buttons, legend staggered 50 ms apart on
  the `--i` idiom `capyui-deal` already uses. No sound: there is no gesture
  yet and the rule is that the card makes no sound until there is one.
- Page turn: a 260 ms crossfade with 8 px of slide, page one leaving left and
  page two arriving from the right, reversed on back. `hidden` cannot
  animate, so it is a `.leaving` class, then `hidden` on `transitionend` with
  a 320 ms timer as the fallback. Focus management and the `scrollTop` reset
  in `titlePage` stay exactly where they are.
- All of it inside `prefers-reduced-motion: no-preference`; the global reduce
  rule at the top of the sheet already collapses transitions to 0.01 ms.

**Trap.** The shelf's deal-in is an `animation ... forwards` on
`.capyui-pick` and was made a class toggle precisely so it can never run
twice; the page-turn classes must not touch `.capyui-pick` or reset its
animation. The two-sheet stack is `z-index:-1` inside the card's stacking
context; an `opacity` on the card during arrival creates no new context that
breaks it, but a `filter` would. Under `zoom` (opportunity 2) transforms are
in zoomed pixels; check the arrival at 1920 as well as 1440.

**Verify.** Screenshots at 0, 120 and 400 ms after boot and after each turn
(`qa/uiclose.js` shows the idiom: hover, wait, clip). Emulate
`reducedMotion: 'reduce'` and screenshot at 0 ms: the end state only. Card
rect before and after the arrival identical to the pixel: no layout shift.

---

## The batches

Each is one session, one commit, one paragraph in `CONTRACT.md` under a new
heading **THE TITLE (T1 to T3)** next to "THE FRONT DOOR (v52)". Commit
messages in the repo's style: `T1: the world behind the card`.

### Batch T1: the world behind the card (opportunity 1)

**LANDED 5 Sep 2026.** All three must-lands and the spill. Pitch 41 to 16.5,
boom 9.5 to 13.5 m drifting, the animal from NDC x 0.000 to 0.38 / 0.49 / 0.55
at 1920 / 1440 / 1280, bubbles on the title screen from a peak of 3 and
fourteen distinct lines in thirty seconds to zero and zero, frame time
unchanged at 16.7 ms. Contract section **THE TITLE, BATCH ONE (T1)**.

Three things the batch found rather than fixed, all in the two lines that slide
the animal sideways: **a delta subtracted from a damped value integrates**
(it converged at twelve times the ask and threw the animal to NDC 2.73);
**NDC spans 2, not 1**, so the card's half-width is `w / vw` and the
screen-fraction version put every window under the floor; and **a fixed world
offset is the wrong kind of number** — 4.6 m read as 0.42 at 1920 and 1.64 at
390, off screen, because a narrow aspect throws the same metres further out.
The offset is now solved from the frame.

**And the blur went to zero, which is not what was planned here.** The A/B said
2 px; the pictures said 0. The card's separation was never coming from the
blur, so the property is gone entirely and the world is sharp behind it.

Two things this batch could NOT finish, both waiting on T2's offset: at 1280
the animal clears the centred card by 30 px, and at 390 it does not clear it at
all (`sysTITLE_NX_MAX` keeps it on screen behind the card, which is the honest
ceiling on a phone). The decision T1 owed T2: **the animal stands on the
RIGHT**, so the card goes left.

**Must land.**
1. The title pose in the rig, with its hand-picked yaw and the blend into
   play on `startGame`.
2. The wash: tint, scrim, vignette, blur chosen by A/B from PNGs.
3. Bubbles hidden while the title is up.

**Spill, in order:** the drift; `html.capy-calm` switching it off.

**Verify.** As opportunity 1. Plus: the decision about where the animal stands
is made here and written into the CONTRACT paragraph, because T2 puts the
card on the other side of the frame and both have to agree.

**Trap.** A pose chosen at 1440x900 has a different crop at 390x844; the
phone keeps the card centred (T2), so the animal must read at both, or the
phone gets its own yaw. Shoot both before choosing.

### Batch T2: the sheet on the table (opportunities 2, 3, 4)

**Must land.**
1. `--ui` and `zoom`, with the offset on wide page one and the glow
   following.
2. Begin above the legend; the legend one size down; the rail pruned.
3. Every string in opportunity 4 dispositioned; `text-wrap:balance`.

**Spill, in order:** M and N into the extras fold; the touch footnote.

**Verify.** As opportunities 2 to 4. The seven fold sizes re-shot.
`qa/uicontrast.js` re-run because the legend changed size. Run the
`web-design-guidelines` skill against `sysBuildCSS()`'s title block before
finishing, as `CLAUDE.md` asks.

**Trap.** Three opportunities in one batch because they are all the same
forty lines of CSS and thirty of DOM; do not split the commit by opportunity
or the middle state has a card with two filled buttons.

### Batch T3: the hero and the turn (opportunities 5, 6)

**Must land.**
1. The hero's proportions and its turned wash.
2. The arrival and the page turn, with the reduced-motion end state proven.

**Spill:** none. If time is short, ship the hero and leave the turn as a cut;
a cut is honest and a half-built transition is not.

**Verify.** As opportunities 5 and 6.

---

## Constraints that override taste

- **The aesthetic law** (`CONTRACT.md`, "Aesthetic law"): no textures, no
  image files, colours from `PALETTE` only, never a hex outside `shared.js`.
  Every new colour above is an existing `PALETTE` entry through `sysRgba`.
- **`dist/` runs from `file://` with the network off.** No CDN, no font link,
  no fetch. See `capy3-the-front-door` in memory.
- **Reduced motion.** The global rule collapses every HUD animation; anything
  new goes inside `no-preference` as well, so the end state is also the
  designed state.
- **Contrast.** WCAG 1.4.3 at 4.5:1 on every string on the card; the tint
  ceiling was measured at 0.15 for exactly this reason
  (`capy3-light-on-the-shelf`). `qa/uicontrast.js` is the verdict.
- **The 720p budget.** A 1280x720 laptop is the commonest window this game
  opens in; the footer stays above the fold there and at the other six sizes.
- **Touch is not a class.** A touch probe emulates the media query
  (`Emulation.setEmulatedMedia`, `setTouchEmulationEnabled`) and starts with a
  `pointerdown`; any synthetic `keydown` retires the touch layer
  (`capy3-the-front-door`, instrument 4).
- **Never a bare velocity write, never a bare camera write.** The title pose
  goes through the rig's own targets and damps.

---

## Instruments, and how to run them

```bash
PORT=5188 node server.mjs
```

```bash
npx playwright-cli close-all
```

```bash
npx playwright-cli -s=t open http://localhost:5188/
```

```bash
npx playwright-cli -s=t run-code --filename=qa/title-audit.js
```

- `qa/title-audit.js`: both pages at 1440, 1920, 1280x720, 390, plus a hover
  frame, into `qa/AUD-*.png`. The before set is in the tree now; re-run after
  each batch and compare.
- `qa/title-measure.js`: card, wordmark, button, legend and hero rects at
  1920; every uppercase leaf on each page; camera and capybara positions;
  bubble count. Writes `qa/aud-measure.json.png` through the `/shot` sink.
- `qa/titleshot.js`, `qa/uiclose.js`, `qa/uicontrast.js`, `qa/uimobile.js`:
  the v38 set, still current.

Harness traps that bite on this screen specifically: `navigate` to the loaded
URL does not reload, so `close-all` then `open` after every source edit
(trap 5); the first `run-code` after `open` may fail, run it again (trap 3);
`addInitScript` persists for the whole `-s=` session (trap 19); `btoa` does
not exist in `run-code`'s own scope, encode inside `page.evaluate` (trap 17).
Finish with `playwright-cli close-all`.

---

## Not in the six, and why

- **The typeface.** `"Trebuchet MS","Segoe UI",system-ui` renders three
  different ways on three platforms and Trebuchet is the one that was
  designed for. A subset woff2 inlined as base64 by `build.mjs` (about
  25 KB) would fix it and would not break `file://`. It is not a texture and
  not an image, but it is the first asset file in a project whose law is that
  there are none, so it is the author's call and not this pass's.
- **The name.** "Untitled Capybara Game" is the joke and the joke stays.
- **A video or a painted key art.** Forbidden by the law and unnecessary: the
  live world is better than a picture of it, which is the whole of
  opportunity 1.
- **A settings page on the card.** Sound and settings live behind MENU in
  play; the card says so and should not grow a second copy.

---

## Definition of done

- All three batches committed; `CONTRACT.md` carries the T1 to T3 paragraph.
- `qa/title-audit.js` re-shot: the world behind the card is recognisable as
  a harbour with the animal in it at 1440 and 1920; the card is on the left
  third at both and centred at 390; page one shows Begin above the legend.
- `qa/title-measure.js`: 0 bubbles while the title is up; at most 2 uppercase
  labels per page plus keycaps; wordmark 26 to 30 % of the width at 1920.
- The footer above the fold at 1280x720, 1280x760, 1366x768, 1600x900,
  1920x1080, 900x620, 390x844.
- `qa/uicontrast.js`: every row at or above 4.5:1.
- Reduced-motion emulation shows the designed end state at 0 ms.
- Touch emulation: two buttons, no keycaps, a chapter starts from Begin.
- 0 console errors; frame time at the title within 0.5 ms of today.
- `web-design-guidelines` run against the changed block; `playwright-cli
  close-all` run last.
