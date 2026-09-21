---
name: capy3-the-big-ones
description: "The 11 Sep 2026 marquee pass (W1/W2): wow rows are NAMES not places, game.wowLive() is the live channel, and nine chapters got a new beat — with the traps found doing it"
metadata: 
  node_type: memory
  type: project
  originSessionId: 2fb1f952-10b8-48b0-92a5-c0aa28996afa
  modified: 2026-09-11T07:15:04.165Z
---

Asked for: every marquee ≥ 4 stars, ≥ 12 of 19 a genuine wow, and the big
ones named so a player knows what they are about. CONTRACT.md "THE BIG ONES"
has the table. Commits 5b36180 (W1) and 36d45b7 (W2) on `lift-pass`.

**`wow:` IS A NAME NOW** (THE CONDOR RIDE, THE AURORA, THE TRAIN ALLEY), the
task text is a plain verb sentence, and the signpost prints the name in the
biggest type and STAYS UP while the row is on the paper (`.capyui-marq.row`
hides only the sentence). The `wow` string is only ever a caption — nothing
keys on it — so renaming was free.

**`game.wowLive(line, t)`**: every frame, 0.7 s watchdog, like recordLive.
Eyebrow → "the big one · now", live line, optional bar. Music through
`musLiveSet(k)`/`musLiftNow()` — NOT `musSwell`, which re-arms the lift
arpeggio every ~5 s when held and would play it twelve times in a condor
ride. No aria-live on a per-frame line.

**W3 (same day): `xSay(t)` → `game.say(t)` was a silent no-op in goreme, kowloon, palawan, venice** (a one-arg call into `sayAt(x,y,z,text)`) — the balloon's "hold E for the burner" line had never been shown. Grep `\.say(t)` before trusting any chapter's instruction line; use `game.control(s)`. The signpost now prints the wow clue (`.capyui-marqhow`); all 19 marquee clues are step-by-step with the key in them, eleven state-aware.

**Traps found:**
- The wheek startles humans within 20 m — including the audience it just
  called. A gathered/quiet record must be exempt (hop in place).
- `kyoRiverSeg`/`kyoRiverNear` return SHARED objects; and the Uji hook comes
  back within 11 m of the mill pond, so the run's finish had been firing from
  the outbound reach ~100 m early for as long as it existed (`nr.s > len−30`).
- `capyLaunchT` did not exempt the swim buoyancy damp: a launch out of water
  measured 0.58 m of rise for 4.6 m/s. It does now (capybara.js).
- A rotated slab arc in the (z,y) plane wants `rx = −a − π/2` under three.js
  Rx; and never draw a barrel's back wall — it sits between the chase camera
  and the rider. Lip only.
- Sparks at 0.28 m are invisible at 60 m; size and life per spark.
- Hunt/concert state must reset on chapter entry — teleport probes carry it.
- Harness: `chuteAt`, `boatDebugTo`, `phaseDebug`, `barrelDebug`,
  `herdFollow` (seeds the trail too), `huntDebug`, `fireworksDebug` exist.

Ratings after (honest): 5★ Pasto, Quay, Kyoto, Cali, Rio, Marrakech, Drift,
Palawan, Manly, Pantanal, Sơn Đoòng, Antarctica, Monaco, Hanoi (14); 4★
Sydney, Iceland, Venice, Hong Kong, Cappadocia.

Related: [[capy3-the-lift]], [[capy3-the-depth-audit]], [[capy3-waist-high]],
[[headless-qa-harness]]

**W4 (same day), chill:** the user's bar is "easy in one go". The pattern that
worked: a chapter clock that the player is waiting on runs FAST while they are
in position and the marquee is open (HK ×6 on the roof, Venice ×5 in the
square, Cappadocia ×4 aloft, Hanoi ×3 in the alley) — a time-lapse never
snaps, and it keeps the loop's own rhythm once ticked. Punishments that eject
you from the set piece (Cali's cable sweep) become knock-downs that cost the
tally. Ticks that waited for a finale move to the moment the thing is visibly
done (HK: sixteen lit). Manly's sand is 24 m, not the 34 m par.
