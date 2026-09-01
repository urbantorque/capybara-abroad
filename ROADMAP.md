# What is between this and a thing you can publish

Written 31 Aug 2026, after a review of the whole tree and a measured pass over
the game as a stranger would meet it. Fifty-one versions of content, picture,
feel and audio work have gone into the nineteen chapters. **None of the four
things below are about the game.** They are about everything around it.

The headline is worth stating plainly, because it decides where the effort goes:

> **The game is finished to a much higher standard than the thing that delivers
> it.** Measured over all nineteen chapters — enter each one through the picker,
> drive it for nine seconds, sample seventy frames — there were **zero console
> errors, zero NaN positions, zero solver saves and 60 fps everywhere**
> (16.5–17.0 ms median, vsync-locked, on an Intel Arc 130V). Meanwhile the file
> the README told you to double-click could not start without a CDN, and when it
> could not reach one it said `warming up the harbour…` for ever, in silence.

---

## 1. It could not be handed to anybody — **mostly fixed**

Three separate failures all ended in the same place: the pale blue splash, for
ever, with nothing to read and nothing to click. All three were measured, not
guessed.

| what a stranger does | what used to happen |
|---|---|
| opens it behind an ad-blocker, an office proxy, or on a train | permanent `warming up the harbour…`, **no error at all** |
| opens it on a machine with hardware acceleration off | permanent splash + a monospace stack trace strip |
| opens `dist/untitled-capybara-game.html`, the file described in its own build header as "self-contained… runs straight from `file://` with no server" | it is not self-contained; it fetched Three.js and cannon-es from jsdelivr and hung |

**Done**

- `vendor/three.module.js` and `vendor/cannon-es.js` are in the repository, with
  versions, source URLs, SHA-256s and both MIT notices in `vendor/README.md`.
  The importmap points at them. **No third-party host is involved in starting
  the game any more** — verified by blocking every non-localhost request and
  watching it boot into Sydney with an empty error list.
- `build.mjs` inlines both, each in its own IIFE (they both declare a top-level
  `Material`, among others), strips the importmap, and **refuses to emit a
  bundle that still names a CDN**. It also re-checks that each library is
  import-free, single-export and alias-free before wrapping it, because a silent
  mistranslation of an export list would produce a bundle that boots and then
  dies deep in a chapter.
- `dist/untitled-capybara-game.html` now genuinely runs from `file://` with the
  network off. Verified: booted, 12.1 s of game time, 148 bodies, 49 props,
  three r169, zero errors.
- A real failure card, in the game's own palette, for all three cases — it names
  which one happened, what to try, and has a reload button. A 25-second watchdog
  armed at parse time catches everything that never reaches an error handler,
  and is called off by *a frame having been drawn*, not by a module having
  loaded.
- The MIT notices travel inside the distributable, which is what MIT asks for
  once you inline the code.
- `package.json`, and a rewritten **Play** section in the README that is true.

**Still to do**

- **A `LICENSE` file. This is the one remaining hard blocker and it is not a
  technical decision.** Without one, nobody who is handed this repository has
  permission to run, fork or modify it — "broader sharing" is legally
  ill-defined until there is one. `package.json` is deliberately marked
  `private` with no `license` field until that call is made.
- **Pick a host and write the deploy step.** Static hosting with compression
  (GitHub Pages, Netlify, itch.io) serving either the unbundled tree or `dist/`.
  Nothing about the game needs a server; there is simply no published address.
- **First-visit weight.** 9.0 MB raw, ~2.6 MB gzipped for the single file; the
  unbundled tree is 7.7 MB raw over 27 requests. Any real host compresses, so
  this is a second-order problem — but every chapter's builder is parsed at boot
  when nineteen out of twenty first visits only ever see Sydney. If the number
  ever matters, that is where the fat is, and the biome-streaming machinery in
  `mainMakeBiomes` is already the right shape to exploit it.

## 2. Nothing survived a bad environment — **fixed**

- **A lost WebGL context had never been listened for anywhere in the tree.** It
  happens on a driver reset, on a laptop waking from sleep, when another tab
  takes the memory, and on Windows whenever the GPU is preempted for more than
  about two seconds. The result was a black rectangle with the HUD still drawn
  over it and every key still working — the worst kind of failure, because it
  looks like the game is fine and the player is doing something wrong.
  `webglcontextlost` now `preventDefault()`s (without which the browser will not
  even *try* to give the context back), freezes the tick, and says so in words;
  `webglcontextrestored` picks the game back up.
- The pre-flight WebGL probe asks for **exactly the two contexts three.js asks
  for, in its order**. It used to fall back to `experimental-webgl`, which some
  browsers answer when they will not answer `webgl` — so the probe passed, the
  renderer then failed on its own request, and the player got the generic card
  instead of the one naming the cause. *A capability check that is more generous
  than the thing it is checking for is worse than no check at all.*

**Still to do**

- `window.__capySoftGL` is set when the page is on a software rasteriser
  (SwiftShader, llvmpipe) and **nothing reads it**. One toast, once, would turn
  "this game is slow" into "this machine is not using its graphics card".
