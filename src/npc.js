import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PALETTE, mat, TASKS, rand, randInt, clamp, damp, lerp } from './shared.js';

// ===========================================================================
// AGENT D — NPC AI.  Sydneysiders: tourists, gardeners, joggers, bin chickens.
//
// Rendering strategy: every NPC is a pure Object3D skeleton (NOT added to the
// scene) whose node matrices are copied into a small set of InstancedMeshes
// every frame.  16 humanoids + 6 ibis cost 14 draw calls in total.
//
// Speech bubbles are DOM elements in the HUD layer — no textures anywhere.
// ===========================================================================

// --- scratch (zero allocation inside update) -------------------------------
const npcV1 = new THREE.Vector3();
const npcV2 = new THREE.Vector3();
const npcQ1 = new THREE.Quaternion();
const npcE1 = new THREE.Euler();
const npcM1 = new THREE.Matrix4();
const npcColor = new THREE.Color();
const npcUpY = new THREE.Vector3(0, 1, 0);   // the lead's own axis, for the swing
// Circular Quay scratch — still zero allocation inside update().
const npcV3 = new THREE.Vector3();
const npcV4 = new THREE.Vector3();
const npcQ2 = new THREE.Quaternion();
const npcM2 = new THREE.Matrix4();
const npcS1 = new THREE.Vector3(1, 1, 1);
const npcCV1 = new CANNON.Vec3();
const npcUP = new THREE.Vector3(0, 1, 0);
// Pasto scratch — used only by paOffCamera, so it never aliases npcV3.
const npcPAv1 = new THREE.Vector3();

// --- small helpers ---------------------------------------------------------
function npcWrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
function npcDampAngle(cur, tgt, lambda, dt) {
  return cur + npcWrapAngle(tgt - cur) * (1 - Math.exp(-lambda * dt));
}
/** PALETTE integer -> CSS colour string, for the DOM speech bubbles. */
function npcCssHex(c) { return '#' + ('000000' + c.toString(16)).slice(-6); }

/**
 * A DWELL DRAWN ONCE, NOT REDRAWN EVERY TICK.
 *
 * `if (rec.stateT > rand(2.5, 7))` reads as "stand about for somewhere between
 * two and a half and seven seconds" and is not that at all. The brains are
 * staggered — three records think per frame, so with fifty-six of them each one
 * is asked about nine times a second — and every ask draws a FRESH threshold.
 * The first low sample wins, so the distribution collapses onto its own floor:
 * the intended 2.5-7 s becomes about 2.5-3 s, every time, for everybody. The
 * cost is not a number in a log, it is that a crowd whose dwell times were
 * authored to vary all move on the same beat and read as a screensaver.
 *
 * Eight sites had it — tourists idling, the gardener working, the ibis
 * wandering, the gardener giving up a chase, three of the Pasto cast and the
 * dog at the Quay. Draw the number ONCE on entering the state, hold it until it
 * fires. `setState` and `paSet` clear it; firing clears it too, for the two
 * callers that reset their own timer instead of changing state.
 */
function npcDwell(rec, t, a, b) {
  if (!(rec.dwell >= 0)) rec.dwell = a + Math.random() * (b - a);
  if (t <= rec.dwell) return false;
  rec.dwell = -1;
  return true;
}

/**
 * Kinematic/teleport write. cannon-es renders from previousPosition ->
 * interpolatedPosition; if we move a body by hand without refreshing those the
 * renderer lerps out of a stale origin and the object smears across the park.
 */
// WHERE THE ANIMAL IS, AT MODULE SCOPE, so npcPlaceBody can refuse to put a
// person inside it. Written once a frame by refreshCapy.
let npcCapyX = 0, npcCapyZ = 0, npcCapyOk = false;
// The distance between centres at which a walker box and the capybara capsule
// stop touching, plus a margin. See npcWALK_CLEAR, which is the same number.
const npcBODY_CLEAR = 1.30;

/**
 * PLACE A HAND-DRIVEN BODY — AND NEVER INSIDE THE PLAYER.
 *
 * This is the ONE place any of these bodies is written, which is why the
 * guarantee belongs here rather than in the four places that decide where
 * somebody wants to be. A walker’s collider is mass-0 KINEMATIC, so cannon
 * resolves any overlap between it and the capybara by moving the CAPYBARA:
 * steering, separation and the step clamp can all be doing the right thing
 * and a single frame of penetration still shoves the player. Measured in
 * Pasto, parked with no input for sixty seconds, the animal was carried
 * between 0.7 m and 28.9 m depending on the parade’s phase.
 *
 * Only bodies that carry `userData.npc` are held off. Anything else placed
 * through here may legitimately be a floor the animal is standing on, and a
 * carrier that refused to go under its passenger would drop it.
 *
 * The DRAWN figure is not moved — a walker may still visually brush past. The
 * two disagree by under a metre at the worst moment of an encounter that lasts
 * about a second, and the alternative is a person who cannot walk down a path
 * the player is standing on.
 */
function npcPlaceBody(b, x, y, z) {
  if (!b) return;
  if (npcCapyOk && b.userData && b.userData.npc) {
    const dx = x - npcCapyX, dz = z - npcCapyZ;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < npcBODY_CLEAR) {
      if (d > 1e-4) {
        x = npcCapyX + (dx / d) * npcBODY_CLEAR;
        z = npcCapyZ + (dz / d) * npcBODY_CLEAR;
      } else {
        x = npcCapyX + npcBODY_CLEAR; z = npcCapyZ;
      }
    }
  }
  b.position.set(x, y, z);
  b.previousPosition.copy(b.position);
  b.interpolatedPosition.copy(b.position);
}
function npcPlaceQuat(b, qx, qy, qz, qw) {
  if (!b) return;
  b.quaternion.set(qx, qy, qz, qw);
  b.previousQuaternion.copy(b.quaternion);
  b.interpolatedQuaternion.copy(b.quaternion);
}

/**
 * Hand-merge a list of primitive specs into ONE non-indexed BufferGeometry
 * carrying a white vertex-colour attribute (so per-instance colours multiply
 * cleanly on every three.js build).  Setup-time only.
 */
function npcMakeGeo(parts) {
  const chunks = [];
  let total = 0;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    let g;
    if (p.k === 'cyl') g = new THREE.CylinderGeometry(p.rt, p.rb, p.h, p.seg || 6);
    else if (p.k === 'sph') g = new THREE.SphereGeometry(p.r, 6, 4);
    else if (p.k === 'cone') g = new THREE.ConeGeometry(p.r, p.h, p.seg || 5);
    else g = new THREE.BoxGeometry(p.w, p.h, p.d);
    npcM1.makeRotationFromEuler(npcE1.set(p.rx || 0, p.ry || 0, p.rz || 0));
    npcM1.setPosition(p.x || 0, p.y || 0, p.z || 0);
    g.applyMatrix4(npcM1);
    let ng = g;
    if (g.index) { ng = g.toNonIndexed(); g.dispose(); }
    chunks.push(ng);
    total += ng.attributes.position.count;
  }
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  const col = new Float32Array(total * 3);
  let off = 0;
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    pos.set(c.attributes.position.array, off * 3);
    nor.set(c.attributes.normal.array, off * 3);
    off += c.attributes.position.count;
    c.dispose();
  }
  col.fill(1);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeBoundingSphere();
  return geo;
}

// --- dialogue (dry, Australian, never repeated back to back) ---------------
const npcLINES = {
  startle: ['Oi!', 'Bloody hell.', 'What was that?', 'Right then.', 'That’s not a wombat.', 'Strewth.',
            'Nope. Nope nope nope.', 'Is it meant to be here?', 'It’s the size of a labrador.',
            'Do NOT let it near the esky.'],
  laugh:   ['Aww, look at him!', 'He’s just going about his day.', 'He’s having a lovely time.',
            'Get a photo of that.', 'Don’t make eye contact.',
            'He’s doing better than I am.', 'Look at the little face on him.',
            'That’s the most relaxed animal I’ve ever seen.', 'He owns the place, apparently.'],
  // What somebody says the second time you come near them. See the npcWARY_*
  // block: this is the whole of what being remembered sounds like.
  wary:    ['You again.', 'Oh, it’s you.', 'I’m watching you, mate.', 'Not again.',
            'Right. I see you.', 'Don’t even think about it.', 'I know your game.',
            'Nope. Nope nope nope.'],
  stolen:  ['That’s my hat!', 'Get out of it!', 'Oi! Come back here!', 'You little ratbag!',
            'Give it back, mate!', 'That was forty dollars!', 'I need that! I’m ginger!'],
  giveUp:  ['…where’d he go?', 'Unbelievable.', 'Right. Yep.', 'Fair enough, I suppose.',
            'I’m not chasing a rodent through the gardens.', 'It’s only a hat. It’s only a hat.'],
  photo:   ['Say cheese!', 'Hold still, mate.', 'Beautiful.', 'One for the album.',
            'Nobody at work is going to believe this.', 'Closer. Closer. Too close.'],
  chase:   ['Not the roses!', 'Get out of it!', 'Oi! OI!', 'Right, that’s it.', 'Off the garden bed!',
            'Those are PRIZE roses!', 'Thirty years I’ve done this bed!'],
  breath:  ['I’m too old for this.', 'Every bloody Tuesday.', 'Gone, has he.', 'Terrific.',
            'I’ve got a bad knee, you know.', 'They don’t pay me enough. They don’t pay me at all.'],
  dump:    ['Out you get.', 'Off you pop.', 'And stay out.', 'There. Gate. Goodbye.'],
  replant: ['There we are.', 'Poor old roses.', 'Right as rain.', 'Good as new. Nearly.',
            'I’ll say nothing if you say nothing.'],
  coffee:  ['My flat white…', 'That was four fifty.', 'Aw, mate.', 'Seriously?',
            'Six dollars. SIX.', 'I hadn’t even started it.'],
  jog:     ['Whoa!', 'Comin’ through!', 'Sorry! Sorry!', 'On your left!',
            'That’s a big one!', 'Not stopping! Can’t stop!'],
  idle:    ['Lovely day.', 'Is that the Opera House?', 'Reckon it’ll rain.', 'Beautiful, but.',
            'Where’s the ferry?', 'Twelve dollars for a coffee.', 'It’s bigger in person, isn’t it.',
            'I said we should’ve gone to Bondi.', 'Is that a bin chicken or a real bird?'],

  // ---- TWO PEOPLE TALKING (see chatStep) -------------------------------
  // Openers and replies are separate lists on purpose: an exchange must never
  // be two people saying the same sort of thing at each other. Every reply has
  // to work after every opener, which is the whole craft of writing these —
  // so they are all deflections, agreements and non-sequiturs, and none of
  // them answers a specific question.
  chatA:   ['Did you book the ferry, or did I?', 'What time did they say?',
            'Is that the one on the postcard?', 'I told you it was up this end.',
            'How much was the parking?', 'Have you got the sunscreen?',
            'Are we doing the bridge climb or not?', 'Is he asleep or is that just his face?',
            'What is that, a wombat?', 'I could live here, you know.',
            'Do you want to sit down for a bit?', 'Is it always this bright?',
            'Nine dollars. For a coffee.', 'Have we been here before?',
            'Right, so where are we meeting them?'],
  chatB:   ['Mm.', 'You said that yesterday.', 'Probably.', 'I wasn’t listening, sorry.',
            'That’s what I said.', 'Ask your father.', 'It’s in the other bag.',
            'Don’t start.', 'We’ll see.', 'It’s the humidity, that.',
            'I’m not walking back up that hill.', 'Lovely, though. Isn’t it.',
            'Well. There you go.', 'Have a look on your phone.',
            'That is genuinely the biggest one I have ever seen.'],

  // ---- Circular Quay (chapter 1) ----
  busk:    ['Any requests?', 'Cheers, mate.', 'This one’s in G.', 'Ta very much.',
            'Everything’s in G, mate.', 'Tips go in the hat. The HAT.'],
  buskRob: ['That’s my hat!', 'That’s my takings!', 'Oi — I’m working here!', 'Mate. MATE.',
            'There was eleven dollars in that!', 'I have been robbed by a rodent.'],
  buskSad: ['Right. Where was I.', 'Every Sunday, this.', 'Back to it, then.', 'Terrific.',
            'I’ll write a song about it.', 'This one’s about a capybara.'],
  cafe:    ['…and she said no, obviously.', 'The coffee here is criminal.', 'Lovely spot, this.',
            'Is that a very large guinea pig?', 'We should get the ferry after.'],
  shoo:    ['Off the table!', 'Get DOWN!', 'That is a table, mate.', 'Excuse me!', 'Someone eats off that!'],
  waiter:  ['Two flat whites.', 'Sorry about him.', 'Right. Yep. Fine.', 'I only started Tuesday.',
            'This is not in my job description.',
            'There is a capybara on table four.', 'I’m going to say nothing and hope.',
            'Nobody trained me for this.', 'Tuesday. I started on a TUESDAY.',
            'This is fine. This is completely fine.'],
  dogCall: ['MURRAY!', 'Murray — HEEL!', 'MURRAY, COME.', 'He’s usually very good!', 'MURRAY!!',
            'Murray, we have TALKED about this.', 'He’s never done this before.',
            'MURRAY. Look at me. MURRAY.', 'I’ve got treats! I’ve got the good treats!',
            'That’s it. No park for a week.'],
  queueUp: ['There’s a line, mate.', 'Oi. Back of the queue.', 'We were all waiting.', 'Unbelievable.'],
  soaked:  ['AAGH!', 'That is COLD.', 'Oh, marvellous.', 'I am drenched.', 'Wonderful. Just wonderful.'],
  mugged:  ['Get off! GET OFF!', 'They’re on me!', 'Not the chips! NOT THE CHIPS!', 'Aaagh — birds!'],
  // ---- Mr Whippy, when she stops -------------------------------------
  // Six lines to join, four to leave, and one for the small tragedy of
  // arriving at the window as she pulls away. Nobody in this crowd had
  // anything at all to say about the only vehicle on the promenade.
  whippyQ: ['Is he stopping? He’s stopping.', 'Two, please.',
            'Do you do a ninety-nine?', 'I’m not queueing. I’m standing near it.',
            'It’s got the flake. It has to have the flake.',
            'We are on holiday. That is the entire argument.',
            'Have you got change for a fifty?'],
  whippyGot:['Worth every cent.', 'Oh, that’s good.', 'Eight dollars. Worth it.',
             'Don’t tell your mother.', 'Quick, before it goes everywhere.',
             'Right. Now the seagulls know.'],
  whippyMiss:['—no. No! Come back!', 'He drove off. He actually drove off.',
              'I was NEXT.', 'Every time. Every single time.'],
  ferrySay:['That’s our ferry.', 'Manly, is it?', 'Mind the gap.', 'Tap on, tap on.'],

  // ---- the sea wall ----
  cornered:['That’s the WATER!', 'No no no — no further!', 'There’s nowhere to GO!',
            'Someone take him!', 'I’m at the edge, mate!', 'Right. Yep. Water.',
            'I can’t swim! I mean I can. I’d rather not.',
            'We are BOTH going to regret this.'],
  splash:  ['AAAAH—', 'OH—', 'Not the harbour!', 'MY PHONE!'],
  soggy:   ['I’m in the harbour.', 'Right. Lovely.', 'Well. That happened.',
            'Salt water. Terrific.', 'I’d like to go home now.',
            'My phone was in that pocket.', 'Is anyone filming this? Don’t film this.',
            'It’s warmer than I expected, in fairness.'],
  // ---- the dining terrace ----
  diner:   ['The calamari here is unreal.', 'Is that included?', 'Lovely spot for it.',
            'We should sit outside more often.', 'Table with a view, you said.'],
  standUp: ['GET OFF THE TABLE!', 'That is our LUNCH!', 'Excuse me — EXCUSE ME!',
            'He’s ON the table!', 'Off! OFF!'],
  serve:   ['Two flat whites, yeah?', 'Won’t be a moment.', 'Sorry about the rodent.',
            'Table four, table four.', 'I only started Tuesday.',
            'Do I charge it? Can I charge it?', 'It has a hat. Why has it got a hat.',
            'I’m putting it on the specials board.'],

  // ---- Pasto, Nariño (chapter 2). Sydney flees. Pasto CHASES. ----
  //
  // WRITTEN IN ENGLISH, SALTED WITH SPANISH. The first cut of these was entirely
  // in Spanish, which was the honest choice and the wrong one: a speech bubble is
  // up for two seconds over the shoulder of somebody who is chasing you, and a
  // player who does not read Spanish got two seconds of shape and no joke. The
  // rule now, here and in every place after this one, is that the SENTENCE is in
  // English and the words that carry the accent stay: the address (mijo, hombre),
  // the exclamation (¡Oiga!, Ave María), the insult (sinvergüenza) and the local
  // noun (chigüiro, empanada, ruana). Those are the words a visitor actually
  // comes home with, they are legible from context in one reading, and the line
  // still could not have been said anywhere else.
  paNotice:  ['…and what is that, pues?', 'Ave María. It is a chigüiro.',
              'That is the largest guinea pig in Nariño.', 'Look at it. Just look at it.',
              'Is that somebody’s?', 'It is not a dog. I know that much.'],
  paTheft:   ['¡Oiga! That is MINE!', 'Thief! Sinvergüenza!', 'Put it back. Put it BACK.',
              'I saw that, chigüiro.', 'That is my living, hombre!'],
  paChase:   ['¡Venga acá!', 'Do not run from me!', 'Out of my stall!',
              'I warned you, mijo!', 'I will remember that face!'],
  paWheeze:  ['I am too old for this, pues.', 'Ay, my back.',
              'Every Tuesday. Every single Tuesday.', 'Gone. Of course he is gone.'],
  paRestock: ['Right. Start again.', 'Tomorrow I bring the dog.',
              'Next time, chigüiro.', 'I know your face now.'],
  // THE WOMAN WITH THE BROOM. The one recurring character in this chapter and
  // the only person in the game who never once breaks into a run — the whole
  // joke is that she does not have to, and every line she has is a variation on
  // it. Nobody else here gets a philosophy.
  paBroom:   ['I do not run. I arrive.', 'The broom is patient, mijo.',
              'Walk, then. I will still get there.', 'Sinvergüenza. Come here.',
              'I have all afternoon.', 'You are faster. I am closer.'],
  paSwat:    ['Take that!', 'And that!', 'Learn, pues!'],
  paScold:   ['Go on. Off with you.', 'The broom does not forget.',
              'I will be here tomorrow.', 'We both know you will be back.',
              'Another day, chigüiro.'],
  paFarm:    ['Out of the drying beds!', 'Not the café — NOT THE CAFÉ!',
              'That is a year of work you are standing on!', '¡Fuera! Get off!'],
  paChurch:  ['God preserve us.', 'Buenas.', 'Mass is at six.',
              'The courtyard is lovely at this hour.'],
  paScandal: ['THE BELL!', 'Who is ringing at this hour?!', 'That is sacrilege!',
              '¡Ave María purísima!', 'In the middle of Mass!'],
  // ---- TWO PEOPLE TALKING, IN PASTO (see chatStep) ---------------------
  // Same rules as chatA/chatB, salted the same way the rest of this chapter
  // is: the sentence in English, the address and the local noun in Spanish.
  // A market at two thousand five hundred metres is a place where everybody
  // knows everybody, so these are all continuations of conversations that
  // started some time before the player got here.
  paChatA: ['Did your brother come down from the finca?',
            'It is going to rain by four. Look at it.',
            'Have you seen the price of gas?', 'Is the road open past the church?',
            'Did you sell the black ones?', 'My knee knows before the sky does.',
            'Are you going up for the Carnaval, pues?',
            'The mountain is smoking again, mijo.',
            'Two thousand for THAT?', 'Did you hear about Doña Marta?',
            'Whose animal is that, hombre?'],
  paChatB: ['Ay, do not start with me.', 'Same as always, pues.',
            'That is what my mother said.', 'It will hold. It always holds.',
            'You say that every year.', 'Ave María.',
            'I am not paying that.', 'Ask the woman with the broom. She knows everything.',
            'Tomorrow, tomorrow.', 'It is not mine, I can tell you that.',
            'Bueno. Life goes on.'],
  // ---- THE CARROZA GOES PAST (see paThink) -----------------------------
  // Two lists, because a float with a capybara standing on it is not the same
  // event as a float. The first are what you say about a parade you have seen
  // every January of your life; the second are what you say when the parade
  // has a two-metre rodent on it.
  paFloat:     ['There it goes.', 'They made the sun bigger this year.',
                'Bueno. It is Carnaval, pues.', 'My cousin built the wings.',
                'Slower than last year. Everything is.',
                'The talc gets into everything. Everything, mijo.'],
  paFloatRode: ['¡Ave María — look at it!', 'There is a chigüiro on the carroza.',
                'Somebody get a photograph. SOMEBODY.',
                'It is riding it. It is actually riding it.',
                'That is the best one they have ever done.',
                'Throw it some talc! Go on!', '¡Que viva el chigüiro!'],
  paCondor:  ['Look! Up there!', '¡El cóndor!', 'A condor. An actual condor.',
              'Look at the size of that thing.'],
  paGawp:    ['…it is flying.', 'The chigüiro is flying.',
              'Nobody is going to believe me.', 'Do you see it too? Say you see it.',
              'Ay, no. No, no, no.'],
};

// Last line spoken anywhere, per category — stops a startled crowd chorusing.
const npcLastGlobal = {};

const npcTASK_IDS = (function () {
  const s = {};
  for (let i = 0; i < TASKS.length; i++) s[TASKS[i].id] = true;
  return s;
})();

// Points of interest — tourists mill between these (x, z pairs).
const npcPOI = [
  0, 11,  -6, 13,  7, 12,  -14, 9,  12, 10,  -26, 7,
  -38, 11,  -50, 15,  -22, 17,  4, 17,  -10, 21,  17, 13,
  -44, 5,  -32, 18,  9, 20,
];
// Jogger loop (x, z).
const npcJOG_LOOP = [-56, 4, -22, 6, -18, 32, -52, 34];
// Gardener patrol beds (x, z), inside the Royal Botanic Gardens.
const npcGARDEN_PTS = [24, 20, 40, 30, 50, 44, 30, 44, 44, 14];
const npcGATE_X = 13.0, npcGATE_Z = 20.0;
// steer-around offsets, tried in order (no A*, and none needed)
const npcAVOID_TRIES = [0.7, -0.7, 1.4, -1.4, 2.2, -2.2];

const npcBOUND_X0 = -66, npcBOUND_X1 = 66, npcBOUND_Z0 = -6.5, npcBOUND_Z1 = 66;

// --- personal space --------------------------------------------------------
// Capybara collision is three r=0.34 spheres on a 0.68 spine; the NPC box is
// 0.26 x 0.22. 1.05 is the combined *visual* radius: inside it the two meshes
// are interpenetrating on screen even though cannon is happy.
const npcSEP_R = 1.05;
// ---- ...AND HOW FAR A WALKER HAS TO STAY OFF, WHICH IS FURTHER -----------
// npcSEP_R is where the SHOVE settles somebody, and it is very slightly inside
// the distance at which the two colliders actually touch: the capybara is three
// spheres of r 0.34 at z = 0, +/-0.34, so its reach is 0.68, and a walker box
// is he (0.18, 0.30, 0.34), whose xz half-diagonal is 0.385. Worst case that is
// 1.065 between centres — just OUTSIDE npcSEP_R. So the separation parked every
// walker exactly on the contact boundary and cannon spent the rest of the
// encounter resolving a hair of penetration, which for a mass-0 kinematic body
// against a dynamic one means moving the ANIMAL. See moveRec.
const npcWALK_CLEAR = 1.30;   // m between centres, with the margin the shapes need
const npcSEP_LAMBDA = 14;     // damping on the shove — never a teleport
const npcSEP_VMAX = 2.6;      // m/s cap on how fast anyone can be pushed
const npcSEP_PROBE = 0.34;    // nav radius used when testing where to push them
// Body-check: a determined player at speed genuinely connects.
const npcCHECK_SPD = 3.2;     // m/s (documented threshold, matches props.js)
const npcCHECK_R = 1.45;      // generous enough that contact actually happens
const npcFLUSTER_R = 6.0;     // inside this, a drink-carrier dithers, never sprints
const npcDRINK = { coffee: 1, icecream: 1 };
// Speech bubbles at the closer (~9.5) camera.
const npcBUB_AVOID_X = 0.20;  // NDC half-width of the capybara's no-fly zone
const npcBUB_AVOID_Y = 0.34;

// Skeleton dimensions the animation maths depends on (metres, feet at y = 0).
const npcLEG_L = 0.62;      // hip pivot height == leg length
const npcHIP_Y = 0.92;      // where the torso actually bends

const npcSKINS = [PALETTE.skin1, PALETTE.skin2, PALETTE.skin3, PALETTE.skin4];
const npcHAIRS = [PALETTE.hair1, PALETTE.hair2, PALETTE.hair3, PALETTE.hair4, PALETTE.hair5];
const npcCLOTH = [PALETTE.cloth1, PALETTE.cloth2, PALETTE.cloth3, PALETTE.cloth4,
                  PALETTE.cloth5, PALETTE.cloth6, PALETTE.cloth7, PALETTE.cloth8];
const npcPANTS = [PALETTE.denim, PALETTE.khaki, PALETTE.cloth6, PALETTE.stoneDark, PALETTE.cloth3];

// ===========================================================================
// CHAPTER 2 — CIRCULAR QUAY.  A café strip, a busker, a kiosk queue, a dog on
// a lead, a mob of seagulls and a ferry that actually docks.  None of the new
// cast gets a cannon body: the budget is 130 and the world already sits at 123,
// so they steer with the existing nav + personal-space shove and cost nothing.
// ===========================================================================
const npcQUAY_KINDS = { busker: 1, patron: 1, waiter: 1, owner: 1, queue: 1, commuter: 1 };
const npcFOOD = { sandwich: 1, icecream: 1, chips: 1, coffee: 1, basket: 1 };
const npcDOG_NAME = 'Murray';
const npcGULL_N = 8;
const npcSEAT_CROUCH = -0.12;    // hips 0.62 -> 0.50: chair height
const npcSEAT_LEG = -0.72;       // thighs swung forward under the table
const npcQUAY_ZMIN = -22;        // quay folk may walk out along the ferry wharf

// Fallback fixtures, used only until environment.js publishes the real ones.
const npcFB_BUSKER = { x: -25.0, z: 2.0 };
const npcFB_KIOSK = { x: -18.5, z: 5.0 };
const npcFB_TABLES = [-34, 5.0, -30.5, 8.0, -37.0, 7.5, -32.5, 2.0];
const npcFB_FERRY = { x: -40, z: -14.5 };
const npcDOG_HOME = { x: -28.5, z: -3.0 };
const npcQUAY_PTS = [-22, 7, -30, -1, -38, 4, -44, 8, -20, -2, -35, 9, -43, -3];
// Bollards and rail posts along the quay edge — where gulls loiter and judge.
const npcPERCH = [-16.5, -9.0, -20.5, -9.0, -24.5, -9.0, -29.0, -9.0,
                  -33.5, -9.0, -37.0, -9.0, -44.5, -9.0, -46.5, -6.0];

// ===========================================================================
// ROUNDS 1-6 — the quay crowd, the sea wall, and a vision cone.
//
// The joke this round: a badly startled Sydneysider does not run inland, he
// backs AWAY from the capybara, which at Circular Quay means backing toward
// the harbour. Most of them stop dead at the sea wall and flail ('cornered').
// About one in six keeps going and wears it ('plunge' -> 'swim'). Nobody
// drowns — they paddle back, climb out, and are merely damp and unimpressed.
// ===========================================================================
const npcEDGE_Z = -10.0;        // contract: sea wall / quay edge
const npcEDGE_STOP = -9.55;     // toes on the coping, still on the pavement
const npcWATER_Z = -10.6;       // committed: past here you are swimming
const npcSWIM_ZMIN = -16.0;     // how far out a flailing tourist can drift
const npcPLUNGE_ODDS = 1 / 6;   // "roughly one in six", per contract brief
const npcSWIM_YOFF = -1.05;     // hips at the waterline, head plainly clear
const npcSEA_BIAS = 0.80;       // how hard a bad startle is bent seaward
// The fall itself is integrated, not damped: an ease-out is fastest at the
// coping and slowest at the water, which is exactly backwards for a drop.
const npcPLUNGE_G = 16.0;       // m/s^2 — same gravity the startle hop uses
const npcPLUNGE_V0 = 1.2;       // the over-balance toss as he leaves the wall
const npcSPLASH_Y = -0.42;      // yOff at which his feet break the surface
const npcSPLASH_LIFE = 0.85;    // foam ring lifetime, seconds
const npcSPLASH_R0 = 0.35, npcSPLASH_R1 = 2.30;
const npcCLIMB_SPD = 1.6;       // m/s he hauls himself shoreward along the wall
const npcMOVE_R = 0.30;         // body radius used to reject a blocked step

// Vision: a cone about the facing direction, a distance falloff, and a cheap
// 4-sample walk against env.navBlocked so the colonnade actually occludes.
const npcVIS_FAR = 20.0;
const npcVIS_COS = 0.20;        // ~78 deg half-angle — wide, but not a sphere
const npcVIS_FLOOR = 0.12;      // cone term at the extreme edge; must fall off
const npcVIS_NEAR = 3.0;        // this close, you notice him however you face
const npcLOS_STEPS = 4;
const npcLOS_R = 0.28;

// Outdoor dining terrace. Agent A publishes the real fixtures; until then we
// sit the terrace where the contract says it goes, just west of the café strip.
const npcFB_TERRACE = [-30.0, 2.0, -33.5, 4.5, -27.0, 5.0, -34.5, 0.5];
const npcFB_COUNTER = { x: -25.5, z: 4.5 };
const npcTABLE_TOP_Y = 0.70;    // capy above this, on a table footprint = on it
const npcSEAT_OUT = 0.95;       // how far a chair sits from the table centre

// ===========================================================================
// ROUNDS 19-24 — PASTO LOCALS.  The contrast is the whole point.
//
// A startled Sydneysider backs away and ends up in the harbour. A Pasto local
// does the opposite: this is their plaza, their stall, their coffee, and a
// capybara in the market is vermin to be shooed. Same rig, same instanced
// skeleton, opposite temperament — and none of them gets a cannon body, exactly
// like the Circular Quay cast.
//
// Pasto is not flat. Every y comes from game.pasto.terrainHeight; steering
// refuses anything steeper than npcPA_SLOPE_MAX (two height samples, no
// raycast); chases slow uphill, gather pace downhill and overshoot at the
// bottom; and a vision cone that ignored a 30 m height difference would let a
// vendor spot you from the flank of a volcano, so alert radius falls off with
// vertical separation and a steep look-up angle kills the cone outright.
// ===========================================================================
// Contract world layout. Used as fallbacks whenever pasto.js has not published
// the matching zone yet — Agent A lands 'plaza'/'market'/'church' this round.
const npcPA_PLAZA = { x0: -24, z0: 8, x1: 24, z1: 46 };
const npcPA_MARKET = { x0: -26, z0: 10, x1: 26, z1: 30 };
const npcPA_CHURCH = { x: 0, z: 44 };
const npcPA_CHURCH_DOOR = { x: 0, z: 39 };
const npcPA_COFFEE = { x0: 30, z0: -20, x1: 90, z1: 30 };
const npcPA_PATIO = { x: 46, z: 4, r: 7.5 };      // the coffee drying patio
const npcPA_WALK = 106;                            // valley floor, minus a margin

// Market stalls ring the plaza (x, z, yaw TRIPLES — the yaw is the stall's own
// frame: local +z is behind the counter, local -z is the customer side, exactly
// the convention pasto.js uses for its stall footprints and shopper spots).
// Replaced at build time by game.pasto.stalls / marketStalls if Agent A
// publishes them, and Agent A's yaw is carried through with the position.
const npcPA_STALLS = [
  -18, 12, 0, -6, 12, 0, 6, 12, 0, 18, 12, 0,
  -22, 20, Math.PI / 2, 22, 20, -Math.PI / 2,
];
const npcPA_POST = 1.75;        // metres behind the counter — clear of the pad
const npcPA_POST_STEP = 0.45;   // how far to back off if that is still blocked
// Plaza loafing points for the abuelas and the churchgoers.
const npcPA_PLAZA_PTS = [-14, 20, 0, 18, 14, 20, -8, 32, 8, 32, 0, 27, -18, 36, 18, 36];

// --- terrain-aware steering -------------------------------------------------
const npcPA_PROBE = 1.2;        // metres ahead the slope/nav probe looks
const npcPA_SLOPE_MAX = 0.82;   // rise/run a local will accept. Above this: no.
const npcPA_MOVE_R = 0.32;      // body radius used to reject a blocked step
const npcPA_DOWN_GAIN = 0.70;   // how much a downhill run adds to chase speed
const npcPA_UP_DRAG = 0.62;     // how much the steepest walkable slope takes away
const npcPA_OVERSHOOT = 0.62;   // seconds of "can't stop at the bottom", 55% faster

// --- vision on vertical terrain ---------------------------------------------
const npcPA_VIS_FAR = 22.0;
const npcPA_VIS_DY = 9.0;       // metres of height difference that halves the radius
const npcPA_PITCH_MAX = 0.95;   // rad — steeper than this and nobody is looking
const npcPA_LOS_STEPS = 4;

// --- chase discipline. Every chase has BOTH a timer and a leash. ------------
const npcPA_GIVEUP = 8.0;       // vendor: chases hard, then wheezes
const npcPA_LEASH = 30.0;       // vendor: max distance from the stall
const npcPA_GRUDGE_MAX = 4;     // repeat offences past this stop making it worse
const npcPA_CHASE_CAP = 5.0;    // < the capybara's measured 5.1 m/s sprint. Never raise it.
const npcPA_ABUELA_GIVEUP = 45.0;   // implacable, but still terminates
const npcPA_ABUELA_LEASH = 56.0;
const npcPA_ABUELA_SPD = 1.55;  // she only ever walks. That is the joke.
const npcPA_FARM_GIVEUP = 6.5;
const npcPA_FARM_LEASH = 26.0;
// Floor on the walk-home budget. The real budget is paReturnMax(), derived from
// the kind's own leash and its slowest return speed, because a fixed 26 s is
// less than the leash distance actually needs and turned the "should never
// happen" teleport into the normal exit from `return`.
const npcPA_RETURN_MAX = 26.0;
const npcPA_RETURN_EASE = 9.0;  // metres of remaining distance per m/s of hurry
const npcPA_RETURN_SLACK = 1.6; // budget = leash / slowest-speed * this
const npcPA_STALL_T = 3.5;      // seconds of no progress before he tries the other shoulder

// --- condor reactions -------------------------------------------------------
const npcPA_COND_LOW = 26.0;    // height above ground that counts as "circling low"
const npcPA_COND_POINT = 42.0;  // horizontal range at which they point and scatter
const npcPA_COND_STARE = 52.0;  // …and at which a flying capybara stops the town
const npcPA_COND_DY = 0.55;     // weight on vertical separation in paCondDist
const npcPA_GAWP_MAX = 6.0;     // absolute ceiling on one bout of staring
const npcPA_GAWP_CD = 7.0;      // …and how long before he will stare again

const npcPA_LLAMA_SPIT_CD = 7.0;
const npcPA_DOG_ORBIT = 2.1;    // how close the street dog gets underfoot
const npcPA_DOG_GIVEUP = 20.0;  // a dog follows you, but not to the summit
const npcPA_DOG_LEASH = 35.0;   // …and not more than this far from his patch
const npcPA_DOG_COOL = 12.0;    // …and then he is off duty for a while

// Condor read, refreshed once per frame in place (zero allocation).
const npcPAcond = { ok: false, state: 'gone', mounted: false, x: 0, y: 0, z: 0, low: false };

// ===========================================================================
export function createNPCs(game) {
  const scene = game.scene;
  const THREE_ = game.THREE || THREE;

  // ---------------------------------------------------------------- geometry
  const gTorso = npcMakeGeo([
    { w: 0.50, h: 0.60, d: 0.30, y: 1.02 },
    { w: 0.62, h: 0.14, d: 0.32, y: 1.24 },            // shoulders
  ]);
  const gHips = npcMakeGeo([{ w: 0.46, h: 0.26, d: 0.32, y: 0.68 }]);
  const gHead = npcMakeGeo([
    { w: 0.32, h: 0.32, d: 0.31, y: 0.16 },
    { w: 0.07, h: 0.06, d: 0.06, y: 0.14, z: 0.17 },   // nose
    { w: 0.16, h: 0.14, d: 0.12, y: 0.00 },            // neck
  ]);
  const gHair = npcMakeGeo([
    { w: 0.35, h: 0.13, d: 0.34, y: 0.30 },
    { w: 0.30, h: 0.18, d: 0.10, y: 0.17, z: -0.15 },
  ]);
  const gArm = npcMakeGeo([
    { w: 0.12, h: 0.48, d: 0.12, y: -0.24 },
    { w: 0.13, h: 0.13, d: 0.13, y: -0.53 },           // hand
  ]);
  const gLeg = npcMakeGeo([
    { w: 0.15, h: 0.60, d: 0.16, y: -0.30 },
    { w: 0.17, h: 0.10, d: 0.24, y: -0.57, z: 0.04 },  // shoe
  ]);
  const gHat = npcMakeGeo([
    { k: 'cyl', rt: 0.36, rb: 0.36, h: 0.03, seg: 8, y: 0.32 },
    { k: 'cyl', rt: 0.16, rb: 0.19, h: 0.16, seg: 8, y: 0.41 },
  ]);
  const gCam = npcMakeGeo([
    { w: 0.20, h: 0.14, d: 0.10 },
    { k: 'cyl', rt: 0.05, rb: 0.06, h: 0.07, seg: 6, z: 0.08, rx: Math.PI / 2 },
  ]);
  // gardener's rake: handle + head, gripped mid-shaft
  const gTool = npcMakeGeo([
    { w: 0.05, h: 1.30, d: 0.05, y: 0.30, rx: -0.5 },
    { w: 0.42, h: 0.05, d: 0.05, y: -0.25, z: -0.30, rx: -0.5 },
    { w: 0.05, h: 0.12, d: 0.05, x: -0.16, y: -0.31, z: -0.28 },
    { w: 0.05, h: 0.12, d: 0.05, x: 0.16, y: -0.31, z: -0.28 },
  ]);
  // A ninety-nine, held at the shoulder. Two cones and three balls, and it is
  // the only thing anybody in this chapter ever walks away from the van with.
  const gCone = npcMakeGeo([
    { k: "cone", r: 0.055, h: 0.20, seg: 5, y: -0.10, rx: Math.PI },
    { k: "sph", r: 0.062, y: 0.02 },
    { k: "sph", r: 0.050, y: 0.08 },
    { k: "sph", r: 0.036, y: 0.13 },
    { w: 0.015, h: 0.13, d: 0.015, x: 0.035, y: 0.19, rz: -0.28 },
  ]);
  const gIbisBody = npcMakeGeo([
    { k: 'sph', r: 0.16 },
    { w: 0.10, h: 0.07, d: 0.24, y: 0.02, z: -0.20 },
  ]);
  const gIbisNeck = npcMakeGeo([
    { k: 'cyl', rt: 0.035, rb: 0.055, h: 0.26, seg: 5, y: 0.13 },
    { k: 'sph', r: 0.07, y: 0.28, z: 0.01 },
    { k: 'cyl', rt: 0.016, rb: 0.026, h: 0.13, seg: 4, y: 0.25, z: 0.10, rx: 1.15 },
    { k: 'cyl', rt: 0.010, rb: 0.017, h: 0.13, seg: 4, y: 0.17, z: 0.16, rx: 1.85 },
  ]);
  const gIbisLeg = npcMakeGeo([
    { k: 'cyl', rt: 0.015, rb: 0.015, h: 0.28, seg: 4, y: -0.14 },
    { w: 0.05, h: 0.02, d: 0.07, y: -0.27, z: 0.02 },
  ]);

  // Near-white base colour so per-instance colours multiply true (sun-bleached).
  const instMat = mat(PALETTE.sail, { vertexColors: true });

  // ---------------------------------------------------------------- roster
  const roster = [];
  for (let i = 0; i < 11; i++) roster.push('tourist');
  roster.push('gardener'); roster.push('gardener');
  for (let i = 0; i < 3; i++) roster.push('jogger');
  // ---- Circular Quay cast (same rig, same instanced meshes, no new bodies) --
  const QUAY_START = roster.length;
  roster.push('busker');
  for (let i = 0; i < 5; i++) roster.push('patron');
  roster.push('waiter');
  roster.push('owner');
  for (let i = 0; i < 4; i++) roster.push('queue');
  for (let i = 0; i < 4; i++) roster.push('commuter');
  const HUMANS = roster.length;      // 16 + 16
  const IBIS = 6;

  function mkInst(geo, count) {
    const m = new THREE_.InstancedMesh(geo, instMat, count);
    m.instanceMatrix.setUsage(THREE_.DynamicDrawUsage);
    m.castShadow = true;
    m.receiveShadow = false;
    m.frustumCulled = false;
    scene.add(m);
    try { game.registerShadowTarget(m); } catch (e) { /* optional hook */ }
    return m;
  }
  const iTorso = mkInst(gTorso, HUMANS);
  const iHips  = mkInst(gHips, HUMANS);
  const iHead  = mkInst(gHead, HUMANS);
  const iHair  = mkInst(gHair, HUMANS);
  const iArmL  = mkInst(gArm, HUMANS);
  const iArmR  = mkInst(gArm, HUMANS);
  const iLegL  = mkInst(gLeg, HUMANS);
  const iLegR  = mkInst(gLeg, HUMANS);
  const iHat   = mkInst(gHat, HUMANS);
  const iCam   = mkInst(gCam, HUMANS);
  const iTool  = mkInst(gTool, HUMANS);
  const iCone  = mkInst(gCone, HUMANS);
  const iIbisB = mkInst(gIbisBody, IBIS);
  const iIbisN = mkInst(gIbisNeck, IBIS);
  const iIbisLA = mkInst(gIbisLeg, IBIS);
  const iIbisLB = mkInst(gIbisLeg, IBIS);

  // ------------------------------------------------- Circular Quay geometry
  // Everything below is instanced too, so the whole precinct costs 12 calls.
  const gGuitar = npcMakeGeo([
    { w: 0.30, h: 0.36, d: 0.09, rz: 0.35 },
    { w: 0.22, h: 0.24, d: 0.09, x: 0.10, y: -0.16, rz: 0.35 },
    { w: 0.06, h: 0.52, d: 0.05, x: -0.22, y: 0.28, rz: 0.35 },
    { w: 0.09, h: 0.10, d: 0.05, x: -0.31, y: 0.52, rz: 0.35 },
  ]);
  const gTray = npcMakeGeo([
    { k: 'cyl', rt: 0.17, rb: 0.16, h: 0.03, seg: 8 },
    { k: 'cyl', rt: 0.05, rb: 0.045, h: 0.09, seg: 6, x: -0.06, y: 0.06, z: 0.02 },
    { k: 'cyl', rt: 0.05, rb: 0.045, h: 0.09, seg: 6, x: 0.06, y: 0.06, z: -0.03 },
  ]);
  // busker's hat, upturned on the pavement, and the coin cup beside it
  const gBuskHat = npcMakeGeo([
    { k: 'cyl', rt: 0.30, rb: 0.30, h: 0.03, seg: 8 },
    { k: 'cyl', rt: 0.19, rb: 0.15, h: 0.15, seg: 8, y: 0.09 },
  ]);
  const gCup = npcMakeGeo([
    { k: 'cyl', rt: 0.075, rb: 0.055, h: 0.16, seg: 6, y: 0.08 },
    { k: 'cyl', rt: 0.03, rb: 0.03, h: 0.02, seg: 6, y: 0.15 },
  ]);
  const gLead = npcMakeGeo([{ k: 'cyl', rt: 0.018, rb: 0.018, h: 1, seg: 4, y: 0.5 }]);
  // seagull: body + tail, folding wings, head, and a beak worth screaming with
  const gGullBody = npcMakeGeo([
    { k: 'sph', r: 0.14 },
    { w: 0.11, h: 0.05, d: 0.22, y: 0.02, z: -0.19, rx: 0.18 },
    { k: 'cyl', rt: 0.014, rb: 0.014, h: 0.13, seg: 4, x: -0.05, y: -0.15 },
    { k: 'cyl', rt: 0.014, rb: 0.014, h: 0.13, seg: 4, x: 0.05, y: -0.15 },
  ]);
  const gGullWing = npcMakeGeo([
    { w: 0.34, h: 0.03, d: 0.17, x: 0.17 },
    { w: 0.18, h: 0.025, d: 0.11, x: 0.40, z: -0.03 },
  ]);
  const gGullHead = npcMakeGeo([{ k: 'sph', r: 0.075, y: 0.05, z: 0.02 }]);
  const gGullBeak = npcMakeGeo([
    { k: 'cone', r: 0.028, h: 0.14, seg: 4, y: 0.04, z: 0.11, rx: 1.5 },
  ]);
  // the dog: torso, head with ears, one leg (x4) and a tail that never stops
  const gDogBody = npcMakeGeo([
    { w: 0.26, h: 0.26, d: 0.56 },
    { w: 0.28, h: 0.28, d: 0.20, y: 0.02, z: 0.18 },
    { k: 'cyl', rt: 0.09, rb: 0.09, h: 0.16, seg: 6, y: 0.10, z: 0.32, rx: 1.2 },
    { w: 0.30, h: 0.06, d: 0.06, y: 0.10, z: 0.36 },   // collar
  ]);
  const gDogHead = npcMakeGeo([
    { w: 0.22, h: 0.20, d: 0.22 },
    { w: 0.13, h: 0.11, d: 0.17, y: -0.03, z: 0.17 },  // snout
    { w: 0.06, h: 0.03, d: 0.05, y: -0.05, z: 0.26 },  // nose
    { w: 0.07, h: 0.13, d: 0.05, x: -0.10, y: 0.12, z: -0.02, rz: 0.3 },
    { w: 0.07, h: 0.13, d: 0.05, x: 0.10, y: 0.12, z: -0.02, rz: -0.3 },
  ]);
  const gDogLeg = npcMakeGeo([
    { w: 0.08, h: 0.30, d: 0.09, y: -0.15 },
    { w: 0.09, h: 0.05, d: 0.13, y: -0.29, z: 0.02 },
  ]);
  const gDogTail = npcMakeGeo([
    { k: 'cyl', rt: 0.03, rb: 0.05, h: 0.30, seg: 4, y: 0.13 },
  ]);

  const iGuitar = mkInst(gGuitar, 1);
  const iTray   = mkInst(gTray, 1);
  const iBHat   = mkInst(gBuskHat, 1);
  const iCup    = mkInst(gCup, 1);
  const iGullB  = mkInst(gGullBody, npcGULL_N);
  const iGullWL = mkInst(gGullWing, npcGULL_N);
  const iGullWR = mkInst(gGullWing, npcGULL_N);
  const iGullH  = mkInst(gGullHead, npcGULL_N);
  const iGullBk = mkInst(gGullBeak, npcGULL_N);
  const iDogB   = mkInst(gDogBody, 1);
  const iDogH   = mkInst(gDogHead, 1);
  const iDogL   = mkInst(gDogLeg, 4);
  const iDogT   = mkInst(gDogTail, 1);
  const leadMesh = new THREE_.Mesh(gLead, mat(PALETTE.cloth1, { vertexColors: true }));
  leadMesh.castShadow = false;
  leadMesh.frustumCulled = false;
  scene.add(leadMesh);

  // ------------------------------------------------------- speech bubbles
  // Pure DOM, in the HUD layer: no textures, no extra GPU state, crisp text.
  const BUB = 4;
  const bubbles = [];
  const BUB_CSS =
    'position:absolute;left:0;top:0;transform:translate(-50%,-100%);pointer-events:none;' +
    'display:none;opacity:0;white-space:nowrap;' +
    'font-family:"Trebuchet MS","Segoe UI",system-ui,sans-serif;' +
    'font-weight:700;font-size:15px;line-height:1.15;padding:7px 13px 8px;border-radius:13px;' +
    'background:' + npcCssHex(PALETTE.sail) + ';color:' + npcCssHex(PALETTE.capyEye) + ';' +
    'border:1.5px solid ' + npcCssHex(PALETTE.sandstoneDark) + ';' +
    'box-shadow:0 6px 14px ' + npcCssHex(PALETTE.stoneDark) + '55;' +
    'transform-origin:50% 100%;will-change:transform,opacity;';
  const TAIL_CSS =
    'position:absolute;left:50%;bottom:-6px;width:10px;height:10px;margin-left:-5px;' +
    'transform:rotate(45deg);background:' + npcCssHex(PALETTE.sail) + ';' +
    'border-right:1.5px solid ' + npcCssHex(PALETTE.sandstoneDark) + ';' +
    'border-bottom:1.5px solid ' + npcCssHex(PALETTE.sandstoneDark) + ';';
  for (let i = 0; i < BUB; i++) {
    const el = document.createElement('div');
    el.style.cssText = BUB_CSS;
    const tail = document.createElement('div');
    tail.style.cssText = TAIL_CSS;
    el.appendChild(tail);
    const txt = document.createElement('span');
    el.appendChild(txt);
    bubbles.push({ el, txt, mounted: false, owner: null, t: 0, life: 0, shown: false, ox: 0 });
  }

  function sayBubble(npcRec, text) {
    let slot = null;
    for (let i = 0; i < BUB; i++) {
      if (bubbles[i].owner === npcRec) { slot = bubbles[i]; break; }
    }
    if (!slot) for (let i = 0; i < BUB; i++) { if (!bubbles[i].owner) { slot = bubbles[i]; break; } }
    if (!slot) {
      let best = bubbles[0];
      for (let i = 1; i < BUB; i++) if (bubbles[i].t > best.t) best = bubbles[i];
      slot = best;
    }
    slot.owner = npcRec;
    slot.t = 0;
    slot.ox = 0;
    slot.life = 1.7 + text.length * 0.05;
    slot.txt.textContent = text;
  }

  // =========================================================================
  // THE LOCALS
  //
  // Sydney and Pasto have a CAST - articulated figures with a state machine, a
  // nav mesh, a reason to be where they are and a mouth. The other fourteen
  // chapters have PROPS SHAPED LIKE PEOPLE: the biscoito Globo man on
  // Copacabana is a cylinder, a sphere and a hat, merged into the beach mesh,
  // and he has never moved or said anything in his life. That is the single
  // biggest difference in feel between chapter one and chapter six, and it is
  // not a modelling problem - the models are charming. It is that nothing in
  // those worlds ACKNOWLEDGES the animal.
  //
  // Porting the full cast to fourteen worlds is a rewrite. This is the ninety
  // per cent that is not: any biome can register a point (and optionally a
  // Group it owns) as a LOCAL, and gets back
  //
  //   * a line when the capybara comes near, on a cooldown, never twice
  //     running the same one;
  //   * a second, different line when it wheeks at them;
  //   * and, if a Group was handed over, a turn to WATCH the animal go past
  //     and a breathing bob underneath it.
  //
  // The turn is the cheap half and it is most of the effect: a figure that
  // tracks you across a square stops being scenery about four frames in.
  // A local costs one distance check per frame and nothing at all in a chapter
  // that is not the one it belongs to.
  // =========================================================================
  // ---- THE BODY A LOCAL STANDS UP IN ------------------------------------
  // The chapters draw beautiful STALLS - an orange cart, a bakery counter, a
  // hot dog window - and then nobody behind them. A voice out of an empty
  // awning is a ghost story, not a person, so a local can ask for a figure and
  // gets one built here.
  //
  // Not the Sydney rig: that one is instanced across a cast of twenty-odd and
  // is wired into a nav mesh, a state machine and six task hooks. This is the
  // standing half of it - legs and torso in one merged mesh that never moves
  // relative to the group, plus a head and two arms on their own nodes, which
  // is everything you need for 'somebody is standing there, and they have
  // noticed you'. Four meshes each and about thirty of them in the whole game,
  // of which two or three are ever in a frame.
  //
  // Added through game.scene.add DURING the biome's own build, so the
  // streaming capture in main.js tags it to that chapter and it is detached
  // with everything else. A figure registered outside a build would follow the
  // player around the world for ever, which is the failure mode this whole
  // codebase is arranged to make impossible.
  const npcLOC_SKIN = [PALETTE.skin1, PALETTE.skin2, PALETTE.skin3, PALETTE.skin4];
  const npcLOC_HAIR = [PALETTE.hair1, PALETTE.hair2, PALETTE.hair3, PALETTE.hair4, PALETTE.hair5];
  const npcLOC_SHIRT = [PALETTE.cloth1, PALETTE.cloth2, PALETTE.cloth3, PALETTE.cloth4,
                        PALETTE.cloth5, PALETTE.cloth6, PALETTE.cloth7, PALETTE.cloth8];
  const npcLOC_LEG = [PALETTE.denim, PALETTE.khaki, PALETTE.stoneDark, PALETTE.hair1];
  const npcLocMats = Object.create(null);
  function npcLocMat(hex) {
    let m = npcLocMats[hex];
    if (!m) { m = new THREE_.MeshLambertMaterial({ color: hex }); npcLocMats[hex] = m; }
    return m;
  }
  function npcLocPart(w, h, d, hex, x, y, z) {
    const m = new THREE_.Mesh(new THREE_.BoxGeometry(w, h, d), npcLocMat(hex));
    m.position.set(x, y, z);
    m.castShadow = true;
    return m;
  }
  /**
   * A standing person, 1.72 m, facing +z. Returns the group and the two nodes
   * worth animating. `o` may name any of the four colours; anything not named
   * is picked, so twelve stalls do not end up staffed by twelve identical
   * people in the same shirt.
   */
  function buildLocalFigure(o) {
    const skin = o.skin || npcLOC_SKIN[randInt(0, npcLOC_SKIN.length - 1)];
    const hair = o.hair || npcLOC_HAIR[randInt(0, npcLOC_HAIR.length - 1)];
    const shirt = o.shirt || npcLOC_SHIRT[randInt(0, npcLOC_SHIRT.length - 1)];
    const legs = o.legs || npcLOC_LEG[randInt(0, npcLOC_LEG.length - 1)];
    const g = new THREE_.Group();
    g.add(npcLocPart(0.17, 0.78, 0.19, legs, -0.12, 0.39, 0));
    g.add(npcLocPart(0.17, 0.78, 0.19, legs, 0.12, 0.39, 0));
    g.add(npcLocPart(0.50, 0.62, 0.28, shirt, 0, 1.09, 0));
    // a collar, so the shirt reads as clothing rather than as a painted block
    g.add(npcLocPart(0.52, 0.07, 0.30, hair, 0, 1.38, 0));
    const headN = new THREE_.Object3D();
    headN.position.set(0, 1.42, 0);
    headN.add(npcLocPart(0.26, 0.30, 0.25, skin, 0, 0.15, 0));
    headN.add(npcLocPart(0.28, 0.10, 0.27, hair, 0, 0.29, -0.01));
    // the nose. One box, 4 cm, and it is the only reason the head has a FRONT
    // - without it a figure turning to watch you is a cube rotating.
    headN.add(npcLocPart(0.05, 0.05, 0.05, skin, 0, 0.15, 0.14));
    if (o.hat) headN.add(npcLocPart(0.42, 0.05, 0.42, o.hat, 0, 0.35, 0));
    g.add(headN);
    const armL = new THREE_.Object3D(); armL.position.set(-0.30, 1.32, 0);
    const armR = new THREE_.Object3D(); armR.position.set(0.30, 1.32, 0);
    armL.add(npcLocPart(0.13, 0.56, 0.14, shirt, 0, -0.28, 0));
    armR.add(npcLocPart(0.13, 0.56, 0.14, shirt, 0, -0.28, 0));
    armL.add(npcLocPart(0.12, 0.13, 0.13, skin, 0, -0.60, 0));
    armR.add(npcLocPart(0.12, 0.13, 0.13, skin, 0, -0.60, 0));
    g.add(armL); g.add(armR);
    return { group: g, head: headN, armL: armL, armR: armR };
  }

  // =======================================================================
  // ...AND THEY ANSWER MORE THAN TWO QUESTIONS NOW.
  //
  // A local reacted to exactly two things: you walking up to them, and you
  // wheeking. Which means that in the fifteen chapters whose entire population
  // is locals, you could shatter a crate of bowls at somebody's feet, put a
  // wine bottle through a shop window, drag a sack of coffee past their nose
  // or belt across a square at seven metres a second, and the nearest human
  // being would carry on breathing gently and watching you with mild interest.
  // Everything that makes this game funny is a thing you DO to the world, and
  // nobody in fifteen worlds had any opinion about any of it.
  //
  // Nothing new has to be plumbed: props.js already emits 'prop:impact' and
  // 'prop:water' with a position on them, and capybara.js emits 'capy:grab'.
  // They were being listened to by systems.js, for a sound, and by nobody else.
  //
  // The reaction is a FLINCH plus a line, and the flinch is the important half:
  // it is four numbers on a rig that already exists, it lands on the same frame
  // as the crash, and it works when the player is too far away to read a speech
  // bubble — which, for a thing that happens across a square, is most of the
  // time. The lines are on the same cooldown the greeting is on and the same
  // never-twice-running rule, because a crowd that comments on every bump is
  // a crowd you stop listening to.
  // =======================================================================
  // Deliberately chapter-neutral: npcLINES above is broad Sydney and these have
  // to work in a Venetian sacristy and on an Antarctic jetty. A local may
  // override any of them by passing its own array to addLocal.
  const npcLOC_SAY = {
    startled: ['!', 'Whoa —', 'What was that?', 'Careful!', 'Oh — steady.', 'Do you mind?',
               'That was not nothing.', 'I felt that.', 'Was that necessary?'],
    splash:   ['In it goes.', 'Well. It is gone now.', 'Was that on purpose?', 'Lovely.',
               'That is not coming back.', 'Hope it floats.'],
    thief:    ['That is not yours.', 'Excuse me?', 'Put that down.', 'Oh, wonderful.',
               'You are just taking that, are you.', 'Right. Yes. Fine.'],
    rush:     ['Whoa!', 'Mind out!', 'Where is it off to?', 'Somebody is in a hurry.',
               'Slow down!', 'It has somewhere to be.'],
    // ---- AND ONE MORE, FOR SOMEBODY WHO REMEMBERS YOU (v19) --------------
    // Said when you come back to a person you have already had a go at, and
    // held to the same chapter-neutral standard as the four above: no season,
    // no country, no building, nothing that assumes what you did. A person who
    // is watching you is not a person accusing you of anything specific.
    wary:     ['You again.', 'I am watching you.', 'Mm.', 'I know what you are.',
               'Not this time.', 'I have got my eye on you.', 'Oh, it is back.'],
    // ---- ...AND ONE FOR SOMEBODY WHO HAS DECIDED YOU ARE FINE (v22) ------
    // The mirror of `wary`, to the same chapter-neutral standard: no season,
    // no country, no building, and — the harder rule — nothing that assumes
    // you did anything. Familiarity in this game is earned by being present
    // and harmless, so every line here has to be sayable to an animal that has
    // done nothing whatsoever except stand there for a while.
    fam:      ['There you are.', 'Back again.', 'Hello, you.', 'Knew you would turn up.',
               'You are all right, you are.', 'Do not mind you.',
               'Half expected you.', 'Suppose you live here now.'],
    // ---- AND FOUR MORE, ABOUT THE WEATHER --------------------------------
    // Chapter-neutral to the same standard as the four above: every one of
    // these has to work on a Venetian quay, in a Mong Kok doorway, on an
    // Antarctic jetty and inside a mountain, which rules out naming a season,
    // a month, a country or a kind of building. What is left is what people
    // actually say about weather, which is almost nothing and is the point.
    drizzle:  ['Here it comes.', 'Of course it is.', 'That was not forecast.',
               'Ah. Lovely.', 'Right on time.', 'I did not bring a coat.',
               'It will pass.'],
    clearing: ['There we are.', 'That is better.', 'It has stopped.',
               'Blue, look.', 'Short one, that.', 'Told you it would pass.'],
    // What you say when something drifts past your face. Deliberately smaller
    // than the others — this is a person noticing, not a person commenting.
    //
    // AND IT MAY NOT BE ABOUT BLOSSOM. The first cut had 'Every year.' and
    // 'Where do they all come from?', which are lines about falling leaves —
    // and this list is spoken over nine different mote fields including the
    // dust in Jemaa el-Fnaa and the spindrift off the Antarctic ice, where a
    // stallholder wistfully remarking that it happens every year is nonsense.
    // Every line here has to work for petals, dust, spray, spores and snow.
    drift:    ['Oh —', 'Hm.', 'Look at that.', 'Where does it all come from?',
               'That is nice, actually.', 'It is in my eyes.'],
    chill:    ['Bit sharp.', 'Ooh.', 'Cold one.', 'That went right through me.',
               'Feel that?', 'Brr.'],
    // ---- ...AND ONE FOR SOMEBODY EATING SOMETHING NEARBY (v23) ----------
    // Spoken by a bystander rather than by the owner — the owner has their own
    // pool and comes to take it off you. Held to the same standard: this is
    // said over a Marrakech orange cart, a Kyoto tea stall, a Hong Kong bakery
    // and an Antarctic ration crate, so it may not name a food or a country.
    produce:  ['It is eating that.', 'Is it allowed to do that?',
               'Well, it is enjoying itself.', 'That was somebody’s.',
               'Just going to eat it, then.', 'Look at it go.'],
  };
  const locals = [];
  const npcLOC_TURN = 3.4;      // rad/s the body swings to face the animal
  const npcLOC_BOB = 0.014;     // metres of breathing
  // ---- the flinch ---------------------------------------------------------
  // A spring, like everything else in this codebase that has to recover rather
  // than step. Critically damped at a ~180 ms constant: fast enough to read as
  // a reaction to the bang and slow enough not to look like a glitch.
  const npcLOC_FL_K    = 34;
  const npcLOC_FL_C    = 11.7;
  const npcLOC_FL_LEAN = 0.30;   // rad of lean-back at full strength
  const npcLOC_FL_ARM  = 1.15;   // rad the arms come up
  const npcLOC_FL_HEAD = 0.34;   // rad the head snaps back
  const npcLOC_REACT_R = 13;     // m — you have to be near enough to have done it
  const npcLOC_REACT_N = 2;      // never more than two people speak at once
  const npcLOC_RUSH_V  = 6.2;    // m/s past somebody that counts as belting past
  const npcLOC_RUSH_R  = 3.4;    // ...and how close you have to be for it to matter

  // ---- WARINESS (v19) -----------------------------------------------------
  // The mildest possible version of the world pushing back, and deliberately
  // so. For eighteen versions a person's alarm damped to zero in under a second
  // and nothing survived it: you could rob the same stallholder, be chased, be
  // shouted at, and four seconds later be an unremarkable rodent again. That is
  // the half of the mischief loop this game has never had — approach, get
  // spotted, back off, come at it another way.
  //
  // So: a person REMEMBERS. `wary` rises the moment you do something to them
  // and falls off over npcWARY_T seconds, and what it buys is ATTENTION and
  // nothing else:
  //
  //   - they turn and watch you from further away, and go on watching;
  //   - they notice you again sooner;
  //   - and they have a line for it.
  //
  // IT DOES NOT DENY ANYTHING. Not one of the hundred and ninety-nine tasks is
  // harder to complete, no grab fails, nothing is taken away and nothing can be
  // lost — the stakes live in the FINDS instead (see sysFINDS in systems.js),
  // where a handful of unlisted things ask you to do something with nobody
  // watching. That is the whole of the design: the old content is untouched and
  // the new content is where the tension went.
  const npcWARY_T     = 26;      // s from full wariness back to none. Linear.
  const npcWARY_NEAR  = 1.7;     // how much further a wary person watches you
  const npcWARY_HEAT  = 0.35;    // over this, npcHeat() counts you as watched
  const npcWARY_BLAME = 7;       // m from an event inside which it was probably you
  const npcWARY_SEE   = 5;       // m of extra notice range at full wariness

  // =======================================================================
  // ...AND `wary` HAD NO POSITIVE TWIN.
  //
  // For two versions a person could remember exactly one thing about you: that
  // you had done something to them. Every other way of spending time near
  // somebody — standing there, saying nothing, being harmless for two minutes
  // — was worth precisely nothing, and a world where the only relationship on
  // offer is suspicion is not the world this game is about.
  //
  // `fam` is the mirror image of `wary` and is built out of exactly the same
  // three parts, so there is nothing new to learn:
  //
  //   IT RISES while you are inside their circle and NOTHING IS HAPPENING —
  //   which is THE CALM (see systems.js), read once a frame for the whole
  //   population. Sprinting past somebody does not make you friends.
  //   IT FALLS the moment `wary` goes up, because being wary of somebody and
  //   familiar with them at the same time is not a state a person is in.
  //   IT BUYS ATTENTION AND NOTHING ELSE, exactly like wary: a warmer pool,
  //   a shorter cooldown, and one line the first time it crosses.
  //
  // AND IT IS THE OTHER END OF THE SOFT WHEEK. Wave one gave the animal a
  // gentle register that had to be earned by settling and that nothing in the
  // game answered. This is what answers it: a soft wheek at somebody you have
  // been standing quietly beside is worth four seconds of familiarity, and a
  // loud one is worth none.
  //
  // It denies nothing, gates nothing and cannot be lost by accident. It is
  // slower to earn than wariness is (npcFAM_T against a single event) and it
  // fades over a much longer clock, so a chapter you have spent time in is a
  // chapter whose people know you.
  const npcFAM_T      = 34;      // s inside somebody's circle, calm, to reach 1
  const npcFAM_FADE   = 150;     // s from full familiarity back to none
  const npcFAM_HEAT   = 0.45;    // over this they greet you as somebody they know
  const npcFAM_WHEEK  = 0.12;    // what one soft wheek in earshot is worth
  const npcFAM_COOL   = 0.55;    // how far a familiar person's cooldown shortens

  // ---- AND A HUNDRED AND TEN PEOPLE WHO NEVER MOVED A METRE ---------------
  // The note above (WHAT IS DELIBERATELY NOT HERE) rules out walking, and it
  // is still right: a local has no nav mesh, no path and no destination, and
  // giving fifteen chapters one is not a thing this pass may do. But "may not
  // cross a square" and "may not shift their feet" are not the same sentence,
  // and the second one is what was actually shipped — every person in fifteen
  // chapters was welded to a coordinate for the life of the game.
  //
  // THE SHUFFLE is the honest amount of movement a fixed point can have, and
  // it is safe with no navigation at all for one reason: the target is always
  // within npcLOC_STEP_R of the ANCHOR THE CHAPTER CHOSE. A person can never
  // leave the square metre they were placed on, so they can never walk into
  // anything that was not already touching them, and a chapter that put
  // somebody in a doorway still has somebody in that doorway.
  //
  // No legs are drawn: a local's legs are a merged mesh with no joints in it.
  // What sells it is the bob at step frequency and the lean into the move,
  // which is what a person shifting their weight actually looks like from the
  // six metres this game is played at.
  const npcLOC_STEP_R   = 0.55;  // m from the anchor a person may ever drift
  const npcLOC_STEP_V   = 0.40;  // m/s. A shuffle, not a walk.
  const npcLOC_STEP_GAP = 15;    // s between shuffles, jittered hard per person
  const npcLOC_STEP_BOB = 0.020; // m of step bob while actually moving

  // ---- ...AND NOBODY IN FIFTEEN CHAPTERS EVER SPOKE TO ANYBODY ELSE -------
  // chatStep — two people turning to each other and having four seconds of
  // conversation that is not about you — is the best thing the Sydney crowd
  // does, and it ran in two chapters of seventeen because it is written
  // against the roster shape that only those two have. The locals are a
  // different shape (a fixed point with a speech anchor, not a state machine
  // with a nav target), so this is its twin rather than a rewrite of it.
  //
  // THE POOL IS HELD TO THE npcLOC_SAY STANDARD: every line has to work on a
  // Venetian quay, in a Mong Kok doorway, on an Antarctic jetty and inside a
  // mountain, which rules out naming a season, a country, a month or a
  // building. What is left is what two people who see each other every day
  // actually say to each other, which is almost nothing, and that is the joke.
  //
  // ---- AND THE RADIUS IS THIRTEEN METRES, WHICH WAS MEASURED --------------
  // The first cut was 4.6 m, on the reasoning that a conversation happens at
  // conversational distance. Then the closest pair of locals in every chapter
  // was measured, and 4.6 m is a radius at which this feature does not exist:
  //
  //   under 4.6 m   Cali 4.20 · Marrakech 2.25 · the Pantanal 2.83 — and
  //                 nowhere else. THREE chapters of fifteen, one pair each.
  //   under 13 m    twelve of fifteen.
  //   never         Reykjavik 17.16 · Manly 18.38 · the Drift 36.16.
  //
  // A local is a FIXED POINT — that is the whole of what a local is — so unlike
  // the Sydney crowd, which walks and therefore forms pairs on its own, this
  // radius is the entire question of whether anybody in fifteen chapters ever
  // speaks to anybody. Thirteen metres is a word across a square rather than a
  // confidence, and the pool above is already written for exactly that: every
  // line in it is a greeting you can call, not a thing you lean in to say.
  //
  // The three it never fires in are the right three. Reykjavik's cast is at
  // separate stalls down a street, Manly's is spread over a hundred and twenty
  // metres of beach, and the Drift is a chapter about being the only one there.
  const npcLOC_CHAT_R   = 13.0;  // m apart — near enough to call across to
  const npcLOC_CHAT_LOOK= 5.0;   // s the pair go on facing each other
  const npcLOC_CHAT = {
    open: ['Morning.', 'You are here early.', 'Still here, then.', 'Any news?',
           'Busy?', 'How is it looking?', 'Did you see that?', 'All right?',
           'Same again tomorrow.', 'Long one today.'],
    back: ['Same as ever.', 'Mm.', 'Ask me later.', 'Do not.', 'Could be worse.',
           'Not really.', 'Every day.', 'It will keep.', 'Nearly done.',
           'You said that yesterday.'],
  };

  // =======================================================================
  // ...AND THEY NOTICE THE WEATHER.
  //
  // The locals are the population of fifteen chapters, and until now the only
  // thing that could change their behaviour was the capybara. A shower could
  // arrive, soak the square and leave, and every person standing in it would
  // carry on breathing gently — which is the same failure the flinch was
  // written to fix, one layer out: nothing in those worlds ACKNOWLEDGES the
  // world.
  //
  // Four reactions, in descending order of how much they cost:
  //
  //   UMBRELLA  it is raining hard enough, so up it goes. A real object, not
  //             a pose — two meshes on shared geometry, built the first time
  //             a given person needs one and kept thereafter.
  //   HUDDLE    a cold, dark, windy chapter: shoulders up, arms in, head
  //             down. This is what people do when there is nowhere to go.
  //   LOOK UP   something drifted past. The head tilts for a second and a
  //             third of the time they say so.
  //   LEAN      the body leans off the gust, which is one number and is the
  //             only one of the four you will notice without meaning to.
  //
  // WHAT IS DELIBERATELY NOT HERE: people walking to shelter, or crowding a
  // streetlamp. A local is a FIXED POINT — it is the ninety per cent of a cast
  // that is not a rewrite, and it has no nav mesh, no path and no destination.
  // Making them walk means giving fifteen chapters a nav graph, and inventing
  // shelter points means editing fifteen biome files, which this pass is not
  // allowed to do. The huddle is the honest version of the same beat: it is
  // what standing in the cold with nowhere to go actually looks like.
  // =======================================================================
  const npcLOC_UMB_ON   = 0.30;   // drizzle at which an umbrella is worth it
  const npcLOC_UMB_OFF  = 0.16;   // ...and hysteresis, or it flickers on the tail
  const npcLOC_UMB_LAM  = 3.2;    // how fast it opens. Fast: it is raining.
  // HOW FAR THE HOLDING ARM COMES UP, and it was measured rather than guessed.
  // The arm is one box hanging 0.60 m below a pivot at (0.30, 1.32), rotated
  // about X — so at -1.42 rad it points FORWARD and horizontal, and the first
  // cut had every local in Venice holding a canopy out at arm's length beside
  // their own ear like a waiter. At -2.55 the hand lands at (0.30, 1.82, 0.33),
  // which is up, slightly forward, and under the canopy.
  const npcLOC_UMB_ARM  = 2.55;
  const npcLOC_HUD_LAM  = 1.5;    // the huddle, which is a slow decision
  const npcLOC_LOOK_LAM = 4.0;
  const npcLOC_LOOK_DUR = 1.6;    // s a glance upward lasts
  const npcLOC_LOOK_GAP = 26;     // s between glances, jittered per person
  const npcLOC_WIND_REF = 6.0;    // m/s of gust that earns the full lean
  const npcLOC_WIND_MAX = 0.085;  // rad. Small — a lean, not a bow.
  const npcLOC_CHILL_G  = 3.4;    // m/s at which a cold chapter is worth saying
  // How cold a chapter is comes from the MOOD ROW and not from its `lock`.
  // This started as `{ night: 1, predawn: 1, interior: 1 }` — the dark
  // chapters are the cold ones — which is true in sixteen places and wrong in
  // the seventeenth, because Antarctica is locked to 'midday'. Measured: a
  // crowd standing in a 4.4 m/s katabatic wind on the peninsula at huddle 0.00
  // while Reykjavik, which is warmer, sat at 0.89. Cold is now its own number.
  const npcLOC_COLD_FALL = { night: 0.7, predawn: 0.8, interior: 0.6 };
  // ---- the weather, read ONCE for the whole population --------------------
  // Not per person. It is the same sky over all of them, and asking the
  // weather module forty times a frame for the same five floats is the sort of
  // cost that only shows up in the chapter with the most people in it, which
  // is the chapter you least want it to show up in. Read at the top of
  // update() rather than inside localsStep, because localsStep returns early
  // when a chapter has no locals and the Sydney cast below still needs them.
  let npcWxRain = 0, npcWxGustS = 0, npcWxGustX = 0, npcWxGustZ = 0;
  let npcWxMotes = 0, npcWxCold = 0;
  function npcWxRead() {
    const WX = game.weather;
    if (!WX) { npcWxRain = 0; npcWxGustS = 0; npcWxGustX = 0; npcWxGustZ = 0;
               npcWxMotes = 0; npcWxCold = 0; return; }
    npcWxRain = WX.drizzle();
    const gu = WX.gust();
    npcWxGustX = gu.x; npcWxGustZ = gu.z;
    npcWxGustS = Math.sqrt(gu.x * gu.x + gu.z * gu.z);
    const mood = WX.mood();
    npcWxMotes = mood.motes ? 1 : 0;
    // A cold chapter is one that SAYS it is cold and whose air is moving.
    // Marrakech at noon is windier than Reykjavik and nobody there is cold;
    // Antarctica is bright daylight and everybody there is. The wind is the
    // other half of it either way — cold still air is bearable and cold moving
    // air is not, which is the only reason a chill is worth drawing at all.
    const cd = typeof mood.cold === 'number' ? mood.cold
                                             : (npcLOC_COLD_FALL[mood.lock] || 0);
    npcWxCold = cd * clamp(npcWxGustS / npcLOC_WIND_REF, 0, 1);
  }
  // Shared umbrella geometry — built once, lazily, and only if some chapter
  // in this run ever actually rains on somebody.
  let npcUmbCanopy = null, npcUmbShaft = null;
  const npcUMB_COL = [PALETTE.cloth2, PALETTE.cloth4, PALETTE.cloth6,
                      PALETTE.cloth8, PALETTE.stoneDark];
  function npcMakeUmbrella(rec) {
    if (!npcUmbCanopy) {
      npcUmbCanopy = new THREE_.ConeGeometry(0.44, 0.30, 8);
      npcUmbShaft = new THREE_.CylinderGeometry(0.022, 0.022, 0.78, 5);
    }
    const g = new THREE_.Group();
    const col = npcUMB_COL[randInt(0, npcUMB_COL.length - 1)];
    // mat(), NOT npcLocMat(). The figures are boxes and a box shades the same
    // either way, so npcLocMat has always got away with a plain Lambert — but
    // a cone does not. Smooth-shaded, an eight-sided canopy renders as a soft
    // grey dome with no facets in it, which is the one thing in this game that
    // is not allowed to look round. mat() is flat-shaded and cached.
    const cm = new THREE_.Mesh(npcUmbCanopy, mat(col));
    cm.position.y = 0.30;
    cm.castShadow = true;
    const sm = new THREE_.Mesh(npcUmbShaft, npcLocMat(PALETTE.stoneDark));
    sm.castShadow = false;                     // a 2 cm stick is not a shadow
    g.add(cm); g.add(sm);
    // Over the head and a little to the holding side. It is NOT parented to
    // the arm: the arm is a single box with no elbow, so a canopy welded to
    // the hand swings through the figure's own skull on every raise. Held over
    // the head and the arm raised to meet it reads correctly at six metres and
    // cannot intersect anything.
    g.position.set(0.27, 1.80, 0.17);
    g.scale.setScalar(0.001);
    g.visible = false;
    rec.group.add(g);
    rec.umbG = g;
    return g;
  }
  /**
   * @param o {biome, x, y, z, group?, lines?, wheek?, near?, cool?, face?}
   *   biome  which chapter this person is standing in - they exist nowhere else
   *   group  optional Object3D to animate. Its position is the anchor if x is
   *          not given, and its rotation.y is what turns.
   *   lines  what they say when you come near
   *   wheek  what they say when you wheek at them (falls back to `lines`)
   *   near   metres. 7 by default, which is about a conversation.
   *   face   base yaw to return to when nobody is about
   */
  function addLocal(o) {
    if (!o || !o.biome) return null;
    let g = o.group || null;
    let fig = null;
    if (!g && o.figure) {
      fig = buildLocalFigure(o.figure === true ? {} : o.figure);
      g = fig.group;
      g.position.set(o.x || 0, o.y || 0, o.z || 0);
      g.rotation.y = o.face || 0;
      // scene.add, not root.add: the chapter that called this does not have to
      // hand over a root, and the capture tag is what owns it either way.
      game.scene.add(g);
      if (typeof game.registerShadowTarget === 'function') game.registerShadowTarget(g);
    }
    const rec = {
      biome: o.biome, group: g,
      x: o.x !== undefined ? o.x : (g ? g.position.x : 0),
      y: o.y !== undefined ? o.y : (g ? g.position.y : 0),
      z: o.z !== undefined ? o.z : (g ? g.position.z : 0),
      lines: o.lines || null, wheekLines: o.wheek || null,
      near: o.near || 7, cool: o.cool === undefined ? 13 : o.cool,
      face: o.face === undefined ? (g ? g.rotation.y : 0) : o.face,
      yaw: g ? g.rotation.y : 0, baseY: g ? g.position.y : 0,
      cd: rand(0, 3), t: rand(0, 6.28), was: false, last: '',
      // The draw bags, one per pool this person ever speaks from. See localLine.
      bags: {},
      // What they say when you finish something in front of them, keyed by task
      // id, plus a catch-all. Optional; the chapter-neutral default below is
      // what the other sixty-odd people use.
      onTask: o.onTask || null, praise: o.praise || null,
      fig: fig, gest: 0,
      // What they say when the world does something to them. All optional; a
      // local that names none of them falls back on npcLOC_SAY, so every
      // person already registered in every chapter gets the whole vocabulary
      // without one biome file being touched.
      says: {
        startled: o.startled || null, splash: o.splash || null,
        thief: o.thief || null, rush: o.rush || null,
        produce: o.produce || null, chain: o.chain || null,
      },
      fl: 0, flV: 0,            // the flinch spring
      flYaw: 0,                 // ...and which way to turn while it runs
      rushWas: false,
      // ---- THE SHUFFLE. `ax/az` is the anchor the chapter chose and is the
      // only thing that is ever measured against; x/z is where they have got
      // to, and it may never be more than npcLOC_STEP_R from it.
      ax: o.x !== undefined ? o.x : (g ? g.position.x : 0),
      az: o.z !== undefined ? o.z : (g ? g.position.z : 0),
      tx: o.x !== undefined ? o.x : (g ? g.position.x : 0),
      tz: o.z !== undefined ? o.z : (g ? g.position.z : 0),
      stepT: rand(2, npcLOC_STEP_GAP * 1.6), moving: 0, mv: 0,
      // ---- FAMILIARITY (see the block above `wary`) ----
      fam: 0, famWas: false,
      // ---- and who they are talking to, if anybody. `chatT` is how long they
      // go on facing them for; it beats the watch and loses to the flinch.
      chatT: 0, chatYaw: 0,
      // ---- THE MISCHIEF ECONOMY (see localOwnStep) ----
      // `own` is the prop they have gone to get back and is the ONLY thing that
      // lets a local leave npcLOC_STEP_R of their anchor. `ownT` is the clock
      // both ceilings read; `ownCool` is what stops one person spending the
      // whole chapter chasing you.
      own: null, ownT: 0, ownBack: false, ownCool: 0, ownSay: 0,
      // ---- what the weather has done to them (see ...AND THEY NOTICE) ----
      umb: 0, umbG: null, umbUp: false,   // the umbrella: level, mesh, latch
      hud: 0,                             // the huddle, 0..1
      look: 0, lookT: rand(4, npcLOC_LOOK_GAP),   // the glance up
      wetWas: false,                      // rising edge of "it has started"
      chillWas: false,
      // The bubble reader wants something with a .group.position, and a fixed
      // local has no head node to hang one off - so it carries a point.
      anchor: { group: { position: new THREE_.Vector3(
        o.x !== undefined ? o.x : (g ? g.position.x : 0),
        (o.y !== undefined ? o.y : (g ? g.position.y : 0)) + 1.35,
        o.z !== undefined ? o.z : (g ? g.position.z : 0)) }, lastLine: '' },
    };
    rec.anchor.speak = function (t) { sayBubble(rec.anchor, t); };
    // ---- A LOCAL IS A PERSON, AND A PERSON IS SOLID --------------------------
    // addBody() below is called from exactly one place, the boot spawn loop, so
    // its 32 bodies belong to Sydney and are removed from the world with it. The
    // locals — the only people standing in the other sixteen chapters — never got
    // a body at all, so every person in chapters 2 to 17 was walk-through.
    // Built HERE, inside the chapter's own capture tag, so main.js hands it to
    // the right biome and it is attached and detached with the figure it holds up.
    if (game.world) {
      const lb = new CANNON.Body({
        mass: 0,
        position: new CANNON.Vec3(rec.x, rec.y + 0.85, rec.z),
        material: (game.mats && game.mats.npc) ? game.mats.npc : undefined,
      });
      lb.addShape(new CANNON.Box(new CANNON.Vec3(0.26, 0.85, 0.24)));
      lb.previousPosition.copy(lb.position);
      lb.interpolatedPosition.copy(lb.position);
      lb.userData = { local: rec };
      game.world.addBody(lb);
      rec.body = lb;
    }
    locals.push(rec);
    return rec;
  }
  /** Say something at a bare world point. The one-liner version of a local. */
  function sayAt(x, y, z, text) {
    if (!text) return;
    const owner = { group: { position: new THREE_.Vector3(x, y + 1.35, z) }, lastLine: '' };
    sayBubble(owner, text);
  }
  /** One line from `arr`, never the one this local said last. */
  // =======================================================================
  // A LINE POOL IS NOT A FLAT LIST OF STRINGS ANY MORE (v20).
  //
  // Every one of the seventy-odd people standing in the sixteen chapters was a
  // fixed bag of three sentences, chosen with `randInt`, forever. Two things
  // were wrong with that and both are about the same thing — a person who
  // cannot say anything NEW is a person you stop walking up to:
  //
  //   1. THE DIE ROLL REPEATS. Three lines drawn at random with only a
  //      never-twice-running guard means the second thing you hear is the first
  //      thing you heard about half the time. A BAG fixes it for nothing: the
  //      pool is shuffled, drawn down to empty and refilled, so you hear all of
  //      somebody's material before you hear any of it twice.
  //   2. NOBODY KNOWS WHAT YOU HAVE DONE. The man beside the bell says 'pull it
  //      if you like, everybody does' whether you have never touched it or have
  //      just been standing under it when it went. A chapter is a sequence of
  //      things happening and the people in it were outside time.
  //
  // So an entry in `lines`/`wheek`/anything else may now be:
  //
  //     'a plain string'                       — always available
  //     { t: '…', after: 'task-id' }           — only once that task is ticked
  //     { t: '…', before: 'task-id' }          — only until it is
  //     { t: '…', when: () => bool }           — anything else at all
  //
  // ...and the pool itself may be a FUNCTION returning such an array, for the
  // cases where the whole set depends on something (night, the tide, whether
  // the bus has left). Nothing existing changes: an array of bare strings
  // resolves to itself, and the cost of the check is one `typeof` per entry.
  // =======================================================================
  const npcRESOLVED = [];          // scratch; localLine is called ~once a second
  function npcTaskDone(id) {
    return !!(id && game && typeof game.taskDone === 'function' && game.taskDone(id));
  }
  /** Flatten a pool to the strings that are true RIGHT NOW. Never allocates. */
  function localResolve(arr) {
    let src = arr;
    if (typeof src === 'function') { try { src = src(); } catch (e) { src = null; } }
    npcRESOLVED.length = 0;
    if (!src || !src.length) return npcRESOLVED;
    for (let i = 0; i < src.length; i++) {
      const e = src[i];
      if (typeof e === 'string') { npcRESOLVED.push(e); continue; }
      if (!e || !e.t) continue;
      if (e.after && !npcTaskDone(e.after)) continue;
      if (e.before && npcTaskDone(e.before)) continue;
      if (e.when) { let ok = false; try { ok = !!e.when(); } catch (err) { ok = false; } if (!ok) continue; }
      npcRESOLVED.push(e.t);
    }
    return npcRESOLVED;
  }
  /**
   * One line from `arr`, drawn from a BAG rather than rolled.
   *
   * The bag is keyed by a cheap signature of the resolved pool, so a person's
   * greetings, their answer to a wheek and their opinion about a dropped crate
   * each drain independently — and a pool that CHANGES (a conditional line
   * becoming available) refills, which is the behaviour you want: the new line
   * is the next thing they say.
   */
  function localLine(rec, arr) {
    const pool = localResolve(arr);
    if (!pool.length) return;
    const sig = pool.length + '' + pool[0];
    let bag = rec.bags[sig];
    if (!bag || !bag.length) {
      bag = rec.bags[sig] = pool.slice();
      // Fisher-Yates, and then one guard: if the bag would open on the line
      // they have just said, swap it with the one behind it.
      for (let i = bag.length - 1; i > 0; i--) {
        const j = randInt(0, i);
        const t = bag[i]; bag[i] = bag[j]; bag[j] = t;
      }
      if (bag.length > 1 && bag[bag.length - 1] === rec.last) {
        const t = bag[bag.length - 1]; bag[bag.length - 1] = bag[0]; bag[0] = t;
      }
    }
    const line = bag.pop();
    rec.last = line;
    rec.gest = 1.5 + line.length * 0.045;   // as long as the bubble, near enough
    rec.anchor.speak(line);
  }
  function localsSay(kind, payload) {
    // The wheek reaches everybody in earshot, which is a wider circle than the
    // one that starts a conversation - being shouted at from across a square is
    // exactly the sort of thing that gets a reaction out of a stranger.
    const capy = game.capy;
    if (!capy || !capy.position) return;
    const live = game.biome && game.biome.current;
    // ---- AND THE SOFT ONE IS A DIFFERENT SENTENCE ------------------------
    // Wave one gave the animal a gentle register that has to be earned by
    // settling first, and nothing anywhere in the game answered it: every
    // listener got the same event with one extra boolean nobody read. This is
    // the answer. A soft wheek at somebody is worth npcFAM_WHEEK of
    // familiarity — about eight of them from cold, or one on top of a minute
    // of standing quietly beside them — and once they are familiar it is
    // ANSWERED DIFFERENTLY: from the fam pool rather than the wheek pool,
    // which is the whole of the reward and is exactly the right size for it.
    const soft = !!(payload && payload.soft);
    let said = 0;
    for (let i = 0; i < locals.length && said < 2; i++) {
      const r = locals[i];
      if (r.biome !== live) continue;
      const dx = capy.position.x - r.x, dz = capy.position.z - r.z;
      if (dx * dx + dz * dz > (r.near * 1.9) * (r.near * 1.9)) continue;
      // The familiarity lands whether or not they are free to speak: being on
      // a cooldown is a fact about their mouth and not about their memory.
      if (soft && kind === 'wheek' && (r.wary || 0) < npcWARY_HEAT) {
        r.fam = Math.min(1, r.fam + npcFAM_WHEEK);
      }
      if (r.cd > 0) continue;
      // A familiar person answers a soft call warmly. A loud one always gets
      // the chapter's own written line, so nothing an author wrote is ever
      // replaced by the chapter-neutral pool.
      const famAns = soft && kind === 'wheek' && r.fam > npcFAM_HEAT &&
                     (r.wary || 0) <= npcWARY_HEAT;
      r.cd = r.cool * rand(0.7, 1.3) * (r.fam > npcFAM_HEAT ? npcFAM_COOL : 1);
      localLine(r, famAns ? (r.says.fam || npcLOC_SAY.fam)
                          : (kind === 'wheek' && r.wheekLines) ? r.wheekLines : r.lines);
      said++;
    }
  }
  /**
   * SOMETHING HAPPENED AT (x, z). Whoever is near enough flinches, and at most
   * npcLOC_REACT_N of them say so.
   *
   * `strength` 0..1 scales the flinch only — the line is the same line whether
   * a cup fell over or a crate exploded, because a person's vocabulary does not
   * have a magnitude. The lines are on the local's OWN cooldown, shared with
   * the greeting: somebody who has just said hello does not also shout about a
   * bin, which is the difference between a crowd and a nuisance.
   */
  function localsReact(kind, x, z, strength, radius) {
    if (!locals.length) return;
    const live = game.biome && game.biome.current;
    if (!live) return;
    const r = radius > 0 ? radius : npcLOC_REACT_R;
    const r2 = r * r;
    const s = clamp(strength === undefined ? 1 : strength, 0, 1);
    // ---- WAS THIS YOU? (v19) ---------------------------------------------
    // Wariness is a memory of what the ANIMAL did, so it may only be set by an
    // event the animal was standing next to. localsReact is also how a chapter
    // announces its own bangs — a crate off a barrow, a gate, a wave — and a
    // square that turns to watch you because a shutter fell over on the far
    // side of it is a square that is wrong about you.
    const cpR = game.capy && game.capy.position;
    const mine = !!(cpR && (cpR.x - x) * (cpR.x - x) + (cpR.z - z) * (cpR.z - z)
                           < npcWARY_BLAME * npcWARY_BLAME);
    let said = 0;
    for (let i = 0; i < locals.length; i++) {
      const L = locals[i];
      if (L.biome !== live) continue;
      const dx = x - L.x, dz = z - L.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > r2) continue;
      // Nearer is a bigger jump, and it never quite reaches nothing at the rim.
      const near = 1 - Math.sqrt(d2) / r;
      const kick = s * (0.35 + near * 0.65);
      // MEASURED: at *9 a typical bang — 9 m/s, three metres away — peaked the
      // spring at 0.21, which is 3.7 degrees of lean and 14 of arm. That is
      // under the threshold at which anybody can tell a person reacted at all.
      // At *21 the same event peaks near 0.5: 8.6 degrees of lean, 33 of arm,
      // and the clamp at 1.0 keeps a point-blank crate from folding anyone in
      // half.
      if (kick > 0.06) {
        L.flV -= kick * 21;
        L.flYaw = Math.atan2(dx, dz);          // they turn TOWARD the bang
        // ...and they remember it was you, for about half a minute.
        if (mine) L.wary = Math.min(1, (L.wary || 0) + kick);
      }
      if (said < npcLOC_REACT_N && L.cd <= 0) {
        const arr = L.says[kind] || npcLOC_SAY[kind];
        if (arr && arr.length) {
          L.cd = L.cool * rand(0.7, 1.3);
          localReactLine(L, arr);
          said++;
        }
      }
    }
  }

  // =======================================================================
  // THE MISCHIEF ECONOMY (v23)
  //
  // The aesthetic law of this game is the Untitled Goose Game one: the delight
  // is not the mischief, it is BEING WITNESSED doing it. `game.state.chaos`
  // has driven the music and the calm field since the day it was written and
  // it has never driven one person — so a chapter would let you walk off with
  // a stallholder's fruit, eat it in front of them and put the empty crate
  // through a window, and the reaction was one line from a pool of nine and a
  // flinch, from whoever happened to be standing nearest, about nothing in
  // particular.
  //
  // Three things, all chapter-neutral, all built out of what the chapters
  // already have (people with anchors, props with homes) so that no biome file
  // is touched and every chapter gets them at once:
  //
  //   OWNERSHIP  a prop belongs to whoever is standing nearest to where it
  //              LIVES. Rob it or knock it over and they come and get it.
  //   PRODUCE    eat somebody's food in front of them and you get told.
  //   CHAINS     one person reacting turns the head of the next one along.
  //
  // WHY "WHERE IT LIVES" AND NOT "WHERE IT IS": a prop in the animal's mouth is
  // halfway across the square, and the person whose it is, is not. `homeX/homeZ`
  // is the one field that says where a prop belongs, physRescue already treats
  // it as authoritative, and matching on it means a stolen thing keeps its owner
  // for the whole of the theft, which is the only version of this that is funny.
  // =======================================================================
  // ---- AND THE RADIUS IS ELEVEN METRES, WHICH WAS MEASURED ----------------
  // The first cut was 5.5 m, on the reasoning that your stock is at arm's
  // length. Then the distance from every prop's HOME to the nearest local who
  // can walk was measured in all seventeen chapters, and at 5.5 m the feature
  // barely exists: five chapters of fifteen have NOBODY who owns anything.
  // The nearest few, per chapter:
  //
  //   Göreme 2.8 · Antarctica 1.8 · Venice 2.1 · Sahara 3.6 · Palawan 3.9
  //   Kyoto 3.8 · Manly 4.1 · Quay 5.2 · Iceland 1.9 · Kowloon 6.2 · Rio 5.8
  //   Cali 9.5   — and then nothing until 14.7
  //   Sơn Đoòng 9.4, the Drift 24.0, the Pantanal 21.3 — chapters where the
  //   people and the things are simply not in the same part of the world, and
  //   at NO radius short of absurd does anybody own anything. Those three get
  //   their reactions from the other two chains; see qa/pf-adoption.js.
  //
  // At 11 m every chapter that has stock near people has at least two owned
  // props, and it is the same order as the 13 m pair-chat radius for the same
  // reason: this is a market pitch, not a handshake.
  const npcOWN_R      = 11;    // m from a prop's HOME inside which somebody owns it
  const npcOWN_V      = 1.25;  // m/s. A purposeful walk — nobody in this game sprints.
  // ...and the LEASH has to clear the radius, or a person can own a thing they
  // are not allowed to walk to and the state exists only to time out.
  const npcOWN_LEASH  = 15;    // m from their own anchor they will ever go. See below.
  const npcOWN_TAKE   = 1.5;   // m at which they have got it back
  const npcOWN_MASS   = 12;    // kg — nobody sets off after a thing they could not lift
  // ---- THE HARD CEILINGS, WHICH ARE THE WHOLE SAFETY ARGUMENT -------------
  // §THE CATCH-ALL STATE: a steering state with no ceiling is how the waiter
  // went forty seconds and never once reached a table, and how three farmers
  // never left their spawn. Retrieval has TWO exits that do not depend on
  // arriving — a clock on the way out and a clock on the way back — and at the
  // second one the state is torn down unconditionally and the person is put on
  // a course for their own anchor at shuffle speed. There is no branch in this
  // system in which a local can be left steering for ever.
  const npcOWN_OUT_T  = 10;    // s of walking out, however it goes
  const npcOWN_BACK_T = 14;    // s of walking home, ditto
  const npcOWN_COOL   = 20;    // s before the same person will set off again
  const npcOWN_SAY_T  = 3.2;   // s between the lines they say while following you

  // ---- CHAINS -------------------------------------------------------------
  // A crowd that all shouts at once is a cutscene and a crowd where one person
  // shouts and nobody else moves is a diorama. What actually happens in a square
  // is that somebody says something and the next person along looks over. So a
  // reaction line arms a one-shot: everybody inside npcCHAIN_R turns to face the
  // speaker for a moment, and exactly ONE of them — the nearest with a free
  // mouth — answers. Then it is spent. It cannot ripple, because a second look
  // does not arm a third.
  // ---- AND THIS RADIUS IS TWENTY, WHICH IS NOT THE CHAT RADIUS ------------
  // The obvious number is npcLOC_CHAT_R (13), and it is the wrong one: that is
  // the radius at which two people have a CONVERSATION, and this is the radius
  // at which one of them hears the other and looks over, which is further. The
  // closest pair in each chapter was measured by the pair-chat pass and at 13 m
  // three chapters have no pair at all — Reykjavík 17.16, Manly 18.38, the
  // Drift 36.16. At 20 m the first two come in and the Drift does not, which is
  // correct: its eight people are on separate floating islands and there is no
  // honest radius at which one of them can hear another.
  const npcCHAIN_R    = 20;    // m. MEASURED — see the closest-pair table above.
  const npcCHAIN_WIN  = 1.1;   // s the look is available for after the line
  const npcCHAIN_LOOK = 2.6;   // s they go on facing whoever said it
  const npcLOC_CHAIN = ['What?', 'What was that?', 'Did you see that?', 'Hm?',
                        'What is going on over there?', 'Oh, what now.',
                        'Something is happening.', 'Everybody all right?'];
  // What you say when somebody eats your stock in front of you. Chapter-neutral
  // to the npcLOC_SAY standard — no country, no season, no named food — because
  // this pool is spoken over a Marrakech orange cart, a Kyoto tea stall, a Hong
  // Kong bakery and an Antarctic ration crate alike.
  const npcLOC_PRODUCE = ['Hey — that is stock.', 'You are eating it.',
                          'That was for sale.', 'Do you mind?',
                          'Oh, help yourself.', 'That is coming out of somewhere.',
                          'Not the good ones.', 'I was going to sell that.'];
  // ...and what they say while trailing you across a square wanting it back.
  const npcLOC_CHASE = ['That is mine.', 'Give it here.', 'Bring it back.',
                        'Where are you going with that?', 'Come here.',
                        'I am not asking twice.', 'That is not yours.'];
  let locChainFrom = null, locChainT = 0;

  /**
   * The ground under a point, whichever chapter is live. `paY` is the same
   * function pinned to Pasto; this is its chapter-neutral twin, and it answers
   * NaN rather than 0 when the chapter publishes nothing, because a flat zero
   * in a chapter whose ground is at 14 m would drop somebody through the floor.
   */
  function localGroundY(x, z) {
    const live = game.biome && game.biome.current;
    const api = live === 'sydney' ? game.env : game[live];
    if (api && typeof api.terrainHeight === 'function') {
      try { const y = api.terrainHeight(x, z); if (isFinite(y)) return y; } catch (e) { /* not built */ }
    }
    return NaN;
  }

  /** A reaction line, which also arms the chain. Greetings do not. */
  function localReactLine(rec, arr) {
    localLine(rec, arr);
    locChainFrom = rec; locChainT = npcCHAIN_WIN;
  }

  /**
   * WHOSE IS IT? The nearest local, in the live chapter, whose ANCHOR is inside
   * npcOWN_R of where this prop lives — and who can actually walk, which means
   * a figure this module built. A chapter that merged its people into a stall
   * or a boat gets the lines and the flinch and not the walk, for exactly the
   * reason the shuffle takes the same gate: sliding that person half a metre
   * would take the jetty with them.
   */
  function localOwnerOf(prop) {
    if (!prop || prop.removed || prop.hidden) return null;
    if (!(prop.mass > 0) || prop.mass > npcOWN_MASS) return null;
    // A souvenir is the spine of the journey and may never be taken back.
    if (prop.keep) return null;
    const live = game.biome && game.biome.current;
    if (!live) return null;
    const hx = prop.homeX, hz = prop.homeZ;
    if (!(hx === hx && hz === hz)) return null;
    let best = null, bestD = npcOWN_R * npcOWN_R;
    for (let i = 0; i < locals.length; i++) {
      const r = locals[i];
      if (r.biome !== live || !r.fig || r.own || r.ownCool > 0) continue;
      const dx = hx - r.ax, dz = hz - r.az;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestD) { bestD = d2; best = r; }
    }
    return best;
  }

  /** Set off after it. Safe to call on anybody; it refuses politely. */
  function localOwnStart(rec, prop, say) {
    if (!rec || !prop || rec.own || rec.ownCool > 0 || !rec.fig) return false;
    rec.own = prop;
    rec.ownT = 0;
    rec.ownBack = false;
    rec.ownSay = 0;
    rec.stepT = 1e9;                 // the shuffle is off while this runs
    if (say && rec.cd <= 0) {
      rec.cd = rec.cool * rand(0.5, 0.9);
      localReactLine(rec, say);
    }
    return true;
  }

  /** End it, whatever state it is in, and point them home. */
  function localOwnEnd(rec) {
    rec.own = null;
    rec.ownT = 0;
    rec.ownBack = false;
    rec.ownCool = npcOWN_COOL * rand(0.8, 1.4);
    rec.tx = rec.ax; rec.tz = rec.az;
    rec.stepT = npcLOC_STEP_GAP * rand(0.6, 1.4);
  }

  /**
   * A STEP THAT WOULD PUT SOMEBODY INSIDE A WALL IS NOT TAKEN.
   *
   * The shuffle never needed this — it cannot leave the square metre the
   * chapter put the person on — and retrieval can go nine metres, so it does.
   * Filtered to the STATIC group (physGRP_STATIC is 1), which is walls, ground
   * and people; the prop being chased is in the dynamic group and is therefore
   * never the thing that stops them reaching it.
   *
   * ---- AND IT STARTS 1.2 m OUT, WHICH IS NOT AN ARBITRARY MARGIN ----------
   * The first cut started the ray at 0.45 m — clear of the walker's own 0.26 m
   * half-width, and nothing else. MEASURED in Marrakech: a stallholder set off
   * after a hat 4.4 m away and moved 0.48 m in 18.5 seconds, because THEIR OWN
   * COUNTER is the first solid thing in front of them and every step read as
   * blocked. Most of the people who own anything in this game are standing
   * behind the thing their stock is on, so a test that refuses to step past
   * one's own furniture is a test that switches the whole feature off. At 1.2 m
   * a counter, a crate or a bollard is already behind them by the time the ray
   * begins and a wall three metres off still stops them, which is the only
   * thing this needs to do.
   */
  const npcOWN_RAY_A = new CANNON.Vec3();
  const npcOWN_RAY_B = new CANNON.Vec3();
  const npcOWN_RAY_R = new CANNON.RaycastResult();
  const npcOWN_RAY_O = { collisionFilterMask: 1, skipBackfaces: true };
  function localStepBlocked(rec, nx, nz) {
    if (!game.world || !game.world.raycastClosest) return false;
    const dx = nx - rec.x, dz = nz - rec.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < 1e-4) return false;
    const ux = dx / d, uz = dz / d;
    const y = rec.y + 0.9;
    npcOWN_RAY_A.set(rec.x + ux * 1.20, y, rec.z + uz * 1.20);
    npcOWN_RAY_B.set(rec.x + ux * 2.00, y, rec.z + uz * 2.00);
    npcOWN_RAY_R.reset();
    try { game.world.raycastClosest(npcOWN_RAY_A, npcOWN_RAY_B, npcOWN_RAY_O, npcOWN_RAY_R); }
    catch (e) { return false; }
    return !!npcOWN_RAY_R.hasHit;
  }

  /** One frame of somebody going to get their thing back. */
  function localOwnStep(rec, dt) {
    const p = rec.own;
    rec.ownT += dt;
    // ---- the tear-downs, in order of how little they trust the world -------
    if (!p || p.removed || p.hidden || game.biome.current !== rec.biome) { localOwnEnd(rec); return; }
    if (rec.ownBack) {
      // home, or the clock. Either way this ends.
      const dh = Math.hypot(rec.ax - rec.x, rec.az - rec.z);
      if (dh < 0.5 || rec.ownT > npcOWN_BACK_T) { localOwnEnd(rec); return; }
      rec.tx = rec.ax; rec.tz = rec.az;
      return;
    }
    if (rec.ownT > npcOWN_OUT_T) {
      // THE CEILING. They give up out loud, and they walk back.
      if (rec.cd <= 0) { rec.cd = rec.cool * rand(0.8, 1.4); localReactLine(rec, rec.says.rush || npcLOC_SAY.rush); }
      rec.ownBack = true; rec.ownT = 0;
      rec.tx = rec.ax; rec.tz = rec.az;
      return;
    }
    const b = p.body;
    if (!b) { localOwnEnd(rec); return; }
    const px = b.position.x, pz = b.position.z;
    // ---- THE LEASH. A person does not leave their pitch. -------------------
    // Measured from the ANCHOR, like everything else about a local, and applied
    // to the PROP rather than to the walker: if you have carried it further than
    // this they stop, say so, and go back. It is the one rule that makes this
    // safe to switch on in seventeen chapters at once — nobody can be led away.
    if (Math.hypot(px - rec.ax, pz - rec.az) > npcOWN_LEASH) {
      rec.ownBack = true; rec.ownT = 0;
      rec.tx = rec.ax; rec.tz = rec.az;
      return;
    }
    // ---- and the thing itself ---------------------------------------------
    const d = Math.hypot(px - rec.x, pz - rec.z);
    if (d < npcOWN_TAKE) {
      if (p.held || p.owner) {
        // CAUGHT YOU. The existing theft chain already has the verb for this.
        if (game.physics && typeof game.physics.dropOwned === 'function') game.physics.dropOwned();
        if (rec.cd <= 0) { rec.cd = rec.cool * rand(0.6, 1.0); localReactLine(rec, npcLOC_CHASE); }
        rec.flV -= 8;                        // a lunge, on the flinch spring
        rec.flYaw = Math.atan2(px - rec.x, pz - rec.z);
        return;                              // ...and they pick it up next frame
      }
      // It is loose and they are standing over it. Put it back where it lives.
      rec.gest = 1.2;
      if (game.physics && typeof game.physics.rescue === 'function') game.physics.rescue(p);
      if (game.physics && typeof game.physics.puff === 'function') {
        game.physics.puff(p.homeX, p.homeY + 0.35, p.homeZ, 3);
      }
      if (typeof game.sfx === 'function') game.sfx('rustle', { volume: 0.35 });
      rec.ownBack = true; rec.ownT = 0;
      rec.tx = rec.ax; rec.tz = rec.az;
      return;
    }
    // ---- steer ------------------------------------------------------------
    rec.ownSay -= dt;
    if (rec.ownSay <= 0 && rec.cd <= 0 && p.held) {
      rec.ownSay = npcOWN_SAY_T * rand(0.8, 1.5);
      rec.cd = rec.cool * rand(0.4, 0.8);
      localReactLine(rec, npcLOC_CHASE);
    }
    const ux = (px - rec.x) / d, uz = (pz - rec.z) / d;
    let nx = rec.x + ux * 1.0, nz = rec.z + uz * 1.0;
    if (localStepBlocked(rec, nx, nz)) {
      // one try each way round it, then hold this frame. No path, no memory:
      // a local has neither and is not getting either here.
      const s = Math.sin(0.9), c = Math.cos(0.9);
      const ax2 = ux * c - uz * s, az2 = ux * s + uz * c;
      const bx2 = ux * c + uz * s, bz2 = -ux * s + uz * c;
      if (!localStepBlocked(rec, rec.x + ax2, rec.z + az2)) { nx = rec.x + ax2; nz = rec.z + az2; }
      else if (!localStepBlocked(rec, rec.x + bx2, rec.z + bz2)) { nx = rec.x + bx2; nz = rec.z + bz2; }
      else { nx = rec.x; nz = rec.z; }
    }
    rec.tx = nx; rec.tz = nz;
  }

  // ---- WHAT THEY NOTICE ---------------------------------------------------
  // Three events that already existed, already carried a position, and were
  // heard by the sound manager and by nobody else. The gates are deliberately
  // high: a prop settling on a table is not a bang, and a local who reacts to
  // one is a local who is reacting all day.
  const npcLOC_BANG = 4.2;      // m/s along the normal before it is worth turning round for
  game.events.on('prop:impact', function (p) {
    if (!p || !p.position) return;
    const sp = typeof p.speed === 'number' ? p.speed : 0;
    if (sp < npcLOC_BANG) return;
    localsReact('startled', p.position.x, p.position.z, clamp((sp - npcLOC_BANG) / 9, 0.25, 1));
  });
  game.events.on('prop:water', function (p) {
    if (!p || !p.position) return;
    // A splash is heard further than it is felt, so it is a wider circle and a
    // softer jump — you look up, you do not duck.
    localsReact('splash', p.position.x, p.position.z, 0.35, npcLOC_REACT_R * 1.5);
  });
  game.events.on('capy:grab', function (e) {
    // Robbing somebody in front of them is the funniest thing in the game and
    // fifteen chapters of people had no opinion about it. Tight radius: this is
    // 'that happened right here', not 'something happened somewhere'.
    const pr = e && e.prop;
    const b = pr && pr.body;
    if (!b) return;
    localsReact('thief', b.position.x, b.position.z, 0.5, 6.5);
    // ...AND WHOEVER IT BELONGS TO COMES AND GETS IT.
    const own = localOwnerOf(pr);
    if (own) localOwnStart(own, pr, own.says.thief || npcLOC_SAY.thief);
  });
  // ---- ...AND SO DOES KNOCKING IT OVER ------------------------------------
  // Same owner test, one gate higher than the flinch's: a cup nudged off a
  // table is a startle, a crate going over at seven metres a second is somebody
  // walking over to pick it up. The prop is the payload's own `prop` field
  // where physImpactPayload carries one.
  const npcOWN_BANG = 6.0;      // m/s — worth getting off your stool for
  game.events.on('prop:impact', function (p) {
    if (!p) return;
    const sp = typeof p.speed === 'number' ? p.speed : 0;
    if (sp < npcOWN_BANG) return;
    const pr = p.prop;
    if (!pr || pr.held) return;
    const own = localOwnerOf(pr);
    if (own) localOwnStart(own, pr, own.says.startled || npcLOC_SAY.startled);
  });
  // ---- EATING SOMEBODY'S STOCK IN FRONT OF THEM ---------------------------
  // `capy:graze` fires once per bite and carries the prop, and until now it was
  // heard by capybara.js (for a chew pose) and by nobody else. A person whose
  // produce it is gets a line and a shoo — the shoo being the arms-up flinch
  // this rig already has, pointed at the animal rather than at a bang — and
  // then they come and take it off you, which is the ownership walk above.
  game.events.on('capy:graze', function (pr) {
    if (!pr) return;
    const own = localOwnerOf(pr);
    const cp = game.capy && game.capy.position;
    if (!own) {
      // Nobody owns it, but somebody may still be standing near enough to have
      // an opinion, and a bite is a small quiet thing: a narrow circle.
      if (cp) localsReact('produce', cp.x, cp.z, 0.25, 5.0);
      return;
    }
    // THE SHOO: the flinch spring driven the other way, aimed at the animal.
    if (cp) own.flYaw = Math.atan2(cp.x - own.x, cp.z - own.z);
    own.flV -= 12;
    own.gest = 1.4;
    if (own.cd <= 0) {
      own.cd = own.cool * rand(0.5, 0.9);
      localReactLine(own, own.says.produce || npcLOC_PRODUCE);
    }
    own.wary = Math.min(1, (own.wary || 0) + 0.5);
    localOwnStart(own, pr, null);
  });

  // =======================================================================
  // ...AND SOMEBODY SAW YOU DO IT (v20).
  //
  // Ninety-odd tasks, and the entire acknowledgement for finishing one was a
  // tick, a toast and a burst of paper — all of them UI. The world itself never
  // said anything, which is the odd half of a game whose whole comedy is that
  // there are people standing about while you do this.
  //
  // So: whoever is NEAREST, and only if they are near enough to have actually
  // watched, says something. One person, not the crowd — a square that
  // applauds in unison is a cutscene, and one bloke turning round and going 'was
  // that deliberate?' is the joke. On the same cooldown as everything else, so
  // a fast run of three ticks does not produce three lines from the same mouth.
  //
  // A chapter may name the reaction per task (`onTask: { 'the-bell': [...] }`)
  // or per person (`praise: [...]`), and everything falls back to a
  // chapter-neutral pool that has to work in a Kyoto garden and on an
  // Antarctic jetty alike: nothing here names a place, a task or an object.
  const npcLOC_PRAISE = ['…was that deliberate?', 'Well. That happened.',
                         'Nobody asked you to do that.', 'Hm. Yes. Good.',
                         'I saw that.', 'You are pleased with yourself.',
                         'Right in front of me, as well.',
                         'I am going to tell people about this.',
                         'That is going to be somebody’s problem.'];
  const npcLOC_PRAISE_R = 15;    // m. Further than a conversation, nearer than a shout.
  // ...BUT A MARQUEE IS SHOUTED ABOUT. 15 m is the right distance for stealing
  // a spritz. It is the wrong distance for the one moment a chapter is for,
  // which is usually staged in the largest open space the chapter has: measured
  // in Venice, the nearest local to the centre of San Marco is 16.5 m and only
  // 41% of the piazza is within 15 m of anybody, so the three locals who were
  // written `onTask: 'acqua-alta'` lines could not fire them from the natural
  // place to stand for it. A `wow` row gets forty metres — still inside the
  // square, and it is the difference between a set piece being witnessed and a
  // set piece being a toast.
  const npcLOC_WOW_R = 40;
  // ---- ...AND A MARQUEE NOBODY WAS NEAR IS OWED THE LINE, NOT DENIED IT ----
  //
  // Forty metres is enough for a square. It is nothing like enough for a
  // chapter whose marquee happens out in the world, and this batch measured
  // three of them: Antarctica's `orca-ride` pays out 212.0 m from the nearest
  // of its six locals, Palawan's `the-bloom` is 47.9 m from the nearest of its
  // seven from the reef and 40.4 m from the drop-off, and the western half of
  // the Pantanal's legal crossing is 41.0 m from both of its witnesses. In all
  // three the chapter had WRITTEN the lines — `onTask: { 'orca-ride': [...] }`
  // appears on four Antarctic locals — and they were unreachable code.
  //
  // Nobody in range does not mean nobody hears about it. The line is held, and
  // the first person the player comes back within range of says it. That is
  // also just better than the immediate version: an empty ocean has nobody in
  // it BY DESIGN, and being met on the jetty by someone who already knows is a
  // warmer answer than a stranger applauding from the water.
  //
  // One at a time, and it dies at the border — a held line delivered in the
  // next chapter would be nonsense.
  let npcWowOwed = null, npcWowOwedBiome = null, npcWowOwedT = 0;
  const npcWOW_OWED_TTL = 600;   // s of gameplay; effectively "this visit"
  const npcWowIds = {};
  for (let i = 0; i < TASKS.length; i++) if (TASKS[i].wow) npcWowIds[TASKS[i].id] = 1;
  game.events.on('task:complete', function (e) {
    const id = e && e.id;
    const capy = game.capy;
    const cp = capy && capy.position;
    const live = game.biome && game.biome.current;
    if (!cp || !live || !locals.length) return;
    const R = npcWowIds[id] ? npcLOC_WOW_R : npcLOC_PRAISE_R;
    let best = null, bd = R * R;
    for (let i = 0; i < locals.length; i++) {
      const L = locals[i];
      if (L.biome !== live || L.cd > 0) continue;
      const dx = cp.x - L.x, dz = cp.z - L.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bd) { bd = d2; best = L; }
    }
    if (!best) {
      // Held. See npcWowOwed.
      if (npcWowIds[id]) { npcWowOwed = id; npcWowOwedBiome = live; npcWowOwedT = 0; }
      return;
    }
    // A person with something specific to say about THIS says it; otherwise the
    // general opinion. `arrive` rows are excluded by the chapter naming them —
    // being congratulated for turning up is the one line that would be silly.
    const arr = (best.onTask && best.onTask[id]) || best.praise || npcLOC_PRAISE;
    best.cd = best.cool * rand(0.9, 1.5);
    // They turn round for it, which is what makes it read from across a square.
    best.flV -= 5.5;
    best.flYaw = Math.atan2(cp.x - best.x, cp.z - best.z);
    localLine(best, arr);
  });

  // =======================================================================
  // TWO PEOPLE, TALKING TO EACH OTHER (v20).
  //
  // Every voice in sixteen chapters was addressed to the capybara. Which means
  // that in a street with nine people in it, nothing was ever said unless the
  // player walked up and stood there — the world had no conversation of its
  // own to overhear, and overhearing is most of what makes a place feel
  // inhabited.
  //
  // An EXCHANGE is two locals who are near each other and a list of two-line
  // scraps. It runs when the player is close enough to read both bubbles and
  // far enough not to be the subject, on a long jittered gap, and it takes the
  // pair's own cooldowns with it so nobody is talking over themselves.
  //
  // Deliberately not a dialogue tree: it is a spoken pair, once, and then it is
  // over. The point is to walk past something already in progress.
  const npcEX = [];
  const npcEX_MIN = 6;       // m — nearer than this and it is about you
  const npcEX_MAX = 26;      // m — further and you cannot read the bubbles
  const npcEX_GAP = 30;      // s between exchanges, jittered per pair
  /**
   * @param o {biome, a, b, lines:[[first, second], …], gap?}
   *   a, b  the two locals (records returned by addLocal), in speaking order
   */
  function addExchange(o) {
    if (!o || !o.a || !o.b || !o.lines || !o.lines.length) return null;
    const rec = { biome: o.biome || o.a.biome, a: o.a, b: o.b, lines: o.lines,
                  gap: o.gap || npcEX_GAP, t: rand(8, 22), step: 0, bag: [] };
    npcEX.push(rec);
    return rec;
  }
  function npcExStep(dt) {
    if (!npcEX.length) return;
    const live = game.biome && game.biome.current;
    const cp = game.capy && game.capy.position;
    for (let i = 0; i < npcEX.length; i++) {
      const X = npcEX[i];
      if (X.biome !== live) continue;
      X.t -= dt;
      // ---- the answer, a beat after the opening line -------------------
      if (X.step === 1) {
        if (X.t <= 0) {
          X.step = 0;
          X.t = X.gap * rand(0.7, 1.6);
          X.b.cd = X.b.cool * rand(0.6, 1.1);
          localLine(X.b, [X.said[1]]);
        }
        continue;
      }
      if (X.t > 0 || !cp) continue;
      if (X.a.cd > 0 || X.b.cd > 0) { X.t = rand(2, 5); continue; }
      const da = Math.hypot(cp.x - X.a.x, cp.z - X.a.z);
      const db = Math.hypot(cp.x - X.b.x, cp.z - X.b.z);
      const near = Math.min(da, db);
      if (near < npcEX_MIN || near > npcEX_MAX) { X.t = rand(2, 5); continue; }
      // a bag, for the same reason the lines are: you hear all of them first
      if (!X.bag.length) {
        X.bag = X.lines.slice();
        for (let k = X.bag.length - 1; k > 0; k--) {
          const j = randInt(0, k); const t = X.bag[k]; X.bag[k] = X.bag[j]; X.bag[j] = t;
        }
      }
      X.said = X.bag.pop();
      X.a.cd = X.a.cool * rand(0.6, 1.1);
      localLine(X.a, [X.said[0]]);
      // they turn to each other, which is the whole tell that this is not
      // aimed at the player
      X.a.flYaw = Math.atan2(X.b.x - X.a.x, X.b.z - X.a.z); X.a.flV -= 2.2;
      X.b.flYaw = Math.atan2(X.a.x - X.b.x, X.a.z - X.b.z); X.b.flV -= 2.2;
      X.step = 1;
      X.t = 1.6 + X.said[0].length * 0.035;
    }
  }

  function localsStep(dt) {
    if (!locals.length) return;
    const capy = game.capy;
    const live = game.biome && game.biome.current;
    const cx = capy && capy.position ? capy.position.x : 1e6;
    const cz = capy && capy.position ? capy.position.z : 1e6;
    // Belting past somebody is an event too, and it is the one the player
    // causes most often. Measured once per frame here rather than per local,
    // because the speed is the same for all of them.
    const cv = capy && capy.velocity;
    const csp = cv ? Math.sqrt(cv.x * cv.x + cv.z * cv.z) : 0;
    const rushing = csp > npcLOC_RUSH_V;
    const wxRain = npcWxRain, wxGustS = npcWxGustS, wxGustX = npcWxGustX;
    const wxGustZ = npcWxGustZ, wxMotes = npcWxMotes, wxCold = npcWxCold;
    // Read ONCE for the whole population, for the same reason the weather is:
    // it is the same number for all of them and asking systems.js a hundred
    // and ten times a frame for one float is the cost that only shows up in
    // the chapter with the most people in it. See THE CALM in systems.js.
    const calmNow = typeof game.calm === 'function' ? game.calm() : 0;
    // ---- THE MARQUEE LINE NOBODY WAS THERE TO SAY ------------------------
    // Delivered by the first person the player comes back within earshot of,
    // at the PRAISE radius rather than the wow radius: this one is said to your
    // face. See npcWowOwed at task:complete.
    if (npcWowOwed) {
      if (npcWowOwedBiome !== live) { npcWowOwed = null; npcWowOwedBiome = null; }
      else {
        npcWowOwedT += dt;
        if (npcWowOwedT > npcWOW_OWED_TTL) { npcWowOwed = null; npcWowOwedBiome = null; }
        else {
          let owedBest = null, owedD = npcLOC_PRAISE_R * npcLOC_PRAISE_R;
          for (let i = 0; i < locals.length; i++) {
            const L = locals[i];
            if (L.biome !== live || L.cd > 0 || !L.group) continue;
            const dx = cx - L.x, dz = cz - L.z;
            const d2 = dx * dx + dz * dz;
            if (d2 < owedD) { owedD = d2; owedBest = L; }
          }
          if (owedBest) {
            const arr = (owedBest.onTask && owedBest.onTask[npcWowOwed]) ||
                        owedBest.praise || npcLOC_PRAISE;
            owedBest.cd = owedBest.cool * rand(0.9, 1.5);
            owedBest.flV -= 5.5;
            owedBest.flYaw = Math.atan2(cx - owedBest.x, cz - owedBest.z);
            localLine(owedBest, arr);
            npcWowOwed = null; npcWowOwedBiome = null;
          }
        }
      }
    }
    // ---- THE CHAIN, spent once per reaction -------------------------------
    // Resolved BEFORE the per-person loop and consumed inside it, so the answer
    // is chosen by distance rather than by array order — otherwise the person
    // who speaks second is whoever happens to sit lower in `locals`, which in a
    // chapter that registers its cast in build order is always the same person.
    let chainSrc = null;
    if (locChainT > 0) {
      locChainT -= dt;
      if (locChainFrom && locChainFrom.biome === live) chainSrc = locChainFrom;
      if (locChainT <= 0) { locChainFrom = null; locChainT = 0; }
    }
    let chainBest = null, chainBestD = npcCHAIN_R * npcCHAIN_R;
    if (chainSrc) {
      for (let i = 0; i < locals.length; i++) {
        const r = locals[i];
        if (r === chainSrc || r.biome !== live || !r.group) continue;
        const dx = r.x - chainSrc.x, dz = r.z - chainSrc.z;
        const d2 = dx * dx + dz * dz;
        if (d2 > npcCHAIN_R * npcCHAIN_R) continue;
        // Everybody in earshot LOOKS. It costs two numbers and it is most of
        // what sells a square reacting to something.
        r.chatYaw = Math.atan2(chainSrc.x - r.x, chainSrc.z - r.z);
        r.chatT = npcCHAIN_LOOK;
        // ...and the nearest one with a free mouth is the one who answers.
        if (r.cd <= 0 && d2 < chainBestD) { chainBestD = d2; chainBest = r; }
      }
      if (chainBest) {
        chainBest.cd = chainBest.cool * rand(0.9, 1.6);
        // localLine, NOT localReactLine: a second look may not arm a third, or
        // one dropped crate walks round a square for ever.
        localLine(chainBest, chainBest.says.chain || npcLOC_CHAIN);
      }
      locChainFrom = null; locChainT = 0;
    }
    for (let i = 0; i < locals.length; i++) {
      const r = locals[i];
      if (r.biome !== live) continue;
      if (r.cd > 0) r.cd -= dt;
      r.t += dt;
      const dx = cx - r.x, dz = cz - r.z;
      const d2 = dx * dx + dz * dz;
      // ---- WARINESS: what they remember, rather than what they just felt ---
      // Linear, because this is a memory fading and not a spring settling, and
      // a memory that fades exponentially never quite goes.
      if (r.wary > 0) { r.wary -= dt / npcWARY_T; if (r.wary < 0) r.wary = 0; }
      // The one thing it buys: they watch you from further out. `near` is what
      // makes a local turn and track the animal, so this is the whole effect —
      // do something and the circle of people paying attention to you widens
      // for half a minute, and then it does not.
      const nearR = r.near * (1 + (r.wary || 0) * (npcWARY_NEAR - 1));
      const near = d2 < nearR * nearR;
      // ...and they have a line for it, once, when you come back into range.
      const nearNow = near && (r.wary || 0) > npcWARY_HEAT;
      if (nearNow && !r.waryWas && r.cd <= 0) {
        const arr = r.says.wary || npcLOC_SAY.wary;
        if (arr && arr.length) { r.cd = r.cool * rand(1.1, 1.9); localLine(r, arr); }
      }
      r.waryWas = nearNow;
      // ---- FAMILIARITY: what they remember about you being HARMLESS ------
      // Same shape as wariness and the same arithmetic, pointed the other way.
      // The rise needs three things at once — you inside their circle, the
      // world calm, and them not currently wary of you — which is why it takes
      // most of a minute of genuinely standing about and cannot be farmed by
      // running laps. The fall is a long slow linear fade, because this is the
      // half of a memory that ought to outlast the other half.
      if (near && calmNow > 0.25 && (r.wary || 0) < npcWARY_HEAT) {
        r.fam += (dt / npcFAM_T) * calmNow;
        if (r.fam > 1) r.fam = 1;
      } else if (r.fam > 0) {
        // Being wary of somebody takes it away faster than time does. It does
        // not zero it: one startled shout should not erase five minutes.
        r.fam -= dt / ((r.wary || 0) > npcWARY_HEAT ? npcFAM_FADE * 0.12 : npcFAM_FADE);
        if (r.fam < 0) r.fam = 0;
      }
      // ...and the one line, once, when they first decide you are all right —
      // on the same rising edge the wary line uses, and it loses to it, since
      // somebody who is watching you has not decided you are all right.
      const famNow = near && r.fam > npcFAM_HEAT && (r.wary || 0) <= npcWARY_HEAT;
      if (famNow && !r.famWas && !nearNow && r.cd <= 0) {
        const arr = r.says.fam || npcLOC_SAY.fam;
        if (arr && arr.length) { r.cd = r.cool * rand(1.1, 1.9); localLine(r, arr); }
      }
      r.famWas = famNow;
      // ---- ...and you just went past them at a sprint -------------------
      // A rising edge on "close AND fast", so one pass is one reaction and
      // running circles round somebody is not a machine gun (their own
      // cooldown is what actually stops that; this stops the flinch).
      const rushNow = rushing && d2 < npcLOC_RUSH_R * npcLOC_RUSH_R;
      if (rushNow && !r.rushWas) {
        r.flV -= 9.5;   // scaled with the react kick above
        r.flYaw = Math.atan2(dx, dz);
        if (r.cd <= 0) {
          const arr = r.says.rush || npcLOC_SAY.rush;
          if (arr && arr.length) { r.cd = r.cool * rand(0.8, 1.4); localLine(r, arr); }
        }
      }
      r.rushWas = rushNow;
      // ---- ...and the sky, which is happening to them too -----------------
      // Only a person this module BUILT gets any of this. A chapter that
      // handed over its own Group — a fisherman merged into a jetty, a monk
      // who is four boxes — has no head node, no arms and no known scale, and
      // stapling an umbrella to the middle of it would put a canopy through
      // somebody's face. They still get the lines.
      if (r.fig) {
        // THE UMBRELLA, ON A LATCH. Without hysteresis it opens and shuts
        // repeatedly all the way down the shower's long tail, which is the
        // single most irritating thing a background figure can do.
        if (!r.umbUp && wxRain > npcLOC_UMB_ON) r.umbUp = true;
        else if (r.umbUp && wxRain < npcLOC_UMB_OFF) r.umbUp = false;
        r.umb = damp(r.umb, r.umbUp ? 1 : 0, npcLOC_UMB_LAM, dt);
        if (r.umb > 0.01) {
          const g2 = r.umbG || npcMakeUmbrella(r);
          g2.visible = true;
          // It OPENS. The scale is the gesture — a canopy that fades in is a
          // ghost and one that pops in at full size is a bug report.
          g2.scale.set(0.28 + r.umb * 0.72, 0.45 + r.umb * 0.55, 0.28 + r.umb * 0.72);
          // ...and it tips into the wind, which is the whole body language of
          // holding one.
          g2.rotation.z = clamp(-wxGustX * 0.045, -0.34, 0.34);
          g2.rotation.x = clamp(wxGustZ * 0.045, -0.34, 0.34);
        } else if (r.umbG && r.umbG.visible) {
          r.umbG.visible = false;
        }
        r.hud = damp(r.hud, wxCold * (1 - r.umb * 0.5), npcLOC_HUD_LAM, dt);
        // THE GLANCE UP. Only where there is something to glance at, and on a
        // long jittered gap so that a square full of people is not a Mexican
        // wave of heads.
        r.lookT -= dt;
        if (r.lookT <= -npcLOC_LOOK_DUR) {
          r.lookT = npcLOC_LOOK_GAP * rand(0.55, 1.6);
          // A third of the time they mention it. The line is on the SAME
          // cooldown as the greeting, so somebody who has just said hello does
          // not also remark on the leaves.
          if (wxMotes && !wxRain && r.cd <= 0 && Math.random() < 0.34) {
            r.cd = r.cool * rand(0.9, 1.6);
            localLine(r, r.says.drift || npcLOC_SAY.drift);
          }
        }
        const looking = wxMotes && r.lookT <= 0 && wxRain < 0.25;
        r.look = damp(r.look, looking ? 1 : 0, npcLOC_LOOK_LAM, dt);
      }
      // ---- and they say when it starts and when it stops ------------------
      // Rising edges on both, so one shower is one remark and not a running
      // commentary. Everybody in earshot has their own cooldown, so a square
      // of twelve people produces two or three voices rather than twelve.
      const raining = wxRain > 0.26;
      if (raining !== r.wetWas) {
        r.wetWas = raining;
        if (r.cd <= 0 && Math.random() < 0.5) {
          r.cd = r.cool * rand(0.8, 1.5);
          localLine(r, raining ? (r.says.drizzle || npcLOC_SAY.drizzle)
                               : (r.says.clearing || npcLOC_SAY.clearing));
        }
      }
      const chilly = wxCold > 0 && wxGustS > npcLOC_CHILL_G;
      if (chilly !== r.chillWas) {
        r.chillWas = chilly;
        if (chilly && r.cd <= 0 && Math.random() < 0.3) {
          r.cd = r.cool * rand(1.0, 1.8);
          localLine(r, r.says.chill || npcLOC_SAY.chill);
        }
      }
      // ---- the flinch, which is a spring ---------------------------------
      if (r.fl !== 0 || r.flV !== 0) {
        r.flV += (-npcLOC_FL_K * r.fl - npcLOC_FL_C * r.flV) * dt;
        r.fl += r.flV * dt;
        if (r.fl < -1) { r.fl = -1; if (r.flV < 0) r.flV = 0; }
        if (r.fl > 0.4) { r.fl = 0.4; if (r.flV > 0) r.flV = 0; }
        if (Math.abs(r.fl) < 0.004 && Math.abs(r.flV) < 0.04) { r.fl = 0; r.flV = 0; }
      }
      // ---- THE SHUFFLE ---------------------------------------------------
      // Only a person this module BUILT, which is the same gate the umbrella
      // takes and it is here for a stronger reason: a chapter that handed over
      // its own Group may have merged that person into a jetty, a stall or a
      // boat, and sliding it half a metre would take the jetty with it — or,
      // worse, leave the person standing beside the thing they are part of.
      if (r.fig) {
        // ---- RETRIEVAL OUTRANKS THE SHUFFLE ---------------------------------
        // ...and it is the ONLY thing that does. While `own` is set, the target
        // is the thing they are going to get and not a point inside the square
        // metre the chapter put them on; the moment it clears, localOwnEnd has
        // already pointed them back at the anchor and the shuffle takes over
        // and walks them there. See THE MISCHIEF ECONOMY.
        if (r.own) {
          localOwnStep(r, dt);
        } else {
          if (r.ownCool > 0) r.ownCool -= dt;
          r.stepT -= dt;
          if (r.stepT <= 0) {
            r.stepT = npcLOC_STEP_GAP * rand(0.45, 2.1);
            // A new spot, measured from the ANCHOR and never from where they
            // have got to — which is what stops a random walk from wandering off
            // across the square one step at a time.
            const a = rand(0, 6.283185), rr = npcLOC_STEP_R * Math.sqrt(Math.random());
            r.tx = r.ax + Math.sin(a) * rr;
            r.tz = r.az + Math.cos(a) * rr;
          }
        }
        const sx = r.tx - r.x, sz = r.tz - r.z;
        const sd = Math.sqrt(sx * sx + sz * sz);
        if (sd > 0.012) {
          const step = Math.min(sd, (r.own ? npcOWN_V : npcLOC_STEP_V) * dt);
          r.x += sx / sd * step;
          r.z += sz / sd * step;
          r.moving = 1;
          // ---- ...AND THE GROUND COMES WITH THEM, ONCE THEY LEAVE THE SPOT ---
          // The shuffle never needed this: 0.55 m of ground is level enough
          // anywhere in this game, and `baseY` is what the chapter measured when
          // it placed them. Retrieval can go nine metres and Pasto, Rio, Iceland
          // and Cappadocia are not flat, so a person walking out on the fixed y
          // would wade into a slope or float off one. Damped, not snapped: the
          // terrain read is per-chapter and a hard write makes a person twitch
          // on every seam in the mesh.
          //
          // AND IT ONLY APPLIES WHILE THEY ARE AWAY. Inside the shuffle radius
          // the authority is `baseY` — the height the CHAPTER measured, which
          // for somebody standing on a jetty, a plinth or a step is not the
          // terrain at all. So: away, follow the ground; home, come back to
          // exactly the number the chapter chose.
          const away = r.own || (r.x - r.ax) * (r.x - r.ax) + (r.z - r.az) * (r.z - r.az)
                                > npcLOC_STEP_R * npcLOC_STEP_R;
          if (away || Math.abs(r.y - r.baseY) > 0.004) {
            let ty = r.baseY;
            if (away) { const gy = localGroundY(r.x, r.z); if (gy === gy) ty = gy; }
            r.y = damp(r.y, ty, 7, dt);
            r.group.position.y = r.y;
            r.anchor.group.position.y = r.y + 1.35;
            if (r.body) {
              const by = r.y + 0.85;
              r.body.position.y = by;
              r.body.previousPosition.y = by;
              r.body.interpolatedPosition.y = by;
            }
          }
          r.group.position.x = r.x;
          r.group.position.z = r.z;
          // The speech bubble hangs off a bare point, so it has to be dragged
          // along by hand or a shuffled person talks from where they used to be.
          r.anchor.group.position.x = r.x;
          r.anchor.group.position.z = r.z;
          // ...and so does the collider, or a person is solid where they were
          // rather than where they are. It is a static body, so all three of
          // cannon's position fields have to be written: the solver reads
          // `position`, and the render interpolation reads the other two.
          if (r.body) {
            r.body.position.x = r.x; r.body.position.z = r.z;
            r.body.previousPosition.x = r.x; r.body.previousPosition.z = r.z;
            r.body.interpolatedPosition.x = r.x; r.body.interpolatedPosition.z = r.z;
          }
        } else r.moving = 0;
      }
      // ---- they watch you go past --------------------------------------
      if (r.group) {
        // Twice the talking radius: you are noticed a long way before you are
        // spoken to, which is how being looked at actually works.
        const watch = d2 < (r.near * 2) * (r.near * 2) && d2 > 0.25;
        // ...and while a flinch is running they are looking at whatever just
        // went off, not at you. That is the whole point of turning round.
        const flin = r.fl < -0.02;
        // FIVE THINGS CAN OWN A HEAD AND THEY ARE STRICTLY RANKED. A bang beats
        // the person you are talking to; the person you are talking to beats
        // the capybara — which is the whole tell that a conversation is not
        // aimed at the player and is the same rule chatStep uses in Sydney;
        // the capybara beats where you are walking; and where you are walking
        // beats the direction the chapter put you in.
        if (r.chatT > 0) r.chatT -= dt;
        r.mv = damp(r.mv, r.moving, 6, dt);
        const want = flin ? r.flYaw
                   : r.chatT > 0 ? r.chatYaw
                   : watch ? Math.atan2(dx, dz)
                   : r.moving ? Math.atan2(r.tx - r.x, r.tz - r.z)
                   : r.face;
        let dyaw = want - r.yaw;
        while (dyaw > Math.PI) dyaw -= 6.283185;
        while (dyaw < -Math.PI) dyaw += 6.283185;
        // A flinch turns you faster than curiosity does.
        const step = npcLOC_TURN * (flin ? 2.4 : 1) * dt;
        r.yaw += clamp(dyaw, -step, step);
        r.group.rotation.y = r.yaw;
        // ...and they are breathing, which costs one sine and is the whole
        // difference between a person standing still and a statue.
        // The flinch rides on top: a lean back from the waist and a small drop,
        // which on a figure whose legs are a merged mesh is the only honest way
        // to say "recoiled" without a skeleton.
        const f = -r.fl;                       // 0..1, positive while recoiling
        // ---- THE LEAN, off the gust ---------------------------------------
        // Projected onto the direction the person is FACING, so somebody with
        // their back to the wind leans back and somebody facing it leans in,
        // which is the whole reason it reads as wind rather than as a wobble.
        // It ADDS to the flinch's lean rather than fighting it: a startled
        // person in a gale is both, and both are small.
        let lean = 0;
        if (wxGustS > 0.2) {
          const fx = Math.sin(r.yaw), fz = Math.cos(r.yaw);
          lean = clamp((wxGustX * fx + wxGustZ * fz) / npcLOC_WIND_REF,
                       -1, 1) * npcLOC_WIND_MAX;
        }
        // ...and the huddle takes a couple of centimetres out of them, which
        // on a figure with no spine is how you draw shoulders coming up.
        // ...and while they are shuffling there is a second, faster bob on top
        // of the breathing, at step frequency. It is the whole animation: the
        // legs are a merged mesh with no joints in them, so weight going up
        // and down is the only honest way to draw somebody taking a step, and
        // at the six metres this game is played at it is enough.
        r.group.position.y = r.baseY + Math.sin(r.t * 1.15) * npcLOC_BOB
                             + r.mv * Math.abs(Math.sin(r.t * 7.4)) * npcLOC_STEP_BOB
                             - f * 0.045 - r.hud * 0.035;
        r.group.rotation.x = -f * npcLOC_FL_LEAN + lean + r.hud * 0.06
                             - r.mv * 0.035;
        if (r.fig) {
          // The head leads the turn and overshoots it slightly, which is what
          // makes a look read as a look rather than as a body rotating: the
          // neck gets there first and the shoulders follow.
          const lead = clamp(dyaw, -0.75, 0.75);
          r.fig.head.rotation.y = damp(r.fig.head.rotation.y, lead, 7, dt);
          // ...and the head DIPS a little for something the size of a capybara,
          // which is the whole joke of being looked at by a person.
          // ...and the head goes BACK during a flinch, which is the opposite of
          // the dip and has to win, or a startled person is drawn peering
          // fondly downwards at the thing that just exploded.
          const dip = watch ? clamp(0.55 - Math.sqrt(d2) * 0.03, 0, 0.42) : 0;
          // ...and two more things the head does. A GLANCE UP at whatever is
          // drifting past — negative, because the dip is positive — and a
          // HUDDLE, which is the chin going into the collar and is the
          // opposite. Both lose to the flinch, which is already the rule for
          // the dip and is right for the same reason: a person reacting to a
          // bang is not also admiring the blossom.
          r.fig.head.rotation.x = damp(r.fig.head.rotation.x,
                                       dip - f * npcLOC_FL_HEAD
                                       - r.look * 0.62 + r.hud * 0.22,
                                       f > 0.02 ? 14 : 5, dt);
          // arms: a slow shift of weight, and one of them comes up while they
          // are actually talking — and BOTH come up, fast, on a flinch.
          if (r.gest > 0) r.gest -= dt;
          const sway = Math.sin(r.t * 0.83) * 0.07;
          const talk = r.gest > 0 ? 0.5 + Math.sin(r.t * 7.5) * 0.22 : 0;
          const guard = f * npcLOC_FL_ARM;
          const armL = f > 0.02 ? 22 : 4, armR = f > 0.02 ? 22 : 8;
          // THE ARM THAT IS HOLDING THE UMBRELLA CANNOT ALSO BE SWAYING. It
          // goes up and it stays there; the talking gesture is suppressed on
          // that side for as long as there is something in the hand, which is
          // what stops a person waving a canopy about while they speak.
          const hold = r.umb;
          // ...and the huddle folds BOTH arms in across the body: rotation.z
          // toward the centre line, which on two boxes with no elbows is the
          // only crossed-arms available and reads correctly from six metres.
          const fold = r.hud;
          r.fig.armL.rotation.x = damp(r.fig.armL.rotation.x,
                                       sway - guard - fold * 0.42, armL, dt);
          r.fig.armR.rotation.x = damp(r.fig.armR.rotation.x,
                                       -sway - talk * (1 - hold) - guard
                                       - hold * npcLOC_UMB_ARM - fold * 0.42, armR, dt);
          r.fig.armR.rotation.z = damp(r.fig.armR.rotation.z,
                                       -talk * 0.7 * (1 - hold) - f * 0.4
                                       - hold * 0.20 - fold * 0.34, armR, dt);
          r.fig.armL.rotation.z = damp(r.fig.armL.rotation.z,
                                       f * 0.4 + fold * 0.34, armL, dt);
        }
      }
      // ---- and they say something the first time you arrive -------------
      if (near && !r.was && r.cd <= 0 && r.lines) {
        r.cd = r.cool * rand(0.8, 1.4);
        localLine(r, r.lines);
      }
      r.was = near;
    }
  }

  // =======================================================================
  // TWO LOCALS TALKING TO EACH OTHER.
  //
  // The twin of chatStep, written against the locals' shape instead of the
  // Sydney roster's. It is a separate function rather than a generalisation of
  // that one because the two shapes genuinely have nothing in common: a Sydney
  // human is a state machine with a nav target, a speech record and a `state`
  // that has to be calm; a local is a fixed point with a bubble anchor and a
  // cooldown. Forcing one function to read both would be four `||`s in the hot
  // loop for the sake of not having twenty lines twice.
  //
  // Same two-countdown structure and the same reason for it (see chatStep):
  // the SCAN is cheap and frequent, the CONVERSATION is slow, and the reply is
  // owed from a later frame so that the pair are not both talking at once.
  // =======================================================================
  let locChatT = rand(3, 8);
  let locChatRec = null, locChatWhen = 0;
  function localsChat(dt) {
    if (locChatRec) {
      locChatWhen -= dt;
      if (locChatWhen <= 0) {
        const b = locChatRec;
        locChatRec = null;
        // ...unless something has happened to them in the meantime, in which
        // case the question simply hangs, which is the better joke anyway —
        // the same rule chatStep landed on for the same reason.
        if (b.biome === (game.biome && game.biome.current) && b.fl > -0.02) {
          b.cd = b.cool * rand(0.7, 1.2);
          localLine(b, npcLOC_CHAT.back);
        }
      }
      return;
    }
    locChatT -= dt;
    if (locChatT > 0) return;
    locChatT = rand(2.5, 5.5);
    if (locals.length < 2) return;
    const live = game.biome && game.biome.current;
    // ONE PROBE FROM A RANDOM START, never an O(n²) sweep: this runs in the
    // chapter with a hundred and ten people in it and a failed scan has to be
    // affordable three times a minute.
    const n = locals.length;
    const s0 = randInt(0, n - 1);
    for (let k = 0; k < n; k++) {
      const a = locals[(s0 + k) % n];
      if (!a || a.biome !== live || !a.group || a.cd > 0 || a.fl < -0.02) continue;
      for (let j = 1; j < n; j++) {
        const b = locals[(s0 + k + j) % n];
        if (!b || b === a || b.biome !== live || !b.group || b.cd > 0 || b.fl < -0.02) continue;
        const dx = a.x - b.x, dz = a.z - b.z;
        const d2 = dx * dx + dz * dz;
        if (d2 > npcLOC_CHAT_R * npcLOC_CHAT_R || d2 < 0.04) continue;
        // They turn to each other, which is most of what sells it, and they go
        // on facing each other for a few seconds after the words have gone —
        // a conversation that ends the instant the bubble does reads as two
        // people being ventriloquised.
        a.chatYaw = Math.atan2(b.x - a.x, b.z - a.z); a.chatT = npcLOC_CHAT_LOOK;
        b.chatYaw = Math.atan2(a.x - b.x, a.z - b.z); b.chatT = npcLOC_CHAT_LOOK;
        a.cd = a.cool * rand(0.9, 1.5);
        localLine(a, npcLOC_CHAT.open);
        locChatRec = b;
        locChatWhen = rand(1.4, 2.3);
        locChatT = rand(11, 28);     // ...and now the long one, so it is not a chorus
        return;
      }
    }
  }

  function pickLine(npcRec, key) {
    const arr = npcLINES[key];
    if (!arr) return;
    let i = randInt(0, arr.length - 1);
    for (let k = 0; k < 3 && arr.length > 2 &&
         (arr[i] === npcRec.lastLine || arr[i] === npcLastGlobal[key]); k++) {
      i = (i + 1) % arr.length;
    }
    npcRec.lastLine = arr[i];
    npcLastGlobal[key] = arr[i];
    npcRec.speak(arr[i]);
  }

  // ------------------------------------------------------------ photo flash
  const flashes = [];
  const gFlash = new THREE_.BoxGeometry(1, 1, 0.02);
  for (let i = 0; i < 2; i++) {
    const fm = mat(PALETTE.sail).clone();
    fm.transparent = true; fm.opacity = 0;
    fm.depthWrite = false; fm.depthTest = false; fm.fog = false;
    const q = new THREE_.Mesh(gFlash, fm);
    q.visible = false;
    q.renderOrder = 21;
    scene.add(q);
    flashes.push({ q, fm, t: 999 });
  }
  let flashCur = 0;
  function fireFlash(x, y, z) {
    const f = flashes[flashCur];
    flashCur = (flashCur + 1) % flashes.length;
    // nudge the quad off the photographer's own arm, toward the camera
    npcV2.set(game.camera.position.x - x, game.camera.position.y - (y + 0.12), game.camera.position.z - z);
    const l = npcV2.length() || 1;
    f.q.position.set(x + npcV2.x / l * 0.45, y + 0.12 + npcV2.y / l * 0.45, z + npcV2.z / l * 0.45);
    f.q.visible = true;
    f.t = 0;
  }

  // ----------------------------------------------------------- harbour foam
  // An adult going over the sea wall deserves more feedback than a dropped
  // ferry ticket. props.js owns its own foam rings and exposes no hook, so we
  // carry three of our own: open-ended cylinders that expand and fade on the
  // water. Hidden when idle, so they cost nothing except during a splash.
  const splashes = [];
  const gSplash = new THREE_.CylinderGeometry(1, 1, 0.05, 8, 1, true);
  for (let i = 0; i < 3; i++) {
    const sm = mat(PALETTE.foam, { side: THREE_.DoubleSide }).clone();
    sm.transparent = true; sm.opacity = 0; sm.depthWrite = false; sm.fog = false;
    const q = new THREE_.Mesh(gSplash, sm);
    q.visible = false;
    scene.add(q);
    splashes.push({ q, sm, t: 99, delay: i * 0.10 });
  }
  function fireSplash(x, y, z) {
    for (let i = 0; i < splashes.length; i++) {
      const s = splashes[i];
      s.t = -s.delay;                       // staggered, so it reads as spread
      s.q.position.set(x, y + 0.03, z);
      s.q.visible = false;
      s.sm.opacity = 0;
    }
  }
  function updateSplashes(dt) {
    for (let i = 0; i < splashes.length; i++) {
      const s = splashes[i];
      if (s.t > npcSPLASH_LIFE) {
        if (s.q.visible) { s.q.visible = false; s.sm.opacity = 0; }
        continue;
      }
      s.t += dt;
      if (s.t < 0) continue;
      const k = clamp(s.t / npcSPLASH_LIFE, 0, 1);
      const r = lerp(npcSPLASH_R0, npcSPLASH_R1, k);
      s.q.visible = true;
      s.q.scale.set(r, lerp(1.7, 0.25, k), r);
      s.sm.opacity = (1 - k) * (1 - k) * 0.8;
    }
  }

  // ------------------------------------------------------------ task helper
  const doneTasks = {};
  function finish(id) {
    if (doneTasks[id] || !npcTASK_IDS[id]) return;
    doneTasks[id] = true;
    try { game.completeTask(id); } catch (e) { /* systems may not be up yet */ }
  }
  function emit(name, npcRec) {
    try { game.events.emit(name, { npc: npcRec }); } catch (e) { /* bus optional */ }
  }
  function sfx(n) { try { game.sfx(n); } catch (e) { /* optional */ } }

  // ------------------------------------------------------------ env helpers
  function inZone(name, x, z) {
    const e = game.env;
    if (!e || typeof e.inZone !== 'function') return false;
    try { return !!e.inZone(name, x, z); } catch (err) { return false; }
  }
  function navBlocked(x, z, r) {
    const e = game.env;
    if (!e || typeof e.navBlocked !== 'function') return false;
    try { return !!e.navBlocked(x, z, r); } catch (err) { return false; }
  }

  // ================================================================ building
  const humans = [];
  const ibises = [];

  function buildHuman(idx, kind) {
    const root = new THREE_.Group();
    const bob = new THREE_.Object3D();
    const head = new THREE_.Object3D();
    const hatN = new THREE_.Object3D();
    const armL = new THREE_.Object3D();
    const armR = new THREE_.Object3D();
    const handR = new THREE_.Object3D();
    const camN = new THREE_.Object3D();
    const toolN = new THREE_.Object3D();
    const coneN = new THREE_.Object3D();   // the 99, only while somebody has one
    const legL = new THREE_.Object3D();
    const legR = new THREE_.Object3D();
    const holdN = new THREE_.Object3D();   // guitar / waiter's tray, carried on the chest

    root.add(bob); root.add(legL); root.add(legR);
    bob.add(head); bob.add(armL); bob.add(armR);
    head.add(hatN);
    armR.add(handR); handR.add(camN); handR.add(toolN); handR.add(coneN);
    bob.add(holdN);
    holdN.position.set(0.02, 1.02, 0.20);
    holdN.scale.setScalar(0);

    head.position.set(0, 1.34, 0);
    armL.position.set(-0.34, 1.18, 0);
    armR.position.set(0.34, 1.18, 0);
    handR.position.set(0, -0.56, 0);
    camN.position.set(0, 0.02, 0.12);
    toolN.position.set(0, 0.0, 0.06);
    coneN.position.set(0, -0.02, 0.12);
    legL.position.set(-0.13, 0.62, 0);
    legR.position.set(0.13, 0.62, 0);
    hatN.scale.setScalar(0);
    camN.scale.setScalar(0);
    toolN.scale.setScalar(0);
    coneN.scale.setScalar(0);

    const build = kind === 'ibis' ? 1 : rand(0.93, 1.08);
    root.scale.setScalar(build);

    const rec = {
      id: 'npc' + idx,
      kind,
      group: root,
      body: null,
      state: 'wander',
      alarm: 0,
      target: new THREE_.Vector3(),
      heldProp: null,
      idx,
      nodes: { bob, head, hatN, armL, armR, handR, camN, toolN, coneN, legL, legR, holdN },
      yaw: rand(-Math.PI, Math.PI),
      speed: 0,
      wantSpeed: 0,
      walkPhase: rand(0, 6.28),
      idlePhase: rand(0, 6.28),
      stateT: 0,
      lookX: 0, lookZ: 1, headYaw: 0, headPitch: 0,
      poseArmL: 0, poseArmR: 0, poseLean: 0, poseCrouch: 0,
      tgtArmL: 0, tgtArmR: 0, tgtLean: 0, tgtCrouch: 0,
      hop: 0, hopV: 0, stumble: 0, flail: 0, sepD: 99,
      avoidAng: 0, avoidT: 0, avoidStuck: false, moveX: 0, moveZ: 1,
      hasCamera: false, hasHat: false,
      chaseT: 0, photoCd: rand(2, 9), talkCd: rand(3, 14), noticeCd: 0,
      carryT: -1, lastLine: '',
      dejected: 0, dejectStage: 0, reactMode: 0, flashed: false, stolenType: '',
      home: new THREE_.Vector3(),
      poiA: 0, loopI: 0, jogOff: 0,
      mate: null,         // who they came with — see pickPOI and chatStep
      // ---- Mr Whippy ----
      queueI: 0, queueCd: rand(4, 40), coneT: -1,
      // ---- Circular Quay ----
      quay: !!npcQUAY_KINDS[kind], homeState: 'idle', homeYaw: 0,
      seated: 0, seatPose: 0, chatPhase: rand(0, 6.28), sipT: rand(2, 8),
      soak: 0, soakDark: 0, exasp: 0, slot: 0, table: -1, aboard: false,
      strum: rand(0, 3), tap: 0, huff: 0, mugT: 0, zMin: npcEDGE_STOP, noAvoid: false,
      robbed: false, soakCd: 0,
      cT: PALETTE.cloth1, cH: PALETTE.denim, cS: PALETTE.skin1, cHr: PALETTE.hair1,
      cHat: PALETTE.cloth6, cCam: PALETTE.capyEye, wetShade: -1,
      // ---- Rounds 1-6: sea wall, terrace ----
      yOff: 0,            // vertical offset (in the drink, on a chair)
      plunge: false,      // this flee attempt is one of the one-in-six
      fallV: 0,           // integrated vertical velocity of the plunge itself
      splashed: false,    // the waterline has been crossed; foam + sfx fired
      climbT: -1, climbZ0: 0,   // -1 = not climbing out; 0..1 = up the sea wall
      cornerT: 0, swimT: 0, wet: 0, saidWet: false,
      seatX: 0, seatZ: 0, seatYaw: 0, tableX: 0, tableZ: 0,
      sawTable: false, serveI: 0,
      // Can this one be half of a conversation? See chatStep. Llamas, street
      // dogs and ibises are built by their own constructors and never get it,
      // which is the whole test — paBuildBeast's speak() is a deliberate
      // no-op, so without this a beast picked as the listener would swallow
      // the reply and the exchange would be one person talking to a llama.
      chatty: true,
      chatCd: rand(3, 22),   // …and when they last had one. NOT talkCd — see chatStep.
      speak(t) { sayBubble(rec, t); },
      update(dt) { stepHuman(rec, dt); },
    };
    return rec;
  }

  let colorDirty = false;

  /** Re-push this one's instance colours, optionally soaked-through (0..1). */
  function shadeHuman(rec, wet) {
    const k = 1 - wet * 0.38;              // damp cloth reads as the same hue, darker
    const ks = 1 - wet * 0.14;
    iTorso.setColorAt(rec.idx, npcColor.setHex(rec.cT).multiplyScalar(k));
    iHips.setColorAt(rec.idx, npcColor.setHex(rec.cH).multiplyScalar(k));
    iHead.setColorAt(rec.idx, npcColor.setHex(rec.cS).multiplyScalar(ks));
    iHair.setColorAt(rec.idx, npcColor.setHex(rec.cHr).multiplyScalar(1 - wet * 0.30));
    iArmL.setColorAt(rec.idx, npcColor.setHex(rec.cS).multiplyScalar(ks));
    iArmR.setColorAt(rec.idx, npcColor.setHex(rec.cS).multiplyScalar(ks));
    iLegL.setColorAt(rec.idx, npcColor.setHex(rec.cH).multiplyScalar(k));
    iLegR.setColorAt(rec.idx, npcColor.setHex(rec.cH).multiplyScalar(k));
    iHat.setColorAt(rec.idx, npcColor.setHex(rec.cHat).multiplyScalar(k));
    rec.wetShade = wet;
    colorDirty = true;
  }

  function colorHuman(rec, cTorso, cHips, cSkin, cHair, cHat, cCam) {
    rec.cT = cTorso; rec.cH = cHips; rec.cS = cSkin;
    rec.cHr = cHair; rec.cHat = cHat; rec.cCam = cCam;
    rec.wetShade = 0;
    iTorso.setColorAt(rec.idx, npcColor.setHex(cTorso));
    iHips.setColorAt(rec.idx, npcColor.setHex(cHips));
    iHead.setColorAt(rec.idx, npcColor.setHex(cSkin));
    iHair.setColorAt(rec.idx, npcColor.setHex(cHair));
    iArmL.setColorAt(rec.idx, npcColor.setHex(cSkin));
    iArmR.setColorAt(rec.idx, npcColor.setHex(cSkin));
    iLegL.setColorAt(rec.idx, npcColor.setHex(cHips));
    iLegR.setColorAt(rec.idx, npcColor.setHex(cHips));
    iHat.setColorAt(rec.idx, npcColor.setHex(cHat));
    iCam.setColorAt(rec.idx, npcColor.setHex(cCam));
    iTool.setColorAt(rec.idx, npcColor.setHex(PALETTE.wood));
    iCone.setColorAt(rec.idx, npcColor.setHex(PALETTE.cloth6));
  }

  function addBody(rec, x, z) { return addBodyAt(rec, x, 0.85, z, 0.26, 0.8, 0.22); }

  /**
   * A kinematic collider for one member of a cast, built under whatever biome
   * capture tag is live — so Pasto's cast belongs to Pasto and is attached and
   * detached with it, exactly as Sydney's crowd is with Sydney.
   */
  function addBodyAt(rec, x, y, z, hx, hy, hz) {
    if (!game.world) return null;
    const body = new CANNON.Body({
      mass: 0,
      type: CANNON.Body.KINEMATIC,
      position: new CANNON.Vec3(x, y, z),
      material: (game.mats && game.mats.npc) ? game.mats.npc : undefined,
    });
    body.addShape(new CANNON.Box(new CANNON.Vec3(hx, hy, hz)));
    body.allowSleep = false;
    body.userData = { npc: rec };
    npcPlaceBody(body, x, y, z);
    game.world.addBody(body);
    rec.body = body;
    return body;
  }

  function spawnFor(rec, type, x, z) {
    if (!game.physics || typeof game.physics.spawnProp !== 'function') return null;
    let p = null;
    try { p = game.physics.spawnProp(type, x, z); } catch (e) { p = null; }
    if (!p) return null;
    p.owner = rec;
    if (p.body) {
      p.body.type = CANNON.Body.KINEMATIC;
      p.body.updateMassProperties();
      p.body.allowSleep = false;
      p.body.collisionResponse = false;
      p.body.wakeUp();
    }
    rec.heldProp = p;
    return p;
  }

  // ------------------------------------------------------ Circular Quay fixtures
  // environment.js owns the real furniture; these readers accept whatever shape
  // it publishes ({x,z}, Vector3, [x,z], {position}) and fall back to sensible
  // Circular Quay coordinates so the precinct is never empty.
  function quayXOf(o) {
    if (!o) return null;
    if (typeof o.x === 'number' && typeof o.z === 'number') return o;
    if (o.position && typeof o.position.x === 'number') return o.position;
    if (o.group && o.group.position) return o.group.position;
    if (o.mesh && o.mesh.position) return o.mesh.position;
    if (Array.isArray(o) && o.length >= 2 && typeof o[0] === 'number') return { x: o[0], z: o[1] };
    return null;
  }
  function quayPt(o, fb) {
    const p = quayXOf(o);
    return (p && isFinite(p.x) && isFinite(p.z)) ? { x: p.x, z: p.z } : { x: fb.x, z: fb.z };
  }
  const quayBusker = quayPt(game.env && game.env.buskerSpot, npcFB_BUSKER);
  const quayKiosk = quayPt(game.env && game.env.kioskSpot, npcFB_KIOSK);
  const quayTables = [];                 // flat x,z pairs
  (function () {
    const src = game.env && game.env.cafeTables;
    if (src && src.length) {
      for (let i = 0; i < src.length; i++) {
        const p = quayXOf(src[i]);
        if (p && isFinite(p.x) && isFinite(p.z)) quayTables.push(p.x, p.z);
      }
    }
    if (quayTables.length < 4) {
      quayTables.length = 0;
      for (let i = 0; i < npcFB_TABLES.length; i++) quayTables.push(npcFB_TABLES[i]);
    }
  })();
  const quayTableN = quayTables.length / 2;
  const quayTableR = 1.15;

  // ------------------------------------------------------- dining terrace
  // Agent A is adding env.inZone('terrace') / env.randomPointIn('terrace') this
  // same round, so everything here is typeof-guarded and degrades to hardcoded
  // fixtures around x = -30, z = 2. Resolved once, at build time.
  function envFn(name) {
    return !!(game.env && typeof game.env[name] === 'function');
  }
  function envRandomIn(name) {
    if (!envFn('randomPointIn')) return null;
    try {
      const p = game.env.randomPointIn(name);
      if (p && isFinite(p.x) && isFinite(p.z)) return p;
    } catch (e) { /* zone not published yet */ }
    return null;
  }
  const terrTables = [];                  // flat x,z pairs, one per table
  (function () {
    const src = (game.env && (game.env.terraceTables || game.env.diningTables)) || null;
    if (src && src.length) {
      for (let i = 0; i < src.length; i++) {
        const p = quayXOf(src[i]);
        if (p && isFinite(p.x) && isFinite(p.z)) terrTables.push(p.x, p.z);
      }
    }
    for (let i = 0; terrTables.length < 8 && i < 6; i++) {
      const p = envRandomIn('terrace');
      if (!p) break;
      terrTables.push(p.x, p.z);
    }
    if (terrTables.length < 4) {
      terrTables.length = 0;
      for (let i = 0; i < npcFB_TERRACE.length; i++) terrTables.push(npcFB_TERRACE[i]);
    }
  })();
  const terrTableN = terrTables.length / 2;
  const terrCounter = quayPt(
    game.env && (game.env.terraceCounter || game.env.kioskSpot), npcFB_COUNTER);

  /** Is the capybara standing ON this table? (footprint + height, no raycast) */
  function capyOnTable(tx, tz) {
    if (!capyOk) return false;
    const c = game.capy;
    const y = (c && c.position) ? c.position.y : 0;
    if (y < npcTABLE_TOP_Y) return false;
    const dx = capyX - tx, dz = capyZ - tz;
    return dx * dx + dz * dz < quayTableR * quayTableR;
  }

  // Live ferry state, refreshed in place (no per-frame allocation).
  const quayFerry = { ok: false, docked: false, x: npcFB_FERRY.x, z: npcFB_FERRY.z, deckY: 0.9 };
  function quayReadFerry() {
    const f = game.env && game.env.ferry;
    quayFerry.ok = !!f;
    if (!f) { quayFerry.docked = false; return; }
    const d = (f.docked !== undefined) ? f.docked
      : (f.atDock !== undefined) ? f.atDock
      : (f.state !== undefined) ? (f.state === 'docked' || f.state === 'dock') : false;
    quayFerry.docked = !!d;
    const p = quayXOf(f);
    if (p && isFinite(p.x) && isFinite(p.z)) { quayFerry.x = p.x; quayFerry.z = p.z; }
    if (isFinite(f.deckY)) quayFerry.deckY = f.deckY;
    if (isFinite(f.gangwayX) && isFinite(f.gangwayZ)) { quayFerry.x = f.gangwayX; quayFerry.z = f.gangwayZ; }
  }
  quayReadFerry();

  // --- build the humans ----------------------------------------------------
  let camerasGiven = 0, hatsGiven = 0, coffeesGiven = 0, bagsGiven = 0;
  let patronN = 0;
  for (let i = 0; i < HUMANS; i++) {
    const kind = roster[i];
    const rec = buildHuman(i, kind);
    let x, z;
    if (kind === 'gardener') {
      const gi = (i % 2) * 4;
      x = npcGARDEN_PTS[gi] + rand(-2, 2); z = npcGARDEN_PTS[gi + 1] + rand(-2, 2);
      rec.state = 'work';
      colorHuman(rec, PALETTE.hiVis, PALETTE.khaki,
        npcSKINS[randInt(0, 3)], PALETTE.hair5, PALETTE.khaki, PALETTE.metal);
      rec.nodes.hatN.scale.setScalar(1);
      rec.nodes.toolN.scale.setScalar(1);
      rec.hasHat = true;
      rec.wantSpeed = 0;
    } else if (kind === 'jogger') {
      const li = (i % 4) * 2;
      x = npcJOG_LOOP[li] + rand(-1, 1); z = npcJOG_LOOP[li + 1] + rand(-1, 1);
      rec.loopI = (i % 4);
      rec.state = 'wander';
      colorHuman(rec, npcCLOTH[randInt(0, 7)], PALETTE.stoneDark,
        npcSKINS[randInt(0, 3)], npcHAIRS[randInt(0, 4)], PALETTE.cloth6, PALETTE.metal);
    } else if (kind === 'patron') {
      // Terrace diner. Two to a table, seated across from one another so the
      // pair reads as a conversation from the overhead-behind camera.
      const ti = terrTableN > 0 ? (patronN % terrTableN) : 0;
      const side = (patronN < terrTableN) ? 1 : -1;
      patronN++;
      const tx = terrTables[ti * 2], tz = terrTables[ti * 2 + 1];
      rec.tableX = tx; rec.tableZ = tz;
      rec.seatX = tx + side * npcSEAT_OUT * 0.86;
      rec.seatZ = tz + side * npcSEAT_OUT * 0.5;
      rec.seatYaw = Math.atan2(tx - rec.seatX, tz - rec.seatZ);
      rec.yaw = rec.seatYaw;
      x = rec.seatX; z = rec.seatZ;
      rec.state = 'seated';
      rec.seated = 1;
      colorHuman(rec, npcCLOTH[randInt(0, 7)], npcPANTS[randInt(0, 4)],
        npcSKINS[randInt(0, 3)], npcHAIRS[randInt(0, 4)], npcCLOTH[randInt(0, 7)], PALETTE.capyEye);
    } else if (kind === 'waiter') {
      x = terrCounter.x; z = terrCounter.z;
      rec.state = 'serve';
      rec.serveI = 0;
      rec.nodes.holdN.scale.setScalar(1);          // the tray
      colorHuman(rec, PALETTE.cloth6, PALETTE.stoneDark,
        npcSKINS[randInt(0, 3)], npcHAIRS[randInt(0, 4)], PALETTE.cloth6, PALETTE.metal);
    } else if (kind === 'busker') {
      // Stands where environment.js says the busking pitch is, faces inland at
      // the promenade, and never wanders off it — the whole Circular Quay task is
      // "rob him MID-SONG", so he has to still be there when you come back.
      x = quayBusker.x; z = quayBusker.z;
      rec.state = 'busk';
      rec.yaw = 0;                                   // looking up the quay, +z
      rec.wantSpeed = 0;
      rec.nodes.holdN.scale.setScalar(1);            // the guitar
      colorHuman(rec, PALETTE.cloth7, PALETTE.denim,
        npcSKINS[randInt(0, 3)], npcHAIRS[randInt(0, 4)], PALETTE.cloth3, PALETTE.capyEye);
    } else if (kind === 'owner') {
      // The dog's handler. Parked on the boardwalk with the lead in his hand.
      x = npcDOG_HOME.x; z = npcDOG_HOME.z + 1.2;
      rec.state = 'idle';
      rec.yaw = Math.PI;
      colorHuman(rec, npcCLOTH[randInt(0, 7)], npcPANTS[randInt(0, 4)],
        npcSKINS[randInt(0, 3)], npcHAIRS[randInt(0, 4)], npcCLOTH[randInt(0, 7)], PALETTE.capyEye);
    } else if (rec.quay) {
      const pi = randInt(0, (npcQUAY_PTS.length / 2) - 1) * 2;
      x = npcQUAY_PTS[pi] + rand(-1.6, 1.6); z = npcQUAY_PTS[pi + 1] + rand(-1.6, 1.6);
      rec.poiA = pi;
      colorHuman(rec, npcCLOTH[randInt(0, 7)], npcPANTS[randInt(0, 4)],
        npcSKINS[randInt(0, 3)], npcHAIRS[randInt(0, 4)], npcCLOTH[randInt(0, 7)], PALETTE.capyEye);
      rec.state = 'idle';
    } else {
      const pi = randInt(0, (npcPOI.length / 2) - 1) * 2;
      x = npcPOI[pi] + rand(-3, 3); z = npcPOI[pi + 1] + rand(-3, 3);
      rec.poiA = pi;
      colorHuman(rec, npcCLOTH[randInt(0, 7)], npcPANTS[randInt(0, 4)],
        npcSKINS[randInt(0, 3)], npcHAIRS[randInt(0, 4)], npcCLOTH[randInt(0, 7)], PALETTE.capyEye);
      rec.state = 'idle';
    }
    x = clamp(x, npcBOUND_X0, npcBOUND_X1);
    z = clamp(z, npcBOUND_Z0, npcBOUND_Z1);
    rec.group.position.set(x, 0, z);
    rec.home.set(x, 0, z);
    rec.target.set(x, 0, z);
    addBody(rec, x, z);
    humans.push(rec);
    game.npcs.push(rec);
  }

  // ---- WHO CAME WITH WHOM ------------------------------------------------
  // Pair off the tourists and the commuters, two by two, leaving any odd one
  // out on their own — a park with one person visibly by themselves in it is
  // right, a park with eleven of them is not. The link is symmetric and it is
  // the ONLY thing rec.mate is used for: see pickPOI, which is where a
  // companion turns into two people standing together.
  (function () {
    const singles = [];
    for (let i = 0; i < humans.length; i++) {
      const k = humans[i].kind;
      if (k === 'tourist' || k === 'commuter') singles.push(humans[i]);
    }
    for (let i = 0; i + 1 < singles.length; i += 2) {
      // …and not all of them. Two of every five walk the gardens alone.
      if (Math.random() < 0.25) continue;
      singles[i].mate = singles[i + 1];
      singles[i + 1].mate = singles[i];
    }
  })();

  // props for tourists (asked of props.js, carried in-hand each frame)
  for (let i = 0; i < humans.length; i++) {
    const rec = humans[i];
    if (rec.kind !== 'tourist') continue;
    const px = rec.group.position.x, pz = rec.group.position.z;
    if (hatsGiven < 3) {
      if (spawnFor(rec, 'hat', px, pz)) { hatsGiven++; rec.hasHat = true; continue; }
      hatsGiven++;
    }
    if (camerasGiven < 3) {
      rec.hasCamera = true;
      rec.nodes.camN.scale.setScalar(1);
      camerasGiven++;
      continue;
    }
    if (coffeesGiven < 3) {
      if (spawnFor(rec, 'coffee', px + 0.4, pz)) { coffeesGiven++; continue; }
      coffeesGiven++;
    }
    if (bagsGiven < 2) {
      if (spawnFor(rec, 'handbag', px + 0.4, pz)) { bagsGiven++; continue; }
      bagsGiven++;
    }
  }

  // --- the busker's takings ------------------------------------------------
  // The hat is a REAL prop, owned by him the same way a tourist owns theirs, so
  // the whole existing theft chain — physGrab -> 'capy:grab' -> startChase —
  // works unmodified and 'busker-hat' is simply which task the handler ticks.
  let buskerRec = null;
  let dogOwnerRec = null;
  for (let i = 0; i < humans.length; i++) {
    if (!buskerRec && humans[i].kind === 'busker') buskerRec = humans[i];
    if (!dogOwnerRec && humans[i].kind === 'owner') dogOwnerRec = humans[i];
  }
  if (buskerRec) {
    const bp = buskerRec.group.position;
    if (spawnFor(buskerRec, 'hat', bp.x, bp.z)) buskerRec.hasHat = true;
    iGuitar.setColorAt(0, npcColor.setHex(PALETTE.wood));
    iGuitar.instanceColor.needsUpdate = true;
    // the coin cup, on the pavement beside him. Pure dressing: one instance,
    // written once, never touched again.
    iCup.setColorAt(0, npcColor.setHex(PALETTE.metal));
    iCup.instanceColor.needsUpdate = true;
    npcM1.makeTranslation(bp.x + 0.62, 0, bp.z + 0.34);
    iCup.setMatrixAt(0, npcM1);
    iCup.instanceMatrix.needsUpdate = true;
  }
  // --- build the ibis ------------------------------------------------------
  function buildIbis(idx) {
    const root = new THREE_.Group();
    const bodyN = new THREE_.Object3D();
    const neckN = new THREE_.Object3D();
    const legA = new THREE_.Object3D();
    const legB = new THREE_.Object3D();
    root.add(bodyN); root.add(legA); root.add(legB); bodyN.add(neckN);
    bodyN.position.set(0, 0.32, 0);
    neckN.position.set(0, 0.08, 0.09);
    legA.position.set(-0.06, 0.32, 0);
    legB.position.set(0.06, 0.32, 0);
    root.scale.setScalar(rand(0.9, 1.1));

    const rec = {
      id: 'ibis' + idx,
      kind: 'ibis',
      group: root,
      body: null,
      state: 'wander',
      alarm: 0,
      target: new THREE_.Vector3(),
      heldProp: null,
      idx,
      nodes: { bodyN, neckN, legA, legB },
      yaw: rand(-Math.PI, Math.PI),
      speed: 0, wantSpeed: 0,
      walkPhase: rand(0, 6.28), idlePhase: rand(0, 6.28),
      avoidAng: 0, avoidT: 0, avoidStuck: false, moveX: 0, moveZ: 1,
      stateT: 0, peck: 0, lastLine: '',
      speak() { /* bin chickens do not speak. they judge. */ },
      update(dt) { stepIbis(rec, dt); },
    };
    return rec;
  }
  for (let i = 0; i < IBIS; i++) {
    const rec = buildIbis(i);
    const x = clamp(rand(-30, 30), npcBOUND_X0, npcBOUND_X1);
    const z = clamp(rand(6, 30), npcBOUND_Z0, npcBOUND_Z1);
    rec.group.position.set(x, 0, z);
    rec.target.set(x, 0, z);
    iIbisB.setColorAt(i, npcColor.setHex(PALETTE.ibis));
    iIbisN.setColorAt(i, npcColor.setHex(PALETTE.ibisHead));
    iIbisLA.setColorAt(i, npcColor.setHex(PALETTE.ibisHead));
    iIbisLB.setColorAt(i, npcColor.setHex(PALETTE.ibisHead));
    ibises.push(rec);
    game.npcs.push(rec);
  }

  iTorso.instanceColor.needsUpdate = true;
  iHips.instanceColor.needsUpdate = true;
  iHead.instanceColor.needsUpdate = true;
  iHair.instanceColor.needsUpdate = true;
  iArmL.instanceColor.needsUpdate = true;
  iArmR.instanceColor.needsUpdate = true;
  iLegL.instanceColor.needsUpdate = true;
  iLegR.instanceColor.needsUpdate = true;
  iHat.instanceColor.needsUpdate = true;
  iCam.instanceColor.needsUpdate = true;
  iTool.instanceColor.needsUpdate = true;
  iCone.instanceColor.needsUpdate = true;
  iIbisB.instanceColor.needsUpdate = true;
  iIbisN.instanceColor.needsUpdate = true;
  iIbisLA.instanceColor.needsUpdate = true;
  iIbisLB.instanceColor.needsUpdate = true;

  // The waiter is the one Circular Quay hand-prop rig that has a driver.
  let waiterRec = null;
  for (let i = 0; i < humans.length; i++) if (humans[i].kind === 'waiter') { waiterRec = humans[i]; break; }
  if (waiterRec) {
    iTray.setColorAt(0, npcColor.setHex(PALETTE.metal));
    iTray.instanceColor.needsUpdate = true;
  } else iTray.visible = false;

  // The busker's own hat is a real grabbable prop (see the takings block), so
  // the decorative upturned one stays hidden — two hats on one pitch reads as a
  // duplicate. Everything else below now has a driver; quayStep owns its
  // visibility from here, one write per frame, because the biome streamer
  // re-shows every Sydney object wholesale on re-entry.
  iBHat.visible = false;
  iGuitar.visible = !!buskerRec;
  iCup.visible = !!buskerRec;

  // ================================================================ steering
  // ------------------------------------------------------- MR WHIPPY'S QUEUE
  // At most three at a time, in order, and the line is a plain array: the
  // index IS the place, so when the person at the window leaves everybody
  // behind them shuffles up on the very next frame without a single timer.
  //
  // The one rule that matters is that a queue must EMPTY. Every exit from
  // 'queue' — served, van left, startled, chased, shoved into the harbour —
  // goes through vanQueueLeave, and setState() calls it for anybody leaving
  // the state by any route at all, so there is no path that can strand a
  // ghost in the line and wedge the queue at three for the rest of the run.
  const vanQueue = [];
  const vanQFallback = { x: 0, z: 0 };
  const vanQMAX = 3;
  function vanEnv() {
    const e = game.env;
    // ALL THREE, not two. case 'queue' calls e.van() as well, and a build of
    // environment.js that published the two new hooks but not the old one
    // would have thrown inside a state machine — the one place in this file a
    // throw takes the whole crowd down with it.
    return (e && typeof e.vanQueueSpot === 'function' &&
            typeof e.vanDwellLeft === 'function' && typeof e.van === 'function') ? e : null;
  }
  /** Is she stopped, with enough of the stop left to be worth walking over for? */
  function vanQueueOpen() {
    if (!biomeLive()) return false;
    const e = vanEnv();
    if (!e) return false;
    // Three seconds, not five: eleven is the whole stop and somebody twenty
    // metres away needs eight of them to walk it. Anybody who does not make
    // the window says so — see whippyMiss — which is a better joke than a
    // queue that only ever forms for people already standing next to the van.
    return e.vanDwellLeft() > 3.0 && vanQueue.length < vanQMAX;
  }
  function vanQueueSpotAt(i) {
    const e = vanEnv();
    if (!e) return vanQFallback;
    return e.vanQueueSpot(i);
  }
  function vanQueueJoin(rec) {
    if (vanQueue.indexOf(rec) < 0) vanQueue.push(rec);
    return vanQueue.indexOf(rec);
  }
  function vanQueueLeave(rec) {
    const i = vanQueue.indexOf(rec);
    if (i >= 0) vanQueue.splice(i, 1);
  }

  function setState(rec, s) {
    // Only fleeing and swimming open the harbour up. Hand the sea wall back the
    // moment they are inland again, so an interrupted plunge cannot leave
    // someone free to stroll off the quay ten minutes later.
    if (rec.zMin !== undefined && s !== 'flee' && s !== 'plunge' && s !== 'swim' &&
        rec.group.position.z >= npcEDGE_STOP) rec.zMin = npcEDGE_STOP;
    // LEAVING THE LINE IS A ROUTE, NOT AN EVENT. Every exit from 'queue' —
    // served, van gone, startled, chased, carried off by the gardener, shoved
    // into the harbour — arrives here, so a person cannot be left holding a
    // place in a queue they walked away from. Without this the line wedges at
    // three and Mr Whippy never has a customer again.
    if (rec.state === 'queue' && s !== 'queue') vanQueueLeave(rec);
    rec.state = s;
    rec.stateT = 0;
    rec.dwell = -1;              // a new state draws a new dwell — see npcDwell
  }

  function steerTo(rec, tx, tz, dt) {
    const px = rec.group.position.x, pz = rec.group.position.z;
    let dx = tx - px, dz = tz - pz;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < 0.0001) { rec.moveX = 0; rec.moveZ = 0; return 0; }
    dx /= d; dz /= d;
    rec.avoidT -= dt;
    // Already standing inside a blocker: every probe around him is blocked, so
    // no dodge can ever pass and avoidStuck freezes him permanently. moveRec
    // already exempts anyone in this position from its step test, so walk out.
    if (navBlocked(px, pz, npcMOVE_R)) {
      rec.avoidAng = 0;
      rec.avoidStuck = false;
      rec.avoidT = 0;
      rec.moveX = dx; rec.moveZ = dz;
      return d;
    }
    if (rec.avoidT <= 0) {
      rec.avoidAng = 0;
      rec.avoidStuck = false;
      if (navBlocked(px + dx * 1.4, pz + dz * 1.4, 0.45)) {
        let found = false;
        for (let i = 0; i < npcAVOID_TRIES.length; i++) {
          const a = Math.atan2(dx, dz) + npcAVOID_TRIES[i];
          if (!navBlocked(px + Math.sin(a) * 1.4, pz + Math.cos(a) * 1.4, 0.45)) {
            rec.avoidAng = npcAVOID_TRIES[i];
            found = true;
            break;
          }
        }
        // Nothing clear in any direction: stand still. Committing to angle 0 for
        // 0.45s meant deliberately marching into whatever was in the way.
        rec.avoidStuck = !found;
        // The probe only looked 1.4 m ahead, so a chasing gardener at 7 m/s must
        // not go 3.1 m blind on the strength of it. Re-probe before we outrun it.
        rec.avoidT = Math.min(0.45, 1.2 / Math.max(rec.speed, 0.5));
      }
    }
    // Same exemption as moveRec: the sea-wall states are allowed to push at the
    // boardwalk rail, because that is where the gag lives.
    if (rec.avoidStuck && rec.state !== 'flee' && rec.state !== 'cornered' &&
        rec.state !== 'plunge' && rec.state !== 'swim') {
      rec.moveX = 0; rec.moveZ = 0; return d;
    }
    if (rec.avoidAng !== 0) {
      const a = Math.atan2(dx, dz) + rec.avoidAng;
      dx = Math.sin(a); dz = Math.cos(a);
    }
    rec.moveX = dx; rec.moveZ = dz;
    return d;
  }

  function moveRec(rec, dt, spd) {
    rec.speed = damp(rec.speed, spd, rec.state === 'chase' ? 11 : 6, dt);
    if (rec.speed > 0.02) {
      let nx = rec.group.position.x + rec.moveX * rec.speed * dt;
      let nz = rec.group.position.z + rec.moveZ * rec.speed * dt;
      nx = clamp(nx, npcBOUND_X0, npcBOUND_X1);
      // rec.zMin, not the global: only someone the capybara has backed onto the
      // sea wall is allowed anywhere near the water.
      nz = clamp(nz, rec.zMin, npcBOUND_Z1);
      // The bodies are mass-0 kinematic and teleported, so cannon will never
      // resolve a penetration for us: a 7 m/s gardener would walk clean through
      // the colonnade. Reject the step and slide along whichever axis is free.
      // Somebody who is ALREADY inside a blocker (spawned by a bench) is exempt,
      // otherwise they would be welded there for the session.
      // Exempt the sea-wall states inside the quay-edge band: the boardwalk rail
      // IS a nav blocker there, and going over it is the entire joke.
      const seaward = nz < npcEDGE_Z + 1.4 &&
        (rec.state === 'flee' || rec.state === 'cornered' ||
         rec.state === 'plunge' || rec.state === 'swim');
      if (!seaward &&
          navBlocked(nx, nz, npcMOVE_R) &&
          !navBlocked(rec.group.position.x, rec.group.position.z, npcMOVE_R)) {
        if (!navBlocked(nx, rec.group.position.z, npcMOVE_R)) nz = rec.group.position.z;
        else if (!navBlocked(rec.group.position.x, nz, npcMOVE_R)) nx = rec.group.position.x;
        else { nx = rec.group.position.x; nz = rec.group.position.z; }
      }
      // ---- AND NOBODY WALKS THROUGH THE PLAYER --------------------------
      //
      // npcSeparate runs immediately above this and pushes an NPC OUT of the
      // capybara — and then this stepped them straight back in, every frame,
      // because a route is a route. The separation is damped and speed-capped
      // (it is meant to read as a shove, not a teleport) so it never wins that
      // argument outright; what actually settled it was cannon, in world.step,
      // where a mass-0 KINEMATIC box always beats a dynamic one.
      //
      // MEASURED, Pasto, parked at the spawn with no input for sixty seconds:
      // the animal was displaced 4.30 m, 12.29 m and 28.86 m on three runs of
      // the same build — the spread is the parade phase, not noise — while the
      // nearest body the whole time was a walker at 1.83-1.91 m/s holding
      // station 0.95-1.07 m away. body.velocity read 0.000 at the moment of
      // several of the steps and capy.loaf sat at 0.99, so it looked exactly
      // like a ground slide and was written up as one by the previous batch.
      // It is not the ground. It is a person walking into you.
      //
      // steerTo cannot fix it: navBlocked forwards only to env.navBlocked,
      // which is STATIC WORLD GEOMETRY, so a walker dodges a building and has
      // never had a term for the animal at all.
      //
      // No exemption list, deliberately. A person whose errand IS the player
      // stops when they get to them, which is what arriving means — and flee,
      // plunge and cornered all move the other way, so the clamp is inert for
      // them by construction. Only the INWARD component is removed, so anyone
      // can still walk past, around, or away at full speed.
      if (capyOk && rec.carryT < 0) {
        const rx = nx - capyX, rz = nz - capyZ;
        const rd = Math.sqrt(rx * rx + rz * rz);
        if (rd < npcWALK_CLEAR && rd > 1e-4) {
          const ox = rec.group.position.x - capyX, oz = rec.group.position.z - capyZ;
          const od = Math.sqrt(ox * ox + oz * oz);
          if (rd < od) {                       // closing, not already inside and leaving
            const ux = ox / (od || 1), uz = oz / (od || 1);
            let sx = nx - rec.group.position.x, sz = nz - rec.group.position.z;
            const inward = sx * ux + sz * uz;  // negative = toward the animal
            if (inward < 0) { sx -= ux * inward; sz -= uz * inward; }
            nx = rec.group.position.x + sx;
            nz = rec.group.position.z + sz;
          }
        }
      }
      rec.group.position.x = nx;
      rec.group.position.z = nz;
      const want = Math.atan2(rec.moveX, rec.moveZ);
      rec.yaw = npcDampAngle(rec.yaw, want, 7, dt);
      // gait frequency derived from the stride the legs actually produce, so the
      // feet stay locked to the ground instead of ice-skating.
      const gAmp = clamp(rec.speed / 1.7, 0, 1.15);
      const stride = 2 * npcLEG_L * Math.sin(0.72 * gAmp);
      if (stride > 0.02) rec.walkPhase += (Math.PI * rec.speed / stride) * dt + dt * 0.4;
      else rec.walkPhase += dt * 0.4;
    } else {
      rec.walkPhase = damp(rec.walkPhase, Math.round(rec.walkPhase / Math.PI) * Math.PI, 5, dt);
    }
    if (rec.body) {
      rec.body.velocity.set(rec.moveX * rec.speed, 0, rec.moveZ * rec.speed);
      // Driven by hand every frame, so the interpolation fields must follow it.
      npcPlaceBody(rec.body, rec.group.position.x, 0.85 + rec.yOff, rec.group.position.z);
    }
  }

  // ---------------------------------------------------------- personal space
  /**
   * Push an NPC out of the capybara, never the other way round: the player's
   * input is sacred. Damped and speed-capped so it reads as a shove, and every
   * candidate destination is nav-tested so nobody gets posted into a bench.
   */
  function npcSepTry(rec, dx, dz, step, stuck) {
    for (let i = 0; i < 3; i++) {
      let ax = dx, az = dz;
      if (i === 1) { ax = dz; az = -dx; }
      else if (i === 2) { ax = -dz; az = dx; }
      const nx = clamp(rec.group.position.x + ax * step, npcBOUND_X0, npcBOUND_X1);
      const nz = clamp(rec.group.position.z + az * step, rec.zMin, npcBOUND_Z1);
      // `stuck` = they were already standing in blocked space (spawned by a
      // bench). Refusing to move them then would weld them inside the capybara.
      if (!stuck && navBlocked(nx, nz, npcSEP_PROBE)) continue;
      rec.group.position.x = nx;
      rec.group.position.z = nz;
      return;
    }
  }

  function npcSeparate(rec, dt) {
    if (!capyOk || rec.carryT >= 0) { rec.sepD = 99; return; }
    const px = rec.group.position.x, pz = rec.group.position.z;
    let dx = px - capyX, dz = pz - capyZ;
    let d = Math.sqrt(dx * dx + dz * dz);
    if (d >= npcSEP_R) { rec.sepD = d; return; }
    if (d < 1e-4) {            // dead centre — break the tie sideways
      dx = Math.sin(rec.yaw + 1.5708); dz = Math.cos(rec.yaw + 1.5708); d = 1e-4;
    } else { dx /= d; dz /= d; }
    const overlap = npcSEP_R - d;

    // A shove that arrives out of nowhere earns a comic stagger — once, on the
    // frame the overlap starts, so it cannot buzz while the capy leans on them.
    // The +0.3 margin is hysteresis: the shove only ever settles them AT the
    // radius, so without it a capybara leaning on someone would re-trigger the
    // stagger every few frames and they would buzz.
    if (rec.sepD > npcSEP_R + 0.3 && rec.stumble < 0.2 && rec.dejected <= 0) {
      rec.stumble = clamp(0.45 + overlap, 0, 1);
      if (capySpdH > 1.1) {
        if (rec.hopV < 1.5 && rec.hop < 0.02) rec.hopV = 1.5;
        rec.lookX = capyX; rec.lookZ = capyZ;
        rec.alarm = Math.max(rec.alarm, 0.7);
      }
    }
    rec.sepD = d;

    let step = overlap * (1 - Math.exp(-npcSEP_LAMBDA * dt));
    const maxStep = npcSEP_VMAX * dt;
    if (step > maxStep) step = maxStep;
    if (step < 1e-5) return;
    npcSepTry(rec, dx, dz, step, navBlocked(px, pz, npcSEP_PROBE));
  }

  // ================================================================= capy ref
  let capyX = 0, capyZ = 0, capySpd = 0, capyOk = false;
  let capyVX = 0, capyVZ = 0, capySpdH = 0;
  function refreshCapy() {
    const c = game.capy;
    if (!c || !c.position) { capyOk = false; npcCapyOk = false; return; }
    capyX = c.position.x; capyZ = c.position.z;
    npcCapyX = capyX; npcCapyZ = capyZ; npcCapyOk = true;
    capySpd = c.velocity ? c.velocity.length() : 0;
    capyVX = c.velocity ? c.velocity.x : 0;
    capyVZ = c.velocity ? c.velocity.z : 0;
    capySpdH = Math.sqrt(capyVX * capyVX + capyVZ * capyVZ);
    capyOk = true;
  }
  function distToCapy(rec) {
    const dx = capyX - rec.group.position.x, dz = capyZ - rec.group.position.z;
    return Math.sqrt(dx * dx + dz * dz);
  }
  function facingCapy(rec) {
    const dx = capyX - rec.group.position.x, dz = capyZ - rec.group.position.z;
    const d = Math.sqrt(dx * dx + dz * dz) || 1;
    return (Math.sin(rec.yaw) * dx + Math.cos(rec.yaw) * dz) / d;
  }
  function lookAtCapy(rec) { rec.lookX = capyX; rec.lookZ = capyZ; }

  // ------------------------------------------------------------- line of sight
  /**
   * Cheap occlusion: walk four samples down the segment and ask env.navBlocked.
   * No raycaster, no allocation — the colonnade, the kiosk and the ferry shed
   * are all static nav blockers, so this is exactly the geometry we want.
   */
  function losClear(px, pz, dx, dz, d) {
    for (let i = 1; i <= npcLOS_STEPS; i++) {
      const t = (i / (npcLOS_STEPS + 1)) * d;
      if (navBlocked(px + dx * t, pz + dz * t, npcLOS_R)) return false;
    }
    return true;
  }

  /**
   * 0..1 — how plainly this NPC can see (x, z): vision cone about the facing
   * direction, falling off with the angle, times a falloff with range, gated
   * on clear line of sight. Anything closer than npcVIS_NEAR registers however
   * they are facing (you hear a capybara at two metres).
   */
  function visionOf(rec, x, z, far) {
    const px = rec.group.position.x, pz = rec.group.position.z;
    let dx = x - px, dz = z - pz;
    const d = Math.sqrt(dx * dx + dz * dz);
    const f = far || npcVIS_FAR;
    if (d > f) return 0;
    if (d < 1e-4) return 1;
    dx /= d; dz /= d;
    if (d > 1.2 && !losClear(px, pz, dx, dz, d)) return 0;
    const dot = Math.sin(rec.yaw) * dx + Math.cos(rec.yaw) * dz;
    const cone = clamp((dot - npcVIS_COS) / (1 - npcVIS_COS), 0, 1);
    const range = clamp(1 - d / f, 0, 1);
    let v = (npcVIS_FLOOR + (1 - npcVIS_FLOOR) * cone) * (0.20 + 0.80 * range);
    if (dot < npcVIS_COS) v = 0;
    if (d < npcVIS_NEAR) v = Math.max(v, 0.62);
    return v;
  }
  function seesCapy(rec, far) {
    return capyOk ? visionOf(rec, capyX, capyZ, far) : 0;
  }

  function pickPOI(rec) {
    // ---- PEOPLE COME IN TWOS -------------------------------------------
    // Eleven tourists picking independently out of a fifteen-point table over
    // a hundred and thirty metres of park produced eleven people standing on
    // their own, evenly spaced, for ever. Nobody visits the Botanic Gardens
    // alone. Half of them have a companion, and a companion follows you to
    // roughly where you went — near enough to be together, far enough not to
    // be inside you, and never so reliably that the pair reads as a rig.
    //
    // It is also what makes a conversation POSSIBLE: chatStep needs two calm
    // people inside three and a half metres, and without this that state of
    // affairs came about about once every three minutes by luck.
    const mate = rec.mate;
    if (mate && mate.group && Math.random() < 0.62) {
      const a = rand(0, 6.283), d = rand(1.5, 2.6);
      rec.target.set(mate.target.x + Math.cos(a) * d, 0, mate.target.z + Math.sin(a) * d);
      return;
    }
    // Quay folk mill about the quay; Opera House folk mill about the podium.
    const src = rec.quay ? npcQUAY_PTS : npcPOI;
    const pi = randInt(0, (src.length / 2) - 1) * 2;
    rec.target.set(src[pi] + rand(-2.5, 2.5), 0, src[pi + 1] + rand(-2.5, 2.5));
  }
  function pickBed(rec) {
    const e = game.env;
    if (e && typeof e.randomPointIn === 'function') {
      try {
        const p = e.randomPointIn('flowerbed');
        if (p && isFinite(p.x) && isFinite(p.z)) { rec.target.set(p.x, 0, p.z); return; }
      } catch (err) { /* fall through */ }
    }
    const gi = randInt(0, (npcGARDEN_PTS.length / 2) - 1) * 2;
    rec.target.set(npcGARDEN_PTS[gi] + rand(-2, 2), 0, npcGARDEN_PTS[gi + 1] + rand(-2, 2));
  }

  // ============================================================ AI (staggered)
  function thinkHuman(rec) {
    const st = rec.state;
    // rec.dejected > 0 joins the list: a dejection beat is a performance, and
    // merely noticing the capybara must not cut it off half way through.
    // 'queue' joins the list, and it has to. A person in a line who turns to
    // look at a capybara loses their place to the person behind them, which
    // made the queue thrash between two and three people every second the
    // player stood anywhere near the van. Being startled, robbed or chased
    // still takes them out of it — those all come through startle()/setState()
    // and not through here — so the line still empties for the right reasons.
    if (st === 'chase' || st === 'flee' || st === 'photo' || st === 'startled' ||
        st === 'fluster' || st === 'cornered' || st === 'plunge' || st === 'swim' ||
        st === 'shoo' || st === 'queue' || rec.carryT >= 0 || rec.dejected > 0) return;

    // --- terrace cast: their whole world is one table or four ---------------
    if (rec.kind === 'patron') {
      if (st === 'seated') {
        if (rec.talkCd <= 0 && Math.random() < 0.35) {
          rec.talkCd = rand(10, 26);
          pickLine(rec, 'diner');
        }
      } else if (st !== 'resit' && rec.stateT > 2.2) {
        setState(rec, 'resit');       // wherever the fright took him, lunch is waiting
      }
      return;
    }
    if (rec.kind === 'waiter') {
      if (st !== 'serve') {
        if (rec.stateT > 2.2) { setState(rec, 'serve'); rec.serveI = (rec.serveI + 1) % 16; rec.served = 0; }
      } else {
        // the ceiling: a leg of the circuit he cannot walk is a leg he skips
        if (rec.stateT > 9) { rec.serveI = (rec.serveI + 1) % 16; rec.stateT = 0; rec.served = 0; }
        else if (rec.talkCd <= 0 && Math.random() < 0.2) {
          rec.talkCd = rand(11, 24);
          pickLine(rec, 'serve');
        }
      }
      return;
    }
    // The busker never wanders and never gawps: a pitch you have to go back to
    // is what makes "rob him mid-song" a thing the player can plan. Chases and
    // frights are handled by the early-out above, so this only ever recovers
    // him from the aftermath.
    if (rec.kind === 'busker') {
      if (st !== 'busk') {
        if (rec.stateT > 2.4) { setState(rec, 'busk'); pickLine(rec, rec.robbed ? 'buskSad' : 'busk'); }
      } else if (rec.talkCd <= 0 && Math.random() < 0.3) {
        rec.talkCd = rand(9, 22);
        pickLine(rec, 'busk');
      }
      return;
    }

    // Nothing ever put a ceiling on `wander`. A destination tucked behind a
    // bench, or a walker who drifts into a nav pocket, kept one NPC in that one
    // state for an entire session — measured at 328 s with zero metres
    // travelled. A destination not reached in 15 s is simply a bad
    // destination, so take another. Joggers are exempt: they run a fixed loop.
    if (st === 'wander' && rec.stateT > 15 && rec.kind !== 'jogger') {
      if (rec.kind === 'gardener') pickBed(rec); else pickPOI(rec);
      setState(rec, 'wander');
    }

    if (capyOk) {
      const d = distToCapy(rec);
      // Vision cone + distance falloff + occlusion, in place of the old raw
      // facing dot: nobody spots a capybara through the colonnade any more.
      const vis = seesCapy(rec, 20);

      // gardener: capybara vandalising the flower beds?
      if (rec.kind === 'gardener' && vis > 0.14) {
        if (inZone('flowerbed', capyX, capyZ) || (d < 7 && inZone('gardens', capyX, capyZ))) {
          startChase(rec);
          return;
        }
      }
      // tourist photo opportunity — the capybara has to actually pose for it
      if (rec.hasCamera && rec.photoCd <= 0 && d > 3.0 && d < 11 && vis > 0.42 && capySpd < 0.35) {
        const cg = game.capy && game.capy.group;
        let capyFacing = 1;
        if (cg) {
          const ax = rec.group.position.x - capyX, az = rec.group.position.z - capyZ;
          const al = Math.sqrt(ax * ax + az * az) || 1;
          capyFacing = (Math.sin(cg.rotation.y) * ax + Math.cos(cg.rotation.y) * az) / al;
        }
        if (capyFacing > 0.5) {
          setState(rec, 'photo');
          rec.flashed = false;
          lookAtCapy(rec);
          pickLine(rec, 'photo');
          return;
        }
      }
      // anybody: notice the strange rodent. The head-turn tell is nearly always
      // available; only the spoken line is on the long cooldown.
      // A PERSON WHO REMEMBERS YOU WATCHES FOR YOU. Further out, more often,
      // and with a different thing to say about it — and that is the entire
      // mechanical consequence of wariness in this crowd. Nothing here decides
      // whether anything can be taken, only how soon you are looked at.
      const wary = rec.wary || 0;
      const hot = wary > npcWARY_HEAT;
      if (d < 9 + wary * npcWARY_SEE && vis > 0.28 && rec.kind !== 'jogger' &&
          st !== 'lookAt' && rec.noticeCd <= 0) {
        setState(rec, 'lookAt');
        rec.noticeCd = hot ? 1.4 : 3.0;
        lookAtCapy(rec);
        if (rec.talkCd <= 0 && Math.random() < 0.6) {
          rec.talkCd = rand(8, 20);
          pickLine(rec, hot ? 'wary' : 'laugh');
        }
        return;
      }
    }

    if (rec.kind === 'jogger') {
      setState(rec, 'wander');
      return;
    }
    if (rec.kind === 'gardener') {
      if (st === 'calm' || st === 'retrieve') return;
      if (st === 'work' && npcDwell(rec, rec.stateT, 4, 9)) { pickBed(rec); setState(rec, 'wander'); }
      else if (st === 'idle' || st === 'lookAt') { pickBed(rec); setState(rec, 'wander'); }
      return;
    }
    // ---- MR WHIPPY STOPS AND NOBODY EVER WANTED ANYTHING -----------------
    // She dwells eleven seconds at each end of the promenade and for the life
    // of this chapter she was the only van in the world with no queue at it.
    // A tourist inside forty metres who is not doing anything else walks over,
    // stands in line, and leaves with a cone; if she pulls out first they say
    // so. It costs one state, it is entirely optional, and it turns the mini
    // into something the crowd is visibly interested in — which is the whole
    // reason to ride the roof of it.
    if ((rec.kind === 'tourist' || rec.kind === 'commuter') && st !== 'queue' &&
        rec.coneT < 0 && rec.queueCd <= 0 && vanQueueOpen()) {
      const q = vanQueueSpotAt(vanQueue.length);
      const dvx = q.x - rec.group.position.x, dvz = q.z - rec.group.position.z;
      if (dvx * dvx + dvz * dvz < 20 * 20) {
        rec.queueI = vanQueueJoin(rec);
        setState(rec, 'queue');
        if (rec.talkCd <= 0) { rec.talkCd = rand(9, 20); pickLine(rec, 'whippyQ'); }
        return;
      }
      rec.queueCd = rand(12, 30);       // too far — do not ask again this stop
    }

    // tourists
    if (st === 'lookAt' && rec.stateT > 2.5) setState(rec, 'idle');
    if (st === 'idle' && npcDwell(rec, rec.stateT, 2.5, 7)) { pickPOI(rec); setState(rec, 'wander'); }
    if (st === 'wander') {
      const dx = rec.target.x - rec.group.position.x, dz = rec.target.z - rec.group.position.z;
      if (dx * dx + dz * dz < 1.4) setState(rec, 'idle');
    }
    if (st === 'calm' && rec.stateT > 1.5) setState(rec, 'idle');
    if (st === 'idle' && rec.talkCd <= 0 && Math.random() < 0.12) {
      rec.talkCd = rand(12, 30);
      pickLine(rec, 'idle');
    }
  }

  function thinkIbis(rec) {
    // ---- THE TASK IS CALLED BIN-CHICKEN AND YOU NEVER SAW ONE -------------
    // The bin tips, fourteen bits of rubbish come out, the row ticks — and the
    // ibises, whose entire reason for being in this chapter is that moment,
    // were four metres into a flee because the capybara that knocked it over
    // was standing next to it. So the payoff happened behind the player, if it
    // happened at all.
    //
    // A bin chicken is not frightened of you. That is the whole national joke
    // about them: they will take a chip out of your hand. So the flee radius
    // COLLAPSES when there is an open bin in reach — from four metres to one
    // and a half, which is close enough that they still scatter if you charge
    // straight through them and far enough that you can stand there and watch
    // six of them work.
    const feast = ibisOpenBin(rec);
    if (capyOk) {
      const dx = capyX - rec.group.position.x, dz = capyZ - rec.group.position.z;
      const fr = feast ? 1.55 : 4.0;
      if (dx * dx + dz * dz < fr * fr) {
        rec.target.set(rec.group.position.x - dx * 2.2, 0, rec.group.position.z - dz * 2.2);
        setState(rec, 'flee');
        return;
      }
    }
    // flock to any tipped-over bin
    const props = game.props;
    if (props) {
      for (let i = 0; i < props.length; i++) {
        const p = props[i];
        if (!p || p.type !== 'bin' || !p.body) continue;
        // orientation/position for AI comes off the body, not the render pose
        npcQ1.set(p.body.quaternion.x, p.body.quaternion.y, p.body.quaternion.z, p.body.quaternion.w);
        npcV1.set(0, 1, 0).applyQuaternion(npcQ1);
        if (npcV1.y < 0.6) {
          const bx = p.body.position.x, bz = p.body.position.z;
          const tx = rec.target.x - bx, tz = rec.target.z - bz;
          if (rec.state !== 'work' || tx * tx + tz * tz > 6) {
            rec.target.set(bx + rand(-1.4, 1.4), 0, bz + rand(-1.4, 1.4));
            setState(rec, 'work');
          }
          return;
        }
      }
    }
    if (rec.state === 'work' || rec.state === 'flee') setState(rec, 'wander');
    if (rec.state === 'wander' && npcDwell(rec, rec.stateT, 2, 6)) {
      rec.target.set(clamp(rec.group.position.x + rand(-7, 7), npcBOUND_X0, npcBOUND_X1),
        0, clamp(rec.group.position.z + rand(-7, 7), 2, npcBOUND_Z1));
      rec.stateT = 0;
    }
  }

  /**
   * Is there a bin lying on its side within reach of this bird? Returns the
   * prop or null. Kept separate from thinkIbis's own loop because the answer
   * is wanted BEFORE the flee test, and re-walking the prop list twice a think
   * for six birds on a staggered cursor is nothing.
   */
  function ibisOpenBin(rec) {
    const props = game.props;
    if (!props) return null;
    const px = rec.group.position.x, pz = rec.group.position.z;
    for (let i = 0; i < props.length; i++) {
      const p = props[i];
      if (!p || p.type !== 'bin' || !p.body || p.removed) continue;
      const dx = p.body.position.x - px, dz = p.body.position.z - pz;
      if (dx * dx + dz * dz > 14 * 14) continue;
      npcQ1.set(p.body.quaternion.x, p.body.quaternion.y, p.body.quaternion.z, p.body.quaternion.w);
      npcV1.set(0, 1, 0).applyQuaternion(npcQ1);
      if (npcV1.y < 0.6) return p;
    }
    return null;
  }

  // How many of them are actually on it, and the squabble that goes with it.
  let ibisFeastT = 0, ibisSaidIt = false;
  function ibisFeastStep(dt) {
    ibisFeastT -= dt;
    if (ibisFeastT > 0) return;
    let n = 0, cx = 0, cz = 0;
    for (let i = 0; i < ibises.length; i++) {
      const r = ibises[i];
      if (r.state !== 'work' || r.speed > 0.5) continue;
      n++; cx += r.group.position.x; cz += r.group.position.z;
    }
    if (n < 2) { ibisFeastT = 0.6; return; }
    cx /= n; cz /= n;
    // Never a fixed gap — a squabble on a metronome is a car alarm.
    ibisFeastT = rand(0.7, 2.1) / (1 + n * 0.18);
    sfxAt('gull', cx, cz, clamp(0.16 + n * 0.055, 0.16, 0.44), rand(0.62, 0.82));
    if (n >= 4 && !ibisSaidIt) {
      ibisSaidIt = true;
      if (typeof game.toast === 'function') game.toast('the bin chickens have found it');
    }
  }
  function sfxAt(name, x, z, vol, pitch) {
    try { game.sfx(name, { volume: vol, pitch: pitch, at: { x: x, y: 0.6, z: z }, near: 7, far: 70 }); }
    catch (e) { /* optional */ }
  }

  // =============================================================== reactions
  function startle(rec, sx, sz) {
    if (rec.carryT >= 0 || rec.state === 'chase') return;   // a chase outranks surprise
    // Someone in the harbour cannot be startled out of the harbour: 'startled'
    // never restores yOff, so honking at the quay used to leave a dog-paddling
    // tourist buried to the hips in the pavement for the rest of the session.
    if (rec.state === 'swim' || rec.state === 'plunge') return;
    setState(rec, 'startled');
    rec.alarm = 1;
    rec.hopV = 3.1;
    rec.lookX = sx; rec.lookZ = sz;
    // A clear first frame — at the closer camera a startle that eases in over
    // 100ms just reads as drift. Snap the pose and the head, then let the
    // dampers take it from there.
    rec.tgtArmL = -2.6; rec.tgtArmR = -2.6;
    rec.poseArmL = -2.6; rec.poseArmR = -2.6;
    rec.tgtLean = -0.20; rec.poseLean = -0.20;
    rec.headYaw = clamp(npcWrapAngle(
      Math.atan2(sx - rec.group.position.x, sz - rec.group.position.z) - rec.yaw), -1.15, 1.15);
    emit('npc:startled', rec);
    if (Math.random() < 0.45) pickLine(rec, 'startle');
  }

  // ------------------------------------------------------------- the sea wall
  function envOverWater(x, z) {
    const e = game.env;
    if (e && typeof e.isOverWater === 'function') {
      try { return !!e.isOverWater(x, z); } catch (err) { /* fall through */ }
    }
    return z < npcEDGE_Z;
  }
  function envWaterY(x, z) {
    const e = game.env;
    if (e && typeof e.waterHeightAt === 'function') {
      try {
        const y = e.waterHeightAt(x, z);
        if (isFinite(y)) return y;
      } catch (err) { /* fall through */ }
    }
    return (e && isFinite(e.waterLevel)) ? e.waterLevel : -0.5;
  }

  /**
   * A badly startled Sydneysider does not run somewhere sensible — he backs
   * away from the capybara, and on the quay that is straight at the harbour.
   * We bend the flee vector seaward in proportion to the fright, then let the
   * flee state pick between the sea wall ('cornered') and a swim ('plunge').
   */
  function beginFlee(rec) {
    let dx = rec.group.position.x - rec.lookX;
    let dz = rec.group.position.z - rec.lookZ;
    const l = Math.sqrt(dx * dx + dz * dz) || 1;
    dx /= l; dz /= l;
    dz -= npcSEA_BIAS * clamp(rec.alarm, 0, 1);
    const l2 = Math.sqrt(dx * dx + dz * dz) || 1;
    dx /= l2; dz /= l2;
    // Only a seaward retreat can end in the drink, and only one in six does.
    rec.plunge = (dz < -0.3) && (Math.random() < npcPLUNGE_ODDS);
    rec.zMin = rec.plunge ? npcSWIM_ZMIN : npcEDGE_STOP;
    rec.target.set(
      clamp(rec.group.position.x + dx * 12, npcBOUND_X0, npcBOUND_X1), 0,
      clamp(rec.group.position.z + dz * 12, npcSWIM_ZMIN, npcBOUND_Z1));
    setState(rec, 'flee');
  }

  /** Over he goes. Slapstick only: he surfaces, paddles back and climbs out. */
  function beginPlunge(rec) {
    if (rec.state === 'plunge' || rec.state === 'swim') return;
    setState(rec, 'plunge');
    rec.plunge = false;
    rec.zMin = npcSWIM_ZMIN;
    rec.swimT = 0;
    rec.saidWet = false;
    rec.flail = 1;
    rec.alarm = 1;
    // The drop is integrated under gravity from here (see case 'plunge'), so the
    // ballistic startle-hop must not fight it — it only ever pops upward.
    rec.hop = 0; rec.hopV = 0;
    rec.fallV = npcPLUNGE_V0;
    rec.splashed = false;
    rec.climbT = -1;
    rec.tgtArmL = -2.9; rec.tgtArmR = -2.9;
    rec.poseArmL = -2.9; rec.poseArmR = -2.9;
    pickLine(rec, 'splash');
    // The funniest thing in the chapter should move the needle: 'npc:startled'
    // is the contract event systems.js already turns into chaos + chase music.
    // The splash sfx and the shake wait for the waterline, in case 'plunge'.
    emit('npc:startled', rec);
    try { game.toast('Man overboard.'); } catch (e) { /* optional */ }
  }

  /** A diner discovers a capybara standing in the calamari. */
  function standUp(rec) {
    if (rec.state === 'swim' || rec.state === 'plunge') return;
    setState(rec, 'shoo');
    rec.seated = 0;
    rec.alarm = 1;
    rec.hopV = 2.4;
    rec.stumble = 0.8;
    rec.tgtArmL = -2.5; rec.tgtArmR = -2.5;
    rec.poseArmL = -2.5; rec.poseArmR = -2.5;
    lookAtCapy(rec);
    pickLine(rec, 'standUp');
    sfx('gasp');
    emit('npc:startled', rec);
    finish('cafe-table');
    try { game.shake(0.12); } catch (e) { /* optional */ }
  }

  /** Is this one still nursing an intact hot drink? */
  function npcHoldsDrink(rec) {
    const p = rec.heldProp;
    return !!(p && npcDRINK[p.type] && !p.spilled && !p.held && !p.removed);
  }

  /**
   * The body-check payoff. props.js owns 'coffee-spill' and its causation gate;
   * all we do is make the cup leave the hand with the capybara's momentum and
   * leave behind the evidence that the capybara is why. The chain from here is
   *   dropOwned -> spillArmed -> cup lands -> physSpill -> 'coffee-spill'
   * and physSpill's own 'prop:impact' brings the victim's reaction back to us.
   */
  function npcFumble(rec, p) {
    if (!p || p.held || p.spilled || p.removed) return;
    const t = (game.state && game.state.time) || 0;
    if (p.lastImpact !== undefined && t - p.lastImpact < 0.5) return;

    rec.heldProp = null;
    p.owner = null;
    // clear first frame: the arms go up NOW, not over the next 100ms
    rec.flail = 1;
    rec.stumble = 1;
    rec.tgtArmL = -2.9; rec.tgtArmR = -2.9;
    rec.poseArmL = -2.9; rec.poseArmR = -2.9;
    rec.hopV = 2.0;
    rec.alarm = 1;
    rec.lookX = capyX; rec.lookZ = capyZ;

    if (game.physics && typeof game.physics.dropOwned === 'function') {
      try { game.physics.dropOwned(p, capyVX * 0.6, 2.0, capyVZ * 0.6); }
      catch (e) { return; }
    } else return;

    // dropOwned nulls the owner and knows nothing about who did it; props.js's
    // spill gate needs both a victim and a fresh capybara fingerprint.
    p.stolenFrom = rec;
    p.disturbed = true;
    p.lastCapyTouch = t;
    p.releaseTime = t;
    p.lastImpact = t;
    sfx('gasp');
    try { game.shake(0.18); } catch (e) { /* optional */ }
  }

  function startChase(rec) {
    if (rec.state === 'chase' || rec.carryT >= 0) return;
    if (rec.state === 'swim' || rec.state === 'plunge') return;   // finish the swim first
    setState(rec, 'chase');
    rec.chaseT = 0;
    rec.alarm = 1;
    emit('npc:chase', rec);
    pickLine(rec, rec.kind === 'gardener' ? 'chase' : 'stolen');
    sfx(rec.kind === 'gardener' ? 'whistle' : 'gasp');
  }

  game.events.on('capy:wheek', (p) => {
    // The locals are in whatever chapter they were registered in, so they hear
    // this BEFORE the Sydney gate rather than after it. The payload goes with
    // it because `soft` is what tells them whether they were called to or
    // shouted at — see localsSay.
    localsSay('wheek', p);
    if (!biomeLive()) return;              // wheeking in Pasto is Pasto's problem
    const sx = p && p.position ? p.position.x : capyX;
    const sz = p && p.position ? p.position.z : capyZ;
    let laughs = 0;
    for (let i = 0; i < humans.length; i++) {
      const rec = humans[i];
      const dx = sx - rec.group.position.x, dz = sz - rec.group.position.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > 20 * 20) continue;
      startle(rec, sx, sz);
      rec.reactMode = (Math.random() < 0.45 || laughs > 2) ? 1 : 0;   // 1 = flee, 0 = laugh+point
      if (rec.reactMode === 0) laughs++;
    }
    for (let i = 0; i < ibises.length; i++) {
      const rec = ibises[i];
      const dx = sx - rec.group.position.x, dz = sz - rec.group.position.z;
      if (dx * dx + dz * dz > 26 * 26) continue;
      rec.target.set(rec.group.position.x - dx * 1.4, 0, rec.group.position.z - dz * 1.4);
      setState(rec, 'flee');
    }
  });

  game.events.on('capy:grab', (p) => {
    if (!biomeLive()) return;
    const prop = p && p.prop;
    if (!prop) return;
    // props.js nulls prop.owner before it emits, but ships the previous owner
    // as payload.from — so accept either. capybara.js re-emits without `from`,
    // which lands here with nothing to do and falls straight out.
    const rec = prop.owner || (p.from && p.from.nodes ? p.from : null);
    if (!rec || !rec.nodes) return;
    if (prop.stolenFrom === rec && rec.state === 'chase') return;   // duplicate emit
    prop.owner = null;
    prop.stolenFrom = rec;
    if (prop.body) prop.body.collisionResponse = true;
    if (rec.heldProp === prop) rec.heldProp = null;
    rec.stolenType = prop.type;
    startChase(rec);
    // The busker's hat is his takings, not a sun hat: it is the Circular Quay task,
    // and it must NOT also hand out chapter 1's 'steal-hat'.
    if (prop.type === 'hat') {
      if (rec.kind === 'busker') { rec.robbed = true; finish('busker-hat'); pickLine(rec, 'buskRob'); }
      else finish('steal-hat');
    }
  });

  // ---- EATING IT IN FRONT OF THEM, IN SYDNEY (v23) ------------------------
  // The mischief economy's produce reaction, in the two chapters that are not
  // populated by `locals` and therefore never see it. Sydney and Pasto already
  // have ownership — a prop carries `owner`, and taking it starts a chase, which
  // is a stronger version of what a local does — so this is the one of the three
  // that was actually missing here. `startle` is the existing verb: the hop, the
  // arms, the head snapping round. Nearest ONE person, on the same reasoning as
  // the praise line: a square that all shouts at once is a cutscene.
  const npcGRAZE_R = 7.0;
  game.events.on('capy:graze', () => {
    if (!biomeLive()) return;
    const capy = game.capy;
    if (!capy || !capy.position) return;
    const cx = capy.position.x, cz = capy.position.z;
    let best = null, bd = npcGRAZE_R * npcGRAZE_R;
    for (let i = 0; i < humans.length; i++) {
      const r = humans[i];
      if (!r.group || r.state === 'chase' || r.state === 'swim' || r.state === 'plunge') continue;
      const dx = r.group.position.x - cx, dz = r.group.position.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < bd) { bd = d2; best = r; }
    }
    if (!best) return;
    startle(best, cx, cz);
    pickLine(best, 'shoo');
  });

  game.events.on('prop:impact', (p) => {
    if (!biomeLive()) return;
    const prop = p && p.prop;
    if (!prop) return;
    let reacted = false;
    if (prop.type === 'coffee' || prop.type === 'icecream') {
      // The owner has usually already been robbed of it, so remember the victim.
      const owner = prop.owner || prop.stolenFrom;
      if (owner && owner.nodes && owner.state !== 'chase' && owner.carryT < 0) {
        const src = p.position || (prop.body ? prop.body.position : null);
        const ox = src ? src.x : capyX;
        const oz = src ? src.z : capyZ;
        const dx = owner.group.position.x - ox, dz = owner.group.position.z - oz;
        if (dx * dx + dz * dz <= 30 * 30) {
          prop.owner = null;
          prop.stolenFrom = null;
          if (prop.body) prop.body.collisionResponse = true;
          if (owner.heldProp === prop) owner.heldProp = null;
          owner.dejectStage = 0;
          setState(owner, 'calm');
          owner.dejected = 2.6;
          owner.lookX = ox;
          owner.lookZ = oz;
          pickLine(owner, 'coffee');
          sfx('gasp');
          reacted = true;
        }
      }
    }
    // anything hitting the ground hard near a person gets a jump out of them
    if (!reacted && p.speed > 3 && p.position) {
      for (let i = 0; i < humans.length; i++) {
        const r = humans[i];
        if (r.dejected > 0) continue;
        const dx = p.position.x - r.group.position.x, dz = p.position.z - r.group.position.z;
        if (dx * dx + dz * dz < 2.6 * 2.6) {
          startle(r, p.position.x, p.position.z);
          r.reactMode = 1;
          break;
        }
      }
    }
  });

  game.events.on('capy:dig', (p) => {
    if (!biomeLive()) return;
    const x = p && p.position ? p.position.x : capyX;
    const z = p && p.position ? p.position.z : capyZ;
    if (!inZone('gardens', x, z) && !inZone('flowerbed', x, z)) return;
    for (let i = 0; i < humans.length; i++) {
      const rec = humans[i];
      if (rec.kind !== 'gardener') continue;
      const dx = x - rec.group.position.x, dz = z - rec.group.position.z;
      const d2 = dx * dx + dz * dz;
      // The old test was a 34 m sphere with no vision test at all, which made the
      // whole cone decorative: a gardener facing away behind the podium sprinted
      // at you from 30 m. Now he has to SEE it — or be close enough to hear it.
      if (d2 > npcVIS_FAR * npcVIS_FAR) continue;
      if (d2 < 6 * 6 || visionOf(rec, x, z, npcVIS_FAR) > 0.14) startChase(rec);
    }
  });

  // ==================================================== retrieve / replant
  /** The nearest loose copy of whatever was nicked off this NPC, or null. */
  function findLost(rec) {
    if (!rec.stolenType) return null;
    const arr = game.props;
    if (!arr) return null;
    let best = null, bestD = 25 * 25;
    for (let i = 0; i < arr.length; i++) {
      const p = arr[i];
      if (!p || p.type !== rec.stolenType || p.held || p.owner || !p.mesh || !p.body) continue;
      if (p.mesh.parent !== scene) continue;
      // gameplay logic reads body.position, never the interpolated render pose
      const dx = p.body.position.x - rec.group.position.x;
      const dz = p.body.position.z - rec.group.position.z;
      const d = dx * dx + dz * dz;
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }

  function reclaim(rec, p) {
    p.owner = rec;
    p.stolenFrom = null;
    rec.heldProp = p;
    rec.stolenType = '';
    if (p.body) {
      p.body.type = CANNON.Body.KINEMATIC;
      p.body.updateMassProperties();
      p.body.allowSleep = false;
      p.body.collisionResponse = false;
      p.body.velocity.set(0, 0, 0);
      p.body.angularVelocity.set(0, 0, 0);
      p.body.wakeUp();
    }
    if (p.type === 'hat') rec.hasHat = true;
  }

  /** Put a dug-up rose back in the bed, so the world can recover and be ruined again. */
  function replantNear(rec) {
    const arr = game.props;
    if (!arr) return;
    for (let i = 0; i < arr.length; i++) {
      const p = arr[i];
      if (!p || p.type !== 'flower' || p.planted || p.held || p.owner || !p.body || !p.mesh) continue;
      if (p.mesh.parent !== scene) continue;
      const dx = p.body.position.x - rec.group.position.x;
      const dz = p.body.position.z - rec.group.position.z;
      if (dx * dx + dz * dz > 2.5 * 2.5) continue;
      p.planted = true;
      p.grabbable = false;
      p.frozen = true;
      npcPlaceBody(p.body, p.body.position.x, p.originY, p.body.position.z);
      npcPlaceQuat(p.body, 0, 0, 0, 1);
      p.body.velocity.set(0, 0, 0);
      p.body.angularVelocity.set(0, 0, 0);
      p.body.type = CANNON.Body.STATIC;
      p.body.updateMassProperties();
      p.body.sleep();
      p.mesh.position.set(p.body.position.x, p.body.position.y, p.body.position.z);
      p.mesh.quaternion.set(0, 0, 0, 1);
      return;
    }
  }

  // ============================================================ per-npc step
  function stepHuman(rec, dt) {
    rec.stateT += dt;
    rec.photoCd -= dt;
    rec.talkCd -= dt;
    rec.noticeCd -= dt;
    rec.queueCd -= dt;
    if (rec.chatCd !== undefined) rec.chatCd -= dt;
    // The 99 has a life. It is eaten, and then the hand is empty again — a
    // crowd in which every third person is permanently holding an ice cream
    // reads as a bug within about a minute.
    if (rec.coneT >= 0) {
      rec.coneT -= dt;
      const eat = clamp(rec.coneT / 6, 0, 1);          // the last six seconds shrink it
      rec.nodes.coneN.scale.setScalar(rec.coneT > 0 ? 0.55 + eat * 0.45 : 0);
      if (rec.coneT < 0) { rec.coneT = -1; rec.nodes.coneN.scale.setScalar(0); }
    }
    rec.alarm = damp(rec.alarm, 0, 0.9, dt);
    // ---- ...AND WHAT THEY STILL REMEMBER (v19) ---------------------------
    // Alarm is what a person feels and it is gone in under a second. Wariness
    // is what they remember, and it is DERIVED from alarm rather than set at
    // each of the six places that raise it — so being startled, robbed, chased,
    // soaked or barged all feed it for free and none of those call sites had to
    // learn a new word. See the npcWARY_* block.
    if (rec.alarm > (rec.wary || 0)) rec.wary = rec.alarm;
    else if (rec.wary > 0) { rec.wary -= dt / npcWARY_T; if (rec.wary < 0) rec.wary = 0; }
    rec.moveX = rec.moveX || 0; rec.moveZ = rec.moveZ || 0;

    // --- dejection is a timer, not a state ---------------------------------
    // It used to tick down only inside case 'calm', so anything that knocked the
    // victim out of 'calm' — noticing the capybara, most often, on the very next
    // think tick — froze `dejected` above zero forever, and a stuck `dejected`
    // permanently disables prop startles, body-check startles and the stagger.
    if (rec.dejected > 0) {
      rec.dejected -= dt;
      if (rec.dejected < 1.3 && rec.dejectStage === 0 && capyOk) { rec.dejectStage = 1; lookAtCapy(rec); }
      if (rec.dejected < 0) rec.dejected = 0;
    }

    // --- nobody is left standing in the harbour -----------------------------
    // 'swim' owns the climb-out; any other state must have both the vertical
    // offset and the sea licence handed back, or an interrupted swimmer walks
    // the quay buried to the hips with permission to stroll over open water.
    const stW = rec.state;
    if (stW !== 'swim' && stW !== 'plunge' && stW !== 'flee') {
      if (rec.group.position.z < npcEDGE_STOP) {
        rec.group.position.z = Math.min(npcEDGE_STOP, rec.group.position.z + npcCLIMB_SPD * dt);
        if (rec.zMin > rec.group.position.z) rec.zMin = rec.group.position.z;
      } else {
        rec.zMin = npcEDGE_STOP;
        if (rec.yOff < 0) {
          rec.yOff = damp(rec.yOff, 0, 6, dt);
          if (rec.yOff > -0.02) rec.yOff = 0;
        }
      }
    }

    // --- barrelled into at speed ------------------------------------------
    // The old test wanted 1.0 m between centres, which the collision hulls make
    // very nearly unreachable — which is why barging never fired. npcCHECK_R is
    // measured from the surfaces that actually touch.
    if (capyOk && rec.carryT < 0 && capySpdH > npcCHECK_SPD && distToCapy(rec) < npcCHECK_R) {
      const held = rec.heldProp;
      if (held && npcDRINK[held.type] && !held.spilled && !held.held) {
        if (held.owner === rec) npcFumble(rec, held);
        else { rec.heldProp = null; rec.flail = 1; rec.stumble = 1; }
      }
      // 'cornered' is excluded because that state owns its own collision: the
      // shove into the harbour needs 2.24 m/s, but a generic startle preempted
      // it at 3.2 and the capybara walks at 4.2, so the dunk could never fire.
      if (rec.state !== 'chase' && rec.state !== 'startled' && rec.state !== 'cornered' &&
          rec.dejected <= 0) {
        startle(rec, capyX, capyZ);
        rec.reactMode = Math.random() < 0.5 ? 1 : 0;
        rec.stumble = 1;
      }
    }

    let spd = 0;
    rec.tgtArmL = 0; rec.tgtArmR = 0; rec.tgtLean = 0; rec.tgtCrouch = 0;

    // --- gardener hauling the offender off the premises --------------------
    if (rec.carryT >= 0) {
      rec.carryT += dt;
      rec.tgtArmL = -2.7; rec.tgtArmR = -2.7;
      const d = steerTo(rec, npcGATE_X + 1.5, npcGATE_Z, dt);
      spd = 3.0;
      rec.lookX = npcGATE_X; rec.lookZ = npcGATE_Z;
      const capy = game.capy;
      if (capy && capy.body) {
        // held out in front, in the hands — not levitating above his hat
        const fx = Math.sin(rec.yaw), fz = Math.cos(rec.yaw);
        const hx = rec.group.position.x + fx * 0.62, hz = rec.group.position.z + fz * 0.62;
        npcPlaceBody(capy.body, hx, 1.62, hz);
        capy.body.velocity.set(0, 0, 0);
        capy.body.angularVelocity.set(0, 0, 0);
        if (capy.group) {
          capy.group.position.set(hx, 1.62, hz);
          capy.group.updateMatrixWorld(true);
        }
        if (capy.position) capy.position.set(hx, 1.62, hz);
      }
      if (d < 2.0 || rec.carryT > 2.2) {
        if (capy && capy.body) {
          npcPlaceBody(capy.body, npcGATE_X - 2.0, 1.5, npcGATE_Z + 0.5);
          capy.body.velocity.set(-3.2, 3.4, 0.4);
          if (capy.group) {
            capy.group.position.set(npcGATE_X - 2.0, 1.5, npcGATE_Z + 0.5);
            capy.group.updateMatrixWorld(true);
          }
          if (capy.position) capy.position.set(npcGATE_X - 2.0, 1.5, npcGATE_Z + 0.5);
        }
        pickLine(rec, 'dump');
        sfx('thud');
        try { game.shake(0.35); } catch (e) { /* optional */ }
        try { game.toast('Escorted from the premises.'); } catch (e) { /* optional */ }
        rec.carryT = -1;
        if (game.capy && game.capy.carriedBy === rec) game.capy.carriedBy = null;
        setState(rec, 'calm');
        emit('npc:calm', rec);
        pickBed(rec);
      }
      npcSeparate(rec, dt);
      moveRec(rec, dt, spd);
      animHuman(rec, dt);
      return;
    }

    switch (rec.state) {
      case 'startled': {
        rec.tgtArmL = -2.6; rec.tgtArmR = -2.6;
        rec.tgtLean = -0.18;
        if (rec.stateT > 0.55) {
          const dC = capyOk ? distToCapy(rec) : 99;
          if (npcHoldsDrink(rec)) {
            // Nobody sprints with a full cup. Far away they just stare and
            // clutch it; close up they dither, which is what makes them
            // body-checkable at all.
            if (dC < npcFLUSTER_R) { setState(rec, 'fluster'); }
            else { setState(rec, 'lookAt'); }
          } else if (rec.reactMode === 1) { // flee — seaward, because of course
            beginFlee(rec);
          } else {
            setState(rec, 'lookAt');
            if (Math.random() < 0.5) pickLine(rec, 'laugh');
          }
        }
        break;
      }
      case 'fluster': {   // holding a hot drink, far too flustered to escape
        if (capyOk) lookAtCapy(rec);
        const wob = Math.sin(rec.stateT * 6.2 + rec.idlePhase);
        rec.tgtArmL = -2.15 + wob * 0.40;
        rec.tgtArmR = -2.45 - wob * 0.40;
        rec.tgtLean = -0.14;
        rec.tgtCrouch = -0.05;
        // a panicked backwards shuffle, veering — slow enough to be caught
        const dx = rec.group.position.x - capyX, dz = rec.group.position.z - capyZ;
        const l = Math.sqrt(dx * dx + dz * dz) || 1;
        const a = Math.atan2(dx / l, dz / l) + wob * 0.7;
        steerTo(rec, rec.group.position.x + Math.sin(a) * 3.5,
          rec.group.position.z + Math.cos(a) * 3.5, dt);
        spd = 1.15;
        if (rec.stumble > 0.05) spd = 0.5;
        if (!capyOk || !npcHoldsDrink(rec) || distToCapy(rec) > npcFLUSTER_R + 1.5 || rec.stateT > 5) {
          setState(rec, 'calm');
          emit('npc:calm', rec);
        }
        break;
      }
      case 'flee': {
        spd = rec.kind === 'jogger' ? 4.0 : 3.2;
        if (npcHoldsDrink(rec)) {
          // caught mid-flight with a cup: they slow to a flap and can be caught
          spd = 1.4;
          if (capyOk && distToCapy(rec) < npcFLUSTER_R * 0.6) { setState(rec, 'fluster'); break; }
        }
        steerTo(rec, rec.target.x, rec.target.z, dt);
        rec.tgtArmL = -1.9; rec.tgtArmR = -1.9;
        rec.lookX = rec.group.position.x + rec.moveX * 4;
        rec.lookZ = rec.group.position.z + rec.moveZ * 4;
        // --- ran out of Australia -------------------------------------------
        if (rec.moveZ < -0.05) {
          const pz = rec.group.position.z;
          if (rec.plunge) {
            if (pz < npcEDGE_Z || envOverWater(rec.group.position.x, pz - 0.4)) {
              beginPlunge(rec);
              break;
            }
          } else if (pz <= npcEDGE_STOP + 0.10) {
            setState(rec, 'cornered');
            rec.cornerT = 0;
            pickLine(rec, 'cornered');
            sfx('gasp');
            break;
          }
        }
        const dx = rec.target.x - rec.group.position.x, dz = rec.target.z - rec.group.position.z;
        if (rec.stateT > 3.5 || dx * dx + dz * dz < 1.5) {
          setState(rec, 'calm');
          emit('npc:calm', rec);
        }
        break;
      }
      case 'cornered': {
        // Heels on the coping, harbour behind, capybara in front. No exit.
        rec.cornerT += dt;
        if (capyOk) lookAtCapy(rec);
        const w = Math.sin(rec.cornerT * 11 + rec.idlePhase);
        rec.tgtArmL = -2.75 + w * 0.38;
        rec.tgtArmR = -2.75 - w * 0.38;
        rec.tgtLean = -0.26;
        rec.tgtCrouch = -0.06;
        if (rec.flail < 0.55) rec.flail = 0.55;
        // A determined shove at the wall is the whole gag — in he goes.
        if (capyOk && distToCapy(rec) < npcCHECK_R && capySpdH > npcCHECK_SPD * 0.7) {
          beginPlunge(rec);
          break;
        }
        // edge sideways along the wall rather than backwards through it
        const away = (rec.group.position.x >= capyX) ? 1 : -1;
        steerTo(rec, rec.group.position.x + away * 3, npcEDGE_STOP + 0.05, dt);
        spd = (capyOk && distToCapy(rec) < 3.4) ? 1.3 : 0;
        if (rec.cornerT > 1.7 && rec.cornerT < 1.7 + dt) pickLine(rec, 'cornered');
        if (!capyOk || distToCapy(rec) > 6.5 || rec.cornerT > 5.0) {
          setState(rec, 'calm');
          emit('npc:calm', rec);
        }
        break;
      }
      case 'plunge': {
        steerTo(rec, rec.target.x, Math.min(rec.target.z, npcWATER_Z - 1.5), dt);
        spd = 2.4;
        rec.tgtArmL = -2.9; rec.tgtArmR = -2.9;
        rec.tgtLean = -0.35;
        // A real fall: over-balance, then accelerate. The old exponential damp
        // was an ease-OUT — fastest at the coping, slowest at the water, which
        // is precisely backwards and left no moment of impact to read.
        rec.fallV -= npcPLUNGE_G * dt;
        rec.yOff += rec.fallV * dt;
        const landed = rec.yOff <= npcSWIM_YOFF;
        if (landed) { rec.yOff = npcSWIM_YOFF; rec.fallV = 0; }
        // Impact feedback fires when he MEETS the surface, not when he leaves it.
        if (!rec.splashed && rec.yOff <= npcSPLASH_Y) {
          rec.splashed = true;
          const wy = envWaterY(rec.group.position.x, rec.group.position.z);
          fireSplash(rec.group.position.x, wy, rec.group.position.z);
          sfx('splash');
          try {
            game.events.emit('npc:splash',
              { npc: rec, position: npcV3.set(rec.group.position.x, wy, rec.group.position.z) });
          } catch (e) { /* bus optional */ }
          try { game.shake(0.22); } catch (e) { /* optional */ }
        }
        if (landed || rec.stateT > 1.4) {
          setState(rec, 'swim');
          rec.swimT = 0;
          rec.wet = 1;
        }
        break;
      }
      case 'swim': {
        // Dog-paddle. Nobody drowns at Circular Quay; they are merely damp.
        rec.swimT += dt;
        const wy = envWaterY(rec.group.position.x, rec.group.position.z);
        const bob = Math.sin(rec.swimT * 3.1) * 0.05;
        rec.yOff = damp(rec.yOff, wy + npcSWIM_YOFF - (-0.5) + bob, 6, dt);
        const paddle = Math.sin(rec.swimT * 7.5);
        rec.tgtArmL = -1.15 + paddle * 0.8;
        rec.tgtArmR = -1.15 - paddle * 0.8;
        rec.tgtLean = 0.24;
        rec.tgtCrouch = -0.10;
        if (!rec.saidWet && rec.swimT > 0.7) { rec.saidWet = true; pickLine(rec, 'soggy'); }
        if (rec.climbT < 0) {
          if (rec.swimT > 0.9) {
            steerTo(rec, rec.group.position.x, npcEDGE_STOP + 1.2, dt);
            spd = 1.6;
          }
          // reached the face of the wall — start hauling himself out
          if (rec.group.position.z > npcEDGE_Z + 0.15) {
            rec.climbT = 0;
            rec.climbZ0 = rec.group.position.z;
          }
        } else {
          // The climb is a DIAGONAL: height and shoreward travel advance off the
          // same parameter, so he goes up the face of the sea wall and over the
          // coping instead of levitating vertically through solid sandstone.
          rec.climbT = Math.min(1, rec.climbT + dt / 0.62);
          const t = rec.climbT * rec.climbT * (3 - 2 * rec.climbT);
          rec.yOff = lerp(npcSWIM_YOFF, 0, t);
          rec.zMin = npcSWIM_ZMIN;                 // no clamp fighting the climb
          rec.group.position.z = lerp(rec.climbZ0, npcEDGE_STOP + 0.30, t);
          rec.moveX = 0; rec.moveZ = 0; spd = 0;
          rec.tgtArmL = -1.85 - Math.sin(t * Math.PI) * 0.5;
          rec.tgtArmR = -1.85 - Math.sin(t * Math.PI) * 0.5;
          rec.tgtLean = 0.34 * (1 - t);
          rec.tgtCrouch = -0.20 * (1 - t);
          if (rec.climbT >= 1) {
            rec.yOff = 0;
            rec.climbT = -1;
            rec.zMin = npcEDGE_STOP;
            rec.dejected = 2.4;
            rec.dejectStage = 0;
            setState(rec, 'calm');
            emit('npc:calm', rec);
          }
        }
        break;
      }
      case 'seated': {   // terrace diner, mid-conversation, mid-calamari
        rec.seated = 1;
        rec.tgtCrouch = npcSEAT_CROUCH;
        const ch = Math.sin(game.state.time * 1.1 + rec.chatPhase);
        rec.tgtArmL = -0.55 + ch * 0.16;
        rec.tgtArmR = -0.72 - ch * 0.16;
        rec.lookX = rec.tableX; rec.lookZ = rec.tableZ;
        // something has just been put in front of them: one hand up, and
        // they look at the waiter rather than at each other
        if (rec.thanks > 0) {
          rec.thanks -= dt;
          const tk = Math.sin(clamp(1 - rec.thanks / 1.6, 0, 1) * Math.PI);
          rec.tgtArmR = -0.72 - tk * 1.15;
          rec.tgtLean = -tk * 0.10;
        }
        rec.yaw = npcDampAngle(rec.yaw, rec.seatYaw, 6, dt);
        // nudged off the chair by a passing rodent? sit back down.
        rec.group.position.x = damp(rec.group.position.x, rec.seatX, 4, dt);
        rec.group.position.z = damp(rec.group.position.z, rec.seatZ, 4, dt);
        if (capyOnTable(rec.tableX, rec.tableZ)) standUp(rec);
        break;
      }
      case 'shoo': {     // up out of the chair, arms going like windmills
        rec.seated = 0;
        if (capyOk) lookAtCapy(rec);
        const w = Math.sin(rec.stateT * 13 + rec.idlePhase);
        rec.tgtArmL = -2.45 + w * 0.45;
        rec.tgtArmR = -2.45 - w * 0.45;
        rec.tgtLean = -0.20;
        if (rec.stateT < 0.9) {
          const dx = rec.group.position.x - rec.tableX, dz = rec.group.position.z - rec.tableZ;
          const l = Math.sqrt(dx * dx + dz * dz) || 1;
          steerTo(rec, rec.group.position.x + dx / l * 2.2, rec.group.position.z + dz / l * 2.2, dt);
          spd = 1.9;
        }
        if (rec.stateT > 1.6 && rec.stateT < 1.6 + dt) pickLine(rec, 'shoo');
        if (rec.stateT > 3.2 && !capyOnTable(rec.tableX, rec.tableZ)) setState(rec, 'resit');
        break;
      }
      case 'resit': {
        rec.seated = 0;
        const d = steerTo(rec, rec.seatX, rec.seatZ, dt);
        spd = 1.1;
        rec.lookX = rec.seatX; rec.lookZ = rec.seatZ;
        if (d < 0.35 || rec.stateT > 9) { setState(rec, 'seated'); rec.seated = 1; }
        break;
      }
      case 'serve': {    // waiter: counter -> table -> counter, tray held level
        const toCounter = (rec.serveI & 1) === 0;
        const ti = terrTableN > 0 ? ((rec.serveI >> 1) % terrTableN) : 0;
        const tx = toCounter ? terrCounter.x : terrTables[ti * 2];
        const tz = toCounter ? terrCounter.z : terrTables[ti * 2 + 1] + 1.15;
        const d = steerTo(rec, tx, tz, dt);
        spd = 1.35;
        rec.tgtArmL = -1.25; rec.tgtArmR = -1.25;
        rec.lookX = rec.group.position.x + rec.moveX * 5;
        rec.lookZ = rec.group.position.z + rec.moveZ * 5;
        if (d < 1.7) {
          spd = 0;
          rec.lookX = tx; rec.lookZ = tz;
          if (!toCounter) {
            // the delivery: the tray goes down and comes back up
            const u = clamp(rec.stateT / 1.2, 0, 1);
            const dip = Math.sin(u * Math.PI) * 0.55;
            rec.tgtArmL = -1.25 + dip; rec.tgtArmR = -1.25 + dip;
            rec.tgtLean = dip * 0.5;
            if (!rec.served && rec.stateT > 0.55) {
              rec.served = 1;
              sfx('pop', { volume: 0.26, pitch: rand(1.5, 1.9) });
              if (rec.talkCd <= 0) { rec.talkCd = rand(11, 24); pickLine(rec, 'serve'); }
              // ...and the pair at this table look up. Nothing else on that
              // terrace has ever reacted to anything but the capybara.
              for (let k = 0; k < game.npcs.length; k++) {
                const q = game.npcs[k];
                if (!q || q.kind !== 'patron' || q.state !== 'seated') continue;
                if (Math.abs(q.tableX - tx) > 0.6 || Math.abs(q.tableZ - (tz - 1.15)) > 0.6) continue;
                q.thanks = 1.6;
              }
            }
          }
          if (rec.stateT > 1.7) { rec.serveI = (rec.serveI + 1) % 16; rec.stateT = 0; rec.served = 0; }
        }
        break;
      }
      case 'chase': {
        rec.chaseT += dt;
        if (capyOk) {
          steerTo(rec, capyX, capyZ, dt);
          lookAtCapy(rec);
          spd = rec.kind === 'gardener' ? 5.4 : 4.4;
          rec.tgtArmR = -1.5 + Math.sin(rec.stateT * 16) * 0.7;   // waving the rake
          rec.tgtArmL = -0.5;
          const d = distToCapy(rec);
          // a walking capybara is catchable; only a running one gets away
          if (rec.kind === 'gardener' && d < 4.5 && rec.chaseT > 0.6) spd = 7.0;
          if (rec.kind === 'gardener') {
            if (rec.chaseT > 1.0) finish('chased');
            if (d < 1.8) {
              rec.carryT = 0;
              // TELL THE ANIMAL IT IS BEING CARRIED. capybara.js used to infer
              // this from "airborne above y 1.5", which is true in his hands and
              // also true of every hop taken anywhere with relief in it.
              if (game.capy) game.capy.carriedBy = rec;
              if (game.physics && typeof game.physics.release === 'function') {
                try { game.physics.release(null); } catch (e) { /* optional */ }
              }
              sfx('pop');
              break;
            }
            const out = !inZone('gardens', capyX, capyZ);
            if ((out && rec.chaseT > 3.0) || d > 26 || rec.chaseT > 14) {
              setState(rec, 'calm');
              pickLine(rec, 'breath');
              emit('npc:calm', rec);
            }
          } else {
            if (npcDwell(rec, rec.chaseT, 4.5, 7.5) || d > 24) {
              setState(rec, 'retrieve');
              pickLine(rec, 'giveUp');
            } else if (rec.chaseT > 1.4 && Math.random() < 0.012) {
              pickLine(rec, 'stolen');
            }
          }
        } else setState(rec, 'idle');
        break;
      }
      case 'retrieve': {   // pat the pockets, spot the thing, go and get it back
        const lost = findLost(rec);
        if (lost) {
          const dl = steerTo(rec, lost.body.position.x, lost.body.position.z, dt);
          spd = 1.4;
          rec.lookX = lost.body.position.x; rec.lookZ = lost.body.position.z;
          rec.tgtArmL = -0.4; rec.tgtArmR = -0.4;
          if (dl < 1.2) {
            reclaim(rec, lost);
            setState(rec, 'wander');
            pickPOI(rec);
          } else if (rec.stateT > 12) {
            rec.stolenType = '';
            pickPOI(rec); setState(rec, 'wander');
          }
          break;
        }
        rec.tgtArmL = -0.9; rec.tgtArmR = -0.9;
        const sw = Math.sin(rec.stateT * 1.6) * 5;
        rec.lookX = rec.group.position.x + Math.sin(rec.yaw + sw * 0.2) * 5;
        rec.lookZ = rec.group.position.z + Math.cos(rec.yaw + sw * 0.2) * 5;
        if (rec.stateT > 3.0) {
          if (rec.kind === 'gardener') { pickBed(rec); setState(rec, 'wander'); }
          else { pickPOI(rec); setState(rec, 'wander'); }
        }
        break;
      }
      case 'photo': {
        if (capyOk) lookAtCapy(rec);
        rec.tgtArmL = -1.7; rec.tgtArmR = -1.7;
        if (rec.stateT > 0.85 && !rec.flashed) {
          rec.flashed = true;
          npcV1.setFromMatrixPosition(rec.nodes.camN.matrixWorld);
          fireFlash(npcV1.x, npcV1.y, npcV1.z);
          emit('npc:photo', rec);
          finish('photo-op');
          sfx('pop');
        }
        if (rec.stateT > 1.8) {
          rec.flashed = false;
          rec.photoCd = rand(9, 20);
          setState(rec, 'idle');
        }
        break;
      }
      case 'work': {      // gardener: crouched, re-planting the poor roses
        rec.tgtLean = 0.55;
        rec.tgtCrouch = -0.30;
        rec.tgtArmL = -0.7 + Math.sin(rec.stateT * 5) * 0.35;
        rec.tgtArmR = -0.7 + Math.sin(rec.stateT * 5 + 1) * 0.35;
        rec.lookX = rec.group.position.x + Math.sin(rec.yaw) * 2;
        rec.lookZ = rec.group.position.z + Math.cos(rec.yaw) * 2;
        if (rec.stateT > 3 && rec.stateT < 3.1) { replantNear(rec); pickLine(rec, 'replant'); }
        break;
      }
      case 'busk': {      // guitar up, one lazy strum every couple of bars
        rec.tgtArmL = -1.15;
        rec.tgtArmR = -1.30 + Math.sin(rec.stateT * 6.2) * 0.16;
        rec.tgtLean = 0.05;
        rec.lookX = rec.group.position.x + Math.sin(rec.yaw) * 6;
        rec.lookZ = rec.group.position.z + Math.cos(rec.yaw) * 6;
        rec.strum -= dt;
        if (rec.strum <= 0) { rec.strum = rand(2.4, 4.8); sfx('strum'); }
        break;
      }
      case 'calm': {      // hands on knees, getting the breath back
        rec.tgtLean = 0.5;
        rec.tgtArmL = -0.45; rec.tgtArmR = -0.45;
        rec.tgtCrouch = -0.12 + Math.sin(rec.stateT * 3.4) * 0.03;
        // stepHuman owns the countdown now; calm just waits it out
        if (rec.dejected > 0) {
          /* sulking; the timer runs in stepHuman */
        } else if (rec.stateT > 2.6) {
          if (rec.kind === 'gardener') { pickBed(rec); setState(rec, 'wander'); }
          else { pickPOI(rec); setState(rec, 'wander'); }
        }
        break;
      }
      case 'lookAt': {
        if (capyOk) lookAtCapy(rec);
        if (rec.reactMode === 0 && rec.stateT < 1.8) rec.tgtArmR = -1.5;   // pointing
        if (rec.stateT > 3.2) setState(rec, 'idle');
        break;
      }
      case 'queue': {
        // The place in the line is read LIVE off the array, not off the index
        // stored when they joined: the person at the window walks away and
        // everybody behind them steps up on the next frame, for free.
        const place = vanQueue.indexOf(rec);
        if (place < 0 || !vanEnv()) { pickPOI(rec); setState(rec, 'wander'); break; }
        rec.queueI = place;
        const q = vanQueueSpotAt(place);
        const d = steerTo(rec, q.x, q.z, dt);
        // …and they hurry, a bit. Nobody strolls to an ice cream van.
        spd = d > 6 ? 1.9 : 1.15;
        const vp = game.env.van();
        rec.lookX = vp.x; rec.lookZ = vp.z;
        if (d < 1.05) {
          spd = 0;
          rec.tgtLean = Math.sin(rec.stateT * 1.4 + rec.idlePhase) * 0.04;
          // First in line, and she is still stopped: the window, the cone, and
          // the walk away with it. rec.coneT is the seconds left holding it.
          if (place === 0 && npcDwell(rec, rec.stateT, 2.2, 3.4)) {
            rec.coneT = rand(14, 26);
            rec.nodes.coneN.scale.setScalar(1);
            rec.queueCd = rand(70, 140);       // one each, and not again soon
            pickLine(rec, 'whippyGot');
            sfx('pop');
            pickPOI(rec);
            setState(rec, 'wander');
            break;
          }
        }
        // She has pulled out. Nobody gets anything, and they have a view on it.
        if (vanEnv().vanDwellLeft() <= 0) {
          if (place === 0 && rec.talkCd <= 0) { rec.talkCd = rand(8, 18); pickLine(rec, 'whippyMiss'); }
          rec.queueCd = rand(20, 45);
          pickPOI(rec);
          setState(rec, 'wander');
        } else if (rec.stateT > 26) {
          // A LINE CANNOT BE PERMANENT. If steering never gets them within a
          // metre of their place — a bench in the way, a nav pocket, a shove —
          // they give up rather than standing in the road for ever holding
          // slot zero against everybody behind them.
          rec.queueCd = rand(30, 60);
          pickPOI(rec);
          setState(rec, 'wander');
        }
        break;
      }
      case 'wander': {
        if (rec.kind === 'jogger') {
          const li = rec.loopI * 2;
          const d = steerTo(rec, npcJOG_LOOP[li], npcJOG_LOOP[li + 1] + rec.jogOff, dt);
          spd = 3.3;
          if (d < 2.2) { rec.loopI = (rec.loopI + 1) % 4; rec.jogOff = rand(-1.5, 1.5); }
          rec.lookX = rec.group.position.x + rec.moveX * 5;
          rec.lookZ = rec.group.position.z + rec.moveZ * 5;
          // comic swerve around the capybara
          if (capyOk) {
            const dc = distToCapy(rec);
            if (dc < 3.0 && facingCapy(rec) > 0.3) {
              if (rec.stumble < 0.1) { pickLine(rec, 'jog'); sfx('gasp'); }
              rec.stumble = 1;
              rec.avoidAng = (rec.group.position.x < capyX ? -1 : 1) * 1.1;
              rec.avoidT = 0.9;
              rec.avoidStuck = false;
            }
          }
        } else {
          const d = steerTo(rec, rec.target.x, rec.target.z, dt);
          spd = rec.kind === 'gardener' ? 1.25 : 1.05;
          if (d < 1.0) setState(rec, rec.kind === 'gardener' ? 'work' : 'idle');
          rec.lookX = rec.group.position.x + rec.moveX * 5;
          rec.lookZ = rec.group.position.z + rec.moveZ * 5;
        }
        break;
      }
      default: {          // idle — weight shifts, small head turns
        const s = Math.sin(game.state.time * 0.5 + rec.idlePhase);
        rec.tgtLean = s * 0.03;
        rec.lookX = rec.group.position.x + Math.sin(rec.yaw + s * 0.7) * 5;
        rec.lookZ = rec.group.position.z + Math.cos(rec.yaw + s * 0.7) * 5;
        break;
      }
    }

    // …and the arm that is holding it. After the switch, so it overrides
    // whatever the state wanted the right arm to do, and before the stumble
    // handling, so tripping over with an ice cream still reads as a trip.
    if (rec.coneT >= 0) rec.tgtArmR = -1.15 + Math.sin(rec.stateT * 1.7) * 0.08;

    if (rec.stumble > 0) {
      rec.stumble = Math.max(0, rec.stumble - dt * 1.7);
      spd *= 0.55 + 0.45 * (1 - rec.stumble);
      rec.tgtArmL = -2.2; rec.tgtArmR = -2.4;
    }

    npcSeparate(rec, dt);
    moveRec(rec, dt, spd);
    animHuman(rec, dt);
  }

  function animHuman(rec, dt) {
    const n = rec.nodes;
    // hop (startle)
    if (rec.hopV !== 0 || rec.hop > 0) {
      rec.hopV -= 16 * dt;
      rec.hop += rec.hopV * dt;
      if (rec.hop <= 0) { rec.hop = 0; rec.hopV = 0; }
    }
    const amp = clamp(rec.speed / 1.7, 0, 1.15);
    const s = Math.sin(rec.walkPhase);
    const c = Math.cos(rec.walkPhase);

    rec.poseArmL = damp(rec.poseArmL, rec.tgtArmL, 11, dt);
    rec.poseArmR = damp(rec.poseArmR, rec.tgtArmR, 11, dt);
    rec.poseLean = damp(rec.poseLean, rec.tgtLean, 8, dt);
    rec.poseCrouch = damp(rec.poseCrouch, rec.tgtCrouch, 8, dt);

    const maskL = clamp(1 - Math.abs(rec.poseArmL) * 0.8, 0, 1);
    const maskR = clamp(1 - Math.abs(rec.poseArmR) * 0.8, 0, 1);

    // seated diners swing their thighs forward under the table
    rec.seatPose = damp(rec.seatPose, rec.seated, 9, dt);
    const seatK = rec.seatPose * npcSEAT_LEG;
    n.legL.rotation.x = s * amp * 0.72 + seatK;
    n.legR.rotation.x = -s * amp * 0.72 + seatK;
    // legs live on the root, so they have to follow the hips down by hand
    const legK = 1 + rec.poseCrouch / npcLEG_L;
    n.legL.position.y = npcLEG_L + rec.poseCrouch;
    n.legR.position.y = npcLEG_L + rec.poseCrouch;
    n.legL.scale.y = legK;
    n.legR.scale.y = legK;
    n.armL.rotation.x = rec.poseArmL - s * amp * 0.58 * maskL;
    n.armR.rotation.x = rec.poseArmR + s * amp * 0.58 * maskR;
    n.armL.rotation.z = 0.09 + rec.poseArmL * 0.06;
    n.armR.rotation.z = -0.09 - rec.poseArmR * 0.06;

    // ---- ...AND THIS CAST FEELS THE WEATHER TOO, WITHIN LIMITS -----------
    // Sydney's and Pasto's people are a richer rig than a local — a real state
    // machine, a nav mesh, an errand — but they are drawn as INSTANCED boxes,
    // one InstancedMesh per body part, so a per-person prop is not a mesh you
    // can add: it is a whole new instanced buffer, a new draw call and a new
    // write in pushInstances. That is why the umbrella is locals-only and is
    // not an oversight. What this cast gets is the half that costs nothing:
    // the arms come in and the shoulders come up in the cold, on the same
    // numbers the locals use, blended UNDER whatever the state machine is
    // already doing with the arms so a gardener still gardens and a waiter
    // still carries a tray.
    //
    // AND IT IS DRIVEN BY THE RAIN AS WELL AS THE COLD, because keyed on cold
    // alone it was DEAD CODE: this cast is gated to Sydney by biomeLive(), and
    // Sydney's mood row says cold 0.00 — correctly, it is midday in the
    // Botanic Gardens. What actually happens to those people is that it
    // drizzles on them, and somebody caught in a shower with no umbrella
    // hunches and pulls their arms in exactly the way somebody cold does. Same
    // pose, reachable trigger.
    const brace = Math.max(npcWxCold, npcWxRain * 0.85);
    if (brace > 0.01) {
      const fold = brace * maskL * 0.34;
      const foldR = brace * maskR * 0.34;
      n.armL.rotation.z += fold;
      n.armR.rotation.z -= foldR;
      n.armL.rotation.x -= fold * 1.15;
      n.armR.rotation.x -= foldR * 1.15;
    }

    // fumbling for a cup that is already halfway to the pavement
    if (rec.flail > 0) {
      rec.flail = Math.max(0, rec.flail - dt * 1.5);
      const f = rec.flail * rec.flail;
      const w = game.state.time * 27 + rec.idlePhase;
      n.armL.rotation.x += Math.sin(w) * 1.05 * f;
      n.armR.rotation.x -= Math.sin(w + 1.2) * 1.05 * f;
      n.armL.rotation.z += 0.55 * f;
      n.armR.rotation.z -= 0.55 * f;
    }

    const breathe = Math.sin(game.state.time * 1.6 + rec.idlePhase) * 0.012;
    // bob sits at the feet, so compensate the lean back to a hip-height pivot —
    // otherwise a bending gardener swings his head a metre out in front of him.
    const cl = Math.cos(rec.poseLean), sl = Math.sin(rec.poseLean);
    n.bob.position.y = rec.poseCrouch + breathe + Math.abs(c) * 0.05 * amp + npcHIP_Y - npcHIP_Y * cl;
    n.bob.position.x = (1 - amp) * Math.sin(game.state.time * 0.5 + rec.idlePhase) * 0.03;
    n.bob.position.z = -npcHIP_Y * sl;
    n.bob.rotation.x = rec.poseLean;
    n.bob.rotation.z = s * amp * 0.05 + rec.stumble * Math.sin(rec.stateT * 21) * 0.22;

    // yOff carries the harbour (negative) — the chair is done with poseCrouch
    rec.group.position.y = rec.hop + rec.yOff;
    rec.group.rotation.y = rec.yaw;

    // drying off after a swim: same hue, darker, easing back over ~8 seconds
    if (rec.wet > 0) {
      rec.wet = Math.max(0, rec.wet - dt * 0.12);
      if (Math.abs(rec.wet - rec.wetShade) > 0.06) shadeHuman(rec, rec.wet);
    }

    // head turns toward whatever it is looking at
    const hy = npcWrapAngle(Math.atan2(rec.lookX - rec.group.position.x, rec.lookZ - rec.group.position.z) - rec.yaw);
    rec.headYaw = damp(rec.headYaw, clamp(hy, -1.15, 1.15), rec.alarm > 0.5 ? 26 : 9, dt);
    n.head.rotation.y = rec.headYaw;
    // rec.lookUp (0..1) is the Pasto cast craning at a condor; it is undefined
    // for every Sydneysider, so this is a no-op on the old crowd.
    const pitchTgt = rec.lookUp > 0.01 ? -1.0 * rec.lookUp
      : (rec.state === 'work' ? 0.2 : (rec.dejectStage === 0 && rec.dejected > 0 ? 0.55 : 0));
    rec.headPitch = damp(rec.headPitch, pitchTgt - rec.poseLean * 0.8, 7, dt);
    n.head.rotation.x = rec.headPitch;

    rec.group.updateMatrixWorld(true);

    // carried prop rides in the hand (or on the head, for hats)
    const p = rec.heldProp;
    if (p && p.owner === rec && !p.held) {
      if (p.type === 'hat') {
        npcV1.setFromMatrixPosition(n.head.matrixWorld);
        npcV1.y += 0.36;
      } else {
        npcV1.setFromMatrixPosition(n.handR.matrixWorld);
        npcV1.y -= 0.02;
      }
      npcQ1.setFromEuler(npcE1.set(0, rec.yaw, 0));
      if (p.body) {
        // driven by hand, so the interpolation fields go with it or the cup
        // smears between the hand and wherever it was last physics tick
        npcPlaceBody(p.body, npcV1.x, npcV1.y, npcV1.z);
        npcPlaceQuat(p.body, npcQ1.x, npcQ1.y, npcQ1.z, npcQ1.w);
        p.body.velocity.set(0, 0, 0);
        p.body.angularVelocity.set(0, 0, 0);
      }
      if (p.mesh) {
        p.mesh.position.set(npcV1.x, npcV1.y, npcV1.z);
        p.mesh.quaternion.copy(npcQ1);
      }
    } else if (p && p.owner !== rec) {
      rec.heldProp = null;
    }
  }

  function stepIbis(rec, dt) {
    rec.stateT += dt;
    let spd = 0;
    if (rec.state === 'flee') spd = 3.4;
    else if (rec.state === 'work') spd = 1.7;
    else spd = 0.8;

    const d = steerTo(rec, rec.target.x, rec.target.z, dt);
    if (d < 0.5) spd = 0;
    if (rec.state === 'flee' && rec.stateT > 2.4) setState(rec, 'wander');

    rec.speed = damp(rec.speed, spd, 9, dt);
    if (rec.speed > 0.03) {
      rec.group.position.x = clamp(rec.group.position.x + rec.moveX * rec.speed * dt, npcBOUND_X0, npcBOUND_X1);
      rec.group.position.z = clamp(rec.group.position.z + rec.moveZ * rec.speed * dt, 1, npcBOUND_Z1);
      rec.yaw = npcDampAngle(rec.yaw, Math.atan2(rec.moveX, rec.moveZ), 9, dt);
      rec.walkPhase += rec.speed * 6.5 * dt + dt;
    }

    const hop = Math.abs(Math.sin(rec.walkPhase)) * 0.10 * clamp(rec.speed, 0, 1.4);
    rec.group.position.y = hop;
    rec.group.rotation.y = rec.yaw;

    // pecking at rubbish, as is their birthright
    const pecking = (rec.state === 'work' && rec.speed < 0.4) || (rec.state === 'wander' && rec.speed < 0.2);
    rec.peck = damp(rec.peck, pecking ? 1 : 0, 6, dt);
    const pk = Math.max(0, Math.sin(game.state.time * 5.5 + rec.idlePhase));
    rec.nodes.neckN.rotation.x = rec.peck * (0.35 + pk * 1.05) - 0.15;
    rec.nodes.bodyN.rotation.x = 0.16 + rec.peck * 0.25 + Math.sin(rec.walkPhase * 2) * 0.05 * clamp(rec.speed, 0, 1);
    rec.nodes.bodyN.position.y = 0.32 - rec.peck * 0.04;
    // scrawny little legs, counter-swinging
    const lk = Math.sin(rec.walkPhase) * 0.55 * clamp(rec.speed, 0, 1.2);
    rec.nodes.legA.rotation.x = lk;
    rec.nodes.legB.rotation.x = -lk;
    rec.group.updateMatrixWorld(true);
  }

  // =========================================================================
  // CHAPTER 3 — PASTO LOCALS.  Built lazily on the first 'biome:enter' pasto so
  // every mesh they own is captured by the Pasto tag (nothing here is claimed by
  // hand). No cannon bodies: the cast steers with the pasto nav mesh and the
  // same personal-space shove the Circular Quay crowd uses.
  // =========================================================================
  const paCast = [];        // everything, in think-cursor order
  const paHumans = [];      // vendor / abuela / farmer / churchgoer
  const paBeasts = [];      // streetdog / llama
  let paBuiltCast = false;
  let paColorDirty = false;
  let paCursor = 0;
  let paLlamaMade = 0, paDogMade = 0;
  let pTorso = null, pHips = null, pHead = null, pHair = null, pArmL = null, pArmR = null;
  let pLegL = null, pLegR = null, pHat = null, pTool = null, pBroom = null;
  let pLlamaB = null, pLlamaN = null, pLlamaL = null, pLlamaT = null;
  let pDogB = null, pDogH = null, pDogL = null, pDogT = null;

  function paLive() {
    const b = game.biome;
    if (!b || typeof b.isActive !== 'function') return false;
    try { return !!b.isActive('pasto'); } catch (e) { return false; }
  }

  // ----------------------------------------------------------- terrain reads
  /** The authority on ground height. Cheap by contract; never a raycast. */
  function paY(x, z) {
    const p = game.pasto;
    if (p && typeof p.terrainHeight === 'function') {
      try { const y = p.terrainHeight(x, z); if (isFinite(y)) return y; } catch (e) { /* not built */ }
    }
    return 0;
  }
  function paNav(x, z, r) {
    const p = game.pasto;
    if (p && typeof p.navBlocked === 'function') {
      try { return !!p.navBlocked(x, z, r); } catch (e) { /* not built */ }
    }
    return Math.abs(x) > npcPA_WALK || Math.abs(z) > npcPA_WALK;
  }
  /** pasto.js answers 'coffee'|'paramo'|'crater' today; the town zones are Agent
   *  A's pass this round, so fall back to the contract rectangles until then. */
  function paZone(name, x, z) {
    const p = game.pasto;
    if (p && typeof p.inZone === 'function') {
      try { if (p.inZone(name, x, z)) return true; } catch (e) { /* not built */ }
    }
    if (name === 'plaza') {
      return x >= npcPA_PLAZA.x0 && x <= npcPA_PLAZA.x1 && z >= npcPA_PLAZA.z0 && z <= npcPA_PLAZA.z1;
    }
    if (name === 'market') {
      return x >= npcPA_MARKET.x0 && x <= npcPA_MARKET.x1 && z >= npcPA_MARKET.z0 && z <= npcPA_MARKET.z1;
    }
    if (name === 'church') {
      const dx = x - npcPA_CHURCH.x, dz = z - npcPA_CHURCH.z;
      return dx * dx + dz * dz < 12 * 12;
    }
    if (name === 'coffee') {
      return x >= npcPA_COFFEE.x0 && x <= npcPA_COFFEE.x1 && z >= npcPA_COFFEE.z0 && z <= npcPA_COFFEE.z1;
    }
    return false;
  }
  function paInTown(x, z) { return paZone('plaza', x, z) || paZone('market', x, z) || paZone('church', x, z); }
  function paOnPatio(x, z) {
    const dx = x - npcPA_PATIO.x, dz = z - npcPA_PATIO.z;
    return dx * dx + dz * dz < npcPA_PATIO.r * npcPA_PATIO.r;
  }

  /**
   * Rise over run in the direction of travel, from exactly two terrainHeight
   * samples. Positive is uphill. This is the number the whole chapter turns on:
   * it refuses steps, drags a chase uphill and lets one run away downhill.
   */
  function paSlopeAlong(px, pz, dx, dz) {
    return (paY(px + dx * npcPA_PROBE, pz + dz * npcPA_PROBE) - paY(px, pz)) / npcPA_PROBE;
  }

  // ------------------------------------------------------------------ vision
  function paLos(px, pz, dx, dz, d) {
    for (let i = 1; i <= npcPA_LOS_STEPS; i++) {
      const t = (i / (npcPA_LOS_STEPS + 1)) * d;
      if (paNav(px + dx * t, pz + dz * t, npcLOS_R)) return false;
    }
    return true;
  }
  /**
   * 0..1, but height-aware. A vendor standing in the market genuinely cannot
   * see a capybara 30 m up the flank of Galeras: the alert radius shrinks with
   * vertical separation, and past npcPA_PITCH_MAX nobody is craning at the sky
   * at all — that is what the condor beats are for.
   */
  function paVision(rec, x, z, y, far) {
    const px = rec.group.position.x, pz = rec.group.position.z;
    let dx = x - px, dz = z - pz;
    const d = Math.sqrt(dx * dx + dz * dz);
    const dy = (isFinite(y) ? y : paY(x, z)) - rec.yOff;
    const ady = dy < 0 ? -dy : dy;
    const f = (far || npcPA_VIS_FAR) / (1 + ady / npcPA_VIS_DY);
    if (d > f) return 0;
    if (d < 1e-4) return 1;
    dx /= d; dz /= d;
    if (Math.atan2(dy, d > 0.2 ? d : 0.2) > npcPA_PITCH_MAX) return 0;
    if (d > 1.2 && !paLos(px, pz, dx, dz, d)) return 0;
    const dot = Math.sin(rec.yaw) * dx + Math.cos(rec.yaw) * dz;
    if (dot < npcVIS_COS && d >= npcVIS_NEAR) return 0;
    const cone = clamp((dot - npcVIS_COS) / (1 - npcVIS_COS), 0, 1);
    const range = clamp(1 - d / f, 0, 1);
    let v = (npcVIS_FLOOR + (1 - npcVIS_FLOOR) * cone) * (0.20 + 0.80 * range);
    if (d < npcVIS_NEAR && ady < 2.5) v = v > 0.62 ? v : 0.62;
    return clamp(v * (1 - clamp(ady / (npcPA_VIS_DY * 2), 0, 0.78)), 0, 1);
  }
  function paCapyY() {
    const c = game.capy;
    return (c && c.position && isFinite(c.position.y)) ? c.position.y : 0;
  }
  function paSeeCapy(rec, far) {
    return capyOk ? paVision(rec, capyX, capyZ, paCapyY(), far) : 0;
  }
  function paDistToCapy(rec) {
    const dx = capyX - rec.group.position.x, dz = capyZ - rec.group.position.z;
    return Math.sqrt(dx * dx + dz * dz);
  }
  function paLookCapy(rec) { rec.lookX = capyX; rec.lookZ = capyZ; }

  // ------------------------------------------------------------------ condor
  function paReadCondor() {
    const c = game.condor;
    npcPAcond.ok = false;
    if (!c) { npcPAcond.state = 'gone'; npcPAcond.mounted = false; return; }
    let st = 'gone';
    try { if (typeof c.state === 'string') st = c.state; } catch (e) { /* defensive */ }
    npcPAcond.state = st;
    npcPAcond.mounted = !!c.mounted;
    if (st === 'gone') return;
    const g = c.group;
    const src = (g && g.position) ? g.position : (c.body ? c.body.interpolatedPosition : null);
    if (!src || !isFinite(src.x)) return;
    npcPAcond.x = src.x; npcPAcond.y = src.y; npcPAcond.z = src.z;
    npcPAcond.low = (src.y - paY(src.x, src.z)) < npcPA_COND_LOW;
    npcPAcond.ok = true;
  }
  /**
   * Distance to the bird, WITH the altitude term. A pure horizontal measure made
   * npcPA_COND_STARE a cylinder of infinite height, so a farmer 60 m up the
   * terraces reacted to a condor he could not possibly be looking at. Vertical
   * separation is discounted (a bird overhead is still a bird) but never free —
   * the same instinct paVision encodes with npcPA_VIS_DY.
   */
  function paCondDist(rec) {
    const dx = rec.group.position.x - npcPAcond.x, dz = rec.group.position.z - npcPAcond.z;
    const dy = npcPAcond.y - rec.yOff;
    return Math.sqrt(dx * dx + dz * dz + dy * dy * npcPA_COND_DY);
  }

  // --------------------------------------------------------------- steering
  function paSet(rec, s) {
    rec.state = s; rec.stateT = 0;
    rec.dwell = -1;              // a new state draws a new dwell — see npcDwell
    rec.bestD = 1e9; rec.stallT = 0; rec.stallN = 0; rec.detT = 0;
  }
  /** A new destination invalidates the progress watchdog's best distance. */
  function paAim(rec, x, z) {
    rec.target.set(x, 0, z);
    rec.bestD = 1e9; rec.stallT = 0; rec.stallN = 0; rec.detT = 0;
  }
  function paSay(rec, key) { if (key && rec.speak) pickLine(rec, key); }

  /** Blocked, or too steep to be worth the dignity. */
  function paRefuse(px, pz, dx, dz) {
    const ax = px + dx * npcPA_PROBE, az = pz + dz * npcPA_PROBE;
    if (paNav(ax, az, 0.45)) return true;
    return paSlopeAlong(px, pz, dx, dz) > npcPA_SLOPE_MAX;
  }

  /**
   * Steer toward (tx,tz), returning the TRUE distance to that goal even while
   * a detour is running — callers use the return value to decide they have
   * arrived, and a detour must never be mistaken for arrival.
   */
  function paSteer(rec, tx, tz, dt) {
    const px = rec.group.position.x, pz = rec.group.position.z;
    const gd = Math.sqrt((tx - px) * (tx - px) + (tz - pz) * (tz - pz));
    // A committed detour outranks the goal for a couple of seconds; see the
    // progress watchdog below for why anyone ever needs one.
    if (rec.detT > 0) {
      rec.detT -= dt;
      const ddx = rec.detX - px, ddz = rec.detZ - pz;
      if (ddx * ddx + ddz * ddz < 0.6 * 0.6) rec.detT = 0;
      else { tx = rec.detX; tz = rec.detZ; }
    }
    let dx = tx - px, dz = tz - pz;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < 1e-4) { rec.moveX = 0; rec.moveZ = 0; return gd; }
    dx /= d; dz /= d;
    rec.avoidT -= dt;
    // Already standing INSIDE unwalkable ground — spawned in a stall pad, or
    // shoved under a cart. Every probe around him is blocked, so no dodge can
    // ever pass and avoidStuck welded him in place for the whole session (a
    // street dog measured 0.0 m travelled across a 4-minute soak). paMove
    // already exempts anyone in this position from its step test, so the only
    // sane order is "walk straight out and stop thinking about it".
    if (paNav(px, pz, npcPA_MOVE_R)) {
      rec.avoidAng = 0;
      rec.avoidStuck = false;
      rec.avoidT = 0;
      rec.moveX = dx; rec.moveZ = dz;
      return gd;
    }
    // Purely reactive avoidance has one classic failure mode: two obstacles
    // whose dodges point back at each other, and the walker orbits the gap
    // forever. Measured in soak — an abuela 9.3 m from her own doorway, move
    // vector flipping every avoid window, no net progress for the entire 85 s
    // walk-home budget, ending in an off-camera teleport. So: track the best
    // distance to the goal, and when it stops improving, go round the OTHER
    // shoulder. The side is sticky in between, which is also what stops the
    // per-window re-roll from producing the oscillation in the first place.
    // The improvement threshold has to be wider than the orbit it is meant to
    // detect: the measured limit cycle swung 0.8 m of goal-distance every
    // second, which kept clearing a tighter test and reset the escalation
    // before it could ever reach the detour. Real walking closes 0.9 m in well
    // under a second, so this never fires on someone actually making progress.
    if (rec.detT <= 0 && gd < rec.bestD - 0.9) {
      rec.bestD = gd; rec.stallT = 0;
    } else if (rec.detT <= 0) {
      rec.stallT += dt;
      if (rec.stallT > npcPA_STALL_T) {
        rec.stallT = 0;
        rec.bestD = gd;
        rec.avoidSide = rec.avoidSide < 0 ? 1 : -1;
        rec.avoidT = 0;
        if (++rec.stallN >= 2) {
          // Both shoulders tried and he is still no nearer. Nudging the heading
          // cannot leave a pocket whose exit points AWAY from the goal, so
          // commit to a real detour: a waypoint out to the side and slightly
          // behind, steered to like any other target, for a couple of seconds.
          // Physically leaving the pocket is the only thing that ends the loop.
          rec.stallN = 0;
          rec.detT = 2.8;
          rec.detX = px + (dz * rec.avoidSide) * 6.5 - dx * 2.0;
          rec.detZ = pz + (-dx * rec.avoidSide) * 6.5 - dz * 2.0;
        }
      }
    }
    if (rec.avoidT <= 0) {
      rec.avoidAng = 0;
      rec.avoidStuck = false;
      if (paRefuse(px, pz, dx, dz)) {
        let found = false;
        const side = rec.avoidSide < 0 ? -1 : 1;
        for (let i = 0; i < npcAVOID_TRIES.length; i++) {
          const off = npcAVOID_TRIES[i] * side;
          const a = Math.atan2(dx, dz) + off;
          if (!paRefuse(px, pz, Math.sin(a), Math.cos(a))) {
            rec.avoidAng = off;
            found = true;
            break;
          }
        }
        // Nothing ahead of him works. Rather than freeze on the spot, sidestep
        // squarely across the obstacle on the shoulder he is already committed
        // to — a step he can actually take beats a step he keeps refusing.
        if (!found) {
          const a = Math.atan2(dx, dz) + side * 1.5708;
          if (!paRefuse(px, pz, Math.sin(a), Math.cos(a))) { rec.avoidAng = side * 1.5708; found = true; }
        }
        rec.avoidStuck = !found;
        rec.avoidT = Math.min(0.45, 1.2 / Math.max(rec.speed, 0.5));
      }
    }
    if (rec.avoidStuck) { rec.moveX = 0; rec.moveZ = 0; return gd; }
    if (rec.avoidAng !== 0) {
      const a = Math.atan2(dx, dz) + rec.avoidAng;
      dx = Math.sin(a); dz = Math.cos(a);
    }
    rec.moveX = dx; rec.moveZ = dz;
    return gd;
  }

  /** Is a step from (px,pz) to (nx,nz) both clear and shallow enough? */
  function paStepOk(px, pz, nx, nz) {
    if (paNav(nx, nz, npcPA_MOVE_R)) return false;
    const l = Math.sqrt((nx - px) * (nx - px) + (nz - pz) * (nz - pz));
    if (l < 1e-5) return true;
    return (paY(nx, nz) - paY(px, pz)) / l <= npcPA_SLOPE_MAX;
  }

  /**
   * Terrain-aware move. Uphill drags, downhill gathers pace, and a long downhill
   * run does not stop politely at the bottom — it overshoots, arms everywhere.
   */
  function paMove(rec, dt, spd) {
    const px = rec.group.position.x, pz = rec.group.position.z;
    let sl = 0;
    if (rec.moveX !== 0 || rec.moveZ !== 0) sl = paSlopeAlong(px, pz, rec.moveX, rec.moveZ);
    rec.slope = sl;

    let k = sl >= 0
      ? 1 - clamp(sl / npcPA_SLOPE_MAX, 0, 1) * npcPA_UP_DRAG
      : 1 + clamp(-sl, 0, 0.8) * npcPA_DOWN_GAIN;

    if (sl < -0.16 && spd > 1.4) {
      rec.dhillT = Math.min(rec.dhillT + dt, 2.2);
    } else if (rec.dhillT > 0) {
      // 0.65 s of committed downhill almost never happened: the coffee terraces
      // alternate sign every few metres, so dhillT kept resetting and the gag
      // fired once in sixteen seconds. 0.45 s is still a real run, not a step.
      if (sl > -0.06 && rec.dhillT > 0.45 && rec.overshoot <= 0) {
        rec.overshoot = npcPA_OVERSHOOT;
        rec.stumble = 1;
      }
      rec.dhillT = Math.max(0, rec.dhillT - dt * 2);
    }
    if (rec.overshoot > 0) { rec.overshoot -= dt; k *= 1.55; }

    rec.speed = damp(rec.speed, spd * k, rec.state === 'chase' ? 10 : 6, dt);
    if (rec.speed > 0.02) {
      let nx = clamp(px + rec.moveX * rec.speed * dt, -npcPA_WALK, npcPA_WALK);
      let nz = clamp(pz + rec.moveZ * rec.speed * dt, -npcPA_WALK, npcPA_WALK);
      // Nobody moonwalks up a volcano: reject the step, then try to slide along
      // whichever axis is still walkable. Anyone already standing in blocked
      // ground is exempt, or they would be welded there for the session.
      if (!paStepOk(px, pz, nx, nz) && !paNav(px, pz, npcPA_MOVE_R)) {
        if (paStepOk(px, pz, nx, pz)) nz = pz;
        else if (paStepOk(px, pz, px, nz)) nx = px;
        else { nx = px; nz = pz; }
      }
      rec.group.position.x = nx;
      rec.group.position.z = nz;
      rec.yaw = npcDampAngle(rec.yaw, Math.atan2(rec.moveX, rec.moveZ), 7, dt);
      const gAmp = clamp(rec.speed / 1.7, 0, 1.15);
      const stride = 2 * npcLEG_L * Math.sin(0.72 * gAmp);
      if (stride > 0.02) rec.walkPhase += (Math.PI * rec.speed / stride) * dt + dt * 0.4;
      else rec.walkPhase += dt * 0.4;
    } else {
      rec.walkPhase = damp(rec.walkPhase, Math.round(rec.walkPhase / Math.PI) * Math.PI, 5, dt);
    }
    // The one authority on y. Ground first, hop and pose on top of it.
    rec.yOff = paY(rec.group.position.x, rec.group.position.z);
  }

  /** Same shove as Sydney, but on the pasto nav mesh — and a llama barely moves. */
  function paSeparate(rec, dt) {
    if (!capyOk) { rec.sepD = 99; return; }
    const px = rec.group.position.x, pz = rec.group.position.z;
    let dx = px - capyX, dz = pz - capyZ;
    let d = Math.sqrt(dx * dx + dz * dz);
    const R = rec.kind === 'llama' ? 1.35 : npcSEP_R;
    if (d >= R) { rec.sepD = d; return; }
    if (d < 1e-4) { dx = Math.sin(rec.yaw + 1.5708); dz = Math.cos(rec.yaw + 1.5708); d = 1e-4; }
    else { dx /= d; dz /= d; }
    const overlap = R - d;
    if (rec.sepD > R + 0.3 && rec.stumble < 0.2 && rec.kind !== 'llama') {
      rec.stumble = clamp(0.4 + overlap, 0, 1);
      if (capySpdH > 1.1) { rec.lookX = capyX; rec.lookZ = capyZ; rec.alarm = Math.max(rec.alarm, 0.7); }
    }
    rec.sepD = d;
    let step = overlap * (1 - Math.exp(-npcSEP_LAMBDA * dt)) * rec.pushK;
    const maxStep = npcSEP_VMAX * dt;
    if (step > maxStep) step = maxStep;
    if (step < 1e-5) return;
    const stuck = paNav(px, pz, npcSEP_PROBE);
    for (let i = 0; i < 3; i++) {
      let ax = dx, az = dz;
      if (i === 1) { ax = dz; az = -dx; }
      else if (i === 2) { ax = -dz; az = dx; }
      const nx = clamp(px + ax * step, -npcPA_WALK, npcPA_WALK);
      const nz = clamp(pz + az * step, -npcPA_WALK, npcPA_WALK);
      if (!stuck && !paStepOk(px, pz, nx, nz)) continue;
      rec.group.position.x = nx;
      rec.group.position.z = nz;
      return;
    }
  }

  /** A broom, a hoof or a market crate connecting with a capybara. */
  function paShoveCapy(rec, power, lift) {
    const c = game.capy;
    if (!c || !c.body) return;
    let dx = capyX - rec.group.position.x, dz = capyZ - rec.group.position.z;
    const l = Math.sqrt(dx * dx + dz * dz) || 1;
    npcCV1.set(dx / l * power, lift, dz / l * power);
    try { c.body.applyImpulse(npcCV1); }
    catch (e) {
      const m = c.body.mass || 30;
      c.body.velocity.x += npcCV1.x / m;
      c.body.velocity.y += npcCV1.y / m;
      c.body.velocity.z += npcCV1.z / m;
    }
    c.body.wakeUp();
  }

  // ------------------------------------------------------------- destinations
  function paPickPlaza(rec) {
    for (let i = 0; i < 6; i++) {
      const pi = randInt(0, (npcPA_PLAZA_PTS.length / 2) - 1) * 2;
      const x = npcPA_PLAZA_PTS[pi] + rand(-2.5, 2.5);
      const z = npcPA_PLAZA_PTS[pi + 1] + rand(-2.5, 2.5);
      if (!paNav(x, z, npcPA_MOVE_R)) { paAim(rec, x, z); return; }
    }
    paAim(rec, rec.home.x, rec.home.z);
  }
  /**
   * Spawn-time nudge out of anything unwalkable, writing into paSpot. Nobody in
   * the cast may START inside geometry: a body dropped in a stall's nav pad has
   * every probe around it blocked, which is a stuck NPC on frame one. Build-time
   * only, so the ring search costs nothing at runtime.
   */
  const paSpot = { x: 0, z: 0 };
  function paFreeSpot(x, z, clear) {
    const r0 = clear || npcPA_MOVE_R;
    paSpot.x = clamp(x, -npcPA_WALK, npcPA_WALK);
    paSpot.z = clamp(z, -npcPA_WALK, npcPA_WALK);
    if (!paNav(paSpot.x, paSpot.z, r0)) return paSpot;
    for (let ring = 1; ring <= 7; ring++) {
      const r = ring * 1.1;
      for (let a = 0; a < 8; a++) {
        const ang = (a / 8) * 6.2831853 + ring * 0.39;
        const nx = clamp(paSpot.x + Math.sin(ang) * r, -npcPA_WALK, npcPA_WALK);
        const nz = clamp(paSpot.z + Math.cos(ang) * r, -npcPA_WALK, npcPA_WALK);
        if (!paNav(nx, nz, r0)) { paSpot.x = nx; paSpot.z = nz; return paSpot; }
      }
    }
    return paSpot;
  }
  function paPickNear(rec, r) {
    for (let i = 0; i < 6; i++) {
      const x = rec.home.x + rand(-r, r), z = rec.home.z + rand(-r, r);
      if (!paNav(x, z, npcPA_MOVE_R)) { paAim(rec, x, z); return; }
    }
    paAim(rec, rec.home.x, rec.home.z);
  }
  function paPickFarm(rec) {
    const p = game.pasto;
    if (p && typeof p.randomPointIn === 'function') {
      try {
        const q = p.randomPointIn('coffee');
        if (q && isFinite(q.x) && isFinite(q.z)) { paAim(rec, q.x, q.z); return; }
      } catch (e) { /* not built */ }
    }
    paPickNear(rec, 9);
  }
  function paPickChurch(rec) {
    const a = rand(-Math.PI, Math.PI);
    const d = rand(2.5, 8);
    const x = npcPA_CHURCH_DOOR.x + Math.sin(a) * d;
    const z = npcPA_CHURCH_DOOR.z + Math.cos(a) * d * 0.6;
    const blocked = paNav(x, z, npcPA_MOVE_R);
    paAim(rec, blocked ? npcPA_CHURCH_DOOR.x : x, blocked ? npcPA_CHURCH_DOOR.z - 2 : z);
  }
  /**
   * The kind's true RESTING state — the pose a condor beat interrupted and must
   * restore. Never a transit state: returning 'return' here routed every condor
   * flyover through restock and escalated the grudge counter with no player
   * involvement at all. `stall` and `work` walk themselves home if they need to.
   */
  function paIdleState(rec) {
    if (rec.kind === 'vendor') return 'stall';
    if (rec.kind === 'abuela') return 'patrol';
    if (rec.kind === 'farmer') return 'work';
    if (rec.kind === 'churchgoer') return 'drift';
    if (rec.kind === 'streetdog') return 'follow';
    return 'stand';
  }

  /** Off-screen enough that a hard reposition cannot be seen. */
  function paOffCamera(rec) {
    const cam = game.camera;
    if (!cam) return true;
    npcPAv1.set(rec.group.position.x, rec.yOff + 1.0, rec.group.position.z);
    npcPAv1.project(cam);
    if (!isFinite(npcPAv1.x)) return true;
    return npcPAv1.z >= 1 || npcPAv1.x < -1.05 || npcPAv1.x > 1.05 ||
      npcPAv1.y < -1.05 || npcPAv1.y > 1.05;
  }

  // ------------------------------------------------------------ chase tuning
  function paGiveUp(rec) {
    if (rec.kind === 'abuela') return npcPA_ABUELA_GIVEUP;
    if (rec.kind === 'farmer') return npcPA_FARM_GIVEUP;
    // The grudge buys STAMINA, not top speed (see paChaseSpd). Three thefts
    // takes him from 8 s of pursuit to 12.8 s, which is what makes a repeat
    // offence feel earned without ever making the chase unloseable.
    return npcPA_GIVEUP + rec.grudge * 1.6;
  }
  function paLeash(rec) {
    if (rec.kind === 'abuela') return npcPA_ABUELA_LEASH;
    if (rec.kind === 'farmer') return npcPA_FARM_LEASH;
    return npcPA_LEASH + rec.grudge * 4;
  }
  /**
   * MEASURED: the capybara's sustained sprint is 5.1 m/s. The old ramp reached
   * 6.2 m/s by the third theft, which meant a fully aggrieved vendor was simply
   * faster than the player and the chase could not be won by running — only
   * survived by outlasting the give-up timer. Every rung now stays under the
   * sprint, so running always slowly works and standing still never does. The
   * escalation the player feels comes from paGiveUp (stamina), paLeash (range)
   * and rec.alertR (he spots you from further away), not from raw pace.
   */
  function paChaseSpd(rec) {
    if (rec.kind === 'abuela') return npcPA_ABUELA_SPD;   // she only walks. Ever.
    if (rec.kind === 'farmer') return 4.1;
    return Math.min(4.35 + rec.grudge * 0.22, npcPA_CHASE_CAP);
  }
  /** Slowest a walk home ever goes — the pace once he is nearly there. */
  function paReturnSlow(rec) { return rec.kind === 'abuela' ? 1.05 : 1.5; }
  /**
   * A long way from home is walked briskly; the last few metres are a stroll.
   * The abuela is capped at her chase pace, because she only ever walks.
   */
  function paReturnSpd(rec, d) {
    const lo = paReturnSlow(rec);
    const hi = rec.kind === 'abuela' ? npcPA_ABUELA_SPD : 3.2;
    const s = d / npcPA_RETURN_EASE;
    return s < lo ? lo : (s > hi ? hi : s);
  }
  /** The walk-home budget, derived from what the walk home can actually be. */
  function paReturnMax(rec) {
    const t = paLeash(rec) / paReturnSlow(rec) * npcPA_RETURN_SLACK;
    return t > npcPA_RETURN_MAX ? t : npcPA_RETURN_MAX;
  }
  /**
   * An offence, remembered. Deliberately NOT driven by the `restock` state: that
   * fires on every walk home, including one a condor caused, and pinned every
   * vendor at max grudge without the player having touched anything.
   */
  function paGrudge(rec) {
    if (!rec || rec.grudge >= npcPA_GRUDGE_MAX) return;
    rec.grudge++;
    rec.alertR = Math.min(rec.alertR + 3, 20);
  }
  function paStartChase(rec) {
    if (rec.state === 'chase' || rec.state === 'gawp') return;
    paSet(rec, 'chase');
    rec.chaseT = 0;
    rec.alarm = 1;
    emit('npc:chase', rec);
    paSay(rec, rec.kind === 'abuela' ? 'paBroom' : rec.kind === 'farmer' ? 'paFarm' : 'paChase');
    sfx(rec.kind === 'abuela' ? 'rustle' : 'whistle');
  }
  /**
   * Giving up has to be VISIBLE or the player never learns they won. The vendor
   * and the farmer fold in half and wheeze; the abuela — who is never out of
   * breath, only out of patience — stops dead, shakes the broom and tells you
   * exactly what she thinks. Neither one just turns around in silence.
   */
  function paEndChase(rec, wheeze) {
    if (rec.kind === 'abuela') {
      paSet(rec, 'scold');
      paSay(rec, 'paScold');
      sfx('rustle');
    } else if (wheeze) { paSet(rec, 'wheeze'); paSay(rec, 'paWheeze'); }
    else paSet(rec, 'return');
    emit('npc:calm', rec);
  }
  /**
   * Something outranked the chase (a condor, mostly). The state is about to be
   * overwritten, so close the npc:chase / npc:calm pair here or systems.js keeps
   * the stinger running over a man who is now staring at the sky.
   */
  /** Recruit the dog, and restart his patience with it. */
  function paDogFollow(rec) {
    if (rec.state !== 'follow') paSet(rec, 'follow');
    rec.chaseT = 0;
    rec.dogCd = 0;
  }
  function paInterrupt(rec) {
    if (rec.state !== 'chase') return;
    rec.chaseT = 0;
    rec.alarm = 0.6;
    emit('npc:calm', rec);
  }

  // ================================================================= thinking
  function paThink(rec) {
    const st = rec.state;
    if (st === 'spit') return;

    // --- the sky outranks the market -------------------------------------
    // …but only while he is still willing to look up (rec.gawpCd), and a chase
    // that the sky interrupts must be ENDED, not abandoned: npc:chase was
    // already emitted and systems.js pairs it with npc:calm for the stinger.
    if (npcPAcond.ok && rec.kind !== 'llama' && rec.gawpCd <= 0) {
      const dC = paCondDist(rec);
      if (npcPAcond.mounted && dC < npcPA_COND_STARE) {
        if (rec.kind === 'streetdog') { if (st !== 'bark') { paSet(rec, 'bark'); sfx('wheek'); } return; }
        if (st !== 'gawp') {
          paInterrupt(rec);
          rec.retState = paIdleState(rec);
          paSet(rec, 'gawp');
          rec.gawpT = 0;
          if (rec.talkCd <= 0 && Math.random() < 0.5) { rec.talkCd = rand(6, 14); paSay(rec, 'paGawp'); }
        } else if (rec.stateT < npcPA_GAWP_MAX - 1.8) {
          rec.gawpT = 0;                  // refreshed while he is still up there
        }
        return;
      }
      if (npcPAcond.state === 'circling' && npcPAcond.low && dC < npcPA_COND_POINT) {
        if (rec.kind === 'streetdog') { if (st !== 'bark') { paSet(rec, 'bark'); sfx('wheek'); } return; }
        if (st !== 'point' && st !== 'gawp') {
          paInterrupt(rec);
          rec.retState = paIdleState(rec);
          paSet(rec, 'point');
          if (rec.talkCd <= 0 && Math.random() < 0.45) { rec.talkCd = rand(7, 16); paSay(rec, 'paCondor'); }
        }
        return;
      }
    }
    if (st === 'gawp' || st === 'point') return;      // paStep owns the exit

    // --- THE FLOAT IS GOING PAST AND NOBODY WAS WATCHING IT ---------------
    // The carroza crosses the plaza twice a minute with the sun turning on the
    // back of it, and for the life of this chapter the entire town carried on
    // stacking potatoes. A parade that nobody watches is a trailer.
    //
    // Deliberately NOT a state: the vendor is still minding his stall and the
    // abuela is still coming for you. It is a head turn and, when they have
    // something to say, a line — which is exactly the weight a thing happening
    // in the background of your own errand deserves. The reaction is bigger
    // when the animal is ON it, because that is the joke.
    if (rec.kind !== 'llama' && rec.kind !== 'streetdog' && game.pasto &&
        typeof game.pasto.carroza === 'function' && rec.carCd <= 0) {
      const cp = game.pasto.carroza();
      const cdx = cp.x - rec.group.position.x, cdz = cp.z - rec.group.position.z;
      const cd2 = cdx * cdx + cdz * cdz;
      const rode = typeof game.pasto.onCarroza === 'function' && game.pasto.onCarroza();
      const reach = rode ? 15 : 9;
      if (cd2 < reach * reach && !(typeof game.pasto.carrozaParked === 'function' && game.pasto.carrozaParked())) {
        rec.carCd = rand(7, 16);
        paAim(rec, cp.x, cp.z);
        rec.lookUp = Math.max(rec.lookUp, 0.5);
        if (rec.talkCd <= 0 && Math.random() < (rode ? 0.75 : 0.3)) {
          rec.talkCd = rand(9, 20);
          paSay(rec, rode ? 'paFloatRode' : 'paFloat');
        }
      }
    }

    if (rec.kind === 'vendor') {
      if (st === 'chase' || st === 'wheeze' || st === 'restock') return;
      if (capyOk) {
        const hx = capyX - rec.home.x, hz = capyZ - rec.home.z;
        if (hx * hx + hz * hz < 6.5) { paStartChase(rec); return; }   // ON the stall
        const d = paDistToCapy(rec);
        if (d < rec.alertR && paZone('market', capyX, capyZ) && paSeeCapy(rec) > 0.20) {
          paStartChase(rec);
          return;
        }
        if (st === 'stall' && d < 12 && rec.noticeCd <= 0 && paSeeCapy(rec) > 0.30) {
          rec.noticeCd = rand(6, 12);
          paLookCapy(rec);
          if (rec.talkCd <= 0) { rec.talkCd = rand(9, 20); paSay(rec, 'paNotice'); }
        }
      }
      // Nobody stands at a trestle table for five minutes without touching it.
      // A periodic re-stack is what keeps him legible as a working man, and it
      // is also what stops `stall` from being a state he never leaves.
      if (st === 'stall' && rec.stateT > rec.fidgetAt) {
        rec.fidgetAt = rand(15, 27);
        paSet(rec, 'restock');
      }
      return;
    }

    if (rec.kind === 'abuela') {
      // 'scold' is her give-up beat and it must be allowed to finish — without
      // this the patrol branch below overwrote it on the very next think.
      if (st === 'chase' || st === 'scold') return;
      // She is not fast and she is not clever. She is simply always coming.
      if (capyOk && paInTown(capyX, capyZ) &&
          paDistToCapy(rec) < rec.alertR && paSeeCapy(rec) > 0.16) {
        paStartChase(rec);
        return;
      }
      if (st === 'patrol') {
        const dx = rec.target.x - rec.group.position.x, dz = rec.target.z - rec.group.position.z;
        if (dx * dx + dz * dz < 1.8 || rec.stateT > 22) { paPickPlaza(rec); rec.stateT = 0; }
      } else if (st !== 'return') { paPickPlaza(rec); paSet(rec, 'patrol'); }
      return;
    }

    if (rec.kind === 'farmer') {
      if (st === 'chase' || st === 'wheeze') return;
      if (capyOk) {
        const d = paDistToCapy(rec);
        const hot = paOnPatio(capyX, capyZ) || (paZone('coffee', capyX, capyZ) && d < rec.alertR);
        if (hot && d < rec.alertR + 6 && paSeeCapy(rec) > 0.18) { paStartChase(rec); return; }
      }
      // THE LAST RUNG MUST NOT NAME THE STATE THE FIRST RUNG IS WAITING ON.
      // This chain read: "in work and the timer is up -> go and pick a new
      // patch; in walk -> arrive; ANYTHING ELSE -> go to work". A farmer who is
      // in `work` and whose timer is NOT up falls past both of the first two
      // rungs and lands on the third, which calls paSet(rec, 'work') — and
      // paSet's whole job is to zero stateT. So the timer was reset ten times a
      // second and could never reach six seconds: measured, all three of them
      // sat on their spawn points for the entire session with stateT pinned at
      // 0.0. Three farmers, on a coffee terrace, who have never once walked to
      // a different bush. Excluding their own resting state from the catch-all
      // is the whole fix.
      if (st === 'work' && npcDwell(rec, rec.stateT, 6, 13)) { paPickFarm(rec); paSet(rec, 'walk'); }
      else if (st === 'walk') {
        const dx = rec.target.x - rec.group.position.x, dz = rec.target.z - rec.group.position.z;
        if (dx * dx + dz * dz < 1.6 || rec.stateT > 20) paSet(rec, 'work');
      } else if (st !== 'return' && st !== 'work') paSet(rec, 'work');
      return;
    }

    if (rec.kind === 'churchgoer') {
      if (st === 'scandal') return;
      if (capyOk && rec.noticeCd <= 0 && paDistToCapy(rec) < 8 && paSeeCapy(rec) > 0.30) {
        rec.noticeCd = rand(8, 16);
        paLookCapy(rec);
        if (rec.talkCd <= 0) { rec.talkCd = rand(10, 24); paSay(rec, 'paChurch'); }
      }
      // The same missing exclusion as the farmer above, failing the other way
      // round: a churchgoer standing in `pray` whose timer is not up falls to
      // the catch-all and is sent DRIFTING on the very next think, so the six
      // to fifteen seconds of praying that the first rung is carefully timing
      // never happened once. They have been pacing the churchyard since Pasto
      // was written and nobody has ever seen one stand still.
      if (st === 'pray' && npcDwell(rec, rec.stateT, 6, 15)) { paPickChurch(rec); paSet(rec, 'drift'); }
      else if (st === 'drift') {
        const dx = rec.target.x - rec.group.position.x, dz = rec.target.z - rec.group.position.z;
        if (dx * dx + dz * dz < 1.6 || rec.stateT > 22) paSet(rec, 'pray');
      } else if (st !== 'return' && st !== 'pray') { paPickChurch(rec); paSet(rec, 'drift'); }
      return;
    }

    if (rec.kind === 'streetdog') {
      if (st === 'bark' && rec.stateT < 2.4) return;
      if (st === 'lost' && rec.stateT < 1.9) return;   // let the give-up beat land
      // dogCd is what makes the give-up stick: without it this line re-recruited
      // him on the very next think, one frame after he gave up.
      if (capyOk && rec.dogCd <= 0 && paDistToCapy(rec) < 46) {
        if (st !== 'follow') paDogFollow(rec);
        return;
      }
      if (st !== 'plod' && st !== 'follow') { paPickNear(rec, 10); paSet(rec, 'plod'); }
      else if (st === 'plod') {
        const dx = rec.target.x - rec.group.position.x, dz = rec.target.z - rec.group.position.z;
        // stateT MUST be reset with the new target. Without it the >16 branch
        // stayed true forever and re-rolled the destination on every think,
        // ten times a second, so the dog never committed to anything.
        if (dx * dx + dz * dz < 1.4 || rec.stateT > 16) { paPickNear(rec, 10); rec.stateT = 0; }
      }
      return;
    }

    // llama — unimpressed by everything, including this function
    if (st === 'plod') {
      const dx = rec.target.x - rec.group.position.x, dz = rec.target.z - rec.group.position.z;
      if (dx * dx + dz * dz < 1.4 || rec.stateT > 14) paSet(rec, 'stand');
    } else if (st === 'stand' && npcDwell(rec, rec.stateT, 9, 22)) { paPickNear(rec, 7); paSet(rec, 'plod'); }
  }

  // ============================================================= per-npc step
  function paStepHuman(rec, dt) {
    rec.stateT += dt;
    rec.talkCd -= dt;
    rec.noticeCd -= dt;
    rec.swatCd -= dt;
    rec.gawpCd -= dt;
    if (rec.carCd !== undefined) rec.carCd -= dt;   // the parade — see paThink
    if (rec.chatCd !== undefined) rec.chatCd -= dt; // two people talking — see chatStep
    rec.alarm = damp(rec.alarm, 0, 0.9, dt);
    let spd = 0;
    let up = 0;
    rec.tgtArmL = 0; rec.tgtArmR = 0; rec.tgtLean = 0; rec.tgtCrouch = 0;
    rec.moveX = 0; rec.moveZ = 0;

    switch (rec.state) {
      case 'chase': {
        rec.chaseT += dt;
        if (!capyOk) { paEndChase(rec, false); break; }
        paSteer(rec, capyX, capyZ, dt);
        paLookCapy(rec);
        spd = paChaseSpd(rec);
        const d = paDistToCapy(rec);
        if (rec.kind === 'abuela') {
          rec.tgtArmR = -1.9 + Math.sin(rec.stateT * 7) * 0.55;      // the broom
          rec.tgtArmL = -0.6;
          if (d < 1.8 && rec.swatCd <= 0) {
            rec.swatCd = 2.6;
            paSay(rec, 'paSwat');
            sfx('thud');
            paShoveCapy(rec, 78, 46);
            try { game.shake(0.16); } catch (e) { /* optional */ }
          }
        } else {
          rec.tgtArmR = -1.5 + Math.sin(rec.stateT * 16) * 0.7;
          rec.tgtArmL = -0.5;
          if (rec.kind === 'farmer' && d < 1.6 && rec.swatCd <= 0) {
            rec.swatCd = 2.2;
            sfx('thud');
            paShoveCapy(rec, 64, 40);
          }
        }
        if (rec.chaseT > 1.4 && Math.random() < 0.010) {
          paSay(rec, rec.kind === 'abuela' ? 'paBroom' : rec.kind === 'farmer' ? 'paFarm' : 'paChase');
        }
        // Give-up timer AND a leash on the home post. Both, always.
        const hx = rec.group.position.x - rec.home.x, hz = rec.group.position.z - rec.home.z;
        if (rec.chaseT > paGiveUp(rec) || Math.sqrt(hx * hx + hz * hz) > paLeash(rec) || d > 34) {
          paEndChase(rec, rec.kind !== 'abuela');
        }
        break;
      }
      case 'scold': {                     // she stops. She shakes the broom at you.
        rec.tgtArmR = -2.30 + Math.sin(rec.stateT * 6.5) * 0.50;
        rec.tgtArmL = -0.30;
        rec.tgtLean = -0.11;
        rec.tgtCrouch = -0.03;
        if (capyOk) paLookCapy(rec);
        if (rec.stateT > 2.4) paSet(rec, 'return');
        break;
      }
      case 'wheeze': {                    // hands on knees, thoroughly done
        rec.tgtLean = 0.52;
        rec.tgtArmL = -0.45; rec.tgtArmR = -0.45;
        rec.tgtCrouch = -0.13 + Math.sin(rec.stateT * 3.6) * 0.035;
        if (rec.stateT > 2.6) paSet(rec, 'return');
        break;
      }
      case 'return': {
        const d = paSteer(rec, rec.home.x, rec.home.z, dt);
        // A long way home is walked briskly and the last stretch is a stroll, so
        // the walk genuinely fits inside its budget instead of ending in a snap.
        spd = paReturnSpd(rec, d);
        rec.lookX = rec.home.x; rec.lookZ = rec.home.z;
        // Returning home must ALWAYS terminate. The budget is now derived from
        // this kind's own leash, so overrunning it really is a bug — and the
        // reposition that fixes it waits until nobody is looking at him, because
        // these records have no body and therefore no interpolation to hide it.
        const budget = paReturnMax(rec);
        const over = rec.stateT > budget;
        // Arrival opens up once the walk has plainly gone on long enough: a post
        // tucked against a wall is one nobody can stand exactly on, and "as
        // close as the geometry allows" is the honest definition of home. Kept
        // strictly under the vendor's 3.6 m post test so the two cannot loop.
        const arrive = rec.stateT > 12 ? (rec.kind === 'vendor' ? 3.2 : 5.0) : 1.2;
        // An abuela's or a churchgoer's `home` is a leash anchor, not a post —
        // nothing in the world marks it. When the nav mesh will not let her
        // close the last few metres (measured: orbiting 4.7 m out for the whole
        // 85 s budget, ending in a teleport) the honest answer is that she is
        // home, and the anchor moves to where she is actually standing. The
        // vendor's counter and the farmer's patio are real places, so not them.
        const settle = rec.kind !== 'vendor' && rec.kind !== 'farmer' &&
          rec.stateT > 20 && d < 14 &&
          !paNav(rec.group.position.x, rec.group.position.z, npcPA_MOVE_R);
        if (settle) { rec.home.x = rec.group.position.x; rec.home.z = rec.group.position.z; }
        if (d < arrive || settle || (over && (paOffCamera(rec) || rec.stateT > budget * 3))) {
          if (over) {
            rec.group.position.x = rec.home.x;
            rec.group.position.z = rec.home.z;
            rec.yOff = paY(rec.home.x, rec.home.z);
          }
          if (rec.kind === 'vendor') paSet(rec, 'restock');
          else if (rec.kind === 'farmer') paSet(rec, 'work');
          else if (rec.kind === 'churchgoer') { paPickChurch(rec); paSet(rec, 'drift'); }
          else { paPickPlaza(rec); paSet(rec, 'patrol'); }
        }
        break;
      }
      case 'restock': {                   // re-stacking the empanadas, muttering
        rec.tgtLean = 0.42;
        rec.tgtCrouch = -0.22;
        rec.tgtArmL = -0.8 + Math.sin(rec.stateT * 5.5) * 0.4;
        rec.tgtArmR = -0.8 + Math.sin(rec.stateT * 5.5 + 1.1) * 0.4;
        rec.yaw = npcDampAngle(rec.yaw, rec.homeYaw, 4, dt);
        // The grudge is counted by paGrudge() at the offence itself, not here:
        // this state also runs after a condor sent him home, and a bird flying
        // past is not a reason to hate a capybara.
        if (rec.stateT > 2.2) {
          if (rec.grudge > 0 && rec.talkCd <= 0) {
            rec.talkCd = rand(8, 16);
            paSay(rec, 'paRestock');
          }
          paSet(rec, 'stall');
        }
        break;
      }
      case 'stall': {                     // behind the counter, watching you
        // Shoved, or shuffled out from under a condor: walk back to the post.
        {
          const hx = rec.group.position.x - rec.home.x, hz = rec.group.position.z - rec.home.z;
          if (hx * hx + hz * hz > 3.6 * 3.6) { paSet(rec, 'return'); break; }
        }
        rec.yaw = npcDampAngle(rec.yaw, rec.homeYaw, 3, dt);
        const s0 = Math.sin(game.state.time * 0.55 + rec.idlePhase);
        rec.tgtLean = s0 * 0.035;
        if (capyOk && paDistToCapy(rec) < 14) paLookCapy(rec);
        else {
          rec.lookX = rec.group.position.x + Math.sin(rec.yaw + s0 * 0.7) * 5;
          rec.lookZ = rec.group.position.z + Math.cos(rec.yaw + s0 * 0.7) * 5;
        }
        break;
      }
      case 'patrol': {
        paSteer(rec, rec.target.x, rec.target.z, dt);
        spd = 1.05;
        rec.lookX = rec.group.position.x + rec.moveX * 5;
        rec.lookZ = rec.group.position.z + rec.moveZ * 5;
        break;
      }
      case 'walk': {
        paSteer(rec, rec.target.x, rec.target.z, dt);
        spd = 1.35;
        rec.lookX = rec.group.position.x + rec.moveX * 5;
        rec.lookZ = rec.group.position.z + rec.moveZ * 5;
        break;
      }
      case 'work': {                      // farmer, raking coffee on the patio
        rec.tgtLean = 0.5;
        rec.tgtCrouch = -0.26;
        rec.tgtArmL = -0.7 + Math.sin(rec.stateT * 4.6) * 0.35;
        rec.tgtArmR = -0.7 + Math.sin(rec.stateT * 4.6 + 1) * 0.35;
        rec.lookX = rec.group.position.x + Math.sin(rec.yaw) * 2;
        rec.lookZ = rec.group.position.z + Math.cos(rec.yaw) * 2;
        break;
      }
      case 'drift': {
        paSteer(rec, rec.target.x, rec.target.z, dt);
        spd = 0.95;
        rec.lookX = npcPA_CHURCH.x; rec.lookZ = npcPA_CHURCH.z;
        break;
      }
      case 'pray': {
        rec.yaw = npcDampAngle(rec.yaw,
          Math.atan2(npcPA_CHURCH.x - rec.group.position.x, npcPA_CHURCH.z - rec.group.position.z), 3, dt);
        rec.tgtArmL = -0.5; rec.tgtArmR = -0.5;
        rec.tgtLean = 0.12 + Math.sin(game.state.time * 1.1 + rec.idlePhase) * 0.02;
        rec.lookX = npcPA_CHURCH.x; rec.lookZ = npcPA_CHURCH.z;
        break;
      }
      case 'scandal': {                   // somebody is ringing the bell. Badly.
        rec.yaw = npcDampAngle(rec.yaw,
          Math.atan2(npcPA_CHURCH.x - rec.group.position.x, npcPA_CHURCH.z - rec.group.position.z), 8, dt);
        rec.tgtArmL = -2.5; rec.tgtArmR = -2.5;
        rec.tgtLean = -0.14;
        rec.lookX = npcPA_CHURCH.x; rec.lookZ = npcPA_CHURCH.z;
        up = 0.35;
        if (rec.stateT > 3.2) { paPickChurch(rec); paSet(rec, 'drift'); }
        break;
      }
      case 'point': {                     // a condor, low over the plaza
        up = 0.85;
        rec.tgtArmR = -2.7;
        rec.tgtLean = -0.16;
        rec.lookX = npcPAcond.x; rec.lookZ = npcPAcond.z;
        // …and shuffle out from under it, because that is a very large bird
        if (npcPAcond.ok) {
          const dx = rec.group.position.x - npcPAcond.x, dz = rec.group.position.z - npcPAcond.z;
          const l = Math.sqrt(dx * dx + dz * dz) || 1;
          paSteer(rec, rec.group.position.x + dx / l * 6, rec.group.position.z + dz / l * 6, dt);
          spd = 1.7;
        }
        // A breather before he will point again, or a circling condor and a
        // vendor walking back to his post would trade the state forever.
        if (rec.stateT > 2.6) {
          rec.gawpCd = npcPA_GAWP_CD * 0.6;
          paSet(rec, rec.retState || paIdleState(rec));
        }
        break;
      }
      case 'gawp': {                    // the capybara is flying. Nobody moves.
        up = 1.0;
        rec.gawpT += dt;
        rec.tgtArmL = -0.15; rec.tgtArmR = -0.15;
        rec.tgtLean = -0.10;
        rec.lookX = npcPAcond.x; rec.lookZ = npcPAcond.z;
        // paThink refreshes gawpT every ~0.1 s while the bird is up, so without
        // an absolute ceiling the whole cast froze for the entire flight.
        if (rec.gawpT > 1.8 || rec.stateT > npcPA_GAWP_MAX) {
          if (rec.stateT > npcPA_GAWP_MAX) rec.gawpCd = npcPA_GAWP_CD;
          paSet(rec, rec.retState || paIdleState(rec));
        }
        break;
      }
      default: {                          // idle — weight shifts, small head turns
        const s1 = Math.sin(game.state.time * 0.5 + rec.idlePhase);
        rec.tgtLean = s1 * 0.03;
        rec.lookX = rec.group.position.x + Math.sin(rec.yaw + s1 * 0.7) * 5;
        rec.lookZ = rec.group.position.z + Math.cos(rec.yaw + s1 * 0.7) * 5;
        break;
      }
    }

    if (rec.stumble > 0) {
      rec.stumble = Math.max(0, rec.stumble - dt * 1.7);
      spd *= 0.55 + 0.45 * (1 - rec.stumble);
      rec.tgtArmL = -2.1; rec.tgtArmR = -2.3;
    }
    rec.lookUp = damp(rec.lookUp, up, 9, dt);

    paSeparate(rec, dt);
    paMove(rec, dt, spd);
    animHuman(rec, dt);
    paSyncBody(rec, 0.85);
  }

  /**
   * Kinematic bodies are integrated from their velocity, so a body driven by a
   * bare position write reports zero velocity and hands nothing to anything
   * standing on or beside it. Written the way stepHuman writes the Sydney crowd:
   * velocity for the solver, placement for the truth.
   */
  function paSyncBody(rec, lift) {
    if (!rec.body) return;
    rec.body.velocity.set(rec.moveX * (rec.speed || 0), 0, rec.moveZ * (rec.speed || 0));
    npcPlaceBody(rec.body, rec.group.position.x, rec.group.position.y + lift, rec.group.position.z);
  }

  function paStepBeast(rec, dt) {
    rec.stateT += dt;
    rec.spitCd -= dt;
    if (rec.dogCd > 0) rec.dogCd -= dt;
    let spd = 0;
    rec.moveX = 0; rec.moveZ = 0;
    rec.tgtNeck = 0;

    if (rec.kind === 'llama') {
      // Unimpressed by everything — until somebody barges a llama at speed.
      if (rec.state !== 'spit' && capyOk && rec.spitCd <= 0 &&
          capySpdH > npcCHECK_SPD && paDistToCapy(rec) < 1.8) {
        paSet(rec, 'spit');
        rec.spitCd = npcPA_LLAMA_SPIT_CD;
        rec.spat = false;
      }
      switch (rec.state) {
        case 'spit': {
          rec.yaw = npcDampAngle(rec.yaw,
            Math.atan2(capyX - rec.group.position.x, capyZ - rec.group.position.z), 10, dt);
          rec.tgtNeck = rec.stateT < 0.42 ? -0.75 : 0.55;
          if (!rec.spat && rec.stateT > 0.45) {
            rec.spat = true;
            sfx('pop');
            paShoveCapy(rec, 52, 26);
            try { game.toast('The llama has made its position clear.'); } catch (e) { /* optional */ }
          }
          if (rec.stateT > 1.3) paSet(rec, 'stand');
          break;
        }
        case 'plod': {
          paSteer(rec, rec.target.x, rec.target.z, dt);
          spd = 0.95;
          break;
        }
        default: {
          rec.tgtNeck = Math.sin(game.state.time * 0.6 + rec.idlePhase) * 0.10;
          break;
        }
      }
    } else {
      switch (rec.state) {
        case 'bark': {
          if (npcPAcond.ok) {
            rec.yaw = npcDampAngle(rec.yaw,
              Math.atan2(npcPAcond.x - rec.group.position.x, npcPAcond.z - rec.group.position.z), 8, dt);
          }
          rec.tgtNeck = -0.55 + Math.abs(Math.sin(game.state.time * 11)) * 0.45;
          if (rec.stateT > 3.0) paDogFollow(rec);
          break;
        }
        case 'lost': {                    // stopped, head down, thoroughly puffed
          rec.tgtNeck = 0.40 + Math.sin(game.state.time * 9) * 0.11;
          if (rec.stateT > 1.9) paSet(rec, 'plod');
          break;
        }
        case 'follow': {
          if (capyOk) {
            // Underfoot, deliberately: he aims for a point just AHEAD of the
            // capybara, orbiting slowly, which is exactly where you want to walk.
            const orb = game.state.time * 1.5 + rec.idlePhase;
            const tx = capyX + Math.sin(orb) * npcPA_DOG_ORBIT + capyVX * 0.35;
            const tz = capyZ + Math.cos(orb) * npcPA_DOG_ORBIT + capyVZ * 0.35;
            const d = paSteer(rec, tx, tz, dt);
            spd = d > 4 ? clamp(capySpdH + 1.6, 2.2, 5.4) : 1.9;
            rec.tgtNeck = -0.18;
            // The dogs used to be the one part of the cast with neither a
            // give-up timer nor a leash, so they followed you up Galeras and
            // ground sideways along the flank forever. Now they have both.
            rec.chaseT += dt;
            const hx = rec.group.position.x - rec.home.x, hz = rec.group.position.z - rec.home.z;
            if (rec.chaseT > npcPA_DOG_GIVEUP ||
                hx * hx + hz * hz > npcPA_DOG_LEASH * npcPA_DOG_LEASH) {
              rec.dogCd = npcPA_DOG_COOL;
              paPickNear(rec, 10);
              // He stops where he is and pants, so you can SEE him quit. He used
              // to just turn round mid-stride and wander off, which read as a
              // bug rather than as a win.
              paSet(rec, 'lost');
              sfx('wheek');
            }
          } else paSet(rec, 'plod');
          break;
        }
        default: {
          paSteer(rec, rec.target.x, rec.target.z, dt);
          spd = 1.2;
          break;
        }
      }
    }

    paSeparate(rec, dt);
    paMove(rec, dt, spd);
    paAnimBeast(rec, dt);
    paSyncBody(rec, rec.kind === 'llama' ? 0.62 : 0.34);
  }

  function paAnimBeast(rec, dt) {
    const n = rec.nodes;
    const amp = clamp(rec.speed / (rec.kind === 'llama' ? 1.5 : 2.6), 0, 1.25);
    const s = Math.sin(rec.walkPhase);
    n.l0.rotation.x = s * amp * 0.60;
    n.l1.rotation.x = -s * amp * 0.60;
    n.l2.rotation.x = -s * amp * 0.60;
    n.l3.rotation.x = s * amp * 0.60;
    rec.neckPose = damp(rec.neckPose, rec.tgtNeck, 9, dt);
    n.neckN.rotation.x = rec.neckPose + Math.sin(rec.walkPhase * 2) * 0.05 * amp;
    n.bodyN.rotation.z = s * amp * 0.05;
    n.bodyN.position.y = rec.bodyY + Math.abs(Math.cos(rec.walkPhase)) * 0.035 * amp;
    n.tailN.rotation.z = Math.sin(game.state.time * (rec.kind === 'streetdog' ? 15 : 3) + rec.idlePhase) *
      (rec.kind === 'streetdog' ? 0.75 : 0.18);
    rec.group.position.y = rec.yOff;
    rec.group.rotation.y = rec.yaw;
    rec.group.updateMatrixWorld(true);
  }

  // ================================================================= building
  function paColorHuman(rec, cT, cH, cS, cHr, cHat, cTool) {
    rec.cT = cT; rec.cH = cH; rec.cS = cS; rec.cHr = cHr; rec.cHat = cHat;
    pTorso.setColorAt(rec.idx, npcColor.setHex(cT));
    pHips.setColorAt(rec.idx, npcColor.setHex(cH));
    pHead.setColorAt(rec.idx, npcColor.setHex(cS));
    pHair.setColorAt(rec.idx, npcColor.setHex(cHr));
    pArmL.setColorAt(rec.idx, npcColor.setHex(cS));
    pArmR.setColorAt(rec.idx, npcColor.setHex(cS));
    pLegL.setColorAt(rec.idx, npcColor.setHex(cH));
    pLegR.setColorAt(rec.idx, npcColor.setHex(cH));
    pHat.setColorAt(rec.idx, npcColor.setHex(cHat));
    pTool.setColorAt(rec.idx, npcColor.setHex(cTool));
    pBroom.setColorAt(rec.idx, npcColor.setHex(cTool));
    paColorDirty = true;
  }

  function paBuildLocal(idx, kind) {
    const rec = buildHuman(idx, kind);
    rec.id = 'pasto-' + kind + idx;
    rec.pasto = true;
    rec.quay = false;
    rec.zMin = -npcPA_WALK;
    rec.grudge = 0;
    rec.alertR = 10;
    rec.slope = 0; rec.dhillT = 0; rec.overshoot = 0;
    rec.swatCd = 0; rec.gawpT = 0; rec.gawpCd = 0; rec.lookUp = 0;
    rec.fidgetAt = rand(15, 27);
    rec.carCd = rand(2, 12);      // …and when they last looked at the float
    rec.avoidSide = Math.random() < 0.5 ? -1 : 1;
    rec.bestD = 1e9; rec.stallT = 0; rec.stallN = 0;
    rec.detT = 0; rec.detX = 0; rec.detZ = 0;
    rec.pushK = 1;
    rec.retState = '';
    rec.homeYaw = 0;
    rec.update = function (dt) { paStepHuman(rec, dt); };
    // A second hand node so the broom and the hoe can live on separate
    // InstancedMeshes without ever drawing on top of one another.
    const broomN = new THREE_.Object3D();
    broomN.position.set(0, 0, 0.06);
    broomN.scale.setScalar(0);
    rec.nodes.handR.add(broomN);
    rec.nodes.broomN = broomN;
    return rec;
  }

  function paBuildBeast(idx, kind) {
    const root = new THREE_.Group();
    const bodyN = new THREE_.Object3D();
    const neckN = new THREE_.Object3D();
    const tailN = new THREE_.Object3D();
    const l0 = new THREE_.Object3D(), l1 = new THREE_.Object3D();
    const l2 = new THREE_.Object3D(), l3 = new THREE_.Object3D();
    root.add(bodyN); root.add(l0); root.add(l1); root.add(l2); root.add(l3);
    bodyN.add(neckN); bodyN.add(tailN);
    const llama = kind === 'llama';
    const bodyY = llama ? 0.90 : 0.44;
    bodyN.position.set(0, bodyY, 0);
    neckN.position.set(0, llama ? 0.22 : 0.10, llama ? 0.44 : 0.34);
    tailN.position.set(0, llama ? 0.26 : 0.12, llama ? -0.60 : -0.30);
    // Base tilt only; paAnimBeast wags on z, so this survives every frame.
    tailN.rotation.x = llama ? 0.55 : -0.35;
    const lx = llama ? 0.20 : 0.13, lz = llama ? 0.42 : 0.21, ly = llama ? 0.70 : 0.40;
    l0.position.set(-lx, ly, lz); l1.position.set(lx, ly, lz);
    l2.position.set(-lx, ly, -lz); l3.position.set(lx, ly, -lz);
    root.scale.setScalar(llama ? rand(0.92, 1.04) : rand(0.88, 1.02));

    const rec = {
      id: 'pasto-' + kind + idx,
      kind,
      pasto: true,
      group: root,
      body: null,
      state: llama ? 'stand' : 'follow',
      alarm: 0,
      target: new THREE_.Vector3(),
      heldProp: null,
      idx,
      nodes: { bodyN, neckN, tailN, l0, l1, l2, l3 },
      yaw: rand(-Math.PI, Math.PI),
      speed: 0, wantSpeed: 0,
      walkPhase: rand(0, 6.28), idlePhase: rand(0, 6.28),
      avoidAng: 0, avoidT: 0, avoidStuck: false, moveX: 0, moveZ: 1,
      avoidSide: Math.random() < 0.5 ? -1 : 1, bestD: 1e9, stallT: 0, stallN: 0,
      detT: 0, detX: 0, detZ: 0,
      stateT: 0, lastLine: '',
      home: new THREE_.Vector3(),
      yOff: 0, hop: 0, stumble: 0, sepD: 99, slope: 0,
      dhillT: 0, overshoot: 0, pushK: llama ? 0.22 : 1,
      neckPose: 0, tgtNeck: 0, bodyY, spitCd: 0, spat: false,
      chaseT: 0, dogCd: 0, gawpCd: 0,
      speak() { /* llamas and street dogs do not speak. They react. */ },
      update(dt) { paStepBeast(rec, dt); },
    };
    return rec;
  }

  /**
   * Built once, on the first 'biome:enter' pasto. main.js has already set the
   * capture tag to 'pasto' by the time this runs, so every InstancedMesh below
   * is tagged to Pasto automatically — no claim() call anywhere.
   */
  function paBuildCast() {
    if (paBuiltCast) return;
    paBuiltCast = true;

    // ---- geometry (shared with the Sydney rig wherever it can be) ----------
    const gBroom = npcMakeGeo([
      { w: 0.05, h: 1.42, d: 0.05, y: 0.32, rx: -0.42 },
      { w: 0.40, h: 0.24, d: 0.11, y: -0.36, z: -0.32, rx: -0.42 },
    ]);
    const gLlamaBody = npcMakeGeo([
      { w: 0.52, h: 0.56, d: 1.10 },
      { w: 0.46, h: 0.32, d: 0.36, y: 0.24, z: -0.54 },
    ]);
    const gLlamaNeck = npcMakeGeo([
      { k: 'cyl', rt: 0.15, rb: 0.20, h: 0.84, seg: 6, y: 0.42 },
      { w: 0.24, h: 0.26, d: 0.30, y: 0.90, z: 0.05 },
      { w: 0.15, h: 0.13, d: 0.20, y: 0.84, z: 0.22 },
      { w: 0.05, h: 0.21, d: 0.05, x: -0.09, y: 1.10, z: -0.02, rz: 0.16 },
      { w: 0.05, h: 0.21, d: 0.05, x: 0.09, y: 1.10, z: -0.02, rz: -0.16 },
    ]);
    const gLlamaLeg = npcMakeGeo([
      { w: 0.12, h: 0.62, d: 0.13, y: -0.31 },
      { w: 0.14, h: 0.08, d: 0.18, y: -0.62, z: 0.02 },
    ]);
    const gLlamaTail = npcMakeGeo([
      { k: 'cyl', rt: 0.05, rb: 0.09, h: 0.30, seg: 5, y: 0.13 },
    ]);

    // ---- roster ------------------------------------------------------------
    const R = [];
    for (let i = 0; i < 4; i++) R.push('vendor');
    R.push('abuela'); R.push('abuela');
    for (let i = 0; i < 3; i++) R.push('farmer');
    for (let i = 0; i < 4; i++) R.push('churchgoer');
    const PA_H = R.length;                 // 13
    const PA_LL = 3, PA_DG = 2;

    pTorso = mkInst(gTorso, PA_H);
    pHips = mkInst(gHips, PA_H);
    pHead = mkInst(gHead, PA_H);
    pHair = mkInst(gHair, PA_H);
    pArmL = mkInst(gArm, PA_H);
    pArmR = mkInst(gArm, PA_H);
    pLegL = mkInst(gLeg, PA_H);
    pLegR = mkInst(gLeg, PA_H);
    pHat = mkInst(gHat, PA_H);
    pTool = mkInst(gTool, PA_H);
    pBroom = mkInst(gBroom, PA_H);
    pLlamaB = mkInst(gLlamaBody, PA_LL);
    pLlamaN = mkInst(gLlamaNeck, PA_LL);
    pLlamaL = mkInst(gLlamaLeg, PA_LL * 4);
    pDogB = mkInst(gDogBody, PA_DG);
    pDogH = mkInst(gDogHead, PA_DG);
    pDogL = mkInst(gDogLeg, PA_DG * 4);
    pDogT = mkInst(gDogTail, PA_DG);
    pLlamaT = mkInst(gLlamaTail, PA_LL);

    // ---- stall posts (Agent A publishes the real ones; ring the plaza) -----
    // x, z, yaw triples. The yaw is the whole point: a stall's nav footprint is
    // a rotated 1.7 x 1.1 rect in ITS frame, so a post derived from a guessed
    // radial to the plaza centre lands inside the pad and the vendor can never
    // reach his own counter. pasto.js publishes yaw on every stall — use it.
    const stalls = [];
    const src = game.pasto && (game.pasto.stalls || game.pasto.marketStalls);
    if (src && src.length) {
      for (let i = 0; i < src.length; i++) {
        const p = quayXOf(src[i]);
        if (!p || !isFinite(p.x) || !isFinite(p.z)) continue;
        const sy = src[i] && isFinite(src[i].yaw) ? src[i].yaw : null;
        // No yaw published? Fall back to "counter faces the middle of the plaza".
        stalls.push(p.x, p.z, sy === null ? Math.atan2(p.x, p.z - 22) : sy);
      }
    }
    if (stalls.length < 6) {
      stalls.length = 0;
      for (let i = 0; i < npcPA_STALLS.length; i++) stalls.push(npcPA_STALLS[i]);
    }

    // The drying patio, if Agent A has published one. Mutating the fallback in
    // place keeps every read site a plain constant lookup.
    const dp = quayXOf(game.pasto && (game.pasto.dryingPatio || game.pasto.patio));
    if (dp && isFinite(dp.x) && isFinite(dp.z)) { npcPA_PATIO.x = dp.x; npcPA_PATIO.z = dp.z; }

    const RUANAS = [PALETTE.ruana1, PALETTE.ruana2, PALETTE.ruana3];
    const SKIRTS = [PALETTE.adobeShade, PALETTE.balconyWood, PALETTE.paramoSoil, PALETTE.stoneDark];

    let vN = 0, aN = 0, fN = 0;
    for (let i = 0; i < PA_H; i++) {
      const kind = R[i];
      const rec = paBuildLocal(i, kind);
      let x = 0, z = 0;
      if (kind === 'vendor') {
        const si = (vN % ((stalls.length / 3) | 0)) * 3;
        vN++;
        const sx = stalls[si], sz = stalls[si + 1], syaw = stalls[si + 2];
        // Behind the counter, in the STALL's own frame: local +z is the trader's
        // side (pasto.js puts its shoppers on local -z). npcPA_POST clears the
        // 1.1 + r nav half-depth; if terrain or a neighbour still blocks it, back
        // off in steps rather than standing on unwalkable ground — a vendor stuck
        // inside the nav pad is exempted from every slope check in paMove.
        const ox = Math.sin(syaw), oz = Math.cos(syaw);
        let post = npcPA_POST;
        x = sx + ox * post; z = sz + oz * post;
        for (let t = 0; t < 6 && paNav(x, z, npcPA_MOVE_R); t++) {
          post += npcPA_POST_STEP;
          x = sx + ox * post; z = sz + oz * post;
        }
        rec.homeYaw = npcWrapAngle(syaw + Math.PI);   // facing back over the counter
        rec.yaw = rec.homeYaw;
        rec.state = 'stall';
        rec.alertR = 10;
        rec.hasHat = true;
        rec.nodes.hatN.scale.setScalar(1);
        paColorHuman(rec, RUANAS[i % 3], SKIRTS[i % 4], npcSKINS[randInt(1, 3)],
          npcHAIRS[randInt(0, 1)], PALETTE.arepa, PALETTE.wood);
      } else if (kind === 'abuela') {
        const pi = (aN % 4) * 2;
        aN++;
        x = npcPA_PLAZA_PTS[pi] + rand(-2, 2); z = npcPA_PLAZA_PTS[pi + 1] + rand(-2, 2);
        rec.state = 'patrol';
        rec.alertR = 13;
        rec.nodes.broomN.scale.setScalar(1);
        rec.group.scale.setScalar(0.90);          // small, and entirely undeterred
        paColorHuman(rec, PALETTE.ruana1, PALETTE.volcanoDark, npcSKINS[2],
          PALETTE.hair5, PALETTE.churchTrim, PALETTE.balconyWood);
      } else if (kind === 'farmer') {
        // One of them works the drying patio itself, or nobody would ever be
        // there to be chased off it; the others are out in the terraces.
        const p = fN === 0 ? null : paSafePoint('coffee');
        fN++;
        x = p ? p.x : npcPA_PATIO.x + rand(-3, 3);
        z = p ? p.z : npcPA_PATIO.z + rand(-3, 3);
        rec.state = 'work';
        rec.alertR = 12;
        rec.hasHat = true;
        rec.nodes.hatN.scale.setScalar(1);
        rec.nodes.toolN.scale.setScalar(1);
        paColorHuman(rec, PALETTE.cloth6, PALETTE.denim, npcSKINS[randInt(1, 3)],
          npcHAIRS[randInt(0, 1)], PALETTE.arepa, PALETTE.wood);
      } else {
        x = npcPA_CHURCH_DOOR.x + rand(-9, 9);
        z = npcPA_CHURCH_DOOR.z + rand(-5, 3);
        rec.state = 'drift';
        rec.alertR = 9;
        paColorHuman(rec, RUANAS[(i + 1) % 3], PALETTE.volcanoDark, npcSKINS[randInt(0, 3)],
          npcHAIRS[randInt(0, 4)], PALETTE.churchTrim, PALETTE.wood);
        paPickChurch(rec);
      }
      // A home post needs elbow room, not just a walkable pixel. An abuela whose
      // patrol home landed 0.1 m clear of a plaza wall could never get within
      // the 1.2 m arrival radius and burned the entire walk-home budget every
      // time — so everyone but the vendor (whose post is deliberately tight
      // behind his own counter) is placed with a body's width of clearance.
      paFreeSpot(x, z, kind === 'vendor' ? npcPA_MOVE_R : kind === 'abuela' ? 1.3 : 0.85);
      x = paSpot.x; z = paSpot.z;
      rec.group.position.set(x, paY(x, z), z);
      rec.yOff = paY(x, z);
      rec.home.set(x, 0, z);
      if (rec.state !== 'drift') rec.target.set(x, 0, z);
      // Chapter 2's cast had no colliders at all — thirteen people you walked
      // straight through in the one chapter built around a crowd.
      addBodyAt(rec, x, paY(x, z) + 0.85, z, 0.26, 0.8, 0.22);
      paHumans.push(rec);
      paCast.push(rec);
      game.npcs.push(rec);
    }

    for (let i = 0; i < PA_LL + PA_DG; i++) {
      const kind = i < PA_LL ? 'llama' : 'streetdog';
      const rec = paBuildBeast(i < PA_LL ? i : i - PA_LL, kind);
      let x, z;
      if (kind === 'llama') {
        const pi = (i % 4) * 2;
        x = npcPA_PLAZA_PTS[pi] + rand(-4, 4);
        z = npcPA_PLAZA_PTS[pi + 1] + rand(-4, 4);
        pLlamaB.setColorAt(rec.idx, npcColor.setHex(i === 0 ? PALETTE.frailejon : PALETTE.potatoSack));
        pLlamaN.setColorAt(rec.idx, npcColor.setHex(i === 0 ? PALETTE.frailejon : PALETTE.potatoSack));
        pLlamaT.setColorAt(rec.idx, npcColor.setHex(PALETTE.frailejon));
        for (let l = 0; l < 4; l++) pLlamaL.setColorAt(rec.idx * 4 + l, npcColor.setHex(PALETTE.paramoSoil));
        paLlamaMade++;
      } else {
        x = rand(-8, 8); z = rand(18, 30);
        pDogB.setColorAt(rec.idx, npcColor.setHex(PALETTE.wood));
        pDogH.setColorAt(rec.idx, npcColor.setHex(PALETTE.woodDark));
        pDogT.setColorAt(rec.idx, npcColor.setHex(PALETTE.wood));
        for (let l = 0; l < 4; l++) pDogL.setColorAt(rec.idx * 4 + l, npcColor.setHex(PALETTE.woodDark));
        paDogMade++;
      }
      paFreeSpot(x, z, 0.7); x = paSpot.x; z = paSpot.z;
      rec.group.position.set(x, paY(x, z), z);
      rec.yOff = paY(x, z);
      rec.home.set(x, 0, z);
      rec.target.set(x, 0, z);
      // A llama is a solid object. So, emphatically, is a street dog.
      if (rec.kind === 'llama') addBodyAt(rec, x, paY(x, z) + 0.62, z, 0.30, 0.52, 0.58);
      else addBodyAt(rec, x, paY(x, z) + 0.34, z, 0.18, 0.30, 0.34);
      paBeasts.push(rec);
      paCast.push(rec);
      game.npcs.push(rec);
    }

    pLlamaB.instanceColor.needsUpdate = true;
    pLlamaN.instanceColor.needsUpdate = true;
    pLlamaL.instanceColor.needsUpdate = true;
    pLlamaT.instanceColor.needsUpdate = true;
    pDogB.instanceColor.needsUpdate = true;
    pDogH.instanceColor.needsUpdate = true;
    pDogL.instanceColor.needsUpdate = true;
    pDogT.instanceColor.needsUpdate = true;
    paFlushColors();

    for (let i = 0; i < paCast.length; i++) paCast[i].group.updateMatrixWorld(true);
    paPush();
  }

  /** randomPointIn, but never returns something unwalkable. */
  function paSafePoint(name) {
    const p = game.pasto;
    if (!p || typeof p.randomPointIn !== 'function') return null;
    for (let i = 0; i < 8; i++) {
      let q = null;
      try { q = p.randomPointIn(name); } catch (e) { return null; }
      if (q && isFinite(q.x) && isFinite(q.z) && !paNav(q.x, q.z, npcPA_MOVE_R)) return q;
    }
    return null;
  }

  function paFlushColors() {
    pTorso.instanceColor.needsUpdate = true;
    pHips.instanceColor.needsUpdate = true;
    pHead.instanceColor.needsUpdate = true;
    pHair.instanceColor.needsUpdate = true;
    pArmL.instanceColor.needsUpdate = true;
    pArmR.instanceColor.needsUpdate = true;
    pLegL.instanceColor.needsUpdate = true;
    pLegR.instanceColor.needsUpdate = true;
    pHat.instanceColor.needsUpdate = true;
    pTool.instanceColor.needsUpdate = true;
    pBroom.instanceColor.needsUpdate = true;
  }

  function paPush() {
    for (let i = 0; i < paHumans.length; i++) {
      const n = paHumans[i].nodes;
      pTorso.setMatrixAt(i, n.bob.matrixWorld);
      pHips.setMatrixAt(i, n.bob.matrixWorld);
      pHead.setMatrixAt(i, n.head.matrixWorld);
      pHair.setMatrixAt(i, n.head.matrixWorld);
      pHat.setMatrixAt(i, n.hatN.matrixWorld);
      pArmL.setMatrixAt(i, n.armL.matrixWorld);
      pArmR.setMatrixAt(i, n.armR.matrixWorld);
      pLegL.setMatrixAt(i, n.legL.matrixWorld);
      pLegR.setMatrixAt(i, n.legR.matrixWorld);
      pTool.setMatrixAt(i, n.toolN.matrixWorld);
      pBroom.setMatrixAt(i, n.broomN.matrixWorld);
    }
    pTorso.instanceMatrix.needsUpdate = true;
    pHips.instanceMatrix.needsUpdate = true;
    pHead.instanceMatrix.needsUpdate = true;
    pHair.instanceMatrix.needsUpdate = true;
    pHat.instanceMatrix.needsUpdate = true;
    pArmL.instanceMatrix.needsUpdate = true;
    pArmR.instanceMatrix.needsUpdate = true;
    pLegL.instanceMatrix.needsUpdate = true;
    pLegR.instanceMatrix.needsUpdate = true;
    pTool.instanceMatrix.needsUpdate = true;
    pBroom.instanceMatrix.needsUpdate = true;

    for (let i = 0; i < paBeasts.length; i++) {
      const rec = paBeasts[i];
      const n = rec.nodes;
      const llama = rec.kind === 'llama';
      const mB = llama ? pLlamaB : pDogB;
      const mN = llama ? pLlamaN : pDogH;
      const mL = llama ? pLlamaL : pDogL;
      const mT = llama ? pLlamaT : pDogT;
      mB.setMatrixAt(rec.idx, n.bodyN.matrixWorld);
      mN.setMatrixAt(rec.idx, n.neckN.matrixWorld);
      mT.setMatrixAt(rec.idx, n.tailN.matrixWorld);
      mL.setMatrixAt(rec.idx * 4 + 0, n.l0.matrixWorld);
      mL.setMatrixAt(rec.idx * 4 + 1, n.l1.matrixWorld);
      mL.setMatrixAt(rec.idx * 4 + 2, n.l2.matrixWorld);
      mL.setMatrixAt(rec.idx * 4 + 3, n.l3.matrixWorld);
    }
    if (paLlamaMade) {
      pLlamaB.instanceMatrix.needsUpdate = true;
      pLlamaN.instanceMatrix.needsUpdate = true;
      pLlamaL.instanceMatrix.needsUpdate = true;
      pLlamaT.instanceMatrix.needsUpdate = true;
    }
    if (paDogMade) {
      pDogB.instanceMatrix.needsUpdate = true;
      pDogH.instanceMatrix.needsUpdate = true;
      pDogL.instanceMatrix.needsUpdate = true;
      pDogT.instanceMatrix.needsUpdate = true;
    }
  }

  // ================================================================== events
  game.events.on('biome:enter', (p) => {
    parkBubbles();
    // A carry frozen by a mid-carry departure must not resume on re-entry:
    // the first stepHuman frame would teleport the capybara from the spawn
    // point straight back into the gardener's hands across the map.
    for (let i = 0; i < game.npcs.length; i++) {
      const rec = game.npcs[i];
      if (rec && rec.carryT >= 0) {
        rec.carryT = -1;
        if (game.capy && game.capy.carriedBy === rec) game.capy.carriedBy = null;
        setState(rec, 'calm');
      }
    }
    if (!p || p.name !== 'pasto') return;
    paBuildCast();
  });

  /** The whole point of the chapter: a wheek in Pasto brings them TOWARD you. */
  game.events.on('capy:wheek', (p) => {
    if (!paLive() || !paBuiltCast) return;
    const sx = p && p.position ? p.position.x : capyX;
    const sz = p && p.position ? p.position.z : capyZ;
    const sy = p && p.position ? p.position.y : paCapyY();
    for (let i = 0; i < paHumans.length; i++) {
      const rec = paHumans[i];
      const dx = sx - rec.group.position.x, dz = sz - rec.group.position.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > 26 * 26) continue;
      rec.lookX = sx; rec.lookZ = sz;
      rec.alarm = Math.max(rec.alarm, 0.8);
      if (rec.state === 'gawp' || rec.state === 'chase') continue;
      // Heard AND (seen or close): nobody sets off up a volcano on a rumour.
      if (d2 < 8 * 8 || paVision(rec, sx, sz, sy, 26) > 0.14) {
        // Churchgoers are scandalised by the bell, not by a rodent; they only
        // ever tut. Everyone whose livelihood is on a trestle table comes.
        if (rec.kind === 'churchgoer') {
          if (rec.talkCd <= 0) { rec.talkCd = rand(8, 16); paSay(rec, 'paNotice'); }
        } else paStartChase(rec);
      }
    }
    for (let i = 0; i < paBeasts.length; i++) {
      const rec = paBeasts[i];
      const dx = sx - rec.group.position.x, dz = sz - rec.group.position.z;
      if (dx * dx + dz * dz > 20 * 20) continue;
      if (rec.kind === 'streetdog') { paDogFollow(rec); rec.stumble = 0.4; }
      else if (rec.spitCd <= 0 && dx * dx + dz * dz < 4 * 4) {
        paSet(rec, 'spit'); rec.spitCd = npcPA_LLAMA_SPIT_CD; rec.spat = false;
      }
    }
  });

  /** Theft. Noticed instantly, and remembered. */
  game.events.on('capy:grab', (p) => {
    if (!paLive() || !paBuiltCast) return;
    const prop = p && p.prop;
    if (!prop) return;
    const src = prop.body ? prop.body.position : (prop.mesh ? prop.mesh.position : null);
    const gx = src ? src.x : capyX, gz = src ? src.z : capyZ;
    let best = null, bestD = 12 * 12;
    for (let i = 0; i < paHumans.length; i++) {
      const rec = paHumans[i];
      if (rec.kind !== 'vendor' && rec.kind !== 'farmer') continue;
      const dx = gx - rec.home.x, dz = gz - rec.home.z;
      const d = dx * dx + dz * dz;
      if (d < bestD) { bestD = d; best = rec; }
    }
    if (best) {
      best.stolenType = prop.type || '';
      paGrudge(best);                     // an actual offence, actually counted
      paStartChase(best);
      paSay(best, 'paTheft');            // replaces the generic chase line
      sfx('gasp');
      // Anyone else in the market who can see it joins in. It is a small town.
      for (let i = 0; i < paHumans.length; i++) {
        const rec = paHumans[i];
        if (rec === best || rec.kind === 'churchgoer') continue;
        if (paDistToCapy(rec) < rec.alertR && paSeeCapy(rec) > 0.2) paStartChase(rec);
      }
    }
    if (prop.type === 'empanada') finish('steal-empanada');
    else if (prop.type === 'ruana') finish('ruana-thief');
  });

  /** Something heavy landing in the market is a vendor's problem immediately. */
  game.events.on('prop:impact', (p) => {
    if (!paLive() || !paBuiltCast) return;
    if (!p || !p.position || !(p.speed > 3)) return;
    for (let i = 0; i < paHumans.length; i++) {
      const rec = paHumans[i];
      if (rec.kind !== 'vendor') continue;
      const dx = p.position.x - rec.home.x, dz = p.position.z - rec.home.z;
      if (dx * dx + dz * dz < 5 * 5) { paGrudge(rec); paStartChase(rec); return; }
    }
  });

  function paBellRung() {
    if (!paBuiltCast) return;
    for (let i = 0; i < paHumans.length; i++) {
      const rec = paHumans[i];
      if (rec.kind !== 'churchgoer') continue;
      paSet(rec, 'scandal');
      rec.alarm = 1;
      rec.hopV = 2.2;
      if (i % 2 === 0) paSay(rec, 'paScandal');
    }
    sfx('gasp');
  }
  game.events.on('task:complete', (p) => {
    if (!paLive()) return;
    if (p && p.id === 'church-bell') paBellRung();
  });
  game.events.on('pasto:bell', () => { if (paLive()) paBellRung(); });

  // ============================================================ pasto update
  /** Runs ONLY while Pasto is the attached biome; update() is the gate. */
  function paUpdate(dt) {
    if (!paBuiltCast || !paCast.length) return;
    refreshCapy();
    paReadCondor();
    for (let k = 0; k < 3; k++) {
      const rec = paCast[paCursor];
      paCursor = (paCursor + 1) % paCast.length;
      if (rec) paThink(rec);
    }
    for (let i = 0; i < paHumans.length; i++) paStepHuman(paHumans[i], dt);
    for (let i = 0; i < paBeasts.length; i++) paStepBeast(paBeasts[i], dt);
    paPush();
    if (paColorDirty) { paFlushColors(); paColorDirty = false; }
    updateBubbles(dt);
  }

  // ================================================================== update
  let cursor = 0;
  const all = [];
  for (let i = 0; i < humans.length; i++) all.push(humans[i]);
  for (let i = 0; i < ibises.length; i++) all.push(ibises[i]);

  function updateBubbles(dt) {
    // Where the capybara is on screen. At the closer camera a bubble parked on
    // top of him hides the one thing the player is watching, so bubbles slide
    // out of his column rather than sitting over him.
    let capyNX = -9, capyNY = -9;
    const cg = game.capy && game.capy.group;
    if (cg) {
      npcV2.set(cg.position.x, cg.position.y + 0.95, cg.position.z);
      npcV2.project(game.camera);
      if (npcV2.z < 1) { capyNX = npcV2.x; capyNY = npcV2.y; }
    }
    for (let i = 0; i < BUB; i++) {
      const b = bubbles[i];
      if (!b.owner) continue;
      if (!b.mounted) {
        const host = (game.hud && game.hud.root) || document.getElementById('hud');
        if (!host) continue;                       // systems.js not up yet
        host.appendChild(b.el);
        b.mounted = true;
      }
      b.t += dt;
      const o = b.owner;
      if (o.nodes && (o.nodes.head || o.nodes.bodyN)) {
        npcV1.setFromMatrixPosition((o.nodes.head || o.nodes.bodyN).matrixWorld);
      } else npcV1.copy(o.group.position);
      npcV1.y += 0.64;                 // clear of the hat, not resting on it
      const dist = npcV1.distanceTo(game.camera.position);
      npcV1.project(game.camera);
      let a = 1;
      if (b.t < 0.12) a = b.t / 0.12;
      else if (b.t > b.life - 0.35) a = clamp((b.life - b.t) / 0.35, 0, 1);
      const onScreen = npcV1.z < 1 && npcV1.x > -1.4 && npcV1.x < 1.4 && npcV1.y > -1.4 && npcV1.y < 1.4;
      if (onScreen) {
        // slide clear of the capybara, damped so it glides instead of popping
        let want = 0;
        const ddx = npcV1.x - capyNX, ddy = npcV1.y - capyNY;
        if (Math.abs(ddx) < npcBUB_AVOID_X && Math.abs(ddy) < npcBUB_AVOID_Y) {
          want = (ddx >= 0 ? 1 : -1) * (npcBUB_AVOID_X - Math.abs(ddx)) * 1.35;
        }
        b.ox = damp(b.ox, want, 10, dt);
        // legible up close, still readable across the lawn
        const sc = clamp(14 / Math.max(dist, 1) + 0.52, 0.78, 1.22);
        const nx = clamp(npcV1.x + b.ox, -0.93, 0.93);
        // the bubble is drawn ABOVE this point, so leave headroom at the top
        const ny = clamp(npcV1.y, -0.80, 0.82);
        b.el.style.left = ((nx * 0.5 + 0.5) * 100) + '%';
        b.el.style.top = ((-ny * 0.5 + 0.5) * 100) + '%';
        b.el.style.transform = 'translate(-50%,-100%) scale(' + sc.toFixed(3) + ')';
        b.el.style.opacity = a;
        if (!b.shown) { b.el.style.display = 'block'; b.shown = true; }
      } else if (b.shown) { b.el.style.display = 'none'; b.shown = false; }
      if (b.t >= b.life) {
        b.owner = null;
        b.el.style.display = 'none';
        b.el.style.opacity = 0;
        b.shown = false;
      }
    }
  }

  function updateFlashes(dt) {
    for (let i = 0; i < flashes.length; i++) {
      const f = flashes[i];
      if (f.t > 0.3) { if (f.q.visible) { f.q.visible = false; f.fm.opacity = 0; } continue; }
      f.t += dt;
      const k = Math.sin(clamp(f.t / 0.3, 0, 1) * Math.PI);
      f.fm.opacity = k;
      const fs = lerp(0.5, 2.5, k);
      f.q.scale.set(fs, fs, 1);
      f.q.quaternion.copy(game.camera.quaternion);
    }
  }

  // =========================================================================
  // CHAPTER 2 DRIVERS — the sprinkler, the gull mob and the dog on the lead.
  //
  // Three of the six Circular Quay tasks had their cast, their dialogue and
  // their geometry authored but no state machine behind any of them, so
  // 'sprinkler', 'seagull-chips' and 'dog-loose' could never be ticked — which
  // meant chapter 1 could never complete and chapter 2 was never revealed.
  // Everything below reuses the rigs that were already built and hidden.
  //
  // No allocation per frame: the gulls and the dog are plain Object3D rigs that
  // are NEVER added to the scene — they exist only to be a matrix source for
  // the instanced meshes, exactly as the humans' node hierarchy is.
  // =========================================================================
  const QG_PERCH = 0, QG_DIVE = 1, QG_MOB = 2, QG_HOME = 3;
  const qgFlock = [];
  const qgPerch = [];             // flat x,y,z triples
  (function () {
    const src = game.env && game.env.perches;
    if (src && src.length) {
      for (let i = 0; i < src.length; i++) {
        const p = quayXOf(src[i]);
        if (p && isFinite(p.x) && isFinite(p.z)) qgPerch.push(p.x, isFinite(p.y) ? p.y : 0.95, p.z);
      }
    }
    if (qgPerch.length < 6) {
      qgPerch.length = 0;
      for (let i = 0; i < npcPERCH.length; i += 2) qgPerch.push(npcPERCH[i], 0.95, npcPERCH[i + 1]);
    }
  })();
  const qgPerchN = qgPerch.length / 3;

  for (let i = 0; i < npcGULL_N; i++) {
    const root = new THREE_.Object3D();
    const bodyN = new THREE_.Object3D();
    const wingL = new THREE_.Object3D();
    const wingR = new THREE_.Object3D();
    const headN = new THREE_.Object3D();
    root.add(bodyN);
    bodyN.add(wingL); bodyN.add(wingR); bodyN.add(headN);
    wingL.rotation.y = Math.PI;                 // mirrored frame, one animation
    headN.position.set(0, 0.11, 0.10);
    const pi = (i % Math.max(1, qgPerchN)) * 3;
    const px = qgPerch[pi] || -20, py = qgPerch[pi + 1] || 0.95, pz = qgPerch[pi + 2] || -9.5;
    root.position.set(px, py, pz);
    bodyN.position.y = 0.16;
    iGullB.setColorAt(i, npcColor.setHex(PALETTE.ibis));
    iGullWL.setColorAt(i, npcColor.setHex(PALETTE.stoneDark));
    iGullWR.setColorAt(i, npcColor.setHex(PALETTE.stoneDark));
    iGullH.setColorAt(i, npcColor.setHex(PALETTE.ibis));
    iGullBk.setColorAt(i, npcColor.setHex(PALETTE.hiVis));
    qgFlock.push({
      root, bodyN, wingL, wingR, headN,
      homeX: px, homeY: py, homeZ: pz,
      x: px, y: py, z: pz, yaw: rand(-Math.PI, Math.PI),
      state: QG_PERCH, t: rand(0, 4), flap: rand(0, 6.28), hop: 0,
    });
  }
  iGullB.instanceColor.needsUpdate = true;
  iGullWL.instanceColor.needsUpdate = true;
  iGullWR.instanceColor.needsUpdate = true;
  iGullH.instanceColor.needsUpdate = true;
  iGullBk.instanceColor.needsUpdate = true;

  // --- the dog -------------------------------------------------------------
  const qdRoot = new THREE_.Object3D();
  const qdBody = new THREE_.Object3D();
  const qdHead = new THREE_.Object3D();
  const qdTail = new THREE_.Object3D();
  const qdLegs = [];
  qdRoot.add(qdBody);
  qdBody.add(qdHead); qdBody.add(qdTail);
  qdBody.position.y = 0.40;
  qdHead.position.set(0, 0.13, 0.34);
  qdTail.position.set(0, 0.10, -0.30);
  for (let i = 0; i < 4; i++) {
    const l = new THREE_.Object3D();
    l.position.set((i & 1) ? 0.10 : -0.10, 0.30, (i < 2) ? 0.19 : -0.19);
    qdRoot.add(l);
    qdLegs.push(l);
    iDogL.setColorAt(i, npcColor.setHex(PALETTE.woodDark));
  }
  iDogB.setColorAt(0, npcColor.setHex(PALETTE.khaki));
  iDogH.setColorAt(0, npcColor.setHex(PALETTE.khaki));
  iDogT.setColorAt(0, npcColor.setHex(PALETTE.khaki));
  iDogB.instanceColor.needsUpdate = true;
  iDogH.instanceColor.needsUpdate = true;
  iDogL.instanceColor.needsUpdate = true;
  iDogT.instanceColor.needsUpdate = true;
  const qdog = {
    x: npcDOG_HOME.x, z: npcDOG_HOME.z, yaw: 0, spd: 0,
    onLead: true, state: 'heel', t: 0, phase: rand(0, 6.28),
    tgtX: npcDOG_HOME.x, tgtZ: npcDOG_HOME.z, barkCd: rand(3, 9),
  };
  const QD_LEAD = 1.9;            // metres of lead
  const QD_CUT_R = 1.45;          // reach at which the capybara can bite it through

  /** The handler's hand, or his last known spot if he was never built. */
  function qdAnchorX() { return dogOwnerRec ? dogOwnerRec.group.position.x : npcDOG_HOME.x; }
  function qdAnchorZ() { return dogOwnerRec ? dogOwnerRec.group.position.z : npcDOG_HOME.z + 1.2; }

  function qdCutLead() {
    if (!qdog.onLead) return;
    qdog.onLead = false;
    qdog.state = 'bolt';
    qdog.t = 0;
    qdog.barkCd = 0;
    leadMesh.visible = false;
    sfx('bark');
    try { game.shake(0.12); } catch (e) { /* optional */ }
    if (dogOwnerRec) {
      startle(dogOwnerRec, qdog.x, qdog.z);
      dogOwnerRec.reactMode = 0;
      pickLine(dogOwnerRec, 'dogCall');
    }
    try { game.toast('Murray is free.'); } catch (e) { /* optional */ }
    finish('dog-loose');
  }

  function qdPickRoam() {
    const pi = randInt(0, (npcQUAY_PTS.length / 2) - 1) * 2;
    qdog.tgtX = clamp(npcQUAY_PTS[pi] + rand(-2.5, 2.5), npcBOUND_X0, npcBOUND_X1);
    qdog.tgtZ = clamp(npcQUAY_PTS[pi + 1] + rand(-2.5, 2.5), npcEDGE_STOP, npcBOUND_Z1);
  }

  function qdStep(dt) {
    qdog.t += dt;
    qdog.barkCd -= dt;
    let spd = 0;
    if (qdog.onLead) {
      // Heels near the handler, drifting to the end of the lead and back.
      const ax = qdAnchorX(), az = qdAnchorZ();
      const a = qdog.phase + game.state.time * 0.5;
      const tx = ax + Math.sin(a) * (QD_LEAD * 0.62);
      const tz = az - 0.9 + Math.cos(a) * (QD_LEAD * 0.34);
      const dx = tx - qdog.x, dz = tz - qdog.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d > 0.12) {
        qdog.x += dx / d * Math.min(d, 1.5 * dt);
        qdog.z += dz / d * Math.min(d, 1.5 * dt);
        qdog.yaw = npcDampAngle(qdog.yaw, Math.atan2(dx, dz), 6, dt);
        spd = Math.min(d, 1.5);
      }
      // The lead can never stretch: hard-clamp onto the sphere about the hand.
      const hx = qdog.x - ax, hz = qdog.z - az;
      const hl = Math.sqrt(hx * hx + hz * hz);
      if (hl > QD_LEAD) { qdog.x = ax + hx / hl * QD_LEAD; qdog.z = az + hz / hl * QD_LEAD; }
      // Bite it through: a grab press in reach, or a barge at running speed.
      if (capyOk) {
        const cdx = capyX - qdog.x, cdz = capyZ - qdog.z;
        const cd2 = cdx * cdx + cdz * cdz;
        const input = game.input;
        const pressed = !!(input && input.actionPressed) &&
                        !(game.capy && game.capy.heldProp);
        if (cd2 < QD_CUT_R * QD_CUT_R && (pressed || capySpdH > npcCHECK_SPD)) qdCutLead();
      }
    } else {
      // Loose: bolts for a bit, then tours the quay barking at nothing.
      if (qdog.state === 'bolt' && qdog.t > 1.6) { qdog.state = 'roam'; qdPickRoam(); qdog.t = 0; }
      if (qdog.state === 'bolt') {
        qdog.tgtX = clamp(qdog.x + Math.sin(qdog.yaw) * 8, npcBOUND_X0, npcBOUND_X1);
        qdog.tgtZ = clamp(qdog.z + Math.cos(qdog.yaw) * 8, npcEDGE_STOP, npcBOUND_Z1);
      } else if (npcDwell(qdog, qdog.t, 3, 7)) { qdPickRoam(); qdog.t = 0; }
      const dx = qdog.tgtX - qdog.x, dz = qdog.tgtZ - qdog.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      spd = qdog.state === 'bolt' ? 5.2 : 2.6;
      if (d < 0.6) { spd = 0; qdog.t = 99; }
      else {
        const step = Math.min(d, spd * dt);
        const nx = qdog.x + dx / d * step, nz = qdog.z + dz / d * step;
        if (navBlocked(nx, nz, 0.3)) { qdPickRoam(); qdog.t = 0; }
        else { qdog.x = nx; qdog.z = nz; }
        qdog.yaw = npcDampAngle(qdog.yaw, Math.atan2(dx, dz), 7, dt);
      }
      if (qdog.barkCd <= 0) { qdog.barkCd = rand(2.5, 6); sfx('bark'); }
    }
    qdog.spd = damp(qdog.spd, spd, 8, dt);

    // pose
    const gait = qdog.phase + game.state.time * (3 + qdog.spd * 2.2);
    const lift = Math.abs(Math.sin(gait)) * 0.05 * clamp(qdog.spd, 0, 1.4);
    qdRoot.position.set(qdog.x, lift, qdog.z);
    qdRoot.rotation.y = qdog.yaw;
    qdBody.rotation.x = Math.sin(gait * 2) * 0.05 * clamp(qdog.spd, 0, 1.2);
    qdHead.rotation.x = -0.08 + Math.sin(gait) * 0.06;
    qdTail.rotation.x = -0.5;
    qdTail.rotation.z = Math.sin(game.state.time * (qdog.onLead ? 9 : 16)) * 0.6;
    for (let i = 0; i < 4; i++) {
      const s = Math.sin(gait + ((i === 0 || i === 3) ? 0 : Math.PI));
      qdLegs[i].rotation.x = s * clamp(0.15 + qdog.spd * 0.22, 0, 0.9);
    }
    qdRoot.updateMatrixWorld(true);

    // the lead itself: a unit cylinder stretched from the hand to the collar
    if (qdog.onLead) {
      const ax = qdAnchorX(), ay = 1.02, az = qdAnchorZ();
      const cx = qdog.x, cy = 0.50 + lift, cz = qdog.z;
      npcV1.set(cx - ax, cy - ay, cz - az);
      const len = npcV1.length();
      if (len > 0.02) {
        npcV2.copy(npcV1).divideScalar(len);
        npcQ1.setFromUnitVectors(npcUpY, npcV2);
        leadMesh.position.set(ax, ay, az);
        leadMesh.quaternion.copy(npcQ1);
        leadMesh.scale.set(1, len, 1);
        leadMesh.visible = true;
      } else leadMesh.visible = false;
    } else leadMesh.visible = false;
  }

  // --- the gull mob --------------------------------------------------------
  /** Loose chips the capybara is demonstrably responsible for, or null. */
  function qgFindChips() {
    const arr = game.props;
    if (!arr) return null;
    for (let i = 0; i < arr.length; i++) {
      const p = arr[i];
      if (!p || p.type !== 'chips') continue;
      if (p.removed || p.held || p.owner || p.hidden || p.spilled) continue;
      if (!p.mesh || p.mesh.parent !== scene || !p.body) continue;
      // Causation, same rule as props.js: chips that were never touched are
      // scenery. `disturbed` is stamped by any capybara contact or carry.
      if (!p.disturbed) continue;
      if (p.body.position.y < -1) continue;
      return p;
    }
    return null;
  }

  let qgTarget = null, qgMobT = 0, qgCryCd = 0, qgCool = 0, qgPeckT = 0;
  let qgBestMob = 0;              // most gulls on the chips at once, this session

  function qgStep(dt) {
    qgCryCd -= dt;
    if (qgCool > 0) qgCool -= dt;
    if (qgTarget && (qgTarget.removed || qgTarget.held || qgTarget.owner ||
                     qgTarget.hidden || !qgTarget.body)) { qgTarget = null; qgMobT = 0; }
    // Without the cooldown the flock re-acquires the same cone on the very frame
    // it gives up on it — `disturbed` never clears — and mobs it forever.
    if (!qgTarget && qgCool <= 0) { qgTarget = qgFindChips(); if (qgTarget) qgMobT = 0; }

    const tx = qgTarget ? qgTarget.body.position.x : 0;
    const tz = qgTarget ? qgTarget.body.position.z : 0;
    const ty = qgTarget ? qgTarget.body.position.y : 0;
    let arrived = 0;

    for (let i = 0; i < qgFlock.length; i++) {
      const g = qgFlock[i];
      g.t += dt;
      let sx = g.homeX, sy = g.homeY, sz = g.homeZ, spd = 1.6, flapRate = 1.5;

      if (qgTarget && g.state !== QG_HOME) {
        // fan out around the chips so eight birds are a mob, not a stack
        const a = (i / qgFlock.length) * Math.PI * 2 + game.state.time * 0.9;
        const ring = g.state === QG_MOB ? 0.55 : 0.9;
        sx = tx + Math.cos(a) * ring;
        sz = tz + Math.sin(a) * ring;
        sy = ty + (g.state === QG_MOB ? 0.10 + Math.abs(Math.sin(g.t * 7 + i)) * 0.22 : 0.55);
        spd = 7.5;
        flapRate = 13;
        if (g.state === QG_PERCH) { g.state = QG_DIVE; g.t = 0; }
      } else if (g.state === QG_HOME || !qgTarget) {
        g.state = QG_PERCH;
        // a perched gull shuffles and looks affronted; nothing more is needed
        sy = g.homeY + Math.abs(Math.sin(g.t * 1.6 + i)) * 0.02;
        spd = 2.2;
        flapRate = 0.9;
      }

      const dx = sx - g.x, dy = sy - g.y, dz = sz - g.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d > 0.02) {
        const step = Math.min(d, spd * dt);
        g.x += dx / d * step; g.y += dy / d * step; g.z += dz / d * step;
        if (dx * dx + dz * dz > 0.04) g.yaw = npcDampAngle(g.yaw, Math.atan2(dx, dz), 8, dt);
      }
      if (g.state === QG_DIVE && d < 1.1) { g.state = QG_MOB; g.t = 0; }
      if (g.state === QG_MOB) arrived++;

      g.flap += flapRate * dt;
      const beat = g.state === QG_PERCH ? 0 : (0.35 + Math.sin(g.flap) * 0.85);
      g.root.position.set(g.x, g.y, g.z);
      g.root.rotation.y = g.yaw;
      g.wingL.rotation.z = beat;
      g.wingR.rotation.z = -beat;
      g.wingL.rotation.x = 0; g.wingR.rotation.x = 0;
      g.headN.rotation.x = -0.1 + Math.sin(g.t * 4 + i) * 0.12;
      g.root.updateMatrixWorld(true);
    }

    if (!qgTarget) return;
    if (arrived >= 2) {
      qgMobT += dt;
      if (qgCryCd <= 0) { qgCryCd = rand(0.9, 1.8); sfx('gull'); }
      // The chips get worried at. A PECK ON A TIMER, not a per-frame force. Any
      // "top the vertical speed back up whenever it is low" rule is a levitator:
      // a 1.5 m/s hop decays through the trigger window in four frames at g = 24,
      // so it is re-triggered before it can ever land and the cone simply flies
      // (measured: 3.6 m up over open pavement with nothing under it). A gap
      // longer than the hop's own airtime is what makes it a peck.
      qgPeckT -= dt;
      if (qgMobT > 0.5 && qgPeckT <= 0) {
        qgPeckT = rand(0.5, 0.9);
        const b = qgTarget.body;
        b.wakeUp();
        b.velocity.x = clamp(b.velocity.x + rand(-2.5, 2.5), -3.5, 3.5);
        b.velocity.z = clamp(b.velocity.z + rand(-2.5, 2.5), -3.5, 3.5);
        if (b.velocity.y < 0.2) b.velocity.y = 1.4;
      }
      if (qgMobT > 0.7) {
        finish('seagull-chips');
        // HOW MANY OF THEM YOU MANAGED TO SUMMON. Sydney is eighteen tasks and
        // had no number in it anywhere, so once the list was ticked there was
        // nothing to come back for. The count is the gulls actually ON the
        // chips at once, which rewards dragging the food somewhere open rather
        // than eating it against a wall — and that is the funnier picture.
        if (arrived > qgBestMob) {
          qgBestMob = arrived;
          if (typeof game.record === "function") {
            try { game.record("seagull-chips", arrived); } catch (e) {}
          }
        }

        // anyone standing in the middle of it gets an opinion about it
        for (let i = 0; i < humans.length; i++) {
          const rec = humans[i];
          if (rec.mugT > 0) continue;
          const hx = rec.group.position.x - tx, hz = rec.group.position.z - tz;
          if (hx * hx + hz * hz > 3.5 * 3.5) continue;
          rec.mugT = 6;
          startle(rec, tx, tz);
          rec.reactMode = 1;
          pickLine(rec, 'mugged');
          break;
        }
      }
      // they do not stay for ever
      if (qgMobT > 9) {
        qgTarget = null; qgMobT = 0; qgCool = 22;
        for (let i = 0; i < qgFlock.length; i++) qgFlock[i].state = QG_HOME;
      }
    }
  }

  // --- the sprinkler -------------------------------------------------------
  // environment.js already publishes `sprays(x, z)` on every rotor and only ever
  // switches one on when the capybara stands on its valve plate, so the
  // causation gate is structural: nobody gets soaked by weather.
  function qsStep(dt) {
    const list = game.env && game.env.sprinklers;
    if (!list || !list.length) return;
    let anyOn = false;
    for (let i = 0; i < list.length; i++) if (list[i].on) { anyOn = true; break; }
    if (!anyOn) return;
    for (let i = 0; i < humans.length; i++) {
      const rec = humans[i];
      if (rec.soakCd > 0) continue;
      if (rec.state === 'swim' || rec.state === 'plunge' || rec.carryT >= 0) continue;
      const px = rec.group.position.x, pz = rec.group.position.z;
      let hit = null;
      for (let s = 0; s < list.length; s++) {
        const sp = list[s];
        if (sp.on && typeof sp.sprays === 'function' && sp.sprays(px, pz)) { hit = sp; break; }
      }
      if (!hit) continue;
      rec.soakCd = 8;
      rec.wet = 1;
      shadeHuman(rec, 1);
      startle(rec, hit.x, hit.z);
      rec.reactMode = 1;
      rec.flail = 1;
      rec.stumble = 1;
      pickLine(rec, 'soaked');
      sfx('gasp');
      finish('sprinkler');
      try { game.shake(0.1); } catch (e) { /* optional */ }
    }
  }

  // Published so systems.js's task hints can point a player at them. The dog and
  // the gulls have no cannon body and are not in game.npcs, so without this they
  // are unfindable from outside this module.
  game.quay = {
    dog: qdRoot,
    onLead: function () { return qdog.onLead; },
    busker: buskerRec,
    owner: dogOwnerRec,
    gulls: qgFlock,
  };

  /** One call from update(); everything above is off unless Sydney is live. */
  function quayStep(dt) {
    qsStep(dt);
    qgStep(dt);
    qdStep(dt);
    for (let i = 0; i < humans.length; i++) {
      const rec = humans[i];
      if (rec.soakCd > 0) {
        rec.soakCd -= dt;
        // dry off the way the capybara does, so nobody stays a dark blob
        if (rec.wet > 0 && rec.state !== 'swim' && rec.state !== 'plunge') {
          rec.wet = clamp(rec.wet - dt / 8, 0, 1);
          if (Math.abs(rec.wet - rec.wetShade) > 0.08) shadeHuman(rec, rec.wet);
        }
      }
      if (rec.mugT > 0) rec.mugT -= dt;
    }
  }

  function pushInstances() {
    for (let i = 0; i < humans.length; i++) {
      const n = humans[i].nodes;
      iTorso.setMatrixAt(i, n.bob.matrixWorld);
      iHips.setMatrixAt(i, n.bob.matrixWorld);
      iHead.setMatrixAt(i, n.head.matrixWorld);
      iHair.setMatrixAt(i, n.head.matrixWorld);
      iHat.setMatrixAt(i, n.hatN.matrixWorld);
      iArmL.setMatrixAt(i, n.armL.matrixWorld);
      iArmR.setMatrixAt(i, n.armR.matrixWorld);
      iLegL.setMatrixAt(i, n.legL.matrixWorld);
      iLegR.setMatrixAt(i, n.legR.matrixWorld);
      iCam.setMatrixAt(i, n.camN.matrixWorld);
      iTool.setMatrixAt(i, n.toolN.matrixWorld);
      iCone.setMatrixAt(i, n.coneN.matrixWorld);
    }
    iTorso.instanceMatrix.needsUpdate = true;
    iHips.instanceMatrix.needsUpdate = true;
    iHead.instanceMatrix.needsUpdate = true;
    iHair.instanceMatrix.needsUpdate = true;
    iHat.instanceMatrix.needsUpdate = true;
    iArmL.instanceMatrix.needsUpdate = true;
    iArmR.instanceMatrix.needsUpdate = true;
    iLegL.instanceMatrix.needsUpdate = true;
    iLegR.instanceMatrix.needsUpdate = true;
    iCam.instanceMatrix.needsUpdate = true;
    iTool.instanceMatrix.needsUpdate = true;
    iCone.instanceMatrix.needsUpdate = true;

    for (let i = 0; i < ibises.length; i++) {
      const n = ibises[i].nodes;
      iIbisB.setMatrixAt(i, n.bodyN.matrixWorld);
      iIbisN.setMatrixAt(i, n.neckN.matrixWorld);
      iIbisLA.setMatrixAt(i, n.legA.matrixWorld);
      iIbisLB.setMatrixAt(i, n.legB.matrixWorld);
    }
    iIbisB.instanceMatrix.needsUpdate = true;
    iIbisN.instanceMatrix.needsUpdate = true;
    iIbisLA.instanceMatrix.needsUpdate = true;
    iIbisLB.instanceMatrix.needsUpdate = true;

    if (waiterRec) {
      iTray.setMatrixAt(0, waiterRec.nodes.holdN.matrixWorld);
      iTray.instanceMatrix.needsUpdate = true;
    }
    if (buskerRec) {
      iGuitar.setMatrixAt(0, buskerRec.nodes.holdN.matrixWorld);
      iGuitar.instanceMatrix.needsUpdate = true;
    }

    for (let i = 0; i < qgFlock.length; i++) {
      const g = qgFlock[i];
      iGullB.setMatrixAt(i, g.bodyN.matrixWorld);
      iGullWL.setMatrixAt(i, g.wingL.matrixWorld);
      iGullWR.setMatrixAt(i, g.wingR.matrixWorld);
      iGullH.setMatrixAt(i, g.headN.matrixWorld);
      iGullBk.setMatrixAt(i, g.headN.matrixWorld);
    }
    iGullB.instanceMatrix.needsUpdate = true;
    iGullWL.instanceMatrix.needsUpdate = true;
    iGullWR.instanceMatrix.needsUpdate = true;
    iGullH.instanceMatrix.needsUpdate = true;
    iGullBk.instanceMatrix.needsUpdate = true;

    iDogB.setMatrixAt(0, qdBody.matrixWorld);
    iDogH.setMatrixAt(0, qdHead.matrixWorld);
    iDogT.setMatrixAt(0, qdTail.matrixWorld);
    for (let i = 0; i < 4; i++) iDogL.setMatrixAt(i, qdLegs[i].matrixWorld);
    iDogB.instanceMatrix.needsUpdate = true;
    iDogH.instanceMatrix.needsUpdate = true;
    iDogT.instanceMatrix.needsUpdate = true;
    iDogL.instanceMatrix.needsUpdate = true;
  }

  /** shadeHuman writes into the colour buffers; this is the one upload. */
  function flushColors() {
    iTorso.instanceColor.needsUpdate = true;
    iHips.instanceColor.needsUpdate = true;
    iHead.instanceColor.needsUpdate = true;
    iHair.instanceColor.needsUpdate = true;
    iArmL.instanceColor.needsUpdate = true;
    iArmR.instanceColor.needsUpdate = true;
    iLegL.instanceColor.needsUpdate = true;
    iLegR.instanceColor.needsUpdate = true;
    iHat.instanceColor.needsUpdate = true;
  }

  /** Sydney's crowd only exists while Sydney is the attached biome. */
  function biomeLive() {
    const b = game.biome;
    if (!b || typeof b.isActive !== 'function') return true;
    try { return !!b.isActive('sydney'); } catch (e) { return true; }
  }
  let wasLive = true;
  function parkBubbles() {
    for (let i = 0; i < BUB; i++) {
      const b = bubbles[i];
      b.owner = null;
      b.t = 0;
      b.shown = false;
      b.el.style.display = 'none';
      b.el.style.opacity = 0;
    }
    for (let i = 0; i < flashes.length; i++) {
      flashes[i].t = 999;
      flashes[i].q.visible = false;
      flashes[i].fm.opacity = 0;
    }
    for (let i = 0; i < splashes.length; i++) {
      splashes[i].t = 99;
      splashes[i].q.visible = false;
      splashes[i].sm.opacity = 0;
    }
  }

  // ====================================================== TWO PEOPLE TALKING ==
  // EVERYBODY IN THIS GAME WAS TALKING TO NOBODY.
  //
  // Sixteen tourists, a gardener, a busker, a waiter and four commuters, and
  // every line any of them has ever said has been a soliloquy: a bubble pops
  // over one head, nobody answers, and the bubble goes away. A crowd like that
  // is a room full of people on the phone.
  //
  // A conversation is a bubble, a pause, and a SECOND bubble over somebody
  // else, and that is all it is. No new state, no steering, no pathing: two
  // people who happen to be standing near each other and are not doing
  // anything more interesting. The reply is queued as a timer on the listener,
  // so if the capybara knocks either of them into the harbour in the meantime
  // the answer simply never arrives — which is funnier than making it robust.
  //
  // Held to four rules, all of them learned from the crowd noise this game has
  // been fixed for before:
  //   1. Never periodic. The scheduler's own countdown is re-drawn from a
  //      range every time it fires, and nothing here is on a modulo.
  //   2. One at a time, anywhere in the world. Two overlapping exchanges read
  //      as a hubbub, not as a conversation.
  //   3. Only people who are idle, seated or ambling. Anybody startled, robbed,
  //      chased, photographing, queueing or in the harbour has better things to
  //      be saying, and all of those already have their own lines.
  //   4. Openers and replies are separate lists, so an exchange can never be
  //      two people saying the same kind of thing at each other.
  // Both crowds' quiet states, in one table. Sydney and Pasto name their
  // states differently — 'idle'/'wander' against 'stand'/'walk'/'stall' — and a
  // single map is cheaper and much harder to get wrong than two.
  const npcCHAT_CALM = {
    // Sydney
    idle: 1, wander: 1, lookAt: 1, calm: 1, seated: 1, work: 1, busk: 1,
    // Pasto
    stand: 1, walk: 1, stall: 1, patrol: 1, plod: 1, pray: 1, restock: 1,
  };
  let chatT = rand(6, 16);
  let chatReplyRec = null, chatReplyT = 0, chatReplyKey = '';

  /** Openers and replies, per chapter. Sydney and Pasto have their own. */
  function chatKeys() {
    return paLive() ? ['paChatA', 'paChatB'] : ['chatA', 'chatB'];
  }

  function chatStep(dt, pool) {
    // the reply, first — it is owed from an earlier frame
    if (chatReplyRec) {
      chatReplyT -= dt;
      if (chatReplyT <= 0) {
        const r = chatReplyRec;
        chatReplyRec = null;
        // …unless something happened to them in the meantime, in which case
        // the question simply hangs, which is the better joke anyway.
        if (r.group && npcCHAT_CALM[r.state] && r.dejected <= 0) pickLine(r, chatReplyKey);
      }
      return;
    }
    chatT -= dt;
    if (chatT > 0) return;
    // TWO DIFFERENT COUNTDOWNS, AND THE SHORT ONE MATTERS MORE. The long one
    // is the pace of conversation once a pair has been found; the short one is
    // how often we LOOK. Measured over two hundred seconds in Sydney with only
    // the long one, the scan found a pair about once — the crowd is eleven
    // people over a hundred and thirty metres of park and a suitable pair is
    // simply not a common state of the world. A failed scan costs one pass
    // over the roster, so it can afford to happen every three seconds.
    chatT = rand(2.5, 5.5);
    if (!pool || pool.length < 2) return;
    const K = chatKeys();
    // one probe, from a random starting index — a full O(n^2) sweep for a bit
    // of chatter is not a trade worth making
    const n = pool.length;
    const s0 = randInt(0, n - 1);
    for (let k = 0; k < n; k++) {
      const a = pool[(s0 + k) % n];
      // chatCd, NOT talkCd. They are different channels and conflating them
      // very nearly killed the feature: in Sydney the crowd is eleven people in
      // a small park, the capybara is almost always inside noticing range, and
      // noticing sets talkCd to eight-to-twenty seconds. So for as long as the
      // player was anywhere near the conversation — which is the only time
      // they could ever see one — nobody was allowed to have one. Measured at
      // zero exchanges in two hundred seconds standing on the spawn lawn.
      // A remark AT the animal and a conversation with the person next to you
      // now cool independently, which is also simply true.
      if (!a || !a.chatty || !a.group || !npcCHAT_CALM[a.state] || a.chatCd > 0 || a.dejected > 0) continue;
      for (let j = 1; j < n; j++) {
        const b = pool[(s0 + k + j) % n];
        if (!b || b === a || !b.chatty || !b.group || !npcCHAT_CALM[b.state] ||
            b.chatCd > 0 || b.dejected > 0) continue;
        const dx = a.group.position.x - b.group.position.x;
        const dz = a.group.position.z - b.group.position.z;
        if (dx * dx + dz * dz > 3.6 * 3.6) continue;
        // they turn to each other, which is most of what sells it
        a.lookX = b.group.position.x; a.lookZ = b.group.position.z;
        b.lookX = a.group.position.x; b.lookZ = a.group.position.z;
        a.chatCd = rand(20, 55);
        b.chatCd = rand(20, 55);
        pickLine(a, K[0]);
        chatReplyRec = b;
        chatReplyKey = K[1];
        chatReplyT = rand(1.5, 2.4);
        chatT = rand(9, 24);        // …and now the long one, so it is not a chorus
        return;
      }
    }
  }

  function update(dt) {
    if (dt > 0.08) dt = 0.08;
    npcWxRead();

    // --- biome gate ------------------------------------------------------
    // In Pasto every Sydneysider is detached from the scene and the physics
    // world, so no state machine, raycast or steering step may run: the whole
    // module costs one boolean per frame.
    if (!biomeLive()) {
      wasLive = false;
      // …but Pasto's locals are a different crowd on the same rig, and they only
      // run while Pasto is the attached biome.
      if (paLive()) paUpdate(dt);
      // AND THE OTHER FOURTEEN CHAPTERS GET THEIR PEOPLE HERE. Both of these
      // used to sit below the Sydney gate, which is why a bubble was a thing
      // that could only happen on one lawn in the world.
      if (paLive()) chatStep(dt, paCast);
      localsStep(dt);
      localsChat(dt);
      npcExStep(dt);
      updateBubbles(dt);
      return;
    }
    wasLive = true;
    localsStep(dt);
    npcExStep(dt);

    refreshCapy();

    // staggered brain: three NPCs think per frame, everyone animates
    for (let k = 0; k < 3; k++) {
      const rec = all[cursor];
      cursor = (cursor + 1) % all.length;
      if (!rec) continue;
      if (rec.kind === 'ibis') thinkIbis(rec); else thinkHuman(rec);
    }

    for (let i = 0; i < humans.length; i++) stepHuman(humans[i], dt);
    for (let i = 0; i < ibises.length; i++) stepIbis(ibises[i], dt);
    ibisFeastStep(dt);
    quayStep(dt);

    chatStep(dt, humans);

    pushInstances();
    if (colorDirty) { flushColors(); colorDirty = false; }
    updateBubbles(dt);
    updateFlashes(dt);
    updateSplashes(dt);
  }

  // a little life on frame zero so nothing pops in from the origin
  for (let i = 0; i < humans.length; i++) { humans[i].group.updateMatrixWorld(true); }
  for (let i = 0; i < ibises.length; i++) { ibises[i].group.updateMatrixWorld(true); }
  for (let i = 0; i < qgFlock.length; i++) { qgFlock[i].root.updateMatrixWorld(true); }
  qdRoot.position.set(qdog.x, 0, qdog.z);
  qdRoot.updateMatrixWorld(true);
  pushInstances();

  /**
   * HOW MANY PEOPLE NEAR (x, z) ARE CURRENTLY WATCHING FOR YOU.
   *
   * Both crowds this module owns — the Sydney/Quay humans and the locals of the
   * other fifteen chapters — answer in one number, so a caller never has to
   * know which kind of person is standing in front of it. Zero in a chapter
   * with nobody in it, which is the right answer rather than a special case.
   *
   * It exists for the finds (sysFINDS in systems.js): wariness deliberately
   * denies nothing, so the only place it is allowed to have teeth is in content
   * that was written knowing about it.
   */
  function npcHeat(x, z, radius) {
    const r = radius > 0 ? radius : 14;
    const r2 = r * r;
    let n = 0;
    for (let i = 0; i < humans.length; i++) {
      const h = humans[i];
      if (!h || (h.wary || 0) <= npcWARY_HEAT || !h.group) continue;
      const dx = h.group.position.x - x, dz = h.group.position.z - z;
      if (dx * dx + dz * dz < r2) n++;
    }
    const live = game.biome && game.biome.current;
    for (let i = 0; i < locals.length; i++) {
      const L = locals[i];
      if (!L || L.biome !== live || (L.wary || 0) <= npcWARY_HEAT) continue;
      const dx = L.x - x, dz = L.z - z;
      if (dx * dx + dz * dz < r2) n++;
    }
    return n;
  }

  return { update, humans, ibises, pastoCast: paCast, pastoHumans: paHumans, pastoBeasts: paBeasts,
           addLocal: addLocal, addExchange: addExchange, say: sayAt, heat: npcHeat,
           // The register itself, for the audit that walks the capybara up to
           // every person in the game and checks somebody answers. Twenty-six
           // of them across twelve chapters is exactly the sort of list that
           // goes stale the moment a chapter moves a stall four metres.
           locals: locals };
}
