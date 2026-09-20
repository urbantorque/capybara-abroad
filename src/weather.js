import * as THREE from 'three';
import { PALETTE, mat, rand, clamp, damp, calmOn, waterYAt } from './shared.js';

// ===========================================================================
// THE GLOBAL ENVIRONMENT — a biome's mood is FIXED, and it breathes anyway.
//
// Seventeen chapters, and every one of them is locked to an hour. Iceland is
// half past eleven at night for ever; Goreme is twenty minutes before sunrise
// for ever; Marrakech is noon. That is not a limitation to be fixed — it is
// the single strongest thing about how this game reads, because a place you
// can only ever see at one hour becomes THAT HOUR, the way a photograph does,
// and a day/night cycle would take all seventeen of them and make them the
// same place at different times.
//
// So there is no clock in this file and there never will be. What there is
// instead is a MICRO-state: four small, slow, unsynchronised signals that ride
// on top of whatever the chapter already looks like and never move it far
// enough to change what hour it is.
//
//   drizzle   a sunshower arrives, peaks and leaves. Minutes, not seconds.
//   cloud     something passes in front of the sun and takes it back.
//   pulse     the sky breathes. One or two per cent, and you will never
//             consciously see it, which is the entire point of it.
//   gust      the air changes its mind about which way it is going.
//
// EVERY ONE OF THEM IS CENTRED ON ZERO. A chapter with no mood row gets the
// all-zero row and this module is a mathematical no-op on it: the same fog,
// the same sun, the same hemisphere, the same grade, to the last float. That
// is what makes it safe to switch on across seventeen tuned atmospheres at
// once — there is nothing here that can shift a baseline, only something that
// can wobble around one.
//
// WHAT THIS FILE OWNS
//   game.weather.mood()      the live row (never null)
//   game.weather.drizzle()   0..1  } the micro-state, read by everybody
//   game.weather.cloud()     0..1  }
//   game.weather.pulse()    -1..1  }
//   game.weather.gust()      {x,z} m/s of air, ADDED to a biome's own wind()
//   game.weather.wetness()   0..1  how wet the ground is, right now
//   game.weather.slip(x,z)   0..1  ...and what that does to a foot
//   game.weather.splash()    0..1  ...and what it does to the sound of one
//   game.weather.light()     the deltas systems.js layers on the atmosphere
//   game.weather.bed()       the levels systems.js mixes the ambience at
//   game.weather.set(n,cfg)  a chapter may override its own row at runtime
//   game.weather.mistAudit() the ground mist (G3): row, floor, depth, drift
//   game.weather.skitterAudit() the petals on the ground (Part B): kind, count, flying
//
// WHAT IT DOES NOT OWN: any light, any fog value, any post parameter, any
// audio node, any NPC. It computes numbers. systems.js, capybara.js and
// npc.js decide what to do with them, which is why switching this module off
// entirely (it is `mainSafe`d like every other) degrades to exactly the game
// that shipped yesterday rather than to a black screen.
// ===========================================================================

// --- scratch. NEVER allocate inside update. --------------------------------
const wxV1 = new THREE.Vector3();
const wxQ1 = new THREE.Quaternion();
const wxE1 = new THREE.Euler();
const wxS1 = new THREE.Vector3(1, 1, 1);
const wxM1 = new THREE.Matrix4();
const wxCol = new THREE.Color();
const wxGust = { x: 0, z: 0 };
const wxLight = {
  sunK: 1, hemiK: 1, amb: 0,
  fogNK: 1, fogFK: 1,
  hazeMix: 0, hazeHex: PALETTE.wxHazeWet, bgMix: 0,
  bloom: 0, threshold: 0, saturation: 0, contrast: 0,
};
const wxBed = { rain: 0, wind: 0, chirp: 0, drip: 0, rustle: 0, thunder: 0 };

// ASKED, NOT CACHED (R4). This was a module const holding its own copy of the
// prefers-reduced-motion query — the third such copy in the codebase — which
// meant the pause card's calm switch would have moved everything in the game
// except the one thing in it that is a field of two hundred tumbling petals.
// One channel, at the foot of shared.js. It is a call on two paths that run
// once a frame.
function wxCalm() { return calmOn(); }

// ===========================================================================
// 1. THE MOOD TABLE — one row per chapter, and the row IS the configuration
//    interface. There is no per-biome code anywhere in this file.
//
//   label     what this place is. Shown nowhere yet; worth having a name for.
//   lock      the hour this chapter is welded to. DESCRIPTIVE — nothing in
//             this file reads it to compute a light, and nothing outside it
//             should infer anything physical from it either (see `cold`).
//             It picks the colour a rain streak is drawn in, and that is all.
//             'midday' | 'golden' | 'sunset' | 'dusk' | 'night' | 'overcast'
//             | 'predawn' | 'interior'
//   wet       0..1 baseline. How wet the ground is when NOTHING is falling —
//             Venice's paving and a cave floor are wet on a dry day.
//   rain      { odds, peak, hold, gap } the sunshower envelope.
//               odds  0..1 chance of a shower starting when the gap expires.
//                     0 means this place has weather but never that weather.
//               peak  0..1 how hard it gets at its worst.
//               hold  seconds the shower runs, top to tail.
//               gap   seconds between rolls of the dice.
//   cloudK    0..1 depth of the passing shadow. A place with no sky gets 0.
//   pulseK    0..1 depth of the sky's breath. Tiny everywhere. Never over 0.05
//             of the hemisphere, because at 0.08 you can SEE it and then it is
//             a flicker rather than a room.
//   gust      { base, swing, hz } m/s along the mood's own heading, how far it
//             swings either side, and how often it changes its mind.
//   dir       radians. Which way the air goes here.
//   motes     the emitter row, or null. See wxKIND.
//   bed       { rain, wind, chirp, drip, rustle, thunder } CEILINGS, 0..1, on
//             the six ambient voices. The micro-state scales them; this is the
//             most any of them is ever allowed to be in this chapter.
//   slipK     0..1 how much grip a wet surface here actually costs. Cobbles
//             and paving lose a lot; sand loses nothing, because wet sand is
//             GRIPPIER than dry, which is why nobody has ever slipped on a
//             beach.
//   cold      0..1 how cold it is here, and IT IS ITS OWN FIELD FOR A REASON.
//             npc.js originally derived this from `lock`, on the reasoning
//             that the dark chapters are the cold ones — which is true in
//             sixteen places and catastrophically false in the seventeenth.
//             Antarctica is locked to 'midday', because it IS midday there for
//             four months, so the coldest chapter in the game had a crowd
//             standing about in a four-metre katabatic wind entirely at their
//             ease while Reykjavik shivered. A table cannot be missing a rung,
//             and a rung inferred from a different table is a rung waiting to
//             be missing.
// ===========================================================================

/** The all-zero row. A chapter with no entry in wxMOOD gets this, and this
 *  module is then a no-op on it in every one of its channels. */
const wxBASE = {
  label: 'default', lock: 'midday', wet: 0,
  rain: { odds: 0, peak: 0, hold: 1, gap: 60 },
  cloudK: 0, pulseK: 0,
  gust: { base: 0, swing: 0, hz: 0.05 }, dir: 0,
  motes: null,
  bed: { rain: 0, wind: 0, chirp: 0, drip: 0, rustle: 0, thunder: 0 },
  slipK: 0, cold: 0,
};

/** Mote behaviours. A kind is DATA — the update loop below has no idea what a
 *  sakura petal is, only that it falls at 0.55 and spins at 1.9. */
const wxKIND = {
  //            n    size   fall  rise  sway  swayHz spin  windK blink  colours
  petal:    { n: 150, size: 0.115, fall: 0.55, sway: 0.62, swayHz: 0.55, spin: 1.9,  windK: 0.75, blink: 0,
              cols: [PALETTE.sakura, PALETTE.petalWhite, PALETTE.petalPink], geo: 'quad' },
  leaf:     { n: 110, size: 0.150, fall: 0.72, sway: 0.78, swayHz: 0.42, spin: 2.4,  windK: 0.80, blink: 0,
              cols: [PALETTE.wxLeafAut, PALETTE.wxLeafAutB, PALETTE.leafPale], geo: 'quad' },
  seed:     { n: 130, size: 0.070, fall: 0.20, sway: 0.90, swayHz: 0.34, spin: 0.8,  windK: 0.95, blink: 0,
              cols: [PALETTE.wxSeed, PALETTE.petalWhite], geo: 'quad' },
  firefly:  { n: 120, size: 0.075, fall: -0.04, sway: 0.55, swayHz: 0.28, spin: 0,   windK: 0.18, blink: 1,
              cols: [PALETTE.wxFirefly, PALETTE.wxFireflyHot], geo: 'tetra', glow: 1 },
  spore:    { n: 110, size: 0.065, fall: -0.10, sway: 0.42, swayHz: 0.22, spin: 0.5, windK: 0.55, blink: 0.35,
              cols: [PALETTE.wxSpore, PALETTE.wxFireflyHot], geo: 'tetra', glow: 0.6 },
  mote:     { n: 160, size: 0.048, fall: 0.05, sway: 0.30, swayHz: 0.19, spin: 0.3,  windK: 0.30, blink: 0.25,
              cols: [PALETTE.wxMote, PALETTE.wxMoteWarm], geo: 'quad', glow: 0.25 },
  spray:    { n: 120, size: 0.090, fall: 0.35, sway: 0.50, swayHz: 0.80, spin: 1.1,  windK: 1.30, blink: 0,
              cols: [PALETTE.wxSpray, PALETTE.foam], geo: 'quad', glow: 0.3 },
  drift:    { n: 170, size: 0.060, fall: 0.42, sway: 0.95, swayHz: 0.62, spin: 0.9,  windK: 1.45, blink: 0,
              cols: [PALETTE.wxSnowflake, PALETTE.wxSpray], geo: 'quad', glow: 0.35 },
  pollen:   { n: 120, size: 0.055, fall: 0.10, sway: 0.48, swayHz: 0.26, spin: 0.4,  windK: 0.60, blink: 0.20,
              cols: [PALETTE.wxSeed, PALETTE.petalYellow], geo: 'quad', glow: 0.2 },
};

// ---- THE SKITTER (ROADMAP-WOW Part B, Sydney) --------------------------------
// A second field, and a different kind of thing from the motes: not specks
// hanging in the air around the lens but PETALS ON THE GROUND, lying flat
// until a gust picks them up, tumbling a metre or two downwind, and lying
// down again. The Sydney row's own sentence is "a jacaranda petal drift on
// the gust across the forecourt", and the chapter has the trees (eight
// jacarandas, two on the spawn lawn) and the fallen blossom (envBLOSSOM's
// decals) and NO petal that moves — its mote row is pollen, and stays pollen:
// this is a new optional key on a row (`skitter`), not a moved one.
//
// Data, like wxKIND: the loop knows a petal lies at `size`, hops when the
// gust is over `gustMin`, at `odds` per second per petal at full gust, with
// a kick of `lift`, rides the gust at `windK` and falls back at `fall`.
const wxSKIT = {
  jacaranda: { n: 96, size: 0.10, windK: 1.35, lift: 2.1, odds: 1.1, gustMin: 0.9, fall: 0.85,
               cols: [PALETTE.petalPurple, PALETTE.petalPink] },
};
const wxSKIT_MAX = 96;
// ...and its own, tighter box: petals on the ground are looked at from three
// metres up, so a 13 m half-width leaves half of them beside or behind the
// lens (measured 24-31 of 72 in the arrival frame); 9 m puts the field where
// the lens is looking.
const wxSKIT_R = 9;
/** A skitter row is `{ kind }`, and the kind's own numbers do the rest. */
function wxSkitter(kind) { return wxSKIT[kind] ? { kind: kind } : null; }

/** Convenience: a mote row is `[kind, density]`, density scaling wxKIND.n. */
function wxMotes(kind, density, size) {
  const k = wxKIND[kind];
  if (!k) return null;
  return { kind: kind, density: density === undefined ? 1 : density,
           sizeK: size === undefined ? 1 : size };
}

