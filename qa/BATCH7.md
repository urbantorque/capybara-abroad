# BATCH 7 — escalation: the half of the mischief loop that was never built

> **Prompt:** `run qa/BATCH7.md`

Brief: `qa/LIFT-PROMPTS.md`. Predecessor: `qa/BATCH6.md`.
Chapters: all nineteen. Files: `src/npc.js`, `src/systems.js`.

Read `headless-qa-harness`, `capy3-catch-all-state` and `capy3-the-closeout` in project memory
before touching `npc.js`. This is the file where the last pass paid for four separate traps.

**This batch runs alone and last.** It is the only one with real design uncertainty, the only
one that needs tuning rather than landing, and it perturbs the NPC background that every
earlier batch measured against. Do not interleave it.

---

## The finding

Measured 26 Aug, Sydney, cleared save, real keys:

| | |
|---|---|
| one wheek | `state.chaos` **0 → 0.21**, back to **0.07 in 8.7 s** |
| readers of `state.chaos` repo-wide | **a music-layer gain, and the calm counter.** That is all |
| tasks that can be failed | **2 of 229** — Hanoi's crossing, Marrakech's souk chase |
| wariness | 26 s per person, and by explicit design **denies nothing** |

The genre this is styled after runs on one loop: approach, get seen, be driven off, come back
another way. **The first half is built here and built well** — `npcHeat`, the witness chain,
the wary lines (*you again*, *I know your game*), the 26-second memory, 477 conditional lines
over 17 casts. The second half does not exist. There is no state above the individual person,
so a square you have been tormenting for four minutes is exactly as easy to walk into as one
you have never visited.

That is why hour six plays like hour one regardless of what the player does. The list gets
shorter; the world never changes its mind.

**Marrakech is the only prototype and it is the only one.** Six traders who chase where they
last *saw* you, so a corner is worth something. Generalising that as a soft pressure rather
than as a chase is this batch.

---

## Job 1 — the accumulator

- [ ] **1a** One `heat` per place: rises with **witnessed** mischief, decays over 60-120 s.
      An accumulator sitting on top of the wariness that already exists, not a replacement
      for it. `game.npcHeat(x, z, r)` already answers "how many people near here are watching
      *for* you" — that is the input, not a new one.
- [ ] **1b** Decide the shape deliberately and write the decision down: a single number per
      chapter, or a field keyed to where it happened. A single number means robbing the market
      makes the far side of the plaza harder, which is wrong for a 260 m chapter. A field costs
      more and is probably right. **Measure a chapter's diameter before choosing** — they range
      from Manly's beach to seven hundred metres of open water.

## Job 2 — spend it only on what the world *does*

**Nothing may be denied, nothing lost, no task made harder.** This is the rule the whole
codebase defends and it is right to. Heat buys attention and nothing else:

- [ ] **2a** More heads turning, and turning at greater range
- [ ] **2b** A stallholder who stands in front of their own stall
- [ ] **2c** A door pulled to; a tray moved back off the counter
- [ ] **2d** The chase layer (`musChaseT`) sustaining rather than spiking
- [ ] **2e** Wary lines reaching for their higher register sooner

Every one of those makes the approach harder without making anything impossible. If a change
would stop a task completing, it is out of scope by definition — not a judgement call.

## Job 3 — reach both casts

- [ ] **3a** **Sydney and Pasto are not locals chapters.** They predate `addLocal`; their casts
      are `npc.js`'s own `humans` and `paCast`. Every gate in the reaction layer used to be shut
      in exactly the first two hours of the game. The closeout ported the witness chain and
      produce to both — `paBuildLocal` calls the same `buildHuman` Sydney uses, so the records
      are the same shape and nothing new had to be built. Heat must reach both the same way.
- [ ] **3b** Ownership still does not port and was recorded open rather than faked. Do not
      quietly fix it here as a side effect; if it is in scope, say so and give it its own row.

---

## Five traps, every one paid for on a previous pass

1. **`gawpT` COUNTS UP.** `paStepHuman` *leaves* the gawp when it passes 1.8 — so writing 2.6
   into it **ends** the look instead of extending it. This is the same family as the catch-all
   state that reset the timer it was waiting on.
