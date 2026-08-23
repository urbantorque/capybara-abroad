import * as THREE from 'three';
import { PALETTE, mat, rand, clamp, damp } from './shared.js';

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

// Read once, exactly as sysCalmMotion is. Everything decorative that loops for
// ever has to check this, and a field of two hundred tumbling petals is the
// most decorative thing in the game.
const wxCalm = !!(typeof window !== 'undefined' && window.matchMedia &&
                  window.matchMedia('(prefers-reduced-motion: reduce)').matches);

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
const wxFwd = new THREE.Vector3();
const wxZAX = new THREE.Vector3(0, 0, 1);
const wxFall = new THREE.Vector3();

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
  let rainNext = rand(8, 26);     // s until the next roll of the dice
  let cloudV = 0, pulseV = 0;
  let wet = row.wet;
  let thunderAt = 0;              // s until this shower is allowed a rumble
  let live = true;                // false while the title card is up

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

  // Per-instance state. Allocated once, at max, for both fields.
  const mx = new Float32Array(wxMOTE_MAX), my = new Float32Array(wxMOTE_MAX),
        mz = new Float32Array(wxMOTE_MAX), mph = new Float32Array(wxMOTE_MAX),
        msp = new Float32Array(wxMOTE_MAX), msz = new Float32Array(wxMOTE_MAX);
  const rx = new Float32Array(wxRAIN_MAX), ry = new Float32Array(wxRAIN_MAX),
        rz = new Float32Array(wxRAIN_MAX);
  const anchor = new THREEx.Vector3();
  let kind = null;                  // the live wxKIND row, or null

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
    kind = null;
    const mo = rw && rw.motes;
    if (!mo) return;
    const k = wxKIND[mo.kind];
    if (!k) return;
    kind = k;
    kind._sizeK = mo.sizeK;
    moteMesh = (k.geo === 'tetra') ? moteTetra : moteQuad;
    const n = Math.min(wxMOTE_MAX, Math.max(0, Math.round(k.n * mo.density)));
    moteMesh.count = n;
    if (!moteMesh.instanceColor && n > 0) {
      moteMesh.instanceColor =
        new THREEx.InstancedBufferAttribute(new Float32Array(wxMOTE_MAX * 3), 3);
    }
    for (let i = 0; i < n; i++) {
      wxCol.set(k.cols[i % k.cols.length]);
      moteMesh.setColorAt(i, wxCol);
    }
    if (moteMesh.instanceColor) moteMesh.instanceColor.needsUpdate = true;
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
    rainNext = rand(6, row.rain.gap * 0.5 + 6);
    cloudV = 0; pulseV = 0;
    wet = row.wet;
    thunderAt = 0;
    rainMesh.count = 0;
    wxFieldTo(row);
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
  function label() { return row.label; }
  function lock() { return row.lock; }

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
      // A CONFIG CHANGE HAS TO TAKE EFFECT PROMPTLY. `rainNext` was seeded from
      // the OLD row on arrival, so a caller that shortens the gap from ninety
      // seconds to one still waits out the old ninety — which looks exactly
      // like `set` not working, and is how the first audio soak measured a
      // rain bed of zero after twenty seconds of a forced downpour.
      rainNext = Math.min(rainNext, next.rain.gap);
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

    // ---- 1. the shower ---------------------------------------------------
    // A dice roll on a timer rather than a probability per frame: at 60 Hz a
    // per-frame probability is a rate, and a rate that reads correctly at
    // 60 fps is four times too fast at 240.
    if (rainAt > 0) {
      rainAt -= dt;
      const u = 1 - rainAt / Math.max(0.001, row.rain.hold);
      rainWant = wxEnvelope(u) * row.rain.peak;
      if (rainAt <= 0) { rainWant = 0; rainNext = row.rain.gap * rand(0.7, 1.4); }
    } else if (row.rain.odds > 0) {
      rainNext -= dt;
      if (rainNext <= 0) {
        if (Math.random() < row.rain.odds) { rainAt = row.rain.hold; thunderAt = rand(4, 12); }
        else rainNext = row.rain.gap * rand(0.5, 1.0);
      }
    }
    // Damped rather than assigned, so the envelope's own corners are rounded
    // off and a biome change cannot step the rain from 0.7 to 0 in one frame.
    rainT = damp(rainT, rainWant, 0.9, dt);
    if (rainT < 0.0015) rainT = 0;

    // ---- 2. cloud, pulse, gust -------------------------------------------
    // Under prefers-reduced-motion every oscillator holds at its centre. The
    // shower still happens — it is weather, not motion — but nothing wobbles.
    if (wxCalm) {
      cloudV = damp(cloudV, 0, 2, dt); pulseV = damp(pulseV, 0, 2, dt);
      wxGust.x = damp(wxGust.x, Math.sin(row.dir) * row.gust.base, 2, dt);
      wxGust.z = damp(wxGust.z, Math.cos(row.dir) * row.gust.base, 2, dt);
    } else {
      // Half-wave rectified: a cloud either is in front of the sun or is not,
      // and there is no such thing as negative shadow.
      const cw = Math.max(0, wxOsc(wxT, 0.021, 0.0)) * row.cloudK;
      cloudV = damp(cloudV, cw, 1.6, dt);
      pulseV = damp(pulseV, wxOsc(wxT, 0.037, 1.7) * row.pulseK * wxPULSE_HEMI, 1.1, dt);
      // The gust swings the HEADING as well as the speed, or a "wind shift" is
      // just a volume knob on a fan.
      const sw = wxOsc(wxT, row.gust.hz, 3.1);
      const th = row.dir + sw * 0.55;
      const sp = row.gust.base + wxOsc(wxT, row.gust.hz * 1.63, 5.5) * row.gust.swing;
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
    if (kind && moteMesh.count > 0) {
      const n = moteMesh.count;
      const sizeK = kind._sizeK || 1;
      const wk = kind.windK, fall = kind.fall, sway = kind.sway;
      const swayW = kind.swayHz * 6.28318, spin = kind.spin, blink = kind.blink;
      const still = wxCalm ? 0.15 : 1;
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
  }

  const api = {
    mood: mood, label: label, lock: lock,
    drizzle: drizzle, cloud: cloud, pulse: pulse,
    gust: gust, wetness: wetness, slip: slip, splash: splash, shine: shine,
    light: light, bed: bed, set: set,
    /** For the QA harness and for nothing else: what the table says about a
     *  place without having to be standing in it. */
    rowOf(n) { return wxMOOD[n] || wxBASE; },
    update: update,
  };
  game.weather = api;
  return api;
}