const wxMOOD = {
  // ---- Chapter 1. A cozy midday over the harbour. It has the biggest sky in
  // the game and almost nothing ever happens in it, so it gets real cloud
  // shadow and the lightest possible sunshower — the kind that stops before
  // anybody goes inside.
  sydney: {
    label: 'Harbour Midday', lock: 'midday', wet: 0.02,
    rain: { odds: 0.16, peak: 0.34, hold: 42, gap: 95 },
    cloudK: 0.55, pulseK: 0.030,
    gust: { base: 1.5, swing: 1.1, hz: 0.055 }, dir: 1.05,
    motes: wxMotes('pollen', 0.85),
    // ...and the petals on the ground (Part B). The mote row above is untouched.
    skitter: wxSkitter('jacaranda'),
    bed: { rain: 0.55, wind: 0.40, chirp: 0.10, drip: 0.18, rustle: 0.42, thunder: 0.20 },
    slipK: 0.16, cold: 0.00,
  },
  // ---- Chapter 2. Pasto is 2 527 m up on the side of a live volcano and it
  // drizzles there most of the time. The cloud shadow is the strongest in the
  // game because the cloud is BELOW the peak and moving fast.
  pasto: {
    label: 'Andean Drizzle', lock: 'overcast', wet: 0.20,
    rain: { odds: 0.46, peak: 0.62, hold: 58, gap: 70 },
    cloudK: 0.85, pulseK: 0.042,
    gust: { base: 2.6, swing: 1.9, hz: 0.085 }, dir: -0.55,
    motes: wxMotes('mote', 0.55, 0.9),
    bed: { rain: 0.72, wind: 0.62, chirp: 0.06, drip: 0.30, rustle: 0.22, thunder: 0.44 },
    slipK: 0.30, cold: 0.50,
  },
  // ---- Chapter 3. Seven hundred metres of open water throwing the sun back
  // at you, and a sea breeze that never stops. No shower: it would be falling
  // on a ferry ride whose whole subject is the view.
  quay: {
    label: 'Harbour Glare', lock: 'midday', wet: 0.04,
    rain: { odds: 0.08, peak: 0.22, hold: 30, gap: 120 },
    cloudK: 0.42, pulseK: 0.026,
    gust: { base: 3.4, swing: 1.6, hz: 0.070 }, dir: 1.90,
    motes: wxMotes('spray', 0.55, 0.85),
    bed: { rain: 0.36, wind: 0.66, chirp: 0.00, drip: 0.10, rustle: 0.18, thunder: 0.10 },
    slipK: 0.14, cold: 0.10,
  },
  // ---- Chapter 4. THE SHOWCASE. A Kyoto sunshower is a real and specific
  // thing — rain falling out of a sky that is still bright — and the chapter
  // is already the softest, most overcast light in the game, so it takes the
  // deepest shower and the most petals without changing what it is.
  kyoto: {
    label: 'Sakura Sunshower', lock: 'overcast', wet: 0.12,
    rain: { odds: 0.52, peak: 0.68, hold: 64, gap: 62 },
    cloudK: 0.50, pulseK: 0.034,
    gust: { base: 1.1, swing: 0.9, hz: 0.048 }, dir: 2.35,
    motes: wxMotes('petal', 1.0),
    bed: { rain: 0.68, wind: 0.30, chirp: 0.24, drip: 0.44, rustle: 0.52, thunder: 0.16 },
    slipK: 0.26, cold: 0.20,
  },
  // ---- Chapter 5. A warm valley afternoon. Cali gets an aguacero — hard,
  // short, and over — rather than a drizzle.
  cali: {
    label: 'Valley Warm', lock: 'golden', wet: 0.05,
    rain: { odds: 0.26, peak: 0.72, hold: 26, gap: 110 },
    cloudK: 0.58, pulseK: 0.030,
    gust: { base: 1.8, swing: 1.3, hz: 0.062 }, dir: 0.30,
    motes: wxMotes('seed', 0.80),
    bed: { rain: 0.70, wind: 0.36, chirp: 0.30, drip: 0.26, rustle: 0.40, thunder: 0.46 },
    slipK: 0.24, cold: 0.00,
  },
  // ---- Chapter 6. The loudest daylight in the game, and a tropical shower
  // that arrives in ninety seconds and is gone in two minutes.
  rio: {
    label: 'Hard Noon', lock: 'midday', wet: 0.03,
    rain: { odds: 0.22, peak: 0.80, hold: 24, gap: 130 },
    cloudK: 0.48, pulseK: 0.028,
    gust: { base: 2.2, swing: 1.4, hz: 0.058 }, dir: 2.90,
    motes: wxMotes('pollen', 0.55, 0.85),
    bed: { rain: 0.74, wind: 0.42, chirp: 0.14, drip: 0.24, rustle: 0.34, thunder: 0.52 },
    slipK: 0.20, cold: 0.00,
  },
  // ---- Chapter 7. Half past eleven at night, and the weather that matters
  // there is not rain, it is a cold sea mist coming off the water. The bed is
  // nearly all wind. Locals gather under the streetlamps — see `lock`.
  iceland: {
    label: 'Midnight Haar', lock: 'night', wet: 0.26,
    rain: { odds: 0.40, peak: 0.44, hold: 72, gap: 78 },
    cloudK: 0.30, pulseK: 0.038,
    gust: { base: 4.2, swing: 2.4, hz: 0.090 }, dir: -1.35,
    motes: wxMotes('drift', 0.70, 0.85),
    bed: { rain: 0.44, wind: 0.86, chirp: 0.00, drip: 0.28, rustle: 0.10, thunder: 0.06 },
    slipK: 0.34, cold: 1.00,
  },
  // ---- Chapter 8. AND THIS IS THE ROW THAT PROVES THE ZEROES WORK. It does
  // not rain in the Erg. `odds: 0` means the shower branch is never taken, the
  // wetness never leaves its baseline of nothing, and every wet-surface
  // consumer in three other files multiplies by zero and is untouched. What
  // Marrakech gets instead is dust and the hardest wind in the game.
  sahara: {
    label: 'Kiln Noon', lock: 'midday', wet: 0,
    rain: { odds: 0, peak: 0, hold: 1, gap: 999 },
    cloudK: 0.22, pulseK: 0.034,
    gust: { base: 5.0, swing: 3.2, hz: 0.075 }, dir: 0.85,
    motes: wxMotes('mote', 1.0, 1.1),
    bed: { rain: 0, wind: 0.92, chirp: 0.00, drip: 0, rustle: 0.26, thunder: 0 },
    slipK: 0, cold: 0.00,
  },
  // ---- Chapter 9. You are ABOVE the weather. No rain, no cloud shadow —
  // there is nothing up there to cast one — and the gust is deliberately tiny
  // because drift.js owns a thirty-eight-second gale of its own and this must
  // not fight it. See THE AIR IS A REFERENCE FRAME.
  drift: {
    label: 'Violet Nowhere', lock: 'night', wet: 0,
    rain: { odds: 0, peak: 0, hold: 1, gap: 999 },
    cloudK: 0, pulseK: 0.045,
    gust: { base: 0.5, swing: 0.5, hz: 0.040 }, dir: 1.60,
    motes: wxMotes('spore', 1.0),
    bed: { rain: 0, wind: 0.70, chirp: 0.00, drip: 0, rustle: 0.14, thunder: 0 },
    slipK: 0, cold: 0.60,
  },
  // ---- Chapter 10. The paving is ALREADY wet, before anything falls on it —
  // that is what the chapter is about — so the baseline is the highest in the
  // game outside the cave, and the shower on top of it is gentle.
  venice: {
    label: 'Wet Gold', lock: 'golden', wet: 0.34,
    rain: { odds: 0.42, peak: 0.50, hold: 56, gap: 74 },
    cloudK: 0.44, pulseK: 0.032,
    gust: { base: 1.4, swing: 1.0, hz: 0.052 }, dir: -2.10,
    motes: wxMotes('mote', 0.45, 0.85),
    bed: { rain: 0.62, wind: 0.34, chirp: 0.08, drip: 0.56, rustle: 0.16, thunder: 0.24 },
    slipK: 0.40, cold: 0.30,
  },
  // ---- Chapter 11. NEON RAIN, and it is the name the brief asked for because
  // it is the right one. The wettest street in the game: the whole chapter is
  // a wall of light and the only way a wall of light gets twice as good is a
  // floor that repeats it. Highest slipK, highest baseline outside Venice, and
  // the grade delta below leans hardest here.
  kowloon: {
    label: 'Neon Rain', lock: 'night', wet: 0.30,
    rain: { odds: 0.58, peak: 0.74, hold: 68, gap: 56 },
    cloudK: 0.18, pulseK: 0.040,
    gust: { base: 1.6, swing: 1.2, hz: 0.066 }, dir: 0.10,
    motes: wxMotes('mote', 0.40, 0.8),
    bed: { rain: 0.78, wind: 0.36, chirp: 0.00, drip: 0.60, rustle: 0.12, thunder: 0.30 },
    slipK: 0.42, cold: 0.15,
  },
  // ---- Chapter 12. Bleached, and the shower is a squall that crosses the bay
  // in a minute and a half. Sand does not get slippery.
  palawan: {
    label: 'Bleached Noon', lock: 'midday', wet: 0.04,
    rain: { odds: 0.24, peak: 0.66, hold: 34, gap: 118 },
    cloudK: 0.50, pulseK: 0.028,
    gust: { base: 2.4, swing: 1.5, hz: 0.064 }, dir: -0.90,
    motes: wxMotes('spray', 0.45, 0.8),
    bed: { rain: 0.66, wind: 0.52, chirp: 0.12, drip: 0.20, rustle: 0.30, thunder: 0.36 },
    slipK: 0.06, cold: 0.00,
  },
  // ---- Chapter 13. Twenty minutes before sunrise. Balloons do not fly in
  // weather, so there is none — what there is instead is the coldest, stillest
  // air in the game and the dust that hangs in it over the burners.
  goreme: {
    label: 'Before Dawn', lock: 'predawn', wet: 0.06,
    rain: { odds: 0, peak: 0, hold: 1, gap: 999 },
    cloudK: 0.14, pulseK: 0.036,
    gust: { base: 0.6, swing: 0.6, hz: 0.038 }, dir: 1.25,
    motes: wxMotes('mote', 0.75, 0.95),
    bed: { rain: 0, wind: 0.44, chirp: 0.18, drip: 0.08, rustle: 0.10, thunder: 0 },
    slipK: 0.10, cold: 0.85,
  },
  // ---- Chapter 14. Four o'clock, a westerly behind you, and salt in the air.
  // The most spray in the game and no rain to speak of.
  manly: {
    label: 'Late Westerly', lock: 'golden', wet: 0.10,
    rain: { odds: 0.14, peak: 0.36, hold: 30, gap: 125 },
    cloudK: 0.46, pulseK: 0.030,
    gust: { base: 4.6, swing: 2.2, hz: 0.078 }, dir: 1.75,
    motes: wxMotes('spray', 1.0),
    bed: { rain: 0.38, wind: 0.80, chirp: 0.06, drip: 0.14, rustle: 0.24, thunder: 0.12 },
    slipK: 0.08, cold: 0.10,
  },
  // ---- Chapter 15. The end of the wet season, an hour before sundown, over
  // a hundred thousand square kilometres of standing water. Fireflies, because
  // that is what is actually there at that hour, and the loudest chirp bed in
  // the game.
  pantanal: {
    label: 'End of the Wet', lock: 'dusk', wet: 0.24,
    rain: { odds: 0.50, peak: 0.70, hold: 50, gap: 66 },
    cloudK: 0.52, pulseK: 0.038,
    gust: { base: 1.2, swing: 1.0, hz: 0.046 }, dir: -2.60,
    motes: wxMotes('firefly', 1.0),
    bed: { rain: 0.70, wind: 0.28, chirp: 0.62, drip: 0.40, rustle: 0.46, thunder: 0.50 },
    slipK: 0.30, cold: 0.00,
  },
  // ---- Chapter 16. There is no sky, so there is no shower and no cloud
  // shadow. What a cave has instead is a permanently wet floor, a river you
  // can hear from anywhere, and dust in the three places daylight gets in.
  cave: {
    label: 'Inside the Mountain', lock: 'interior', wet: 0.52,
    rain: { odds: 0, peak: 0, hold: 1, gap: 999 },
    cloudK: 0, pulseK: 0.030,
    gust: { base: 0.4, swing: 0.4, hz: 0.030 }, dir: 0.55,
    motes: wxMotes('mote', 0.90, 1.05),
    bed: { rain: 0, wind: 0.24, chirp: 0.00, drip: 0.90, rustle: 0.06, thunder: 0 },
    slipK: 0.38, cold: 0.70,
  },
  // ---- Chapter 17. The clearest air on earth, and the driest continent on
  // it. No rain. Spindrift — snow that is already down and is being moved
  // around — and the second-hardest wind.
  antarctic: {
    label: 'Clear Cold', lock: 'midday', wet: 0.05,
    rain: { odds: 0, peak: 0, hold: 1, gap: 999 },
    cloudK: 0.26, pulseK: 0.026,
    gust: { base: 4.8, swing: 2.8, hz: 0.082 }, dir: -0.20,
    motes: wxMotes('drift', 1.0),
    bed: { rain: 0, wind: 0.94, chirp: 0.00, drip: 0.06, rustle: 0.04, thunder: 0 },
    slipK: 0.12, cold: 1.00,
  },
  // ---- Chapter 18. Twenty past eight on a warm evening in May, on a coast
  // that gets three hundred days of this a year. Almost nothing happens in
  // this air and that is the row: the calmest gust in the game after the
  // cave's, no rain worth the name, and the one thing it does have is the
  // faint salt haze a Mediterranean evening genuinely has in it. `dusk`,
  // because the whole chapter is lit by things somebody switched on.
  monaco: {
    label: 'Blue Hour', lock: 'dusk', wet: 0.10,
    rain: { odds: 0.06, peak: 0.22, hold: 26, gap: 190 },
    cloudK: 0.20, pulseK: 0.022,
    gust: { base: 1.4, swing: 1.1, hz: 0.052 }, dir: 2.05,
    motes: wxMotes('spray', 0.55),
    bed: { rain: 0.18, wind: 0.34, chirp: 0.10, drip: 0.08, rustle: 0.30, thunder: 0.05 },
    slipK: 0.10, cold: 0.06,
  },
  // ---- Chapter 19. Ten in the morning in October: twenty-nine degrees,
  // eighty per cent humidity and a sky that is white rather than blue. The
  // WETTEST row in the game that is not raining — a tropical morning is damp
  // before anything falls on it — and the shower odds are the highest of any
  // chapter, because in Hanoi in October it rains twice a day for ten minutes
  // and then it is twenty-nine degrees again.
  hanoi: {
    label: 'Wet Season Morning', lock: 'overcast', wet: 0.34,
    rain: { odds: 0.58, peak: 0.78, hold: 36, gap: 74 },
    cloudK: 0.60, pulseK: 0.034,
    gust: { base: 1.1, swing: 0.9, hz: 0.040 }, dir: 1.10,
    motes: wxMotes('mote', 0.85),
    bed: { rain: 0.74, wind: 0.20, chirp: 0.30, drip: 0.52, rustle: 0.34, thunder: 0.40 },
    slipK: 0.34, cold: 0.00,
  },
};

