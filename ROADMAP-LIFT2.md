# THE SECOND LIFT PASS

11 September 2026. Branch `lift-pass`, on top of the first lift pass.

Brief: the same one. Take it from "fun and decent" to memorable, before release.

---

## THE REVIEW

Six reviews ran in parallel over the whole tree — game design, art and
animation, audio, writing and narrative, UX and accessibility, and a static
defect audit — and then I played it and looked at nineteen settled frames.

Two of the six corrected the brief they were given, which is the most useful
thing a review can do. The audio review found that three of its six questions
were already answered by code that landed on 7 September: **Doppler exists**
(13 movers across 9 chapters, signed correctly, with the ear's own velocity
subtracted), **the score is adaptive** and reads nine things, and **footsteps
are material-aware in all nineteen chapters**. The memory note saying otherwise
was quoting the pre-fix text of a roadmap whose own header says it closed.

The static audit came back **clean** on the class of bug that motivated it: a
whole-bundle tokenizer over 14,265 declared names found **zero undeclared
identifiers**, with a five-injected-bug / five-decoy recall self-test to prove
the scanner worked. No cross-module concurrent writers, no unpaired kinematic
carriers, no unguarded divide-by-zero. That is worth recording as a negative
result, because it bounds where the next bug can be.

---

## WHAT WAS DONE

Four commits. Every claim below is a measurement, and where a measurement
refused to support a change the change was altered or recorded as unresolved
rather than asserted.

### M1 — the sky

`sysCLOUD` has walked a soft cloud shadow across the ground of thirteen chapters
since the beauty pass. **Nothing was ever drawn overhead to cast it.** The shared
dome is three terms of arithmetic — a vertical ramp, a sun lobe, a horizon band —
and no geometry at all.

The note that signed that off measured a frame whose horizon sat at NDC 0.94,
three per cent from the top edge. **L2 moved it to 0.44.** The top twenty-eight
per cent of every daylight frame is now that bare ramp.

One `InstancedMesh`, one draw call, a child of the dome so it rides the lens and
hides with it. Count and opacity come off `sysCLOUD` and nothing else, so the
sky and the ground cannot disagree and a zero row draws none — one coherent
branch rather than a second table.

**Two things were wrong first, and both are worth the ink.**

**It was Lambert, and therefore invisible.** Sydney's own layer is Lambert with
an emissive fill and its comment is right about why — a cloud is lit from
inside, by light that has already been scattered in it. Copying it here still
failed, because the hemisphere light's *ground* colour is a per-chapter number
and it is not small:

| | hemisphere ground |
|---|---|
| manly | (1.198, 1.052, 0.705) |
| antarctic | (1.694, 1.757, 1.773) |
| quay | (0.733, 0.597, 0.335) |

Against a near-white body, plus the emissive, every channel is over 1.0 before
the sun is considered. **The underside of every cloud was pure white.** One body
colour cannot be right in eleven chapters when the lamp under them varies by two
and a half times. The layer is unlit now and the shape is a vertical ramp baked
into vertex colour: base is 0.66 of top, top is the live horizon bleached a
quarter of the way to white. That is the correct model as well as the robust one
— what a cloud looks like is set by the sky it is in, not by a lamp pointed at
the ground under it.

**The frame holds twelve degrees of sky, and the first two cuts put the layer
above it.** The settled rig pitches **down** 11.2°, so a thing at elevation `e`
lands at `tan(e + 11.2) / tan(24)` in NDC and the top edge is reached at
**e = 12.8°**. The first band was 9–36° and the second 7–26°, and Rio went from
5.82% of the top band covered to **0.00%** when the second "narrowing" moved it
further up. 2–12° is the whole sky there is.

**Measured as a frozen-frame differential** — `state.paused`, one exposure with
the layer visible and one without. That is the only honest version: the first
cut ran the world between exposures and reported **86% coverage on the Quay in a
frame with no sky in it at all**, which was the harbour water, a ferry and two
pedestrians. Three controls fix the floor (Sydney owns its own sky, Kyoto and
Hanoi have no row): 0.55, 1.42, 0.03.

