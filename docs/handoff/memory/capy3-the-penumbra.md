---
name: capy3-the-penumbra
description: "v49 — the per-biome shadow softness table had never been wired, contact hardening for free, and four attempts at one instrument"
metadata:
  type: project
---

Ran 30 Aug 2026 after [[capy3-the-airlight]], on "do the shadow penumbra next".
Commit `488bfa9`. Architecture is in **CONTRACT.md ➜ "THE PENUMBRA (v49)"**.

**`sysBIO_SH_RAD` HAD NEVER REACHED THE SHADER.** It has been in systems.js since
chapter 2 with a comment saying *"PCFShadowMap does honour shadow.radius (it
scales the PCF tap offsets), so this is free."* True, and about the wrong
constant: the renderer is set to **PCFSoftShadowMap** thirty lines below it, and
three's PCF_SOFT branch does not reference `shadowRadius` at all.

Byte-exact (`qa/shadow-probe.js`): radius **1 vs 25 under PCF_SOFT changes 0.000%
of the frame, peak 0**; under plain PCF the same change moves 15.485%. So every
shadow in nineteen chapters was one fixed one-texel kernel regardless of caster
height. **A comment that names a constant is not evidence the constant is in
use** — check the type it is talking about is the type that is set.

**CONTACT HARDENING COST NOTHING.** three's PCF_SOFT is a fixed 16 taps for every
fragment always. The replacement is a 5-tap blocker search, and only fragments
that find a blocker spend 12 more — so the lit two thirds of a daylight frame get
*cheaper*. Differential (`git stash` the file, rebuild, re-run, restore):
**−0.198 to +0.137 ms** over four chapters, and a negative delta is impossible
for added work, so the noise floor is ±0.2 and the cost is unmeasurable. Reusing
`shadowRadius` as the LIGHT SIZE is what the dead table was reaching for and
needed no new plumbing.

**FOUR ATTEMPTS AT ONE INSTRUMENT, AND THE FOURTH WAS TO STOP MEASURING THE
OBVIOUS THING.** Measuring a shadow edge's 10–90% width failed three ways:

1. **It measured the depth of field.** The lens is still on and the defocus blurs
   the very edge under test — reported a 1279-pixel penumbra, i.e. the whole
   scanline. `dof`, `air`, `crease`, `vignette`, `contrast`, `bloom` all off first.
2. **It measured world motion.** `shot()` awaited an image decode *between* two
   renders; an await yields to rAF, which ticks the game. Reported an 11.3% frame
   difference from a uniform the shader provably never reads. **THIRD TIME THIS
   SESSION** — see [[capy3-the-depth-pass]] and [[capy3-the-leaf]]. Capture every
   arm synchronously, decode afterwards, always.
3. **It measured the test object.** Looking down at where a shadow lands, the
   caster is also in frame at low heights, and a dark box on a bright lawn is a
   far steeper edge than any penumbra.

The fix was to abandon width. **The prediction never needed one**: the two
filters agree for a caster on the ground and diverge as it rises. A per-pixel
diff between arms tests exactly that and cannot be fooled by clutter, because the
clutter is identical in both arms. Measured: 1.71% of frame differing at 0.25 m,
2.16% at 1 m, 6.14% at 3 m, **14.24% at 8 m**.

**It is a global three `ShaderChunk` override** — `getShadow()` is called from
`<lights_fragment_begin>` and shadows have no per-material hook. It **refuses to
install** if the chunk's `#elif` structure is ever missing, rather than
corrupting every shadow in the game. Installed from systems.js, which owns every
other decision about the sun.

16.3–16.9 ms median in all nineteen, 0 errors, `qa/fuzz.js` 19/19 clean.

**Still open:** Son Doong has no leaf term (its vegetation is merged into one
mesh with the rock), and the flat lilac jacaranda decals on Sydney's lawn, which
shared.js's own contact header calls the worst-looking thing in the game.

Related: [[capy3-the-airlight]], [[capy3-exposure]], [[capy3-the-leaf]],
[[capy3-the-depth-pass]], [[capy3-five-things-already-built]]
