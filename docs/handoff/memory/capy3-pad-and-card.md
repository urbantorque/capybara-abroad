---
name: capy3-pad-and-card
description: "P2 — a pad could open every card and operate none, the slide key that closed the browser tab, and the three edge bugs in a menu driver"
metadata: 
  node_type: memory
  type: project
  originSessionId: 58965c1c-b475-4eb2-bd2b-46df963489e0
  modified: 2026-09-02T10:13:03.789Z
---

Batch P2 of `ROADMAP-POLISH.md`, 2 Sep 2026, commit `37b6aee`. Contract section
**THE PAD AND THE CARD — P2**.

## THE HARNESS THAT MADE IT MEASURABLE

A synthetic pad installed with `page.addInitScript` over
`navigator.getGamepads`, returning a fresh object each call (the game polls, so
a live `buttons` array must be re-read, not cached) plus `window.__tap(i, ms)`
and `__hold(i, ms)`. `qa/p2-pad.js`. It is the only way to test a controller
headlessly and it should be reused for any future input work.

## THE BASELINE

Three wheeks at the wharf raise the departures board, the world pauses, and
**all 17 buttons and both sticks in 8 directions leave it exactly where it is.**
Start stacks the pause card ON TOP. On the pause card focus never left
`resume`; faders read 100/100/100 throughout. R5's touch trap, one input surface
along.

## THE FIX, AND WHY IT DRIVES THE DOM

`sysPadCard(g, dt)`: d-pad walks `focus()`, A `click()`s the focused control, B
is Escape, left/right step a focused `input[type=range]`, Start on a card means
what B means. Runs BEFORE the verbs and returns early — A is both `hop` and
`press this`, the d-pad is both `walk` and `move down the list`. Everything it
does a keyboard could already do, so any control added to any card later is
reached for free.

## THREE BUGS IN THE DRIVER, ALL LOOKING LIKE GAME BUGS

1. **The button that opens a card is still held on the next frame.** A wheek is
   130 ms, a frame is 16. A zeroed edge state read the tail of the opening press
   as a fresh one and closed the board on the frame it opened — indistinguishable
   from "three wheeks stopped working". Seed the edge state from what is
   actually held; every button must be RELEASED before the driver acts.
2. **`button:not([disabled])` matches a button whatever its tabIndex.** The
   journal sets `tabIndex = -1` on all 19 souvenir slots deliberately. The pad
   walked the shelf and never reached a destination. Filter on `el.tabIndex < 0`.
3. **A card inside a card needs its own scope.** With the quit question open the
   four buttons behind it are still focusable, so one press down from "stay
   here" landed on a volume slider. `sysPadTopCard` returns `pauseAsk` when open
   — the order Escape already uses.

## CTRL+W CLOSES THE TAB AND NO PAGE CAN CANCEL IT

Slide was Ctrl-held. The chord fires whenever W is pressed while Ctrl is down,
which is exactly "hold slide, then push forward", and the teaching line said to
do that. **Slide is now G**; Ctrl is unbound, because there is no safe way to
keep it. C was the roadmap's suggestion and is taken (camera recentre,
documented, four probes press it); X/Z turn the camera, V raises the eye, F
re-aims, R is the rescue. G is free and one index-finger stretch from WASD.

## OTHER THINGS THAT WERE NEVER TRUE

- **`aria-modal` was declared on four cards and the DOM does not honour it.**
  The pause card's own comment claimed `inert` on the HUD kept Tab inside it;
  nothing ever set that. 3 of 14 presses left the card → 0 of 12 after
  `sysFocusWrap`, which shares the pad's focusable list so the two schemes
  cannot disagree. It must ALWAYS cancel the browser walk and move focus itself
  — the ledger and album preventDefault first for other reasons, and a wrap that
  only acts at the ends leaves focus pinned there.
- **`main.js` read `prefers-reduced-motion` once at boot into a private const**,
  so R4's calm switch moved the shake and the FOV kick and left `hitstop` and
  `slowmo` — the two that stop time altogether. Both now call `calmOn()`. So
  does `padRumble`. `calmSys` was also a const, so an OS change mid-session did
  nothing; `matchMedia`'s `change` event keeps it live now.
- The connect toast named 3 of 9 bindings and fired only on
  `gamepadconnected` — **which browsers do not dispatch for a pad already
  plugged in at load**, so a player who started pad-in-hand was told nothing.

## TWO PROBE DEFECTS THAT COST A RUN EACH

- **Matching text against `activeElement.textContent` matched the whole card.**
  The journal card takes focus when the board opens and its text contains every
  chapter name in the game, so `/Pasto/` matched on press one, A clicked the
  card, travel never happened — and four later assertions failed for that one
  reason. Assert on the element's CLASS as well as its text.
- **A freeze cannot be read while a card is open**: the card pauses the world
  and a paused world runs no time step. Reading `time.scale` 120 ms into a
  350 ms hitstop with the settings still up gave 1.0 both ways, which reads
  exactly like a freeze that never fires. Set the switch, close the card, then
  measure.

Verified: pad-only journey end to end (travel to Pasto by pad), rescue 21.9 m,
G slides and Ctrl does not, Tab 0/12 escapes, hitstop 0.08 vs 1 across the calm
switch, 191 clue literals with 39 rewritten and no other lone capitals, R1/R4/R5
green, 19/19 soak clean.

Left as spill: HUD text floors (8.5 px clue, 9.5 px task) — one CSS block plus a
phone screenshot pass, and it belongs with P7's type work.

Related: [[capy3-the-subject]], [[capy3-the-polish-review]], [[capy3-the-thumb]],
[[capy3-the-frame]], [[headless-qa-harness]]
