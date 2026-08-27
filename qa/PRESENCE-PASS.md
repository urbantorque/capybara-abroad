# THE PRESENCE PASS — what would make this look and feel another thirty per cent better

Analysis run 28 Aug 2026 against the shipped `audit-fixes` build at commit
`39277a0`, i.e. **after** the polish pass landed all four of its phases. Eight
chapters measured off the framebuffer at 1440x860, three more sampled, six
photographed and looked at, and the weather module read end to end.

Every number below was measured, not estimated. Probes left in `qa/`:
`na-scan.js` (ground + sky bands, scene census, frame time), `na-shots.js`
(canvas capture), `na-rio.js` (the benchmark). Pictures: `qa/na-*.png`.

---

## First, what the polish pass actually bought, because it changes the ranking

The near-field octave in `grain()` worked, and it worked hardest where it was
aimed. Ground band, bottom third, centre 60%:

| chapter | SD before | **SD now** | colours before | **colours now** |
|---|---|---|---|---|
| Palawan | 2.05 | **7.72** | 5 | **19** |
| Sydney | 3.98 | **8.78** | 27 | **45** |
| Monte Carlo | 12.53 | **21.17** | 78 | **114** |
| Venice | 9.06 | **10.61** | 68 | 51 |
| Kyoto | 23.12 | 23.41 | 84 | 30 |
| Iceland | 15.96 | 16.10 | 46 | 93 |
| Hong Kong | 15.36 | 13.45 | 109 | 138 |

Palawan's sand nearly quadrupled and Sydney's lawn more than doubled. The rim
landed too — `mat()` injects a sky-tinted fresnel on every non-emissive,
non-transparent material, and it is why silhouettes now separate from what is
behind them. **Neither should be touched.**

And it is why the two findings that top this document are the two the polish
pass explicitly deferred, plus one it never saw.

---

## THE MEASUREMENTS

### The floor, after the polish pass

| chapter | mean L | **SD** | **colours** |
|---|---|---|---|
| **Rio** | 137.4 | **56.25** | **175** |
| Kyoto | 123.5 | 23.41 | 30 |
| Monte Carlo | 105.0 | 21.17 | 114 |
| Iceland | 52.7 | 16.10 | 93 |
| Hong Kong | 34.1 | 13.45 | 138 |
| Hanoi | 169.1 | 12.23 | 58 |
| **Venice** | 187.8 | **10.61** | **51** |
| **Sydney** | 160.8 | **8.78** | **45** |
| **Palawan** | 226.1 | **7.72** | **19** |
| **Cali** | 140.6 | **6.11** | 85 |

Rio is still **6 to 9 times** the bottom four, for the same one reason it was
before: it is the only chapter with **a graphic on the floor**. `qa/na-rio.png`
is the proof — the Burle Marx wave, and it is 40 lines of banded vertex-coloured
quads at y = 0.02 (`rioBuildCalcadao`, `rio.js:710`).

The near octave took the floor from *one colour* to *one colour with a texture
on it*. It cannot take it to *a floor with something drawn on it*; nothing can
except drawing something on it.

### Nothing that is switched on lights anything — still

Scene census, live-visible lights, eight chapters:

    sydney 0   kyoto 0   iceland 0   venice 0
    kowloon 0  palawan 0  monaco 0   hanoi 0     (antarctic: 8)

**Hong Kong's ground still measures a mean luminance of 34.1/255** — 34.3 before
the polish pass, so nothing about the floor of the neon chapter changed, because
the near octave modulates a diffuse that is receiving almost no light.

`qa/na-monaco.png` is the entire finding in one frame: a lamp burning
white-hot at the right of frame, and the pavement beneath it is *the same value*
as pavement fifteen metres away. Monte Carlo's own grade comment names "a
hundred and forty windows, a hundred lamps, six chandeliers" as the subject of
the chapter.

### Nothing is planted in the ground

There is still no ambient occlusion, no contact darkening, and no grounding term
of any kind. Look at any of the six photographs:

- `na-sydney.png` — the capybara casts a soft offset shadow and has **no
  darkening under its feet at all**; the bench legs, the tree trunk and the
  sandstone kerb all meet the lawn on a clean seam.
- `na-monaco.png` — the bollards, the lamp post and the capybara all float.
- `na-rio.png` — on the best floor in the game, the capybara still sits on
  the white band like a sticker.

The rim solved half of the last pass's P3: it separates a silhouette from the
**background**. Nothing separates it from the **floor**, and that is the half
that reads as "sitting in the world" rather than "drawn on top of it".

### The wind is fully authored, and the picture does not read it

**This is the finding the previous audit did not have.**

`wxMOOD` in `weather.js` carries a real wind per place — nineteen rows of
`gust: { base, swing, hz }` and a bearing `dir`, hand-set per chapter (Sydney
3.4 m/s swinging 1.6 at 0.070 Hz on a bearing of 1.90 rad; Kyoto a still 1.1;
Pasto 2.6 swinging 1.9). It is damped, it gusts, it has a direction.