| | cali | hanoi | rio | pantanal | sahara | manly | quay | venice | palawan | antarctic | pasto |
|---|---|---|---|---|---|---|---|---|---|---|---|
| % of top band | **18.7** | **11.1** | **10.5** | **10.4** | **8.7** | **8.4** | **8.1** | 1.95 | 1.77 | 0.64 | 0.62 |

**Eight of eleven, honestly.** Pasto and Antarctica are at the floor and the
reasons are real rather than fixable here: Galeras fills Pasto's upper third,
and a white cloud over an ice shelf against an ice-glare sky is what Antarctica
looks like.

### M2 — one mouth is not the whole square

Found by playing it. Standing in the plaza in Pasto, **two people said
"Sinvergüenza. Come here." in the same frame, in two bubbles, side by side.**

`localLine` keeps a shuffled bag per person, which guarantees a person never
repeats until they have been through their whole pool — and guarantees nothing
about the person next to them. Three sites answer one event with two speakers,
and two of the three drew with a bare `randInt` each.

One ring of the last six lines **anybody** said, shared by every mouth. A pick
that lands in it trades for one that does not; a pool too small to offer one
takes the line anyway. So the ring can never fail to produce a line, only fail
to improve one.

### M3 — nobody loses their lines

`gorSaysNow`, `manSaysNow` and `panSaysNow` were `r.lines = lines`. They
**deleted** a person's pool, permanently, the first time a set piece fired.
Nineteen named people across three chapters, including every `{ after: }` payoff
those chapters authored — the Göreme tea seller's five lines become three the
first time a balloon lands, about four minutes in.

The mechanism predates `localResolve`'s `before`/`after`/`when` and has been
eating it ever since. Additive now, original stashed once on the record.

### M4 — the world stops when something happens

`mainMakeTime` has been published since D4 with **three call sites in the whole
tree**, and the file's own comment calls the hundred hand-rolled `shake()` sites
a shelf item. Taken.

- **`capy:land` had a look-target dip and nothing else**, capped at 1.4 m and
  reached at 13.9 m/s — so coming off a Göreme chimney, off the Kowloon
  scaffold, out of the condor or into the Sơn Đoòng doline was *identical in the
  hands and identical in time* to a hop off a bench. On the most repeated verb in
  the game. Through `punch()` now above 11 m/s, with the freeze asked for
  explicitly above 20 rather than left to `sysPUNCH_MIN` — which would fire on
  every landing over nine metres, in a game with a chapter about falling.
- **Twelve latched set pieces in nine chapters** moved from `shake()` to
  `punch()`, which is a strict superset. The bonsho was the largest shake request
  in the game — 1.6× the cap — and arrived with no lens kick, no pad and no
  freeze.

### M5 — the first tick is the player's

Measured on a fresh file with the keyboard never touched: `state.score` went
0 → 1 somewhere between three and sixteen seconds. The spawn pose satisfies the
photo-op gate on its own — stationary, facing the forecourt, tourists at eight to
ten metres — and `photoCd` starts at `rand(0, 12)`.

The knock-on is why it earns a gate rather than a shrug: **that tick is the first
save write**, and the first save write is what fires *"SAVED — YOU CAN CLOSE THIS
AND COME BACK"*. So three seconds in, a stranger who had pressed nothing got a
place card, a struck-through row, three stacked toasts and two speech bubbles,
and the one thing the pile-up taught was that **the list ticks itself** — in a
game that is entirely the list.

### M6 — coral is the fill where nothing is written on it

The accent split covered coral text on paper and never covered paper text on
coral, which is the same 2.31:1 in the other direction and is what "Begin" is.

