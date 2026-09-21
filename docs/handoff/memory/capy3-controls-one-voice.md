---
name: capy3-controls-one-voice
description: "capy3's control scheme after the Aug 2026 simplification — one voice key, and why the wheek and the whistle merged"
metadata:
  type: project
---

Settled 19 Aug 2026, replacing a scheme with two separate 'make a noise' keys.

    WASD / arrows  move          Shift  run (stamina-limited)
    Space          hop           E      grab / dig / mount / helm (+ left click, Numpad0)
    Q              WHEEK         Z / X  turn the camera (+ right-drag)
    C              camera behind you

**The wheek and the whistle are ONE button.** A capybara has one mouth; two keys for opening it
was the single most confusing thing in the scheme. `input.whistle` / `whistlePressed` are kept
as ALIASES of `honk` / `honkPressed` so every reader (condor.js, the three-call exit) works
unchanged — do not re-bind them to a key of their own. Context disambiguates: the noise startles
whoever is nearby, calls a condor if one is up there, flaps its wings while riding, sounds the
ferry's horn, and three of them at a departure point is the ticket out.

The one consequence to remember: the condor dismount had to move to the GRAB key alone. It used
to accept the whistle, and once the whistle became the wheek — which is also the flap — every
flap would have thrown the passenger off the bird.

**Nothing here changed on 21 Aug 2026 — but the PRESENTATION did.** The scheme is still
these eleven keys and every one of them still works. The front of the game now advertises
only the six VERBS and folds the rest away; see [[capy3-two-pages-and-a-chart]].

Related: [[capy3-progression-chain]], [[capy3-module-drop-failure]], [[capy3-two-pages-and-a-chart]]
