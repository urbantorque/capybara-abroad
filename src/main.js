import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PALETTE, clamp } from './shared.js';
import { createEnvironment } from './environment.js';
import { createPhysicsWorld, createProps } from './props.js';
import { createCapybara } from './capybara.js';
import { createNPCs } from './npc.js';
import { createSystems } from './systems.js';
import { createPasto } from './pasto.js';
import { createQuay } from './quay.js';
import { createKyoto } from './kyoto.js';
import { createCali } from './cali.js';
import { createRio } from './rio.js';
import { createIceland } from './iceland.js';
import { createSahara } from './sahara.js';
import { createDrift } from './drift.js';
import { createVenice } from './venice.js';
import { createKowloon } from './kowloon.js';
import { createPalawan } from './palawan.js';
import { createGoreme } from './goreme.js';
import { createManly } from './manly.js';
import { createPantanal } from './pantanal.js';
import { createCave } from './cave.js';
import { createAntarctic } from './antarctic.js';
import { createCondor } from './condor.js';

// ---------------------------------------------------------------------------
// Coordinator-owned bootstrap. Modules are wired in a fixed order and each is
// isolated so one bad module degrades the game instead of blanking the screen.
// ---------------------------------------------------------------------------

function mainMakeEvents() {
  const map = new Map();
  return {
    on(name, fn) { if (!map.has(name)) map.set(name, []); map.get(name).push(fn); },
    off(name, fn) { const a = map.get(name); if (a) { const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); } },
    emit(name, payload) {
      const a = map.get(name);
      if (!a) return;
      for (let i = 0; i < a.length; i++) {
        try { a[i](payload); } catch (e) { console.error('[event ' + name + ']', e); }
      }
    },
  };
}

// ---------------------------------------------------------------------------
// TIME AS A CHANNEL (coordinator-owned).
//
// Seventeen chapters of physics comedy and there has never been anything
// between `clock.getDelta()` and the modules. Everything this game does to say
// "THAT just happened" is spatial — a shake, a burst of paper, a banner — and
// the one channel every comedy in the medium actually uses is TIME. A bin
// going over at 9 m/s, a capybara landing a forty-metre drop, the moment a
// chapter's marquee lands: all of them read as an event that the world had to
// stop and take in, and none of them could be written that way.
//
// So there is one now, and it is deliberately two verbs and no more:
//
//   hitstop(dur, scale)  a near-freeze. Instant on, instant off, milliseconds
//                        long. This is the impact one — it is punctuation, and
//                        punctuation that fades in is not punctuation.
//   slowmo(scale, dur)   a held beat. Eases in and out over ~0.1 s, because a
//                        slow-motion that snaps is a dropped frame.
//
// FOUR RULES, and every one of them is here because the obvious version of
// this feature is how you ship a game that stutters:
//
//   1. THE FLOOR IS NOT ZERO. Nine modules compute a kinematic velocity as
//      (target - previous) / dt (antarctic's floes, cali's cart, the ferry,
//      the van). At dt = 0 that is a division by zero and a body leaves the
//      map; cannon's own integrator has the same problem. The scale can never
//      go under MAIN_TIME_FLOOR, so "frozen" is 5% speed and nothing divides
//      by nothing.
//   2. IT IS CAPPED, IN BOTH DIMENSIONS. A hitstop may not exceed
//      MAIN_HOLD_MAX and a slow-motion may not exceed MAIN_SLOW_MAX. A cosy
//      game about a rodent must never be able to take the controls away, and
//      a bug in a biome that asks for ten seconds gets a third of one.
//   3. THE TIMERS RUN ON THE WALL CLOCK. A hitstop decremented by its own
//      scaled dt takes 1/scale times as long to expire, so an 80 ms freeze at
//      0.08 lasts a full second. They are decremented by the RAW frame time.
//   4. IT DOES NOTHING WHILE PAUSED, AND NOTHING UNDER prefers-reduced-motion.
//      Behind an open journal there is no world to stop; and a player who has
//      asked the operating system for less motion has asked for exactly this.
//
// Everything downstream is free: `game.state.dt` is the scaled figure and every
// module already reads the dt it is handed, so the whole world — physics, gait,
// crowd, wind, tide, camera, the score's own lookahead — slows together with no
// module knowing this exists. `game.state.rawDt` is there for the handful of
// things that must not (nothing yet; it is published so the next one has it).
// ---------------------------------------------------------------------------
const MAIN_TIME_FLOOR = 0.05;    // the slowest the world may ever run
const MAIN_HOLD_MAX   = 0.30;    // s — the longest freeze anyone may ask for
const MAIN_SLOW_MAX   = 6.0;     // s — ...and the longest held beat
const MAIN_SLOW_LAM   = 16;      // how quickly a slow-motion eases in and out