**Neither contrast probe could see it.** `qa/rd-contrast.js` clicked
`.capyui-go` and *then* measured, so it reported the door it had just walked
through as a miss; `qa/uicontrast.js` only reads picker tiles. Seven filled
controls move to `accentDeep` (4.62:1) — Begin, Carry on, resume, KEEP IT, the
mute switch, two hover states, and the boot card's Try again. The bars, thumbs,
pips and map dot keep the bright coral. The probe now measures the card before
pressing its button.

### M7 — the getaway

**Two dozen rows in this game are a theft and every one of them ticked on the
frame the prop entered the animal's mouth.** So the owner's errand, the
fifteen-metre leash, the ten-second ceiling and the reclaim at 1.5 m all played
out over a row that was already crossed off. The tick moves four seconds later,
to the moment it means something.

It cannot lose the player a row, and that is the whole of the design:

1. **the arm is by task id, not by prop** — a prop reclaimed, drowned, destroyed
   or left in another chapter costs nothing; pick up another and the row is live
   again;
2. **nothing ever disarms it.** There is no failure branch;
3. **distance or persistence.** Fifteen metres is `npcOWN_LEASH` exactly, so the
   tick lands on the frame the owner turns round — but twelve seconds of simply
   keeping hold is also getting away with it, so a chapter with no fifteen metres
   in it (a salon, a cave chamber, a drift island) cannot hold a row hostage on
   its floor plan.

**Found on the way: two second owners on the same row.** `systems.js` ticked
`picnic-thief` from `capy:grab` one listener after `props.js` did — invisible
while both fired on the grab, and load-bearing the moment one stopped. The probe
read `armed: 1, ticked: 0` beside `done: true`. And `props.js` ticked
`steal-empanada` on any grab, which quietly defeated the deferral F4 built for
that row; Pasto's *"the joke is being seen doing it"* is now composed with the
getaway rather than beaten by it. Take it, be caught taking it, get away.

```
on the grab                 armed 1, ticked 0, carried 0.30, 1 m out, done false
3.3 s, still at the picnic  armed 1, ticked 0, carried 3.30, 1 m out, done false
22 m away                   armed 0, ticked 1,                        done true
taken back off you          armed 0, ticked 1,                        done true
```

### M8 — the throw lands

The charged throw is a whole verb — mass-proportional, on a 43.7° arc — and **no
task in 232 needs one**, `prop.thrownT` is read at exactly one place, and the
incident chain had five kinds of which four are satisfied by a shove. A sixth
kind, `hit`, fed from `physPersonHit`'s four existing gates through one event in
the same shape as `prop:impact`/`water`/`destroy`, plus four patterns: THE DIRECT
HIT, THE VOLLEY, THE BOMBARDMENT and HIT AND RUN.

### M10 — three cues that were built and could not be heard

All three are the shape of the bug the last pass found: correct-looking code, a
constant that reads as tuned, and nothing able to see what the code built.

**The elevation shelf was unreachable past 9.63 m**, and it is arithmetic. L7
folded the air curve into the back-cue branch and left the `else`; the air curve
crosses `lpHz < 19000` at 9.63 m, so past ten metres the first arm always wins.
`sysSFX_UP_DB` has had no effect on any sound more than ten metres away: every
gull, every flock, every bell off a campanile, every bird in the Antarctic
colony. Chained now — a sound in front of you and level with you still builds
neither node.

**The back lowpass had no Q**, so it inherited Web Audio's default of 1 — about a
decibel of *resonance* at its own corner, which at full back is an emphasis at
4.5 kHz, in the presence band, which is the opposite of "something behind you".
The mover's identical filter sets 0.4, `sfxStep` 0.7, `acSubLP` 0.5. This was the
only lowpass in the file that set none, and it is why `sysSFX_BACK_LP` has never
survived a listen.

```
in front   4 m none      9 m 19385 Hz   20 m 13280   55 m 1905   80 m 780
behind     4 m 4500      9 m 4500       20 m 4500    55 m 1905   80 m 780
above      4 m shelf 2.0 dB, no lowpass
          12 m shelf 2.0 + 17600 Hz     <- 0 before
          30 m shelf 2.0 + 8780         <- 0 before
          60 m shelf 2.0 + 1280         <- 0 before
Q          0.4 everywhere               <- 1 (the default) before
```

