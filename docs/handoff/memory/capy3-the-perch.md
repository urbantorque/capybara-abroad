---
name: capy3-the-perch
description: "N1: everything sits on the capybara — a passenger is a pose not a body, and the two herd offers that reported a healthy count while moving nothing"
metadata: 
  node_type: memory
  type: project
  originSessionId: a3c28ee5-fd4b-4f8e-b699-73fd732dbf2e
  modified: 2026-09-08T14:05:14.826Z
---

Built 8 Sep 2026, ROADMAP-NEXT item 2 batch one. Code: `systems.js` THE PERCH,
`capybara.js` THE SEATS / `capy.back()`. Instruments `qa/n1-herd-y.js`,
`qa/n1-perch.js`, `qa/n1-shots.js`. Pictures `qa/N1c-*.png`.

**A PASSENGER IS A POSE, NOT A BODY, AND THAT IS THE WHOLE DESIGN.** Every
other ride in this game is a kinematic body and capybara.js damps whatever it
stands on to a stop — see [[capy3-carriers-that-drop-you]]. A perched animal is
written once a frame from `capy.back()` exactly the way a led animal's ground
position is written, so the carrier problem cannot arise. Measured error
against the seat: **0.000 m through four seconds of walking in all six
chapters.** `game.perchDebug().kinds[].err` re-reads the chapter's own `at`
after the `put`, which is the only way to see a write the chapter overwrites.

**THE OFFER GREW TWO OPTIONAL FIELDS.** `lift(i, y)` — called every frame while
riding and never otherwise, the `capy.loafAsk` shape, so a system that stops
writing cannot strand an animal in the air — and `span` (1 or 2 of three
seats). A kind with no `lift` cannot be perched, which makes the refusals a
property of the registry rather than a rule to remember. Six ride: Sydney ibis,
Venice pigeon, Göreme cat, Kyoto heron, Manly gull, Antarctic gentoo. Iceland's
ewe (45 kg) and the Pantanal's cow (half a tonne) are refused on weight.

**SEATS COME OFF `capyHULL`, NEVER AUTHORED.** Three at model z 0.06/−0.16/−0.38,
all aft of the ears (ears reach 0.278). `capy.back(i, out)` takes a FRACTIONAL
index so a span-2 animal sits between two, reads `capySquash.matrixWorld`, and
therefore carries the loaf drop, breath, lean, squash and render smoothing for
free. Measured 0.72 m over the feet standing, 0.57 loafing. R2 raised the
shoulder 11 cm and buried two costume lapels that had been fitted by hand —
see [[capy3-the-hull-and-the-head]].

**TWO OFFERS HAD NEVER WORKED AND BOTH REPORTED A HEALTHY COUNT.** This is the
failure mode to look for in every `*Offer` in this repo:
 - **Antarctica**: `herdDebug()` said 42 gentoos, `first` at **x 0, z 0** — the
   origin, 50–90 m from where any are drawn. The birds past `antPENG_COL` walk
   `antHIGH` and that branch computed x/z into LOCALS and wrote neither back.
   `at` read a seed nothing wrote; `put` wrote a slot nothing read.
 - **Manly**: ten gulls joined on two wheeks and never moved, `near` 30.9 m.
   `put` refused whenever the bird was above `manPROM_Y + 0.6` — which is what
   an awning IS. **The note forty lines below in the same file already said
   "the state is `up`, and the state is what has to be asked"**; the draw had
   learnt it and the two writers had not. The flock's `put` was identical, so
   nothing had ever walked to a dropped chip either.
 - And a third the perch found: `manGullUp` goes to 1 whenever you are near the
   Corso, so `put` stopped writing a perched gull while `lift` kept writing its
   height — error climbed 1.35, 3.35, 5.35, 7.35, 9.35 m in four seconds, at
   exactly walking speed. **A linear error at the walking speed means one of a
   pair of writers has been switched off.**

**THE HERON IS PERCHABLE ONLY BY AN ANIMAL THAT CAN FLOAT.** Both wade points
are inside `kyoPOND` (68 × 44 m) and herd earshot is 15 m, so a 24-candidate
dry-land ring round the bird found nothing — `swimming: true`, `loaf: 0` for
thirty seconds against a loaf that is fine. The Pantanal's `float` (ten
chapters later) is what lets the loaf run on water. Nobody wrote that gate and
it is the best fact in the batch.

**AND IT WAS UNPERCHABLE BY ARITHMETIC BEFORE ONE CHANGE.** A led heron walks
the trail INTO its own 9 m flush radius, and `kyoHERON_REST` is 26 s against a
recruitment that takes 15 and a loaf that takes 10: measured `led: 1` at t=0 and
`led: 0` by t=18, every run. Both are now suppressed while `kyoHeronHeld` is up,
which the herd's own `put` re-asks — so it is only ever up while systems.js is
actively walking that bird.

**THE RECORD CANNOT BE BUILT AS THE ROADMAP ASSUMES.** A `RECORDS` key has to
be a TASK id (the chapter board and the picker both do `RECORDS[taskId]`), and
"most on at once" is not a task. Same trap as
[[capy3-names-nothing-publishes]].

**TWO PROBE TRAPS, both trap 40's family** ([[headless-qa-harness]]):
 1. **Pinning the body's Y as well as X and Z leaves the animal off the
    ground**, `capyBusy` never clears, `restT` stays 0.00 and the loaf never
    comes — against a loaf that works. Pin x and z; let y settle.
 2. **A 48-candidate stand-point ring at 80 ticks each is 64 s of world time.**
    It flooded the Venetian square, walked the Manly gulls out of earshot and
    bled every heard counter to zero, and five of six chapters reported a
    mechanic that had worked the run before. Search only where you must.