function mainMakeTime(game) {
  let holdT = 0, holdS = 1;      // hitstop: seconds left, and how close to stopped
  let slowT = 0, slowS = 1;      // slow-motion: seconds left, and its target
  let slowNow = 1;               // ...eased, so it never snaps
  let calm = false;
  try {
    calm = !!(typeof window !== 'undefined' && window.matchMedia &&
              window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  } catch (e) { calm = false; }

  const time = {
    /** True when the player has asked the OS for less motion. Read-only. */
    calm: calm,
    /** What was actually applied on the last frame. 1 = real time. */
    scale: 1,
    /**
     * The SLOW-MOTION component alone, eased, with the hitstop taken out.
     *
     * These have to be separable and it is not a nicety. A hitstop is a hole in
     * time: the correct thing for a lens, a grade or a UI to do during one is
     * NOTHING, because the whole frame is being held. A slow-motion is a shot:
     * it is the one a lens should lean into. Driving anything presentational
     * off `scale` conflates them — measured, a 55 ms freeze pulled the field of
     * view from 48 to 43.6 degrees and snapped it back, which is precisely the
     * dropped-frame artefact the freeze exists to avoid looking like.
     */
    slow: 1,
    /** True while a freeze or a held beat is live — for anything that must sit it out. */
    active: false,

    /**
     * A near-freeze. Instant on, instant off. `dur` seconds (capped at
     * MAIN_HOLD_MAX), `scale` how close to stopped (default 8%).
     * The strongest live request wins and a longer one still extends it, so
     * two impacts in the same frame read as one slightly heavier impact
     * rather than as two stutters.
     */
    hitstop(dur, scale) {
      if (calm || !(dur > 0)) return;
      const d = dur < MAIN_HOLD_MAX ? dur : MAIN_HOLD_MAX;
      const s = clamp(scale === undefined ? 0.08 : scale, MAIN_TIME_FLOOR, 1);
      if (holdT <= 0 || s < holdS) holdS = s;
      if (d > holdT) holdT = d;
    },

    /**
     * A held beat. Eases in and out. `scale` is the fraction of real time
     * (0.45 is a good marquee), `dur` seconds (capped at MAIN_SLOW_MAX).
     * A second request replaces the first outright rather than compounding —
     * two overlapping slow-motions is how you get a game running at 0.2x and
     * nobody able to say why.
     */
    slowmo(scale, dur) {
      if (calm || !(dur > 0)) return;
      slowT = dur < MAIN_SLOW_MAX ? dur : MAIN_SLOW_MAX;
      slowS = clamp(scale === undefined ? 0.45 : scale, MAIN_TIME_FLOOR, 1);
    },

    /** Everything back to real time, now. Used on a biome change. */
    clear() {
      holdT = 0; slowT = 0; holdS = 1; slowS = 1; slowNow = 1;
      time.scale = 1; time.slow = 1; time.active = false;
    },

    /**
     * Advance the channel by a real frame and answer with the dt the world
     * should be run at. Called by game.tick and by nobody else.
     */
    step(raw) {
      // Nothing to stop behind an open journal, and a freeze that survived a
      // pause would be spent the instant the card closed.
      if (game.state.paused) { time.clear(); return raw; }

      if (slowT > 0) slowT -= raw;
      const slowWant = slowT > 0 ? slowS : 1;
      // A first-order ease, so the beat arrives and leaves like a breath.
      slowNow += (slowWant - slowNow) * (1 - Math.exp(-MAIN_SLOW_LAM * raw));
      if (slowT <= 0 && slowNow > 0.999) slowNow = 1;

      let s = slowNow;
      if (holdT > 0) {
        holdT -= raw;
        // Deliberately NOT eased: a freeze that ramps is a frame-rate dip.
        if (holdS < s) s = holdS;
        if (holdT <= 0) { holdT = 0; holdS = 1; }
      }
      if (s < MAIN_TIME_FLOOR) s = MAIN_TIME_FLOOR;
      if (s > 1) s = 1;
      time.scale = s;
      time.slow = slowNow;
      time.active = s < 0.999;
      return raw * s;
    },
  };
  return time;
}

function mainSafe(label, fn) {
  try { return fn(); }
  catch (e) {
    console.error('[module ' + label + ' failed]', e);
    const el = document.getElementById('err');
    el.style.display = 'block';
    el.textContent += '[' + label + '] ' + (e.stack || e.message) + '\n';
    return null;
  }
}

// ---------------------------------------------------------------------------
// Biome streaming (coordinator-owned).
//
// Both biomes are authored in the SAME world coordinates — only one is ever
// attached at a time, so they can never overlap. Ownership is captured by
// intercepting `scene.add` / `world.addBody`: whatever a module adds while a
// capture tag is live belongs to that biome, including props and NPCs spawned
// long after boot. Nothing has to be refactored to opt in.
//
// Detaching a biome sets `visible = false` on its scene roots (zero draw calls,
// geometry stays resident so re-entry is instant) and removes its bodies from
// the CANNON world entirely (zero broadphase cost, zero solver cost).
// ---------------------------------------------------------------------------
function mainMakeBiomes(game) {
  const sets = new Map();          // name -> { objects:[], bodies:[], api, built }
  let captureTag = null;

  function setOf(name) {
    let s = sets.get(name);
    if (!s) { s = { objects: [], bodies: [], api: null, built: false }; sets.set(name, s); }
    return s;
  }

  const rawSceneAdd = game.scene.add.bind(game.scene);
  game.scene.add = function (...objs) {
    const r = rawSceneAdd(...objs);
    if (captureTag) {
      const s = setOf(captureTag);
      for (let i = 0; i < objs.length; i++) if (objs[i] && objs[i].isObject3D) s.objects.push(objs[i]);
    }
    return r;
  };

  let rawAddBody = null;           // world is created after this, patched in patchWorld()

  const biome = {
    current: 'sydney',
    PASTO_SPAWN: { x: 0, y: 1.4, z: 26 },
    SYDNEY_SPAWN: { x: 0, y: 1.2, z: 22 },
    // Circular Quay: on the apron, one wharf east of the berth, facing the water.
    QUAY_SPAWN: { x: 4, y: 1.0, z: 26 },
    // Kyoto: on the Gion lane, with the torii hill in front and Uji behind.
    KYOTO_SPAWN: { x: 0, y: 1.4, z: 34 },
    // Cali: on the south bank of the river, the Ermita on one hand and the
    // painted street on the other.
    CALI_SPAWN: { x: 0, y: 1.4, z: 24 },
    // Rio: on the calcadao at Copacabana, the Atlantic straight ahead and the
    // biscoito Globo man three steps to the right.
    RIO_SPAWN: { x: 0, y: 1.4, z: 0 },
    // Iceland: on Laugavegur in the middle of Reykjavik, the church up the hill
    // behind you and the hot dog stand four steps away.
    ICELAND_SPAWN: { x: 0, y: 1.4, z: 99 },
    // Marrakech: in the middle of Jemaa el-Fnaa, facing the Koutoubia, with the
    // orange cart within arm's reach and the souk over your shoulder.
    SAHARA_SPAWN: { x: 0, y: 1.4, z: 8 },
    // The Drift: on the Shelf, in the mist, a few metres back from the broken
    // jetty. Deliberately not ON the jetty — the first thing this chapter wants
    // is for you to look at where the planks stop, and you cannot look at that
    // from on top of it.
    DRIFT_SPAWN: { x: 2, y: 31.6, z: 42 },
    // Venice: on the Piazzetta between the two columns, the Bacino behind you
    // and the whole square in front. You are looking down the length of the one
    // thing this chapter is going to take away from you.
    VENICE_SPAWN: { x: -4, y: 1.4, z: 13 },
    // Kowloon: on the pavement in Mong Kok, under the signs, with the bakery
    // three steps away and the scaffold halfway up the block.
    KOWLOON_SPAWN: { x: 0, y: 1.4, z: 34 },
    // Palawan: high on the dry sand, with the whole bay in front of you and the
    // island on the horizon. Deliberately NOT in the water — the first thing
    // this chapter wants is for you to look at how far down you can see.
    PALAWAN_SPAWN: { x: 0, y: 2.6, z: 46 },
    // Cappadocia: at the bottom of the town, facing the valley, at ten past
    // five in the morning. The launch field is the next thing south and the
    // first envelope is already up on its side.
    GOREME_SPAWN: { x: 0, y: 8.4, z: 34 },
    // Manly: on the promenade at the top of the beach, under the pines, with
    // the whole surf zone laid out in front of you like a cross-section. The
    // first thing this chapter wants is for you to LOOK at the water and see
    // that it is doing something, and you cannot do that from in it.
    MANLY_SPAWN: { x: 0, y: 3.4, z: 46 },
    // The Pantanal: on the Transpantaneira where it comes down off the high
    // ground, with the flood on both sides and four of your own kind standing
    // in it forty metres away, entirely unbothered.
    PANTANAL_SPAWN: { x: 0, y: 3.0, z: 62 },
    // Sơn Đoòng: outside, in the daylight, at the mouth. Deliberately NOT in
    // the dark — the chapter's argument only works if you walk into it.
    CAVE_SPAWN: { x: 0, y: 4.0, z: 62 },
    // Antarctica: on the rock above the station, looking down the hill at
    // three red huts, a jetty and one orange boat. Deliberately at the TOP:
    // the first thing this chapter wants is for you to see that there is a
    // boat, and that everything else is a very long way past it.
    ANTARCTIC_SPAWN: { x: 0, y: 7.1, z: 52 },

    /**
     * WHERE A BIOME PUTS YOU DOWN. systems.js used to carry a nine-rung
     * conditional that repeated every one of these names; a tenth chapter that
     * forgot its rung would have been spawned at Sydney's coordinates inside
     * whatever Venice happens to have built there, which is a basilica.
     */
    spawnOf(name) {
      const k = String(name || 'sydney').toUpperCase() + '_SPAWN';
      return biome[k] || biome.SYDNEY_SPAWN;
    },

    /** Run `fn` with everything it adds tagged as belonging to `name`. */
    capture(name, fn) {
      const prev = captureTag;
      captureTag = name;
      try { return fn(); } finally { captureTag = prev; }
    },
    /** Manual tagging escape hatch for anything built outside scene.add. */
    claim(name, thing) {
      const s = setOf(name);
      if (thing && thing.isObject3D) s.objects.push(thing);
      else if (thing) s.bodies.push(thing);
    },
    /** Register a biome's lifecycle hooks: { ensureBuilt(), onEnter(), onExit() }. */
    register(name, api) { setOf(name).api = api; },
    isActive(name) { return biome.current === name; },
    has(name) { return sets.has(name); },

    attach(name, on) {
      const s = sets.get(name);
      if (!s) return;
      for (let i = 0; i < s.objects.length; i++) s.objects[i].visible = on;
      for (let i = 0; i < s.bodies.length; i++) {
        const b = s.bodies[i];
        if (on) { if (game.world.bodies.indexOf(b) < 0) game.world.addBody(b); }
        else { if (game.world.bodies.indexOf(b) >= 0) game.world.removeBody(b); }
      }
    },

    switchTo(name) {
      if (name === biome.current) return false;
      const from = biome.current, to = name;
      const fromSet = sets.get(from), toSet = setOf(to);

      if (fromSet && fromSet.api && fromSet.api.onExit) { try { fromSet.api.onExit(); } catch (e) { console.error(e); } }
      biome.attach(from, false);

      if (!toSet.built) {
        toSet.built = true;
        if (toSet.api && toSet.api.ensureBuilt) {
          biome.capture(to, () => { try { toSet.api.ensureBuilt(); } catch (e) { console.error(e); } });
        }
      }
      biome.current = to;
      captureTag = to;
      biome.attach(to, true);
      if (toSet.api && toSet.api.onEnter) { try { toSet.api.onEnter(); } catch (e) { console.error(e); } }
      game.events.emit('biome:enter', { name: to, from: from });
      return true;
    },

    _patchWorld() {
      if (rawAddBody) return;
      rawAddBody = game.world.addBody.bind(game.world);
      game.world.addBody = function (body) {
        const r = rawAddBody(body);
        if (captureTag) {
          const s = setOf(captureTag);
          if (s.bodies.indexOf(body) < 0) s.bodies.push(body);
        }
        return r;
      };
    },
    _setTag(t) { captureTag = t; },
  };
  return biome;
}

// ---------------------------------------------------------------------------
// THE COMPOSITE PASS (coordinator-owned).
//
// Thirteen chapters were being handed straight to the canvas: whatever the
// Lambert shader produced was what the player saw, clamped at white, with no
// stage at all between the scene and the screen. That is why every night in
// this game — the neon in Mong Kok, the aurora, the lantern on the Shelf, the
// festoon over Goreme, the mirador over Cali — was a set of coloured shapes
// rather than a set of LIGHTS. A light that does not spill is a sticker.
//
// So there is one now, and it is four small things:
//
//   1. THE SCENE GOES SOMEWHERE FIRST. A multisampled half-float target, so the
//      antialiasing this art style lives on is kept (four samples, exactly what
//      the default framebuffer was doing) and so values above white survive to
//      be seen by the bright pass instead of being clamped on the way out.
//   2. A BRIGHT PASS at quarter resolution with a soft knee. In a night biome
//      nothing on the ground is above the threshold, so the only pixels that
//      make it through ARE the lights — which is why the threshold is per-biome
//      rather than clever.
//   3. TWO SEPARABLE BLURS, also at quarter resolution, run twice with a
//      widening offset. Four passes over ninety thousand pixels; it does not
//      register on the frame.
//   4. A GRADE. Contrast as an S-curve applied in DISPLAY space (the same curve
//      applied in linear space crushes exactly the soft shadows this palette is
//      built out of), saturation, a per-biome multiply, a vignette, and a
//      dither — that last one is not decoration, it is what stops the new sky
//      domes banding into eight visible steps on an 8-bit canvas.
//
// Every number is a uniform and systems.js drives all of them from the same
// place it drives the fog and the sun, so the grade cross-fades with the
// hemisphere instead of snapping at a biome edge.
//
// If anything here fails to build — no WebGL2, no half-float, a driver that
// refuses a multisampled target — `enabled` goes false and the game renders
// exactly the way it did before. A post chain is not worth a black screen.
// ---------------------------------------------------------------------------
const MAIN_POST_VERT = [
  'in vec3 position;',
  'in vec2 uv;',
  'out vec2 vUv;',
  'void main() {',
  '  vUv = uv;',
  '  gl_Position = vec4(position.xy, 0.0, 1.0);',
  '}',
].join('\n');

const MAIN_POST_HEAD = [
  'precision highp float;',
  'precision highp sampler2D;',
  'in vec2 vUv;',
  'out vec4 fragColor;',
].join('\n');

const MAIN_POST_BRIGHT = MAIN_POST_HEAD + '\n' + [
  'uniform sampler2D tDiffuse;',
  'uniform float uThreshold;',
  'uniform float uKnee;',
  'void main() {',
  '  vec3 c = texture(tDiffuse, vUv).rgb;',
  // Max-channel rather than luma: a saturated red neon tube has a luma of 0.21
  // and would never clear any threshold worth setting on a daylit chapter.
  '  float l = max(max(c.r, c.g), c.b);',
  '  float s = clamp((l - uThreshold) / max(uKnee, 0.0001), 0.0, 1.0);',
  '  s = s * s * (3.0 - 2.0 * s);',
  '  fragColor = vec4(c * s, 1.0);',
  '}',
].join('\n');

const MAIN_POST_BLUR = MAIN_POST_HEAD + '\n' + [
  'uniform sampler2D tDiffuse;',
  'uniform vec2 uStep;',
  'void main() {',
  // 9-tap binomial folded to 5 reads by landing the outer taps between texels
  // and letting the bilinear filter do the pairwise sum for free.
  '  vec3 c = texture(tDiffuse, vUv).rgb * 0.2270270270;',
  '  c += texture(tDiffuse, vUv + uStep * 1.3846153846).rgb * 0.3162162162;',
  '  c += texture(tDiffuse, vUv - uStep * 1.3846153846).rgb * 0.3162162162;',
  '  c += texture(tDiffuse, vUv + uStep * 3.2307692308).rgb * 0.0702702703;',
  '  c += texture(tDiffuse, vUv - uStep * 3.2307692308).rgb * 0.0702702703;',
  '  fragColor = vec4(c, 1.0);',
  '}',
].join('\n');

const MAIN_POST_COMP = MAIN_POST_HEAD + '\n' + [
  'uniform sampler2D tDiffuse;',
  'uniform sampler2D tBloom;',
  'uniform float uBloom;',
  'uniform float uContrast;',
  'uniform float uSaturation;',
  'uniform float uVignette;',
  'uniform float uVigStart;',
  'uniform vec3  uTint;',
  'uniform vec3  uLift;',
  'vec3 mainSRGB(vec3 c) {',
  '  c = clamp(c, 0.0, 1.0);',
  '  return mix(c * 12.92, 1.055 * pow(c, vec3(0.4166666667)) - 0.055, step(vec3(0.0031308), c));',
  '}',
  'void main() {',
  '  vec3 lin = texture(tDiffuse, vUv).rgb;',
  '  lin += texture(tBloom, vUv).rgb * uBloom;',
  '  vec3 c = mainSRGB(lin);',
  // Contrast as a blend toward a smoothstep of itself: an S-curve that is exact
  // at 0 and at 1 and therefore cannot clip either end, unlike (c-0.5)*k+0.5.
  '  c = mix(c, c * c * (3.0 - 2.0 * c), uContrast);',
  '  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));',
  '  c = mix(vec3(l), c, uSaturation);',
  '  c = clamp(c * uTint + uLift, 0.0, 1.0);',
  '  float d = length(vUv - 0.5) * 1.41421356;',
  '  c *= 1.0 - uVignette * smoothstep(uVigStart, 1.0, d);',
  // One hash, a 255th of a step: invisible on its own, and the difference
  // between a smooth dome and eight visible bands of sky.
  '  float dth = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);',
  '  c += (dth - 0.5) * 0.0039215686;',
  '  fragColor = vec4(c, 1.0);',
  '}',
].join('\n');

const mainPostSize = new THREE.Vector2();
// A 1x1 black texture standing in for the bloom buffer when bloom is off, so
// the composite shader never samples an unbound sampler.
const mainPostBlack = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
mainPostBlack.needsUpdate = true;

function mainMakePost(game) {
  const renderer = game.renderer;
  const post = {
    enabled: false,
    // Defaults are DELIBERATELY a no-op. A biome that never registers a grade
    // looks exactly the way it did before this pass existed.
    params: {
      bloom: 0.0, threshold: 1.0, knee: 0.35, radius: 1.0,
      contrast: 0.0, saturation: 1.0, vignette: 0.0, vigStart: 0.62,
      tintR: 1, tintG: 1, tintB: 1, liftR: 0, liftG: 0, liftB: 0,
    },
    render() { renderer.setRenderTarget(null); renderer.render(game.scene, game.camera); },
    resize() {},
    set() {},
  };

  let sceneRT = null, bloomA = null, bloomB = null;
  let quadScene = null, quadCam = null, quad = null;
  let matBright = null, matBlur = null, matComp = null;
  let vw = 0, vh = 0, bw = 0, bh = 0;

  try {
    if (!renderer.capabilities.isWebGL2) throw new Error('needs WebGL2');

    sceneRT = new THREE.WebGLRenderTarget(2, 2, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true,
      stencilBuffer: false,
      samples: 4,
    });
    const half = {
      type: THREE.HalfFloatType, format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      depthBuffer: false, stencilBuffer: false,
    };
    bloomA = new THREE.WebGLRenderTarget(2, 2, half);
    bloomB = new THREE.WebGLRenderTarget(2, 2, half);

    // One triangle, in clip space, with uv baked in. No matrices, no camera
    // maths, and no chance of the quad being frustum-culled out of its own pass.
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.BufferAttribute(
      new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    tri.setAttribute('uv', new THREE.BufferAttribute(
      new Float32Array([0, 0, 2, 0, 0, 2]), 2));

    const raw = function (frag, uniforms) {
      const m = new THREE.RawShaderMaterial({
        uniforms: uniforms,
        vertexShader: MAIN_POST_VERT,
        fragmentShader: frag,
        depthTest: false, depthWrite: false,
      });
      // RawShaderMaterial gets none of three's preamble, so the ES 3.00 dialect
      // has to be asked for explicitly or these will not compile at all.
      m.glslVersion = THREE.GLSL3;
      return m;
    };

    matBright = raw(MAIN_POST_BRIGHT, {
      tDiffuse: { value: null }, uThreshold: { value: 1.0 }, uKnee: { value: 0.35 },
    });
    matBlur = raw(MAIN_POST_BLUR, {
      tDiffuse: { value: null }, uStep: { value: new THREE.Vector2() },
    });
    matComp = raw(MAIN_POST_COMP, {
      tDiffuse: { value: null }, tBloom: { value: mainPostBlack },
      uBloom: { value: 0 }, uContrast: { value: 0 }, uSaturation: { value: 1 },
      uVignette: { value: 0 }, uVigStart: { value: 0.62 },
      uTint: { value: new THREE.Vector3(1, 1, 1) },
      uLift: { value: new THREE.Vector3(0, 0, 0) },
    });

    quad = new THREE.Mesh(tri, matBright);
    quad.frustumCulled = false;
    quadScene = new THREE.Scene();
    quadScene.add(quad);
    quadCam = new THREE.Camera();

    post.enabled = true;
  } catch (e) {
    console.warn('[post] disabled:', (e && e.message) || e);
    post.enabled = false;
  }

  if (!post.enabled) return post;

  function mainPostDraw(material, target) {
    quad.material = material;
    renderer.setRenderTarget(target);
    renderer.render(quadScene, quadCam);
  }

  post.resize = function () {
    const s = renderer.getDrawingBufferSize(mainPostSize);
    const w = Math.max(2, Math.floor(s.x)), h = Math.max(2, Math.floor(s.y));
    if (w === vw && h === vh) return;
    vw = w; vh = h;
    bw = Math.max(2, w >> 2); bh = Math.max(2, h >> 2);
    sceneRT.setSize(vw, vh);
    bloomA.setSize(bw, bh);
    bloomB.setSize(bw, bh);
  };
  post.resize();

  const P = post.params;
  post.set = function (p) {
    for (const k in p) if (P[k] !== undefined) P[k] = p[k];
  };

  post.render = function () {
    post.resize();
    const p = P;

    renderer.setRenderTarget(sceneRT);
    renderer.clear();
    renderer.render(game.scene, game.camera);

    if (p.bloom > 0.0005) {
      matBright.uniforms.tDiffuse.value = sceneRT.texture;
      matBright.uniforms.uThreshold.value = p.threshold;
      matBright.uniforms.uKnee.value = p.knee;
      mainPostDraw(matBright, bloomA);

      // Two ping-ponged H/V pairs, the second at 2.4x the offset: a wide, soft,
      // cheap approximation of a kernel far larger than nine taps.
      const ux = p.radius / bw, uy = p.radius / bh;
      const u = matBlur.uniforms;
      u.tDiffuse.value = bloomA.texture; u.uStep.value.set(ux, 0);       mainPostDraw(matBlur, bloomB);
      u.tDiffuse.value = bloomB.texture; u.uStep.value.set(0, uy);       mainPostDraw(matBlur, bloomA);
      u.tDiffuse.value = bloomA.texture; u.uStep.value.set(ux * 2.4, 0); mainPostDraw(matBlur, bloomB);
      u.tDiffuse.value = bloomB.texture; u.uStep.value.set(0, uy * 2.4); mainPostDraw(matBlur, bloomA);
      matComp.uniforms.tBloom.value = bloomA.texture;
      matComp.uniforms.uBloom.value = p.bloom;
    } else {
      matComp.uniforms.tBloom.value = mainPostBlack;
      matComp.uniforms.uBloom.value = 0;
    }

    const c = matComp.uniforms;
    c.tDiffuse.value = sceneRT.texture;
    c.uContrast.value = p.contrast;
    c.uSaturation.value = p.saturation;
    c.uVignette.value = p.vignette;
    c.uVigStart.value = p.vigStart;
    c.uTint.value.set(p.tintR, p.tintG, p.tintB);
    c.uLift.value.set(p.liftR, p.liftG, p.liftB);
    mainPostDraw(matComp, null);
  };

  return post;
}

function mainBoot() {
  const canvas = document.createElement('canvas');
  document.body.insertBefore(canvas, document.getElementById('hud'));

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.fog);
  scene.fog = new THREE.Fog(PALETTE.fog, 90, 230);

  const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.5, 400);
  camera.position.set(0, 12, 34);
  camera.lookAt(0, 1, 20);

  const game = {
    THREE, CANNON,
    scene, camera, renderer, canvas,
    world: null,
    clock: new THREE.Clock(),
    events: mainMakeEvents(),
    input: {
      x: 0, z: 0, run: false,
      action: false, actionPressed: false,
      honk: false, honkPressed: false,
      whistle: false, whistlePressed: false,
      jump: false, jumpPressed: false,
      camYaw: 0,
    },
    // `dt` is the SCALED frame time every module is handed; `rawDt` is the wall
    // clock, and `timeScale` is the ratio. See mainMakeTime.
    state: { time: 0, dt: 0, rawDt: 0, timeScale: 1, paused: false, started: false, score: 0, chaos: 0, sailing: false },
    mats: null,
    props: [], npcs: [],
    capy: null, env: null, physics: null, hud: null, post: null,
    pasto: null, quay: null, kyoto: null, cali: null, rio: null,
    iceland: null, sahara: null, drift: null, venice: null, kowloon: null,
    palawan: null, goreme: null, manly: null, pantanal: null, cave: null,
    antarctic: null,
    condor: null, biome: null,
    completeTask() {}, toast() {}, shake() {}, sfx() {},
    registerShadowTarget() {},
    // THE TIME CHANNEL, filled in for real three lines below. Declared here so
    // the shape of `game` is one object literal and a reader does not have to
    // find the assignment to know these exist.
    time: null, hitstop() {}, slowmo() {},
    // THE LOCALS SERVICE, stubbed here and filled in by npc.js below. A biome
    // build runs before OR after npc.js depending on the chapter, and a chapter
    // that is built lazily on first entry runs long after everything - so the
    // two calls have to exist on frame zero and be harmless if nobody has
    // wired them up yet. See npc.js, THE LOCALS.
    addLocal() { return null; }, say() {},
  };
  window.__capy = game;

  // Built before anything else: a module's constructor is allowed to ask for a
  // beat, and the very first frame has to have a scale on it.
  game.time = mainMakeTime(game);
  game.hitstop = game.time.hitstop;
  game.slowmo = game.time.slowmo;

  const biome = mainMakeBiomes(game);
  game.biome = biome;
  // A held beat must not survive a hemisphere. Crossing a biome edge already
  // white-outs, swaps the score and re-fits the shadow box; carrying somebody
  // else's slow-motion into the arrival card would look like a hitch on the
  // first second of a new place.
  game.events.on('biome:enter', function () { game.time.clear(); });

  // The composite pass. Built before any module so systems.js can register a
  // grade in its constructor and the very first frame is already graded.
  game.post = mainSafe('post', () => mainMakePost(game)) ||
              { enabled: false, set() {}, resize() {}, params: {},
                render() { renderer.setRenderTarget(null); renderer.render(scene, camera); } };

  // 1. physics world (owns CANNON.World + shared contact materials)
  mainSafe('physics-world', () => createPhysicsWorld(game));
  if (!game.world) {
    game.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -24, 0) });
  }
  biome._patchWorld();

  // 2..8 gameplay modules. Sydney content is captured as it is built; the
  // capybara, condor and systems are biome-neutral and stay resident always.
  const env     = biome.capture('sydney', () => mainSafe('environment', () => createEnvironment(game)));
  const props   = biome.capture('sydney', () => mainSafe('props',       () => createProps(game)));
  const capy    = mainSafe('capybara',    () => createCapybara(game));
  const npcs    = biome.capture('sydney', () => mainSafe('npc',         () => createNPCs(game)));
  const condor  = mainSafe('condor',      () => createCondor(game));
  const pasto   = mainSafe('pasto',       () => createPasto(game));
  const quay    = mainSafe('quay',        () => createQuay(game));
  const kyoto   = mainSafe('kyoto',       () => createKyoto(game));
  const cali    = mainSafe('cali',        () => createCali(game));
  const rio     = mainSafe('rio',         () => createRio(game));
  const iceland = mainSafe('iceland',     () => createIceland(game));
  const sahara  = mainSafe('sahara',      () => createSahara(game));
  const drift   = mainSafe('drift',       () => createDrift(game));
  const venice  = mainSafe('venice',      () => createVenice(game));
  const kowloon = mainSafe('kowloon',     () => createKowloon(game));
  const palawan = mainSafe('palawan',     () => createPalawan(game));
  const goreme  = mainSafe('goreme',      () => createGoreme(game));
  const manly   = mainSafe('manly',       () => createManly(game));
  const pantanal = mainSafe('pantanal',   () => createPantanal(game));
  const cave    = mainSafe('cave',        () => createCave(game));
  const antarctic = mainSafe('antarctic', () => createAntarctic(game));
  const systems = mainSafe('systems',     () => createSystems(game));

  // The locals service, now that npc.js exists. Biomes call game.addLocal()
  // from their build and game.say() from their update; both were no-ops until
  // this line, which only matters for a chapter built before npc.js was (there
  // are none - every one of them is lazy).
  if (npcs && typeof npcs.addLocal === 'function') {
    game.addLocal = npcs.addLocal;
    game.say = npcs.say;
    game.locals = npcs.locals;
  }

  // Runtime spawns (props, NPCs) land in whichever biome is currently live.
  biome._setTag(biome.current);

  const all = [env, pasto, quay, kyoto, cali, rio, iceland, sahara, drift, venice, kowloon,
               palawan, goreme, manly, pantanal, cave, antarctic,
               props, capy, condor, npcs, systems];
  const updaterNames = ['environment', 'pasto', 'quay', 'kyoto', 'cali', 'rio', 'iceland', 'sahara',
                        'drift', 'venice', 'kowloon', 'palawan', 'goreme',
                        'manly', 'pantanal', 'cave', 'antarctic',
                        'props', 'capybara', 'condor', 'npc', 'systems'];
  all.forEach((m, i) => { if (m) m.__name = updaterNames[i]; });
  const updaters = all.filter(m => m && typeof m.update === 'function');

  addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    game.post.resize();
  });

  const STEP = 1 / 60;
  const MAX_SUBSTEPS = 5;

  // A NET UNDER THE SOLVER.
  // A constraint created across a gap, a body that ends up deeply inside a
  // heightfield, or a stack that resonates can all hand back a velocity with no
  // physical meaning — a soak of Pasto caught one body at 4.3 km/s. At that
  // speed a prop leaves the map in a single frame, and a prop that has left the
  // map is a TASK THAT CAN NEVER BE COMPLETED, which is a far worse bug than a
  // dropped frame. Nothing in this game legitimately exceeds about 40 m/s (a
  // stooping condor); the cap sits well clear of that, so it can only ever fire
  // on nonsense. Non-finite transforms are rolled back to the previous step,
  // which cannon has already stored for the interpolator.
  const MAIN_V_CAP = 90;
  function mainSaneWorld() {
    const bodies = game.world.bodies;
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      if (b.mass <= 0 || b.sleepState === 2) continue;
      const p = b.position, v = b.velocity;
      if (!(p.x === p.x && p.y === p.y && p.z === p.z) ||
          !(v.x === v.x && v.y === v.y && v.z === v.z)) {
        p.copy(b.previousPosition);
        v.set(0, 0, 0);
        b.angularVelocity.set(0, 0, 0);
        b.interpolatedPosition.copy(p);
        game.state.solverSaves = (game.state.solverSaves || 0) + 1;
        continue;
      }
      const sp2 = v.x * v.x + v.y * v.y + v.z * v.z;
      if (sp2 > MAIN_V_CAP * MAIN_V_CAP) {
        const s = MAIN_V_CAP / Math.sqrt(sp2);
        v.x *= s; v.y *= s; v.z *= s;
        game.state.solverSaves = (game.state.solverSaves || 0) + 1;
      }
      const aw = b.angularVelocity;
      if (aw.x === aw.x) {
        const a2 = aw.x * aw.x + aw.y * aw.y + aw.z * aw.z;
        if (a2 > 3600) { const s = 60 / Math.sqrt(a2); aw.x *= s; aw.y *= s; aw.z *= s; }
      }
    }
  }

  // One full frame. Exposed as game.tick so the game can also be advanced manually
  // (headless QA, deterministic capture) when requestAnimationFrame is throttled.
  game.tick = function (dt, render) {
    if (dt > 0.1) dt = 0.1;              // tab-switch guard
    game.state.rawDt = dt;
    // THE ONE PLACE THE WORLD'S CLOCK IS SET. Everything below — the solver,
    // every module's update, the gait, the crowd, the score's lookahead — runs
    // on this number, so a freeze or a held beat is one multiplication rather
    // than twenty-three modules that each have to opt in. See mainMakeTime.
    dt = game.time.step(dt);
    game.state.timeScale = game.time.scale;
    game.state.dt = dt;
    game.state.time += dt;

    if (!game.state.paused) {
      // Three-argument step: cannon-es owns the accumulator AND fills every body's
      // interpolatedPosition / interpolatedQuaternion for the leftover fraction of
      // the frame. Modules MUST render from those, not from body.position — a hand
      // rolled accumulator (what this used to be) renders the world at a hard 60Hz
      // no matter the display refresh, which is exactly what made motion look jerky.
      game.world.step(STEP, dt, MAX_SUBSTEPS);
      mainSaneWorld();
    }

    // A THROW MUST NOT BE A DEATH SENTENCE.
    // This used to splice the module out of the loop on its very first
    // exception, permanently and silently. One bad frame in capybara.js
    // therefore ended the game: the animal stopped answering the keys, drifted
    // wherever the solver left it, and nothing on screen said why. Modules get
    // a few strikes and a visible one-line report; only a module that fails
    // over and over is actually dropped, because at that point it is failing
    // every frame anyway and the console would fill with it.
    // A PAUSE THAT ONLY STOPS THE SOLVER IS NOT A PAUSE.
    //
    // `paused` is true while the journal is open or the tab is in the
    // background, and until now it gated exactly one thing: world.step. Every
    // other module carried on at full rate. So behind an open journal the tram
    // still ran its circuit and dinged, the storks still clattered, the bus
    // doors still popped, the tide still came in, the NPCs still walked their
    // routes and the ambience still fired - a whole world simulating itself at
    // sixty hertz for a player who is reading a list. Measured with an open
    // journal for eleven seconds per chapter, fourteen of the sixteen were
    // still asking for sound.
    //
    // systems.js is the one module that MUST keep running: it owns the HUD,
    // the camera and - the part that matters - the line that decides whether
    // the game is paused at all, so skipping it would make the pause a
    // one-way door. Everything else holds still, which is what the word means.
    const frozen = game.state.paused;
    for (let i = 0; i < updaters.length; i++) {
      const m = updaters[i];
      if (frozen && m.__name !== 'systems') continue;
      try {
        m.update(dt);
        if (m.__strikes) m.__strikes = 0;      // a good frame forgives the last bad one
      } catch (e) {
        m.__strikes = (m.__strikes || 0) + 1;
        if (m.__strikes <= 3) {
          console.error('[update ' + (m.__name || i) + ' strike ' + m.__strikes + ']', e);
          game.state.lastError = (e && e.message) || String(e);
        } else if (m.__strikes === 4) {
          console.error('[update ' + (m.__name || i) + '] failing every frame — dropped', e);
          updaters.splice(i, 1); i--;
        }
      }
    }
    if (render !== false) game.post.render();
  };

  function mainLoop() {
    requestAnimationFrame(mainLoop);
    game.tick(game.clock.getDelta(), true);
  }
  mainLoop();

  const boot = document.getElementById('boot');
  requestAnimationFrame(() => requestAnimationFrame(() => {
    boot.classList.add('hidden');
    setTimeout(() => boot.remove(), 700);
  }));
}

mainBoot();