**The wet footfall only ever asked the weather** — and the obvious fix measured
zero, correctly. Ramping on foot depth gave `wet` 0 at every one of a hundred
footfalls walking into the sea at Manly, because `capySWIM_ENTER` is 0.70 from
the *body centre* and the foot is 0.34 below it: the animal is swimming, and the
footfall block skipped, before the foot is 36 cm under.

Asked of the geometry instead of by walking (`qa/m10-wade.js`, a 121 m grid in
twelve chapters), points where the animal could stand on ground that is under
water come back **zero** in Rio, Venice, the cave, Antarctica and Monte Carlo,
and elsewhere `terrainHeight` simply stops at the waterline. **The state this was
written for does not exist.** Recorded rather than worked around. What does exist
is an animal that has just climbed out, so the term is a drip off `capySwimAgo`:
full for the first stride out, gone in four seconds. Measured 0.000 on dry sand
for eight windows, then 0.992 / 0.796 / 0.725 / 0.616.

### M9 — seventeen chapter voices written to one template

`npcPLACE_SAY` is the pool a player hears more than any other, and its own
comment says why: `npcHEAT_SOON` drops the wary bar to 0.14 in a square that is
already cross with you. It was three lines per kind per chapter, merged with
seven neutral ones — so **seventy per cent** of what a place says when it has had
enough of you was the same in all nineteen. And the local thirty per cent was a
visible template:

```
wary[0]      'You. Again.' BYTE-IDENTICAL in five chapters, plus
             'You again, mate.' identical in two more
wary[1]      "I know / I remember ..." in fifteen of seventeen
wary[2]      begins "Not ..." in fourteen of seventeen
incident[0]  OPENS ON THE NUMBER THREE IN SEVENTEEN OF SEVENTEEN
```

102 lines to 204, and the mix moves to 46/54. Three rules: no line names what the
player did, no line could be said in another chapter, and **not every reaction is
a count**. The Quay keeps `'You again, mate.'` — one of the two should, and it is
the chapter that earned it. Antarctica keeps the log, which four chapters were
running as the same gag with the same noun.

`qa/m9-voice.mjs` is a static census, and the checks are **ceilings on
distributions** rather than a style guide — twice over. A template is a
distribution and not a bad sentence; and the first cut of the probe tested
`incident[0]`, reported 17 of 17 *after* the rewrite, and was correct and
meaningless, because `localLine` shuffles the bag. Same probe, both tables:
3 of 6 checks fail before, 6 of 6 pass after.

### M11 — somebody says something at the end

Four things were wrong with the finale and all four are the same thing: **nobody
speaks.**

- **The five gatherers said nothing at all.** `case 'gather'` steered, looked and
  leaned and never once opened a mouth. One line each now, and the pool's rule is
  the whole of the ending's design: *nothing in it may name a place or a thing
  that was done.* They were in the gardens the entire time and saw none of it.
- **The one recurring character closed the game with a coin flip** — four lines
  at `cool: 30` with the ledger 2.6 s behind them. `cool` 4.5, `sysFIN_BEAT`
  9200. Two distinct lines eight seconds apart, measured, where there was one.
- **All four assumed you had met**, and nothing counted whether you had: `o.trav`
  has been set since the traveller was written and only the pair-chat exclusion
  ever read it. `npcTravMet` is a set of the chapters they were actually spoken
  to in, and the lines acquire the condition they were written under through
  `when`. Two more exist for the player who never stopped, because the honest
  scene there is a stranger.
- **The game never said what it was about.** Nineteen chapter notes circle one
  idea and none states it. It is now said twice in the whole game and never
  again — once by the traveller, and once by the game under the arithmetic on the
  final ledger:

  > *nineteen places, and not one of them agreed with another about what you were.*