There are two wind channels and it is worth being exact about which, because
`CONTRACT.md` insists they are not the same thing. The biome's own `wind()` —
the Drift's moving air — has two consumers:

    src/capybara.js:845     the drift's air frame
    src/props.js:2900       the shove on a loose prop

And weather's `gust()`, the vector that carries `wxMOOD`'s nineteen rows, has
two of its own:

    src/npc.js:1238         an NPC's reaction to a gust
    src/props.js:2911       the shove, again

**Four readers across two channels, and not one of them is the picture.** A grep across every module for
foliage, canopy, frond, banner, awning, laundry, bunting, sail, tarp or flag
motion — any per-frame rotation, any vertex displacement, any sway — returns
**nothing at all**. There is no vertex animation anywhere in the game.

And there is no shortage of subjects. Count of cloth/foliage nouns per module:

    palawan 198   manly 146   sahara 126   kowloon 123   quay 112
    kyoto 75      venice 57   drift 46     pasto 41      rio 37
    pantanal 35   monaco 31   cali 29      antarctic 26  ...

Nineteen worlds of palms, awnings, banners, laundry poles, sails, parasols,
bamboo and torii cloth, in a game with an authored per-place wind, and not one
of them moves. This is the largest *aliveness* gap in the build, and it costs no
draw calls: a vertex term in a shader that is already being compiled.

It is also the one finding here that is as much a **delight** change as a
picture change. The gust already shoves props (`props.js:2900`) — the player
feels a cause they cannot see. Making the world lean into the same gust turns an
invisible physics term into a readable one.

### There is no sun in the sky

`sysBuildSky` (`systems.js:5225`) paints a 32x18 dome from a horizon colour and
a zenith colour on a `t^0.62` ramp. One draw call, 1,100 vertices, vertex
colours — the construction is right and should stay. But there is **no sun
disc, no glow around the sun's bearing, and no moon**. In every one of nineteen
chapters the sun is an inference from the shadow direction rather than a thing
in the picture. `na-monaco.png`'s night sky is flat navy and a dozen specks.

Measured honestly, so the batch does not overclaim: **clipping is 0.00% in both
the ground band and the sky band in all eight chapters.** The tone-map argument
carried by `/polish V4` is real but it is a roll-off-quality issue, not damage —
the *sun* is the visible half of that slice, and it is cheap.

### The budget is not the constraint

Frame time, hand-driven `game.tick(1/60, true)` averaged over 30 steps:

    hanoi 1.42   kyoto 1.60   palawan 1.61   venice 1.80
    monaco 1.82   kowloon 1.95   sydney 1.96   iceland 2.01   ms

Triangles run 76k (Sydney) to 304k (Hanoi). **1.4 to 2.0 ms** is an enormous
amount of headroom, and it is the reason the light pool below is affordable.
It is not a licence to be careless — it is a licence to try.

---

## THE FIVE PRIORITIES

Ranked by measured size of the gap, then by how many of the nineteen chapters
the fix reaches.

### P1 — Things do not sit in the world *(all 19 chapters, every prop, every NPC)*

No AO, no contact term, nothing. Visible in six of six photographs. The rim
separated silhouettes from backgrounds; this is the other half and it is what
makes a flat-shaded object read as resting on a surface instead of floating over
one.

There is **no shadow-blob system to hang it on** — the game uses real shadow
maps throughout, and `registerShadowTarget` (`systems.js:5213`) is the only
registry of grounded things. So it has to be built, and the cheap correct shape
is a **darkening term in the ground materials' own fragment shader**, fed a
fixed-size uniform array of the nearest N contact points. No extra draw calls,
no decal z-fighting, no transparency sorting, correct on a heightfield, and it
composites underneath the grain rather than on top of it.

Emphatically **not** alpha-blended dark quads. Sydney already has flat lilac
jacaranda decals on the lawn (`na-sydney.png`) and they are the worst-looking
thing in that frame; a second family of flat blobs is not the answer.

### P2 — The world does not move *(all 19 chapters)*

Measured above: an authored nineteen-row wind with two consumers, neither of
them visual, and zero vertex animation in the entire codebase.

A shared `sway(m, opts)` helper in `shared.js`, in the same `onBeforeCompile`
style `grain()` established, displacing `transformed` by a term proportional to
height above the object's own base and driven by the live gust and bearing.
**Defaulting to zero, opted into one call site at a time** — the rule that made
the polish pass's phase 1 revertible.

### P3 — Light that lands on something *(Hong Kong, Monte Carlo, Iceland, and the capybara everywhere)*

Zero point lights in eight of nine sampled chapters. Hong Kong's floor at
34.1/255. Monte Carlo's lamp lighting nothing. This is `/polish V2`, scoped and
never run, and it is still the largest single-chapter win in the build — it is
ranked third here only because it reaches three chapters where P1 and P2 reach
nineteen.