// ===========================================================================
// 2. THE OSCILLATORS.
//
// Three sines per signal at incommensurable periods. The point of three is
// that the sum never repeats inside a session — two sines beat at their
// difference frequency and a player standing still for four minutes can hear
// the loop; three at these ratios have a period measured in hours.
//
// Everything comes back in -1..1 and is scaled by the row's own depth, so a
// chapter with depth 0 gets a signal that is exactly, bit-for-bit, zero.
// ===========================================================================
const wxOSC_A = [1.000, 0.618, 0.379];      // amplitudes, normalised below
const wxOSC_F = [1.000, 2.414, 4.236];      // frequency ratios: irrational-ish
const wxOSC_P = [0.0, 2.399, 4.771];        // phases, so t=0 is not a peak
const wxOSC_N = 1 / (wxOSC_A[0] + wxOSC_A[1] + wxOSC_A[2]);
function wxOsc(t, hz, seed) {
  let s = 0;
  for (let i = 0; i < 3; i++) {
    s += wxOSC_A[i] * Math.sin(t * hz * wxOSC_F[i] * 6.28318 + wxOSC_P[i] + seed);
  }
  return s * wxOSC_N;
}

// The shower envelope: 0 -> 1 -> 0 over its hold, with a long soft tail. It is
// NOT a sine — a shower arrives faster than it leaves, always, and a symmetric
// envelope reads as a machine.
function wxEnvelope(u) {
  if (u <= 0 || u >= 1) return 0;
  const rise = 0.22;                       // first fifth is the arrival
  if (u < rise) { const k = u / rise; return k * k * (3 - 2 * k); }
  const k = (u - rise) / (1 - rise);
  return (1 - k) * (1 - k * 0.35);          // ...and four fifths is the leaving
}

// --- how far the micro-state is allowed to move the picture ----------------
// EVERY ONE OF THESE IS SMALL ON PURPOSE. The brief is "non-disruptive", and
// the test that was actually applied is: can you take a screenshot at the
// bottom of the signal and one at the top and still say, without hesitating,
// what hour of what day it is in both? At double these numbers, in Kyoto, you
// cannot — the shower reads as dusk.
const wxRAIN_SUN   = 0.34;   // fraction of the sun a full shower takes away
const wxRAIN_HEMI  = 0.10;   // ...and of the hemisphere
const wxRAIN_AMB   = 0.10;   // ...and what it gives back as flat fill
const wxRAIN_FOGF  = 0.36;   // fraction the far plane comes IN by
const wxRAIN_FOGN  = 0.30;   // ...and the near one
const wxRAIN_HAZE  = 0.42;   // how far the fog colour goes to wxHazeWet
const wxRAIN_BG    = 0.24;   // ...and the sky, which must move LESS than the fog
const wxCLOUD_SUN  = 0.22;   // a passing shadow at full depth
const wxCLOUD_AMB  = 0.055;  // ...and the fill that keeps it from being a hole
const wxPULSE_HEMI = 1.0;    // the row's pulseK IS the fraction. See the table.
const wxFRONT_CLOUD = 0.55;  // (L7, F4) coverage the front alone adds at the line
const wxFRONT_GUST  = 2.0;   // ...and the gust's own speed multiplier, ahead of it
// The grade. A wet street is not a darker street, it is a HIGHER CONTRAST one
// with more saturated lights in it, and the threshold has to come down or the
// reflections never clear the bright pass at all.
const wxWET_BLOOM  = 0.16;
const wxWET_THRESH = -0.10;
const wxWET_SAT    = 0.05;
const wxWET_CONT   = 0.04;

// --- wetness ---------------------------------------------------------------
// IT SATURATES, AND THE FIRST VERSION DID NOT. Integrating `rainT * rate` puts
// no ceiling on how wet a street can get except how long the shower runs, so
// Sydney's deliberately-lightest-in-the-game 0.34 sunshower measured a wetness
// of 0.559 over one 42-second pass — a wetter street than Kowloon's, which is
// the chapter whose entire subject is a wet street. A shower of intensity r
// asymptotes to a wetness of r and no further: a drizzle makes a damp pavement
// however long you stand in it, which is also what happens outdoors.
const wxWET_RISE   = 0.26;   // damping lambda toward the target. ~12 s to soak.
const wxWET_DRY    = 0.014;  // ...and about half a minute to give it back.
const wxSLIP_MAX   = 0.55;   // hard ceiling on what wetness alone may cost.

// --- the mote field --------------------------------------------------------
// One InstancedMesh, allocated once at the largest count any row asks for, and
// never rebuilt. A biome change swaps the colours and the active count; it
// does not touch the buffer's size, because reallocating a 200-instance
// matrix buffer on every arrival is a hitch inside the white hold for no
// reason at all.
const wxMOTE_MAX   = 200;
const wxRAIN_MAX   = 340;
const wxBOX_R      = 13;     // metres, half-width of the field around the lens
const wxBOX_H      = 9;      // ...and half its height
const wxRAIN_BOX_R = 10;
const wxRAIN_BOX_H = 7;
const wxRAIN_FALL  = 15.5;   // m/s. Drizzle, not a monsoon.
const wxRAIN_LEN   = 0.34;   // m of streak at full intensity
const wxFOLLOW_LAM = 6.0;    // how hard the field chases the camera
// ...AND THE BOX SITS IN FRONT OF THE LENS, NOT AROUND IT.
// A box centred on the camera spends half its instances behind the near plane,
// where they are not merely invisible but WASTED: the density you author is
// twice the density you get, so the honest way to make a shower look like a
// shower is to make the field denser, and then you are paying for four hundred
// streaks to see two hundred. Pushed forward by a third of its own radius, the
// same instance count reads about twice as heavy and costs the same.
const wxAHEAD      = 0.55;
// --- the contact -----------------------------------------------------------
// RAIN WAS DRAWN IN THE AIR AND NEVER LANDED (D5). Three hundred and forty
// streaks fall through the frame, the ground goes dark and picks up a sheen,
// the score gains a rain bed and `splash()` tells the footfall to sound wet —
// and nothing anywhere in nineteen chapters draws a single drop ARRIVING.
// A shower with no contact reads as a filter over the picture rather than as
// weather in the world, and it is the one half of this module the player is
// closest to: the ground three metres in front of the animal.
//
// TWELVE RINGS, WHICH IS TWO MORE THAN THE PEAK RATE CAN HAVE ALIVE. At ten a
// second and 0.52 s of life there are 5.2 up at any moment; the pool is sized
// for the wrap never to steal a ring that is still expanding, which is the
// mistake `confettiAt` made with sysCONF_MAX and which shows up as a ring
// vanishing mid-life rather than as a shortage.
const wxRING_MAX   = 12;
const wxRING_R     = 6.0;    // m — the disc around the animal they land in
const wxRING_RATE0 = 6.0;    // /s at the first of a shower...
const wxRING_RATE1 = 10.0;   // ...and at the top of one
const wxRING_LIFE  = 0.52;   // s
const wxRING_R0    = 0.06;   // m at birth...
const wxRING_R1    = 0.34;   // ...and at death
// A RING NEEDS A FLOOR AND THE ANIMAL IS THE ONLY THING THAT KNOWS WHERE IT
// IS. It is capybara.js's own capyFOOT_Y, copied rather than imported because
// the contract allows a named import from `./shared.js` and from nowhere else,
// and a chapter's constant is not shared. It is the distance from the body
// centre to the ground under it, and it is how a ring lands on a ferry deck, a
// jetty or a bridge rather than in the water underneath one.
const wxFOOT_Y     = 0.34;
// ...and how far above the terrain the animal has to be before this module
// believes it is standing ON something rather than merely on a slope its own
// sample missed. Below this the per-ring terrain height wins, which is what
// keeps a ring on a shelving beach out of the sand.
const wxDECK_UP    = 0.40;

// --- THE BURST (ROADMAP-WOW2, V1.3 — and V4/V5's hook) ------------------------
// The mote field is a WEATHER: a box of specks around the lens that wraps
// and never spawns or dies. Nothing in the game could put a few quads at a
// POINT — a footfall on sand, a drip off a wet belly, a leaf knocked off a
// branch, a bubble off a diver — without a pool of its own, and props.js's
// dust is one such pool with one colour and one shape. This is the other
// answer: the mote field's own instanced quads, wxBURST_MAX of them at the
// TOP of moteQuad's buffer, above whatever the live row is drawing, born at
// a point with a velocity and dead when their life or the floor says so.
//
// THE QUARTER RULE (the roadmap's law for every pool consumer): 48 of 200,
// and never a slot the chapter's own row is using — the row is `moteN`
// instances from zero, the bursts sit from `moteN` up, and where a heavy row
// (the Drift's 170) leaves fewer than 48 the bursts take what is left. A
// row that draws tetrahedra leaves the whole quad buffer free.
//
// A kind is DATA, like wxKIND: the colours (or `null` — the caller brings
// one, for a leaf off a particular tree), the quad's size, how hard it is
// thrown up and out, how fast it falls, how much the air holds it, how long
// it lives, how fast it tumbles. Everything the loop needs and nothing it
// does not; a caller says `burst(x, z, 'dust', 5)` and no more.
const wxBURST_MAX = 48;
const wxBURST = {
  //          colours                                  size   up    out   grav  drag  life  spin
  dust:   { cols: [PALETTE.wxMote, PALETTE.sandDark],  size: 0.050, up: 0.85, out: 0.65, grav: 1.4, drag: 3.2, life: 0.55, spin: 5 },
  snow:   { cols: [PALETTE.wxSnowflake, PALETTE.foam], size: 0.055, up: 1.05, out: 0.75, grav: 2.0, drag: 2.6, life: 0.60, spin: 6 },
  leaf:   { cols: null,                                size: 0.090, up: 1.20, out: 0.90, grav: 3.0, drag: 1.8, life: 0.90, spin: 7 },
  drip:   { cols: [PALETTE.wxDrizzle],                 size: 0.028, up: 0.00, out: 0.12, grav: 9.8, drag: 0.3, life: 0.80, spin: 0 },
  bubble: { cols: [PALETTE.foam],                      size: 0.032, up: 0.00, out: 0.20, grav: -1.6, drag: 2.4, life: 0.90, spin: 0 },
};

// --- THE GROUND MIST (ROADMAP-WOW G3) ----------------------------------------
// The cave builds one (`cavMist`, twenty-two flattened spheres at 0.055 alpha
// under the doline) and nothing else does. This is the same thing said once
// for every chapter whose mood row already describes it in words — a sea mist
// in Iceland, the dust over Goreme's burners, the Pantanal at dusk, the Drift
// "in the mist", Monaco's salt haze, Venice at tide — and it is DATA: a row per
// chapter below, no per-biome code, exactly as the mote kinds are.
//
// WHAT IT IS. Three very large, very low sheets in ONE geometry under ONE
// material, drawn last, never writing depth. Each sheet's alpha is a value
// noise over WORLD x/z (so the pattern stays put when the animal walks and
// the sheets follow it), advected by the weather's own gust, faded radially
// from the animal so the edge of the geometry is never seen, faded near the
// lens so it never washes the frame, and faded with height so the top of it is
// nothing at `h` (0.8 m at most: it must never reach the animal's face). Its
// colour is the chapter's OWN haze — the fog is what a mist is, up close —
// so the far field and the near band agree by construction and no row of a
// grade, a sun, a fog or a mote table moves (the audit's rule).
//
// COST. One draw call, six triangles, a handful of hash noises per covered
// pixel. Per frame it is five uniform writes and a position. It parks at
// governor rung 1 like the far cascade — allocated, skipped, never freed — and
// `game.state.noMist` cuts it for the harness.
//
//   h      metres, the top of the band. The bottom sheet sits at 0.12 h.
//   alpha  the bottom sheet's peak optical depth at the animal's own view
//          angle (Beer-Lambert in the shader; the noise thins it)
//   drift  how much of the gust the pattern moves on; 1 is the gust itself
//   tint   the chapter's haze. PALETTE only.
//   tide   optional [lo, hi] of the live biome's `waterLevel`: the band is
//          at 0.6 of itself at low water and whole at high — Venice's tide.
const wxMIST = {
  // EVERY ROW READ BY EYE (qa/wow-mist-tune.js, two depths a chapter, then
  // qa/wow-mist.js's on/off pair). The first round used each chapter's own
  // fog colour and measured as nothing everywhere: a fog colour vanishes
  // into the ground it lies on. A mist reads against what it HIDES — the
  // dark things at ground level — so a pale chapter (Venice, Goreme) takes
  // a tint darker than its paving and a dark one (Iceland, the Drift) a
  // tint lighter than its road. alpha is an OPTICAL DEPTH (see the shader):
  // 0.2 is a haze you notice at the crowd's ankles, 0.4 is a band the trees
  // stand in, 0.6 was a wash over the whole road and is the ceiling.
  iceland:  { h: 0.80, alpha: 0.34, drift: 1.0, tint: PALETTE.wxHazeWet },
  goreme:   { h: 0.70, alpha: 0.35, drift: 0.7, tint: PALETTE.gorShadowFog },
  pantanal: { h: 0.80, alpha: 0.40, drift: 0.9, tint: PALETTE.panHaze },
  drift:    { h: 0.80, alpha: 0.34, drift: 0.8, tint: PALETTE.driCloud },
  monaco:   { h: 0.60, alpha: 0.22, drift: 0.7, tint: PALETTE.wxHazeWet },
  venice:   { h: 0.70, alpha: 0.36, drift: 0.8, tint: PALETTE.venPigeon, tide: [-1.30, 0.95] },
};
const wxMIST_R       = 36;     // m, half-width of a sheet AND the radial fade's edge
const wxMIST_LAYERS  = [0.12, 0.42, 0.72];   // fractions of h, bottom to top
const wxMIST_FOLLOW  = 1.2;    // lambda of the band's floor chasing the ground
const wxMIST_RAIN    = 0.55;   // a shower at full rainT adds this much alpha...
const wxMIST_RAIN_H  = 0.30;   // ...and this much height, of the row's own
const wxMIST_BREATH  = 0.35;   // m/s the pattern moves in still air, so it boils
const wxMIST_ABOVE   = 6;      // m the animal may be above the ground before the
                               // band stops following it down (a jump, a fall)
