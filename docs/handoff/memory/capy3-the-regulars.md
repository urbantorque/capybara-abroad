---
name: capy3-the-regulars
description: "O1+O2: pointing at a local that has no id, two frozen-across-chapters bugs, and why a gift is set down rather than thrown"
metadata: 
  node_type: memory
  type: project
  originSessionId: a3c28ee5-fd4b-4f8e-b699-73fd732dbf2e
  modified: 2026-09-09T00:40:30.329Z
---

Built 9 Sep 2026, ROADMAP-NEXT item 1, first batch. Code: `npc.js` THE
REGULARS, `systems.js` jrChapPal. Instruments `qa/o1-static.cjs` (the one to
keep), `qa/o1-earn.js`, `qa/o1-all.js`, `qa/o1-far.js`, `qa/o1-calm.js`.

**A LOCAL RECORD HAS NO ID.** No name, no kind, no key — `addLocal` takes
coordinates and lines and returns something identified by nothing. Pointing at
one by INDEX is the api-key mismatch waiting to happen; by a NEW FIELD is
seventeen biome files edited. It is done **by a substring of the person's own
first line**, which makes the table read as a cast list and fails loudly:
`qa/o1-static.cjs` asserts all seventeen `find` strings match exactly one line
in exactly one chapter file, and caught four ambiguous ones immediately
(`Lulada` appears 30 times in cali.js, mostly as `caliLuladaMesh`).

**SEVENTEEN, NOT NINETEEN. Sydney and Pasto register ZERO `game.locals`** —
their people are the steering cast (`humans`/`paHumans`) and they walk. This is
the fourth pass to be caught by npc.js's two collections; see also `sayNear`,
`peopleNear` and `localsReact`.

**TWO THINGS FREEZE THE MOMENT YOU LEAVE A CHAPTER, and both were invisible:**
 - **`fam`** — the only thing that decays it is a loop the chapter is gated out
   of. MEASURED: 0.618 for two minutes in Kyoto, to four decimals. This is F3's
   `wary` bug with the sign flipped, and it made tiers 2-5 free. Cleared in the
   same `biome:enter` loop, three lines below F3's own.
 - **`talkCd`** — set on a local by `saySomebodyNear` (`rand(10,22)`) and
   decremented ONLY in `stepHuman`, which is Sydney's and Pasto's roster. So
   **every local in seventeen chapters had exactly one addressed line in them
   for the life of the session.** MEASURED: 20.0 for forty unbroken seconds.
   `sayNear` picks the nearest FREE speaker, so a chapter goes quiet from the
   middle out. It capped B15's rumour and every `game.sayNear` call.

**A TIER IS 24.4 s OF SITTING STILL** (fam crossing npcFAM_HEAT — the calm read
on one person), identically in four chapters. **It must LATCH on the crossing:**
in the same runs `wary` spiked to 0.5-0.97 at 25-30 s off a `prop:impact` inside
`npcWARY_BLAME` of a MOTIONLESS animal, and wiped `fam` in two of four. The
blame radius is a radius, not an accusation.

**A REGULAR HAS TO BE SOMEBODY THE ANIMAL CAN SIT BESIDE.** Eight bearings at
2.4 m: at Manly's chip shop the animal WEDGED on two — `restT` flat at 0.0, so
the calm never starts and the tier is unreachable from that side — and slid up
to 5.5 m on three more. The lifeguard wedged on none. Also measured: the calm
per chapter at the spawn, Kowloon 0.593 and Manly 0.775 against Kyoto's 0.996,
so a tier costs 25 s in most places, 90 in the Antarctic and 105 in Kowloon.

**ONLY 12 OF 17 REGULARS ARE WITHIN EARSHOT OF THEIR SPAWN** (the Drift's is
26 m, Son Doong's 31, the Pantanal's 32). Nobody was moved: the tier line is
ARMED like B15's rumour and waits. A rumour wants ANYBODY, so it goes through
`saySomebodyNear`; this wants ONE NAMED PERSON, so it cannot.

**Probe notes.** `page.addInitScript(localStorage.clear)` persists for the life
of the playwright-cli SESSION, not the run — an earlier probe's init script
wiped the save two probes later and made a working restore look dead;
`close-all` between suites. `anchor.lastLine` is never written by `sayBubble`,
so a probe reading it measures silence in a chapter that is talking — wrap
`anchor.speak` instead. `game.npcs` is Sydney's cast, the module API is on
`game` directly (`game.placeHeat`, not `game.npcs.placeHeat`).

## What the friendship buys (O2)

**A GIFT IS SET DOWN, NOT THROWN.** B8 lobs a snack underarm and that is right
for a snack. Dropped the same way, EIGHT of the seventeen regulars’ own things
destroyed themselves on landing — fragile (cuencobowl, mug, winebottle,
sunglasses, phobowl) or spill (chips, coffee, flowers). Set down at rest height
all seventeen survive and stay grabbable, so no chapter needs a fallback. Also
better fiction: a stranger throws you something, somebody who knows you puts it
on the ground and looks away. **One at a time** — test where the thing IS, not
whether an event fired; five minutes at tier 3 left three bottles on the
pavement.

**THE FAVOUR IS THE INTERLOCK BACKWARDS.** `wary` over npcWARY_HEAT shuts the
whole charm economy down and nothing in the game could ever buy it back. At
tier 4 one person stops holding it against you: ×0.25 on the wariness WRITTEN
at the three local sites (bang, barge, graze-owner), and NOT on `alarm`, the
flinch or the line — soft feet had to do the same or the world stops reacting.
Measured: an identical bang leaves 0.509 at tier 3 and 0.126 at tier 4.

**HAND THE TIER OVER BEFORE THE "NOBODY KNOWS YOU HERE" RETURN.** systems.js
owns the number (it is on the save file); npc.js owns what it MEANS (the same
kind of thing as the line pool). `palSet(t)` must be called on every
`biome:enter` INCLUDING tier 0, or the last chapter's tier is still live and the
favour and the gift follow the player into a place where nobody has met them.

**PROBE TRAP, expensive: `localStorage.clear()` + `page.reload()` DOES NOT CLEAR
THE SAVE.** The reload fires `pagehide`, the flush is unconditional, and the
live in-memory journey is written straight back over the clear. Symptom: tiers
in chapters the probe never visited, and five tiers out of three visits — which
reads exactly like the one-per-visit rule being broken. Reload, THEN clear, THEN
reload. Also: the ledger is `hud.ledger()` + Escape (no key opens it), and it
PAUSES the game, so npc.js is not ticked while it is up.

Related: [[capy3-the-locals]], [[capy3-gossip-and-the-poster]],
[[capy3-noticed-and-given]], [[capy3-the-perch]], [[capy3-sleep-on-it]],
[[capy3-names-nothing-publishes]], [[headless-qa-harness]]