2. **A bare `lookX` write is worth nothing.** The witness look measured beautifully on the
   frame it fired — 9 of 16 people in Sydney — and **2, then zero, a fifth of a second later**.
   Twenty-odd sites inside the two state machines write `lookX` every frame. It needs its own
   timer, re-asserted **after** the state machine has run. Deliberately not a state: a state
   needs a ceiling and an exit, and the cheapest way to obey the catch-all-state rule is not to
   add one.
3. **Ceilings and radii must be derived from each other.** The finale's gather recruited people
   28 m away with a 14 s ceiling that reaches 11.8 m; four of five were stopped mid-walk and
   one never moved at all. If heat gives somebody somewhere to go, the distance and the time
   allowed must be computed from each other, not chosen separately.
4. **A slot may land somewhere nobody can stand.** One of the finale's did — `navBlocked(29, 20)`
   was true, inside a flower bed. Rotate round the ring until the ground is clear.
5. **A chase that dodges the thing it is chasing is worse than a shove.** `npcBlockedFor` is
   gated off for chase/flee/cornered/praise/chat/shoo/carry/photo/own/retrieve for that reason.
   Any new heat-driven steering has to declare which side of that line it is on.

---

## Done when

- [ ] Heat rises and decays, **measured** — a curve, not an assertion
- [ ] **Zero tasks made harder.** Differential: a full task sweep with heat forced high against
      the same sweep with it forced to zero, and the completion set identical
- [ ] The loop is **demonstrable**, not argued: a soak in which the same stall is robbed three
      times and the third approach measurably differs from the first — number of people
      looking, range at which they turn, time before the first reaction
- [ ] `qa/npchealth.js` — states visited and distance travelled per NPC unchanged **in kind**
- [ ] `qa/lines.mjs` — still 0 blockers, still ≥ 477 conditional lines over 17 casts
- [ ] `qa/fuzz.js` 19 chapters 0 errors · `stillness.js` no new entries
- [ ] One fresh-save playthrough of Sydney and Marrakech end to end, by hand, not by script
- [ ] Log written below: found vs fixed, what was declined, and the design decision from job 1b
- [ ] `CONTRACT.md` new version section · project memory · `playwright-cli close-all`

**Chain to `qa/BATCH8.md`** — or run 8 first if this one needs a second tuning pass. Batch 8
contends with nothing.

---

## Log — 27 Aug 2026, `claude-opus-5`

`CONTRACT.md` §v33. Files touched: `src/npc.js`, `src/systems.js`, `src/main.js` (three lines
of wiring), and four QA files. No biome file was opened — see the declines.

### Job 1b — the design decision, and it was measured before it was made