- `localStorage` failing (private mode, quota) is caught everywhere and degrades
  silently. It should degrade *audibly* — a player in a private window is
  building a three-hour journey that will not be there tomorrow, and is never
  told.

## 3. Touch was about 60 % of a control scheme — **fixed**

The touch layer, the phone CSS, the safe-area insets and the gamepad map are all
thought through. What was missing was not the plumbing; it was that a phone
player was shown, and told to use, a scheme they did not have.

- The title card's control legend listed **seven keyboard keys**, every one of
  which names something a phone does not have. There is now a touch table, and
  it is chosen by the same media query the touch layer itself switches on, so
  the legend and the buttons cannot disagree.
- **Thirty-nine of the hundred and ninety-one hint clues name a key** — `press E
  at the fire`, `hold Shift and barge them`, `press Q, anywhere`. That is the
  most confusing thing a hint can do: the player believes it and goes looking
  for what they are missing. One substitution table, applied where a clue is
  resolved. Checked against all 191 strings before it was wired in — 39 rewrite,
  152 are untouched, no lone capital survives.
- **The slide** — a verb the capybara has, and four chapters lean on it — had no
  touch control. It has a fourth button in the fan now.
- **The stuck-rescue had no touch control.** `R` exists precisely so that a
  three-hour game does not have a state whose only answer is F5, and on a phone
  it had one anyway. There is a quiet `STUCK` button, deliberately not part of
  the action fan and parked under the chart where no thumb arrives by accident.
  Measured: held for 1.4 s it puts the animal 14.5 m back, on its feet.
- **Pinch to zoom.** The camera distance was the mouse wheel and the pad's right
  stick and nothing else, so on a phone it could not be changed at all — and the
  new touch legend advertised a pinch, which made it a lie the moment it was
  written. Implemented rather than retracted. Touch drags also now take their
  delta from the last position rather than `movementX`, which is a mouse concept
  and is not reliably filled in for touch pointers.

**Still to do** — *both closed by R5, 1 Sep 2026; see `ROADMAP-RELEASE.md`*

- ~~The title card's *foot rail* still shows `ENTER` / `→` / `M` / `N` keycaps on
  touch.~~ On touch the caps are no longer drawn; the rail says what the page
  wants in words instead.
- ~~**No touch route to the journal.** Travel is reachable (three wheeks opens the
  board), but the album, the ledger and the records are behind `Tab` only.~~
  One MENU button opens R4's pause card, and the journal, the ledger, the album
  and the records are all behind it.

  R5 also found the thing this list had missed, which was worse than either of
  them: **the departures board was a trap on touch.** Three wheeks at the way
  out opens it, it pauses the world, it had no pointerdown listener at all —
  the ledger and the album have both closed on a tap on their surround since
  they were built — and its own foot said "ESC to stay" to a device with no
  ESC. The only ways out were to travel, which is a real and irreversible move
  nobody asked for, or to reload a three-hour game.
- Decide honestly how far this should go. This is a nineteen-chapter, hours-long
  3-D physics game with a two-stick ferry helm, six-control condor flight and a
  beat-matching dance floor. **It is not a phone game and should not pretend to
  be one.** The work above is the difference between "the phone build is a
  courtesy that works" and "the phone build tells you to press keys that do not
  exist"; going past that is a design decision, not a gap.

## 4. The game itself — **not a gap, and worth saying so**

The temptation in a review like this is to find something wrong with the game
because that is where the work went. The measurements do not support it.

| | |
|---|---|
| chapters entered through the picker | 19 / 19 |
| console errors across all of them | **0** |
| NaN positions, solver saves | **0**, **0** |
| median frame time | 16.5–17.0 ms — vsync-locked at 60 fps in every chapter |
| adaptive resolution | already present, and correct: `sysMaxDPR()` scales the ceiling by pixel count, and a 2-second sampler walks the render scale down to 0.7 as low as 50 fps |

Two notes rather than findings. The render cost is entirely resolution-bound —
1.96 ms at 1280×720, 8.12 ms at 2560×1440, 17.4 ms at 3200×1800 — so the
adaptive scaler is load-bearing on any high-DPI display and is worth keeping an
eye on. And the triangle counts in the soak (139k–454k *including the shadow
pass*, so roughly half that in the chapter) put several chapters past the 130k
line in `CONTRACT.md`; that is already recorded there as deliberate, and frame
time does not care, but the budget section and the measurements have drifted
apart and one of them should be updated to match the other.

---

## The order to do the rest in

1. **`LICENSE`.** Everything else is optional; this one is the gate.
2. **Pick a host, deploy, and put the address in the README.** The game has been
   finished for a while and has nowhere to be.
3. The two silent degradations in §2 — the software rasteriser and the
   unavailable `localStorage`. Both are one toast each.
4. The touch loose ends in §3, if phones are in scope at all.
5. Reconcile the performance budget in `CONTRACT.md` with what is actually
   being measured.