// A hash and a value noise of its own. shared.js's grain() has one, and this
// is a COPY rather than an import on purpose: a shader string is not a named
// export, and the mist's is two octaves shorter than the grain's anyway.
const wxMIST_VERT = [
  'uniform float uH;',
  'varying vec3 vW;',
  'varying float vL;',
  'void main() {',
  '  vL = position.y;',
  '  vec4 w = modelMatrix * vec4(position.x, position.y * uH, position.z, 1.0);',
  '  vW = w.xyz;',
  '  gl_Position = projectionMatrix * viewMatrix * w;',
  '}',
].join('\n');
const wxMIST_FRAG = [
  'uniform vec3 uTint;',
  'uniform float uAlpha;',
  'uniform vec2 uDrift;',
  'uniform float uT;',
  'uniform vec3 uCentre;',
  'uniform float uR;',
  'varying vec3 vW;',
  'varying float vL;',
  'float wxHash(vec2 p) {',
  '  p = fract(p * vec2(0.3183099, 0.3678794)) + 0.1;',
  '  p += dot(p, p.yx + 19.19);',
  '  return fract(p.x * p.y);',
  '}',
  'float wxNoise(vec2 p) {',
  '  vec2 i = floor(p), f = fract(p);',
  '  f = f * f * (3.0 - 2.0 * f);',
  '  return mix(mix(wxHash(i), wxHash(i + vec2(1.0, 0.0)), f.x),',
  '             mix(wxHash(i + vec2(0.0, 1.0)), wxHash(i + vec2(1.0, 1.0)), f.x), f.y);',
  '}',
  'void main() {',
  // Each sheet samples a different patch of the field (vL * 41.7) so the three
  // never line up, which is what reads as depth when the lens moves.
  '  vec2 p = vW.xz - uDrift + vL * 41.7;',
  '  float n = wxNoise(p * 0.075) * 0.55 + wxNoise(p * 0.19 + uT * 0.04) * 0.30',
  '          + wxNoise(p * 0.45 - uT * 0.06) * 0.15;',
  '  n = smoothstep(0.42, 0.82, n);',
  '  float d = length(vW.xz - uCentre.xz) / uR;',
  '  float rad = 1.0 - smoothstep(0.30, 1.0, d);',
  '  vec3 toEye = vW - cameraPosition;',
  '  float near = smoothstep(2.0, 6.0, length(toEye));',
  '  float hgt = pow(1.0 - vL, 1.4);',
  // A SLAB, NOT A SHEET. A layer of air seen at a grazing angle is a longer
  // path through the same stuff, so the band thickens toward the far side
  // of the frame and thins straight under the lens — which is the one thing
  // that separates a ground mist from a decal lying on the ground. Beer-
  // Lambert on the sheet's own optical depth over the cosine of the view.
  '  float cosT = max(abs(toEye.y) / max(length(toEye), 0.001), 0.10);',
  '  float od = uAlpha * n * hgt * rad * near * 0.30 / cosT;',
  '  gl_FragColor = vec4(uTint, 1.0 - exp(-od));',
  '  #include <colorspace_fragment>',
  '}',
].join('\n');
const wxFwd = new THREE.Vector3();
const wxZAX = new THREE.Vector3(0, 0, 1);
const wxFall = new THREE.Vector3();
/**
 * THE LIVE BIOME'S API — capybara.js's and props.js's resolution rule, third
 * copy, and it is a copy on purpose: `game.env` is Sydney's and it stays
 * RESIDENT abroad, so asking it for a terrain height in Venice gets a
 * confident answer about a harbour seven thousand miles away.
 */
function wxApiOf(g) {
  const bm = g && g.biome;
  const n = bm && bm.current;
  if (!n) return g ? g.env : null;
  return n === 'sydney' ? g.env : (g[n] || null);
}