It is also the only item in this pass that can plausibly cost frame time, which
is why it goes in the second batch behind a measured gate.

### P4 — Four floors still have nothing drawn on them *(Cali, Palawan, Sydney, Venice)*

Cali SD **6.11**, Palawan **7.72**, Sydney **8.78**, Venice **10.61**, against
Rio's **56.25**. The near octave has done all it can. What is left is the Rio
move, repeated, and in each case there is a historically real thing to draw:

| chapter | what goes on the floor | why it is the right one |
|---|---|---|
| **Venice** | Istrian-stone banding across the Piazzetta | it is what is actually there, and Venice is a sheet of white paper without it |
| **Palawan** | the wet-sand tideline, the swash arcs, coral rubble drifts | 19 colours across 226 mean luminance is the worst floor in the game |
| **Cali** | the Plaza de Cayzedo's paving and its tree wells | 6.11 is the lowest SD measured anywhere |
| **Sydney** | worn desire paths across the lawn, fallen jacaranda that is not a flat lilac blob | 45 colours, and the existing decals actively hurt |

Rio's `rioBuildCalcadao` is the template: banded vertex-coloured quad strips,
y = 0.02, one mesh, one draw call, procedural.

### P5 — There is no sun, and the lens clamps *(all 19 chapters)*

Sun disc and horizon glow from the existing `sun` directional so it cannot drift
from the lighting; a moon in the chapters that are at night. Then the filmic
roll-off before the sRGB encode.

And the split tone that does not exist: the whole grade is
`c = clamp(c * uTint + uLift, 0.0, 1.0)` (`main.js:681`), and `sysGrade`
(`systems.js:1085`) hard-codes `liftR: 0, liftG: 0, liftB: 0` in its return —
so **no row can set a lift at all**, and all twenty are zero by construction.
Monte Carlo's comment describes a split tone the shader cannot produce. Either
implement it or correct the comment.

Measured at **0% clipping everywhere**, so the roll-off is quality and the sun
is the picture. Ranked last, and it must run last regardless, because it
re-grades every chapter and wants everything above it settled underneath.

---

## What is deliberately NOT in this pass

- **The score, the per-place ambience, the instruments.** The polish pass just
  rebuilt these and they are good. Do not touch them.
- **`grain()`'s near octave and the rim.** Measured working above.
- **The task list, the journal, the ledger, the album, souvenirs, records, acts,
  finds, the NPC heat field.** The engagement systems in this game are further
  along than its picture is; that is the honest read, and adding a nineteenth
  system would be the wrong call. P2 is the delight item in this pass, and it
  earns that by making a mechanic the player already feels become visible.
- **Contact darkening by decal.** See P1 — it is the same family as the
  jacaranda blobs.

---

# THE TWO BATCHES

```
/presence           run both, in order, commit at every phase boundary
/presence 1         the world sits in itself, and it moves
/presence 2         the light, the floor and the sun
/presence list      print the plan and stop
```

The skill is at `.claude/skills/presence/`. The split is **by risk**, not by
subject, and the reasoning is the same one `/polish V4` already carries:

**Batch 1 — P1 + P2. The safe one.** Two shared shader terms, both opt-in,
both defaulting to current behaviour. **Zero new draw calls, zero new lights,
zero re-grading.** Nothing in it can change a bloom threshold. Safe to run
unattended, and it builds the nearest-N ranking helper that batch 2's light pool
then reuses.

**Batch 2 — P3 + P4 + P5. The one with the gates.** The light pool is the only
change in the pass that can cost frame time; the lens re-grades all twenty
`sysGRADES` rows. Both want batch 1 settled underneath them — a floor with
contact darkening on it is a different floor to light and to grade.

| batch | phase | what | est. |
|---|---|---|---|
| **1** | 1 | **Contact** — a nearest-N darkening term in the ground materials, wired to props, NPCs and the capybara across all 19 | ~2.5 h |
| **1** | 2 | **Sway** — a vertex term in `shared.js` reading the live gust, opted into the foliage and cloth of all 19 | ~2 h |
| **2** | 3 | **Light** — a budgeted pool, then Hong Kong, Monte Carlo and Iceland | ~2.5 h |
| **2** | 4 | **The floor** — a graphic on it in Cali, Palawan, Venice and Sydney | ~2 h |
| **2** | 5 | **The sun** — disc, glow, moon; then the roll-off and the grade re-validation | ~2 h |
|  |  | **total** | **9–13 h** |

**These estimates are scope, not measurement.** Every other number in this
document came off the framebuffer or out of the source. A verify cycle here is
about five minutes because `playwright-cli` must `close-all` and re-open to
defeat the ES-module cache, and an eight-chapter measurement run is about five
minutes of mostly waiting; phases 1, 2 and 5 are dominated by looking at the
result rather than by writing the code.

Full phase text — the finding behind each, the work, and its acceptance test —
is in `.claude/skills/presence/batches/ONE.md` and `TWO.md`.
