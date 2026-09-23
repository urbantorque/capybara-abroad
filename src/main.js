import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PALETTE, clamp, spillSlots, spillUniforms, calmOn, reflectRender, reflectInfo, reflectTex } from './shared.js';
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
import { createMonaco } from './monaco.js';
import { createHanoi } from './hanoi.js';
import { createWeather } from './weather.js';
import { createGrass } from './grass.js';
import { createCondor } from './condor.js';
import { createRival } from './rival.js';

// ---------------------------------------------------------------------------
// Coordinator-owned bootstrap. Modules are wired in a fixed order and each is
// isolated so one bad module degrades the game instead of blanking the screen.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// THE ANNOUNCEMENT BUS, AND WHO IS ALLOWED TO LEAVE IT.
//
// Fifty `on()` registrations across the twenty-eight modules and, at the time
// of writing, not one `off()`. That is CORRECT rather than leaky, but only
// because of a property nothing in this file was stating: every registration
// sits in a module constructor, and those run exactly once, at boot. Nobody
// needs to unsubscribe because nobody is ever torn down.
//
// The reason to write it down is that chapters are no longer all built at boot
// — they build on first entry. A chapter that called `on()` from its
// `ensureBuilt()` would look identical to every other registration here and
// would be fine right up until something rebuilt it, at which point that
// chapter handles every announcement twice and nothing on screen says so.
//
// SO: THE RULE. Register in a module constructor and never unsubscribe. If you
// must register from a lazy `ensureBuilt()`, pair it with an `off()` in that
// chapter's `onExit` — that is what `off` is here for, and it is the only case
// that should ever call it.
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
  // ---- THE CALM SWITCH HAS TO BE LIVE, AND THIS ONE WAS NOT (P2) ---------
  // It was read once at boot into a private `calm`, so the freeze and the held
  // beat asked the OPERATING SYSTEM and never the player. R4 put a "less
  // motion" switch on the pause card and routed it through shared.js's one
  // channel; the shake and the FOV kick honour that channel, and these two —
  // the two that stop time altogether — did not. A player who turned calm on
  // still got every impact freeze in the game, which is the most physical thing
  // on the list and the one most likely to be why they asked.
  //
  // `calmOn()` is that channel: the player's preference where they have set
  // one, the OS media query where they have not. Asked per call, so the switch
  // works the moment it is flipped and an OS change mid-session lands too.

  const time = {
    /** True when the player has asked the OS for less motion. Read-only. */
    get calm() { return calmOn(); },
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
      if (calmOn() || !(dur > 0)) return;
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
      if (calmOn() || !(dur > 0)) return;
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
      // ---- A PAUSE KEEPS THE BEAT (L4, qa #7) -----------------------------
      // This used to clear() here: "a freeze that survived a pause would be
      // spent the instant the card closed". It also threw the beat away.
      // Measured: slowmo(0.4, 4), Esc at 0.5 s, resume at 3 s, timeScale
      // 1.00 — the remaining two and a half seconds of the condor's roll,
      // the flood, the cave drop, gone to a stray Esc or a tab switch (hidden
      // sets `paused` too). So under pause nothing moves: the timers are not
      // decremented, the ease is not advanced, and the world gets `raw` back
      // because the world is not being stepped anyway. The moment the player
      // paused in is the moment they come back to. clear() stays the biome
      // change's, which calls it by name.
      if (game.state.paused) return raw;

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

/**
 * One place a failure is reported, so nothing important can fail only into the
 * console. A lazily-built chapter throws long after boot, and until this was
 * split out of mainSafe there was no way for that path to reach the panel the
 * player can actually see.
 */
function mainReport(label, e) {
  console.error('[' + label + ']', e);
  try {
    const el = document.getElementById('err');
    if (el) {
      el.style.display = 'block';
      el.textContent += '[' + label + '] ' + ((e && (e.stack || e.message)) || e) + '\n';
    }
  } catch (ignored) { /* the panel is a courtesy, never a second failure */ }
}

function mainSafe(label, fn) {
  try { return fn(); }
  catch (e) {
    mainReport('module ' + label + ' failed', e);
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
    if (!s) { s = { objects: [], bodies: [], vis: [], parked: new Set(), api: null, built: false }; sets.set(name, s); }
    return s;
  }

  const rawSceneAdd = game.scene.add.bind(game.scene);
  game.scene.add = function (...objs) {
    const r = rawSceneAdd(...objs);
    if (captureTag) {
      const s = setOf(captureTag);
      // Object3D.add(a, b) calls this.add again for each argument.
      for (let i = 0; i < objs.length; i++) if (objs[i] && objs[i].isObject3D && !s.objects.includes(objs[i])) s.objects.push(objs[i]);
    }
    return r;
  };

  let rawAddBody = null;           // world is created after this, patched in patchWorld()

  const biome = {
    current: 'sydney',
    // ---- AND THE ARRIVAL IS A SHOT (v32) ---------------------------------
    // Every `yaw` below is `atan2(-(tx - sx), -(tz - sz))` from the spawn to
    // the thing the paragraph beside it names — the camera sits at that bearing
    // and the view runs the other way, so the named thing is dead centre. The
    // fourteen that had none used to open on whatever the last chapter had been
    // looking at. See teleportCapy: the same bearing is handed to frameShot and
    // HELD for the length of the place card, because setting camYaw points the
    // lens and does not stop the rig easing off it on the next frame.
    //
    // Pasto: on the road above the town, with Galeras across the valley. The
    // volcano is 104 m out and 62 m tall and it is the whole chapter; it was
    // behind the player's left shoulder.
    PASTO_SPAWN: { x: 0, y: 1.4, z: 26, yaw: 0.3948 },
    // Sydney: on the lawn above the forecourt, looking down it at the shells.
    // The figs were planted to frame this and nothing ever pointed at it.
    SYDNEY_SPAWN: { x: 0, y: 1.2, z: 22, yaw: 0 },
    // Circular Quay: on the apron, one wharf east of the berth, facing the water.
    // Down the harbour: the ferry on her berth in the near field and the bridge
    // eighty metres out on the bow.
    QUAY_SPAWN: { x: 4, y: 1.0, z: 26, yaw: -0.0950 },
    // ---- AND WHICH WAY YOU ARE POINTING WHEN YOU LAND --------------------
    // `yaw` is the direction the CAMERA sits in relative to the animal (the
    // same convention systems.js's camYaw uses), so `yaw: 0` puts the eye to
    // the south and the shot looks north up +z. It is optional and it is new:
    // every comment in this block has described a heading since the chapters
    // were written and none of them were ever set, so the first frame of a
    // chapter pointed wherever you had been looking in the LAST one. Arriving
    // in Cali from Sydney put a rosa wall four metres in front of the lens.
    // See teleportCapy in systems.js.
    //
    // Kyoto: on the Gion lane, with the torii hill in front and Uji behind.
    // Looking a shade west of due south: the hill's summit is at (-34, -128),
    // the mirror pond and the pavilion fill the middle distance, and Gion's
    // machiya — six metres behind the animal's tail — stay out of the frame.
    KYOTO_SPAWN: { x: -16, y: 1.4, z: 52, yaw: -1.5708 },
    // Cali: on the south bank of the river, the Ermita on one hand and the
    // painted street on the other. Due south, down the length of the Río Cali:
    // the painted street's back row stands one metre off the animal's tail and
    // was the entire arrival shot.
    CALI_SPAWN: { x: -16.5, y: 1.4, z: -19.5, yaw: -3.1416 },
    // Rio: on the calcadao at Copacabana, the Atlantic straight ahead and the
    // biscoito Globo man three steps to the right. Due south is the sea, the
    // break off Arpoador and the wave paving running out to both edges of frame.
    RIO_SPAWN: { x: 0, y: 1.4, z: 0, yaw: 0 },
    // Iceland: on Laugavegur in the middle of Reykjavik, the church up the hill
    // behind you and the hot dog stand four steps away.
    // Facing east along Laugavegur with the stand eight metres up the street
    // and the old harbour beyond it — the church stays behind, which is what the
    // line above asks for and what no heading had ever delivered.
    ICELAND_SPAWN: { x: 0, y: 1.4, z: 99, yaw: -1.5708 },
    // Marrakech: in the middle of Jemaa el-Fnaa, facing the Koutoubia, with the
    // orange cart within arm's reach and the souk over your shoulder.
    // Due west across the square at the minaret, 52 m out and 38 m tall; the
    // cart is a step behind the right shoulder and the souk behind the left.
    // `raise` because the minaret is 38 m tall at 52 m out: at the arrival
    // pitch alone the frame stopped at its first storey. See sysARRIVE_RAISE.
    SAHARA_SPAWN: { x: 0, y: 1.4, z: 8, yaw: 1.4940, raise: 3.5 },
    // The Drift: on the Shelf, in the mist, a few metres back from the broken
    // jetty. Deliberately not ON the jetty — the first thing this chapter wants
    // is for you to look at where the planks stop, and you cannot look at that
    // from on top of it.
    // ...so the heading is AT the broken end, 27 m away, with the void past it.
    DRIFT_SPAWN: { x: 2, y: 31.6, z: 42, yaw: -1.2723 },
    // Venice: on the Piazzetta between the two columns, the Bacino behind you
    // and the whole square in front. You are looking down the length of the one
    // thing this chapter is going to take away from you.
    // Down the length of it: the Basilica closes the far end at 83 m and the
    // Campanile stands 22 degrees off the centre line, just inside the frame.
    VENICE_SPAWN: { x: -4, y: 1.4, z: 13, yaw: 0 },
    // Kowloon: on the pavement in Mong Kok, under the signs, with the bakery
    // three steps away and the scaffold halfway up the block.
    // Down the block, under the signs, with the big one 41 m out over the road.
    KOWLOON_SPAWN: { x: 0, y: 1.4, z: 34, yaw: -0.0876 },
    // Palawan: high on the dry sand, with the whole bay in front of you and the
    // island on the horizon. Deliberately NOT in the water — the first thing
    // this chapter wants is for you to look at how far down you can see.
    // ...so the heading is out over the bay, with the island a few degrees off
    // the starboard bow rather than behind the shoulder.
    PALAWAN_SPAWN: { x: 0, y: 2.6, z: 46, yaw: -0.1218 },
    // Cappadocia: at the bottom of the town, facing the valley, at ten past
    // five in the morning. The launch field is the next thing south and the
    // first envelope is already up on its side.
    // Due south down the valley at the launch field, 30 m out.
    GOREME_SPAWN: { x: 0, y: 8.4, z: 34, yaw: 0 },
    // Manly: on the promenade at the top of the beach, under the pines, with
    // the whole surf zone laid out in front of you like a cross-section. The
    // first thing this chapter wants is for you to LOOK at the water and see
    // that it is doing something, and you cannot do that from in it.
    // ...so the heading is straight out to sea, square to the sets, with the
    // bommie six degrees off the bow.
    MANLY_SPAWN: { x: 0, y: 3.4, z: 46, yaw: -0.1127 },
    // The Pantanal: on the Transpantaneira where it comes down off the high
    // ground, with the flood on both sides and four of your own kind standing
    // in it forty metres away, entirely unbothered.
    // Straight down the road, which is the only line from which the flood is
    // on BOTH sides of the frame.
    PANTANAL_SPAWN: { x: 0, y: 3.0, z: 62, yaw: 0 },
    // Sơn Đoòng: outside, in the daylight, at the mouth. Deliberately NOT in
    // the dark — the chapter's argument only works if you walk into it.
    // ...so the heading is at the mouth, from outside it.
    CAVE_SPAWN: { x: 0, y: 4.0, z: 62, yaw: 0 },
    // Antarctica: on the rock above the station, looking down the hill at
    // three red huts, a jetty and one orange boat. Deliberately at the TOP:
    // the first thing this chapter wants is for you to see that there is a
    // boat, and that everything else is a very long way past it.
    // ...so the heading is down the hill at the jetty and the boat on her
    // berth, 30 m below and out. The three huts are off the frame to starboard:
    // the paragraph asks for both and the geometry cannot give both, and the
    // BOAT is the sentence the chapter is built on.
    //
    // FOUR METRES DOWN THE HILL FROM WHERE IT SHIPPED (F1). At z 52 the rock
    // the animal stands on is directly behind it on the arrival bearing, so
    // `sysCamClear` cut the boom to a QUARTER — measured 3.68 m of an 11.44 m
    // reach, three runs, clear 0.25 — and the first frame of the chapter was a
    // translucent capybara half-swallowed by a grey slab with the jetty off the
    // top edge. Everything the paragraph above asks for was behind the camera.
    // At z 48 the same bearing has 11.9 m of clean boom (clear 1.00, three
    // runs), the animal lands dead centre at 55 px of a 900 px frame, and the
    // jetty, the man on it, the orange boat, the signpost, the drums and the
    // pack ice are all in shot. The heading is unchanged; only the hill is.
    ANTARCTIC_SPAWN: { x: 0, y: 5.7, z: 48, yaw: -0.1194 },
    // Monte Carlo: on the west quay at the bottom, looking east across the
    // basin at a hundred and thirty feet of somebody else's money, with the
    // terrace and the Casino lit up above it. Deliberately at the BOTTOM and
    // deliberately facing ACROSS rather than up: the whole shape of this
    // chapter is a climb, and a player put down on the terrace would never
    // find out that the terrace is up.
    // ---- ...AND IT IS AT HER, NOT PAST HER (v32) -------------------------
    // The heading is unchanged — pi, "facing ACROSS" — and the spawn has slid
    // twenty metres WEST along the same quay so that heading points at the
    // yacht instead of thirty metres to one side of her. monYACHT is at
    // (10, -59): from x = 10 she is dead ahead, 21 m out, and the gangway task
    // that used to be 22 m away is 9. Measured before: the yacht was a sliver
    // of rail along the right edge and a palm frond filled the left half.
    //
    // THE BOOM HAS TO RUN DOWN A GAP IN THE PALMS. monBuildPalms lays ten of
    // them along z = -84.5 from x = -40 to x = 42, so the gaps are at x =
    // 10.15, 19.25, 28.35 — and the camera swings SOUTH of the animal for any
    // bearing that looks north across the basin. At the old spawn the boom
    // parked inside the crown at x = 32.9 whatever the bearing; from x = 10 it
    // runs down a gap and the nearest crowns are at the frame's edges. That is
    // what `dist` and `pitch` are doing here: standing the lens far enough back
    // down the gap that the whole of her is in the shot.
    //
    // THE CASINO CANNOT BE IN THIS FRAME AND THE PARAGRAPH ABOVE IS WRONG
    // ABOUT IT. From this quay the yacht bears 3.14 and monCASINO at (118, 119)
    // bears -2.66, which is 62 degrees apart against a 48 degree lens. There is
    // no spawn on the quay from which both are legible; the geography the
    // paragraph describes — a Casino standing above the yacht — is not the
    // geography this world was built with. See the batch 6 log.
    MONACO_SPAWN: { x: 10, y: 3.9, z: -80, yaw: 3.14159, dist: 13, pitch: 0.34, raise: 4.4 },
    // Hanoi: on the west walk of Hoan Kiem, inside the ring road, facing
    // north-east across the water at the tower and the red bridge. Inside is
    // the only quiet place in the chapter, and the whole of the noise is
    // audible from it — which is the sentence the whole chapter is about, said
    // before anything has happened.
    HANOI_SPAWN: { x: -60, y: 2.4, z: -78, yaw: -1.94 },

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

    /**
     * WHERE A CHAPTER'S WORLD STOPS, WORKED OUT RATHER THAN WRITTEN DOWN.
     *
     * `backVoid()` in systems.js is the only thing in the game that can notice
     * the player has left the world, and until now it could only do that for a
     * chapter that published its own `bounds()`. FOUR of nineteen did. The
     * other fifteen were unbounded — and because every chapter's terrainHeight
     * is an analytic law that answers for the whole infinite plane, the animal
     * never falls either: capybara.js's soft floor catches it on the second
     * frame and it stands on invisible ground for ever. Measured before this:
     * the world stops being drawn at 72 m in Son Doong and 96 m in Kowloon, and
     * no bearing in either was ever rescued out to 440 m.
     *
     * A chapter's colliders are the honest answer to "does the world exist
     * here", so the box is the union of them and nothing else. Not the drawn
     * objects: an objects-based box is blown out to the radius of the sky dome
     * and the haze shell, which are the two largest things in every chapter and
     * are not places.
     *
     * THREE SHAPE CASES, AND TWO OF THEM CANNOT USE body.aabb:
     *
     *   Plane      — cannon gives an infinite plane an AABB of +/-MAX_VALUE,
     *                which passes isFinite() and silently makes the union the
     *                whole float range. Skipped: an infinite floor says nothing
     *                about where the world is.
     *   Heightfield— cannon leaves its AABB at Infinity until the body moves.
     *                It is also the single most important body in most
     *                chapters, so it is measured from its own data instead:
     *                (n-1) * elementSize along each local axis, the four
     *                corners pushed through the body transform.
     *   everything — the shape's bounding radius about its world-space centre.
     *   else         Slightly generous, never infinite, and generous is the
     *                right way to be wrong here.
     *
     * Validation: this reproduces Pasto's hand-written rectangle EXACTLY
     * (-132..132 / -130..134) without being told it. Rio's and Sydney's
     * hand-written boxes are tighter than their geometry, which is why a
     * chapter's own bounds() still wins — see api.bounds in systems.js.
     */
    boundsOf(name) {
      const s = sets.get(name);
      if (!s || !s.bodies.length) return null;
      // Cheap invalidation: a chapter that has grown or shrunk since the last
      // call is recomputed. A chapter never edits a body's position after the
      // build, so nothing subtler is needed.
      if (s.boundsBox && s.boundsN === s.bodies.length) return s.boundsBox;
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      const v = new CANNON.Vec3();
      function eat(wx, wz) {
        if (wx < x0) x0 = wx;
        if (wx > x1) x1 = wx;
        if (wz < z0) z0 = wz;
        if (wz > z1) z1 = wz;
      }
      for (let bi = 0; bi < s.bodies.length; bi++) {
        const b = s.bodies[bi];
        if (b.mass !== 0) continue;              // props move; they are not the world
        for (let si = 0; si < b.shapes.length; si++) {
          const sh = b.shapes[si];
          const off = b.shapeOffsets[si];
          if (sh instanceof CANNON.Plane) continue;
          if (sh instanceof CANNON.Heightfield) {
            const d = sh.data;
            if (!d || !d.length || !d[0] || !d[0].length) continue;
            const w = (d.length - 1) * sh.elementSize;
            const h = (d[0].length - 1) * sh.elementSize;
            for (let c = 0; c < 4; c++) {
              v.set(c === 1 || c === 3 ? w : 0, c === 2 || c === 3 ? h : 0, 0);
              if (off) v.vadd(off, v);
              b.quaternion.vmult(v, v);
              v.vadd(b.position, v);
              eat(v.x, v.z);
            }
            continue;
          }
          if (off) v.copy(off); else v.set(0, 0, 0);
          b.quaternion.vmult(v, v);
          v.vadd(b.position, v);
          const rad = sh.boundingSphereRadius || 0;
          eat(v.x - rad, v.z - rad);
          eat(v.x + rad, v.z + rad);
        }
      }
      if (!isFinite(x0) || !isFinite(x1) || !isFinite(z0) || !isFinite(z1)) return null;
      s.boundsN = s.bodies.length;
      s.boundsBox = { x0: x0, x1: x1, z0: z0, z1: z1 };
      return s.boundsBox;
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
      if (thing && thing.isObject3D) { if (!s.objects.includes(thing)) s.objects.push(thing); }
      else if (thing) s.bodies.push(thing);
    },
    // ---- THE OPPOSITE OF CLAIM (L4) ---------------------------------------
    // A body removed from the world for good was still listed in its
    // chapter's set, and attach(name, true) put it back. The errand prop is
    // the case that measured (qa/l4r-qa-leak.js): npc.js spawns it in the live
    // chapter, so the hook above files it under that chapter; leaving mid-
    // errand detaches the chapter and npc.js then removeProp()s it on
    // `biome:enter` — world.removeBody on a body already out is a no-op, and
    // the set still had it. Every return re-added one more KINEMATIC cup with
    // no prop behind it: Kyoto 2→3→4, Hanoi 3→4→4, Monaco 6→6→8 kinematic
    // bodies over three visits. Anything taken out of the world or the scene
    // on purpose calls this; `vis` is index-aligned with `objects`, so the two
    // are spliced together.
    disown(thing) {
      if (!thing) return;
      const obj = !!thing.isObject3D;
      for (const s of sets.values()) {
        const arr = obj ? s.objects : s.bodies;
        const i = arr.indexOf(thing);
        if (i < 0) continue;
        arr.splice(i, 1);
        if (obj) s.parked.delete(thing);
        if (obj && s.vis && s.vis.length > i) s.vis.splice(i, 1);
      }
    },
    /** Register a biome's lifecycle hooks: { ensureBuilt(), onEnter(), onExit() }. */
    register(name, api) { setOf(name).api = api; },
    isActive(name) { return biome.current === name; },
    has(name) { return sets.has(name); },
    /**
     * Everything a chapter added to the scene, for the shader warm in
     * systems.js's biomeGo (L6, E8). The live array, not a copy — read it,
     * never edit it. Scoped on purpose: `renderer.compile(scene)` walks the
     * eighteen hidden chapters too and would compile their materials against
     * THIS chapter's fog and lights, which is a program per material nothing
     * will ever draw.
     */
    objectsOf(name) { const s = sets.get(name); return s ? s.objects : null; },

    attach(name, on) {
      const s = sets.get(name);
      if (!s) return;
      for (let i = 0; i < s.objects.length; i++) {
        const o = s.objects[i];
        // PUT BACK WHAT WAS THERE, NOT `true`.
        //
        // This used to blanket-assign `visible = on`, which is wrong in one
        // direction: a chapter is full of things that are deliberately hidden
        // AT REST — a smoke puff, a thrown seed, a shred of paper, a sweep
        // mesh — and re-attaching turned every one of them back on. Most are
        // re-hidden by their own update on the next frame, so it read as a
        // one-frame flash of stale effects on chapter re-entry; the ones whose
        // update only hides them on a state change stayed on. Measured on a
        // Sydney re-attach: 151 meshes visible before, 210 after, and it did
        // not settle back.
        //
        // So the flag each object had is remembered on the way out and handed
        // back on the way in. Anything added to the set while the chapter was
        // away has no remembered value and correctly defaults to visible.
        if (on) {
          // Restore only roots this owner removed. A carried/reparented object
          // belongs to its new parent; a disowned prop must never return.
          if (s.parked.delete(o) && !o.parent) rawSceneAdd(o);
          o.visible = (s.vis && s.vis[i] !== undefined) ? s.vis[i] : true;
        } else {
          if (s.parked.has(o)) continue;
          if (!s.vis) s.vis = [];
          s.vis[i] = o.visible;
          o.visible = false;
          if (o.parent === game.scene) {
            game.scene.remove(o);
            s.parked.add(o);
          }
        }
        // The bundled Three.js traverses children even when a root has
        // matrixWorldAutoUpdate=false. Removing sleeping roots stops that
        // work without freezing any live rig, reflection or moving vehicle.
        // Keep automatic matrices on: an explicit off-scene query still works.
        o.matrixWorldAutoUpdate = true;
      }
      // MEMBERSHIP ONCE, NOT ONCE PER BODY. This was a linear scan of
      // world.bodies inside a loop over the chapter's own bodies — a few
      // hundred against a few hundred, so ~10^5 comparisons, twice per travel.
      // It is a one-off spike hidden inside the fade rather than anything you
      // can feel, but it is quadratic in exactly the two numbers that grow.
      // The set is kept in step as we go, so a body listed twice behaves the
      // way it did under indexOf rather than being added twice.
      const inWorld = new Set(game.world.bodies);
      for (let i = 0; i < s.bodies.length; i++) {
        const b = s.bodies[i];
        if (on) { if (!inWorld.has(b)) { (rawAddBody || game.world.addBody.bind(game.world))(b); inWorld.add(b); } }
        else { if (inWorld.has(b)) { game.world.removeBody(b); inWorld.delete(b); } }
      }
    },

    switchTo(name) {
      if (name === biome.current) return false;
      const from = biome.current, to = name;
      const fromSet = sets.get(from), toSet = setOf(to);

      // ---- YOU ARE ABOUT TO LEAVE (N3) -------------------------------------
      //
      // There has never been a "before" event here — `biome:enter` fires on the
      // far side, by which time the chapter you were in is detached, its meshes
      // are hidden and its module is not being ticked. That is right for the
      // seven subscribers that exist, and it makes one thing impossible:
      // taking something WITH you. THE STOWAWAY (systems.js) has to ask Venice
      // for a drawable pigeon while Venice is still the live chapter, and this
      // is the only frame on which it can.
      //
      // Emitted BEFORE `onExit` and before the detach, so a listener is talking
      // to a chapter that is entirely intact. Nothing may cancel the move: this
      // is a notification, and `switchTo` has already committed by the time it
      // reaches here.
      game.events.emit('biome:leave', { name: from, to: to });
      if (fromSet && fromSet.api && fromSet.api.onExit) { try { fromSet.api.onExit(); } catch (e) { console.error(e); } }
      biome.attach(from, false);

      // A CHAPTER THAT FAILS TO BUILD MUST NOT BE MARKED BUILT.
      //
      // `built` used to be set BEFORE ensureBuilt() ran, and the build was
      // wrapped in a catch that only reached the console. So a chapter that
      // threw half way through was flagged built for the rest of the session,
      // switchTo still answered true, and biomeGo teleported the animal onto a
      // spawn whose terrain collider might never have been created — into a
      // chapter it falls through, that re-entry can never repair, and that says
      // nothing at all on screen. It is the one failure in this file that
      // cannot be walked away from.
      //
      // ROLLBACK, NOT REORDER. The obvious repair is to build BEFORE detaching
      // `from`, which would make failure free. It is the wrong one: every
      // chapter is authored in the SAME world coordinates and the whole scheme
      // rests on only one being attached at a time (see the block at the top of
      // mainMakeBiomes). Building while the old chapter is still live would put
      // two of them in the world together, and any build that asks the world a
      // spatial question — a ground height, a ray, an overlap — would quietly
      // get the OTHER chapter's answer. So the order stands and the failure is
      // undone instead: put `from` back, leave `built` false so a later attempt
      // can retry, and answer false so biomeGo does not move the animal.
      if (!toSet.built) {
        let ok = true;
        if (toSet.api && toSet.api.ensureBuilt) {
          biome.capture(to, () => {
            try { toSet.api.ensureBuilt(); }
            catch (e) { ok = false; mainReport('biome ' + to + ' failed to build', e); }
          });
        }
        if (!ok) {
          // ...AND UNDO THE HALF THAT DID GET BUILT.
          //
          // Everything ensureBuilt() managed before it threw was added under
          // `capture(to)`, so it is in the scene, visible, with its bodies in
          // the world — and putting `from` back on top of it leaves TWO
          // chapters in one coordinate space, which is the exact condition the
          // block above refuses to allow. Worse, `built` stays false so a later
          // attempt runs ensureBuilt() again and captures a SECOND copy into
          // the same set; the retry then succeeds and attaches both.
          //
          // So the partial is detached and then discarded outright, which is
          // what makes a retry clean rather than cumulative. Nothing is
          // disposed: geometries and materials come out of shared caches
          // (mat(), the mergers) and are still owned by chapters that are
          // perfectly healthy — freeing them here would take those with it.
          biome.attach(to, false);
          for (let i = 0; i < toSet.objects.length; i++) {
            const o = toSet.objects[i];
            if (o && o.parent) o.parent.remove(o);
          }
          toSet.objects.length = 0;
          toSet.parked.clear();
          toSet.bodies.length = 0;
          toSet.vis = null;
          biome.attach(from, true);
          if (fromSet && fromSet.api && fromSet.api.onEnter) { try { fromSet.api.onEnter(); } catch (e) { console.error(e); } }
          captureTag = from;
          // ---- ...AND THE ROLLBACK IS AN ARRIVAL TOO (F3) ---------------
          // This path is careful about the scene and the world and then
          // re-entered the old chapter through `onEnter` ALONE — so the seven
          // `biome:enter` subscribers all skipped: the shadow box and
          // `camera.far` stayed on the chapter that failed to build, weather
          // never re-primed, a carry was never released, the incident chain
          // and the breadcrumbs kept the other chapter's coordinates, and
          // `game.time.clear()` never ran. You landed back where you started
          // wearing the other place's sky.
          //
          // `from` is where the player now is and `to` is where they were
          // trying to go, which is the same shape every other emit here uses.
          game.events.emit('biome:enter', { name: from, from: to });
          return false;
        }
        toSet.built = true;          // only once it actually built
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
// AND FOUR MORE, THE v40 LENS PASS. Every one of them is a no-op at its
// default, so a chapter that sets none is the chapter that shipped:
//
//   5. A SECOND BLOOM OCTAVE at an eighth, blurred from the finished quarter-res
//      one. A single scale of bloom is the glow ON a light; the wide one is the
//      air AROUND it, and without it the lamp on the Monte Carlo quay was a
//      white disc with a hard edge rather than a lamp.
//   6. A BOX DOWNSAMPLE IN THE BRIGHT PASS. It read one of the sixteen source
//      texels a quarter-res texel covers, so a one-pixel light flickered in and
//      out of the bloom as the camera moved.
//   7. A SHOULDER. Everything over white met a hard clamp and arrived at 1.0
//      with an edge on it. Now the top rolls off.
//   8. SPLIT TONING. `uTint` is one multiply over the whole frame and cannot say
//      the thing half the rows in sysGRADES are written about — that the sun is
//      warm and the sky filling its shadows is not.
//
// Every number is a uniform and systems.js drives all of them from the same
// place it drives the fog and the sun, so the grade cross-fades with the
// hemisphere instead of snapping at a biome edge.
//
// If anything here fails to build — no WebGL2, no half-float, a driver that
// refuses a multisampled target — `enabled` goes false and the game renders
// exactly the way it did before. A post chain is not worth a black screen.
// ---------------------------------------------------------------------------
// The pool size is shared.js's and is a compile-time literal in both shaders.
const MAIN_SPILL_N = spillSlots();
const mainSpillU = spillUniforms();
// How far down a view ray the airlight is allowed to look, in metres. A pixel
// of SKY carries the far plane as its depth, which is 2 200 m over Goreme, and
// integrating two kilometres of air for a lamp ten metres away saturates the
// term on the horizon. Every emitter in the game has a reach of 14-26 m, so
// there is nothing past this to find.
const MAIN_AIRLIT_FAR = 90;
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
  'uniform vec2 uTexel;',
  'uniform float uThreshold;',
  'uniform float uKnee;',
  'void main() {',
  // A QUARTER-RES TEXEL COVERS SIXTEEN SOURCE TEXELS AND THIS USED TO READ ONE.
  // A one-pixel light — a glow-worm, a window across the street, a speck of
  // sea sparkle — therefore flickered in and out of the bright pass as the
  // camera moved, because whether it survived depended on which of sixteen
  // texels the sample happened to land on. Four bilinear taps at the centres
  // of the four 2x2 quadrants is an EXACT 4x4 box average for four reads, and
  // a light that is averaged IN cannot flicker out. It is also what stops a
  // cluster of one-pixel lights growing the quarter-res LATTICE that the
  // cave's grade row is written around.
  '  vec3 c = texture(tDiffuse, vUv + uTexel * vec2( 1.0,  1.0)).rgb;',
  '  c += texture(tDiffuse, vUv + uTexel * vec2(-1.0,  1.0)).rgb;',
  '  c += texture(tDiffuse, vUv + uTexel * vec2( 1.0, -1.0)).rgb;',
  '  c += texture(tDiffuse, vUv + uTexel * vec2(-1.0, -1.0)).rgb;',
  '  c *= 0.25;',
  // Max-channel rather than luma: a saturated red neon tube has a luma of 0.21
  // and would never clear any threshold worth setting on a daylit chapter.
  '  float l = max(max(c.r, c.g), c.b);',
  '  float s = clamp((l - uThreshold) / max(uKnee, 0.0001), 0.0, 1.0);',
  '  s = s * s * (3.0 - 2.0 * s);',
  '  fragColor = vec4(c * s, 1.0);',
  '}',
].join('\n');

// FOUR CHANNELS AND NOT THREE. The bloom chain only ever cared about rgb, and
// for it this is arithmetically what it always was: the binomial weights sum to
// 0.99999, so the 1.0 the bright pass writes into alpha comes back out as 1.0
// and nothing downstream reads it anyway. The defocus chain is why — its buffer
// is COVERAGE-PREMULTIPLIED (rgb * coc, coc), and a blur that drops the fourth
// channel cannot carry a premultiplied image. One shader, two customers.
const MAIN_POST_BLUR = MAIN_POST_HEAD + '\n' + [
  'uniform sampler2D tDiffuse;',
  'uniform vec2 uStep;',
  'void main() {',
  // 9-tap binomial folded to 5 reads by landing the outer taps between texels
  // and letting the bilinear filter do the pairwise sum for free.
  '  vec4 c = texture(tDiffuse, vUv) * 0.2270270270;',
  '  c += texture(tDiffuse, vUv + uStep * 1.3846153846) * 0.3162162162;',
  '  c += texture(tDiffuse, vUv - uStep * 1.3846153846) * 0.3162162162;',
  '  c += texture(tDiffuse, vUv + uStep * 3.2307692308) * 0.0702702703;',
  '  c += texture(tDiffuse, vUv - uStep * 3.2307692308) * 0.0702702703;',
  '  fragColor = c;',
  '}',
].join('\n');

// ---------------------------------------------------------------------------
// THE RAYS (ROADMAP-WOW A4). A radial blur of the EXISTING quarter-res bloom
// toward the projected light, composited additively — no new scene render.
//
// Two passes of eight taps, the second at eight times the first's step, is
// sixty-four effective taps for sixteen reads: the first pass runs quarter-res
// bloomA into bloomB (free once the bloom's own ping-pong has finished), the
// second runs bloomB into eighth-res wideB (free once the wide octave has
// finished in wideA). Nothing is allocated for this, which is what lets the
// governor park it at rung 1 as allocated-but-skipped.
//
// THE SEED IS MASKED TO THE LIGHT. Without uMaskR every bright thing in the
// frame smears toward the light — Mong Kok's other signs streaking at the big
// one reads as a zoom blur, not as rays through wet air. The first pass only
// admits bloom inside uMaskR (frame heights) of the light, so what radiates is
// the light and nothing else; the second pass carries it out to the reach.
//
// Direction and distance are in FRAME-HEIGHT units (x scaled by aspect), so a
// ray is the same piece of the picture at every window size — the lesson the
// bloom's radius learned in v40 (MAIN_POST_REF_H). A tap that leaves the frame
// contributes nothing: a clamped edge texel would streak the frame's border.
// Travel is capped at the distance to the light so a pixel past it does not
// sample through it and out the other side.
// ---------------------------------------------------------------------------
const MAIN_POST_RAYS = MAIN_POST_HEAD + '\n' + [
  'uniform sampler2D tDiffuse;',
  'uniform vec2  uLight;',     // uv of the light
  'uniform float uAspect;',    // vw / vh
  'uniform float uStep;',      // one tap, in frame heights
  'uniform float uDecay;',     // weight per tap outward
  'uniform float uMaskR;',     // seed radius in frame heights; 0 = unmasked (pass 2)
  'void main() {',
  '  vec2 p = vec2(vUv.x * uAspect, vUv.y);',
  '  vec2 l = vec2(uLight.x * uAspect, uLight.y);',
  '  vec2 d = l - p;',
  '  float dist = length(d);',
  '  vec2 dir = dist > 1e-4 ? d / dist : vec2(0.0);',
  '  vec3 acc = vec3(0.0);',
  '  float w = 1.0;',
  '  for (int i = 0; i < 8; i++) {',
  '    float t = min(float(i) * uStep, dist);',
  '    vec2 q = p + dir * t;',
  '    vec2 quv = vec2(q.x / uAspect, q.y);',
  '    vec3 c = texture(tDiffuse, quv).rgb;',
  '    if (quv.x < 0.0 || quv.x > 1.0 || quv.y < 0.0 || quv.y > 1.0) c = vec3(0.0);',
  '    if (uMaskR > 0.0) c *= 1.0 - smoothstep(uMaskR * 0.45, uMaskR, length(q - l));',
  '    acc += c * w; w *= uDecay;',
  '  }',
  // A SUM WITH A FIXED GAIN, NOT A WEIGHTED MEAN. Divided by the weights this
  // read under one sRGB level (measured: a 6-px bulb seed averaged over 8 and
  // then 8 taps is ~0.01 linear, and the A/B was 0.00 %) — a ray is the light
  // integrated along the line. An eighth is the mean when every tap hits, so
  // a pixel on the source reads the seed and one three taps reach reads three
  // eighths of it; at a quarter the festoon on Goreme's plaza washed 48 % of
  // the frame at a mean of 21 levels, which is fog and not a glow.
  '  fragColor = vec4(acc * 0.125, 1.0);',
  '}',
].join('\n');

// ---------------------------------------------------------------------------
// THE DEPTH TERMS (v45). See THE DEPTH PASS in CONTRACT.md.
//
// Until now there was NOTHING in the buffer but colour, and three of the four
// things most obviously missing from a still of this game all wanted the same
// one texture:
//
//   - every frame is uniformly sharp from two metres to the fog, so a
//     photograph of the Piazzetta has sixty people in it and nowhere for the
//     eye to land;
//   - `scene.fog` is LINEAR and starts at 78-90 m, and the camera is six
//     metres up with the whole of the game happening between 3 and 40, so
//     aerial perspective — the cheapest depth cue there is — is switched off
//     exactly where the game is;
//   - and there is no ambient occlusion anywhere in this codebase. `contact`
//     (v-presence) is a twelve-slot pool of ground patches UNDER OBJECTS on
//     the 32 of 108 surfaces that opted in; it cannot darken a box against a
//     box, a wall against its own pavement, or the inside of an arch.
//
// The depth is already being written — sceneRT has always had a depth buffer,
// it was simply thrown away. Attaching a DepthTexture to it costs the resolve
// and nothing else, and MEASURED (qa/depthprobe.js) it resolves correctly off
// the samples:4 multisampled target in both arms, glErr 0, range 0..245.
//
// All three terms are a no-op at their default and every one of them has a
// switch on game.state that CUTS rather than fades, for the reason the lens
// pass wrote down: a probe reads two frames at dt = 0 and a damped switch does
// not move in two frames.
// ---------------------------------------------------------------------------
const MAIN_POST_DEPTH_FN = [
  // Window-space z back to a positive distance along the view axis, in metres.
  // The sky dome writes NO depth (depthWrite false, renderOrder -20), so the
  // sky arrives here as the clear value and reads as exactly `far` — which is
  // what it is, and which is what lets every term below gate itself off it.
  'float mainViewZ(float d, float n, float f) {',
  '  float z = d * 2.0 - 1.0;',
  '  return (2.0 * n * f) / (f + n - z * (f - n));',
  '}',
  // CIRCLE OF CONFUSION, 0..1, geometry only — the STRENGTH is applied at the
  // mix in the composite and never here, because this number is also the
  // coverage weight the premultiplied blur is normalised by, and a weight
  // scaled by an artistic strength is not a weight.
  //
  // uDof is (nearStart, nearEnd, farStart, farEnd) in metres. The near half is
  // switched off by passing (-1, 0), which makes its smoothstep 1 for every
  // positive distance and the term exactly zero — a cut, not a small number.
  'float mainCoC(float d, vec4 uDof) {',
  '  float fa = smoothstep(uDof.z, uDof.w, d);',
  '  float ne = 1.0 - smoothstep(uDof.x, uDof.y, d);',
  '  return clamp(max(fa, ne), 0.0, 1.0);',
  '}',
].join('\n');

// The coverage-premultiplied quarter-res downsample that feeds the defocus.
//
// WHY PREMULTIPLIED, AND WHY THE CoC IS PER TAP. A plain quarter-res blur of
// the scene smears the SHARP foreground outward, and the composite then reads
// that smear wherever CoC is high — so a crisp capybara against a defocused
// square acquires a brown halo. Weighting every tap by its own CoC and
// normalising at the far end means an in-focus pixel contributes nothing to
// the blurred image at all, which is the whole of the fix. Taking the CoC per
// tap rather than from an averaged depth is the same argument one level down:
// an averaged depth across a silhouette is a distance at which nothing exists.
const MAIN_POST_COC = MAIN_POST_HEAD + '\n' + [
  'uniform sampler2D tDiffuse;',
  'uniform sampler2D tDepth;',
  'uniform vec2 uTexel;',
  'uniform vec2 uCam;',
  'uniform vec4 uDof;',
  MAIN_POST_DEPTH_FN,
  'vec4 mainTap(vec2 uv) {',
  '  float d = mainViewZ(texture(tDepth, uv).x, uCam.x, uCam.y);',
  '  float c = mainCoC(d, uDof);',
  '  return vec4(texture(tDiffuse, uv).rgb * c, c);',
  '}',
  'void main() {',
  // The same four quadrant centres the bright pass uses, and for the same
  // reason: an exact 4x4 box average for four bilinear reads.
  '  vec4 a = mainTap(vUv + uTexel * vec2( 1.0,  1.0));',
  '  a += mainTap(vUv + uTexel * vec2(-1.0,  1.0));',
  '  a += mainTap(vUv + uTexel * vec2( 1.0, -1.0));',
  '  a += mainTap(vUv + uTexel * vec2(-1.0, -1.0));',
  '  fragColor = a * 0.25;',
  '}',
].join('\n');

// ---- THE OCCLUSION (AAA pass, 23 Sep 2026) --------------------------------
// The crease below cannot see the one junction every frame is built out of: a
// wall standing on the ground. From the lens the grass in front of a wall is
// NEARER than the wall, so the opposed pair calls it flat and leaves it lit —
// measured over eight arrival frames, the darkest 2 % of pixels sat at 49-62
// of 255 in every daylight chapter. Nothing in the picture was ever dark.
//
// This asks the question the crease cannot: is the neighbour ABOVE this
// pixel's own surface? That needs a normal, and the normal is rebuilt from
// depth off whichever neighbour is nearer in depth on each axis, so a flat-
// shaded face gets its exact plane and a silhouette does not bleed across.
// Twelve taps on a golden-angle spiral, a world-sized ring, rotated per pixel
// by interleaved gradient noise; the noise is what the bilateral pair below is
// for. Elevation under ~13 degrees counts for nothing (0.22 below), which is
// what keeps a lawn of blades and a cobbled square from greying themselves.
// Half resolution: g carries the view depth so the blur and the upsample can
// refuse to average across an edge.
const MAIN_POST_AO = MAIN_POST_HEAD + '\n' + [
  'uniform sampler2D tDepth;',
  'uniform vec2 uCam;',
  'uniform vec2 uTexel;',
  'uniform vec2 uTan;',
  'uniform float uFocalPx;',
  'uniform float uR;',
  MAIN_POST_DEPTH_FN,
  'float aoZ(vec2 uv) { return mainViewZ(texture(tDepth, uv).x, uCam.x, uCam.y); }',
  'vec3 aoPos(vec2 uv, float z) { return vec3((uv * 2.0 - 1.0) * uTan * z, -z); }',
  'void main() {',
  '  float z = aoZ(vUv);',
  '  if (z > uCam.y * 0.98) { fragColor = vec4(0.0, z, 0.0, 1.0); return; }',
  '  vec3 P = aoPos(vUv, z);',
  '  vec2 dx = vec2(uTexel.x * 2.0, 0.0), dy = vec2(0.0, uTexel.y * 2.0);',
  '  float zr = aoZ(vUv + dx), zl = aoZ(vUv - dx), zu = aoZ(vUv + dy), zd = aoZ(vUv - dy);',
  '  vec3 ex = abs(zr - z) < abs(zl - z) ? aoPos(vUv + dx, zr) - P : P - aoPos(vUv - dx, zl);',
  '  vec3 ey = abs(zu - z) < abs(zd - z) ? aoPos(vUv + dy, zu) - P : P - aoPos(vUv - dy, zd);',
  '  vec3 N = normalize(cross(ex, ey));',
  '  float R2 = uR * uR;',
  '  float rpx = clamp(uFocalPx * uR / z, 3.0, 140.0);',
  '  float ang = 6.2831853 * fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));',
  '  float occ = 0.0;',
  '  for (int i = 0; i < 12; i++) {',
  '    float t = (float(i) + 0.5) / 12.0;',
  '    float a = ang + float(i) * 2.39996323;',
  '    vec2 uv = vUv + vec2(cos(a), sin(a)) * (rpx * t) * uTexel;',
  '    vec3 v = aoPos(uv, aoZ(uv)) - P;',
  '    float vv = dot(v, v);',
  '    float c = dot(v, N) * inversesqrt(vv + 1e-4);',
  '    occ += max(0.0, c - 0.22) * (1.0 - smoothstep(0.4 * R2, R2, vv));',
  '  }',
  // /12 taps, x2.6: the foot of a wall sees half its ring at ~45 degrees,
  // which is ~0.4 before the gain and a slot at 1.0 after it.
  '  occ *= (2.6 / 12.0) * (1.0 - smoothstep(55.0, 130.0, z));',
  '  fragColor = vec4(min(occ, 1.0), z, 0.0, 1.0);',
  '}',
].join('\n');

// The bilateral half of it: seven taps along one axis, each weighted out as
// its depth leaves this pixel's by more than 4 % (plus 5 cm, so the capybara's
// flank a metre from the lens is not one surface per texel).
const MAIN_POST_AOBLUR = MAIN_POST_HEAD + '\n' + [
  'uniform sampler2D tAO;',
  'uniform vec2 uStep;',
  'void main() {',
  '  vec2 c = texture(tAO, vUv).rg;',
  '  float s = c.x, w = 1.0, tol = 0.04 * c.y + 0.05;',
  '  for (int i = 1; i <= 3; i++) {',
  '    vec2 a = texture(tAO, vUv + uStep * float(i)).rg;',
  '    vec2 b = texture(tAO, vUv - uStep * float(i)).rg;',
  '    float wa = max(0.0, 1.0 - abs(a.y - c.y) / tol);',
  '    float wb = max(0.0, 1.0 - abs(b.y - c.y) / tol);',
  '    s += a.x * wa + b.x * wb; w += wa + wb;',
  '  }',
  '  fragColor = vec4(s / w, c.y, 0.0, 1.0);',
  '}',
].join('\n');

const MAIN_POST_COMP = MAIN_POST_HEAD + '\n' + [
  'uniform sampler2D tDiffuse;',
  'uniform sampler2D tBloom;',
  'uniform sampler2D tWide;',
  'uniform float uBloom;',
  'uniform float uWide;',
  'uniform float uShoulder;',
  'uniform float uExposure;',
  'uniform float uContrast;',
  'uniform float uSaturation;',
  'uniform float uVignette;',
  'uniform float uVigStart;',
  'uniform float uVigTone;',
  'uniform vec3  uTint;',
  'uniform vec3  uLift;',
  'uniform vec3  uSplitS;',
  'uniform vec3  uSplitH;',
  // ---- the v45 depth terms. uDepthOn is 0 in a chapter that asks for none of
  // them, and the whole block below is then not merely zero but UNREACHED —
  // the depth texture is never sampled, so a chapter that opts into nothing
  // pays nothing and an A/B against it is honest.
  'uniform sampler2D tDepth;',
  'uniform sampler2D tDof;',
  'uniform float uDepthOn;',
  'uniform vec2  uCam;',
  'uniform vec2  uPx;',
  'uniform float uFocalPx;',
  'uniform float uDofK;',
  'uniform vec4  uDof;',
  'uniform float uAirK;',
  // THE FRAME HAS A DARK (L3, E1). See the block over the air term.
  'uniform float uAirGnd;',
  'uniform float uFarDark;',
  'uniform vec3  uFarDist;',
  'uniform float uAirMax;',
  'uniform vec3  uAirCol;',
  'uniform vec3  uNearClear;',
  'uniform float uCreaseK;',
  'uniform vec3  uCreaseW;',
  'uniform vec2  uCrease;',
  // THE OCCLUSION (AAA pass). The half-res result, its texel, how deep and
  // what colour: a slot is darker AND bluer, which is what shade is here.
  'uniform sampler2D tAO;',
  'uniform vec2  uAoPx;',
  'uniform float uAoK;',
  'uniform vec3  uAoCol;',
  // ---- AIRLIGHT (v48). See the block over mainAirLight below.
  'uniform float uAirLitK;',
  'uniform float uAirLitFar;',
  'uniform vec3  uCamPos;',
  'uniform vec3  uRayBL;',
  'uniform vec3  uRayDX;',
  'uniform vec3  uRayDY;',
  'uniform vec4  uSpillP[' + MAIN_SPILL_N + '];',
  'uniform vec3  uSpillC[' + MAIN_SPILL_N + '];',
  'uniform float uSpillOn;',
  'uniform float uSpillN;',
  // THE WATER'S TINT (L7, E3): rgb the sysSUB row's colour, a the lens's own
  // "how far under" scalar. One uniform, one line, see below.
  'uniform vec4  uSub;',
  // THE RAYS (ROADMAP-WOW A4): the radial-blurred bloom, see MAIN_POST_RAYS.
  'uniform sampler2D tRays;',
  'uniform float uRaysK;',
  // ---- UNDER THE SURFACE (ROADMAP-WOW2 V4) --------------------------------
  // uSubCeilK is uSub.a with V4's own cut (noSub2, the governor) already
  // applied in JS — the base tint above is L7/E3's and is not gated by this
  // flag, so the ceiling term needs its own strength rather than reading
  // uSub.a directly. uSubT is a free-running clock (post.render's own,
  // performance.now()) for the ripple only — nothing that reads it is a
  // logical trigger, so wall-clock drift here costs nothing. uBeadT is
  // weather.js's own 1.5 s surfacing envelope (see subBeadT in weather.js),
  // read in already-cut, already-eased form.
  'uniform float uSubCeilK;',
  'uniform float uSubT;',
  'uniform float uBeadT;',
  // ROADMAP-WOW3 Part D item 1: the real reflection target (shared.js's
  // reflectTex(), the same texture every water's uReflT samples), when the
  // JS side has one to hand this frame; uReflCeilOn says whether it does.
  'uniform sampler2D tReflC;',
  'uniform float uReflCeilOn;',
  'const vec3 MAIN_LUMA = vec3(0.2126, 0.7152, 0.0722);',
  // Six beads, hand-scattered rather than gridded (a grid reads as a UI
  // overlay, not glass) in frame-height units the same way MAIN_POST_RAYS'
  // uLight is: x already carries the aspect multiply at the call site.
  'const vec2 MAIN_BEAD_P[6] = vec2[6](',
  '  vec2(0.16, 0.70), vec2(0.30, 0.86), vec2(0.50, 0.62),',
  '  vec2(0.66, 0.82), vec2(0.80, 0.68), vec2(0.58, 0.92));',
  'const float MAIN_BEAD_R[6] = float[6](0.070, 0.052, 0.082, 0.058, 0.062, 0.048);',
  MAIN_POST_DEPTH_FN,
  // FOUR OPPOSED PAIRS. Index 2i and 2i+1 are the same axis in opposite
  // directions, and that pairing is the entire algorithm — see below. Two
  // scales, so a corner is sampled coarse and fine without a per-pixel
  // rotation, which is the usual trick and which this game cannot afford:
  // there is no denoiser anywhere in the chain and a rotated ring is noise.
  'const vec2 MAIN_CR[8] = vec2[8](',
  '  vec2( 1.0,   0.0  ), vec2(-1.0,  -0.0  ),',
  '  vec2( 0.0,   1.0  ), vec2(-0.0,  -1.0  ),',
  '  vec2( 0.389, 0.389), vec2(-0.389,-0.389),',
  '  vec2( 0.389,-0.389), vec2(-0.389, 0.389));',
  // THE TWO THINGS THIS HAS TO TELL APART FROM A CREASE, AND HOW.
  //
  // 1. A FLAT PLANE SEEN AT A GRAZING ANGLE. This is the one that matters,
  //    because the biggest grazing plane in every frame of this game is the
  //    GROUND, and it is half the picture. A single tap on a steeply inclined
  //    surface finds a neighbour tens of centimetres nearer and calls it a
  //    corner, so the naive version of this function darkens every lawn,
  //    every pavement and every dune — measured, it took Sydney's grass down
  //    2.8 of 255 across the whole lower third, and a shading term that
  //    darkens a flat plane is not an occlusion term, it is a filter.
  //
  //    THE OPPOSED PAIR IS THE DISCRIMINATOR. On any flat surface, whatever
  //    its inclination, one side of a pair is nearer by exactly as much as
  //    the other is further — so one of the two weights is zero, and their
  //    MINIMUM is zero. In a real concave corner BOTH sides come toward the
  //    lens and both weights are positive. min() of the pair is therefore
  //    free (the taps were already being read) and exact for the case that
  //    was doing the damage.
  //
  // 2. A SILHOUETTE. A neighbour four hundred metres in front of this pixel
  //    is the edge of a building against the sky, and darkening that draws a
  //    black outline round every roofline in the game — which is the one
  //    thing the aesthetic law names. So each weight ramps IN over uCrease.y
  //    and back OUT again over six times it.
  //
  // The radius is WORLD-CONSTANT and not screen-constant: uFocalPx metres-to-
  // pixels at one metre, divided by the distance. A fixed pixel radius gives a
  // near wall a hairline and a far one a black band, which reads as the effect
  // being distance-dependent — which it is not.
  'float mainCrW(float d0, vec2 uv, vec2 o) {',
  '  float dn = mainViewZ(texture(tDepth, uv + o).x, uCam.x, uCam.y);',
  '  float df = d0 - dn;',
  '  return smoothstep(0.0, uCrease.y, df) *',
  '         (1.0 - smoothstep(uCrease.y, uCrease.y * 6.0, df));',
  '}',
  // ---- AIRLIGHT: A LAMP IN MIST -------------------------------------------
  //
  // The spill (v-presence) lights SURFACES — it lives in the rim's injection
  // and reaches the ground, the stalls and the animal. What it has never been
  // able to reach is the air BETWEEN the lens and those surfaces, because
  // there is no fragment out there: on a wet night in Mong Kok the neon paints
  // the road and the shopfronts and then simply stops, and the fifteen metres
  // of humid air it is actually shining through is drawn as nothing at all.
  //
  // The composite is the only place this can happen, because it is the only
  // place with a depth buffer — and therefore the only place that knows how
  // far the air in front of each pixel goes before something solid stops it.
  //
  // IT IS THE REAL INTEGRAL, AND THE FIRST VERSION WAS NOT.
  //
  // The cheap version asked only "how close does this ray pass to the lamp",
  // shaped with the same reach ramp the spill uses on surfaces. Measured, that
  // touched **99.8% of the Mong Kok frame with a mean of +64 of 255** — a wash
  // over the whole picture rather than a glow around anything. The reason is
  // that it had NO DEPENDENCE ON HOW FAR AWAY THE LAMP WAS: the camera stands
  // ten metres from a cluster whose reach is twenty, so essentially every ray
  // in the frame passes inside that radius and every one of them scored the
  // same. The spill gets away with a reach ramp because it measures from a
  // SURFACE POINT, which is bounded; a view ray is not.
  //
  // So this is the scattering integral, which is the thing that actually has
  // the right shape:
  //
  //     ∫₀^tMax dt / (dmin² + (t-b)²)  =  (1/dmin)·[atan((tMax-b)/dmin) − atan(−b/dmin)]
  //
  // where b is the lamp's projection onto the ray and dmin its perpendicular
  // distance from it. Two atan per light, and it gives all three behaviours the
  // cheap form was missing for free: it falls with perpendicular distance, it
  // falls with the lamp's distance from the lens (the angular span closes), and
  // it accounts for how much of the segment actually lies near the lamp — so a
  // ray that stops at a wall in front of a lamp collects almost nothing.
  //
  // Only the four chapters with a strength pay for it, and only when their
  // pool is non-empty: uSpillOn is a coherent branch and uSpillN is a bound.
  //
  // STILL BOUNDED BY REACH, because an inverse square never quite reaches zero
  // and a sign cluster on the next street should not tint this one.
  //
  // Clamped to uAirLitFar, because a pixel of SKY carries the far plane as its
  // depth and the segment would otherwise be two kilometres of air.
  //
  // ADDITIVE, AND NOT MULTIPLIED BY THE ALBEDO — the exact opposite of the rule
  // one function over in the spill, and for the opposite reason. The spill is
  // light landing ON something and takes that thing's colour; this is light
  // scattered by the air on its way to the lens, and there is no surface
  // involved to take the colour of.
  'vec3 mainAirLight(float d, vec2 uv) {',
  '  vec3 rd = uRayBL + uRayDX * uv.x + uRayDY * uv.y;',
  '  float rlen = length(rd);',
  '  vec3 dir = rd / rlen;',
  // d is measured along the VIEW AXIS; the ray is longer than that everywhere
  // except the centre of the frame, and rlen is exactly that ratio.
  '  float tMax = min(d * rlen, uAirLitFar);',
  '  vec3 acc = vec3(0.0);',
  '  for (int i = 0; i < ' + MAIN_SPILL_N + '; i++) {',
  '    if (float(i) >= uSpillN) break;',
  '    vec3 L = uSpillP[i].xyz - uCamPos;',
  '    float b = dot(L, dir);',
  '    float dmin = sqrt(max(dot(L, L) - b * b, 0.04));',
  '    float I = (atan((tMax - b) / dmin) - atan(-b / dmin)) / dmin;',
  '    float reach = uSpillP[i].w;',
  '    I *= 1.0 - smoothstep(reach * 0.5, reach * 1.5, dmin);',
  '    acc += uSpillC[i] * I;',
  '  }',
  '  return acc;',
  '}',
  'float mainCrWide(float d0, vec2 uv, vec2 o) {',
  '  float dn = mainViewZ(texture(tDepth, uv + o).x, uCam.x, uCam.y);',
  '  float df = d0 - dn;',
  '  return smoothstep(0.0, uCreaseW.y, df) *',
  '         (1.0 - smoothstep(uCreaseW.y, uCreaseW.y * 4.0, df));',
  '}',
  'float mainCreaseWide(float d0, vec2 uv) {',
  '  float rpx = clamp(uFocalPx * uCreaseW.x / max(d0, 0.05), 4.0, 112.0);',
  '  vec2 r = rpx * uPx;',
  '  float occ = 0.0;',
  '  for (int i = 0; i < 8; i += 2) {',
  '    occ += min(mainCrWide(d0, uv, MAIN_CR[i]     * r),',
  '               mainCrWide(d0, uv, MAIN_CR[i + 1] * r));',
  '  }',
  '  return occ * 0.25;',
  '}',
  'float mainCrease(float d0, vec2 uv) {',
  '  float rpx = clamp(uFocalPx * uCrease.x / max(d0, 0.05), 1.5, 24.0);',
  '  vec2 r = rpx * uPx;',
  '  float occ = 0.0;',
  '  for (int i = 0; i < 8; i += 2) {',
  '    occ += min(mainCrW(d0, uv, MAIN_CR[i]     * r),',
  '               mainCrW(d0, uv, MAIN_CR[i + 1] * r));',
  '  }',
  '  return occ * 0.25;',
  '}',
  // The four half-res texels round this pixel, bilinear by position and cut
  // by depth: a half-res occlusion bilinearly stretched is a dark rim a
  // texel wide round every silhouette, on the far side of it.
  'float mainAO(float d0) {',
  '  vec2 st = vUv / uAoPx - 0.5;',
  '  vec2 f = fract(st), b = (floor(st) + 0.5) * uAoPx;',
  '  vec2 t0 = texture(tAO, b).rg, t1 = texture(tAO, b + vec2(uAoPx.x, 0.0)).rg;',
  '  vec2 t2 = texture(tAO, b + vec2(0.0, uAoPx.y)).rg, t3 = texture(tAO, b + uAoPx).rg;',
  '  float tol = 0.04 * d0 + 0.05;',
  '  vec4 w = vec4((1.0 - f.x) * (1.0 - f.y), f.x * (1.0 - f.y), (1.0 - f.x) * f.y, f.x * f.y);',
  '  w *= max(vec4(0.0), 1.0 - abs(vec4(t0.y, t1.y, t2.y, t3.y) - d0) / tol) + 0.001;',
  '  return dot(w, vec4(t0.x, t1.x, t2.x, t3.x)) / (w.x + w.y + w.z + w.w);',
  '}',
  'vec3 mainSRGB(vec3 c) {',
  '  c = clamp(c, 0.0, 1.0);',
  '  return mix(c * 12.92, 1.055 * pow(c, vec3(0.4166666667)) - 0.055, step(vec3(0.0031308), c));',
  '}',
  'void main() {',
  '  vec3 lin = texture(tDiffuse, vUv).rgb;',
  // ---- THE THREE DEPTH TERMS, ALL BEFORE THE BLOOM -----------------------
  // Before, because all three of them are things that happen to the light on
  // its way to the lens and the bloom is what the lens does with what arrives.
  // A haze applied after the bloom washes the bloom; a defocus applied after
  // it sharpens a halo that is already a blur.
  '  if (uDepthOn > 0.5) {',
  '    float raw = texture(tDepth, vUv).x;',
  '    float d = mainViewZ(raw, uCam.x, uCam.y);',
  // 1. DEFOCUS. The mix uses the FULL-RES CoC at this pixel, not the quarter-
  //    res one from the premultiplied buffer, so an in-focus pixel stays
  //    exactly the pixel it was — no quarter-res lattice on a sharp subject.
  '    float coc = 0.0;',
  '    if (uDofK > 0.0005) {',
  '      coc = mainCoC(d, uDof);',
  '      vec4 b = texture(tDof, vUv);',
  '      lin = mix(lin, b.rgb / max(b.a, 0.001), coc * uDofK);',
  '    }',
  // 2. CREASE. Faded out by the defocus that has just been applied: a sharp
  //    dark seam inside a blurred background is the one way this term shows
  //    itself as a post effect rather than as shape.
  '    if (uCreaseK > 0.0005) {',
  '      float oc = mainCrease(d, vUv) * uCreaseK * (1.0 - coc * uDofK);',
  //    ...and the wide octave under it (L3-11): see MAIN_CREASE_WR
  '      oc += mainCreaseWide(d, vUv) * uCreaseK * uCreaseW.z * (1.0 - coc * uDofK);',
  '      lin *= 1.0 - oc;',
  '    }',
  // 2b. THE OCCLUSION, under the same defocus fade and before the air, so a
  //     slot forty metres off is hazed like everything else that far off.
  '    if (uAoK > 0.0005) {',
  '      float ao = mainAO(d) * uAoK * (1.0 - coc * uDofK);',
  '      lin *= mix(vec3(1.0), uAoCol, ao);',
  '    }',
  // 3. THE AIR. Exponential and starting at ZERO, which is the half that
  //    scene.fog — linear, and not beginning until 78-90 m — has never been
  //    able to say. Capped, because past a point the fog is the better
  //    instrument and two of them fighting is a band on the horizon.
  //
  //    AND THE SKY IS EXEMPT, off the RAW depth rather than a distance.
  //    Every sky dome in this game is `fog: false` on purpose — a dome IS the
  //    haze, and hazing it toward the haze flattens the zenith-to-horizon ramp
  //    it exists to draw. The first version of this gate rolled off at 0.9 of
  //    the far plane and did not work: Sydney's dome is a 300 m sphere inside
  //    a 400 m frustum, so it sat at 0.75 and took the full airMax, which is
  //    the entire reason that chapter came back milky. An untouched depth
  //    buffer is exactly 1.0 and no piece of world ever is, so testing the raw
  //    value is both exact and free — and it costs nothing on the domes that
  //    do write depth, because they are handled a line below.
  // ---- THE FRAME HAS A DARK (L3, E1) ---------------------------------
  //    Forty-one settled frames and every bright one converged on a single
  //    pale value: the fog, the air and the sky all go to the SAME colour, so
  //    the picture has no edge where the world stops. Real aerial perspective
  //    on the GROUND goes to the sky's horizon hue — darker and bluer than
  //    the sky just above it — because a grazing surface takes less sun and
  //    more sky. Two terms, both on the view ray's elevation, so a minaret or
  //    a volcano keeps its haze and its colour and only the ground plane
  //    recedes:
  //      uAirGnd   how much darker the air colour is on a ray below the
  //                horizon (the far ground goes to 0.8 of the fog, not 1.0)
  //      uFarDark  a value drop over uFarDist.x .. uFarDist.y metres on
  //                ground rays — the horizon getting DARKER, not paler
  //    A ray at or above the horizon gets neither. The ray is the same one
  //    the airlight reconstructs; it is computed whenever air is on now.
  '    vec3 hrd = uRayBL + uRayDX * vUv.x + uRayDY * vUv.y;',
  '    float hy = hrd.y / max(length(hrd), 0.0001);',
  '    float gnd = 1.0 - smoothstep(-0.02, 0.10, hy);',
  //    ...AND THE SKY TAKES ALMOST NONE OF IT. The raw-depth exemption below
  //    only covers a dome that writes no depth; Palawan's does, and measured
  //    (qa/l3-far-a/off.png) the whole sky went from blue to grey under a
  //    0.17 ceiling. A ray above the horizon keeps 15% of the term — enough
  //    for a volcano to sit in its air — and the ground plane takes it all.
  '    if (uAirK > 0.000001 && raw < 0.999999) {',
  '      float a = min(1.0 - exp(-d * uAirK), uAirMax) * (0.15 + 0.85 * gnd);',
  // THE NEAR AIR CLEARS (AAA pass): see MAIN_NEAR_CLEAR.
  '      a *= mix(1.0, smoothstep(uNearClear.x, uNearClear.y, d), uNearClear.z);',
  '      lin = mix(lin, uAirCol * (1.0 - uAirGnd * gnd), a);',
  '    }',
  '    if (uFarDark > 0.0001 && raw < 0.999999) {',
  '      float fd = smoothstep(uFarDist.x, uFarDist.y, d) * gnd;',
  '      lin *= 1.0 - uFarDark * fd;',
  '    }',
  // 4. AND THE LIGHT IN IT. Last, because it is the only one of the four that
  //    ADDS rather than modifying what is there: haze goes over the picture
  //    and a glow in the air goes over the haze.
  '    if (uAirLitK > 0.0 && uSpillOn > 0.5) {',
  '      lin += mainAirLight(d, vUv) * uAirLitK;',
  '    }',
  '  }',
  // ---- UNDER THE WATER (L7, E3) ------------------------------------------
  // Before the bloom, because it is light on its way to the lens and not the
  // lens's doing. The frame goes to the water's colour multiplicatively —
  // a beige quay under green water is green-beige, not beige — with a
  // little of the colour ADDED, brighter toward the top of the frame, which
  // is the surface's light coming down through it. The fog has already done
  // this to the far field; this is the near field and the sky dome (which
  // is fog:false) agreeing with it.
  '  if (uSub.a > 0.001) {',
  '    vec3 wc = lin * (0.25 + 0.75 * uSub.rgb * 1.6) + uSub.rgb * (0.03 + 0.05 * vUv.y);',
  '    lin = mix(lin, wc, uSub.a * 0.85);',
  '  }',
  // ---- THE CEILING (ROADMAP-WOW2 V4.1, real texture: ROADMAP-WOW3 D1) ----
  // "The ceiling of light every dive shot has." A1's own reflection target
  // (reflectRender/reflectTex, shared.js) is the exact picture here — the
  // sky and the bank, mirrored back down — now sampled directly when the JS
  // side hands this pass a texture (uReflCeilOn > 0.5): the SAME uReflT
  // every water shader reads, in the same screen-space UV the water shader
  // computes off gl_FragCoord (shared.js:7281), just built from vUv here
  // since this pass already has it normalised. reflectRender itself refuses
  // to render while the eye is BELOW the water plane (shared.js's
  // `_reflSt.under` gate) — exactly the case a dive puts the eye in — so
  // what this samples is the LAST picture the target held from the moment
  // before the eye went under (the target is never cleared, only
  // overwritten on the next live render), not a live one; still the real
  // mirrored scene rather than a formula, and it re-syncs to live the next
  // time the eye surfaces. When nothing has ever been rendered into it
  // (`.value` null — no water in the chapter, or reflect k 0), this falls
  // back to the original rippled-brightening formula rather than sampling a
  // null texture. Before the bloom, like the tint above it — it is light on
  // the way to the lens.
  '  if (uSubCeilK > 0.001) {',
  '    float ceilY = smoothstep(0.05, 0.95, vUv.y);',
  '    float ripple;',
  '    if (uReflCeilOn > 0.5) {',
  '      vec2 rUv = vec2(1.0 - vUv.x, vUv.y);',
  '      vec3 rC = texture(tReflC, rUv).rgb;',
  '      ripple = clamp(dot(rC, MAIN_LUMA) * 1.4, 0.0, 1.0);',
  '    } else {',
  '      float r1 = sin(vUv.x * 26.0 + uSubT * 1.6) * 0.5 + 0.5;',
  '      float r2 = sin(vUv.y * 19.0 - uSubT * 2.1 + vUv.x * 9.0) * 0.5 + 0.5;',
  '      ripple = r1 * 0.6 + r2 * 0.4;',
  '    }',
  '    lin += uSub.rgb * ceilY * (0.35 + 0.65 * ripple) * uSubCeilK * 0.6;',
  '  }',
  '  lin += texture(tBloom, vUv).rgb * uBloom;',
  // THE SECOND OCTAVE. See the header: the tight one is the glow ON a light,
  // this is the air AROUND it, and a lamp without it is a white sticker.
  '  lin += texture(tWide, vUv).rgb * uWide;',
  // THE RAYS (ROADMAP-WOW A4). Additive like the two octaves and after them:
  // light that has travelled through the air from the one source the row
  // names. uRaysK is zero — and tRays the 1x1 black — in every chapter with
  // no row, when the source is off the frame, and from rung 1 up.
  '  lin += texture(tRays, vUv).rgb * uRaysK;',
  // ---- EXPOSURE (v47) ----------------------------------------------------
  // AFTER the bloom and BEFORE the shoulder, which is the only place it can
  // go without invalidating work. After the bloom, because exposure is the
  // last thing that happens before a sensor and it must scale the glow with
  // the thing glowing. Before the shoulder, because the whole point is to
  // give the roll-off something to roll off.
  //
  // And NOT before the bright pass: `threshold` is a per-chapter number in
  // nineteen hand-tuned grade rows, expressed in the units the scene target
  // is written in. Scaling the scene before the bright pass reads it would
  // re-base every one of them at once.
  //
  // 1.0 is an exact no-op and is what eighteen chapters use.
  '  lin *= uExposure;',
  // THE SHOULDER. Everything above the knee used to meet a hard clamp, so a
  // sunlit white wall, a lamp bulb and a sheet of foam all arrived at exactly
  // 1.0 with a visible edge where they got there. This rolls the top off
  // instead: an exponential that is continuous at the knee and asymptotic to
  // white, so 1.2 lands at 0.99 and 3.0 lands at 0.9999 and there is a
  // gradient between them. At uShoulder = 1.0 it is arithmetically the old
  // clamp, which is what the A/B switch sets it to.
  '  vec3 sh = max(lin - uShoulder, 0.0);',
  '  float sk = max(1.0 - uShoulder, 0.001);',
  '  lin = min(lin, vec3(uShoulder)) + sk * (1.0 - exp(-sh / sk));',
  '  vec3 c = mainSRGB(lin);',
  // Contrast as a blend toward a smoothstep of itself: an S-curve that is exact
  // at 0 and at 1 and therefore cannot clip either end, unlike (c-0.5)*k+0.5.
  '  c = mix(c, c * c * (3.0 - 2.0 * c), uContrast);',
  '  float l = dot(c, MAIN_LUMA);',
  '  c = mix(vec3(l), c, uSaturation);',
  // SPLIT TONE. uTint is one multiply over the whole frame and therefore
  // cannot say the thing half the rows in sysGRADES are written about — that
  // the sun is warm and the sky filling the shadows is not.
  //
  // TWO RAMPS WITH A GAP BETWEEN THEM, not one mix from shadow tint to
  // highlight tint. A single mix has no neutral: every pixel gets one tint or
  // the other in proportion, so Sydney's lawn — which is 0.55 luma and two
  // thirds of the frame — took nearly the whole warm push and the chapter went
  // olive. The shadow ramp is spent by 0.45 and the highlight ramp does not
  // start until 0.55, so the middle of the picture is left exactly alone and
  // only the ends move, which is what a split tone is.
  '  float wS = 1.0 - smoothstep(0.02, 0.45, l);',
  '  float wH = smoothstep(0.55, 0.98, l);',
  '  c *= 1.0 + (uSplitS - 1.0) * wS + (uSplitH - 1.0) * wH;',
  '  c = clamp(c * uTint + uLift, 0.0, 1.0);',
  '  float d = length(vUv - 0.5) * 1.41421356;',
  '  float vg = uVignette * smoothstep(uVigStart, 1.0, d);',
  // ...and the corner of a real lens does not only go DARK. It loses colour
  // and goes cool, which is the half of a vignette that makes the middle of
  // the frame look lit rather than the edge look painted.
  '  c = mix(c, vec3(dot(c, MAIN_LUMA)) * vec3(0.94, 0.975, 1.07), vg * uVigTone);',
  '  c = clamp(c * (1.0 - vg), 0.0, 1.0);',
  // ---- SURFACING: SIX BEADS OF WATER ON THE LENS (ROADMAP-WOW2 V4.4) -----
  // No lensDrops machinery exists (`grep -n lensDrops src/*.js` is empty) —
  // six fixed screen-space blobs, built fresh, right here. After grading and
  // the vignette and before the dither, because a bead sits on the GLASS and
  // is the one thing in this shader that must not be tinted by the chapter
  // underneath it. uBeadT is weather.js's own cut 1.5 s envelope (subBeadT).
  '  if (uBeadT > 0.001) {',
  '    float asp = uPx.y / uPx.x;',
  '    vec2 pf = vec2(vUv.x * asp, vUv.y);',
  '    float dk = 0.0, br = 0.0;',
  '    for (int bi = 0; bi < 6; bi++) {',
  '      vec2 bp = MAIN_BEAD_P[bi] * vec2(asp, 1.0);',
  '      float r = MAIN_BEAD_R[bi];',
  '      float d = length(pf - bp);',
  '      dk += (1.0 - smoothstep(r * 0.55, r, d)) * 0.16;',
  '      float rr = (d - r * 0.82) / (r * 0.22);',
  '      br += exp(-rr * rr) * 0.55;',
  '    }',
  '    c = clamp(c * (1.0 - dk * uBeadT) + vec3(br * uBeadT), 0.0, 1.0);',
  '  }',
  // One hash, a 255th of a step: invisible on its own, and the difference
  // between a smooth dome and eight visible bands of sky.
  '  float dth = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);',
  '  c += (dth - 0.5) * 0.0039215686;',
  '  fragColor = vec4(c, 1.0);',
  '}',
].join('\n');

// The two axes the split tone runs on. They are unit-ish pushes rather than
// colours so a grade row is TWO NUMBERS — how warm the light is and how cool
// the shade is — instead of six, and a row that wants the reverse (a sodium
// street under a black sky) writes a negative one.
const MAIN_SPLIT_WARM = [ 1.00,  0.30, -1.00];
const MAIN_SPLIT_COOL = [-0.55, -0.10,  1.00];

// The height every grade row in sysGRADES was tuned at. The blur offsets are
// referenced to it so a chapter looks the way it was authored on a monitor
// that is not this one — see the note in post.render.
const MAIN_POST_REF_H = 720;

// HOW BIG A CREASE IS, AND WHAT COUNTS AS ONE. Both are properties of the lens
// rather than of the place, for the same reason sysSHOULDER is: every chapter
// in this game wants a corner to be a corner. Only the STRENGTH is per-chapter.
//
// 0.14 m is the radius the ring samples at, in WORLD units — about the width of
// the gap where a crate meets a crate, and about a tenth of the capybara. The
// range is what separates a corner from a silhouette: a neighbour up to 0.30 m
// in front of this pixel is geometry folding, past about 1.8 m it is a different
// object entirely and gets no weight at all.
const MAIN_CREASE_R = 0.14;
const MAIN_CREASE_RANGE = 0.30;
// ---- THE WIDE OCTAVE (L3-11). LIFT2 called it the largest beauty term still
// on the shelf and named the trap: at this fov uFocalPx is ~808, so a 1.6 m
// ring clamped at 24 px is a screen-space radius for everything nearer than
// 54 m — the whole playable frame. So the wide octave has its own radius
// (1.6 m: the foot of a wall against the ground, the inside of an arcade,
// the underside of a jetty), its own ceiling (112 px) and its own range
// (a neighbour up to 2.4 m nearer is the same object folding at this
// scale). Half the tight octave's weight, and the same DoF fade.
const MAIN_CREASE_WR = 1.6;
const MAIN_CREASE_WRANGE = 2.4;
const MAIN_CREASE_WK = 0.55;
// THE OCCLUSION (AAA pass): the ring is 2.0 m — a doorway, a bench's
// underside, the gap between two market stalls, a kerb under a shopfront —
// and a full slot takes a pixel 95 % of the way to the colour below. Tried
// first at 1.4 m / 0.8: correct and too shy to see at the resting boom. The colour is a blue-violet
// multiply rather than grey: open shade in every chapter is lit by sky, so an
// occluded pixel loses the warm sun share first. The cut is `noAO`; it parks
// at rung 1 like every term since WOW3, and costs nothing when it does.
const MAIN_AO_R = 2.0;
const MAIN_AO_K = 0.95;
const MAIN_AO_COL = [0.34, 0.36, 0.48];
// THE NEAR AIR CLEARS (AAA pass). The air term starts at zero metres by
// design, and in LINEAR light: three per cent of a pale colour added to a
// dark that is one per cent is a dark that doubles, and after the sRGB
// encode that is the milk over every foreground in the game. Measured with
// noAir, the darkest 2 % of the frame went 53 -> 36 (Sydney), 43 -> 32
// (Kyoto), 46 -> 22 (Sahara). This fades the air IN over view depth — clear
// to 6 m, whole by 45 m — at 85 % strength, so the animal and the street it
// is standing in are crisp and the distance keeps every metre of its haze.
// The air rows are untouched; this is laid over them. Cut: noNearClear.
const MAIN_NEAR_CLEAR = [6.0, 45.0, 0.85];

// How wide the defocus blur is, in quarter-res texels at MAIN_POST_REF_H. It
// is a lens constant and not a grade row because HOW BLURRED the out-of-focus
// part of a photograph is, is a property of the aperture; WHERE the focus
// falls is the thing a chapter has an opinion about, and that is what
// params.dofFar0/1 carry. 1.6 lands a forty-metre background at about three
// pixels of circle at 720 — a softness rather than an effect.
const MAIN_DOF_RADIUS = 1.6;
const mainPostSize = new THREE.Vector2();
// Rate limit on the composite pass's own failure log — see game.tick's finally.
let mainPostLoudAt = 0;
// Substeps the solver took since the top of the last game.tick. See the
// postStep listener in mainBoot and the perf snapshot at the top of tick.
let mainSubsteps = 0;
// ---- THE GOVERNOR SHEDS PHYSICS TOO (L6, E8 / qa F3) -----------------------
// The rungs in systems.js touched dpr, the shadow map and the DoF: pixels,
// never the simulation. And the simulation is the one cost that GROWS as the
// frame slows — `world.step(STEP, dt, 5)` takes as many 1/60 substeps as the
// frame has room for, so a machine that has dipped to 20 fps pays THREE
// substeps a frame and one at 12 fps pays five: measured contended, Quay at
// 4 fps with world.step at 33 ms = 5 × 6.6 (qa/l6r-qa-cpu-contended). That is
// the spiral the governor exists to stop, paid by the rung-3 machine only.
// From rung 2 the world takes at most two substeps a frame and the frame is
// clamped at 1/20 s before the accumulator sees it (the tab-switch guard is
// 0.1 s — five substeps — and stays at 0.1 on the lower rungs). Time runs
// slow under that clamp rather than the solver running hot; cannon drops the
// remainder (`accumulator % dt`), so nothing piles up to be paid later.
const MAIN_SHED_RUNG = 2;
const MAIN_SHED_SUBSTEPS = 2;
const MAIN_SHED_DT = 1 / 20;
// ...and the shadow pass at HALF RATE from the same rung. The sun does not
// move in a frame; the box follows the animal in texel steps. The map is
// re-rendered every other frame, and on any frame that asks for it by name:
// `game.state.shadowDirty` is set by a chapter cross, by the shadow box
// refitting (shadowFitBiome / shadowFitAlt in systems.js) and by the rung
// changing the map size — three's map is null after the resize until the
// pass runs, and a frame that skipped the pass would light everything.
let mainShadowOdd = false;
// ---- THE PICTURE WAITS FOR ITS SHADERS (L6, E8 / qa F1) --------------------
// `game.state.renderHold` is set by biomeGo while the new chapter's programs
// are still compiling in the driver (see biomeWarm in systems.js): a draw
// that touched one of them would block the main thread until the compile
// finished — 1.5 to 5.7 s on the Arc, one frozen frame, the whole of what the
// crossing used to feel like. While held, the world is stepped and every
// module runs; only post.render is skipped. `game.state.frames` counts the
// frames actually DRAWN, so the crossing can wait for one before it lifts
// the white. The cap is the belt under systems.js's own braces: a hold that
// has lasted this long is a promise that never came back, and a stale frame
// for ever is worse than the stall it was avoiding.
const MAIN_HOLD_MAX_MS = 9000;
let mainHoldAt = 0;
// Scratch for the airlight ray basis. Nothing in post.render allocates.
const mainAirR = new THREE.Vector3();
const mainAirU = new THREE.Vector3();
const mainAirF = new THREE.Vector3();
// ...and reused by the underwater rays (ROADMAP-WOW2 V4.2): the same three
// vectors, recomputed when it needs them, since nothing downstream still
// wants the airlight's own values by the time it runs. See MAIN_SUB_RAYS_K.
const mainWorldUp = new THREE.Vector3(0, 1, 0);
// How strong the underwater shafts are, independent of whatever the surface
// A4 rays row asks for (kyoto/cali/rio/iceland/venice/palawan/manly/
// pantanal/cave/antarctic/monaco/hanoi — every sysSUB chapter but the five
// with a sysRAYS row of their own — have NONE, so "half strength" cannot
// mean half of zero). Half the sysRAYS table's own mean k (0.30-0.50 across
// its five rows, mean 0.41), rounded.
const MAIN_SUB_RAYS_K = 0.20;
// A LOOSER threshold than the surface bright-pass: underwater has no single
// light source in most of these frames, only the water's own brightness
// gradient, and the standard grade thresholds (~0.6-1.2) would clear almost
// nothing down here.
const MAIN_SUB_RAYS_THR = 0.30;
const MAIN_SUB_RAYS_KNEE = 0.55;
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
      // The four added by the v40 lens pass, and their no-op values: no second
      // octave, no split, the shoulder at 1.0 (which IS the old hard clamp) and
      // a vignette that only darkens.
      wide: 0.0, splitW: 0.0, splitC: 0.0, shoulder: 1.0, vigTone: 0.0,
      // v47. 1.0 is an exact no-op; see the note in MAIN_POST_COMP.
      exposure: 1.0,
      // The three added by the v45 depth pass, and their no-op values. All
      // three at zero does not merely multiply out — it takes uDepthOn to 0
      // and the depth texture is not sampled at all.
      //   dof        how much of the defocused image is mixed in at full CoC
      //   dofNear/Far  metres. systems.js derives them from the distance to
      //                the subject, so the focus follows the animal onto a
      //                condor or a balloon without a table saying so.
      //   air        haze per metre, and airMax the ceiling it may reach
      //   crease     how deep a corner may go, 0 .. ~0.35
      dof: 0.0, dofNear0: -1, dofNear1: 0, dofFar0: 1e6, dofFar1: 2e6,
      air: 0.0, airMax: 0.0, airR: 1, airG: 1, airB: 1,
      airGnd: 0.0, farDark: 0.0, farDist0: 30, farDist1: 160,
      // v48. Light IN the air rather than on the things in it.
      airLight: 0.0,
      // (L7, E3) the water's tint over the whole frame when the lens is
      // under: the sysSUB row's colour and the lens's own scalar. 0 is off.
      sub: 0.0, subR: 0, subG: 0, subB: 0,
      // (ROADMAP-WOW A4) the rays: strength, the light's uv, the reach and the
      // seed radius in frame heights. systems.js's sysRAYS row writes them
      // every frame, already gated to zero when the source is off the frame.
      rays: 0.0, raysX: 0.5, raysY: 0.5, raysLen: 0.4, raysR: 0.12,
      crease: 0.0,
      creaseWide: 1,     // the wide octave's on/off; the governor's rung 3 writes 0
    },
    render() { renderer.setRenderTarget(null); renderer.render(game.scene, game.camera); },
    resize() {},
    set() {},
  };

  let sceneRT = null, bloomA = null, bloomB = null, wideA = null, wideB = null;
  let dofA = null, dofB = null, sceneDepth = null, aoA = null, aoB = null;
  let quadScene = null, quadCam = null, quad = null;
  let matBright = null, matBlur = null, matComp = null, matCoC = null, matRays = null;
  let matAO = null, matAOBlur = null;
  let vw = 0, vh = 0, bw = 0, bh = 0, ww = 0, wh = 0, aw = 0, ah = 0;

  try {
    if (!renderer.capabilities.isWebGL2) throw new Error('needs WebGL2');

    // THE DEPTH THIS TARGET HAS ALWAYS WRITTEN AND ALWAYS THROWN AWAY.
    // 24-bit unsigned integer: at a 0.5 m near plane the coarsest chapter in
    // the game (Goreme, far 2200) still resolves under a millimetre at forty
    // metres, which is two orders of magnitude finer than the smallest thing
    // any term below asks about. Probed on the real target before any of this
    // was written — see qa/depthprobe.js — because a multisampled depth
    // attachment has to be RESOLVED, and a driver that declines to do it would
    // have taken the whole pass down.
    sceneDepth = new THREE.DepthTexture(2, 2);
    sceneDepth.type = THREE.UnsignedIntType;
    sceneDepth.format = THREE.DepthFormat;
    sceneDepth.minFilter = THREE.NearestFilter;
    sceneDepth.magFilter = THREE.NearestFilter;

    sceneRT = new THREE.WebGLRenderTarget(2, 2, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true,
      stencilBuffer: false,
      depthTexture: sceneDepth,
      samples: 4,
    });
    const half = {
      type: THREE.HalfFloatType, format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      depthBuffer: false, stencilBuffer: false,
    };
    bloomA = new THREE.WebGLRenderTarget(2, 2, half);
    bloomB = new THREE.WebGLRenderTarget(2, 2, half);
    // The wide octave's own ping-pong, at an eighth. Two more pairs of the same
    // separable blur over a buffer a sixteenth the area of the quarter-res one:
    // four passes over twenty-two thousand pixels, which is a rounding error on
    // the frame and the difference between a bulb and a lamp.
    wideA = new THREE.WebGLRenderTarget(2, 2, half);
    wideB = new THREE.WebGLRenderTarget(2, 2, half);
    // The defocus ping-pong, at a quarter, carrying (rgb * coc, coc).
    dofA = new THREE.WebGLRenderTarget(2, 2, half);
    dofB = new THREE.WebGLRenderTarget(2, 2, half);
    // The occlusion's ping-pong, at a half, carrying (occlusion, view depth).
    // NEAREST: a filtered depth across a silhouette is a distance nothing is at.
    const aoOpts = Object.assign({}, half, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    aoA = new THREE.WebGLRenderTarget(2, 2, aoOpts);
    aoB = new THREE.WebGLRenderTarget(2, 2, aoOpts);

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
      tDiffuse: { value: null }, uTexel: { value: new THREE.Vector2() },
      uThreshold: { value: 1.0 }, uKnee: { value: 0.35 },
    });
    matBlur = raw(MAIN_POST_BLUR, {
      tDiffuse: { value: null }, uStep: { value: new THREE.Vector2() },
    });
    matRays = raw(MAIN_POST_RAYS, {
      tDiffuse: { value: null }, uLight: { value: new THREE.Vector2(0.5, 0.5) },
      uAspect: { value: 1 }, uStep: { value: 0.01 }, uDecay: { value: 0.92 }, uMaskR: { value: 0 },
    });
    matCoC = raw(MAIN_POST_COC, {
      tDiffuse: { value: null }, tDepth: { value: null },
      uTexel: { value: new THREE.Vector2() },
      uCam: { value: new THREE.Vector2(0.5, 400) },
      uDof: { value: new THREE.Vector4(-1, 0, 1e6, 2e6) },
    });
    matAO = raw(MAIN_POST_AO, {
      tDepth: { value: null }, uCam: { value: new THREE.Vector2(0.5, 400) },
      uTexel: { value: new THREE.Vector2() }, uTan: { value: new THREE.Vector2(1, 1) },
      uFocalPx: { value: 800 }, uR: { value: MAIN_AO_R },
    });
    matAOBlur = raw(MAIN_POST_AOBLUR, {
      tAO: { value: null }, uStep: { value: new THREE.Vector2() },
    });
    matComp = raw(MAIN_POST_COMP, {
      tDiffuse: { value: null }, tBloom: { value: mainPostBlack },
      tWide: { value: mainPostBlack },
      uBloom: { value: 0 }, uWide: { value: 0 }, uShoulder: { value: 1 },
      uExposure: { value: 1 },
      uContrast: { value: 0 }, uSaturation: { value: 1 },
      uVignette: { value: 0 }, uVigStart: { value: 0.62 }, uVigTone: { value: 0 },
      uTint: { value: new THREE.Vector3(1, 1, 1) },
      uLift: { value: new THREE.Vector3(0, 0, 0) },
      uSplitS: { value: new THREE.Vector3(1, 1, 1) },
      uSplitH: { value: new THREE.Vector3(1, 1, 1) },
      tDepth: { value: null }, tDof: { value: mainPostBlack },
      uDepthOn: { value: 0 },
      uCam: { value: new THREE.Vector2(0.5, 400) },
      uPx: { value: new THREE.Vector2() },
      uFocalPx: { value: 800 },
      uDofK: { value: 0 },
      uDof: { value: new THREE.Vector4(-1, 0, 1e6, 2e6) },
      uAirK: { value: 0 }, uAirMax: { value: 0 },
      uAirGnd: { value: 0 }, uFarDark: { value: 0 }, uFarDist: { value: new THREE.Vector3(30, 160, 0) },
      uAirCol: { value: new THREE.Vector3(1, 1, 1) },
      uNearClear: { value: new THREE.Vector3(MAIN_NEAR_CLEAR[0], MAIN_NEAR_CLEAR[1], 0) },
      uCreaseK: { value: 0 },
      tAO: { value: mainPostBlack }, uAoPx: { value: new THREE.Vector2(0.5, 0.5) },
      uAoK: { value: 0 }, uAoCol: { value: new THREE.Vector3().fromArray(MAIN_AO_COL) },
      uAirLitK: { value: 0 }, uAirLitFar: { value: MAIN_AIRLIT_FAR },
      uSub: { value: new THREE.Vector4(0, 0, 0, 0) },     // (L7, E3)
      tRays: { value: mainPostBlack }, uRaysK: { value: 0 },  // (ROADMAP-WOW A4)
      // (ROADMAP-WOW2 V4) the ceiling, its ripple clock, and the surfacing beads
      uSubCeilK: { value: 0 }, uSubT: { value: 0 }, uBeadT: { value: 0 },
      // (ROADMAP-WOW3 D1) the real reflection texture for the ceiling above
      tReflC: { value: mainPostBlack }, uReflCeilOn: { value: 0 },
      uCamPos: { value: new THREE.Vector3() },
      uRayBL: { value: new THREE.Vector3() },
      uRayDX: { value: new THREE.Vector3() },
      uRayDY: { value: new THREE.Vector3() },
      uCrease: { value: new THREE.Vector2(MAIN_CREASE_R, MAIN_CREASE_RANGE) },
      uCreaseW: { value: new THREE.Vector3(MAIN_CREASE_WR, MAIN_CREASE_WRANGE, MAIN_CREASE_WK) },
      // THE LIVE POOL, not a copy: systems.js goes on writing it exactly as
      // it did for the surfaces, and one ranking per frame feeds both.
      uSpillP: mainSpillU.p, uSpillC: mainSpillU.c,
      uSpillOn: mainSpillU.on, uSpillN: mainSpillU.n,
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
    // Auto scales the scene, not the browser's drawing buffer. Resizing the
    // latter synchronised 86ms of queued work on the reference GPU.
    const scale = game.state.sceneScale || 1;
    const w = Math.max(2, Math.floor(s.x * scale)), h = Math.max(2, Math.floor(s.y * scale));
    if (w === vw && h === vh) return;
    vw = w; vh = h;
    bw = Math.max(2, w >> 2); bh = Math.max(2, h >> 2);
    ww = Math.max(2, w >> 3); wh = Math.max(2, h >> 3);
    sceneRT.setSize(vw, vh);
    bloomA.setSize(bw, bh);
    bloomB.setSize(bw, bh);
    wideA.setSize(ww, wh);
    wideB.setSize(ww, wh);
    dofA.setSize(bw, bh);
    dofB.setSize(bw, bh);
    aw = Math.max(2, w >> 1); ah = Math.max(2, h >> 1);
    aoA.setSize(aw, ah);
    aoB.setSize(aw, ah);
    matComp.uniforms.uAoPx.value.set(1 / aw, 1 / ah);
    // The bright pass's taps are in FULL-resolution texels — it is reading
    // sceneRT, not the target it is writing. So are the CoC pass's.
    matBright.uniforms.uTexel.value.set(1 / vw, 1 / vh);
    matCoC.uniforms.uTexel.value.set(1 / vw, 1 / vh);
    matComp.uniforms.uPx.value.set(1 / vw, 1 / vh);
  };
  post.resize();

  const P = post.params;
  post.set = function (p) {
    for (const k in p) if (P[k] !== undefined) P[k] = p[k];
  };

  /**
   * THE TARGET THE SCENE IS DRAWN INTO, for the shader warm (L6, E8).
   * three keys a program on where it is going: rendering to the screen means
   * the renderer's output colour space and tone mapping, rendering into a
   * target means linear and none. `renderer.compile()` prepares programs for
   * the screen — so a warm run with no target bound linked one set of
   * programs (never used) and the first draw into sceneRT still compiled the
   * other: measured on the Cave, 21 programs at compile, then 32 more and
   * 6.4 s at the first draw. biomeWarm binds this before it compiles.
   */
  post.warmTarget = function () { return sceneRT; };

  // The world warm cannot see this private fullscreen triangle. Link even
  // dormant passes before the hold lifts, against their real destination.
  post.warmMaterials = function () {
    const previousTarget = renderer.getRenderTarget(), previousMaterial = quad.material;
    const materials = [matBright, matBlur, matRays, matCoC, matAO, matAOBlur, matComp];
    try {
      for (const material of materials) {
        quad.material = material;
        renderer.setRenderTarget(material === matComp ? null : bloomA);
        renderer.compile(quadScene, quadCam);
      }
    } finally {
      quad.material = previousMaterial;
      renderer.setRenderTarget(previousTarget);
    }
    return materials;
  };

  post.render = function () {
    post.resize();
    const p = P;

    renderer.setRenderTarget(sceneRT);
    renderer.clear();
    renderer.render(game.scene, game.camera);

    // ---- THE DEPTH TERMS ---------------------------------------------------
    // The camera's own planes, read here rather than pushed from systems.js:
    // `far` is per-chapter (400 in Sydney, 2200 over Goreme) and the helm and
    // the condor move it again, and a linearisation that is one frame behind
    // the projection it is inverting is a haze that jumps on a biome edge.
    const cam = game.camera;
    // airLight IS A DEPTH TERM AND WAS NOT ON THE LIST. It is read inside the
    // shader's `uDepthOn > 0.5` block and its uniforms are only refreshed in
    // the branch below, so a chapter that asked for airlight and nothing else
    // would get none of it — silently, with uAirLitK still holding the last
    // chapter's value. Masked today only because all four sysAIRLIT chapters
    // also carry a sysDEPTH row with air > 0; the day one does not, the term
    // simply does not exist and nothing says so.
    const wantDepth = !game.state.noDepth &&
                      (p.dof > 0.0005 || p.air > 0.000001 || p.crease > 0.0005 ||
                       p.airLight > 0.0005);
    const cu = matComp.uniforms;
    cu.uDepthOn.value = wantDepth ? 1 : 0;
    // the water's tint (L7, E3): outside the depth branch, because it is
    // not a depth term and a chapter with no depth row can still be dived in
    cu.uSub.value.set(p.subR || 0, p.subG || 0, p.subB || 0, p.sub || 0);
    // Bound unconditionally. uDepthOn already stops it being READ, and a
    // sampler left null is a sampler three binds its own empty texture to —
    // which works, and which means a genuinely unbound depth texture and a
    // switched-off one look identical the day one of them is a bug.
    cu.tDepth.value = sceneDepth;
    if (wantDepth) {
      cu.uCam.value.set(cam.near, cam.far);
      // Metres-to-pixels at one metre: half the drawing-buffer height over the
      // tangent of half the vertical field of view. This is what makes the
      // crease radius a WORLD size instead of a screen one, and it has to be
      // recomputed every frame because the eye-raise and the helm both move
      // the fov.
      cu.uFocalPx.value = (vh * 0.5) /
        Math.tan(THREE.MathUtils.DEG2RAD * 0.5 * cam.fov);
      cu.uCreaseK.value = game.state.noCrease ? 0 : p.crease;
      // The wide octave's weight is a constant except on the governor's third
      // rung (systems.js, THE GOVERNOR), which writes creaseWide 0: the
      // 4..112 px gather is the composite's least cache-friendly term.
      cu.uCreaseW.value.z = p.creaseWide === 0 ? 0 : MAIN_CREASE_WK;
      // ---- the occlusion (AAA pass): one half-res gather, one bilateral
      // pair, then four taps in the composite. Parked from rung 1 with the
      // other terms added since WOW3; `noAO` is the A/B.
      const aoK = (game.state.noAO || (game.state.perfRung | 0) >= 1) ? 0 : MAIN_AO_K;
      cu.uAoK.value = aoK;
      if (aoK > 0) {
        const q = matAO.uniforms;
        const th = Math.tan(THREE.MathUtils.DEG2RAD * 0.5 * cam.fov);
        q.tDepth.value = sceneDepth;
        q.uCam.value.copy(cu.uCam.value);
        q.uTexel.value.set(1 / vw, 1 / vh);
        q.uTan.value.set(th * cam.aspect, th);
        q.uFocalPx.value = cu.uFocalPx.value;
        mainPostDraw(matAO, aoA);
        const u = matAOBlur.uniforms;
        u.tAO.value = aoA.texture; u.uStep.value.set(1 / aw, 0); mainPostDraw(matAOBlur, aoB);
        u.tAO.value = aoB.texture; u.uStep.value.set(0, 1 / ah); mainPostDraw(matAOBlur, aoA);
        cu.tAO.value = aoA.texture;
      } else {
        cu.tAO.value = mainPostBlack;
      }
      // ---- the airlight's ray basis ------------------------------------
      // Three world vectors, rebuilt once a frame, so the fragment shader can
      // get a world ray out of its own uv with two multiplies and an add and
      // needs no inverse-view-projection.
      //
      // THEY ARE SCALED SO THAT rd . forward == 1 EXACTLY. That is what makes
      // the linear depth usable as a ray parameter without a second dot
      // product per pixel: the shader takes `length(rd)` as the ratio between
      // view-axis depth and true distance, which is 1 at the centre of the
      // frame and larger at the corners.
      const airLit = game.state.noAirLight ? 0 : p.airLight;
      cu.uAirLitK.value = airLit;
      if (airLit > 0.0005 || p.air > 0.000001 || p.farDark > 0.0001) {
        cam.updateMatrixWorld();
        const e = cam.matrixWorld.elements;
        // the camera's own basis, straight out of its world matrix
        mainAirR.set(e[0], e[1], e[2]);
        mainAirU.set(e[4], e[5], e[6]);
        mainAirF.set(-e[8], -e[9], -e[10]);
        const th = Math.tan(THREE.MathUtils.DEG2RAD * 0.5 * cam.fov);
        const tw = th * cam.aspect;
        cu.uCamPos.value.setFromMatrixPosition(cam.matrixWorld);
        // uv 0..1, so the corner is -tw and the span is 2*tw
        cu.uRayDX.value.copy(mainAirR).multiplyScalar(2 * tw);
        cu.uRayDY.value.copy(mainAirU).multiplyScalar(2 * th);
        cu.uRayBL.value.copy(mainAirF)
          .addScaledVector(mainAirR, -tw)
          .addScaledVector(mainAirU, -th);
      }
      cu.uAirK.value = game.state.noAir ? 0 : p.air;
      cu.uAirMax.value = p.airMax;
      cu.uAirCol.value.set(p.airR, p.airG, p.airB);
      cu.uNearClear.value.z = (game.state.noNearClear || (game.state.perfRung | 0) >= 1) ? 0 : MAIN_NEAR_CLEAR[2];
      cu.uAirGnd.value = game.state.noAir ? 0 : (p.airGnd || 0);
      cu.uFarDark.value = game.state.noAir ? 0 : (p.farDark || 0);
      cu.uFarDist.value.set(p.farDist0 || 30, p.farDist1 || 160, 0);

      const dofK = game.state.noDof ? 0 : p.dof;
      cu.uDofK.value = dofK;
      if (dofK > 0.0005) {
        cu.uDof.value.set(p.dofNear0, p.dofNear1, p.dofFar0, p.dofFar1);
        const q = matCoC.uniforms;
        q.tDiffuse.value = sceneRT.texture;
        q.tDepth.value = sceneDepth;
        q.uCam.value.copy(cu.uCam.value);
        q.uDof.value.copy(cu.uDof.value);
        mainPostDraw(matCoC, dofA);
        // Two H/V pairs, the second at 2.4x, exactly as the bloom does — and
        // on the same shader, which is why it had to learn a fourth channel.
        // The offsets are anchored to MAIN_POST_REF_H for the reason the bloom
        // is: a quarter-res texel is a smaller piece of the picture on a
        // bigger monitor, and a defocus that shrinks as the window grows is a
        // defocus that only exists at one size.
        const dy = MAIN_DOF_RADIUS * Math.min(2, vh / MAIN_POST_REF_H) / bh;
        const dx = dy * (vh / vw);
        const u = matBlur.uniforms;
        u.tDiffuse.value = dofA.texture; u.uStep.value.set(dx, 0);       mainPostDraw(matBlur, dofB);
        u.tDiffuse.value = dofB.texture; u.uStep.value.set(0, dy);       mainPostDraw(matBlur, dofA);
        u.tDiffuse.value = dofA.texture; u.uStep.value.set(dx * 2.4, 0); mainPostDraw(matBlur, dofB);
        u.tDiffuse.value = dofB.texture; u.uStep.value.set(0, dy * 2.4); mainPostDraw(matBlur, dofA);
        cu.tDof.value = dofA.texture;
      } else {
        cu.tDof.value = mainPostBlack;
      }
    } else {
      // Cut, not faded, and the samplers go back to the 1x1 black so nothing
      // downstream can be reading a stale target.
      cu.uDofK.value = 0; cu.uAirK.value = 0; cu.uCreaseK.value = 0;
      cu.uAoK.value = 0; cu.tAO.value = mainPostBlack;
      cu.uAirLitK.value = 0;      // ...this one too, or it keeps the last chapter's
      cu.tDof.value = mainPostBlack;
    }

    if (p.bloom > 0.0005) {
      matBright.uniforms.tDiffuse.value = sceneRT.texture;
      matBright.uniforms.uThreshold.value = p.threshold;
      matBright.uniforms.uKnee.value = p.knee;
      mainPostDraw(matBright, bloomA);

      // Two ping-ponged H/V pairs, the second at 2.4x the offset: a wide, soft,
      // cheap approximation of a kernel far larger than nine taps.
      //
      // THE OFFSET IS A FRACTION OF THE SCREEN, NOT A COUNT OF TEXELS. It used
      // to be `radius / bw`, which is the same number of quarter-res texels at
      // every size — and a quarter-res texel is a smaller piece of the picture
      // on a bigger monitor, so the halo shrank as the window grew. Measured on
      // the lamp on the Monte Carlo quay: at 720 it spread well past the bulb,
      // at 1440 it barely cleared it. Nineteen grade rows were tuned by eye at
      // 720 and only existed there. Anchored to that height, with the
      // correction capped at 2x so the five taps of the second octave cannot
      // spread far enough apart to ring on a very large screen.
      const rad = game.state.noBloomRef ? p.radius
                : p.radius * Math.min(2, vh / MAIN_POST_REF_H);
      const uy = rad / bh;
      const ux = uy * (vh / vw);
      const u = matBlur.uniforms;
      u.tDiffuse.value = bloomA.texture; u.uStep.value.set(ux, 0);       mainPostDraw(matBlur, bloomB);
      u.tDiffuse.value = bloomB.texture; u.uStep.value.set(0, uy);       mainPostDraw(matBlur, bloomA);
      u.tDiffuse.value = bloomA.texture; u.uStep.value.set(ux * 2.4, 0); mainPostDraw(matBlur, bloomB);
      u.tDiffuse.value = bloomB.texture; u.uStep.value.set(0, uy * 2.4); mainPostDraw(matBlur, bloomA);
      matComp.uniforms.tBloom.value = bloomA.texture;
      matComp.uniforms.uBloom.value = p.bloom;

      // ...and the same again an octave down, starting FROM the finished
      // quarter-res bloom, so the wide halo is the tight one carried outward
      // rather than a second reading of the scene. The first draw's bilinear
      // read does the 2:1 downsample for nothing.
      if (p.wide > 0.0005) {
        const wy = rad / wh, wx = wy * (vh / vw);
        u.tDiffuse.value = bloomA.texture; u.uStep.value.set(wx, 0);       mainPostDraw(matBlur, wideB);
        u.tDiffuse.value = wideB.texture;  u.uStep.value.set(0, wy);       mainPostDraw(matBlur, wideA);
        u.tDiffuse.value = wideA.texture;  u.uStep.value.set(wx * 2.4, 0); mainPostDraw(matBlur, wideB);
        u.tDiffuse.value = wideB.texture;  u.uStep.value.set(0, wy * 2.4); mainPostDraw(matBlur, wideA);
        matComp.uniforms.tWide.value = wideA.texture;
        matComp.uniforms.uWide.value = p.bloom * p.wide;
      } else {
        matComp.uniforms.tWide.value = mainPostBlack;
        matComp.uniforms.uWide.value = 0;
      }

      // ---- THE RAYS (ROADMAP-WOW A4). See MAIN_POST_RAYS. -----------------
      // AFTER the wide octave, because the second pass writes wideB and the
      // wide chain's result lives in wideA; after the bloom, because the
      // first pass writes bloomB. p.rays arrives already zero when systems.js
      // found the source off the frame, behind the lens, cut (noRays) or
      // parked (rung 1 up) — this block has no opinion of its own.
      if (p.rays > 0.0005) {
        const ru = matRays.uniforms;
        // 64 taps across raysLen frame heights: 8 at s, then 8 of those at 8s.
        const s = Math.max(p.raysLen, 0.02) / 64;
        ru.uLight.value.set(p.raysX, p.raysY);
        ru.uAspect.value = vw / vh;
        ru.tDiffuse.value = bloomA.texture; ru.uStep.value = s;     ru.uDecay.value = 0.94; ru.uMaskR.value = p.raysR;
        mainPostDraw(matRays, bloomB);
        ru.tDiffuse.value = bloomB.texture; ru.uStep.value = s * 8; ru.uDecay.value = 0.80; ru.uMaskR.value = 0;
        mainPostDraw(matRays, wideB);
        matComp.uniforms.tRays.value = wideB.texture;
        matComp.uniforms.uRaysK.value = p.rays;
      } else {
        matComp.uniforms.tRays.value = mainPostBlack;
        matComp.uniforms.uRaysK.value = 0;
      }
    } else {
      matComp.uniforms.tBloom.value = mainPostBlack;
      matComp.uniforms.uBloom.value = 0;
      matComp.uniforms.tWide.value = mainPostBlack;
      matComp.uniforms.uWide.value = 0;
      matComp.uniforms.tRays.value = mainPostBlack;
      matComp.uniforms.uRaysK.value = 0;
    }

    // =========================================================================
    // UNDER THE SURFACE (ROADMAP-WOW2 V4). `game.state.noSub2` cuts every term
    // below to a JS-side zero (no draw, no branch taken downstream) and the
    // governor parks the whole block from rung 1, the far-cascade way:
    // allocated buffers, skipped work.
    // =========================================================================
    const subOn = !game.state.noSub2 && ((game.state.perfRung | 0) < 1);
    const subK = subOn ? (p.sub || 0) : 0;
    cu.uSubCeilK.value = subK;
    // ROADMAP-WOW3 D1: hand the ceiling term the real reflection texture
    // when one has ever been rendered (see the block above uSubCeilK); the
    // shader falls back to its own formula when `.value` is null.
    if (subK > 0.001) {
      const rt = reflectTex();
      if (rt && rt.value) { cu.tReflC.value = rt.value; cu.uReflCeilOn.value = 1; }
      else { cu.tReflC.value = mainPostBlack; cu.uReflCeilOn.value = 0; }
    } else {
      cu.uReflCeilOn.value = 0;
    }
    // The ripple's own clock. Not a logical trigger — nothing reads uSubT to
    // decide anything, only to animate — so wall-clock rather than a dt this
    // function is never given costs nothing an A/B could see.
    cu.uSubT.value = performance.now() * 0.001;

    // ---- SHAFTS UNDER WATER (ROADMAP-WOW2 V4.2). See MAIN_SUB_RAYS_K. -----
    // A4's own rays (just above) exist only in five sysRAYS chapters, none of
    // which is one of this term's four instrumented dive chapters — so this
    // cannot be "the same pass, retuned": it is the same SHADER (matRays),
    // reused, fed its own source and its own light, and it wins the shared
    // tRays/uRaysK register whenever it runs.
    //
    // THE SOURCE. sceneRT (the raw HDR scene), not bloomA (the surface
    // bright-pass) — underwater rarely has anything that clears the normal
    // grade threshold, so this runs its OWN loose threshold (MAIN_SUB_RAYS_K's
    // block, above) into dofB, safe scratch here: the DoF block above has
    // already copied whatever it needed out of dofA/dofB by this point, and
    // dofA is never touched again (it is what cu.tDof.value still points at).
    //
    // THE DIRECTION. Snell's law bends any above-water ray toward the normal
    // by up to the critical angle (~48.6 deg, air-to-water) as it crosses the
    // surface, so from underwater a source is always inside a narrow cone
    // around straight up — "Snell's window". The true bend needs the sun's
    // world direction and the water's normal, and neither reaches this file
    // (systems.js's sysAxDir is private, and adding a uniform for it is out
    // of scope for main.js/weather.js alone); the cone argument says a FIXED
    // bend to vertical reads right regardless of the true solar azimuth, so
    // that is what this projects: straight up from the camera, onto the
    // screen, with the camera's own basis (already computed for the airlight
    // a few dozen lines up, recomputed here since nothing later wants its
    // old values).
    if (subK > 0.5) {
      const subRaysK = MAIN_SUB_RAYS_K * (subK - 0.5) * 2;
      cam.updateMatrixWorld();
      const e2 = cam.matrixWorld.elements;
      mainAirR.set(e2[0], e2[1], e2[2]);
      mainAirU.set(e2[4], e2[5], e2[6]);
      mainAirF.set(-e2[8], -e2[9], -e2[10]);
      const upF = mainWorldUp.dot(mainAirF), upR = mainWorldUp.dot(mainAirR), upU = mainWorldUp.dot(mainAirU);
      const th2 = Math.tan(THREE.MathUtils.DEG2RAD * 0.5 * cam.fov);
      const tw2 = th2 * cam.aspect;
      let vx = 0.5, vy = 0.92;
      if (upF > 0.02) {
        vx = 0.5 + 0.5 * (upR / upF) / tw2;
        vy = 0.5 + 0.5 * (upU / upF) / th2;
      }
      vx = Math.min(1.4, Math.max(-0.4, vx));
      vy = Math.min(1.4, Math.max(-0.4, vy));

      const qb = matBright.uniforms;
      qb.tDiffuse.value = sceneRT.texture;
      qb.uThreshold.value = MAIN_SUB_RAYS_THR;
      qb.uKnee.value = MAIN_SUB_RAYS_KNEE;
      mainPostDraw(matBright, dofB);

      const ru = matRays.uniforms;
      const rlen = Math.max(p.raysLen, 0.02) * 2;
      const s2 = rlen / 64;
      ru.uLight.value.set(vx, vy);
      ru.uAspect.value = vw / vh;
      ru.tDiffuse.value = dofB.texture;   ru.uStep.value = s2;     ru.uDecay.value = 0.94; ru.uMaskR.value = 0;
      mainPostDraw(matRays, bloomB);
      ru.tDiffuse.value = bloomB.texture; ru.uStep.value = s2 * 8; ru.uDecay.value = 0.80; ru.uMaskR.value = 0;
      mainPostDraw(matRays, wideB);
      matComp.uniforms.tRays.value = wideB.texture;
      matComp.uniforms.uRaysK.value = subRaysK;
    }

    // ---- SURFACING BEADS (ROADMAP-WOW2 V4.4). Timed in weather.js, which
    // has this function's dt and this file does not — see subBeadT there.
    cu.uBeadT.value = (subOn && game.weather && typeof game.weather.subBeadT === 'function')
      ? game.weather.subBeadT() : 0;

    const c = matComp.uniforms;
    c.tDiffuse.value = sceneRT.texture;
    c.uContrast.value = p.contrast;
    c.uSaturation.value = p.saturation;
    c.uVignette.value = p.vignette;
    c.uVigStart.value = p.vigStart;
    c.uVigTone.value = p.vigTone;
    c.uShoulder.value = p.shoulder;
    c.uExposure.value = p.exposure;
    c.uTint.value.set(p.tintR, p.tintG, p.tintB);
    c.uLift.value.set(p.liftR, p.liftG, p.liftB);
    const W = MAIN_SPLIT_WARM, C = MAIN_SPLIT_COOL;
    c.uSplitH.value.set(1 + W[0] * p.splitW, 1 + W[1] * p.splitW, 1 + W[2] * p.splitW);
    c.uSplitS.value.set(1 + C[0] * p.splitC, 1 + C[1] * p.splitC, 1 + C[2] * p.splitC);
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
  // ---- THE COUNTERS COUNT THE WHOLE FRAME (L4, qa #8) -------------------
  // three.js resets renderer.info on every render() call by default, and the
  // composite pass is several of them, the last a full-screen quad — so the
  // perf overlay (backquote) and every probe that read info.render after the
  // frame saw ONE call and ONE triangle, for years. Reset by hand at the top
  // of game.tick instead, and the numbers are the frame's: Hanoi 365 calls /
  // 481k triangles, shadow pass included. See the top of game.tick.
  renderer.info.autoReset = false;

  // ---------------------------------------------------------------------
  // THE GRAPHICS CARD IS ALLOWED TO GO AWAY.
  //
  // Nothing in this game had ever listened for it. A WebGL context is lost on
  // a driver reset, on a laptop waking from sleep, when another tab asks for
  // too much memory, when a phone backgrounds the page for long enough, and on
  // Windows every time the GPU is preempted for more than two seconds. The
  // result was a black rectangle, for ever, with the HUD still drawn over the
  // top of it and every key still working — the worst kind of failure, because
  // it looks like the game is running and the player is doing something wrong.
  //
  // preventDefault() is not optional: without it the browser will not even
  // TRY to give the context back. With it, `webglcontextrestored` usually
  // arrives within a second or two, and three.js re-uploads what it needs
  // lazily. So the honest behaviour is: stop drawing, say so in words, and
  // pick the game back up if the context comes back — with the reload button
  // on the card as the guaranteed way out if it does not.
  let glLost = false;
  canvas.addEventListener('webglcontextlost', function (e) {
    e.preventDefault();
    glLost = true;
    if (window.__capyFail) {
      window.__capyFail('The graphics context was lost.',
        ['This is usually the graphics driver restarting, or the computer waking from sleep.',
         'It often comes back on its own after a moment.',
         'If it does not, reload — your progress is saved.'],
        'webglcontextlost');
    }
  }, false);
  canvas.addEventListener('webglcontextrestored', function () {
    glLost = false;
    // Take the card down again and let the loop carry on. Anything three.js
    // could not re-upload will throw from a module's update, and the strike
    // system three hundred lines below turns that into a visible one-line
    // report rather than another silent black frame.
    const el = document.getElementById('boot');
    if (el) { el.classList.remove('failed'); el.classList.add('hidden'); }
    window.__capyFailed = false;
    console.log('[gl] context restored');
  }, false);

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
      // THE SLIDE (v44). Held, not latched: a slide is a state you stay in, and
      // the only edge anyone needs is the one capybara.js derives for itself.
      slide: false,
      camYaw: 0,
    },
    // `dt` is the SCALED frame time every module is handed; `rawDt` is the wall
    // clock, and `timeScale` is the ratio. See mainMakeTime.
    // `chaos` is the mayhem input and `calm` is the other end of the same
    // stick — a spike that decays and a hold that accrues. See THE CALM in
    // systems.js, which owns both.
    // `flow` is the THIRD number beside them: a streak rather than a spike or a
    // hold. See THE FLOW in systems.js, which owns it.
    state: { time: 0, dt: 0, rawDt: 0, timeScale: 1, paused: false, started: false, score: 0, chaos: 0, calm: 0, flow: 0, sailing: false },
    mats: null,
    props: [], npcs: [],
    capy: null, env: null, physics: null, hud: null, post: null,
    pasto: null, quay: null, kyoto: null, cali: null, rio: null,
    iceland: null, sahara: null, drift: null, venice: null, kowloon: null,
    palawan: null, goreme: null, manly: null, pantanal: null, cave: null,
    antarctic: null, monaco: null, hanoi: null,
    // THE GLOBAL ENVIRONMENT. Biome-neutral and always resident, like the
    // capybara and the systems: the micro-weather is a property of wherever
    // you are standing, not a thing any one chapter owns. See weather.js.
    weather: null,
    condor: null, biome: null,
    completeTask() {}, toast() {}, shake() {}, sfx() {},
    registerShadowTarget() {},
    // THE CALM, stubbed here and filled in by systems.js. `calm()` answers 1 —
    // "nothing is disturbing anything" — because a world with no systems in it
    // yet is exactly that, and a critter registered before systems exists gets
    // a record that simply never shrinks. Neither stub can produce a wrong
    // behaviour; both exist so that the shape of `game` is one object literal.
    calm(x) { return x === undefined ? 0 : 1; },
    addCritter(o) {
      const r = (o && o.r > 0) ? o.r : 10;
      return { biome: (o && o.biome) || '', r: r, k: 1, near: r, calm: 0, bold: 0, appr: 0 };
    },
    // THE TIME CHANNEL, filled in for real three lines below. Declared here so
    // the shape of `game` is one object literal and a reader does not have to
    // find the assignment to know these exist.
    time: null, hitstop() {}, slowmo() {},
    // THE LOCALS SERVICE, stubbed here and filled in by npc.js below. A biome
    // build runs before OR after npc.js depending on the chapter, and a chapter
    // that is built lazily on first entry runs long after everything - so the
    // two calls have to exist on frame zero and be harmless if nobody has
    // wired them up yet. See npc.js, THE LOCALS.
    addLocal() { return null; }, addExchange() { return null; }, say() {},
    // A CROWD YOU CANNOT WALK THROUGH, stubbed here and filled in from
    // props.js two dozen lines below. Same reason as the locals service: a
    // chapter calls this from its BUILD, and a lazily-built chapter runs long
    // after every module exists while `createPhysicsWorld` itself runs before
    // most of them. Answering null is harmless — the chapter simply draws the
    // crowd it already drew and nobody gets a body.
    addCrowdBodies() { return null; },
  };
  window.__capy = game;
  // For qa/wow-reflect.js: what the planar reflection pass did last frame,
  // and the pass itself on demand, so an A/B can draw both arms in one task.
  game.reflectInfo = reflectInfo;
  game.reflectDraw = function () {
    return reflectRender(game.renderer, game.scene, game.camera, !!game.state.noReflect, game.state.perfRung | 0, game.state.reflectScale);
  };

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
  // The substep count for the perf overlay: cannon-es keeps it in a local
  // inside World.step, so it is counted here off the event every internal
  // step fires, and snapshotted at the top of game.tick with the render info.
  game.world.addEventListener('postStep', function () { mainSubsteps++; });

  // 2..8 gameplay modules. Sydney content is captured as it is built; the
  // capybara, condor and systems are biome-neutral and stay resident always.
  const env     = biome.capture('sydney', () => mainSafe('environment', () => createEnvironment(game)));
  const props   = biome.capture('sydney', () => mainSafe('props',       () => createProps(game)));
  // A CROWD YOU CANNOT WALK THROUGH — the one verb off props.js that chapters
  // call from their own BUILD, promoted onto `game` the way `addLocal` is.
  //
  // IT HAS TO BE HERE AND NOT UP BY `createPhysicsWorld`, and the first cut had
  // it up there: `game.physics` is assembled by `createProps`, not by the world
  // builder above it, so the wiring ran against an object that did not exist
  // yet, silently left the stub in place, and every chapter in the pass
  // measured exactly as unsolid as it had before. It cost a full probe run,
  // and the tell was the six chapters coming back 1-17% instead of ~100%.
  if (game.physics && typeof game.physics.addCrowdBodies === 'function') {
    game.addCrowdBodies = game.physics.addCrowdBodies;
  }
  // ...and the same for the three verbs of THINGS THAT HANG, for the same
  // reason and with the same ordering trap: they are wired here, AFTER
  // createProps has run, and never in the block above it.
  if (game.physics && typeof game.physics.hang === 'function') {
    game.hang = game.physics.hang;
    game.hangRemove = game.physics.hangRemove;
    game.hangAudit = game.physics.hangAudit;
  }
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
  const monaco  = mainSafe('monaco',      () => createMonaco(game));
  const hanoi   = mainSafe('hanoi',       () => createHanoi(game));
  // Deliberately NOT captured into a biome: its two instanced fields are one
  // set of buffers that every chapter borrows, so they must survive a
  // hemisphere change rather than being detached with the place that was live
  // when they happened to be allocated.
  const weather = mainSafe('weather',     () => createWeather(game));
  // ...and the grass (ROADMAP-WOW G1), for the same reason: one instanced field
  // every grass chapter borrows, so it is not captured into a biome either.
  const grass   = mainSafe('grass',       () => createGrass(game));
  const systems = mainSafe('systems',     () => createSystems(game));
  // THE RIVAL (AAA A4): after systems, whose drop and ground doors it uses.
  const rival   = mainSafe('rival',       () => createRival(game));

  // The locals service, now that npc.js exists. Biomes call game.addLocal()
  // from their build and game.say() from their update; both were no-ops until
  // this line, which only matters for a chapter built before npc.js was (there
  // are none - every one of them is lazy).
  if (npcs && typeof npcs.addLocal === 'function') {
    game.addLocal = npcs.addLocal;
    // ...and the one person who is in four of them. See THE TRAVELLER.
    game.addTraveller = npcs.addTraveller;
    // THE BAG (L8, F2): SYDNEY'S OWN CAMEO — the one chapter built before
    // this line runs (`biome.capture('sydney', ...)` fires while npc.js's
    // addTraveller was still undefined), so it cannot register itself from
    // environment.js the way the other fourteen register from their own
    // chapter file (a `typeof game.addTraveller === 'function'` guard there
    // would just silently skip forever — measured, on the first pass of this
    // feature). `game.env` is already built by here (createEnvironment ran
    // at line ~2031, above), so its terrainHeight is safe to call now. The
    // ferry wharf deck is the solid rectangle envIsOverWaterFast carves out
    // of the harbour at x[-43.7,-36.3] z>=-24.4 (environment.js), so
    // (-42,-19) is walked ground, not a guess.
    if (typeof game.addTraveller === 'function') {
      const travY = (game.env && typeof game.env.terrainHeight === 'function') ? game.env.terrainHeight(-42, -19) : 0.34;
      game.addTraveller({ biome: 'sydney', x: -42, y: isFinite(travY) ? travY : 0.34, z: -19, face: 2.1,
        gateChap: 1,
        lines: ['Every trip starts somewhere. Mine started in this exact garden, six months ago, badly.',
                'You have got the whole world still ahead of you. I checked. I have been to most of it.'],
        wheek: ['Even here. Of course even here.'] });
    }
    game.addExchange = npcs.addExchange;
    game.say = npcs.say;
    // ...and the version that puts the line over a PERSON rather than at a
    // bare point. Only npc.js knows which of its three arrays a chapter's
    // people are in — see saySomebodyNear, and the measurement that says why
    // a caller cannot work it out for itself.
    game.sayNear = npcs.sayNear;
    // ...and how many people are near a point IN THIS CHAPTER. systems.js's
    // own count walked `game.npcs` with no chapter test, and that array is
    // Sydney's cast, built at boot and never removed. See peopleNear.
    game.peopleNear = npcs.peopleNear;
    game.npcLensFade = npcs.lensFade;   // the crowd in the lens (L6, E1)
    // M11: the traveller's arc, as a number. See npcTravMet.
    game.travMet = npcs.travMet;
    // L6, F4: where they are standing in the live chapter, for the arrow.
    game.travWhere = npcs.travWhere;
    // LIFT9, S3: the shop's map mark — same spot as the traveller, a
    // different name, wired the same way.
    game.shopWhere = npcs.shopWhere;
    // B11 (5d): the one way to make the people near a point jump, from
    // outside npc.js. systems.js's herd loop is the only caller.
    game.startlePeople = npcs.startlePeople;
    // W1: the Opera House concert's house — call, count, cheer, dismiss.
    // environment.js is the only caller; npc.js owns who comes and how.
    game.concert = { call: npcs.concert, house: npcs.concertHouse,
                     cheer: npcs.concertCheer, end: npcs.concertEnd,
                     answer: npcs.concertAnswer };
    // B15 (item 6): the rumour from the place you have just left. systems.js
    // owns the counters that decide whether there is anything to repeat and is
    // the only caller; npc.js owns the pool, the earshot and the waiting.
    game.rumourArm = npcs.rumourArm;
    game.rumourAudit = npcs.rumourAudit;
    // CUSTOMS: the same harness window on the other armed line — the one about
    // the keepsake in the animal's mouth that came from somewhere else. There
    // is no `keepArm` beside it because nothing outside npc.js decides this:
    // the prop is on `game.capy.heldProp` and its home chapter is on the prop.
    game.keepAudit = npcs.keepAudit;
    // Item 6: the notoriety tier, handed down on every arrival. Same split as
    // the regulars' tier one block below — systems.js computes the number
    // because it is a projection of the save file, npc.js decides what a place
    // that has been warned about you actually does.
    game.notoSet = npcs.notoSet;
    game.notoAudit = npcs.notoAudit;
    // THE MARCH (item 3): who is walking over about the chain, and how close
    // they have got. There is no `marchArm` beside it — systems.js emits
    // `capy:chain` and npc.js decides who cares.
    game.marchAudit = npcs.marchAudit;
    // THE STANDING ORDER (item 4): is a parcel out, is it in the mouth, and
    // how many have been delivered. systems.js counts and saves the number off
    // `pal:errand`; this is the window on the errand itself.
    game.errAudit = npcs.errAudit;
    // THE REGULARS (O1, ROADMAP-NEXT item 1). The same three-line shape as the
    // rumour above, and the same split: systems.js holds the tier because the
    // tier is a fact about the journey and lives on the save file, and npc.js
    // holds the person, the pool and the earshot. `palAudit` is the harness
    // window on a lookup that can silently find nobody.
    game.palArm = npcs.palArm;
    game.palWho = npcs.palWho;
    game.palAudit = npcs.palAudit;
    // O2: the tier, handed down. systems.js owns the number because it is on
    // the save file; npc.js owns what the number buys, because that is the
    // same kind of thing the line pool is.
    game.palSet = npcs.palSet;
    game.locals = npcs.locals;
    // How many people near a point are currently watching FOR you — both crowds
    // in one number. See the npcWARY_* block in npc.js; the finds read it.
    game.npcHeat = npcs.heat;
    // ...and how cross the PLACE is, which is the accumulator sitting on top
    // of that (v33). `forceHeat` is the differential lever the task sweep uses
    // to prove nothing was made harder; it is a test hook, not a verb.
    game.placeHeat = npcs.placeHeat;
    game.forceHeat = npcs.forceHeat;
    // ...and the errand's own test hook. See forceErrand in npc.js.
    game.forceErrand = npcs.forceErrand;
    game.heatSites = npcs.heatSites;
    // What every face in the live chapter is doing, read off the nodes. A
    // test hook, like forceHeat — see FACES in npc.js.
    game.faceAudit = npcs.faceAudit;
    // ...and who is mid-sentence, which the capybara gaze reads.
    game.npcSpeaker = npcs.speaker;
    // Which line pool a chapter resolves to. A test hook — see sayAudit.
    game.sayAudit = npcs.sayAudit;
    // ...and whether the world is answering at all: flinches, second-order
    // looks and the chain counters, in one read. A test hook — see reactAudit.
    game.reactAudit = npcs.reactAudit;
    // Who has a job in this chapter and whether they are doing it. See A
    // PERSON WITH A JOB in npc.js.
    game.beatAudit = npcs.beatAudit;
    // D2: which walk routes the ground probe accepted. See walkAudit.
    game.walkAudit = npcs.walkAudit;
    // B13: the exchange pairs and the accusations they have been handed.
    game.exAudit = npcs.exAudit;
    game.forceBlame = npcs.forceBlame;
    // ...and whether the instanced crowd gestures when it speaks. See D8.
    game.gestAudit = npcs.gestAudit;
    // ROADMAP-WOW2 V2: gait / gesture / umbrella / company, in one object.
    game.peopleAudit = npcs.peopleAudit;
  }

  // Runtime spawns (props, NPCs) land in whichever biome is currently live.
  biome._setTag(biome.current);

  // weather runs AFTER every biome and BEFORE props/capy/npc/systems. After,
  // because it asks the live chapter what it is; before, because the wetness,
  // the gust and the light deltas it computes are read the same frame by the
  // controller's grip, the locals' umbrellas and the atmosphere pass.
  const all = [env, pasto, quay, kyoto, cali, rio, iceland, sahara, drift, venice, kowloon,
               palawan, goreme, manly, pantanal, cave, antarctic, monaco, hanoi, weather, grass,
               props, capy, condor, npcs, systems, rival];
  const updaterNames = ['environment', 'pasto', 'quay', 'kyoto', 'cali', 'rio', 'iceland', 'sahara',
                        'drift', 'venice', 'kowloon', 'palawan', 'goreme',
                        'manly', 'pantanal', 'cave', 'antarctic', 'monaco', 'hanoi', 'weather', 'grass',
                        'props', 'capybara', 'condor', 'npc', 'systems', 'rival'];
  all.forEach((m, i) => { if (m) m.__name = updaterNames[i]; });
  const updaters = all.filter(m => m && typeof m.update === 'function');
  // The two the loop may never give up on. See the strike handler in tick().
  const MAIN_NEVER_DROP = { systems: 1, capybara: 1 };

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
      // ---- KINEMATIC BODIES GET CHECKED TOO (P8) ------------------------
      // `mass <= 0` was skipped outright, and those are the ferry, the lifts,
      // the floes, the chiva, the balloon basket, the raft — every carrier in
      // the game, which is to say every body the capybara ever stands ON. A
      // NaN in one of those does not merely mislocate a crate: it goes into
      // the platform frame, and out the other side as the animal's position.
      //
      // What they get is NOT the same treatment. A dynamic body's position is
      // the solver's and may be rolled back; a kinematic body's position is
      // AUTHORED, every frame, by whichever chapter owns it — rewriting it
      // here would be a second writer fighting the first, which is the bug
      // this file exists to prevent rather than cause. So: repair a NaN,
      // clamp a runaway, and never touch a finite position.
      if (b.mass <= 0) {
        const kp = b.position, kv = b.velocity;
        if (!(kp.x === kp.x && kp.y === kp.y && kp.z === kp.z)) {
          kp.copy(b.previousPosition);
          kv.set(0, 0, 0);
          b.interpolatedPosition.copy(kp);
          game.state.solverSaves = (game.state.solverSaves || 0) + 1;
        } else if (!(kv.x === kv.x && kv.y === kv.y && kv.z === kv.z)) {
          kv.set(0, 0, 0);
          game.state.solverSaves = (game.state.solverSaves || 0) + 1;
        } else {
          const ks2 = kv.x * kv.x + kv.y * kv.y + kv.z * kv.z;
          if (ks2 > MAIN_V_CAP * MAIN_V_CAP) {
            const ks = MAIN_V_CAP / Math.sqrt(ks2);
            kv.x *= ks; kv.y *= ks; kv.z *= ks;
            game.state.solverSaves = (game.state.solverSaves || 0) + 1;
          }
        }
        continue;
      }
      if (b.sleepState === 2) continue;
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

  // ---- WHERE THE FRAME GOES (the perf review, 13 Sep 2026) -----------------
  // The main thread's own bill, per module, smoothed: game.state.perf.ms is
  // { step, environment, pasto, ..., systems, draw } in milliseconds, an
  // exponential mean over ~30 frames. 'draw' is the CPU side of post.render —
  // the scene walk, the shadow pass's submissions, the composite's six passes
  // — not the GPU's time, which nothing on this path can read (no timer
  // query on ANGLE/D3D11). Twenty-six performance.now() calls a frame; the
  // overlay and qa/l7-perf.js read it, nothing in src does.
  const mainMs = {};
  function mainMsAdd(k, ms) {
    const v = mainMs[k];
    mainMs[k] = v === undefined ? ms : v + (ms - v) * 0.035;
  }
  // One full frame. Exposed as game.tick so the game can also be advanced manually
  // (headless QA, deterministic capture) when requestAnimationFrame is throttled.
  game.tick = function (dt, render) {
    // Nothing can be drawn without a context, and stepping the world while the
    // player is reading a card that says the graphics stopped would hand them
    // back a capybara somewhere else entirely. See the two listeners up in
    // mainBoot.
    if (glLost) return;
    // ---- LAST FRAME'S NUMBERS, THEN THE COUNTERS GO BACK TO ZERO ----------
    // renderer.info.autoReset is off (see mainBoot), so at this point the
    // counters hold the whole of the previous frame — the shadow pass, the
    // scene, the composite. They are copied on to game.state.perf FIRST,
    // because systems.js reads them from inside its update, which runs
    // before this frame's render and would otherwise read zero; then reset.
    // `programs` is a running total (shaders compile on first sight and are
    // never released), `contacts` is the solver's list as it stands, and
    // `substeps` is what the postStep counter saw since the last reset.
    {
      const ri = renderer.info;
      const pf = game.state.perf || (game.state.perf = { calls: 0, triangles: 0, programs: 0, contacts: 0, substeps: 0 });
      pf.calls = ri.render.calls; pf.triangles = ri.render.triangles;
      pf.programs = ri.programs ? ri.programs.length : 0;
      pf.contacts = game.world ? game.world.contacts.length : 0;
      pf.substeps = mainSubsteps; mainSubsteps = 0;
      pf.ms = mainMs;
      // THE GOVERNOR'S OWN CLOCK (L7, E7): the sum of every module's smoothed
      // bill, i.e. the JS this frame actually cost — not the rAF period,
      // which on a vsync-locked panel is the refresh rate no matter how
      // cheap the frame was. A 30 Hz cap reads 33 ms of period and 12 ms of
      // this; the governor's step-UP reads this number so that panel can
      // still climb back a rung.
      { let t = 0; for (const k in mainMs) t += mainMs[k]; game.state.tickMs = t; }
      ri.reset();
    }
    // The tab-switch guard, and from rung 2 the shed clamp — see MAIN_SHED_*.
    const shed = (game.state.perfRung | 0) >= MAIN_SHED_RUNG;
    const dtCap = shed ? MAIN_SHED_DT : 0.1;
    if (dt > dtCap) dt = dtCap;
    game.state.rawDt = dt;
    // THE ONE PLACE THE WORLD'S CLOCK IS SET. Everything below — the solver,
    // every module's update, the gait, the crowd, the score's lookahead — runs
    // on this number, so a freeze or a held beat is one multiplication rather
    // than twenty-three modules that each have to opt in. See mainMakeTime.
    dt = game.time.step(dt);
    game.state.timeScale = game.time.scale;
    game.state.dt = dt;
    // ...and it does not run under the pause card (L3; LIFT2 left it open):
    // every cooldown, phase and nudge reads this number, and a card that
    // held the world still while the clock ran was a card that expired
    // things behind it
    if (!game.state.paused) game.state.time += dt;

    if (!game.state.paused) {
      // Three-argument step: cannon-es owns the accumulator AND fills every body's
      // interpolatedPosition / interpolatedQuaternion for the leftover fraction of
      // the frame. Modules MUST render from those, not from body.position — a hand
      // rolled accumulator (what this used to be) renders the world at a hard 60Hz
      // no matter the display refresh, which is exactly what made motion look jerky.
      const tStep = performance.now();
      game.world.step(STEP, dt, shed ? MAIN_SHED_SUBSTEPS : MAX_SUBSTEPS);
      mainSaneWorld();
      mainMsAdd('step', performance.now() - tStep);
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
      const tMod = performance.now();
      try {
        m.update(dt);
        if (m.__strikes) m.__strikes = 0;      // a good frame forgives the last bad one
        mainMsAdd(m.__name || String(i), performance.now() - tMod);
      } catch (e) {
        m.__strikes = (m.__strikes || 0) + 1;
        if (m.__strikes <= 3) {
          console.error('[update ' + (m.__name || i) + ' strike ' + m.__strikes + ']', e);
          game.state.lastError = (e && e.message) || String(e);
        } else if (m.__strikes === 4 && !MAIN_NEVER_DROP[m.__name]) {
          console.error('[update ' + (m.__name || i) + '] failing every frame — dropped', e);
          updaters.splice(i, 1); i--;
        } else if (m.__strikes === 4) {
          // ---- ...AND TWO MODULES MAY NEVER BE DROPPED (F3) --------------
          // The comment eighteen lines above this says systems.js MUST keep
          // running, because it owns the HUD, the camera and the line that
          // decides whether the game is paused at all — and then the splice
          // four lines down had no exemption for it. One non-finite value
          // reaching one of the thirty `setTargetAtTime` calls in its tick
          // throws a RangeError, and `clamp` is NaN-transparent so a NaN in a
          // damped value is permanent: four frames later the HUD, the camera
          // and the pause gate are gone with the world still stepping. That is
          // a session ending with nothing in the console but one line.
          //
          // capybara.js is on the list for the same reason at one remove: the
          // animal stops being simulated and every module that reads its
          // position goes on running against a corpse.
          //
          // They keep striking rather than being dropped, and the log is rate
          // limited to once every few seconds — a module throwing sixty times
          // a second would otherwise bury the very stack that explains it.
          const nowS = (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
          if (!m.__loudAt || nowS - m.__loudAt > 4) {
            m.__loudAt = nowS;
            console.error('[update ' + (m.__name || i) + '] failing every frame — KEPT (never dropped)', e);
          }
          m.__strikes = 3;                       // ...so this rung is reached again
        }
      }
    }
    // ---- ...AND THE COMPOSITE PASS IS INSIDE THE NET TOO -------------------
    // Everything above this line gets a try/catch, a strike count and a
    // never-drop list. The one per-frame call that had none was the picture
    // itself — five terms, several render targets, and per-chapter uniforms
    // read live off game.camera every frame. A throw here escapes game.tick,
    // and because mainLoop queues the next frame BEFORE calling tick, the loop
    // survives it: the game goes on simulating behind a frozen image, firing
    // window.onerror sixty times a second.
    //
    // The finally is the other half and is the load-bearing half. post.render
    // binds sceneRT at its top and only unbinds at the very end, so a throw in
    // the middle leaves the renderer pointed at an offscreen target for good —
    // and every later recovery path then draws to nowhere as well, which is a
    // black screen that no longer has an error to explain it.
    // ---- NO DRAW AT ALL WHILE THE SHADERS ARE STILL COMPILING -------------
    // See MAIN_HOLD_MAX_MS. The hold is systems.js's to set and to clear;
    // this only refuses to let it last for ever.
    let held = false;
    if (game.state.renderHold) {
      const nowMs = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      if (!mainHoldAt) mainHoldAt = nowMs;
      if (nowMs - mainHoldAt > MAIN_HOLD_MAX_MS) {
        game.state.renderHold = false;
        console.warn('[render hold] ' + MAIN_HOLD_MAX_MS + ' ms without a release — drawing anyway');
      } else held = true;
    }
    if (!game.state.renderHold) mainHoldAt = 0;
    // ---- THE SHADOW PASS, EVERY OTHER FRAME FROM RUNG 2 -------------------
    // See MAIN_SHED_RUNG. `autoUpdate` back on below the rung, so the lower
    // rungs are exactly what they were; `needsUpdate` is consumed by three at
    // the end of the pass, so a frame that skips it leaves it false.
    {
      const sm = renderer.shadowMap;
      if (shed) {
        sm.autoUpdate = false;
        mainShadowOdd = !mainShadowOdd;
        sm.needsUpdate = mainShadowOdd || !!game.state.shadowDirty;
      } else if (!sm.autoUpdate) {
        sm.autoUpdate = true;
      }
      // A held frame draws nothing, so the request it carried is still owed
      // to the first frame that does; the flag is only spent by a draw.
      if (!held && render !== false) game.state.shadowDirty = false;
    }
    if (render !== false && !held) {
      const tDraw = performance.now();
      try {
        // ---- THE PLANAR REFLECTION (ROADMAP-WOW A1) ------------------------
        // Before the scene draw, inside the same net, on the post path only
        // (pretty tier: the no-post fallback never asked for a mirror). It
        // reads the shadow maps the pass above just wrote and re-runs none of
        // it; parked from the governor's first rung. See reflectRender.
        if (game.post.enabled) {
          reflectRender(renderer, game.scene, game.camera, !!game.state.noReflect, game.state.perfRung | 0, game.state.reflectScale);
        }
        game.post.render();
        game.state.frames = (game.state.frames | 0) + 1;
        mainMsAdd('draw', performance.now() - tDraw);
      } catch (e) {
        const nowS = (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
        if (!mainPostLoudAt || nowS - mainPostLoudAt > 4) {
          mainPostLoudAt = nowS;
          console.error('[post.render] threw — the picture is one frame stale', e);
        }
        game.state.lastError = 'post.render: ' + (e && e.message || e);
      } finally {
        try { renderer.setRenderTarget(null); } catch (x) { /* context lost */ }
      }
    }
  };

  function mainLoop() {
    requestAnimationFrame(mainLoop);
    game.tick(game.clock.getDelta(), true);
  }
  // Warm after the Sydney traveller and all global effect pools exist.
  // The existing async hold keeps shader first-use out of ordinary play.
  if (systems && typeof systems.warm === 'function') systems.warm(biome.current);
  mainLoop();

  const boot = document.getElementById('boot');
  requestAnimationFrame(() => requestAnimationFrame(function bootPaint() {
    if (!game.state.frames) { requestAnimationFrame(bootPaint); return; }
    // THE WATCHDOG IS CALLED OFF BY A FRAME, NOT BY A MODULE.
    // index.html arms a timer at parse time that puts a readable failure card
    // over the splash if the game never starts. The signal that clears it has
    // to be the thing the player is actually waiting for — two rAFs, i.e. a
    // frame has genuinely been drawn — and not merely `window.__capy` being
    // assigned, which happens in the first ten lines of mainBoot and would
    // call the watchdog off before any of the twenty-three modules had run.
    window.__capyRunning = true;
    if (window.__capyWatchdog) { clearTimeout(window.__capyWatchdog); window.__capyWatchdog = null; }
    // The card is HIDDEN and never removed. It used to be removed 700 ms after
    // the first frame, which was fine while the only thing it could say was
    // "warming up the harbour…" — but it is now the one place in the game that
    // can speak to a player in plain words when something has gone wrong, and
    // the most likely such thing (a lost GL context) happens hours in. One
    // hidden div is not worth a second implementation of the same card.
    if (boot) boot.classList.add('hidden');
  }));
}

mainBoot();