**A field, not one number.** `qa/b7-diam.js` derives the chapter list from `CHAPTERS` and
measures the people-span of all nineteen, with the two old casts separated from the locals by
`kind` (the first cut had no such gate and gave every chapter Sydney's 125.2 m):

```
Palawan  90 · Kowloon 93 · Venice 110 · Sydney 112 · Pasto 117 · Hanoi 148 · Manly 161
Rio 169 · Göreme 172 · Sơn Đoòng 193 · Cali 203 · Antarctica 237 · the Drift 241
Monte Carlo 302 · Marrakech 308 · Iceland 310 · Kyoto 348 · THE QUAY 638
```

Median 169 m; two chapters under a hundred. One number per chapter is a lie in seventeen of
the nineteen, so heat is up to six sites per chapter, each with a strength and a linear
falloff.

**And the radius is derived from the range, not chosen beside it** — trap 3.
`npcHEAT_R = npcCHAIN_R × npcHEAT_LOOK = 20 × 1.6 = 32 m`. The floor is the chain radius times
the largest range multiplier heat can buy, so a witness can never be recruited from outside
the heat its own witnessing creates; the ceiling is half the smallest chapter's people-span
(Palawan 90 → 45). If `npcHEAT_LOOK` moves, the radius moves with it.

Merge radius 16 m (= R/2), decay **90 s linear** — 3.5× the 26-second personal clock, which is
the point: the individuals have forgotten and the square has not.

### Done when

| row | result |
|---|---|
| heat rises and decays, **a curve** | `qa/b7-curve.js`, three robberies 10 s apart, sampled 2 Hz for 150 s. Cappadocia 0.012 → 0.210 → 0.338, peak **0.444**, zero **40 s** after peak. Hong Kong 0.075 → 0.297 → 0.513, peak **0.612**, zero 59 s. Venice peak 0.528, zero 51.5 s. Pasto peak 0.463, zero 44.5 s |
| **zero tasks made harder** | `qa/b7-tasks.js`, 19 chapters × 4 alternating windows, `forceHeat(1)`/`forceHeat(0)`. **0 chapters** where heat moved anybody more than `npcLOC_STEP_R` (0.55 m) toward a prop. Max drift from anchor 0.54 hot / 0.54 cold — the same ceiling. The one id that appeared in only one half is Hong Kong's `symphony`, which fires on `capy.y > roof` during a timed show and is a function of the probe's parking altitude, not of heat |
| the loop is **demonstrable** | `qa/b7-heat.js`, same stall robbed three times, attention profile at five fixed radii. Marrakech area **12 → 14 → 16 → 16** and heat 0 → 0.301 → 0.480 → 0.659; Hong Kong **3 → 5 → 5 → 6**, heat 0 → 0.240 → 0.690 → 0.905. The same script with `forceHeat(0)`: Marrakech **6 → 6 → 6 → 6**, Cappadocia **11 → 10 → 10 → 10**, Pasto 20 → 21 → 20 → 22 |
| 2a, every chapter | `qa/b7-range.js`, the range at which a head turns, walked outward in 0.5 m steps, 68 people over 17 chapters. **14.64 m → 23.88 m, ratio 1.631** against a derived 1.6. Sydney's crowd-watch mean **4.96 → 16.42** |
| `qa/npchealth.js` | unchanged **in kind**, and hot and cold are identical: Sydney 38, six stuck rows, all the known scenery (the busker and five seated patrons); Pasto 18, one abuela holding `patrol` 38–41 s while walking 15–19 m; the Quay 0. See the instrument finding below |
| `qa/lines.mjs` | **477 conditional lines over 17 casts, 0 blockers, 0 warnings** |
| `qa/fuzz.js` | **19 chapters, 0 errors**, 0 NaN, 0 void falls, 0 solver saves |
| `qa/stillness.js` | one new entry, and the stash differential says it is not ours — see below |
| `qa/channels.mjs` · `audit-tasks.mjs` | 19/19, 0 fail · 0 blockers, 229 tasks |
| playthrough | `qa/b7-play.js` — real keys, real clock, cleared save, Sydney then Marrakech. `lastError` null in both. Sydney 0.333 after four seconds of walking and one wheek, 0.819 after three robberies; Marrakech 0 → 0.613, two guards up, and the tally names all three paths |
| pictures | `qa/B7-sahara-hot.png`, `qa/B7-guard.png`, `qa/B7-pose-hot.png` |

### Found vs fixed

**Fixed (9).**

1. **`npcHeat` had no live-biome gate on `humans`.** `stepHuman` — the only thing that decays
   `rec.wary` — runs only while Sydney is attached, so a Sydneysider startled on the way out of
   chapter 1 is frozen wary for the rest of the session, standing at a coordinate that exists in
   every other chapter too. `most-wanted` (heat ≥ 5 within 20 m) and `not-a-soul` (heat === 0)
   are the two finds that read it, and in seventeen chapters both were answering questions about
   a park in Sydney.
2. **…and it never swept `paHumans` at all**, so chapter 2 — the chapter with the most edible
   props in the game — could not raise heat by any means. Both casts come out of the same
   `buildHuman`; one gated sweep over whichever is live is the whole fix. Job 3a.
3. **`wary` is one frame behind itself in both old casts.** A local's is written inline by
   `localsReact`; these two derive it from `alarm` inside `stepHuman` on the *next* tick. So
   anything asking "who is watching for me" at the instant of an event reads a crowd that has not
   felt it yet — measured, two Sydneysiders at wary 0.64 three metres from the stall and `npcHeat`
   answering **0** on the frame of the robbery, three times running. It now answers on
   `max(wary, alarm)`.
4. **`capy:grab` never reached the two old casts.** The witness chain is armed by `startle`,
   `plunge`, `standUp` and the graze handler, and the graze handler only fires once the animal has
   taken a bite — so *the theft itself* was witnessed by nobody in Sydney or Pasto.
   `npcCastWitnessAt` gives an event that carries a place and not a person a way in.
5. **The thief reaction was too soft to be witnessed.** `kick` is strength × (0.35…1.0 by
   nearness) and `npcWARY_HEAT` is 0.35, so at strength 0.5 only somebody inside 2.9 m of a 6.5 m
   circle cleared the bar: being robbed at four metres left the victim at **0.26** — reacting,
   flinching, saying so, and counted as a witness by nothing. 0.8 puts the near half of the circle
   over the bar and leaves the rim under it. It costs a slightly bigger flinch (9.6 against 7.4 at
   four metres) and that is right — a splash is not a theft.
6. **An incident is not a frame.** Under real keys from a cleared save, four seconds of walking
   and **one wheek** took Sydney's field from 0 to 1 and pinned it there, twenty-six bumps logged:
   the chain arms on every startle and a wheek in a thirty-eight-person park startles most of it.
   A site may now be bumped once every `npcHEAT_GAP` (4 s). Same walk now reads **0.333**.
7. **One witness was worth almost nothing.** The first step function was `STEP × clamp(w/SAT,
   .34, 1)` — one witness = 0.116, which against a 90 s decay is gone in ten seconds. Hong Kong
   and Cappadocia rose to 0.11 and 0.22 and were back at zero before the next approach, three
   robberies running. It is now mostly flat with the witness count as the top four tenths:
   w=1 → 0.24, w=2 → 0.32, w≥3 → 0.40. The chapters where this was dead are exactly the ones with
   six to ten people over a hundred and fifty metres, where one witness is the *normal* case.
8. **The guard's skirt was round its own stock and not round every prop.** With the centroid test
   alone the nearest prop-home-to-person distance fell in eleven chapters of nineteen — Kyoto
   2.80 → 1.74, Cappadocia 2.00 → 1.48, Hanoi 1.40 → 1.08, Antarctica 0.50 → 0.33. Small, and
   exactly the wrong direction for a static collider. It now refuses any target within 1.6 m of
   *any* prop home in the live chapter.
9. **`qa/npchealth.js` had the same shared-space defect this batch is about.** It captures
   `game.npcs` — both casts, for the life of the session — with no live-biome gate, and only the
   live one is stepped. So it watched a detached crowd stand perfectly still and reported **38
   stuck NPCs in the Quay**, a chapter that has no npc.js cast at all, and **38 of Pasto's 56
   rows were Sydneysiders**. The invented-finding failure of rule 3, in the detector the
   catch-all-state bug was found with. Gated.

**Declined (3), with reasons.**

1. **2c's literal form — a door pulled to, a tray moved back off the counter — is out of scope by
   the batch's own file list.** A door and a tray are biome-file objects and a prop's home is
   `props.js`'s; this batch names `src/npc.js` and `src/systems.js`. Moving a prop is also the one
   thing the "nothing may be lost" rule most obviously forbids. What was built instead is the
   npc.js half: **hands over the stock** — `r.grd` damps in with heat and rides the same two lines
   as the flinch's guard, measured at **35° and 28°** of forward arm at full heat against
   +2°/−4° cold. Which leads to:
2. **The guard pose is at the edge of legibility at the camera the game is played at.**
   `qa/B7-pose-hot.png` and `qa/B7-guard.png` are the pictures; the arms are a quarter of the
   flinch's throw on a figure whose legs are a merged mesh, and from six metres at the settled
   pitch it reads as a posture rather than as a gesture. That is what was asked for and it is
   honest to say it is small.
3. **2b does not reach Sydney or Pasto.** The guard is a property of a *fixed point with an
   anchor*, which is what a local is; the two old casts walk, have their own state machines and
   fourteen states apiece, and giving them a guard means a steering state with a ceiling — which
   is the same reason ownership was recorded open rather than faked. Measured: `guards` is 0 in
   both, and non-zero in 15 of the 17 locals chapters in the last sweep — Cali and Rio read 0, and
   Rio read 3 in an earlier one, so that is where the props scattered on the day rather than a
   gate. A guard needs stock between 2.15 m and `npcOWN_R` of its own anchor.

**Job 3b — ownership.** Still open, still not quietly fixed as a side effect. It needs a steering
state with a hard ceiling on casts that already carry fourteen. Restated, not re-litigated.

### Open, and stated as open

1. **Sydney saturates and the other chapters do not.** With the incident gap in, four seconds of
   ordinary play reads 0.333 and three robberies read 0.887 — but a 38-person park generates
   witnessed incidents on its own (25 chain bumps over 150 s of standing still), so Sydney sits
   between 0.4 and 0.9 rather than returning to zero. That is arguably correct for a crowded park
   and it is also the chapter where the escalation has least headroom. Not tuned further: the
   right lever is the chain firing on every startle, and changing that changes chapter 1's
   character, which is a bigger decision than this batch.
2. **Pasto accumulates unreliably.** 0 → 0.223 → 0.106 → 0.224 over three robberies. Its cast
   *chases* rather than watches — `paThink` has no idle notice state at all, only `gawp` (for the
   condor), `point`, `scold` and `chase` — so the witness chain fires only when somebody happens
   to be inside the graze radius. Heat reaches Pasto's two notice branches (the vendor's 12 m and
   the churchgoer's 8 m, both × 1.6) and its `paLookCapy` now holds the look, but the chapter has
   no equivalent of the locals' watch radius for heat to widen.
3. **Hong Kong's dynamic props sit further from its people than any reaction radius reaches.**
   The `unseen` tally caught it: a stall whose nearest person is 7.8 m is outside thief (6.5) and
   produce (5.0), so nothing is witnessed and the correct heat is zero. Fine as a rule; worth
   knowing that in that chapter it is often the case.
4. **`qa/fuzz.js` still spells its nineteen chapters.** Complete today, and the same defect
   `qa/route.js` was fixed for in batch 5 and `qa/pointers.js` still has. Not changed here:
   this batch needed fuzz's before/after comparison to mean the same thing.
5. **`qa/stillness.js` does not hold a line, and the differential proves it.** It reported one new
   entry — Pasto drifting 1.09 m at its spawn, over the 1.0 m limit. `git stash push -- src/npc.js
   src/systems.js src/main.js` and the same run **without** this batch: **6.5 m**. Batch 5 recorded
   0.48–7.83 m for the same thing. The entry is the known Pasto drift crossing a threshold, not a
   regression, and it is six times smaller with this batch than without.

### The instruments, and what each of them got wrong first

Four of the five probes written for this batch reported something confident and false before they
reported anything true, which is the whole of rule 3 and is worth writing down:

- **`watching` inferred from a drawn yaw** counted anybody facing within 35° of the bearing to the
  animal and reported a look range of **75.2 m** in Sydney and 79.8 m in Kowloon. That is not
  attention, it is a person 76 m away who happens to be pointed the right way. npc.js publishes
  the flag the head-turn actually uses.
- **A peak in a wandering crowd is noise.** Three identical robberies in Sydney gave peak look
  counts of 19 / 28 / 24.
- **The profile teleported four metres between stations** and reported `3 21 21 21 4 2 2 21` —
  a crowd being startled by an animal appearing next to it, which is a thing the probe was doing.
- **The profile then took forty seconds per approach**, and against a ninety-second decay that
  cools the square most of the way back: heat pinned at 0.24 for all three approaches in four
  chapters. The probe was destroying the accumulation it exists to measure.
- **The done-set comparison was order-dependent** and reported four chapters "differing" purely
  because an arrival row ticked between the halves.
- **The stall was chosen by "most people within 20 m"**, then by "closest third-nearest person",
  and both picked things nobody was standing at — a bin four metres off a Venetian canal with its
  nearest people 15 m away. Every path into the reaction layer is a *radius*; rank on the nearest
  person, which is the same question the game asks.
- **`witLast` is only written by the two chapters that have a witness chain**, so reading it
  anywhere else reports whatever Sydney last did — a table full of stale twenties. Gate on the
  call counter.
- **`toDataURL` gave four identical 20 KB blank white frames** (harness trap 12).

**Chain to `qa/BATCH8.md`.** Batch 8 contends with nothing.