export function createWeather(game) {
  const THREEx = game.THREE || THREE;
  const scene = game.scene;

  // ---- live state ---------------------------------------------------------
  let wxT = 0;                    // this module's own clock, seconds
  let name = (game.biome && game.biome.current) || 'sydney';
  let row = wxMOOD[name] || wxBASE;
  let rainT = 0;                  // 0..1 the shower's own envelope, damped
  let rainWant = 0;
  let rainAt = 0;                 // s left of the current shower
  let cloudV = 0, pulseV = 0;
  let wet = row.wet;
  let thunderAt = 0;              // s until this shower is allowed a rumble
  let live = true;                // false while the title card is up

  // ---- THE FRONT (L7, F4) --------------------------------------------------
  // A single scalar, -1..1, the front's position along the chapter's wind:
  // negative is still approaching, 0 is the line itself, positive is past.
  // Every chapter whose mood row allows rain at all gets one, crossing once
  // every wxFrontPeriod (6-9 minutes, re-rolled each cycle so nineteen
  // chapters do not march in lockstep); a chapter with `rain.odds === 0`
  // never gets one; `wxFrontForce` pins it for the harness (`hud.front(k)`).
  // It is the shower's CAUSE now, not a bystander: crossing the line starts
  // exactly the shower row.rain already describes (same hold, same peak),
  // which is what turns four independent dice rolls (cloud, gust, rain, the
  // ground) into one event with a beginning the player can watch arrive.
  let wxFront = -1;
  let wxFrontT = rand(0, 1) * 60;          // desynchronised start
  let wxFrontPeriod = rand(360, 540);
  let wxFrontForce = -2;                   // -2: the weather's own roll
  let wxFrontFired = false;                // this cycle's shower already started
  let wxFrontSaid = false, wxFrontSaidAfter = false;   // the two pills, once per cycle
  let wxFrontNearFlag = false, wxFrontPastFlag = false; // read-once edges for systems.js's two pills

  // ---- the two emitters ---------------------------------------------------
  // Built with mat(), flat Lambert, exactly as the aesthetic law requires. No
  // shadows on either of them, and DELIBERATELY not registered with
  // registerShadowTarget: a hundred and eighty tumbling quads in the shadow
  // pass is a hundred and eighty extra draw calls for a shadow nobody could
  // resolve. This is the palNoShadowOnGhosts rule, applied before it can bite.
  function wxQuadGeo() {
    const g = new THREEx.BufferGeometry();
    // A folded quad, not a flat one. A flat quad edge-on is invisible for half
    // of every tumble and the whole field strobes; a 12-degree fold means
    // there is always one face catching something.
    const h = 0.5, d = 0.10;
    g.setAttribute('position', new THREEx.BufferAttribute(new Float32Array([
      -h, 0, -h,  h, 0, -h,  h, d, h,
      -h, 0, -h,  h, d, h,  -h, d, h,
    ]), 3));
    g.computeVertexNormals();
    return g;
  }
  function wxTetraGeo() { return new THREEx.TetrahedronGeometry(0.5, 0); }

  // ---- ONE DRAW CALL PER FIELD, AND IT TOOK A MEASUREMENT TO GET THERE ----
  //
  // MEASURED: `transparent: true` together with `side: DoubleSide` makes three
  // render the mesh TWICE — back faces, then front faces, which is how it gets
  // transparency sorting right within a single object. One field of 150 motes
  // cost 2 draw calls and 600 triangles; the same field opaque, or transparent
  // and single-sided, costs 1 and 300. Nobody would ever find that by reading
  // the code, and across two fields in seventeen chapters it was doubling the
  // entire cost of this module for no visible benefit at all:
  //
  //   the motes  are 92 % opaque specks a few centimetres across, and a 0.92
  //              alpha on something that small is indistinguishable from 1.0.
  //              They go OPAQUE and keep DoubleSide, which the folded quad
  //              genuinely needs — and being opaque they may write depth,
  //              which also sorts them against each other properly.
  //   the rain   is a closed BOX. There is no such thing as its back face, so
  //              DoubleSide was pure waste. It stays transparent (it runs from
  //              0.16 to 0.50 alpha and must) and goes FrontSide.
  //
  // `alpha` < 1 selects the transparent/FrontSide combination; alpha 1 selects
  // the opaque/DoubleSide one.
  function wxBuildField(geo, count, glow, alpha) {
    const solid = !(alpha < 1);
    const m = mat(0xffffff, solid ? {} : { transparent: true, opacity: alpha }).clone();
    m.vertexColors = false;
    if (glow) { m.emissive = new THREEx.Color(0xffffff); m.emissiveIntensity = glow; }
    m.depthWrite = solid;
    m.side = solid ? THREEx.DoubleSide : THREEx.FrontSide;
    const im = new THREEx.InstancedMesh(geo, m, count);
    im.instanceMatrix.setUsage(THREEx.DynamicDrawUsage);
    im.frustumCulled = false;         // the field IS the frustum
    im.castShadow = false;
    im.receiveShadow = false;
    im.renderOrder = 6;
    im.count = 0;
    scene.add(im);
    return im;
  }

  const moteQuad = wxBuildField(wxQuadGeo(), wxMOTE_MAX, 0, 1);
  const moteTetra = wxBuildField(wxTetraGeo(), wxMOTE_MAX, 0.6, 1);
  // A STREAK IS A BOX, NOT A QUAD, and this is the one place in the file where
  // the extra ten triangles are worth paying. A petal tumbles, so a folded
  // quad always has a face turned somewhere; a raindrop is welded to the fall
  // vector and never turns, so a flat ribbon is edge-on and invisible for
  // every drop whose lean happens to point at the lens. Three hundred boxes is
  // 3 600 triangles against a 130 000 budget, and it is only ever drawn while
  // it is actually raining.
  const rainMesh = wxBuildField(new THREEx.BoxGeometry(1, 1, 1), wxRAIN_MAX, 0.35, 0.5);
  let moteMesh = moteQuad;          // whichever geometry the live row wants

  // ---- THE SKITTER (Part B). See the block above wxSKIT. -----------------
  // Its own field, opaque folded quads like the motes; drawn after them.
  const skitMesh = wxBuildField(wxQuadGeo(), wxSKIT_MAX, 0, 1);
  skitMesh.renderOrder = 7;
  const sx = new Float32Array(wxSKIT_MAX), sz = new Float32Array(wxSKIT_MAX),
        sy = new Float32Array(wxSKIT_MAX), svy = new Float32Array(wxSKIT_MAX),
        sph = new Float32Array(wxSKIT_MAX), ssz = new Float32Array(wxSKIT_MAX),
        srot = new Float32Array(wxSKIT_MAX);
  let skit = null;                  // the live wxSKIT row, or null
  let skitFlying = 0;               // how many are in the air this frame (audit)
  for (let i = 0; i < wxSKIT_MAX; i++) {
    sx[i] = rand(-wxSKIT_R, wxSKIT_R); sz[i] = rand(-wxSKIT_R, wxSKIT_R);
    sy[i] = 0; svy[i] = 0; sph[i] = rand(0, 6.283); ssz[i] = rand(0.75, 1.3); srot[i] = rand(0, 6.283);
  }

  // ---- THE CONTACT RINGS (D5). See the block above wxRING_MAX. ------------
  // The SAME shape props.js's water-entry foam uses — an open-ended cylinder
  // five centimetres tall, which from any camera in this game reads as a ring
  // lying on the surface and, unlike a flat disc, does not disappear when you
  // look along it. Ten sides rather than eight because these are drawn a
  // couple of metres from the lens where a foam ring never is.
  const ringMesh = new THREEx.InstancedMesh(
    new THREEx.CylinderGeometry(1, 1, 0.05, 10, 1, true),
    mat(PALETTE.foam, { transparent: true, opacity: 0.42, depthWrite: false,
                        side: THREEx.DoubleSide }),
    wxRING_MAX);
  ringMesh.instanceMatrix.setUsage(THREEx.DynamicDrawUsage);
  ringMesh.frustumCulled = false;
  ringMesh.castShadow = false;
  ringMesh.receiveShadow = false;
  ringMesh.renderOrder = 5;
  ringMesh.count = 0;
  scene.add(ringMesh);
  const ringLife = new Float32Array(wxRING_MAX);
  const ringX = new Float32Array(wxRING_MAX);
  const ringY = new Float32Array(wxRING_MAX);
  const ringZ = new Float32Array(wxRING_MAX);
  let ringHead = 0, ringDue = 0, ringAny = false;
  // ...and a lift on the pool's opacity for a ring born OUTSIDE the rain
  // (V1.3: a footfall in the shallows, a drip's arrival), which otherwise
  // draws at the dry floor of 0.10 and is not there. Decays on its own.
  let ringBoost = 0;
  // A LIFETIME COUNT, for the audit and for nothing else. The rate is the one
  // number in this block a screenshot cannot settle, and counting births from
  // outside by watching lives reset does not work: a ring is born at 0.52 and
  // is at 0.503 by the next sample, so the first probe that tried it read a
  // rate of zero against a pool that was visibly working.
  let ringBorn = 0;

  // ---- THE GROUND MIST (G3). See the block above wxMIST. -------------------
  // Three sheets, one buffer, eighteen vertices: x/z are the sheet's corners
  // at wxMIST_R, y is the sheet's FRACTION of the band's height and the vertex
  // shader scales it by the live `uH`, so a shower can lift the band without
  // anything here touching a vertex.
  const mistGeo = new THREEx.BufferGeometry();
  {
    const r = wxMIST_R, v = [];
    // WOUND TO FACE UP. Seen from +y with x to the right, +z runs DOWN the
    // screen, so (-r,-r) -> (r,-r) -> (r,r) is clockwise and a FrontSide
    // sheet wound that way faces the floor: the first build drew nothing in
    // any chapter and a red-tint diagnostic with depthTest off was what
    // said so (qa/wow-mist-diag.js). Counter-clockwise from above:
    for (let i = 0; i < wxMIST_LAYERS.length; i++) {
      const y = wxMIST_LAYERS[i];
      v.push(-r, y, -r,  r, y, r,  r, y, -r,   -r, y, -r,  -r, y, r,  r, y, r);
    }
    mistGeo.setAttribute('position', new THREEx.BufferAttribute(new Float32Array(v), 3));
    mistGeo.computeBoundingSphere();
  }
  const mistMat = new THREEx.ShaderMaterial({
    uniforms: {
      uH:      { value: 0.8 },
      uTint:   { value: new THREEx.Color(PALETTE.wxMist) },
      uAlpha:  { value: 0 },
      uDrift:  { value: new THREEx.Vector2() },
      uT:      { value: 0 },
      uCentre: { value: new THREEx.Vector3() },
      uR:      { value: wxMIST_R },
    },
    vertexShader: wxMIST_VERT, fragmentShader: wxMIST_FRAG,
    transparent: true, depthWrite: false, depthTest: true,
    side: THREEx.FrontSide,     // from under the sheet (a dive) there is no mist
    fog: false, lights: false,
  });
  const mistMesh = new THREEx.Mesh(mistGeo, mistMat);
  mistMesh.renderOrder = 8;          // after the motes (6) and the rings (5)
  mistMesh.frustumCulled = false;
  mistMesh.castShadow = false;
  mistMesh.receiveShadow = false;
  mistMesh.visible = false;
  mistMesh.name = 'wxMist';
  scene.add(mistMesh);
  let mistRow = null;                // the live wxMIST row, or null
  let mistY = 0;                     // the band's floor, damped
  let mistYSet = false;              // ...and whether it has been seeded yet

  /** Point the band at a chapter's row: colour written once, not per frame. */
  function wxMistTo(n) {
    mistRow = wxMIST[n] || null;
    mistYSet = false;
    mistMat.uniforms.uDrift.value.set(0, 0);
    if (mistRow) mistMat.uniforms.uTint.value.set(mistRow.tint);
    mistMesh.visible = false;        // the step below turns it on
  }

  /** The floor the band sits on: water first, then terrain, under the animal. */
  function wxMistGround(x, z) {
    const api = wxApiOf(game);
    let y;
    if (api && typeof api.isOverWater === 'function' && api.isOverWater(x, z)) {
      y = waterYAt(api, x, z, 0);
    } else if (api && typeof api.terrainHeight === 'function') {
      y = api.terrainHeight(x, z);
    } else {
      y = 0;
    }
    return (typeof y === 'number' && y === y) ? y : 0;
  }

  function wxMistStep(dt) {
    const capy = game.capy;
    const p = capy && capy.position;
    const rung = (game.state && game.state.perfRung) | 0;
    const on = !!mistRow && !!p && !(game.state && game.state.noMist) && rung < 1;
    if (!on) { mistMesh.visible = false; return; }
    // The floor. Damped, so a kerb is not a step in the band, and held where
    // it was when the animal is well above the ground — a jump off the Drift's
    // shelf must not drag the whole band into the void after it.
    const gy = wxMistGround(p.x, p.z);
    if (!mistYSet) { mistY = gy; mistYSet = true; }
    else if (p.y - gy < wxMIST_ABOVE) mistY = damp(mistY, gy, wxMIST_FOLLOW, dt);
    mistMesh.position.set(p.x, mistY + 0.02, p.z);
    const u = mistMat.uniforms;
    u.uCentre.value.set(p.x, mistY, p.z);
    // The pattern rides the gust, and boils a little on its own in still air
    // (the second and third octaves move on uT as well). Under
    // prefers-reduced-motion it holds still: a drifting field is motion.
    if (!wxCalm()) {
      const k = mistRow.drift;
      u.uDrift.value.x += (wxGust.x * k + Math.sin(wxT * 0.11) * wxMIST_BREATH) * dt;
      u.uDrift.value.y += (wxGust.z * k + Math.cos(wxT * 0.09) * wxMIST_BREATH) * dt;
      u.uT.value = wxT;
    }
    // A shower raises it — the rain rows' own line in the roadmap — and a
    // tide row scales it by where the water is between its two marks.
    let a = mistRow.alpha * (1 + rainT * wxMIST_RAIN);
    if (mistRow.tide) {
      const api = wxApiOf(game);
      const wl = api && typeof api.waterLevel === 'number' ? api.waterLevel : mistRow.tide[0];
      a *= 0.6 + 0.4 * clamp((wl - mistRow.tide[0]) / (mistRow.tide[1] - mistRow.tide[0]), 0, 1);
    }
    u.uAlpha.value = clamp(a, 0, 4);   // an optical depth, not a coverage
    u.uH.value = mistRow.h * (1 + rainT * wxMIST_RAIN_H);
    mistMesh.visible = true;
  }

  // Per-instance state. Allocated once, at max, for both fields.
  const mx = new Float32Array(wxMOTE_MAX), my = new Float32Array(wxMOTE_MAX),
        mz = new Float32Array(wxMOTE_MAX), mph = new Float32Array(wxMOTE_MAX),
        msp = new Float32Array(wxMOTE_MAX), msz = new Float32Array(wxMOTE_MAX);
  const rx = new Float32Array(wxRAIN_MAX), ry = new Float32Array(wxRAIN_MAX),
        rz = new Float32Array(wxRAIN_MAX);
  const anchor = new THREEx.Vector3();
  let kind = null;                  // the live wxKIND row, or null
  let moteN = 0;                    // ...and how many instances the row draws
  // ---- THE BURST'S OWN STATE (V1.3). See the block above wxBURST_MAX. ----
  // Allocated once; a slot is live while blife > 0. `bfloor` is the height
  // the quad dies at (the ground under it, or the surface a bubble reaches),
  // resolved at birth so the loop never asks the biome anything.
  const bx = new Float32Array(wxBURST_MAX), by = new Float32Array(wxBURST_MAX),
        bz = new Float32Array(wxBURST_MAX), bvx = new Float32Array(wxBURST_MAX),
        bvy = new Float32Array(wxBURST_MAX), bvz = new Float32Array(wxBURST_MAX),
        blife = new Float32Array(wxBURST_MAX), blife0 = new Float32Array(wxBURST_MAX),
        bsz = new Float32Array(wxBURST_MAX), bph = new Float32Array(wxBURST_MAX),
        bfloor = new Float32Array(wxBURST_MAX);
  const bkind = new Array(wxBURST_MAX).fill(null);
  let burstHead = 0, burstHi = 0, burstBorn = 0;   // next slot, live extent, lifetime count

  for (let i = 0; i < wxMOTE_MAX; i++) {
    mx[i] = rand(-wxBOX_R, wxBOX_R); my[i] = rand(-wxBOX_H, wxBOX_H);
    mz[i] = rand(-wxBOX_R, wxBOX_R);
    mph[i] = rand(0, 6.283); msp[i] = rand(0.7, 1.35); msz[i] = rand(0.72, 1.3);
  }
  for (let i = 0; i < wxRAIN_MAX; i++) {
    rx[i] = rand(-wxRAIN_BOX_R, wxRAIN_BOX_R); ry[i] = rand(-wxRAIN_BOX_H, wxRAIN_BOX_H);
    rz[i] = rand(-wxRAIN_BOX_R, wxRAIN_BOX_R);
  }

  /** Point the mote field at a row's emitter. Colours are written ONCE here,
   *  not per frame — an instanceColor upload every frame for a field that
   *  never changes colour is the sort of cost that only shows up on a laptop. */
  function wxFieldTo(rw) {
    moteQuad.count = 0; moteTetra.count = 0;
    kind = null; moteN = 0;
    // ...and the bursts die with the row: a puff of Palawan's sand must not
    // finish its arc over Antarctic snow (the rings' own rule).
    for (let i = 0; i < wxBURST_MAX; i++) blife[i] = 0;
    burstHi = 0;
    const mo = rw && rw.motes;
    if (!mo) return;
    const k = wxKIND[mo.kind];
    if (!k) return;
    kind = k;
    kind._sizeK = mo.sizeK;
    moteMesh = (k.geo === 'tetra') ? moteTetra : moteQuad;
    const n = Math.min(wxMOTE_MAX, Math.max(0, Math.round(k.n * mo.density)));
    moteMesh.count = n; moteN = n;
    if (!moteMesh.instanceColor && n > 0) {
      moteMesh.instanceColor =
        new THREEx.InstancedBufferAttribute(new Float32Array(wxMOTE_MAX * 3), 3);
    }
    for (let i = 0; i < n; i++) {
      wxCol.set(k.cols[i % k.cols.length]);
      moteMesh.setColorAt(i, wxCol);
    }
    if (moteMesh.instanceColor) moteMesh.instanceColor.needsUpdate = true;
    // ...and the skitter, the same way: colours once, count from the kind.
    skitMesh.count = 0; skit = null;
    const sk = rw && rw.skitter && wxSKIT[rw.skitter.kind];
    if (sk) {
      skit = sk;
      const sn = Math.min(wxSKIT_MAX, sk.n | 0);
      skitMesh.count = sn;
      if (!skitMesh.instanceColor && sn > 0) {
        skitMesh.instanceColor =
          new THREEx.InstancedBufferAttribute(new Float32Array(wxSKIT_MAX * 3), 3);
      }
      for (let i = 0; i < sn; i++) {
        wxCol.set(sk.cols[i % sk.cols.length]);
        skitMesh.setColorAt(i, wxCol);
        sy[i] = 0; svy[i] = 0;
      }
      if (skitMesh.instanceColor) skitMesh.instanceColor.needsUpdate = true;
    }
    // The rain takes its colour from the hour: against a bright sky a streak
    // is paler than the sky, against a dark one it is what the lamps hit.
    const nightish = rw.lock === 'night' || rw.lock === 'predawn' || rw.lock === 'interior';
    wxCol.set(nightish ? PALETTE.wxDrizzleNt : PALETTE.wxDrizzle);
    rainMesh.material.color.copy(wxCol);
  }

  /** A biome change is a hard reset, for exactly the reason atmosPrime is: a
   *  shower that was half over in Kyoto must not be half over in Marrakech,
   *  and a wetness of 0.5 carried across a hemisphere is a wet desert. */
  function wxPrime(to) {
    name = to || 'sydney';
    row = wxMOOD[name] || wxBASE;
    rainT = 0; rainWant = 0; rainAt = 0;
    cloudV = 0; pulseV = 0;
    wet = row.wet;
    thunderAt = 0;
    // THE FRONT IS PER-CHAPTER TOO (L7, F4): a front three minutes from
    // crossing in Kyoto is not a front anybody arriving in Marrakech should
    // inherit — same reasoning as every other reset on this line.
    wxFront = -1; wxFrontT = rand(0, 1) * 60; wxFrontPeriod = rand(360, 540);
    wxFrontFired = false; wxFrontSaid = false; wxFrontSaidAfter = false;
    rainMesh.count = 0;
    // ...and the rings, for the reason the shower itself is reset: a ring
    // expanding on a canal in Venice must not finish its life over a dune.
    for (let i = 0; i < wxRING_MAX; i++) ringLife[i] = 0;
    ringMesh.count = 0;
    ringDue = 0;
    ringAny = false;
    wxFieldTo(row);
    wxMistTo(name);
    // The field must not be dragged across the world from wherever it was.
    const cam = game.camera;
    if (cam) anchor.copy(cam.position);
  }
  wxPrime(name);

  game.events.on('biome:enter', function (e) { wxPrime(e && e.name); });

  // ---- the reads ----------------------------------------------------------
  function drizzle() { return rainT; }
  function cloud() { return cloudV; }
  function pulse() { return pulseV; }
  function wetness() { return wet; }
  /** How splashy a footfall should be.
   *
   *  THE ONE READING THAT USES THE ABSOLUTE RATHER THAN `shine()`, and it is a
   *  deliberate exception rather than the place the rule was forgotten. Slip
   *  changes how a chapter PLAYS and the grade changes how it was TUNED to
   *  look, so both key off the change; a footfall is neither — it is
   *  characterisation, and a wet cave floor in Son Doong or wet paving in
   *  Venice sounding faintly of water underfoot is the thing the brief was
   *  asking for rather than a regression of it. Measured: 0.13 in the cave and
   *  0.17 in Venice at rest, against 0.64 in a Kowloon downpour.
   *
   *  It is still zero below a damp baseline, because a floor that is merely
   *  wet does not splash under every step and a street in a shower does. */
  function splash() {
    return clamp((wet - 0.34) / 0.5, 0, 1) * clamp(0.35 + rainT, 0, 1);
  }
  /** The air this module is moving, in m/s. ADDED to a biome's own wind(),
   *  never a replacement for one — see the Drift's row. */
  function gust() { return wxGust; }
  /** HOW MUCH WETTER THAN NORMAL THIS PLACE IS, 0..1.
   *
   *  Not the same question as `wetness()`, and the difference is the whole
   *  reason both exist. Son Doong's floor is wet limestone at a baseline of
   *  0.52 and Kowloon's asphalt never properly dries; both chapters were
   *  authored, tuned and shipped that way. Anything that CHANGES how a
   *  chapter plays or grades has to key off the change, not off the absolute
   *  — otherwise switching this module on hands Son Doong a permanent 0.20 of
   *  slip it has never had, which is a rebalance of a finished chapter
   *  wearing a weather system's clothes. */
  function shine() { return clamp((wet - row.wet) / 0.55, 0, 1); }

  /** What being wet costs a foot at (x, z). The arguments are there so a
   *  chapter that wants to say "not on my sand" can, through `set`; nothing
   *  in the table uses them yet and the signature is the honest one. */
  function slip() {
    return clamp(shine() * row.slipK, 0, wxSLIP_MAX);
  }
  function mood() { return row; }
  // A CAPTION THAT DOES NOT KNOW THE SUN HAS GONE DOWN. `label()` has exactly
  // one reader — the photo caption — and Cali's row says 'Valley Warm'. But
  // Cali's whole second half is at night: `caliNightT` climbs to 1.0 on the
  // chiva ride, the sky dome, the grade, the fog, the city lights and a find
  // all read it, and a photograph taken from the mirador at midnight was
  // captioned Valley Warm. The mood rows are a table of WEATHER; night is the
  // one thing about a sky that a fixed string cannot carry, so the live biome
  // is asked whether it has gone dark before the row is trusted.
  function label() {
    try {
      const b = game && game.biome;
      if (b && b.isActive('cali') && game.cali && typeof game.cali.night === 'function') {
        const n = game.cali.night();
        if (typeof n === 'number' && n > 0.55) return 'Valley Night';
      }
    } catch (e) { /* a caption is never worth a throw */ }
    return row.label;
  }
  function lock() { return row.lock; }
  /** -1..1, the front's position along the chapter's wind; -1 in a chapter
   *  with no rain at all. See THE FRONT, above `update`. */
  function front() { return wxFront; }
  /** The harness's forcing hook (`hud.front(k)` in systems.js): a number
   *  pins the front there every frame; anything else releases it back to
   *  the weather's own roll. */
  function frontForce(k) { wxFrontForce = (typeof k === 'number') ? k : -2; }
  /** Read-once: true on the one frame the front first commits to crossing
   *  ("here it comes") or first clears past it ("that was the whole of
   *  it") — systems.js polls these once a frame and the read consumes it,
   *  so a caller that never asks never sees the pill fire and dialogue and
   *  toast do not have to agree on whose job it was to reset a shared flag. */
  function frontNear() { const f = wxFrontNearFlag; wxFrontNearFlag = false; return f; }
  function frontPast() { const f = wxFrontPastFlag; wxFrontPastFlag = false; return f; }

  /** The deltas systems.js lays over the atmosphere it has already computed.
   *  Returns a SHARED scratch object — read it, do not keep it. */
  function light() {
    const r = rainT, c = cloudV;
    wxLight.sunK = 1 - r * wxRAIN_SUN - c * wxCLOUD_SUN;
    wxLight.hemiK = (1 - r * wxRAIN_HEMI) * (1 + pulseV);
    wxLight.amb = r * wxRAIN_AMB + c * wxCLOUD_AMB;
    wxLight.fogNK = 1 - r * wxRAIN_FOGN;
    wxLight.fogFK = 1 - r * wxRAIN_FOGF;
    wxLight.hazeMix = r * wxRAIN_HAZE;
    wxLight.bgMix = r * wxRAIN_BG;
    wxLight.hazeHex = PALETTE.wxHazeWet;
    // The grade follows the GROUND, not the sky: a street stays reflective for
    // a minute after the rain stops, which is the best-looking minute of it.
    const sh = shine();
    wxLight.bloom = sh * wxWET_BLOOM;
    wxLight.threshold = sh * wxWET_THRESH;
    wxLight.saturation = sh * wxWET_SAT;
    wxLight.contrast = sh * wxWET_CONT;
    return wxLight;
  }

  /** The six ambient voices, at the level this chapter allows and the
   *  micro-state has earned. systems.js owns every audio node; this owns the
   *  numbers, which is why nothing in this file imports the AudioContext. */
  function bed() {
    const b = row.bed;
    wxBed.rain = b.rain * rainT;
    // Wind is the one voice with a floor: a place with a 4.6 m/s westerly in
    // it is audible standing still, and gusting on top of that is the change.
    const g = Math.sqrt(wxGust.x * wxGust.x + wxGust.z * wxGust.z);
    wxBed.wind = b.wind * clamp(g / 6.5, 0, 1);
    // Crickets stop when it rains. Everybody who has been outside knows this
    // and nobody has ever put it in a game.
    wxBed.chirp = b.chirp * (1 - rainT * 0.85);
    wxBed.drip = b.drip * clamp(wet * 1.2, 0, 1);
    wxBed.rustle = b.rustle * clamp(g / 5.0, 0, 1) * (1 - rainT * 0.4);
    wxBed.thunder = b.thunder * rainT;
    return wxBed;
  }

  /** Override a chapter's row at runtime. Shallow-merged onto the row it
   *  already has, so a caller may pass `{ rain: {...} }` and keep the motes. */
  function set(n, cfg) {
    if (!n || !cfg) return;
    const base = wxMOOD[n] || wxBASE;
    const next = {};
    for (const k in base) next[k] = base[k];
    for (const k in cfg) next[k] = cfg[k];
    wxMOOD[n] = next;
    if (n === name) {
      row = next;
      wxFieldTo(row);
      // A CONFIG CHANGE HAS TO TAKE EFFECT PROMPTLY. `wxFrontT` was seeded
      // against the OLD row's odds on arrival, so a caller that turns rain on
      // for a chapter that had none still waits out a period nothing set —
      // which looks exactly like `set` not working, and is how the first
      // audio soak measured a rain bed of zero after twenty seconds of a
      // forced downpour (L7, F4: the front replaced the old rainNext dice
      // timer this same comment used to describe).
      if (next.rain.odds > 0 && wxFrontT > wxFrontPeriod * 0.5) wxFrontT = wxFrontPeriod * 0.5;
      // ...AND A SHOWER ALREADY IN FLIGHT HAS TO BE RE-FITTED TO THE NEW HOLD.
      // `rainAt` counts down and the envelope reads `1 - rainAt / hold`, so
      // changing the hold under a running shower moves it to a completely
      // different point on its own curve: a set() to hold 400 partway through
      // a 64-second shower put u at 0.84, which is deep in the tail, and the
      // shower measured 0.15 when it should have been near its peak.
      rainAt = Math.min(rainAt, next.rain.hold);
    }
  }

  // ---- the loop -----------------------------------------------------------
  function update(dt) {
    if (!(dt > 0)) return;
    live = !!(game.state && game.state.started) && !(game.state && game.state.paused);
    wxT += dt;

    // ---- 0. THE FRONT (L7, F4) --------------------------------------------
    // Advances only where a shower is possible at all, and only while the
    // game is actually running — a title card is not weather.
    if (row.rain.odds > 0) {
      if (live) wxFrontT += dt;
      if (wxFrontT > wxFrontPeriod) {
        wxFrontT -= wxFrontPeriod; wxFrontPeriod = rand(360, 540);
        wxFrontFired = false; wxFrontSaid = false; wxFrontSaidAfter = false;
      }
      const auto = clamp(wxFrontT / wxFrontPeriod * 2 - 1, -1, 1);
      wxFront = wxFrontForce > -1.5 ? wxFrontForce : auto;
      if (wxFront >= -0.06 && !wxFrontSaid) { wxFrontSaid = true; wxFrontNearFlag = true; }
      if (wxFront >= 0.94 && !wxFrontSaidAfter) { wxFrontSaidAfter = true; wxFrontPastFlag = true; }
    } else {
      wxFront = -1;
    }

    // ---- 1. the shower, CAUSED BY THE FRONT'S CROSSING --------------------
    // This used to be its own dice roll on a timer, independent of the
    // cloud and the gust — four separate rolls for one grey afternoon. The
    // front crossing zero is now the one trigger; row.rain's hold and peak
    // are unchanged, so a chapter that used to see a shower of a given shape
    // still does, just on a schedule the player can watch approach instead
    // of a coin flip nothing announced.
    if (rainAt > 0) {
      rainAt -= dt;
      const u = 1 - rainAt / Math.max(0.001, row.rain.hold);
      rainWant = wxEnvelope(u) * row.rain.peak;
      if (rainAt <= 0) { rainWant = 0; wxFrontFired = false; }
    } else if (row.rain.odds > 0 && wxFront >= 0 && !wxFrontFired) {
      rainAt = row.rain.hold; thunderAt = rand(4, 12); wxFrontFired = true;
    }
    // Damped rather than assigned, so the envelope's own corners are rounded
    // off and a biome change cannot step the rain from 0.7 to 0 in one frame.
    rainT = damp(rainT, rainWant, 0.9, dt);
    if (rainT < 0.0015) rainT = 0;

    // ---- THE FRONT, AHEAD OF ITSELF (L7, F4) ------------------------------
    // Coverage builds as the line approaches and clears once it has passed
    // (frontCloud, a triangle centred on the crossing); the gust's own
    // strength ramps specifically AHEAD of it (frontGust — the wind picking
    // up before the rain it is bringing, 0 at half an excursion out, 1 at
    // the line). shared.js's swayTick turns wxGust's bigger magnitude into
    // the roadmap's swayK 0.4 -> 1.2 on its own; nothing here computes sway.
    const frontOn = row.rain.odds > 0;
    const frontCloud = frontOn ? clamp(1 - Math.abs(wxFront) * 2, 0, 1) : 0;
    const frontGust = frontOn ? clamp(-wxFront * 4, 0, 1) : 0;

    // ---- 2. cloud, pulse, gust -------------------------------------------
    // Under prefers-reduced-motion every oscillator holds at its centre. The
    // shower still happens — it is weather, not motion — but nothing wobbles.
    if (wxCalm()) {
      cloudV = damp(cloudV, frontCloud * wxFRONT_CLOUD, 2, dt); pulseV = damp(pulseV, 0, 2, dt);
      const gm = 1 + frontGust * (wxFRONT_GUST - 1);
      wxGust.x = damp(wxGust.x, Math.sin(row.dir) * row.gust.base * gm, 2, dt);
      wxGust.z = damp(wxGust.z, Math.cos(row.dir) * row.gust.base * gm, 2, dt);
    } else {
      // Half-wave rectified: a cloud either is in front of the sun or is not,
      // and there is no such thing as negative shadow.
      const cw = Math.min(1, Math.max(0, wxOsc(wxT, 0.021, 0.0)) * row.cloudK + frontCloud * wxFRONT_CLOUD);
      cloudV = damp(cloudV, cw, 1.6, dt);
      pulseV = damp(pulseV, wxOsc(wxT, 0.037, 1.7) * row.pulseK * wxPULSE_HEMI, 1.1, dt);
      // The gust swings the HEADING as well as the speed, or a "wind shift" is
      // just a volume knob on a fan.
      const sw = wxOsc(wxT, row.gust.hz, 3.1);
      const th = row.dir + sw * 0.55;
      const sp = (row.gust.base + wxOsc(wxT, row.gust.hz * 1.63, 5.5) * row.gust.swing) * (1 + frontGust * (wxFRONT_GUST - 1));
      wxGust.x = damp(wxGust.x, Math.sin(th) * sp, 1.4, dt);
      wxGust.z = damp(wxGust.z, Math.cos(th) * sp, 1.4, dt);
    }

    // ---- 3. the ground gets wet, and stays wet ---------------------------
    // Asymmetric on purpose: twelve seconds to soak and about a minute to dry,
    // which is what leaves the reflective street standing after the shower has
    // gone. A place whose baseline is 0.52 never dries BELOW 0.52.
    const wetWant = Math.max(row.wet, rainT);
    if (wetWant > wet) wet = clamp(damp(wet, wetWant, wxWET_RISE, dt), 0, 1);
    else wet = Math.max(row.wet, wet - wxWET_DRY * dt);

    // ---- 4. distant thunder ----------------------------------------------
    // One per shower at most, and only in a chapter whose bed allows one. It
    // is fired through game.sfx like everything else, so the throttle, the
    // pause gate and the mute all already apply to it.
    if (thunderAt > 0 && rainT > row.rain.peak * 0.55 && row.bed.thunder > 0.05) {
      thunderAt -= dt;
      if (thunderAt <= 0 && live && game.sfx) {
        game.sfx('thunder', { volume: 0.30 + row.bed.thunder * 0.5 });
        thunderAt = 0;
      }
    }

    // ---- 5. the fields ---------------------------------------------------
    wxStepFields(dt);
    // ---- 6. the ground mist (G3) -----------------------------------------
    wxMistStep(dt);
  }

  function wxStepFields(dt) {
    const cam = game.camera;
    if (!cam) return;
    // The field follows the LENS, damped, and sits a little in front of it.
    // Following the animal puts the motes behind the camera at every turn, and
    // snapping to the lens makes the whole field lurch when the rig does.
    cam.getWorldDirection(wxFwd);
    anchor.x = damp(anchor.x, cam.position.x + wxFwd.x * wxBOX_R * wxAHEAD, wxFOLLOW_LAM, dt);
    anchor.y = damp(anchor.y, cam.position.y + wxFwd.y * wxBOX_H * wxAHEAD, wxFOLLOW_LAM, dt);
    anchor.z = damp(anchor.z, cam.position.z + wxFwd.z * wxBOX_R * wxAHEAD, wxFOLLOW_LAM, dt);

    const gx = wxGust.x, gz = wxGust.z;

    // ---- the motes -------------------------------------------------------
    if (kind && moteN > 0) {
      const n = moteN;
      const sizeK = kind._sizeK || 1;
      const wk = kind.windK, fall = kind.fall, sway = kind.sway;
      const swayW = kind.swayHz * 6.28318, spin = kind.spin, blink = kind.blink;
      const still = wxCalm() ? 0.15 : 1;
      for (let i = 0; i < n; i++) {
        const ph = mph[i], sp = msp[i];
        mx[i] += (gx * wk * 0.25 + Math.sin(wxT * swayW * sp + ph) * sway * still) * dt;
        mz[i] += (gz * wk * 0.25 + Math.cos(wxT * swayW * sp * 0.83 + ph) * sway * still) * dt;
        my[i] -= fall * sp * dt;
        // Wrap. A modulo into the box, so the field is seamless and infinite
        // and nothing is ever spawned or destroyed.
        if (mx[i] > wxBOX_R) mx[i] -= wxBOX_R * 2; else if (mx[i] < -wxBOX_R) mx[i] += wxBOX_R * 2;
        if (mz[i] > wxBOX_R) mz[i] -= wxBOX_R * 2; else if (mz[i] < -wxBOX_R) mz[i] += wxBOX_R * 2;
        if (my[i] > wxBOX_H) my[i] -= wxBOX_H * 2; else if (my[i] < -wxBOX_H) my[i] += wxBOX_H * 2;
        // A firefly blinks by going to nothing and coming back, which is what
        // one actually does, and it costs nothing because the scale is in a
        // matrix that is being written anyway.
        let s = msz[i] * kind.size * sizeK;
        if (blink > 0) {
          const b = Math.sin(wxT * (0.9 + sp * 0.7) + ph * 2.3);
          s *= 1 - blink * clamp(0.5 - b * 0.5, 0, 1);
        }
        wxV1.set(anchor.x + mx[i], anchor.y + my[i], anchor.z + mz[i]);
        wxE1.set(wxT * spin * sp + ph, ph * 1.7, wxT * spin * sp * 0.61 + ph * 0.4);
        wxQ1.setFromEuler(wxE1);
        wxS1.set(s, s, s);
        wxM1.compose(wxV1, wxQ1, wxS1);
        moteMesh.setMatrixAt(i, wxM1);
      }
      moteMesh.instanceMatrix.needsUpdate = true;
    }
    // ---- the bursts (V1.3). See the block above wxBURST_MAX. -------------
    wxStepBursts(dt);

    // ---- the skitter (Part B). See the block above wxSKIT. ---------------
    // Horizontally it is the motes' box — it follows the lens and wraps, so
    // the petals are always in the frame the lens is looking at. Vertically
    // it is the GROUND: each petal's y is the biome's floor under it (the
    // mist's own query — water first, then terrain, else 0) plus its hop.
    // Lying, a petal is flat and still; a gust over `gustMin` gives each one
    // `odds` a second of being kicked up `lift`, after which it tumbles
    // downwind at `windK` and falls at `fall` until it lies down again. A
    // calm chapter (reduced motion) skips the kicks and lets what is up land.
    skitFlying = 0;
    const skitOn = skit && skitMesh.count > 0 && !(game.state && game.state.noSkitter);
    skitMesh.visible = !!skitOn;
    if (skitOn) {
      const n = skitMesh.count;
      const gm = Math.hypot(gx, gz);
      const kick = wxCalm() ? 0 : clamp((gm - skit.gustMin) / 1.5, 0, 1) * skit.odds * dt;
      const wk = skit.windK;
      for (let i = 0; i < n; i++) {
        const ph = sph[i];
        if (sy[i] <= 0) {
          if (kick > 0 && Math.random() < kick) { svy[i] = skit.lift * rand(0.55, 1.0); sy[i] = 0.001; }
        } else {
          sx[i] += (gx * wk + Math.sin(wxT * 3.1 + ph) * 0.35) * dt;
          sz[i] += (gz * wk + Math.cos(wxT * 2.7 + ph * 1.3) * 0.35) * dt;
          svy[i] = Math.max(svy[i] - 5.5 * dt, -skit.fall);
          sy[i] += svy[i] * dt;
          srot[i] += dt * (2.2 + ph * 0.3);
          if (sy[i] <= 0) { sy[i] = 0; svy[i] = 0; } else skitFlying++;
        }
        if (sx[i] > wxSKIT_R) sx[i] -= wxSKIT_R * 2; else if (sx[i] < -wxSKIT_R) sx[i] += wxSKIT_R * 2;
        if (sz[i] > wxSKIT_R) sz[i] -= wxSKIT_R * 2; else if (sz[i] < -wxSKIT_R) sz[i] += wxSKIT_R * 2;
        const wx = anchor.x + sx[i], wz = anchor.z + sz[i];
        const s = ssz[i] * skit.size;
        wxV1.set(wx, wxMistGround(wx, wz) + 0.012 + sy[i], wz);
        // lying: flat, turned about y only; flying: tumbling
        if (sy[i] > 0) wxE1.set(srot[i], ph, srot[i] * 0.61);
        else wxE1.set(0, ph + srot[i], 0);
        wxQ1.setFromEuler(wxE1);
        wxS1.set(s, s, s);
        wxM1.compose(wxV1, wxQ1, wxS1);
        skitMesh.setMatrixAt(i, wxM1);
      }
      skitMesh.instanceMatrix.needsUpdate = true;
    }

    // ---- the rain --------------------------------------------------------
    // The count scales with the intensity, so a shower ARRIVES rather than
    // switching on: at 0.1 there are twenty streaks in twenty metres, which is
    // exactly what the first of it looks like.
    const want = rainT <= 0.01 ? 0 : Math.round(wxRAIN_MAX * clamp(rainT * 1.15, 0, 1));
    rainMesh.count = want;
    if (want > 0) {
      const fallV = wxRAIN_FALL * (0.55 + rainT * 0.45);
      // Rain is BLOWN. A vertical streak in a 4 m/s wind is the tell that a
      // weather system was bolted on rather than wired in.
      const dx = gx * 0.30, dz = gz * 0.30;
      // A STREAK POINTS THE WAY IT IS FALLING, and getting that from Euler
      // angles was wrong: the shared quad lies in the XZ plane, so scaling its
      // Z by the streak length and rotating about Y and Z left every drop
      // lying FLAT, and the first shower rendered as a field of white dashes
      // hanging in the air like tally marks. The local +Z axis is turned onto
      // the fall vector directly, which cannot be got the wrong way round.
      wxFall.set(dx, -fallV, dz).normalize();
      wxQ1.setFromUnitVectors(wxZAX, wxFall);
      const len = wxRAIN_LEN * (0.6 + rainT * 0.7);
      wxS1.set(0.017, 0.017, len);
      for (let i = 0; i < want; i++) {
        rx[i] += dx * dt; rz[i] += dz * dt; ry[i] -= fallV * dt;
        if (rx[i] > wxRAIN_BOX_R) rx[i] -= wxRAIN_BOX_R * 2; else if (rx[i] < -wxRAIN_BOX_R) rx[i] += wxRAIN_BOX_R * 2;
        if (rz[i] > wxRAIN_BOX_R) rz[i] -= wxRAIN_BOX_R * 2; else if (rz[i] < -wxRAIN_BOX_R) rz[i] += wxRAIN_BOX_R * 2;
        if (ry[i] < -wxRAIN_BOX_H) ry[i] += wxRAIN_BOX_H * 2;
        wxV1.set(anchor.x + rx[i], anchor.y + ry[i], anchor.z + rz[i]);
        wxM1.compose(wxV1, wxQ1, wxS1);
        rainMesh.setMatrixAt(i, wxM1);
      }
      rainMesh.instanceMatrix.needsUpdate = true;
      rainMesh.material.opacity = clamp(0.16 + rainT * 0.34, 0, 0.50);
    }

    // ---- ...AND WHERE IT LANDS (D5) --------------------------------------
    wxStepRings(dt);
  }

  /**
   * WHERE A DROP ARRIVES. See the block above wxRING_MAX.
   *
   * Around the ANIMAL and not around the lens, which is the one placement
   * decision in here. The rain field itself follows the camera because a
   * streak is something you look THROUGH; a ring is something you look AT, and
   * the thing the player is looking at is three metres in front of a capybara.
   * A six-metre disc centred on the eye would put a third of them behind the
   * boom and the rest at the top of the frame.
   */
  function wxStepRings(dt) {
    const capy = game.capy;
    const p = capy && capy.position;
    // No animal (the title card, a crossing) and no rain: nothing to do, and
    // the pool is left exactly as the last frame drew it — count 0.
    if (rainT > 0.02 && p) {
      ringDue -= dt * (wxRING_RATE0 + (wxRING_RATE1 - wxRING_RATE0) * clamp(rainT, 0, 1));
      // A WHILE, NOT AN IF: at ten a second a 30 ms frame owes 0.3 of a ring
      // and a 300 ms hitch owes three, and an `if` silently caps the rate at
      // one per frame — which is the same rate at 60 Hz and a quarter of it
      // during the physics catch-up after a chapter loads.
      while (ringDue <= 0) {
        ringDue += 1;
        wxRingAt(p.x, p.z, capy);
      }
    }
    if (!ringAny) return;
    // Cleared here and set again by any ring that is still alive below, so the
    // frame AFTER the last one dies writes the parked matrices once and then
    // this function costs a compare for the rest of the chapter.
    ringAny = false;
    for (let i = 0; i < wxRING_MAX; i++) {
      if (ringLife[i] <= 0) {
        // Parked a mile down rather than scaled to nothing: a zero-scale
        // instance still has a matrix and three still transforms it, and a
        // degenerate one at the origin is a black speck in the middle of
        // Sydney Cove the day a driver decides 0 * inf is a NaN.
        wxV1.set(0, -900, 0);
        wxS1.set(0.0001, 0.0001, 0.0001);
        wxM1.compose(wxV1, wxQ1.set(0, 0, 0, 1), wxS1);
        ringMesh.setMatrixAt(i, wxM1);
        continue;
      }
      ringLife[i] -= dt;
      ringAny = true;
      const t = clamp(1 - ringLife[i] / wxRING_LIFE, 0, 1);
      // SQUARE-ROOT, not linear. A ring on water is fast out of the impact and
      // then slows, and a linear expansion reads as a circle being drawn
      // rather than as something arriving.
      const r = wxRING_R0 + (wxRING_R1 - wxRING_R0) * Math.sqrt(t);
      wxV1.set(ringX[i], ringY[i], ringZ[i]);
      wxS1.set(r, 1, r);
      wxM1.compose(wxV1, wxQ1.set(0, 0, 0, 1), wxS1);
      ringMesh.setMatrixAt(i, wxM1);
    }
    ringMesh.count = ringAny ? wxRING_MAX : 0;
    ringMesh.instanceMatrix.needsUpdate = true;
    // The whole pool fades with the shower rather than each ring fading on its
    // own clock: one opacity write against twelve instance colours, and a ring
    // that is still bright when the last drop falls is the tell that this was
    // bolted on to the rain rather than driven by it.
    ringMesh.material.opacity = clamp(0.10 + rainT * 0.34, 0, 0.44);
    if (ringBoost > 0) {
      ringBoost -= dt * 1.4;
      const b = 0.36 * clamp(ringBoost, 0, 1);
      if (b > ringMesh.material.opacity) ringMesh.material.opacity = b;
    }
  }

  /**
   * ONE RING, EXACTLY HERE (V1.3): a footfall in the shallows, a drip
   * arriving, a stroke. The rain's own ring with the disc's scatter taken
   * off and the pool's opacity lifted (see ringBoost). `o.y` places it on a
   * surface the caller knows better than the floor query does.
   */
  function ringHere(x, z, o) {
    if (!live || (((game.state && game.state.perfRung) | 0) >= 1)) return false;
    const y = (o && typeof o.y === 'number') ? o.y : wxFloorAt(x, z, game.capy);
    const i = ringHead;
    ringHead = (ringHead + 1) % wxRING_MAX;
    ringX[i] = x; ringY[i] = y + 0.03; ringZ[i] = z;
    ringLife[i] = wxRING_LIFE;
    ringBorn++;
    ringAny = true;
    ringBoost = 1;
    return true;
  }

  /**
   * THE FLOOR UNDER A POINT, the way a ring finds it: the live water surface
   * first, then the terrain, then zero (Sydney); and if the animal is standing
   * on something the terrain has never heard of — a deck, a raft, a bridge —
   * that, for anything near its feet. `capy` may be null.
   */
  function wxFloorAt(x, z, capy) {
    const api = wxApiOf(game);
    let y;
    if (api && typeof api.isOverWater === 'function' && api.isOverWater(x, z)) {
      y = waterYAt(api, x, z, 0);
    } else if (api && typeof api.terrainHeight === 'function') {
      y = api.terrainHeight(x, z);
    } else {
      y = 0;
    }
    if (typeof y !== 'number' || y !== y) y = 0;
    if (capy && capy.grounded && capy.position) {
      const foot = capy.position.y - wxFOOT_Y;
      const dx = capy.position.x - x, dz = capy.position.z - z;
      if (foot - y > wxDECK_UP && dx * dx + dz * dz < 4) y = foot;
    }
    return y;
  }

  /**
   * A BURST (V1.3): `n` quads of `kind` thrown from (x, floor, z) — or from
   * `o.y` when the caller says where (a drip off a belly, a bubble off a
   * diver) — on the mote field's own buffer above the live row. Returns how
   * many were born, which is `n` unless the quarter rule, the governor
   * (parked at rung 1 like the mist), the title card or an unknown kind says
   * fewer. `o.color` is a hex for a kind with no colours of its own (leaf);
   * `o.top` is the height a rising kind dies at (a bubble at the surface).
   * Allocates nothing after the first call in a chapter.
   */
  function burst(x, z, kindName, n, o) {
    const k = wxBURST[kindName];
    if (!k || !(n > 0) || !live) return 0;
    if (((game.state && game.state.perfRung) | 0) >= 1) return 0;
    const base = moteMesh === moteQuad ? moteN : 0;
    const cap = Math.min(wxBURST_MAX, wxMOTE_MAX - base);
    if (cap <= 0) return 0;
    if (!moteQuad.instanceColor) {
      moteQuad.instanceColor =
        new THREEx.InstancedBufferAttribute(new Float32Array(wxMOTE_MAX * 3), 3);
    }
    const capy = game.capy;
    const floor = (o && typeof o.floor === 'number') ? o.floor : wxFloorAt(x, z, capy);
    const y0 = (o && typeof o.y === 'number') ? o.y : floor + 0.03;
    const cols = k.cols || null;
    if (!cols) wxCol.set(o && o.color !== undefined ? o.color : PALETTE.leafPale);
    let born = 0;
    for (let j = 0; j < n && j < cap; j++) {
      const i = burstHead;
      burstHead = (burstHead + 1) % cap;
      const a = rand(0, 6.28318), out = k.out * rand(0.35, 1);
      bx[i] = x + Math.cos(a) * 0.04; bz[i] = z + Math.sin(a) * 0.04; by[i] = y0;
      bvx[i] = Math.cos(a) * out; bvz[i] = Math.sin(a) * out;
      bvy[i] = k.up * rand(0.6, 1.15);
      blife0[i] = blife[i] = k.life * rand(0.7, 1.1);
      bsz[i] = k.size * rand(0.75, 1.3);
      bph[i] = rand(0, 6.283);
      bfloor[i] = k.grav < 0 ? ((o && typeof o.top === 'number') ? o.top : y0 + 2) : floor;
      bkind[i] = k;
      if (cols) wxCol.set(cols[(burstBorn + j) % cols.length]);
      moteQuad.setColorAt(base + i, wxCol);
      if (i + 1 > burstHi) burstHi = i + 1;
      born++;
    }
    if (born > 0) { burstBorn += born; moteQuad.instanceColor.needsUpdate = true; }
    return born;
  }

  /** The bursts' frame. A compare when none is live; otherwise an integrate
   *  and a matrix per live slot, and the quad mesh's count set to the row's
   *  instances plus the live extent. */
  function wxStepBursts(dt) {
    const base = moteMesh === moteQuad ? moteN : 0;
    if (burstHi <= 0) {
      if (moteQuad.count !== base) moteQuad.count = base;
      return;
    }
    let hi = 0;
    for (let i = 0; i < burstHi; i++) {
      if (blife[i] <= 0) {
        wxV1.set(0, -900, 0); wxS1.set(0.0001, 0.0001, 0.0001);
        wxM1.compose(wxV1, wxQ1.set(0, 0, 0, 1), wxS1);
        moteQuad.setMatrixAt(base + i, wxM1);
        continue;
      }
      const k = bkind[i];
      blife[i] -= dt;
      // the throw: gravity (negative for a bubble), the air's drag, the gust
      const dr = 1 - Math.min(1, k.drag * dt);
      bvy[i] = (bvy[i] - k.grav * dt) * dr;
      bvx[i] = bvx[i] * dr + wxGust.x * 0.08 * dt;
      bvz[i] = bvz[i] * dr + wxGust.z * 0.08 * dt;
      bx[i] += bvx[i] * dt; by[i] += bvy[i] * dt; bz[i] += bvz[i] * dt;
      // dead on the floor (or, rising, at the surface) — a drip does not
      // hang under the ground, and a bubble does not leave the water
      if (k.grav >= 0 ? by[i] <= bfloor[i] : by[i] >= bfloor[i]) { blife[i] = 0; continue; }
      hi = i + 1;
      // the size: full for most of the life, gone over the last third — the
      // quads are opaque, so a shrink is the only fade there is
      const t = blife[i] / blife0[i];
      const s = bsz[i] * (t < 0.33 ? t / 0.33 : 1);
      wxV1.set(bx[i], by[i], bz[i]);
      wxE1.set(wxT * k.spin + bph[i], bph[i] * 1.7, wxT * k.spin * 0.61 + bph[i] * 0.4);
      wxQ1.setFromEuler(wxE1);
      wxS1.set(s, s, s);
      wxM1.compose(wxV1, wxQ1, wxS1);
      moteQuad.setMatrixAt(base + i, wxM1);
    }
    burstHi = hi;
    moteQuad.count = base + hi;
    moteQuad.instanceMatrix.needsUpdate = true;
  }

  /** One ring, somewhere in the disc, on whatever surface is under that point. */
  function wxRingAt(cx, cz, capy) {
    // Uniform over the AREA — a uniform radius piles two thirds of them into
    // the middle ninth of the disc, which reads as a puddle rather than rain.
    const a = rand(0, 6.28318), rr = Math.sqrt(rand(0, 1)) * wxRING_R;
    const x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr;
    const api = wxApiOf(game);
    let y;
    // WATER FIRST, and its live surface rather than its still level: a ring
    // pinned to waterLevel in Manly or Iceland spends a third of its life
    // inside the swell, which is the bug physFoamRing's own comment records.
    if (api && typeof api.isOverWater === 'function' && api.isOverWater(x, z)) {
      y = waterYAt(api, x, z, 0);
    } else if (api && typeof api.terrainHeight === 'function') {
      y = api.terrainHeight(x, z);
    } else {
      y = 0;                          // Sydney, which is flat at zero by contract
    }
    if (typeof y !== 'number' || y !== y) y = 0;
    // ...AND IF THE ANIMAL IS STANDING ON SOMETHING, SO IS THE RAIN. A deck, a
    // jetty, a bridge and a raft are all rigid bodies the terrain function has
    // never heard of, and without this the whole field lands in the water
    // underneath the ferry you are riding.
    if (capy.grounded) {
      const foot = capy.position.y - wxFOOT_Y;
      if (foot - y > wxDECK_UP) y = foot;
    }
    const i = ringHead;
    ringHead = (ringHead + 1) % wxRING_MAX;
    ringX[i] = x; ringY[i] = y + 0.03; ringZ[i] = z;
    ringLife[i] = wxRING_LIFE;
    ringBorn++;
    ringAny = true;
  }

  const api = {
    mood: mood, label: label, lock: lock,
    drizzle: drizzle, cloud: cloud, pulse: pulse,
    gust: gust, wetness: wetness, slip: slip, splash: splash, shine: shine,
    front: front, frontForce: frontForce, frontNear: frontNear, frontPast: frontPast,
    light: light, bed: bed, set: set,
    /** For the QA harness and for nothing else: what the table says about a
     *  place without having to be standing in it. */
    rowOf(n) { return wxMOOD[n] || wxBASE; },
    /** ...and the ground mist (G3): the live row, whether the band is drawn
     *  this frame, where its floor is and what it is at. */
    /** For the harness: re-tune a chapter's mist row live (shallow merge;
     *  `tint` may be a hex). The shipped rows are PALETTE entries. */
    mistSet(n, cfg) {
      if (!n || !cfg) return;
      const base = wxMIST[n] || { h: 0.8, alpha: 0, drift: 1, tint: PALETTE.wxMist };
      const next = {};
      for (const k in base) next[k] = base[k];
      for (const k in cfg) next[k] = cfg[k];
      wxMIST[n] = next;
      if (n === name) wxMistTo(name);
    },
    /** The skitter (Part B): the live kind, how many petals, how many in the
     *  air, the gust they are riding, and the mesh for a probe's count. */
    skitterAudit() {
      return { kind: skit ? (row.skitter && row.skitter.kind) : null, n: skitMesh.count,
               flying: skitFlying, visible: skitMesh.visible,
               gust: [+wxGust.x.toFixed(2), +wxGust.z.toFixed(2)], mesh: skitMesh };
    },
    mistAudit() {
      const u = mistMat.uniforms;
      return { row: mistRow ? (wxMIST[name] === mistRow ? name : '?') : null,
               visible: mistMesh.visible, y: +mistY.toFixed(3),
               alpha: +u.uAlpha.value.toFixed(3), h: +u.uH.value.toFixed(3),
               drift: [+u.uDrift.value.x.toFixed(2), +u.uDrift.value.y.toFixed(2)],
               rainT: +rainT.toFixed(3) };
    },
    /**
     * ...and the same for the contact rings (D5). How many are alive, what the
     * pool is drawing, and each live ring's height ABOVE the surface the biome
     * says is under it — which is the one number that says whether a ring
     * landed on the ferry deck or in the water beneath it, and is not
     * something a screenshot of a shower can settle.
     */
    /** THE BURST (V1.3) and the ring at a point, for the footfall (capybara.js),
     *  the drips, and V4/V5's callers: `burst(x, z, kind, n, o)`,
     *  `ringHere(x, z, o)`. See the block above wxBURST_MAX. */
    burst: burst,
    ringHere: ringHere,
    /** ...and its audit: live slots, the lifetime count, where the slots sit. */
    burstAudit() {
      let alive = 0;
      for (let i = 0; i < wxBURST_MAX; i++) if (blife[i] > 0) alive++;
      return { alive, hi: burstHi, born: burstBorn, base: moteMesh === moteQuad ? moteN : 0,
               max: wxBURST_MAX, count: moteQuad.count, rowN: moteN, mesh: moteQuad };
    },
    ringAudit() {
      const rows = [];
      const api = wxApiOf(game);
      for (let i = 0; i < wxRING_MAX; i++) {
        if (ringLife[i] <= 0) continue;
        let s = 0;
        if (api && typeof api.isOverWater === 'function' && api.isOverWater(ringX[i], ringZ[i])) {
          s = waterYAt(api, ringX[i], ringZ[i], 0);
        } else if (api && typeof api.terrainHeight === 'function') {
          s = api.terrainHeight(ringX[i], ringZ[i]);
        }
        if (typeof s !== 'number' || s !== s) s = 0;
        rows.push({ life: +ringLife[i].toFixed(3), y: +ringY[i].toFixed(3),
                    over: +(ringY[i] - s).toFixed(3) });
      }
      return { alive: rows.length, born: ringBorn, count: ringMesh.count, max: wxRING_MAX,
               opacity: +ringMesh.material.opacity.toFixed(3), rainT: +rainT.toFixed(3),
               rings: rows };
    },
    update: update,
  };
  game.weather = api;
  return api;
}