Plus one find, `same-face` — *"Kept running into the same stranger, in four
different countries"* — which is the arc's first surface in play.

---

## WHAT IS STILL OPEN

- **The background crowds.** 186 people on five `InstancedMesh` casts in four
  chapters, and the art review's finding is that **L8's joints are the wrong tool
  at that count** — a knee is 0.3 of a pixel at the 35 m these are seen from. The
  real tell is that they are all the **same height to the millimetre**, standing
  beside a roster that has three build archetypes; at the L2 camera a
  uniform-height crowd reads as a picket fence. One float per instance in arrays
  that already exist. Not attempted here.
- **The wide crease octave**, still the largest single beauty term available —
  but the naive version has a bug: at the game's fov `uFocalPx` is 808, so a
  1.6 m ring is clamped at 24 px for everything nearer than 54 m, i.e. the entire
  playable frame, and the world-constant radius silently becomes a screen-space
  one. It needs its own ceiling (96–128 px) and its own range.
- **Venice is not a broken grade.** Its own palette is chroma 12–16 — Istrian
  stone, trachyte, wet stone, fog — and the measured `chr50` of 14 *is* Istrian
  stone. A chapter about a white stone city measures as having no colour because
  it has none. What is actually wrong is that the piazza is bare terrain plus
  twenty white ribs, with no value variation across sixty metres of paving.
- **Ten of nineteen chapters have no continuous sound in them at all.** No mover
  bed in pasto, cali, iceland, sahara, drift, venice, palawan, goreme, pantanal
  or cave. Four existing bed recipes and a six-line wiring shape already exist;
  `crowd` was authored for Jemaa el-Fnaa and never wired there. Watch
  `sysMOVER_MAX = 4` — Hanoi already spends all four.
- **`game.state.time` runs while the game is paused** (measured: 1.51 s over
  1.5 s behind the pause card, 2.50 s over 2.5 s with the tab hidden). 71 readers
  across `src/`. No player-visible symptom was found, and the fix is riskier than
  it looks because `systems.js` must keep updating while paused.
- **`H` and `?` open the controls and are printed on no card anywhere.** The one
  key that finds the controls is only discoverable by already having them.
- **The synth catch swallows everything.** One `catch (e) { /* ignore */ }` wraps
  all 51 `sfx*` functions with no log and no counter. It is the mechanism that
  let `f.type = lowpass` sit in the tree for months with a clean console.
- **A hide verb**, still. Three systems have grown their own line-of-sight and a
  fourth (`cane-run`) toasts *"nobody can see you"* off an axis-aligned box test
  with no vision term at all. `capy.loaf` is already the posture and exactly one
  chapter of nineteen reads it.

---

## WHAT COST TIME, AND WHAT IT COST

**A differential is only a differential if nothing else moved.** The first cloud
measurement took its on/off pair 700 ms apart with the world running and reported
86% coverage on the Quay — in a frame with no sky in it. It was measuring the
harbour.

**Know which way the camera is pitched.** Two cuts of the cloud layer put it
above the top edge of the picture because the sign of the pitch was assumed
rather than read. The tell was Rio going from a working 5.82% to exactly 0.00%
after a change described as a narrowing.

**A probe that publishes the last value a system happened to set is not a probe.**
`audioProbe`'s first `lp` reported a flat 7072 Hz at every bearing and every
distance, which looks exactly like a curve that is not working. Lifting the two
expressions into functions both fixed it and removed the re-implementation.

**When the obvious version measures exactly zero, ask the geometry.** The wade
term measured 0 at a hundred footfalls and the zero was correct: the state it was
written for does not exist anywhere in the game. Twenty minutes of walking probes
learned nothing that one grid sweep answered in one run.

**Trap 13 again, twice.** A `\b` written through the Bash tool became a literal
backspace inside a regex, and the census silently reported 0% for two checks it
should have failed. `cat -A` is two seconds. The rule stands: **never put a
backslash escape in a Bash-tool argument.**