## N2 — what it is worth (same day)

**THE HOP RULE WAS A KERB.** N1 dismounted on `!capy.grounded` for 0.14 s and
the median carry was **3.5 m**; all fifteen legs of `qa/n2-carry.js` ended in
`hop`. The animal is off the floor for **51 to 100 per cent of an ordinary
walk**. Reading vy instead was also wrong: **something in the walk cycle is
worth 2.9 m/s upward**, to two decimal places, in nine of fifteen legs — a
threshold between it and `capyJUMP_V`'s 6.0 exists and picking one is guessing.
The honest test is `input.jumpPressed` (a kerb cannot press a key) plus a vy no
gait produces, for the world throwing you. A plain fall is neither. After: 14 of
15 legs held the passenger for the whole walk.

**AND `prop:impact` FIRES ON A LANDING, NOT ONLY A HIT.** A pebble the animal
scuffed a second earlier, coming down two metres away, was unseating passengers
— two of three Antarctic legs at 15 m with the animal walking. A barge needs
three terms: the impact speed, the distance, AND the capybara's own speed.

**THE NUMBER IS NOT A RECORD.** A `RECORDS` key must be a TASK id (the board and
the picker both do `RECORDS[taskId]`), and "most on at once" is not a task. It is
`pas` on the save (the `pho`/`fed` shape) and one line on the ledger leaf. And
the "passenger book" cannot be a grid: every ridable animal exists in exactly
one chapter, so 19 x 6 is six cells and thirteen blank rows.

**FIVE MORE PROBE TRAPS, four of which were the probe:**
 1. **Writing `body.velocity` is not walking** — the idle grip damps at lambda
    60 and the snap zeroes anything under 0.9 m/s: 1.5 m in forty seconds.
    Dispatch a real key event on `window`.
 2. **A pin is right beside an ANIMAL and wrong beside a PERSON.** npc.js shoves
    the capybara out of a local's space every frame; a pin that snaps it back
    reads as walking, and `restT` measured 0.0 for 100 s in four chapters
    against a loaf that is fine.
 3. **The locals are not in `game.npcs`** — `game.locals` is their own cast and
    `r.fig` is the photograph's first gate. Photographs went 0 to 4 per two
    minutes on that one line.
 4. **A local's last line is `rec.last`, not `rec.lastLine`** (which exists, on
    the ibis). A control that is ALSO empty is a broken instrument, not a clean
    result — that is the tell.
 5. **`rec.last` survives a chapter change**, so only the first run of an A/B
    sequence is a clean control.

## N3 — the stowaway (same day). Item 2 closed.

One animal crosses a border on the back. All six ridable kinds travel.

**THE EXPENSIVE HALF WAS THE DRAWING, NOT THE RULE.** The herd drops everything
across a chapter change partly for sense and mostly because **the chapter that
draws the animal is detached, hidden and not in the update list once you leave
it.** So a travelling animal needs a standalone drawable: `stow(i)` on the herd
offer, built by the chapter from its OWN geometry and materials, added with
`THREE.Object3D.prototype.add.call(scene, obj)` (main.js claims anything added
under a capture tag — a stowaway captured into the chapter it stands in vanishes
next time you leave), and **cached one per kind for the session** so six
crossings allocate one pigeon. 4–14 lines per chapter. Nothing cloned but the
heron's group; `Object3D.clone` shares materials by reference, which is the only
safe copy in this repo ([[capy3-clone-eats-the-shader]]).

**MAIN.JS HAD NO "BEFORE" EVENT.** `biome:enter` fires on the far side.
`biome:leave` (new, emitted before `onExit` and before the detach) is the only
frame on which anything can ask a chapter for something on the way out. Worth
knowing for any future mechanic that has to survive a crossing.

**A STOWAWAY IS NOT A PASSENGER.** `perchCount()` is what the finds and the leaf
read, and a place's number is a claim about that place: one pigeon carried round
the world would put "carried a passenger" on all nineteen leaves with no local
animal ever having climbed on. It takes a seat and counts for nothing else.

**FOUR MORE PROBE TRAPS, all four the probe:**
 1. A wait loop on `perchCount() >= 1` **breaks on the mount frame**, and
    `perchRISE` is 0.55 s of climbing after that. The stowaway refuses a
    passenger still on its way up (correctly), and the first run reported
    `seated: 0` in all six chapters against a mechanic that worked.
 2. **One at a time ate the second leg** — a leftover stowaway makes
    `biome:leave` return early, correctly, so leg two reported nothing.
 3. **`switchTo` does not move the animal** (that is `biomeGo`), so it arrives
    at the PREVIOUS chapter's coordinates and is as likely to be in the sea as
    on a floor. Two of six legs reported a stowaway surviving a launch, which is
    correct (swimming is not a dismount) and reads as a broken rule. Use
    `spawnOf(to)`.
 4. A Space press is not a reliable dismount from a probe, for the same reason.
    `capy.launch(0, 8, 0)` is deterministic.

`game.stowDebug()` splits `canStow` / `on` / `seated` because "no drawable",
"nothing on the back" and "still climbing" look identical from outside — two of
the four above were exactly that.

Related: [[capy3-the-herd-anywhere]], [[capy3-the-herd]], [[capy3-the-wardrobe]],
[[capy3-clone-eats-the-shader]], [[headless-qa-harness]]
