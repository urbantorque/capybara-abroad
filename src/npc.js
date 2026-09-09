import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PALETTE, mat, matOwn, TASKS, rand, randInt, clamp, damp, lerp, waterYAt } from './shared.js';

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
const npcCV1 = new CANNON.Vec3();
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
// The tail is a rotated square and cannot sample the box's own gradient, so
// the colour at the bottom of that gradient is computed here instead. A guess
// (solid sandstone) is 34% too dark and reads as a differently coloured pip.
function npcCssMix(a, b, k) {
  const m = (s) => Math.round(((a >> s) & 255) * (1 - k) + ((b >> s) & 255) * k);
  return 'rgb(' + m(16) + ',' + m(8) + ',' + m(0) + ')';
}
function npcCssRgba(c, a) {
  return 'rgba(' + ((c >> 16) & 255) + ',' + ((c >> 8) & 255) + ',' + (c & 255) + ',' + a + ')';
}

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
// ---------------------------------------------------------------------------
// THE SECOND COLOUR (R6). A part may carry `c`, a multiplier written into the
// `color` attribute for that part's vertices instead of the 1.0 fill every
// vertex used to get. It costs NOTHING: the attribute is already there, the
// material already has `vertexColors`, and the same buffer is still one draw
// call for forty-five people. The final albedo is
//
//     material colour (sail)  x  this  x  the per-instance colour
//
// so a shoe can be darker than the trouser it hangs off while both of them
// still take that person's own trouser colour.
//
// `c` IS LINEAR, because the multiply is. Two helpers name the space at the
// call site rather than leaving a bare number to be guessed at, and they are
// the same pair capybara.js's coat uses for the same reason:
//
//   npcSRGB(0.88)                 a number a person reasons about ("0.88 of
//                                 the shirt"), converted to the linear
//                                 multiplier that renders as it
//   npcOf(capyEye, sail)          the honest ratio of two palette colours,
//                                 taken through THREE.Color so it uses the
//                                 REAL sRGB transfer and not a power of 2.4,
//                                 which is 1.65x out at the dark end
// ---------------------------------------------------------------------------
function npcSRGB(m) {
  const k = Math.pow(m, 2.4);
  return [k, k, k];
}
function npcSRGB3(r, g, b) {
  return [Math.pow(r, 2.4), Math.pow(g, 2.4), Math.pow(b, 2.4)];
}
/** `hex` as a multiplier ON `ofHex`: what to write so the part renders AS hex. */
function npcOf(hex, ofHex) {
  const a = new THREE.Color(hex), b = new THREE.Color(ofHex);
  return [a.r / b.r, a.g / b.g, a.b / b.b];
}
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
    // the part's own multiplier, or 1 for the parts that do not want one
    const n = c.attributes.position.count, m = parts[i].c;
    const r = m === undefined ? 1 : (typeof m === 'number' ? m : m[0]);
    const gg = m === undefined ? 1 : (typeof m === 'number' ? m : m[1]);
    const bb = m === undefined ? 1 : (typeof m === 'number' ? m : m[2]);
    for (let v = 0; v < n; v++) {
      col[(off + v) * 3] = r; col[(off + v) * 3 + 1] = gg; col[(off + v) * 3 + 2] = bb;
    }
    off += c.attributes.position.count;
    c.dispose();
  }
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
            'That’s the most relaxed animal I’ve ever seen.', 'He owns the place, apparently.',
            { t: 'He was up on the stage. I’ve got the photo.', after: 'opera-stage' },
            { t: 'He’s wearing somebody’s hat.', after: 'steal-hat', before: 'hat-harbour' },
            { t: 'He carried it all that way and then threw it in.', after: 'hat-harbour' },
            { t: 'He’s soaked. He did that to himself.', after: 'swim' },
            { t: 'He’s been in the sprinkler. On purpose.', after: 'sprinkler' }],
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
  // ---- AND THE SQUARE KEEPS UP WITH YOU (v36) ---------------------------
  // Sydney has nineteen tasks — the longest list in the game — and for
  // thirty-five versions not one person in it said anything different after
  // any of them. See ...AND THE TWO OLDEST CASTS KNOW WHAT YOU HAVE DONE, by
  // pickLine, for the one line of plumbing that makes these resolve.
  //
  // The rule is the one every other chapter's pool keeps: a line goes in a
  // pool ONLY if the person who owns that pool would say it, none of them
  // names a task or an objective, and every one is something you could
  // overhear on that promenade rather than a receipt for what you just did.
  idle:    ['Lovely day.', 'Is that the Opera House?', 'Reckon it’ll rain.', 'Beautiful, but.',
            'Where’s the ferry?', 'Twelve dollars for a coffee.', 'It’s bigger in person, isn’t it.',
            'I said we should’ve gone to Bondi.', 'Is that a bin chicken or a real bird?',
            { t: 'Did you see it on the steps? It was ON the steps.', after: 'opera-stage' },
            { t: 'There’s one in the harbour. Swimming. Just swimming.', after: 'swim' },
            { t: 'Somebody’s lost a hat this morning.', after: 'steal-hat' },
            { t: 'The gardener’s having a day of it.', after: 'chased' },
            { t: 'There were birds everywhere. EVERYWHERE.', after: 'seagull-chips' },
            { t: 'It got on the van. It rode the van.', after: 'whippy-run' },
            { t: 'The bins are all over the path.', after: 'bin-chicken' },
            { t: 'Someone’s going to have to tell the council about those roses.', after: 'dig-flower' },
            { t: 'There’s a dog loose in the gardens.', after: 'dog-loose' }],

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
            'Right, so where are we meeting them?',
            { t: 'Did you get a photo of the thing on the steps?', after: 'opera-stage' },
            { t: 'I told you it would swim.', after: 'swim' },
            { t: 'Is that the one that was on the ice cream van?', after: 'whippy-run' }],
  chatB:   ['Mm.', 'You said that yesterday.', 'Probably.', 'I wasn’t listening, sorry.',
            'That’s what I said.', 'Ask your father.', 'It’s in the other bag.',
            'Don’t start.', 'We’ll see.', 'It’s the humidity, that.',
            'I’m not walking back up that hill.', 'Lovely, though. Isn’t it.',
            'Well. There you go.', 'Have a look on your phone.',
            'That is genuinely the biggest one I have ever seen.',
            { t: 'I got four. All of them blurry.', after: 'opera-stage' },
            { t: 'I never said it wouldn’t.', after: 'swim' },
            { t: 'I have stopped being surprised, is the thing.', after: 'whippy-run' }],

  // ---- Circular Quay (chapter 1) ----
  busk:    ['Any requests?', 'Cheers, mate.', 'This one’s in G.', 'Ta very much.',
            'Everything’s in G, mate.', 'Tips go in the hat. The HAT.',
            { t: 'Watch the hat, would you. Just — watch the hat.', before: 'busker-hat' },
            { t: 'Hat’s empty, mate. Ask the rodent.', after: 'busker-hat' }],
  buskRob: ['That’s my hat!', 'That’s my takings!', 'Oi — I’m working here!', 'Mate. MATE.',
            'There was eleven dollars in that!', 'I have been robbed by a rodent.'],
  buskSad: ['Right. Where was I.', 'Every Sunday, this.', 'Back to it, then.', 'Terrific.',
            'I’ll write a song about it.', 'This one’s about a capybara.'],
  cafe:    ['…and she said no, obviously.', 'The coffee here is criminal.', 'Lovely spot, this.',
            'Is that a very large guinea pig?', 'We should get the ferry after.',
            { t: 'Something stood on our table. Stood on it.', after: 'cafe-table' },
            { t: 'I’m not putting my bag down again.', after: 'cafe-table' },
            { t: 'Mine went everywhere. Everywhere.', after: 'coffee-spill' }],
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
            'We should sit outside more often.', 'Table with a view, you said.',
            { t: 'Don’t put your food down. I’m telling you. Don’t.', after: 'picnic-thief' },
            { t: 'They warned us about the birds. They did not warn us about that.', after: 'seagull-chips' }],
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
              'Is that somebody’s?', 'It is not a dog. I know that much.',
              // ...AND THE PLAZA KEEPS UP TOO (v36). Same rule as Sydney's above:
              // in this chapter's own register, and none of them a receipt.
              { t: 'It went up with the condor. I watched it go.', after: 'condor-ride' },
              { t: 'That is the one that took my neighbour’s empanada.', after: 'steal-empanada' },
              { t: 'It rang the bell. A chigüiro rang the bell.', after: 'church-bell' },
              { t: 'It was on the carroza, hombre. ON it.', after: 'carroza' }],
  paTheft:   ['¡Oiga! That is MINE!', 'Thief! Sinvergüenza!', 'Put it back. Put it BACK.',
              'I saw that, chigüiro.', 'That is my living, hombre!'],
  paChase:   ['¡Venga acá!', 'Do not run from me!', 'Out of my stall!',
              'I warned you, mijo!', 'I will remember that face!'],
  paWheeze:  ['I am too old for this, pues.', 'Ay, my back.',
              'Every Tuesday. Every single Tuesday.', 'Gone. Of course he is gone.'],
  paRestock: ['Right. Start again.', 'Tomorrow I bring the dog.',
              'Next time, chigüiro.', 'I know your face now.',
              { t: 'Third time this week. The third.', after: 'market-chaos' },
              { t: 'And it eats the stock as well. Of course it does.', after: 'steal-empanada' }],
  // THE WOMAN WITH THE BROOM. The one recurring character in this chapter and
  // the only person in the game who never once breaks into a run — the whole
  // joke is that she does not have to, and every line she has is a variation on
  // it. Nobody else here gets a philosophy.
  paBroom:   ['I do not run. I arrive.', 'The broom is patient, mijo.',
              'Walk, then. I will still get there.', 'Sinvergüenza. Come here.',
              'I have all afternoon.', 'You are faster. I am closer.',
              // She keeps her philosophy. This is the same sentence about it.
              { t: 'You went up with the bird. You still came back down here.', after: 'condor-ride' }],
  paSwat:    ['Take that!', 'And that!', 'Learn, pues!'],
  paScold:   ['Go on. Off with you.', 'The broom does not forget.',
              'I will be here tomorrow.', 'We both know you will be back.',
              'Another day, chigüiro.'],
  paFarm:    ['Out of the drying beds!', 'Not the café — NOT THE CAFÉ!',
              'That is a year of work you are standing on!', '¡Fuera! Get off!',
              { t: 'A whole year. And it walked straight through it.', after: 'coffee-scatter' },
              { t: 'Not one bean out of place today. Not one.', before: 'coffee-scatter' }],
  // EATING THE STOCK, in this chapter's voice. Pasto has THIRTEEN edible props
  // — more than any other chapter in the game, Sydney's seven included — and
  // until v30 not one of them could start a reaction, because the produce chain
  // lives on `locals` and this chapter has none. Its own pools are used rather
  // than the chapter-neutral npcLOC_PRODUCE for the reason that pool is neutral
  // in the first place: it is spoken over a Kyoto tea stall and an Antarctic
  // ration crate alike, and this is a market in Nariño with a named cast in it.
  paProduce: ['That is for selling, not for eating.', 'Ay — that was the good one.',
              'You are eating my morning.', '¿Y quién paga? Not you.',
              'That is stock, chigüiro.', 'Every week the same animal.'],
  paChurch:  ['God preserve us.', 'Buenas.', 'Mass is at six.',
              'The courtyard is lovely at this hour.',
              { t: 'Nobody has touched that rope in forty years.', before: 'church-bell' },
              { t: 'We are still finding out who rang it.', after: 'church-bell' }],
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
// ---- ch4 · SOFT FEET, and ch19 · THE FLOW --------------------------------
// Two numbers, and between them they are the whole of what those two chapters
// hand over to the other seventeen.
//
// `npcQUIET_K` scales what the animal is WORTH as a fright: a startled walker
// still startles, but half as much of it sticks. Kyoto is the chapter that asks
// you to be a menace *quietly* and `still-bamboo` is the find for standing in
// it until the bamboo is the loudest thing there; what that is worth is that
// the rest of the world takes longer to mind you. It scales the wariness a
// scare LEAVES BEHIND, not the scare — a person who has just been walked into
// still says so, they simply do not hold it against you for as long.
//
// `npcFLOW_R` is Hanoi's lesson, made portable. In Hanoi two hundred and forty
// riders read your heading and swing off it a second and a half early; here
// people simply give a committed animal a wider berth than the 1.05 m at which
// the meshes interpenetrate, and they step ACROSS the line rather than being
// pushed back along it. It is not speed and it is not invulnerability. It is
// being taken seriously, and it shuts the moment you waver.
const npcQUIET_K   = 0.45;    // multiplier on wariness left behind, with soft feet
const npcFLOW_R    = 2.25;    // m of berth a committed animal is given
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
// How far away somebody can be and still be READ OUT when their bubble is off
// the frame (F4). Twenty-five metres: the same order as the ambience ring, and
// well inside the ninety the crowd is drawn at, so it is "somebody the camera
// swung past" and not "every conversation in the chapter, as text".
const npcSAY_HEAR = 25;
// ...and no more than one of them every this many seconds. See the measurement
// in updateBubbles: without a fence it is twenty-six pills in twenty seconds.
const npcSAY_HEAR_GAP = 9;
let npcHeardT = 0;
const npcBUB_AVOID_X = 0.20;  // NDC half-width of the capybara's no-fly zone
const npcBUB_AVOID_Y = 0.34;
// ---- ...AND THE PAPER IS ALSO IN THE WAY (v34) --------------------------
// The bubble dodged the capybara and the screen edges and knew nothing about
// the two opaque panels on the corners of the frame. Measured in Mong Kok: a
// local's line landed on the to-do card and took out two of its rows, so the
// sentence and the task list were unreadable together for a second and a half.
//
// Same mechanism as the capybara dodge — a horizontal push on `ox`, damped, so
// it glides rather than pops — and it pushes toward the middle of the screen,
// which is away from whichever corner the panel is in. The pad keeps a little
// daylight so the two do not merely touch.
//
// Asked of game.hud.panels() on a slow tick, not per frame: it is a layout
// read, and a panel that has just changed size is one frame late at worst.
const npcBUB_PANEL_PAD = 0.035;  // NDC of daylight left beside a panel
const npcBUB_PANEL_T   = 0.20;   // s between layout reads

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
const npcGULL_N = 8;
const npcSEAT_CROUCH = -0.12;    // hips 0.62 -> 0.50: chair height
const npcSEAT_LEG = -0.72;       // thighs swung forward under the table

// Fallback fixtures, used only until environment.js publishes the real ones.
const npcFB_BUSKER = { x: -25.0, z: 2.0 };
const npcFB_KIOSK = { x: -18.5, z: 5.0 };
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
// A child is a build, not a role — see THREE BUILDS in buildHuman.
const npcCHILD_ODDS = 1 / 7;    // ...of TOURISTS, which is about two per crowd
// MEASURED, not assumed: at 0.70 the head centre came out 0.86 m above the
// feet, which is a 1.00 m child — a toddler. The rig's nominal 1.72 m is the
// figure it was drawn to and not the figure it measures; the crown is nearer
// 1.60. 0.82 puts the crown at 1.18 m, which is six or seven years old.
const npcCHILD_H    = 0.82;
const npcCHILD_HEAD = 1.22;     // ...with a head too big for it, which is the tell
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
// FACES (v54).
//
// Everybody in this game was a box with a nose on it. The nose was put there
// for one reason and it is written down at the line that adds it: without it
// a figure turning to watch you is a cube rotating. It works — but it is the
// whole face, and it means the cast can be startled, cornered, robbed, chased
// off, praised and rained on and their expression never changes, because they
// have not got one.
//
// Three states out of four nodes and no new geometry per person:
//
//   mood  -1 angry ......... 0 neutral ......... +1 wide
//   blink  0 open ........................... 1 shut
//
// Everything below is a MATRIX — a scale on the eye pair, a rotation and a
// centimetre of lift on each brow. That is deliberate: it costs the same on a
// local's Object3D as on an instanced crowd's node, so one function drives
// thirty hand-built figures and forty-five instanced ones.
//
// The signs are the whole thing and they are easy to get backwards. A figure
// faces +z. rotation.z takes +x toward +y. The left brow sits at x < 0, so
// its INNER end is its +x end and a positive rz lifts it; the right brow is
// the mirror. Angry is inner-ends-DOWN (a V), wide is inner-ends-slightly-up
// and the whole pair raised. Get one sign wrong and a furious market trader
// is drawn looking mildly delighted, which is funny once.
const npcEYE_WIDE  = 1.55;   // how much taller a wide eye is
const npcEYE_SHUT  = 0.12;   // ...and how flat a shut one is
const npcBROW_UP   = 0.032;  // m the brow lifts when the eyes go wide
const npcBROW_DN   = 0.017;  // ...and drops when they narrow
const npcBROW_TILT = 0.36;   // rad of inner-end-down at full anger
const npcBROW_LIFT = 0.15;   // ...and of inner-end-up at full surprise
const npcBLINK_MIN = 2.6;    // s between blinks
const npcBLINK_MAX = 6.4;
const npcBLINK_DUR = 0.11;   // ...and how long one takes. Two frames is a bug.
/**
 * @param f  {eyeN, browL, browR, browY} — browY is the rest height, because
 *           the brow node is the thing being moved and cannot also be the
 *           thing that remembers where it started.
 */
function npcFace(f, mood, blink) {
  if (!f) return;
  const up = mood > 0 ? mood : 0;
  const dn = mood < 0 ? -mood : 0;
  const open = (1 + up * (npcEYE_WIDE - 1)) * (1 - blink * (1 - npcEYE_SHUT));
  // a wide eye is a little wider as well as taller, or it reads as a slot
  f.eyeN.scale.set(1 + up * 0.16, open, 1);
  // `upK` exists for one reason: a local's fringe sits 1.2 cm above their brow
  // and the roster's does not, so the same lift that reads as astonishment on
  // a tourist pushes a market trader's eyebrows inside their own hair.
  const y = f.browY + up * npcBROW_UP * (f.upK || 1) - dn * npcBROW_DN;
  f.browL.position.y = y;
  f.browR.position.y = y;
  const tilt = dn * npcBROW_TILT - up * npcBROW_LIFT;
  f.browL.rotation.z = -tilt;
  f.browR.rotation.z = tilt;
}
/** The blink clock. Returns 0..1 closed; call it once per person per frame. */
function npcBlink(rec, dt) {
  rec.blinkT -= dt;
  if (rec.blinkT <= -npcBLINK_DUR) rec.blinkT = rand(npcBLINK_MIN, npcBLINK_MAX);
  if (rec.blinkT > 0) return 0;
  // a triangle, not a step: shut in half the window and open again in the rest
  const k = -rec.blinkT / npcBLINK_DUR;
  return k < 0.5 ? k * 2 : (1 - k) * 2;
}

// ===========================================================================
export function createNPCs(game) {
  const scene = game.scene;
  const THREE_ = game.THREE || THREE;

  // ---------------------------------------------------------------- geometry
  const gTorso = npcMakeGeo([
    { w: 0.50, h: 0.60, d: 0.30, y: 1.02 },
    // The shoulders slab is where a shirt has a seam and a person has a
    // collarbone, and it is the only horizontal on the torso: 0.88 turns it
    // from a step in the outline into a step in the GARMENT.
    { w: 0.62, h: 0.14, d: 0.32, y: 1.24, c: npcSRGB(0.88) },   // shoulders
  ]);
  const gHips = npcMakeGeo([{ w: 0.46, h: 0.26, d: 0.32, y: 0.68 }]);
  const gHead = npcMakeGeo([
    { w: 0.32, h: 0.32, d: 0.31, y: 0.16 },
    { w: 0.07, h: 0.06, d: 0.06, y: 0.14, z: 0.17, c: npcSRGB(0.94) },  // nose
    // ...and the neck, which is the one that stops a head being a box
    // BALANCED on a box: 0.86 is a head sitting on something.
    { w: 0.16, h: 0.14, d: 0.12, y: 0.00, c: npcSRGB(0.86) },           // neck
  ]);
  const gHair = npcMakeGeo([
    { w: 0.35, h: 0.13, d: 0.34, y: 0.30 },
    { w: 0.30, h: 0.18, d: 0.10, y: 0.17, z: -0.15, c: npcSRGB(0.92) },  // hair has a part
  ]);
  // ---- THE FACE (v54) ---------------------------------------------------
  // Both eyes in ONE geometry, because nothing in this game ever winks: that
  // is one InstancedMesh for the pair instead of two. Both BROWS are one mesh
  // too, at 2N instances indexed idx*2 — the same trick pLlamaL uses for four
  // legs — because a brow has to rotate independently of its twin and a
  // shared geometry cannot do that, but a shared BUFFER can.
  //
  // Geometry is centred on the origin so the instance matrix scales about the
  // eye, not about the neck: an eye node offset inside its own geometry would
  // slide down the face when it blinks.
  //
  // ---- AND THE EYES HAVE WHITES (R6) ------------------------------------
  // A pale box BEHIND each pupil, 6 mm proud of it on every side, in the same
  // merged geometry: still one buffer, still one draw call for the pair, for
  // thirty-two people. It is what turns a face from two dots into a face.
  //
  // THE ROADMAP HAD THIS THE WRONG WAY ROUND AND THE ARITHMETIC SAYS SO. Its
  // plan was to keep `capyEye` as the per-instance colour and write 2.3 on the
  // white, "which clamps to the pale the face wants". It does not: the albedo
  // is sail x capyEye x c, and capyEye is 0.027 of full in LINEAR, so 2.3
  // lands at 0.06 and even 7.3 (which is what 2.3 means as an sRGB intent)
  // lands at 0.19 - a mid brown. Reaching `sail` from there needs a multiplier
  // of 37 on red and 115 on blue.
  //
  // So it is inverted: the INSTANCE colour is white, which makes the eye white
  // the material's own `sail`, and the PUPIL carries the dark multiplier. Every
  // multiplier in this file is then at or below 1, which is the direction that
  // cannot clip, and the pupil is derived from the palette rather than written
  // out twice. See iEyes.setColorAt.
  const gEyes = npcMakeGeo([
    // WIDER THAN THE ROADMAP SAID, and only the render showed why. At its
    // 0.070 x 0.052 the pale stands 6 mm proud at the sides and 4 mm at the
    // top, which is a uniform BORDER: it reads as a pair of spectacles, not as
    // an eye. An eye is a wide white with a dark iris somewhere in the middle,
    // so the ring has to be three times wider at the sides than above.
    { w: 0.088, h: 0.050, d: 0.016, x: -0.072, z: -0.004 },   // the white
    { w: 0.088, h: 0.050, d: 0.016, x: 0.072, z: -0.004 },
    { w: 0.058, h: 0.044, d: 0.02, x: -0.072, c: npcOf(PALETTE.capyEye, PALETTE.sail) },
    { w: 0.058, h: 0.044, d: 0.02, x: 0.072, c: npcOf(PALETTE.capyEye, PALETTE.sail) },
  ]);
  const gBrow = npcMakeGeo([{ w: 0.092, h: 0.020, d: 0.022 }]);
  const gArm = npcMakeGeo([
    { w: 0.12, h: 0.48, d: 0.12, y: -0.24 },
    { w: 0.13, h: 0.13, d: 0.13, y: -0.53 },           // hand
  ]);
  const gLeg = npcMakeGeo([
    { w: 0.15, h: 0.60, d: 0.16, y: -0.30 },
    // A SHOE IS THE CHEAPEST COLOUR ON A PERSON. It is at the bottom of the
    // silhouette, where the eye starts, it is already its own box, and it is
    // the one edge every real garment has. Slightly blue, because leather is.
    { w: 0.17, h: 0.10, d: 0.24, y: -0.57, z: 0.04,
      c: npcSRGB3(0.55, 0.55, 0.58) },                 // shoe
  ]);
  // THE BRIM IS TWO CYLINDERS NOW, and only so that its UNDERSIDE can be dark
  // (R6): a part is the smallest thing `c` can address, and a brim that is one
  // cylinder cannot have a lit top and a shaded bottom. Split at y 0.317, same
  // 0.305 to 0.335 the single one occupied, so the hat's silhouette is
  // unchanged and the only new thing in the frame is the shadow a brim throws.
  const gHat = npcMakeGeo([
    { k: 'cyl', rt: 0.36, rb: 0.36, h: 0.012, seg: 8, y: 0.311, c: npcSRGB(0.72) },
    { k: 'cyl', rt: 0.36, rb: 0.36, h: 0.018, seg: 8, y: 0.326 },
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
  // the face: one instance for the pair of eyes, two for the brows (see
  // FACES). Two extra draw calls buys an expression for thirty-two people.
  const iEyes  = mkInst(gEyes, HUMANS);
  const iBrow  = mkInst(gBrow, HUMANS * 2);
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
    { w: 0.13, h: 0.11, d: 0.17, y: -0.03, z: 0.17, c: npcSRGB(0.85) },  // snout
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
  // ---- A BUBBLE IS PAPER (v54) -------------------------------------------
  // This was the third UI dialect in the game. The to-do card, the journal,
  // the pause card and the title are one printed sheet — PALETTE.sail under a
  // warm rake and a laid texture, PALETTE.sailShade at the edge, ibisHead ink,
  // a 7 px corner and three shadows, of which the tight one is the contact
  // with the surface. A speech bubble was a 13 px white pill with a
  // sandstoneDark hairline, bold near-black text and one soft drop shadow: a
  // different paper, a different edge, a different ink and a different corner,
  // from a different game.
  //
  // Everything below is the card's own recipe with the tail left on. The tail
  // is what makes it speech; the pill was never doing that job.
  const bubPaper = npcCssHex(PALETTE.sail);
  const bubEdge = npcCssHex(PALETTE.sailShade);
  const BUB_CSS =
    'position:absolute;left:0;top:0;transform:translate(-50%,-100%);pointer-events:none;' +
    // ---- AND IT IS UNDER THE PAPER (F1) --------------------------------
    // This pool is mounted into the HUD root at runtime, so it lands after
    // every piece of furniture systems.js built at boot and, with nothing
    // carrying a z-index on either side, painted over all of it — the to-do
    // card most visibly. The furniture is one explicit rung up at 40; this is
    // the rung the two rules were arguing about, written down. A bubble is the
    // world talking and the paper is the game talking.
    'z-index:30;' +
    'display:none;opacity:0;white-space:nowrap;' +
    'font-family:"Trebuchet MS","Segoe UI",system-ui,sans-serif;' +
    'font-weight:600;font-size:15px;line-height:1.15;padding:7px 13px 8px;border-radius:7px;' +
    'background:' + bubPaper + ';color:' + npcCssHex(PALETTE.ibisHead) + ';' +
    'background-image:linear-gradient(158deg,' + npcCssRgba(PALETTE.sail, 1) + ' 0%,' +
    npcCssRgba(PALETTE.sandstone, 0.34) + ' 100%),' +
    'repeating-linear-gradient(92deg,' + npcCssRgba(PALETTE.stoneDark, 0.05) + ' 0 1px,' +
    'transparent 1px 4px);' +
    'border:1px solid ' + bubEdge + ';' +
    // the card's three: contact, lift, and the wide one that puts it in a room
    'box-shadow:0 1px 2px ' + npcCssRgba(PALETTE.screenShadow, 0.16) + ',' +
    '0 4px 9px ' + npcCssRgba(PALETTE.screenShadow, 0.16) + ',' +
    '0 14px 30px ' + npcCssRgba(PALETTE.screenShadow, 0.10) + ';' +
    'transform-origin:50% 100%;will-change:transform,opacity;';
  // The tail carries the SOLID paper, not the gradient: a 10 px square with a
  // 158-degree rake across it samples one flat colour anyway, and the top-left
  // end of that gradient does not match the bottom edge of the box it hangs
  // off — so it reads as a differently coloured pip rather than as the same
  // sheet coming to a point.
  const TAIL_CSS =
    'position:absolute;left:50%;bottom:-6px;width:10px;height:10px;margin-left:-5px;' +
    'transform:rotate(45deg);background:' + npcCssMix(PALETTE.sail, PALETTE.sandstone, 0.34) + ';' +
    'border-right:1px solid ' + bubEdge + ';' +
    'border-bottom:1px solid ' + bubEdge + ';';
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

  // The live speaker, for the capybara gaze. One object, rewritten in place:
  // the gaze asks for it every capyGAZE_TICK and an allocation per line would
  // be an allocation per line for ever.  is on it because locals are
  // shared space and a Venetian must not be looked at from a glacier.
  const npcSpeak = { x: 0, y: 0, z: 0, t: 0, biome: '' };
  function npcSpeaker() {
    return npcSpeak.t > 0 && npcSpeak.biome === (game.biome ? game.biome.current : '')
      ? npcSpeak : null;
  }

  function sayBubble(npcRec, text) {
    // ---- NOBODY TALKS OVER THE TITLE CARD (T1) ---------------------------
    // The locals do not know the game has not started. Measured 5 Sep 2026 at
    // 1920x1080: three bubbles standing in the wash behind the title card,
    // one of them the ice-cream van's departure — a punchline delivered to
    // somebody who has not pressed a key yet, and the only legible text on
    // the screen that is not on the card.
    //
    // Gated HERE rather than in updateBubbles, because this is the one door
    // every line in this file goes through and it is the door before any
    // state is taken: no slot is claimed, no `gest` is written on somebody
    // who is about to be told to gesture at nothing, and `npcSpeak` — which
    // the capybara's gaze follows — is not pointed at a silent person. The
    // world goes on living; it just does not narrate itself to an empty room.
    if (!game.state.started) return;
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
    slot.said = false;              // this line has not been read out yet (F4)
    slot.life = 1.7 + text.length * 0.05;
    // ---- ...AND THEIR ARM KNOWS ABOUT IT (D8) ----------------------------
    // Every local in the game gestures while they speak and not one of the
    // fifty-odd people in Sydney and Pasto ever has: `rec.gest` was written by
    // localLine and read by the locals' pose stack, and the roster's rig — a
    // real state machine, drawn as instanced boxes — had no equivalent at all.
    // So a crowd of tourists talked to each other for nineteen versions with
    // their hands by their sides.
    //
    // It is set HERE, in the one place every line in this file goes through,
    // and it is set to the BUBBLE'S OWN LIFE — so the arm cannot get out of
    // step with the words, which is exactly what a second hand-tuned constant
    // beside this one would eventually do. A local's `anchor` also comes
    // through here and harmlessly takes the property: localLine has already
    // set the real record's own.
    npcRec.gest = slot.life;
    // ---- SOMEBODY IS TALKING TO YOU (v54) --------------------------------
    // Published for the capybara's gaze, which had a list of things worth
    // looking at that did not include a person mid-sentence: the animal would
    // turn to somebody who had NOTICED it and ignore somebody who was actually
    // speaking. This is a bare read of the owner's position at the moment the
    // line lands, plus a clock, so nothing has to walk the bubble list.
    const og = npcRec && (npcRec.group ? npcRec.group.position
                          : (npcRec.anchor && npcRec.anchor.group ? npcRec.anchor.group.position : null));
    if (og && og.x === og.x) {
      npcSpeak.x = og.x; npcSpeak.y = og.y; npcSpeak.z = og.z;
      npcSpeak.t = slot.life;
      npcSpeak.biome = game.biome ? game.biome.current : '';
    }
    slot.txt.textContent = text;
    // ---- AND MEASURE IT, ONCE, HERE ------------------------------------
    // The size is needed every frame to keep the box on screen, and
    // offsetWidth is a layout read: doing it in the update loop would force
    // a reflow per bubble per frame. It only changes when the text does, and
    // this is the one place the text changes. The element has to be
    // displayed for the read to be honest — a display:none box measures 0 —
    // so a slot that has not been shown yet is measured on its first frame
    // instead (bw === 0 falls back to a sane guess there).
    slot.bw = 0; slot.bh = 0;
    if (slot.shown) { slot.bw = slot.el.offsetWidth; slot.bh = slot.el.offsetHeight; }
    // ---- ...AND YOU CAN HEAR THAT SOMEBODY SAID IT (F2) ------------------
    //
    // Fired HERE, for the same reason `gest` and `npcSpeak` are: this is the
    // one door every line in this file goes through, so the sound cannot get
    // out of step with the words the way a second call beside each of the
    // thirty sites eventually would. Two or three pulses — see sfxBlip — and
    // the count comes from the LENGTH OF THE LINE, so "Do not." is shorter
    // than "I said we should have gone to Bondi."
    //
    // It goes through this file's own `sfx`, which means it is positional (a
    // person across the square is quieter than one beside you), it is cut by
    // the distance law before it can spend a throttle slot, and it carries the
    // speaker's `vpitch` — so the blip and the gasp are recognisably the same
    // person. Below the default level, because a line is punctuation under the
    // bubble rather than an event in its own right.
    sfx('blip', npcRec, 0.26, 1, text.length < 22 ? 2 : 3);
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
  // built once for every local in the game — see buildLocalFigure
  //
  // ---- THE LOCALS GET WHITES TOO (R6) ----------------------------------
  // Same four boxes as the roster's `gEyes` and the same inversion: the pale
  // is the material's own `sail` and the pupil carries the dark multiplier.
  // The material has to change with it — `npcLocMat` builds plain Lambert and
  // a `color` attribute on a material without `vertexColors` is SILENTLY
  // IGNORED, which is the quiet half of this mechanism's failure mode (the
  // loud half is the reverse, which renders black). It is the roster's own
  // material, and it is free: `mat` is cached on colour plus options, so
  // asking for it again hands back the instance the forty-five instanced
  // people are already drawn with. Still one mesh and one call per local.
  const npcLocEyeMat = mat(PALETTE.sail, { vertexColors: true });
  const npcLocEyeGeo = npcMakeGeo([
    { w: 0.078, h: 0.044, d: 0.014, x: -0.058, z: -0.004 },   // the white
    { w: 0.078, h: 0.044, d: 0.014, x: 0.058, z: -0.004 },
    { w: 0.050, h: 0.038, d: 0.018, x: -0.058, c: npcOf(PALETTE.capyEye, PALETTE.sail) },
    { w: 0.050, h: 0.038, d: 0.018, x: 0.058, c: npcOf(PALETTE.capyEye, PALETTE.sail) },
  ]);
  // ---- ...AND THEIR HAT IS A HAT (R6) -----------------------------------
  // It was `npcLocPart(0.42, 0.05, 0.42, ...)`: a 42 cm square PLATE, 5 cm
  // thick, lying on the head. The roster has had a brim and a crown since it
  // was built and the locals staff fifteen chapters, so the people the player
  // spends most of the game looking at were the ones wearing a paving slab.
  //
  // ONE MERGED GEOMETRY, so it is still the one draw call the plate was. The
  // colour attribute npcMakeGeo writes is ignored here (npcLocMat has no
  // vertexColors) and that is fine: a local's hat is one colour, and the
  // attribute costs three floats a vertex on a buffer built once for the
  // whole game.
  const npcLocHatGeo = npcMakeGeo([
    { k: 'cyl', rt: 0.30, rb: 0.30, h: 0.030, seg: 8 },
    { k: 'cyl', rt: 0.14, rb: 0.17, h: 0.150, seg: 8, y: 0.090 },
  ]);
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
    // ---- THREE BUILDS (v54) ----------------------------------------------
    // A group scale, not a rebuild: the figure's origin is between its feet,
    // so scaling here changes the person and never lifts them off the floor.
    // The spread is deliberately smaller than the roster's — a local is placed
    // by hand behind a specific counter and a 15 cm change of height would put
    // some of them chin-deep in their own stall.
    const arch = randInt(0, 2);
    const bH = [0.955, 1.0, 1.045][arch] * rand(0.99, 1.01);
    const bGirth = [1.13, 1.0, 0.91][arch] * rand(0.99, 1.01);
    g.scale.set(bGirth, bH, bGirth);
    // ---- LEGS ON HIPS, WHICH THEY WERE NOT (v55) -------------------------
    // These were two boxes added straight to the group: drawn, and welded to
    // the pelvis. The file's own note said so — "no legs are drawn: a local's
    // legs are a merged mesh with no joints in it" — and argued that the bob
    // and the lean sell it at six metres. They do, for somebody STANDING. They
    // do not for somebody crossing two metres of square, and now that the
    // shuffle is three times wider that is a thing you watch them do.
    //
    // A pivot at the hip and the box hanging under it, which is exactly the
    // arms' own construction eight lines down. Same box, same size, same
    // colour, same two draw calls: the figure is identical with the swing at
    // zero, and every chapter's hand-placed pose is untouched.
    const legL = new THREE_.Object3D(); legL.position.set(-0.12, 0.78, 0);
    const legR = new THREE_.Object3D(); legR.position.set(0.12, 0.78, 0);
    legL.add(npcLocPart(0.17, 0.78, 0.19, legs, 0, -0.39, 0));
    legR.add(npcLocPart(0.17, 0.78, 0.19, legs, 0, -0.39, 0));
    g.add(legL); g.add(legR);
    g.add(npcLocPart(0.50, 0.62, 0.28, shirt, 0, 1.09, 0));
    // a collar, so the shirt reads as clothing rather than as a painted block
    g.add(npcLocPart(0.52, 0.07, 0.30, hair, 0, 1.38, 0));
    const headN = new THREE_.Object3D();
    headN.position.set(0, 1.42, 0);
    headN.add(npcLocPart(0.26, 0.30, 0.25, skin, 0, 0.15, 0));
    // 1.5 cm higher than it used to sit, so a brow at full surprise clears
    // the fringe instead of vanishing into it. Still 4.5 cm of overlap with
    // the skull, so there is no gap between hair and head at any angle.
    headN.add(npcLocPart(0.28, 0.10, 0.27, hair, 0, 0.305, -0.01));
    // the nose. One box, 4 cm, and it is the only reason the head has a FRONT
    // - without it a figure turning to watch you is a cube rotating.
    headN.add(npcLocPart(0.05, 0.05, 0.05, skin, 0, 0.15, 0.14));
    if (o.hat) {
      const hat = new THREE_.Mesh(npcLocHatGeo, npcLocMat(o.hat));
      hat.position.set(0, 0.350, 0);
      hat.castShadow = true;
      headN.add(hat);
    }
    // ---- ...AND THE REST OF THE FACE (v54) -------------------------------
    // The nose has been carrying this on its own since the locals were built.
    // Two eyes and two brows on nodes of their own — the boxes hang off the
    // node at the origin so the node's scale is about the eye, not the neck.
    // Head front face is z = +0.125; 4 mm proud so nothing z-fights at range.
    // ONE mesh for the pair, not two. A local is a hand-built Group and every
    // box in it is its own draw call — the roster gets its faces for two calls
    // total because it is instanced, and these do not. Nothing ever winks, so
    // the two eyes are one merged geometry and the count goes 4 -> 3 per
    // person, which across eight locals in a chapter is eight calls saved for
    // no loss at all.
    const eyeN = new THREE_.Object3D();
    eyeN.position.set(0, 0.176, 0.129);
    const eyeM = new THREE_.Mesh(npcLocEyeGeo, npcLocEyeMat);
    eyeM.castShadow = true;
    eyeN.add(eyeM);
    const browL = new THREE_.Object3D();
    const browR = new THREE_.Object3D();
    browL.position.set(-0.062, 0.230, 0.129);
    browR.position.set(0.062, 0.230, 0.129);
    browL.add(npcLocPart(0.080, 0.017, 0.020, hair, 0, 0, 0));
    browR.add(npcLocPart(0.080, 0.017, 0.020, hair, 0, 0, 0));
    headN.add(eyeN); headN.add(browL); headN.add(browR);
    g.add(headN);
    const armL = new THREE_.Object3D(); armL.position.set(-0.30, 1.32, 0);
    const armR = new THREE_.Object3D(); armR.position.set(0.30, 1.32, 0);
    armL.add(npcLocPart(0.13, 0.56, 0.14, shirt, 0, -0.28, 0));
    armR.add(npcLocPart(0.13, 0.56, 0.14, shirt, 0, -0.28, 0));
    armL.add(npcLocPart(0.12, 0.13, 0.13, skin, 0, -0.60, 0));
    armR.add(npcLocPart(0.12, 0.13, 0.13, skin, 0, -0.60, 0));
    g.add(armL); g.add(armR);
    return { group: g, head: headN, armL: armL, armR: armR,
             legL: legL, legR: legR,
             face: { eyeN: eyeN, browL: browL, browR: browR,
                     browY: 0.228, upK: 0.6 },
             arch: arch };
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
    // ---- ...AND ONE FOR SOMETHING ON THE FLOOR (B9) ----------------------
    // Held to the same chapter-neutral standard as the four around it: no
    // season, no country, no building, and — the harder rule here — NOTHING
    // THAT NAMES WHAT WAS SPILT. This pool is said over a burst sack of coffee
    // in Pasto, a cup on a Reykjavík pavement and a handbag emptied across a
    // Venetian quay, so 'that was a full cup' is a line that is wrong two
    // times in three. What is left is what people say about a mess, which is
    // mostly about the floor.
    // ---- B12: SOMEBODY HAS TAKEN THE THING I WORK WITH ------------------
    // Chapter-neutral to the same standard as the rest of this table, and the
    // hard rule here is that it may not name the tool: this pool is said by a
    // tea picker without a basket, a mask painter without a paint pot and a
    // woman who ladles pho without a bowl. What is left is what anybody says
    // when they reach for the thing and it is not there.
    notool:   ['It was just here.', 'Where has that gone?', 'I put it down. Right there.',
               'Well, I cannot do it like this.', 'Has anybody — no. Never mind.',
               'That is the only one I have.'],
    mess:     ['Oh, that is everywhere.', 'Someone will have to do that.',
               'All over the floor.', 'Well. That is that.', 'Straight down.',
               'Look at the state of it.', 'That will stain.'],
    thief:    ['That is not yours.', 'Excuse me?', 'Put that down.', 'Oh, wonderful.',
               'You are just taking that, are you.', 'Right. Yes. Fine.'],
    // ---- ...AND TWO ABOUT SOMEWHERE ELSE (B15) ---------------------------
    //
    // The only pools in this table that break the chapter-neutral rule, and
    // they break it in the one direction that is safe: they name the place you
    // CAME FROM, not the place you are standing in. `{P}` is filled with the
    // previous chapter's name by npcRumArm.
    //
    // IN THE NEUTRAL TABLE RATHER THAN npcPLACE_SAY, which is where item 6
    // asks for them. Per-chapter is the wrong axis: the variable in this line
    // is where you have BEEN, and a `heard` row in all nineteen chapters would
    // be nineteen ways of saying the same sentence — which the note above
    // npcPLACE_SAY has already ruled on once, in its own words: "17 chapters
    // of a pool nobody can tell apart from the neutral one is work that buys
    // nothing." A chapter that wants its own may still author one; the
    // resolver has always allowed it.
    //
    // The incident rule holds: NONE OF THEM NAMES WHAT WAS DONE. The same
    // line is said after a smashed bowl in Kyoto, a flock put up in Iceland
    // and a barrow tipped into a canal, so all any of them can be about is
    // that word travelled.
    heardBad: ['They are still talking about {P}.',
               'We heard what happened in {P}.',
               'Word came up from {P}. About you.',
               'You are the one from {P}, then.',
               'Somebody in {P} has been telling everybody.',
               'They said you had gone to {P}. They were right.'],
    // ...and the other economy's version of it (B8's `pho` and `fed`). A
    // player who was photographed and fed in the last place gets a different
    // sentence, because arriving somewhere that has heard only good things is
    // the half of this the mischief pool cannot say.
    heardGood: ['Somebody in {P} was very taken with you.',
                'You are on a wall in {P}, I hear.',
                'They said you were no trouble at all in {P}. Were you?',
                'Word from {P} is that you are all right.',
                'They fed you in {P}, did they.'],
    // ---- ...AND THE ONE THAT IS NOT ABOUT A PLACE AT ALL -----------------
    // THE TWO POOLS ABOVE ARE ABOUT WHERE YOU HAVE BEEN. These are about WHO
    // YOU ARE, and that is the difference between B15's gossip and item 6's
    // last unbuilt half: `heardBad` names the chapter you have just left,
    // needs one incident there and says nothing about the other seventeen.
    // NOTORIETY is the journey-wide number — incidents, scenes, how many
    // places have heard of you, and how many different words they had for it
    // — and it has been computed, tiered, saved and read by NOTHING except
    // whether a poster goes up.
    //
    // NO {P}, deliberately, and that is the whole reason this is a separate
    // pool rather than a sixth line in `heardBad`. A reputation that has to
    // name a town is a rumour about that town; the point of this one is that
    // it arrived before you did and it is not from anywhere.
    //
    // AND IT MAY NOT NAME WHAT YOU DID, for the reason none of the pools may:
    // the tier is a number over nineteen chapters and the thing behind it
    // could be forty broken bowls or one memorable afternoon in Hong Kong.
    notorious: ['So you are the one.',
                'We had heard you were coming.',
                'Ah. It is you, is it.',
                'They said to look out for you.',
                'You have a reputation, you know.',
                'Word travels faster than you do.'],
    // ...and the same sentence from a place that is genuinely alarmed. Split
    // rather than scaled, because "you have a reputation" and "we have been
    // told what you are" are different sentences and a tier table that only
    // changes an adjective is a tier table nobody notices. Tiers 4 and 5.
    notoriousBig: ['Oh no. Not here. Not today.',
                   'We have been told what you are.',
                   'They warned us. They actually warned us.',
                   'Somebody put the word out about you.',
                   'You are worse than they said, and they said a lot.',
                   'I know exactly what you are.'],
    // ---- ...AND THE THING IN ITS MOUTH THAT IS NOT FROM HERE -------------
    // THE ONLY OBJECT IN THE GAME THAT GENUINELY TRAVELS, and until now
    // nothing anywhere reacted to one arriving. props.js is explicit about
    // both halves of that: `physOnBiomeEnter` confiscates a held prop at the
    // border because its body leaves the world with its home biome — "Customs
    // are strict" — and a KEEPSAKE is the single exception, carrying
    // `biome: ''` so that it crosses with the animal. Nineteen of them, one
    // per place, and every one of them has been able to cross since the day it
    // was built.
    //
    // `{O}` is the object's own name off its prop def — 'a chewed tea whisk',
    // 'a piece of the glacier', 'a cracked plastic stool' — so this pool is
    // nineteen jokes written once. NOT a per-place pool: nineteen origins
    // against nineteen destinations is three hundred and sixty-one lines to
    // author and the same argument npcPLACE_SAY already settled applies with
    // more force here.
    //
    // The lines may not assume WHICH object it is, for the reason the incident
    // pool may not assume what was done — {O} is a hat in one chapter and a
    // plank off Scott's hut in another, and a line that works for both is a
    // line about somebody carrying something that does not belong.
    keepsake: ['Where did you get {O}?',
               'That is {O}. That is not from round here.',
               'You did not find {O} here.',
               'Is that {O}? Carried all this way?',
               'Somebody is missing {O}, I should think.',
               'You have brought {O} with you. All right then.',
               'I have never seen {O} in this town before.'],
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
    // ---- ...AND ONE FOR THE THIRD THING IN A ROW (v37) -------------------
    // Spoken when `capy:incident` lands — three things somebody actually saw,
    // in one place, inside twelve seconds. See THE INCIDENT in systems.js.
    //
    // Held to the same chapter-neutral standard as everything above it, and
    // one rule further: NONE OF THEM MAY NAME WHAT WAS DONE. This pool is
    // spoken over a knocked-over crate, a stolen hat, a shattered bowl and a
    // bicycle in a canal, in any order, so the only thing every line here can
    // be about is the PATTERN — that it has happened three times and that
    // people have stopped assuming it is an accident.
    incident: ['That is three.', 'Right. That is not an accident.',
               'Somebody is keeping count.', 'Again? Again.',
               'It is doing it on purpose.', 'Is anybody going to stop it?',
               'I have been watching this the whole time.'],
  };
  // =======================================================================
  // WHERE THEY ARE (P6)
  //
  // Every pool above is written to a stated rule, repeated four times in its
  // own comments: no season, no country, no building, nothing that assumes
  // what you did. That rule is correct AND it is the reason a person in
  // Venice, a person in Mong Kok and a person on an Antarctic jetty all say
  // 'You again.' in the same words — seventeen chapters of local colour and
  // the two lines a person says ABOUT YOU were the same everywhere.
  //
  // A per-chapter pool is free to break the rule, because it only ever plays
  // in the chapter it is written for. The neutral pools stay exactly as they
  // are and remain the fallback, so a chapter with no row here loses nothing.
  //
  // Two kinds are authored, and they are the two worth it: `wary` — said to
  // somebody who has already had a go at them — and `incident`, said when
  // three things happen in one place inside twelve seconds. Both are ABOUT
  // the animal rather than about an event, which is what makes them the
  // lines a place should say in its own voice. The one rule that survives
  // from the neutral pools is the incident rule: none of these may name what
  // was done, because the same three lines are spoken over a stolen hat, a
  // shattered bowl and a bicycle in a canal.
  //
  // The resolver is general — any kind may be given a chapter row later —
  // and only these two are written, because 17 chapters of a pool nobody can
  // tell apart from the neutral one is work that buys nothing.
  const npcPLACE_SAY = {
    quay: {
      wary:     ['You again, mate.', 'Yeah, I know you.', 'Not on this wharf.'],
      incident: ['That is three off this wharf.', 'Righto. That is a pattern.',
                 'Somebody wants to ring somebody.'],
    },
    kyoto: {
      wary:     ['Ah. You.', 'I remember.', 'Please. Not again.'],
      incident: ['Three times now.', 'Everyone is being very polite about this.',
                 'It is not confused. It has decided.'],
    },
    cali: {
      wary:     ['Otra vez vos.', 'I know you now.', 'Ay, no. Not you.'],
      incident: ['Tres. Three of them.', 'Somebody is going to have to say something.',
                 'That one is enjoying itself.'],
    },
    rio: {
      wary:     ['Ah, e voce.', 'I know that one.', 'Not on my stretch.'],
      incident: ['Tres! Three!', 'It is still going and nobody is stopping it.',
                 'The whole beach saw that.'],
    },
    iceland: {
      wary:     ['You. Again.', 'I know what you are now.', 'Not this time.'],
      incident: ['Three, in one hour.', 'That was deliberate.',
                 'There is nobody else out here to blame.'],
    },
    sahara: {
      wary:     ['You. Again.', 'I have seen you before.', 'Not at this cart.'],
      incident: ['Three times in this square.', 'Everybody saw that.',
                 'It is not lost. It is choosing.'],
    },
    drift: {
      wary:     ['Oh. It is you.', 'I remember you from lower down.', 'Careful. This time.'],
      incident: ['Three. Even up here.', 'Nothing up here is safe from it.',
                 'It has worked out how this place works.'],
    },
    venice: {
      wary:     ['Ancora tu.', 'I know you now, signore.', 'Not in my calle.'],
      incident: ['Three. In one campo.', 'This one is not the water.',
                 'Somebody is going to have to fish that out.'],
    },
    kowloon: {
      wary:     ['You again, ah.', 'I know your face.', 'Not on my street.'],
      incident: ['Three already.', 'Aiyah. Again and again and again.',
                 'Whole street saw that one.'],
    },
    palawan: {
      wary:     ['Ay, ikaw na naman.', 'I know this one.', 'Not the boat. Please.'],
      incident: ['Three, and it is still morning.', 'It is going down the whole beach.',
                 'Somebody watch the bangka.'],
    },
    goreme: {
      wary:     ['Sen yine.', 'I remember you from the valley.', 'Not the ropes again.'],
      incident: ['Three. Before sunrise.', 'Everything it goes near goes over.',
                 'The crews have started watching it.'],
    },
    manly: {
      wary:     ['You again, mate.', 'Yeah, I remember you.', 'Not on my beach.'],
      incident: ['Three. That is three.', 'Righto, that is a habit.',
                 'Half the beach just watched that.'],
    },
    // The Pantanal is the one place that does not mind you, and its whole
    // premise is that nobody looks up. So its wariness is not wariness and
    // its incident lines are people declining to treat it as one. It is the
    // exception, and it only reads as one because the sixteen above it are
    // not exceptions.
    pantanal: {
      wary:     ['Ha. You again.', 'Still here, then.', 'You are no trouble.'],
      incident: ['Third one. Nobody minds.', 'That is just what they do.',
                 'Leave it. It will sort itself out.'],
    },
    cave: {
      wary:     ['You. Again.', 'I heard you coming this time.', 'Stay where I can hear you.'],
      incident: ['Three. Down HERE.', 'Nothing down here is replaceable.',
                 'That echoed for a long time.'],
    },
    antarctic: {
      wary:     ['You. Again.', 'I know that shape now.', 'Not the boat. Not again.'],
      incident: ['Three. On a station of nine people.', 'Nobody is going to believe this.',
                 'I am writing this one down.'],
    },
    monaco: {
      wary:     ['You. Again.', 'I have your face now.', 'Not in here.'],
      incident: ['That is three, sir.', 'Three is when we stop being polite.',
                 'Somebody has been counting since you came in.'],
    },
    hanoi: {
      wary:     ['Lai la ban.', 'I know you now.', 'Not my stool. Not again.'],
      incident: ['Three. In ten minutes.', 'It is not the traffic. It is that.',
                 'Everybody on this corner saw it.'],
    },
  };
  /**
   * WHICH POOL A PERSON DRAWS FROM: theirs, then their chapter's, then the
   * neutral one. Three layers and the general case is the middle one being
   * absent, which is why it is a lookup and not a merge.
   */
  // ---- ...AND FOR TWO KINDS IT IS A MERGE (F2) ---------------------------
  //
  // Giving every chapter its own voice SHRANK its vocabulary, which is the
  // opposite of what P6 was for. `npcPLACE_SAY` authors exactly three `wary`
  // and three `incident` lines per chapter; the neutral pools carry seven of
  // each — and because this resolver is first-hit-wins, those seven became
  // unreachable in all seventeen chapters that have locals. The two chapters
  // that still reach them, Sydney and Pasto, register no locals at all.
  //
  // It matters most for exactly these two kinds. `npcHEAT_SOON` drops the
  // wary bar to 0.14 in a square that is already cross with you, so a player
  // being a menace hears the wary pool more often than any other line in the
  // game — and it was three lines deep.
  //
  // Only wary and incident, and deliberately not the general case: the other
  // six kinds are a chapter SPEAKING FOR ITSELF where it has something better
  // than the neutral line, and replacement is right there. Cached per
  // (chapter, kind) because this is called inside localsReact's loop and a
  // concat per person per bang is garbage on the hot path.
  const npcSAY_MERGE = {};
  /** The two lower layers for a chapter, with the merge rule. See npcSay. */
  function npcSayFor(live, kind) {
    const row = live && npcPLACE_SAY[live];
    const here = row && row[kind];
    if (!here || !here.length) return npcLOC_SAY[kind];
    if (kind !== 'wary' && kind !== 'incident') return here;
    const neutral = npcLOC_SAY[kind];
    if (!neutral || !neutral.length) return here;
    const key = live + '|' + kind;
    // The bag in localLine is keyed on `pool.length + pool[0]`, so a pool that
    // grows from three to ten produces a new signature and refills — which is
    // the behaviour that comment describes and the reason this is safe.
    return npcSAY_MERGE[key] || (npcSAY_MERGE[key] = here.concat(neutral));
  }
  function npcSay(r, kind) {
    const own = r && r.says && r.says[kind];
    if (own && own.length) return own;
    return npcSayFor(game.biome && game.biome.current, kind);
  }
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

  // ---- ...AND THE OTHER HALF OF THAT, WHICH WAS NEVER BUILT --------------
  // The two constants above are the world's ONLY response to a player running,
  // and both of them are a flinch at 3.4 m: belting past somebody makes them
  // jump. Nothing anywhere has ever noticed a player running WELL.
  //
  // systems.js has measured that for four versions — THE FLOW is a streak that
  // accrues over 5.2 s of a held line, survives a hop, and collapses inside
  // 0.3 s when the line breaks — and publishes it as `game.state.flow`. Its
  // four readers are the field of view, the boom, the score and the dust, and
  // its own comment names the rule they obey: none of them is a number on a
  // screen. This is a fifth reader on exactly those terms.
  //
  // IT IS ONE FACTOR ON ONE RADIUS, and the radius already has a factor of
  // this shape on it. `watchR` is the head-turn — how far out somebody's face
  // is pointed at the animal — and v33 widened it with the heat because "heat
  // is what actually widens the circle of faces pointed at the animal". A held
  // line is the same sentence about a different cause: run a clean two hundred
  // metres through a market and the market looks up.
  //
  // AT FLOW ZERO IT IS A MATHEMATICAL NO-OP, which is what makes it safe to
  // switch on across seventeen casts at once — the same property weather.js
  // relies on for its whole micro-state. It cannot start a line, cannot spend
  // a mouth's cooldown and cannot deny anything: `watching` is read by nothing
  // but the direction a head points.
  const npcFLOW_LOOK   = 1.5;    // × the look range at a full line. Just under
                                 // npcHEAT_LOOK's 1.6, because being watched
                                 // for causing trouble should still out-reach
                                 // being watched for moving well.
  // ---- ...AND A WIDER RADIUS ON ITS OWN IS VERY NEARLY A DEAD FEATURE -----
  // MEASURED before this constant existed, and it is the whole reason it does
  // (`qa/nr-look.js`, six chapters, four bearings, eleven seconds each): 708
  // frames at a full line, FIVE of them with anybody watching at all, and NOT
  // ONE watcher beyond the radius they would have had anyway.
  //
  // The cause is geometry and it is obvious in hindsight: HOLDING A LINE MEANS
  // LEAVING. A widened radius only ever catches somebody you are approaching,
  // and at 7.4 m/s the widening buys about one extra second per person before
  // you are past them — while the half of the streak that is actually full is
  // spent in ground the animal has already cleared of people. The one clean
  // reading in the whole first sweep came from a leg that ran BACK into the
  // cast it had just left: Venice, 117 full-flow frames, a watcher in every
  // one of them, the furthest at 1.353 × their own radius.
  //
  // So the look has to OUTLIVE the pass. Somebody who was inside the widened
  // circle while the animal was moving well goes on facing it for a moment
  // after it has gone — which is not a workaround, it is the thing the feature
  // was always a description of. A market does not look up at a runner while
  // they are still coming; it turns as they go past and watches them out of
  // sight, and that is the same two numbers.
  //
  // IT IS STILL A HEAD DIRECTION AND NOTHING ELSE. `watching` is read by no
  // other consumer, the hold spends no mouth cooldown, arms no line, and at
  // flow below npcFLOW_SEE it never starts.
  // ---- ...AND A THIRD CAUSE FOR THE SAME RADIUS: THEY KNEW YOU WERE COMING
  // Item 6's last half. `notoTier()` in systems.js is the journey-wide number
  // — incidents, scenes, how many places have heard of you, how many different
  // words they had — and until now the ONLY thing in the game that read it was
  // whether a WANTED poster went up.
  //
  // A tier is not a thing that can be said in nineteen different ways, so what
  // it buys here is the two things a place does when it has been warned: it
  // says so once (see the `notorious` pools) and it WATCHES THE DOOR. The
  // second is this: for a while after you land, everybody has their eye on you
  // from further out than they otherwise would.
  //
  // IT IS THE SAME FACTOR SHAPE AS THE OTHER TWO and multiplies with them,
  // which is correct — a legend running well through a square that is already
  // cross with them should be the most-looked-at thing in the game — but it is
  // the smallest of the three on purpose. Three factors at once is 1.6 × 1.5 ×
  // 1.4 = 3.4 × a 7 m base, and 47 m is as far as this ever goes.
  //
  // IT IS NOT `wary` AND MUST NOT BE. Wariness means THIS person has had
  // something done to them by you and its pool says so — 'You again', 'Not
  // this time'. A stranger in a chapter you have never visited saying "you
  // again" because of something you did in Hong Kong is the api-key mismatch
  // in dialogue form. This widens attention and nothing else.
  const npcNOTO_TIER   = 3;      // 'a menace'. Below it a place has heard
                                 // nothing and behaves exactly as it always did.
  const npcNOTO_LOOK   = 1.4;    // × the look range while the door is watched
  const npcNOTO_DOOR   = 25;     // s of it after an arrival. Long enough to
                                 // cover the arrival shot and the first walk
                                 // away from the spawn; short enough that it
                                 // is an arrival and not a permanent state.
  let npcNotoTier = 0;           // handed down by systems.js. See npcNotoSet.
  let npcNotoT = 0;              // s of door-watching left on this arrival

  const npcFLOW_SEE    = 0.60;   // flow that counts as a line worth turning for
  const npcFLOW_HOLD   = 2.6;    // s they go on watching after you have gone.
                                 // npcCHAIN_LOOK's number, because it is the
                                 // same gesture: how long a head stays turned.

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
  // ---- HOW BIG THE SHUFFLE IS, AND WHY IT GOT BIGGER ----------------------
  // It was 0.55 m every 15 s at 0.40 m/s, and the honest description of that is
  // A STATUE. Measured across the seventeen chapters this cast stands in: the
  // MEDIAN local moved 0.000 m in seven seconds of real frames, and only one to
  // three of each chapter's six-to-thirteen people moved more than 30 cm. The
  // gap is jittered to 0.45..2.1 of itself, so most people never even started a
  // shuffle inside a window that long — and a player stands next to somebody
  // for a few seconds, not for half a minute.
  //
  // Three times the radius and roughly twice the frequency puts the duty cycle
  // at about a quarter: a person who has visibly shifted their weight and moved
  // a pace or two while you were looking, which is what standing about looks
  // like. It is still a shuffle and not a walk — a local has no gait and no
  // legs to swing, and pretending otherwise at 0.4 m/s reads as a glide.
  //
  // THE RADIUS IS ONLY SAFE BECAUSE THE TARGET IS NOW TESTED. The old comment
  // above is right that a metre of ground needs no navigation; two and a half
  // does. See npcLocalSpot: every candidate is rejected if it is inside static
  // world geometry, or if the ground there is a step away from the ground under
  // the anchor — which is what keeps somebody placed on a jetty, a plinth or a
  // doorstep on the thing the chapter put them on, since `baseY` is still the
  // authority for their height inside the radius.
  const npcLOC_STEP_R   = 1.70;  // m from the anchor a person may ever drift
  const npcLOC_STEP_V   = 0.45;  // m/s. A shuffle, not a walk.
  const npcLOC_STEP_GAP = 7;     // s between shuffles, jittered hard per person
  const npcLOC_STEP_BOB = 0.020; // m of step bob while actually moving
  // rad of hip swing at full move. The shuffle is 0.45 m/s at 2.36 steps/s, so
  // the stride is about 19 cm and a 0.78 m leg wants asin(0.095/0.78) = 0.12 rad
  // of it. 0.17 is that plus a little, because a leg reads at six metres only
  // if it slightly oversells — and much more than this is a march.
  const npcLOC_SWING    = 0.17;
  const npcLOC_STEP_TRY = 6;     // candidate spots before giving up and staying put
  const npcLOC_STEP_DY  = 0.35;  // m of ground step a shuffle may not cross

  // =========================================================================
  // A PERSON WITH A JOB — `beat` on addLocal.
  // =========================================================================
  // Every one of the hundred and fifty-odd locals in this game is standing
  // perfectly still. They breathe, they shuffle half a metre every fifteen
  // seconds, they turn their head when you go past, they flinch at a bang and
  // they put an umbrella up in the rain — and in between all of that they are
  // doing NOTHING, for ever, in a chapter that has told you exactly what they
  // are there for. The fishmonger has a cleaver. The woman at the pho stall has
  // a ladle. Neither of them has ever moved it.
  //
  // A beat is one small repeated action on a slow, jittered clock: an arm goes
  // up and comes down, or two go up and hold, or a person shifts their weight.
  // Three shapes, and three is enough — everything a person does standing in
  // one place for an hour is one of them with a different sound on it.
  //
  //   work   one arm up and then down through the bottom, hard. A cleaver, a
  //          hammer, a broom, a paddle, a whisk. The sound is at the bottom.
  //   reach  both arms up, a hold, and down. Hanging washing, stacking a
  //          shelf, pegging a net. The sound is at the top, if there is one.
  //   rock   a shift of weight from one foot to the other, and no sound at
  //          all. Waiting, cold, listening, humming.
  //
  // FOUR RULES, and they are the ambient movers' rules with a fourth on top:
  //
  //  1. IT IS OUTRANKED BY EVERYTHING. Talking, flinching, guarding stock,
  //     going to fetch a prop back, holding an umbrella and walking all beat
  //     it, and it does not resume mid-swing — it starts the next one clean.
  //     A person who is startled mid-chop must not go on chopping.
  //  2. IT NEVER SPEAKS AT RANGE. The action always runs; the SOUND is placed
  //     at the person and dies with the distance law like every other sound
  //     they make (see A SOUND A PERSON MAKES).
  //  3. THE CLOCK IS JITTERED PER PERSON AND STRETCHED BY THE CALM. Six people
  //     in a market on a five-second beat is a factory; the jitter is what
  //     makes it a market. The calm stretch is the same one the ambience
  //     ladder takes, for the same reason.
  //  4. ONLY A PERSON THIS MODULE BUILT. The same gate the shuffle and the
  //     umbrella take, and here it is absolute: a chapter that handed over its
  //     own Group may have merged that person into a stall, a boat or a jetty,
  //     and there are no arms on the end of a jetty to raise.
  const npcBEAT_LAM   = 9;      // damping on the arm — fast enough to read as a swing
  const npcBEAT_UP    = 0.42;   // fraction of the action spent going up
  const npcBEAT_ARM   = 1.55;   // rad the working arm reaches at the top
  const npcBEAT_THRU  = 0.40;   // ...and rad past vertical it goes at the bottom
  const npcBEAT_ROCK  = 0.055;  // rad of lean, the whole of what `rock` is
  const npcBEAT_VOL   = 0.20;   // default level, well under a spoken line

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
  // ---- ONE PERSON WHO IS IN FOUR CHAPTERS (P6) -------------------------
  // See THE TRAVELLER. addLocal with the figure fixed: same shirt, same
  // trousers, same hair, same hat, in Circular Quay, Marrakech, Cappadocia
  // and Hanoi. A figure in this game IS its palette — there is no other way
  // to be recognised at six metres — so the palette is written once here
  // instead of four times in four chapter files, where one of the four
  // would eventually drift and the whole point would quietly stop working.
  //
  // Everything else is the chapter's: where they stand, what they say, and
  // which task gates it. They are not a system, they are a person who keeps
  // turning up.
  const npcTRAV_FIG = { shirt: PALETTE.cloth4, legs: PALETTE.khaki,
                        hair: PALETTE.hair2, skin: PALETTE.skin2,
                        hat: PALETTE.sail };
  function addTraveller(o) {
    if (!o) return null;
    o.figure = npcTRAV_FIG;
    // ...and THE REGULARS may not pick them (O1). See npcPalPick: the
    // traveller is the nearest person to the spawn in two of their four
    // chapters, and they are already the character who remembers you.
    o.trav = true;
    if (o.near === undefined) o.near = 8;
    return addLocal(o);
  }

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
      biome: o.biome, group: g, trav: !!o.trav,
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
      // ---- WHAT THIS PERSON IS DOING (D7) ----
      // See A PERSON WITH A JOB. `beat` is the definition the chapter gave;
      // `beatT` counts down to the next one and starts jittered so that two
      // people put down by the same loop never fall into step; `beatP` is 0..1
      // through the action itself and -1 between them.
      beat: o.beat || null, beatT: rand(0.6, 4.5), beatP: -1,
      // the face (see FACES). `mood` is damped here rather than recomputed,
      // because the things that drive it — the flinch spring, the guard, a
      // prop of theirs on the floor — are three separate clocks and a face
      // that switched between them instantly would strobe.
      blinkT: rand(0, npcBLINK_MAX), mood: 0,
      // B7: the photo. `snapT` runs the gesture, `photoCd` is the per-person
      // cooldown (jittered at birth so a square does not photograph you in
      // unison the first time you sit down), `yaw0` is the bearing they turned
      // to, so the flash leaves the right hand and not the middle of them.
      snapT: 0, snapped: false, photoCd: rand(0, npcPHOTO_FIRST), yaw0: 0,
      // ---- B11: A PERSON HAS A BODY (item 4e) ----
      // `stum` is a stagger — a lean and a sideways wobble that decays, on top
      // of the flinch rather than instead of it. `sat` is the seconds left of
      // sitting down hard, and `satCd` is the once-per-person clock the item
      // asks for. Both are on the group's own channels: a local's figure
      // publishes a head and two arms and NO LEGS AND NO TORSO, so a sit is
      // the whole person dropping and leaning back, which at this scale and
      // this camera angle is what a sit looks like anyway.
      stum: 0, stumV: 0, sat: 0, satCd: 0,
      // B12: the tool a beat names. `toolMade` is a once-only latch (the prop
      // is spawned lazily, on the first tick in the live chapter, because a
      // local is registered at build time and props.js may not have a world
      // yet); `toolOut` is recomputed every tick rather than flagged, so a
      // tool kicked into a canal counts exactly like a stolen one; `toolFail`
      // counts empty strokes, which is the only thing about this mechanic
      // that is visible from outside.
      tool: null, toolMade: false, toolOut: false, toolFail: 0, toolSaid: false,
      // B8: the gift. `giftCd` starts at zero — unlike the photo's jitter, this
      // one is already gated behind a quarter-minute of `fam`, and jittering it
      // as well would mean the first person to warm to you is also the one who
      // has to wait longest.
      giftT: 0, gifted: false, giftCd: 0,
      // B8: the pat. Nothing is scored and nothing is saved; it is the one
      // thing in item 3 that pays in the moment and not on the ledger.
      patT: 0, patted: false, patCd: 0,
      // What they say when the world does something to them. All optional; a
      // local that names none of them falls back on npcLOC_SAY, so every
      // person already registered in every chapter gets the whole vocabulary
      // without one biome file being touched.
      says: {
        startled: o.startled || null, splash: o.splash || null,
        thief: o.thief || null, rush: o.rush || null,
        produce: o.produce || null, chain: o.chain || null,
        // ---- ...AND THE TWO HALVES OF A CONVERSATION (F2) ---------------
        // `localsChat` is the most-heard dialogue in the game — every 11 to
        // 28 seconds, in every chapter — and it was the one pool that went
        // straight to `localLine` rather than through `npcSay`, so a
        // gondolier, a Mong Kok cook and an Antarctic scientist all said
        // "Same again tomorrow." out of the same ten shared lines. Routing it
        // through the resolver is the code half; these two keys are what
        // makes the mechanism REACHABLE, so a chapter or a person can be
        // given their own without another edit here. Authoring the rows is
        // on the shelf; nothing declares them today and the shared pool is
        // still the fallback, so this changes no line until one is written.
        chatOpen: o.chatOpen || null, chatBack: o.chatBack || null,
        // B7. Authorable per person and per chapter like every other key here;
        // nothing declares one yet and `npcLOC_PHOTO` is the fallback, so this
        // adds the vocabulary without touching a biome file.
        photo: o.photo || null, gift: o.gift || null, pat: o.pat || null,
      },
      // ---- A VOICE OF THEIR OWN (F2) -------------------------------------
      // Every person in the game gasped at pitch 1.0, so a crowd startling in
      // Venice was the same sound six times 0.12 s apart. Props have had this
      // since v16 — `physVOICE` gives each one a `vpitch` and a `vgain` so a
      // crate and a bin do not sound alike — and people were simply skipped.
      // One number, stamped once, multiplied into every call this file makes
      // through its own `sfx`. The band is deliberately narrower than the
      // props' one: a human voice that ranges more than about a fifth either
      // side stops reading as a person.
      vpitch: rand(0.82, 1.22),
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
      // ...and the thing itself, once they have picked it up (F4). `carryW`
      // is the 0..1 the carrying arm is damped on, the same shape `umb` has.
      carry: null, carryW: 0,
      // ---- HEAT (see the block below the chains) ----
      // `gd` is where their stock is, re-read on `gdT`; `grd` is how far the
      // guard pose has come up. `watching` is not read by anything in here —
      // it is published for the soak, because "is anybody looking" measured off
      // a drawn yaw catches somebody who happens to be pointed the right way.
      gd: null, gdT: 0, grd: 0, watching: 0,
      // ...and how long they go on watching a line that has already gone past
      // (see npcFLOW_HOLD). Declared HERE rather than left to appear on first
      // write, which is the shape that gave `talkCd` to seventeen chapters
      // with nothing anywhere to decrement it.
      flowSeen: 0,
      // ...and THE MARCH's own cooldown, declared here for the same reason:
      // `talkCd` appeared on first write and went seventeen chapters with
      // nothing to decrement it.
      marCool: 0,
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
  function localResolve(arr, rec) {
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
      // ---- B12: THE THIRD CONDITION, and it is about the SPEAKER --------
      // `before` and `after` ask the task table, which is global; `tool`
      // asks whether THIS person's tool is to hand, which is why the record
      // had to be threaded through. 'gone' is a line said while it is
      // missing, 'here' one that only makes sense while it is not. A pool
      // entry that names it on a person with no tool at all resolves to
      // false rather than to true: a line about a missing cleaver in the
      // mouth of somebody who never had one is worse than no line.
      if (e.tool) {
        if (!rec || !rec.beat || !rec.beat.tool) continue;
        if ((e.tool === 'gone') !== !!rec.toolOut) continue;
      }
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
    const pool = localResolve(arr, rec);
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
      localLine(r, famAns ? npcSay(r, 'fam')
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
    // ---- 2a: A HOT SQUARE TURNS ROUND FROM FURTHER AWAY (v33) ------------
    // The same npcHEAT_LOOK stretch the chain takes, on the circle that decides
    // who flinches and who has a line about it. It buys attention and only
    // attention: nobody who was not going to react now denies anything, they
    // were simply out of earshot a moment ago and are not now.
    const r = (radius > 0 ? radius : npcLOC_REACT_R)
              * (1 + npcHeatAt(x, z) * (npcHEAT_LOOK - 1));
    const r2 = r * r;
    const s = clamp(strength === undefined ? 1 : strength, 0, 1);
    // who jumped hardest — see the emit after the loop
    let loud = null, loudK = 0;
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
        // ...and the loudest reaction is remembered so ONE npc:startled can
        // be emitted after the loop. Not here: systems.js answers that event
        // with a gasp, +0.06 chaos and a two-and-a-half second chase window,
        // so emitting per person would make a crate landing beside five
        // people five simultaneous gasps and a third of the chaos bar.
        if (kick > loudK) { loudK = kick; loud = L; }
        // ...and they remember it was you, for about half a minute.
        // ...and the one person in this chapter who has stopped minding (O2).
        // The flinch above and the line below are untouched: they still jump
        // and they still say something. Only the MEMORY is scaled.
        if (mine) L.wary = Math.min(1, (L.wary || 0) + kick * npcPalSoft(L));
      }
      if (said < npcLOC_REACT_N && L.cd <= 0) {
        const arr = npcSay(L, kind);
        if (arr && arr.length) {
          L.cd = L.cool * rand(0.7, 1.3);
          localReactLine(L, arr);
          said++;
        }
      }
    }
    // ---- ...AND THE PLACE REMEMBERS IT, NOT ONLY THE PEOPLE (v33) --------
    // AFTER the loop, and not before it: the loop is what makes the witnesses
    // wary, and npcHeatBump's input is the count of people near here who are
    // now watching for you. Bumped before the loop, the first incident in a
    // square would be worth nothing.
    //
    // `mine` is the same gate the wariness write takes. A chapter announcing
    // its own bang — a crate off a barrow, a gate, a wave — may not make the
    // square cross with the animal that was nowhere near it.
    if (mine) npcHeatBump(x, z, 'react:' + kind);
    // ---- ...AND THE CHAIN ARMS OFF THE LOUDEST, NOT OFF ARRAY ORDER (F2) --
    //
    // `locChainFrom` was set only inside `localReactLine`, which is reached in
    // `locals` order behind a per-person cooldown — so the person the square
    // then turns to look at was the SECOND array-order local with a free
    // mouth, and if every nearby mouth happened to be cooling down, nobody
    // looked at the person who had just jumped out of their skin at all. The
    // loudest reactor has been computed four lines up since v54 and was used
    // for one `npc:startled` and nothing else. D3 asked for exactly this: the
    // loudest hands the look on. The answerer was fixed to `nearest` then; the
    // SOURCE never was.
    //
    // After the loop and after `loud` is final, so it cannot be overwritten by
    // a quieter person later in the array. The chain's own single-answer rule
    // is untouched, so this makes the look land on the right person rather
    // than making more of them.
    if (loud) { locChainFrom = loud; locChainT = npcCHAIN_WIN; }
    // ---- B13: ...AND SOMEBODY GETS THE BLAME FOR IT (item 5c) -----------
    // `mine` and not merely `loud`: a chapter announcing its own bang — a
    // crate off a barrow, a gate, a wave — must not start an argument about
    // an animal that was nowhere near it. Same gate the wariness write takes,
    // for the same reason. See localBlameArm.
    if (mine && loud) localBlameArm(x, z);
    // ---- ...AND THE CAPYBARA HEARS IT (v54) -----------------------------
    // npc:startled was emitted by the Sydney roster and by nothing else, so
    // the ear-turn it drives was a two-chapter feature in a nineteen-chapter
    // game. A local being made to jump is the same event. ONE of them, for
    // the person who jumped hardest, through emit() so the payload has the
    // { npc } shape every other listener already unwraps.
    if (loud) emit('npc:startled', loud);
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

  // =========================================================================
  // THE MARCH — SOMEBODY PUTS DOWN WHAT THEY ARE DOING AND COMES OVER
  //
  // systems.js counts a CHAIN: three witnessed things inside twelve seconds
  // and twenty-two metres is AN INCIDENT, five is A SCENE. It is the only
  // repeatable reward in the game and until now it contained no decision at
  // all — nobody could aim at it, nobody could lose it, and nothing ever
  // asked whether the fifth one was worth going for.
  //
  // This is the cost. `capy:chain` now fires on EVERY rung, and two of them
  // are answered here:
  //
  //   at two    the nearest witness stops what they are doing and looks. Two
  //             numbers, the same `chatT`/`chatYaw` pair the chain-look uses.
  //   at four   one of them comes over. Not a sprint and not a threat — a
  //             purposeful walk, at the retrieval speed, saying retrieval's
  //             own lines. If they reach you the chain is over.
  //
  // ---- IT IS RETRIEVAL WITHOUT THE PROP, AND DELIBERATELY SO --------------
  // Every hard part of this was solved by F4's `own` state and is reused
  // rather than rewritten: the walk target, `localStepBlocked`'s two-way
  // sidestep, npcOWN_V, and — the part that matters — THE LEASH. A local does
  // not leave their pitch. The march is bounded by the same npcOWN_LEASH from
  // the same anchor, so the worst case is somebody fifteen metres from their
  // stall, which is a case the game already has and already draws.
  //
  // ---- AND IT HAS THE CEILINGS THE CATCH-ALL STATE COST US ---------------
  // §THE CATCH-ALL STATE: a steering state with no ceiling is how the waiter
  // went forty seconds without reaching a table. This one cannot outlive the
  // chain that started it (the window is twelve seconds), has a clock of its
  // own, ends the instant the leash is reached, and ends when the chapter
  // changes. ONE MARCHER AT A TIME, ever — a crowd converging on you is a
  // cutscene, and it is also the failure mode where seven people all leave
  // their pitches at once.
  //
  // ---- WHAT BEING CAUGHT COSTS, WHICH IS ALMOST NOTHING ------------------
  // A line, a lunge on the flinch spring, a bump of `wary` on the one person,
  // and the chain closes. The card you already earned at three stays earned
  // and stays on the tally. Nothing is taken, nothing is undone, and the
  // animal cannot be hurt — the stake is the run you were on, and it expires.
  const npcMAR_AT     = 2;     // rung at which the nearest witness looks up
  const npcMAR_GO     = 4;     // ...and at which one of them sets off
  const npcMAR_R      = 18;    // m from the event inside which somebody saw it
  // ---- THE PATIENCE AND THE LEASH HAVE TO AGREE, AND AT FIRST THEY DID NOT
  // Seven seconds was chosen as "shorter than retrieval's ten, because they
  // are coming to have a word rather than to get their hat back", and it is
  // the wrong KIND of number: at npcOWN_V it buys 8.75 m of walking, while the
  // radius that lets somebody set off at all is eighteen and the leash that
  // stops them is fifteen. So anybody who set off from more than nine metres
  // could never arrive however still you stood — measured, and it is exactly
  // what the first clean run of `qa/nr-march.js` showed: a marcher closing at
  // a textbook 1.25 m/s from 12.98 m, giving up at 4.25 with nothing wrong.
  //
  // Twelve seconds is 15 m at npcOWN_V, which is npcOWN_LEASH to the metre.
  // The two ceilings now expire at the same distance and neither is silently
  // the real one. It is LONGER than the chain's own twelve-second window on
  // purpose: somebody who set off is allowed to finish the walk even if the
  // chain has closed behind them, and being reached with no chain open costs
  // nothing at all — systems.js returns on the first line.
  const npcMAR_OUT_T  = 12.0;  // s of walking before they think better of it
  const npcMAR_TAKE   = 1.7;   // m at which they have reached you. Just outside
                               // npcOWN_TAKE, because there is no object here
                               // to be within arm's length of.
  const npcMAR_COOL   = 18;    // s before the same person will set off again
  const npcMAR_SAY_T  = 2.6;   // s between the things they say on the way
  const npcMAR_WARY   = 0.5;   // what reaching you does to their opinion of you
  const npcLOC_MARCH = ['Right. That is enough of that.',
                        'Come here a moment.',
                        'I saw that. I saw all of it.',
                        'You and I are going to have a word.',
                        'That is the third thing.',
                        'No. No, no, no.'];
  const npcLOC_MARCH_END = ['There you are.',
                            'Right. Settle down.',
                            'That will do.',
                            'I have got you.',
                            'Enough now.'];
  const npcLOC_MARCH_GAVE = ['...I have not got the legs for this.',
                             'Go on, then. Go on.',
                             'It is not worth it.',
                             'Somebody else can deal with that.'];
  let marWho = null;           // the one marcher, or null. ONE, ever.
  let marT = 0;                // s spent marching
  let marSayT = 0;             // s until the next thing they say
  let marWhy = '';             // the last decision the rung handler made
  let marBlocked = 0;          // frames of this march with the direct line shut

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
  // ...AND A POOL FOR THE END OF ONE, which retrieval did not have. Hitting the
  // npcOWN_OUT_T ceiling used to draw from npcLOC_SAY.rush — 'Whoa!', 'Mind
  // out!', 'Somebody is in a hurry.' — which is a BYSTANDER watching the animal
  // go past, spoken by somebody who has just spent ten seconds chasing it and
  // is walking back to their stall empty-handed. Every other give-up beat in
  // the game has its own pool (Pasto's paWheeze and paScold, Sydney's giveUp);
  // this is the chapter-neutral one, because it runs in seventeen of them.
  const npcLOC_GIVEUP = ['Keep it, then.', 'It is not worth it.', 'Fine. Have it.',
                         'I am not chasing you round the square.',
                         'That is that, then.', 'Go on, then.'];
  let locChainFrom = null, locChainT = 0;

  // =======================================================================
  // ...AND NEITHER `wary` NOR `fam` IS ABOUT THE PLACE (v33).
  //
  // Both of them are a memory held by ONE PERSON. Above them there is nothing
  // at all: measured 26 Aug, one wheek moves `state.chaos` 0 → 0.21 and it is
  // back to 0.07 in 8.7 s, and the only two readers of chaos in the repo are a
  // music-layer gain and the calm counter. So a square you have been
  // tormenting for four minutes is exactly as easy to walk into as one you
  // have never visited, and that is why hour six plays like hour one: the list
  // gets shorter and the world never changes its mind.
  //
  // The genre this is styled after runs on one loop — approach, get seen, be
  // driven off, come back another way. The first half is built here and built
  // well (npcHeat, the witness chain, the wary lines, the 26-second memory).
  // HEAT is the second half, and it is an ACCUMULATOR SITTING ON TOP of the
  // wariness that already exists rather than a replacement for it. Its input
  // is `npcHeat(x, z, r)`, which already answers "how many people near here
  // are watching FOR you". Nothing new is measured.
  //
  // WHAT IT BUYS IS ATTENTION AND NOTHING ELSE, exactly like `wary` — more
  // heads turning, turning further out, sooner, in a higher register, and a
  // stallholder standing in front of their own stock. Nothing is denied,
  // nothing is lost and no task is made harder; the differential in
  // qa/b7-tasks.js exists to prove that rather than to assert it.
  //
  // ---- A FIELD, NOT ONE NUMBER, AND THE DIAMETERS SAY SO ------------------
  // A single number per chapter would mean robbing the market makes the far
  // side of the plaza harder. The people-span of all nineteen was measured for
  // this decision (qa/b7-diam.js, chapter list derived from CHAPTERS):
  //
  //   Palawan 90 · Kowloon 93 · Venice 110 · Sydney 112 · Pasto 117 · Hanoi 148
  //   Manly 161 · Rio 169 · Göreme 172 · Sơn Đoòng 193 · Cali 203 · Antarctica 237
  //   the Drift 241 · Monte Carlo 302 · Marrakech 308 · Iceland 310 · Kyoto 348
  //   ...and THE QUAY at 638.
  //
  // The median is 169 m and only two chapters are under a hundred. One number
  // is a lie in seventeen of the nineteen, so heat is a FIELD: at most
  // npcHEAT_SITES points, each with a strength and a decay, and a linear
  // falloff around each.
  //
  // ---- AND THE RADIUS AND THE RANGE ARE DERIVED FROM EACH OTHER -----------
  // Trap 3 of this batch: the finale's gather chose a ceiling and a radius
  // separately and put four of five people out of reach. So neither of these
  // two numbers is chosen on its own.
  //
  //   FLOOR    a site may not be smaller than the crowd that made it, and it
  //            may not be smaller than the range that crowd will look at when
  //            it is hot — or a witness stands outside the heat its own
  //            witnessing created. That is npcCHAIN_R (20 m, measured: the
  //            distance at which one person in a square hears another) times
  //            the largest range multiplier heat can buy. 20 × 1.6 = 32.
  //   CEILING  half the smallest chapter's people-span, or the field collapses
  //            back into the single number it exists to avoid. Palawan is
  //            90 m across, so 45.
  //
  // 32 sits on the floor and clears the ceiling, and if npcHEAT_LOOK ever
  // moves, the radius moves with it.
  const npcHEAT_LOOK  = 1.6;   // × the look range at full heat — SETS the radius
  const npcHEAT_R     = npcCHAIN_R * npcHEAT_LOOK;      // 32 m. Derived. See above.
  const npcHEAT_MERGE = npcHEAT_R * 0.5;                // two incidents this close are one place
  const npcHEAT_SITES = 6;     // …and this many places may be hot at once
  // HOW LONG A PLACE STAYS CROSS. Linear, like `wary`, and for the same reason:
  // a memory that fades exponentially never quite goes. 90 s is 3.5× the
  // 26-second personal clock, which is the entire point — the individuals have
  // forgotten and the square has not.
  const npcHEAT_T     = 90;
  // WHAT ONE INCIDENT IS WORTH, and the first cut of this got it wrong in a
  // way that only showed up outside Sydney. It was `STEP × clamp(w/SAT, .34, 1)`
  // — proportional to the witness count with a floor — and it means one witness
  // is worth 0.116, which against a 90-second linear decay is GONE IN TEN
  // SECONDS. Measured: Hong Kong and Cappadocia rose to 0.11 and 0.22 and were
  // back at zero before the next approach, three robberies running.
  //
  // One witness is not a third of an incident. It is an incident, seen. So the
  // step is mostly flat and the witness count is the top four tenths of it:
  // w=1 → 0.24, w=2 → 0.32, w≥3 → 0.40. That matters because the chapters
  // where this was dead are the ones with six to ten people spread over a
  // hundred and fifty metres, and one or two witnesses is the NORMAL case
  // there rather than the poor one.
  // ---- AND AN INCIDENT IS NOT A FRAME (v33) ------------------------------
  // Measured under real keys, from a cleared save, in Sydney: four seconds of
  // walking about and ONE WHEEK took the field from 0 to 1 and pinned it
  // there, with twenty-six bumps logged. The reason is that the witness chain
  // arms on every startle and a wheek in a thirty-eight-person park startles
  // most of it, so the accumulator counted one event thirty-eight times.
  //
  // A place may only be bumped once every npcHEAT_GAP seconds. Ten people
  // turning round at once is ONE thing that happened, and the escalation this
  // batch exists to build has no headroom at all in the chapter where the
  // player spends their first hour unless that is true. It is per SITE and not
  // global: robbing two ends of a market inside four seconds is two incidents.
  const npcHEAT_GAP   = 4.0;
  const npcHEAT_STEP  = 0.40;  // …at full witness. Three robberies saturate.
  const npcHEAT_BASE  = 0.60;  // …and the fraction of it one witness alone is worth
  const npcHEAT_SAT   = 3;     // witnesses at which one incident is worth the full step
  // …and what heat is allowed to change, all of it attention:
  const npcHEAT_SOON  = 0.60;  // how far it lowers the bar to the wary register (2e)
  const npcHEAT_AGAIN = 0.45;  // how far it shortens the notice cooldown (2a)
  const npcHEAT_GUARD = 0.30;  // heat below this and nobody bothers standing up (2b)
  const npcHEAT_GD_R  = 1.60;  // m of stock a guard may NEVER stand inside. See below.
  const npcHEAT_GD_ARM = 0.55; // rad the arms come forward over the stock (2c)
  const npcHEAT_GD_T  = 5.0;   // s between re-reads of where somebody's stock is

  // The sites. `biome` is not optional: every chapter shares one coordinate
  // space, so an ungated field would make Marrakech hot because Sydney was.
  const npcHeatSites = [];
  // THE DIFFERENTIAL LEVER, and it is a test hook rather than a feature.
  // "Zero tasks made harder" is only provable by running the same task sweep
  // twice with nothing else different, so `game.forceHeat(1)` and
  // `game.forceHeat(0)` pin the field and `game.forceHeat(-1)` releases it.
  let npcHeatForce = -1;

  /**
   * A place cools in REAL time, not in chapter time — you cannot wait somewhere
   * else and come back to a square that is exactly as you left it. Called once
   * at the top of update(), above the biome gate, for that reason.
   */
  function npcHeatDecay(dt) {
    for (let i = npcHeatSites.length - 1; i >= 0; i--) {
      const s = npcHeatSites[i];
      if (s.t > 0) s.t -= dt;      // the incident gap. See npcHEAT_GAP.
      s.h -= dt / npcHEAT_T;
      if (s.h <= 0) npcHeatSites.splice(i, 1);
    }
  }

  /**
   * SOMEBODY SAW THAT. Raises the field at (x, z) by an amount derived from the
   * existing witness count — mischief nobody saw is worth exactly nothing,
   * which is what keeps the finds (the one place in this game with teeth, and
   * the place `not-a-soul` and `most-wanted` live) precisely as they were.
   */
  function npcHeatBump(x, z, src) {
    const live = game.biome && game.biome.current;
    if (!live) return 0;
    const w = npcHeat(x, z, npcHEAT_R);
    // NAMED, NOT JUST COUNTED. A soak that reports "the field went up" cannot
    // say which of the four paths did it, and the first cut of qa/b7-heat.js
    // reported a field saturating in Sydney and dead flat in four other
    // chapters with no way to tell whether that was the chapter, the event or
    // the probe. The tally is two object writes on an event, not per frame.
    try {
      const t = game.state.heatLog || (game.state.heatLog = {});
      const k = (src || '?') + (w > 0 ? '' : ':unseen');
      t[k] = (t[k] || 0) + 1;
    } catch (e) { /* optional */ }
    if (w <= 0) return 0;
    const add = npcHEAT_STEP * (npcHEAT_BASE + (1 - npcHEAT_BASE) *
                clamp((w - 1) / (npcHEAT_SAT - 1), 0, 1));
    let best = null, bestD = npcHEAT_MERGE * npcHEAT_MERGE, weak = null;
    for (let i = 0; i < npcHeatSites.length; i++) {
      const s = npcHeatSites[i];
      if (!weak || s.h < weak.h) weak = s;
      if (s.biome !== live) continue;
      const dx = s.x - x, dz = s.z - z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestD) { bestD = d2; best = s; }
    }
    if (best) {
      // …once every npcHEAT_GAP. The tally above still records the call, so a
      // suppressed bump is visible in the log rather than silent.
      if (best.t > 0) return 0;
      best.t = npcHEAT_GAP;
      // The site follows the trouble, weighted by what the new incident is
      // worth — otherwise a stall robbed three times keeps a hot spot at the
      // place the FIRST robbery happened and drifts away from itself.
      const f = add / (best.h + add);
      best.x += (x - best.x) * f;
      best.z += (z - best.z) * f;
      best.h = Math.min(1, best.h + add);
    } else if (npcHeatSites.length < npcHEAT_SITES) {
      npcHeatSites.push({ biome: live, x: x, z: z, h: Math.min(1, add), t: npcHEAT_GAP });
    } else if (weak && weak.h < add) {
      // Full, and nothing near. The weakest place in the world gives way, and
      // only to something hotter than it — never the other way round, or a
      // single bang in a new corner erases four minutes of a market.
      weak.biome = live; weak.x = x; weak.z = z; weak.h = Math.min(1, add); weak.t = npcHEAT_GAP;
    }
    return add;
  }

  /**
   * HOW HOT IS IT HERE, 0..1. Summed and clamped rather than maxed: two
   * incidents a stall apart make one hot place, which is what they are.
   */
  function npcHeatAt(x, z) {
    if (npcHeatForce >= 0) return npcHeatForce;
    const live = game.biome && game.biome.current;
    if (!live) return 0;
    let h = 0;
    for (let i = 0; i < npcHeatSites.length; i++) {
      const s = npcHeatSites[i];
      if (s.biome !== live) continue;
      const dx = s.x - x, dz = s.z - z;
      const d2 = dx * dx + dz * dz;
      if (d2 >= npcHEAT_R * npcHEAT_R) continue;
      h += s.h * (1 - Math.sqrt(d2) / npcHEAT_R);
    }
    return h > 1 ? 1 : h;
  }

  /**
   * WHERE SOMEBODY'S STOCK IS, as one point, re-read every npcHEAT_GD_T seconds
   * rather than every frame — the answer only moves when a chapter rebuilds.
   * Null when they own nothing, which is most people in most chapters.
   */
  function npcGuardSpot(r) {
    if (r.gdT > 0) return r.gd;
    r.gdT = npcHEAT_GD_T * rand(0.8, 1.4);
    const arr = game.props;
    r.gd = null;
    if (!arr) return null;
    const live = game.biome && game.biome.current;
    let sx = 0, sz = 0, n = 0, near = 1e9;
    for (let i = 0; i < arr.length; i++) {
      const p = arr[i];
      if (!p || (p.biome && p.biome !== live)) continue;
      if (typeof p.homeX !== 'number' || !isFinite(p.homeX)) continue;
      const dx = p.homeX - r.ax, dz = p.homeZ - r.az;
      const d2 = dx * dx + dz * dz;
      if (d2 > npcOWN_R * npcOWN_R) continue;
      sx += p.homeX; sz += p.homeZ; n++;
      if (d2 < near) near = d2;
    }
    if (!n) return null;
    r.gd = { x: sx / n, z: sz / n, near: Math.sqrt(near) };
    return r.gd;
  }

  /**
   * 2b — A STALLHOLDER STANDS IN FRONT OF THEIR OWN STALL.
   *
   * The shuffle is the honest amount of movement a fixed point has, and this
   * points it instead of randomising it. It is inside the SAME npcLOC_STEP_R
   * envelope, so a person still cannot leave the square metre the chapter put
   * them on and still cannot walk into anything that was not already touching
   * them.
   *
   * AND IT KEEPS ITS DISTANCE FROM THE STOCK. A local carries a static body,
   * so a bias that walked somebody onto their own crates would be a collider
   * placed between the player and a thing the player may have to pick up —
   * which is the one thing this whole batch may not do. npcHEAT_GD_R is the
   * skirt: the guard steps out toward their stall and stops well short of it,
   * and if their anchor is already inside the skirt they do not move at all.
   */
  function npcHeatGuard(r, h) {
    if (h < npcHEAT_GUARD) return;
    const gd = npcGuardSpot(r);
    if (!gd) return;
    const dx = gd.x - r.ax, dz = gd.z - r.az;
    const d = Math.sqrt(dx * dx + dz * dz);
    // Already at their stall, or the nearest crate is inside the skirt: there
    // is nowhere to step to that is not on top of the stock.
    if (d < npcHEAT_GD_R + npcLOC_STEP_R || gd.near < npcHEAT_GD_R) return;
    const step = npcLOC_STEP_R * h;
    const tx = r.ax + dx / d * step, tz = r.az + dz / d * step;
    if (navBlocked(tx, tz, npcSEP_PROBE)) return;
    // ---- AND THE SKIRT IS ROUND EVERY PROP, NOT ROUND THEIR OWN ----------
    // Measured, and it is why this test is here rather than only on the
    // centroid: keeping clear of your OWN stock says nothing about the crate
    // that happens to lie along the step. With the centroid test alone, the
    // nearest prop-home-to-person distance fell in eleven chapters of
    // nineteen — Kyoto 2.80 → 1.74, Cappadocia 2.00 → 1.48, Hanoi 1.40 → 1.08,
    // Antarctica 0.50 → 0.33 — which is a static collider systematically
    // closing on things the player has to pick up. Small, and exactly the
    // wrong direction.
    const arr = game.props;
    if (arr) {
      const liveB = game.biome && game.biome.current;
      for (let i = 0; i < arr.length; i++) {
        const p = arr[i];
        if (!p || (p.biome && p.biome !== liveB)) continue;
        if (typeof p.homeX !== 'number' || !isFinite(p.homeX)) continue;
        const px = p.homeX - tx, pz = p.homeZ - tz;
        if (px * px + pz * pz < npcHEAT_GD_R * npcHEAT_GD_R) return;
      }
    }
    r.tx = tx; r.tz = tz;
  }

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

  /**
   * WHERE A STANDING PERSON SHUFFLES TO NEXT.
   *
   * At the old 0.55 m this was two lines of trigonometry and it did not need to
   * be anything else: half a metre of ground is level and clear by definition,
   * because the chapter put somebody on it. At 1.7 m it is not, so a candidate
   * has to be checked before it is committed to.
   *
   * TWO REJECTIONS, AND THEY ARE DIFFERENT PROBLEMS:
   *
   *   navBlocked   static world geometry. A local has no avoidance of any kind,
   *                so an untested target walks them into a wall and leaves them
   *                standing inside it until the next shuffle.
   *   the step     ground more than npcLOC_STEP_DY from the ground under the
   *                anchor. Height inside the radius is still `baseY` — the
   *                number the chapter measured — so somebody on a jetty, a
   *                plinth or a doorstep who wanders off the edge of it does not
   *                fall, they FLOAT, which is worse. Comparing the terrain at
   *                the candidate against the terrain at the anchor keeps them on
   *                whatever they were standing on without having to know what it
   *                is.
   *
   * Six tries and then they stay where they are, which is the old behaviour and
   * the right failure: a person in a doorway is meant to stay in the doorway.
   */
  function npcLocalSpot(r) {
    const g0 = localGroundY(r.ax, r.az);
    for (let k = 0; k < npcLOC_STEP_TRY; k++) {
      const a = rand(0, 6.283185), rr = npcLOC_STEP_R * Math.sqrt(Math.random());
      const tx = r.ax + Math.sin(a) * rr, tz = r.az + Math.cos(a) * rr;
      if (localNavBlocked(tx, tz, 0.34)) continue;
      if (g0 === g0) {
        const g1 = localGroundY(tx, tz);
        if (g1 === g1 && Math.abs(g1 - g0) > npcLOC_STEP_DY) continue;
      }
      r.tx = tx; r.tz = tz;
      return;
    }
    // ---- AND THE FALLBACK IS THE OLD BEHAVIOUR, NOT STANDING STILL ---------
    // Six rejections means a cramped spot — a doorway, a ledge, a stall you
    // were placed against — and the honest answer there is the shuffle this
    // cast had before, which needs no test at all: half a metre of ground that
    // a chapter chose to stand somebody on is clear by construction.
    //
    // Without this, Son Doong went from three movers to NONE: rough ground
    // rejected every candidate on the step test and everybody froze, which is
    // a fix that made the thing it was fixing worse in one chapter.
    for (let k = 0; k < 3; k++) {
      const a = rand(0, 6.283185), rr = 0.5 * Math.sqrt(Math.random());
      const tx = r.ax + Math.sin(a) * rr, tz = r.az + Math.cos(a) * rr;
      if (localNavBlocked(tx, tz, 0.30)) continue;
      r.tx = tx; r.tz = tz;
      return;
    }
    r.tx = r.ax; r.tz = r.az;
  }

  /**
   * navBlocked FOR THE CHAPTER YOU ARE ACTUALLY IN.
   *
   * The module's own `navBlocked` reads `game.env.navBlocked`, and env is the
   * ENVIRONMENT module — envNavBlocked tests envNavC and envNavR, which are
   * SYDNEY'S nav circles and rectangles and nothing else. Asked from any other
   * chapter it answers a question about a city that is not there, and since the
   * chapters overlap the same coordinate range the answer is not even reliably
   * "no": the first cut of the shuffle used it and Son Doong's people froze
   * against Sydney's buildings.
   *
   * Thirteen chapters publish their own `navBlocked`; this reaches the live
   * one, exactly the way localGroundY reaches the live terrainHeight, and
   * returns false where a chapter has none rather than guessing.
   */
  function localNavBlocked(x, z, r) {
    const live = game.biome && game.biome.current;
    const api = live === 'sydney' ? game.env : game[live];
    if (!api || typeof api.navBlocked !== 'function') return false;
    try { return !!api.navBlocked(x, z, r); } catch (e) { return false; }
  }

  /** A reaction line, which also arms the chain. Greetings do not. */
  function localReactLine(rec, arr) {
    localLine(rec, arr);
    locChainFrom = rec; locChainT = npcCHAIN_WIN;
  }

  // ---- THE CHAIN, FOR THE TWO CHAPTERS THAT HAVE NO `locals` (v30) --------
  //
  // Batch 1 reported "13 of 15 locals chapters carry two of the three chains",
  // which was true and hid this: SYDNEY AND PASTO ARE NOT LOCALS CHAPTERS AT
  // ALL. They are the two oldest, they predate addLocal, and their casts are
  // this module's own `humans` and `paCast`. So every gate in the reaction
  // layer — `localOwnerOf` scanning `locals`, and `localsStep` opening with
  // `if (!locals.length) return` — is closed in exactly the first two hours of
  // the game. Batch 2 measured it and called it finding A: the opening of this
  // game is the stretch with the least reactive world in it.
  //
  // This is the WITNESS chain, which is the one that matters most and the one
  // that ports cleanly. The other two do not port for real reasons and are
  // recorded rather than faked: ownership needs a steering state with a hard
  // ceiling on a cast that already has fourteen of its own, and produce needs
  // an edible in the chapter (Pasto has thirteen; Sydney's seven are already
  // served by its own duplicate at npcSydneyProduce).
  //
  // It works because BOTH casts come out of the same `buildHuman`, so a Pasto
  // farmer and a Sydney commuter are the same record shape: `lookX`/`lookZ` to
  // turn a head, `speak()` for a bubble, `talkCd` so nobody is interrupted.
  // Nothing new is built and nobody's state machine is touched — a witness
  // LOOKS and at most one of them says something, which is most of what sells
  // a square noticing you.
  const npcWIT_LOOK = 2.6;      // s a witness goes on facing what it heard
  // The states in which one of the two old casts has its head ON the animal —
  // Sydney's on the left, Pasto's on the right. Published only; see the note
  // in npcWitnessHold. `chase` and `flee` are deliberately absent.
  const npcWATCH_ST = { lookAt: 1, shoo: 1, startled: 1, cornered: 1,
                        gawp: 1, point: 1, scold: 1, scandal: 1 };
  // One pool per chapter, because these two chapters HAVE voices — every other
  // line in Pasto is in its own register and a witness answering in Sydney's
  // would be the only flat sentence in the plaza.
  const npcWIT_CHAIN = ['What?', 'What was that?', 'Did you see that?', 'Hm?',
                        'What is going on over there?', 'Oh, what now.',
                        'Something is happening.', 'Everybody all right?'];
  // ...and the same for a chain of three. One pool per chapter for the reason
  // the two above have one: these two places have voices, and a Sydneysider
  // saying a line written for a plaza in Nariño is the only flat sentence in
  // either of them. See npcOnIncident.
  const npcINC_SYD = ['Right. That is three.', 'That’s not an accident, that.',
                      'Someone’s counting, mate.', 'Again?! It did it AGAIN.',
                      'I’ve been watching this the whole time.',
                      'Is anyone going to do something?'];
  const npcINC_PA  = ['Eso es tres. Three.', 'That is not an accident, hombre.',
                      '¿Otra vez? ¡Otra vez!', 'Somebody is counting, chigüiro.',
                      'I have watched every one of them.',
                      '¿Y nadie hace nada?'];
  const npcWIT_CHAIN_PA = ['¿Qué pasó?', 'What was that, pues?', 'Ay, what now.',
                           '¿Otra vez?', 'Somebody look at that.',
                           'That animal again.', 'What is he doing now?'];
  /**
   * HOLD THE LOOK. Called at the end of each cast's step, after every state
   * has had its say, so the head stays turned for npcWIT_LOOK seconds while
   * the person carries on doing whatever they were doing. A witness that keeps
   * walking and keeps its head turned is the whole picture; one that snaps
   * back on the next frame is nothing.
   *
   * Deliberately NOT a state. A state would need a ceiling, an exit and a
   * think-cursor slot, and it would stop the person queueing or sweeping — the
   * catch-all-state rule says a steering state without a ceiling is how the
   * waiter went forty seconds and never reached a table, and the cheapest way
   * to obey that rule is not to add a state.
   */
  function npcWitnessHold(rec, dt) {
    // PUBLISHED FOR THE SOAK, and read by nothing in here. The escalation
    // measurement is "how many people are pointed at the animal", and inferring
    // that from a drawn yaw counts everybody who happens to be facing the right
    // way — 75 m of Sydney park, measured, in the first cut of qa/b7-heat.js.
    // These are the states in which a person's head is ON the capybara.
    // NOT `chase` and NOT `flee`. Somebody running is not somebody watching,
    // and including them put three Sydneysiders on the far side of the park
    // into a count that was supposed to be about how close you can get.
    //
    // AND THE TWO CASTS DO NOT SHARE A VOCABULARY. Sydney looks at you in
    // `lookAt`; Pasto has no such state — it looks at you in `gawp`, `point`
    // and `scold`. The first cut listed Sydney's names only and reported a
    // flat zero for the whole of chapter 2, in every row of every run, which
    // reads exactly like a crowd that does not react and is not one.
    rec.watching = (rec.witT > 0 || npcWATCH_ST[rec.state]) ? 1 : 0;
    if (!(rec.witT > 0)) return;
    rec.witT -= dt;
    if (rec.witT <= 0) { rec.witT = 0; return; }
    rec.lookX = rec.witX; rec.lookZ = rec.witZ;
  }

  // ---- THE GATHERING, for the ending on the lawn (v30) --------------------
  // The lawn is at (30, 26) with the horseshoe at r = 2.6 — see sysFIN_* in
  // systems.js. These mirror it rather than import it, the same way this module
  // already mirrors Pasto's world layout, and the ring here is wider than the
  // souvenirs' so nobody stands on the ending.
  const sysFIN_LAWN_X = 30, sysFIN_LAWN_Z = 26;
  const npcGATHER_R    = 5.4;    // m, where they stand: outside the horseshoe
  const npcGATHER_N    = 5;      // A SMALL cast. See the note in npcGather.
  const npcGATHER_CEIL = 30;     // s. The ceiling. Never remove this.
  const npcGATHER_SPD  = 1.2;    // m/s, an unhurried walk over to look
  // HOW FAR AWAY SOMEBODY MAY BE RECRUITED FROM, DERIVED rather than chosen, so
  // it cannot disagree with the ceiling. The first version recruited nearest-
  // first with no cap and MEASURED THE CONSEQUENCE: Sydney's cast is spread
  // over a whole park, so the five nearest were 10, 16, 17, 19 and 28 m out;
  // four of them were still walking when the 14 s ceiling stopped them and
  // stood them in the middle of the lawn's approach, and the 28 m one never
  // moved at all. A gathering nobody reaches is worse than no gathering.
  // 0.7 is the dodging allowance — steerTo goes round things.
  //
  // AND THE CEILING IS 30 s, NOT 14, BECAUSE OF WHAT THAT COSTS AT THE OTHER
  // END. At 14 s the reachable radius is 11.8 m, and measured against Sydney's
  // actual cast — spread over a whole park at 10, 16, 17, 19 and 28 m from the
  // lawn — that recruited exactly ONE person. Thirty seconds is not a delay the
  // player waits through: the ending is reached by sitting down and loafing,
  // the loaf takes about ten seconds to reach 1.0, and people drifting in over
  // the half minute either side of that is the picture, not a wait.
  const npcGATHER_MAX_D = npcGATHER_CEIL * npcGATHER_SPD * 0.7;
  let npcGathered = false;
  /**
   * Bring a few people over to look at what you brought back.
   *
   * FIVE, NOT FIFTEEN. The whole lawn is sixteen metres square and the moment
   * is the animal sitting down among seventeen small objects; a crowd turns an
   * ending into a ceremony and puts bodies between the shoulder camera and the
   * capybara, which is the exact composition fault the closed ring was changed
   * to a horseshoe to fix. Five reads as "some people wandered over".
   *
   * Nearest-first, so the people who come are the ones who were already in the
   * gardens rather than a delegation teleporting in from the quay.
   */
  function npcGather() {
    if (npcGathered) return 0;
    const live = game.biome && game.biome.current;
    if (live !== 'sydney') return 0;
    const pool = [];
    for (let i = 0; i < humans.length; i++) {
      const r = humans[i];
      if (!r || !r.group || !r.group.visible) continue;
      // The terrace is a set with its own furniture in it and the waiter has a
      // circuit; pulling either onto the lawn leaves a laid table nobody is at.
      if (r.kind === 'patron' || r.kind === 'waiter') continue;
      if (r.carryT >= 0) continue;
      const dx = r.group.position.x - sysFIN_LAWN_X, dz = r.group.position.z - sysFIN_LAWN_Z;
      const d2 = dx * dx + dz * dz;
      if (d2 > npcGATHER_MAX_D * npcGATHER_MAX_D) continue;   // they could not get here in time
      pool.push({ r: r, d2: d2 });
    }
    pool.sort(function (a, b) { return a.d2 - b.d2; });
    const n = Math.min(npcGATHER_N, pool.length);
    for (let i = 0; i < n; i++) {
      const r = pool[i].r;
      // Spread over the mouth-facing three quarters so nobody stands directly
      // behind the souvenirs from the approach, and jitter the radius so five
      // people are not a firing squad.
      let a = (i / n) * Math.PI * 1.5 + Math.PI * 0.25;
      const rad = npcGATHER_R + rand(-0.5, 0.8);
      // A SLOT IN A FLOWER BED CAN NEVER BE ARRIVED AT, and the first version
      // put one there — measured, `navBlocked` true at (29, 20), so that person
      // walked at a point they could not stand on until the ceiling stopped
      // them. Rotate round the ring until the ground is clear; the ring is 5.4 m
      // on a bed-free 16 m lawn, so a free bearing always exists.
      let gx = 0, gz = 0;
      for (let k = 0; k < 8; k++) {
        gx = sysFIN_LAWN_X + Math.cos(a) * rad;
        gz = sysFIN_LAWN_Z + Math.sin(a) * rad;
        if (!navBlocked(gx, gz, 0.45)) break;
        a += Math.PI * 2 / 9;
      }
      r.gathX = gx; r.gathZ = gz;
      setState(r, 'gather');
    }
    npcGathered = n > 0;
    try { game.state.gathered = n; } catch (e) { /* optional */ }
    return n;
  }
  game.events.on('finale:staged', npcGather);

  /**
   * ARM THE CHAIN FROM WHOEVER IS NEAREST TO (x, z), in the two chapters that
   * have no `locals`. npcWitnessChain takes a PERSON, because a look has to
   * come from somebody — so an event that carries a place and not a person had
   * no way in, and `capy:grab` is exactly that event.
   *
   * MEASURED, and it is job 3a: robbing somebody in Pasto raised nothing at
   * all. The graze handler is the only thing that arms this chain outside
   * Sydney's own startles, and it only fires once the animal has taken a BITE
   * — so the theft itself, in the chapter with the most edible props in the
   * game, was witnessed by nobody. `capy:grab` is the robbery.
   *
   * Pure attention, deliberately: a chain turns heads and lets exactly one
   * person speak. Nothing here starts a chase, and the ownership chase Sydney
   * already has on `prop.owner` is untouched and still outranks it.
   */
  function npcCastWitnessAt(x, z, r) {
    const live = game.biome && game.biome.current;
    const cast = live === 'sydney' ? humans : live === 'pasto' ? paHumans : null;
    if (!cast) return 0;
    let best = null, bd = r * r;
    for (let i = 0; i < cast.length; i++) {
      const rec = cast[i];
      if (!rec || !rec.group || !rec.group.visible) continue;
      if (rec.state === 'flee' || rec.state === 'plunge' || rec.state === 'swim') continue;
      const dx = rec.group.position.x - x, dz = rec.group.position.z - z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bd) { bd = d2; best = rec; }
    }
    if (!best) return 0;
    // They have seen it, which is the thing npcHeat counts. `alarm` and not
    // `wary`: alarm is the channel these two casts use and stepHuman derives
    // the memory from it a frame later, which is the existing design.
    best.alarm = Math.max(best.alarm || 0, 0.75);
    // At the THING, and not via lookAtCapy: `capyX`/`capyZ` are refreshed by
    // refreshCapy(), which sits BELOW the biome gate in update() and therefore
    // never runs in Pasto — so a look through that helper would point Pasto's
    // people at wherever the animal last stood in Sydney. Same shared-space
    // family as the npcHeat leak this batch fixed one screen up.
    best.lookX = x; best.lookZ = z;
    best.witX = x; best.witZ = z; best.witT = npcWIT_LOOK;
    return npcWitnessChain(best);
  }

  function npcWitnessChain(src) {
    if (!src || !src.group) return 0;
    // The live-biome gate is not optional: every chapter shares one coordinate
    // space, so a Sydney commuter standing at (12, 30) is at (12, 30) in
    // Pasto too and would answer a chain fired three chapters away.
    const live = game.biome && game.biome.current;
    if (live !== 'sydney' && live !== 'pasto') return 0;
    const cast = live === 'sydney' ? humans : paHumans;
    const sx = src.group.position.x, sz = src.group.position.z;
    // ---- 2a: MORE HEADS, AND FROM FURTHER OUT, WHERE IT IS HOT (v33) -----
    // The chain radius is the measured distance at which one person in a
    // square hears another, and heat is allowed to stretch it by npcHEAT_LOOK
    // — which is the same multiplier the radius of the field itself is derived
    // from, so a witness can never be recruited from outside the heat its own
    // witnessing creates. That is trap 3 of this batch, obeyed by construction
    // rather than by checking afterwards.
    const chainR = npcCHAIN_R * (1 + npcHeatAt(sx, sz) * (npcHEAT_LOOK - 1));
    const chainR2 = chainR * chainR;
    let best = null, bestD = chainR2, n = 0;
    for (let i = 0; i < cast.length; i++) {
      const r = cast[i];
      if (!r || r === src || !r.group || !r.group.visible) continue;
      // Somebody already running, swimming or climbing out of the harbour has
      // a more pressing engagement than your sandwich.
      if (r.state === 'flee' || r.state === 'plunge' || r.state === 'swim') continue;
      const dx = r.group.position.x - sx, dz = r.group.position.z - sz;
      const d2 = dx * dx + dz * dz;
      if (d2 > chainR2) continue;
      // NOT `gawpT`. The obvious way to hold the look open is that timer, and
      // it is exactly wrong: in Pasto `gawpT` COUNTS UP and paStepHuman LEAVES
      // the gawp when it passes 1.8, so writing 2.6 into it ends the look
      // instead of extending it. Same family as the catch-all state that reset
      // the timer it was waiting on.
      //
      // AND A BARE lookX WRITE IS WORTH NOTHING EITHER, which is what the first
      // version of this did. Measured: 9 of 16 people in Sydney and 5 of 13 in
      // Pasto were pointed at the reaction on the frame it happened, and 2 and
      // ZERO were a fifth of a second later — twenty-odd sites inside the two
      // state machines write lookX every frame, so a witness look loses to
      // whatever the person was already doing before anybody can see it.
      // `witT` is the hold, re-asserted after the state machine has run.
      r.lookX = sx; r.lookZ = sz;
      r.witX = sx; r.witZ = sz; r.witT = npcWIT_LOOK;
      n++;
      if ((r.talkCd || 0) <= 0 && d2 < bestD) { bestD = d2; best = r; }
    }
    // ...and exactly ONE of them answers. Two people saying "what was that?" in
    // unison is a chorus, not a square.
    if (best) {
      best.talkCd = rand(9, 20);
      const arr = live === 'pasto' ? npcWIT_CHAIN_PA : npcWIT_CHAIN;
      best.speak(arr[randInt(0, arr.length - 1)]);
    }
    // A HARNESS HOOK, because this chain is invisible from outside otherwise.
    // A witness LOOKS, and a look is two numbers that the person's own step
    // function is entitled to overwrite a frame later — so "did the chain
    // fire" and "is anybody still facing the right way" are different
    // questions, and only the first one is about this code. Counting it here
    // is what stops a green run meaning nothing, which is the mistake
    // pf-mischief.js's ownedProps and stillness.js's slopeAt both made.
    try {
      const st = game.state;
      st.witLast = n;
      st.witCalls = (st.witCalls || 0) + 1;
      st.witSpoke = (st.witSpoke || 0) + (best ? 1 : 0);
      st.witSrcX = sx; st.witSrcZ = sz;
      st.witR = +chainR.toFixed(2);
    } catch (e) { /* optional */ }
    // ...and this is where the two chapters with no `locals` raise the field.
    // Gated on n: a chain nobody was near is not a witnessed anything, which
    // is the same rule npcHeatBump applies to itself one layer down.
    if (n > 0) npcHeatBump(sx, sz, 'witness');
    return n;
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
  function localOwnEnd(rec, home) {
    // ...and whatever they were carrying goes down (F4). THE ONLY WAY OUT of
    // the errand, so it is the only place the pin has to be released — see
    // localOwnDrop. `home` is true only when they actually got back.
    if (rec.carry) localOwnDrop(rec, !!home);
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

  // ---- THE ERRAND'S LAST LEG, CARRIED (F4) -------------------------------
  //
  // Three functions and one rule: THE PIN IS RELEASED ON EVERY PATH OUT. A
  // prop left kinematic with `owner` set is a prop nothing can pick up and
  // nothing can knock over, for the rest of the session — the exact shape of
  // failure the carrier work has paid for before (see the note on rule 2 in
  // monaco.js and the ferry's passenger). So `localOwnDrop` is called from
  // `localOwnEnd`, which is the ONLY way this errand can finish: the arrival,
  // the give-up ceiling, the leash, a chapter change, and the prop being
  // removed all funnel through it.
  const npcOWN_CARRY = { x: 0.26, y: 1.02, z: 0.20 };   // beside the hip, held

  /** Take it off the ground. Same pin `reclaim` uses for the roster. */
  function localOwnTake(rec, p) {
    if (!p || !p.body || p.held) return;
    rec.carry = p;
    // WHAT IT WAS BEFORE, remembered rather than assumed. `physRescue` does
    // NOT restore a body type — it repositions and nothing else — so the type
    // is this function's to put back, and putting back a guessed DYNAMIC would
    // quietly un-plant anything that was static.
    rec.carryType = p.body.type;
    p.owner = rec;
    p.body.type = CANNON.Body.KINEMATIC;
    p.body.updateMassProperties();
    p.body.allowSleep = false;
    p.body.collisionResponse = false;      // it must not barge its own owner
    p.body.velocity.set(0, 0, 0);
    p.body.angularVelocity.set(0, 0, 0);
    p.body.wakeUp();
  }

  /** Put it back where it lives, and un-pin it whatever happens. */
  function localOwnDrop(rec, home) {
    const p = rec.carry;
    rec.carry = null;
    rec.carryW = 0;
    const was = rec.carryType;
    rec.carryType = undefined;
    if (!p) return;
    if (p.owner === rec) p.owner = null;
    // THE PIN COMES OFF FIRST, ON EVERY PATH, and before anything else can
    // return early. `physRescue` repositions and does not touch the type, so
    // if this were left to it a retrieved hat would be kinematic — immovable,
    // un-grabbable, and unable to fall — for the rest of the session. That is
    // the failure this whole block is shaped around.
    if (p.body && !p.held) {
      p.body.type = (was === undefined) ? CANNON.Body.DYNAMIC : was;
      p.body.updateMassProperties();
      p.body.collisionResponse = true;
      p.body.allowSleep = true;
      p.body.wakeUp();
    }
    if (home && !p.removed && !p.held &&
        game.physics && typeof game.physics.rescue === 'function') {
      game.physics.rescue(p);
      if (typeof game.physics.puff === 'function') {
        game.physics.puff(p.homeX, p.homeY + 0.35, p.homeZ, 3);
      }
    }
  }

  /** One frame of it riding along. Called from the local's draw. */
  function localOwnCarry(rec, dt) {
    const p = rec.carry;
    if (!p) { if (rec.carryW > 0) rec.carryW = Math.max(0, rec.carryW - dt * 4); return; }
    // The animal grabbing it back beats everything: props.js owns `held`.
    if (p.held || p.removed || p.owner !== rec) { localOwnDrop(rec, false); return; }
    rec.carryW = Math.min(1, rec.carryW + dt * 5);
    const g = rec.group;
    if (!g) return;
    const c = Math.cos(rec.yaw), s = Math.sin(rec.yaw);
    const wx = g.position.x + npcOWN_CARRY.x * c + npcOWN_CARRY.z * s;
    const wz = g.position.z - npcOWN_CARRY.x * s + npcOWN_CARRY.z * c;
    const wy = g.position.y + npcOWN_CARRY.y;
    if (p.body) {
      npcPlaceBody(p.body, wx, wy, wz);
      npcQ1.setFromEuler(npcE1.set(0, rec.yaw, 0));
      npcPlaceQuat(p.body, npcQ1.x, npcQ1.y, npcQ1.z, npcQ1.w);
      p.body.velocity.set(0, 0, 0);
      p.body.angularVelocity.set(0, 0, 0);
    }
    if (p.mesh) {
      p.mesh.position.set(wx, wy, wz);
      p.mesh.quaternion.setFromEuler(npcE1.set(0, rec.yaw, 0));
    }
  }

  /** One frame of somebody going to get their thing back. */
  function localOwnStep(rec, dt) {
    const p = rec.own;
    rec.ownT += dt;
    // ---- the tear-downs, in order of how little they trust the world -------
    if (!p || p.removed || p.hidden || game.biome.current !== rec.biome) { localOwnEnd(rec); return; }
    if (rec.ownBack) {
      // home, or the clock. Either way this ends — and only the first of the
      // two puts the thing back on its peg (F4). Running out of patience
      // halfway across a square leaves it where they were standing, which is
      // the honest outcome and is also what makes the walk worth watching.
      const dh = Math.hypot(rec.ax - rec.x, rec.az - rec.z);
      if (dh < 0.5) { localOwnEnd(rec, true); return; }
      if (rec.ownT > npcOWN_BACK_T) { localOwnEnd(rec, false); return; }
      rec.tx = rec.ax; rec.tz = rec.az;
      return;
    }
    if (rec.ownT > npcOWN_OUT_T) {
      // THE CEILING. They give up out loud, and they walk back.
      if (rec.cd <= 0) { rec.cd = rec.cool * rand(0.8, 1.4); localReactLine(rec, rec.says.giveUp || npcLOC_GIVEUP); }
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
        // CAUGHT YOU. TWO VERBS, AND THEY ARE NOT INTERCHANGEABLE. dropOwned is
        // the verb for a prop an NPC is carrying — it refuses one the capybara
        // holds (`if (!prop || prop.held) return`), and called with no argument
        // at all it returns on the first word. Emptying the animal's mouth is
        // release(), which works off capy.heldProp. This branch called the wrong
        // one, with nothing in it, so being caught did nothing in any chapter.
        if (p.held) {
          if (game.physics && typeof game.physics.release === 'function') game.physics.release(null);
        } else if (game.physics && typeof game.physics.dropOwned === 'function') {
          game.physics.dropOwned(p);
        }
        if (rec.cd <= 0) { rec.cd = rec.cool * rand(0.6, 1.0); localReactLine(rec, npcLOC_CHASE); }
        rec.flV -= 8;                        // a lunge, on the flinch spring
        rec.flYaw = Math.atan2(px - rec.x, pz - rec.z);
        return;                              // ...and they pick it up next frame
      }
      // ---- THEY PICK IT UP AND CARRY IT (F4) ---------------------------
      // It used to TELEPORT: the moment somebody stood over their own hat, the
      // hat vanished and reappeared on its peg forty metres away, with a puff
      // of dust to cover the join. Every other carrier in this game is a real
      // one — the ferry, the chiva, the condor, the tender — and the one that
      // happens most often, in seventeen chapters, was a cut.
      //
      // The whole point of the errand is watching somebody walk over, pick
      // their thing up, and take it back, muttering. Half of that was mimed.
      //
      // Pinned exactly the way `reclaim` pins one for the roster, and carried
      // the way the umbrella is carried — at a fixed offset on `rec.group`
      // rather than welded to a hand, because a local's arm is a single box
      // with no elbow and anything parented to it swings through the figure's
      // own ribs. The arm comes up to meet it, on the same term the umbrella
      // uses. See localOwnCarry.
      rec.gest = 1.2;
      if (typeof game.sfx === 'function') game.sfx('rustle', { volume: 0.35 });
      localOwnTake(rec, p);
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
    localSteerTo(rec, px, pz, d);
  }

  /**
   * POINT SOMEBODY AT A PLACE THEY ARE NOT STANDING, ROUND WHATEVER IS IN THE
   * WAY. Lifted out of localOwnStep unchanged when THE MARCH needed the same
   * three lines; `d` is the distance the caller has already computed, because
   * both callers have.
   *
   * One try each way round an obstacle, then hold this frame. No path and no
   * memory: a local has neither and is not getting either here.
   */
  function localSteerTo(rec, px, pz, d) {
    let hit = false;
    const ux = (px - rec.x) / d, uz = (pz - rec.z) / d;
    let nx = rec.x + ux * 1.0, nz = rec.z + uz * 1.0;
    if (localStepBlocked(rec, nx, nz)) {
      hit = true;
      const s = Math.sin(0.9), c = Math.cos(0.9);
      const ax2 = ux * c - uz * s, az2 = ux * s + uz * c;
      const bx2 = ux * c + uz * s, bz2 = -ux * s + uz * c;
      if (!localStepBlocked(rec, rec.x + ax2, rec.z + az2)) { nx = rec.x + ax2; nz = rec.z + az2; }
      else if (!localStepBlocked(rec, rec.x + bx2, rec.z + bz2)) { nx = rec.x + bx2; nz = rec.z + bz2; }
      else { nx = rec.x; nz = rec.z; }
    }
    rec.tx = nx; rec.tz = nz;
    // Whether the direct line was blocked, for THE MARCH's audit only. A
    // marcher who never closes and a marcher who is walking into a wall look
    // identical from every other number.
    return hit;
  }

  // ---- THE MARCH, and see the constants block for what it is for ----------
  /**
   * Is this person free to walk over? Every gate here is a state that owns
   * their feet, their hands or their mouth already.
   *
   * ---- `gest` GATES WHO SETS OFF AND NOT WHO KEEPS GOING ------------------
   * This distinction is the whole difference between a feature and a dead one,
   * and the first cut did not have it. `gest` is not only "their hands are
   * full": localLine sets it to `1.5 + line.length * 0.045` on EVERY line
   * anybody says, because talking is a gesture. So a marcher who opened their
   * mouth — and this one says npcLOC_MARCH on the way over, by design — failed
   * its own continuation test on the next frame and turned round.
   *
   * MEASURED, and it is why the ceiling above was re-tuned twice before the
   * real cause showed up: a marcher closing at a textbook 1.25 m/s from 11.95
   * m, all the way to 2.12, and then `gave up: gesturing` two metres short.
   *
   * Retrieval has never had this problem because `own` is not gated on `gest`
   * at all — it says npcLOC_CHASE the whole way across a square. The march is
   * held to the same rule now: talking is part of coming over.
   */
  function marFree(r, starting) {
    return !!r && !!r.fig && !!r.group && r.biome === game.biome.current &&
           !r.own && !r.carry && (r.marCool || 0) <= 0 &&
           (!starting || (r.gest || 0) <= 0);
  }
  function marEnd(r, caught, sayIt) {
    if (!r) { marWho = null; return; }
    r.marCool = npcMAR_COOL;
    // Home, at shuffle speed, exactly as retrieval leaves somebody.
    r.tx = r.ax; r.tz = r.az;
    if (sayIt && r.cd <= 0) {
      r.cd = r.cool * rand(0.8, 1.4);
      localReactLine(r, npcLOC_MARCH_GAVE);
    }
    if (caught) {
      if (r.cd <= 0) { r.cd = r.cool * rand(0.6, 1.0); localReactLine(r, npcLOC_MARCH_END); }
      r.flV -= 8;                       // a lunge, on the flinch spring
      const cp = game.capy && game.capy.position;
      if (cp) r.flYaw = Math.atan2(cp.x - r.x, cp.z - r.z);
      r.wary = Math.min(1, (r.wary || 0) + npcMAR_WARY);
      // systems.js decides what reaching you is WORTH. See its npc:caught
      // handler: the chain closes, and the card already earned stays earned.
      emit('npc:caught', { x: r.x, z: r.z });
    }
    marWho = null; marT = 0;
  }
  function marStep(r, dt) {
    marT += dt;
    const cp = game.capy && game.capy.position;
    // Every ceiling, in order of how little it trusts the world. Each one
    // names itself, for the reason the refusals above do: they all look the
    // same from outside, and the first run of `qa/nr-march.js` reported a
    // marcher that set off and stopped after ninety-eight centimetres with no
    // way to tell which of six things had ended it.
    if (!cp) { marWhy = 'no animal'; marEnd(r, false); return; }
    if (r.biome !== game.biome.current) { marWhy = 'left the chapter'; marEnd(r, false); return; }
    if (!marFree(r)) {
      marWhy = "gave up: " + (!r.fig ? "not our figure" : r.own ? "fetching"
             : r.carry ? "carrying"
             : (r.marCool || 0) > 0 ? "cooling" : "unknown");
      marEnd(r, false); return;
    }
    if (marT > npcMAR_OUT_T) { marWhy = 'out of patience'; marEnd(r, false, true); return; }
    // THE LEASH, and it is retrieval's own: a person does not leave their
    // pitch, and this is the rule that makes the whole thing safe to switch on
    // in seventeen chapters at once. Nobody can be led away.
    if (Math.hypot(r.x - r.ax, r.z - r.az) > npcOWN_LEASH) {
      marWhy = 'leashed'; marEnd(r, false, true); return;
    }
    const d = Math.hypot(cp.x - r.x, cp.z - r.z);
    if (d < npcMAR_TAKE) { marWhy = 'caught you'; marEnd(r, true); return; }
    if (localSteerTo(r, cp.x, cp.z, d)) marBlocked++;
    marSayT -= dt;
    if (marSayT <= 0 && r.cd <= 0) {
      marSayT = npcMAR_SAY_T * rand(0.8, 1.4);
      r.cd = r.cool * rand(0.4, 0.8);
      localReactLine(r, npcLOC_MARCH);
    }
  }
  /**
   * THE RUNGS OF THE CHAIN. systems.js emits one of these per witnessed thing
   * and owns what a chain is worth; this owns what a square does about one.
   */
  game.events.on('capy:chain', function (e) {
    if (!e || !game.state.started) return;
    const live = game.biome && game.biome.current;
    // The nearest person who saw it and is free to react to it.
    let best = null, bd = npcMAR_R * npcMAR_R;
    for (let i = 0; i < locals.length; i++) {
      const r = locals[i];
      if (r.biome !== live || !r.group) continue;
      const dx = e.x - r.x, dz = e.z - r.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > bd) continue;
      bd = d2; best = r;
    }
    if (!best) { marWhy = 'nobody within ' + npcMAR_R + ' m'; return; }
    // AT TWO: they look up. Two numbers, and it is the same pair the witness
    // chain uses — a look, not a flinch.
    if (e.n === npcMAR_AT) {
      best.chatYaw = Math.atan2(e.x - best.x, e.z - best.z);
      best.chatT = npcCHAIN_LOOK;
      return;
    }
    // AT FOUR: one of them comes over. ONE, ever — see the constants block.
    if (e.n < npcMAR_GO) { marWhy = 'rung ' + e.n; return; }
    if (marWho) { marWhy = 'already marching'; return; }
    if (!marFree(best, true)) {
      // WHY, AND NOT JUST THAT. Six gates share one symptom — nobody comes —
      // and from outside they are indistinguishable from the event never
      // having fired. This cost a run to find out.
      marWhy = !best.fig ? 'not our figure' : best.own ? 'fetching'
             : best.carry ? 'carrying' : (best.gest || 0) > 0 ? 'gesturing'
             : (best.marCool || 0) > 0 ? 'cooling ' + best.marCool.toFixed(1)
             : best.biome !== live ? 'wrong biome' : 'unknown';
      return;
    }
    marWho = best; marT = 0; marSayT = 0; marBlocked = 0; marWhy = "marching";
  });

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
  // ---- ...AND THE TWO THAT WERE NOT NOTICED BY ANYBODY (B9) ---------------
  //
  // MEASURED before writing this, four forced events at the feet of the
  // nearest person, in Sydney (ten people within 30 m) and in Venice (three):
  //
  //     spill    0 startled  ·  0 incidents   in BOTH chapters
  //     shatter  0 startled  ·  4 incidents   (Sydney, 4.7 m away)
  //
  // The incident column is systems.js's 'prop:destroy' hook, which has always
  // been there. The startle column is the whole of what this game is FOR — the
  // delight is not the mischief, it is being witnessed doing it — and neither
  // of the two mechanics item 4 wants to multiply reached a single person.
  //
  // A break and a spill are different events and are answered differently. A
  // break is a bang: it carries at the full reaction radius and gets the
  // `startled` pool. A spill is quiet — nobody three shops away hears a cup go
  // over — so it takes two thirds of the radius and a pool of its own about
  // the floor.
  const npcLOC_BREAK  = 0.72;   // strength of the flinch when something breaks
  const npcLOC_MESS   = 0.42;   // ...and when something goes everywhere
  const npcLOC_MESS_R = 0.66;   // × npcLOC_REACT_R — a spill is not loud
  const npcCAST_REACT_N = 2;    // ...and no more of Sydney's roster than speak

  /**
   * TWO CASTS, AND `localsReact` KNOWS ABOUT ONE OF THEM. It opens with
   * `if (!locals.length) return`, and Sydney's people are `humans` — a
   * different array, built at boot, with a different record shape. So the
   * first cut of the two handlers below startled four people in Venice and
   * NOBODY in Sydney, from three metres, in the chapter with the most people
   * in it. That is the third time in this pass that a question about npc.js's
   * collections has been answered with one of them: see `sayNear` and
   * `peopleNear`, which exist for the same reason.
   *
   * Not fixed by widening `localsReact`, which has a dozen callers and whose
   * flinch spring is written against the local record's fields. Sydney's
   * roster has its own reaction — `startle` — and this is the one place that
   * asks for both.
   */
  function castReact(kind, x, z, s, radius) {
    localsReact(kind, x, z, s, radius);
    if (!biomeLive()) return;   // `humans` is Sydney's roster and nowhere else's
    const r = radius > 0 ? radius : npcLOC_REACT_R;
    const r2 = r * r;
    let n = 0;
    for (let i = 0; i < humans.length && n < npcCAST_REACT_N; i++) {
      const rec = humans[i];
      if (!rec || !rec.group || rec.dejected > 0) continue;
      if (rec.state === 'chase' || rec.state === 'swim' || rec.state === 'plunge') continue;
      const dx = rec.group.position.x - x, dz = rec.group.position.z - z;
      if (dx * dx + dz * dz > r2) continue;
      startle(rec, x, z);
      rec.reactMode = 1;
      n++;
    }
  }

  game.events.on('prop:destroy', function (p) {
    const b = p && p.prop && p.prop.body;
    if (!b) return;
    castReact('startled', b.position.x, b.position.z, npcLOC_BREAK);
  });
  game.events.on('prop:impact', function (p) {
    // props.js stamps this flag on the shared payload for physSpill and clears
    // it in physStampVoice; speed is 0 here, which is why every gate in this
    // file used to drop it.
    if (!p || !p.spill || !p.position) return;
    castReact('mess', p.position.x, p.position.z, npcLOC_MESS,
              npcLOC_REACT_R * npcLOC_MESS_R);
  });
  // ---- SOMEBODY JUST WALKED INTO YOU (D3) --------------------------------
  //
  // In a goose game the barge IS the verb, and for nineteen chapters walking
  // into a person did the same thing as walking into a building: capybara.js's
  // collide listener gates on `other.mass === 0`, and BOTH of this module's
  // record shapes carry a mass-0 collider — a walker's is KINEMATIC, a local's
  // is plain static. So the animal got a stone thud and the person got nothing.
  //
  // The event now arrives with the record the collider was carrying, so this
  // handler does not have to search for who it was — which matters, because
  // the nearest person to the animal is not necessarily the one it hit.
  //
  // Three answers, and deliberately no fourth: no chase, no task, no wariness
  // beyond what the flinch already writes. Being shouldered is rude, not a
  // crime, and the mischief economy is a separate accounting.
  const npcBARGE_KICK = 15;     // the flinch spring, against localsReact's 21
  const npcBARGE_SAY = 0.55;    // ...and how often it is worth a line as well
  // ---- B11: THE STAGGER AND THE SIT (item 4e) ------------------------------
  //
  // WHAT 4e ASKS FOR AND WHAT IS ACTUALLY THERE. The item's first clause is
  // "stumble (barged >= 3.2 m/s, DROPS WHAT THEY HOLD via physBarge)" and it
  // is measured false for this cast: `heldProp` is not a field on the local
  // record in any of the nineteen chapters, and `qa/bodies-animals.js` reads
  // **zero locals holding anything, everywhere**. Sydney's and Pasto's
  // rosters do hold things and have dropped them since v19 (see npcFumble) —
  // so the half of that clause that can exist already does, in the two
  // chapters where it can, and the half that cannot is not faked here.
  //
  // The stagger is a spring like the flinch, on the same critically-damped
  // shape, but SIDEWAYS: the flinch is a lean back and this is a wobble
  // across, which is what stops the two reading as one bigger flinch.
  const npcSTUM_KICK = 9.5;     // impulse into the stagger spring
  const npcSTUM_K    = 26;      // ...and its spring constant
  const npcSTUM_C    = 9.0;     // ...and its damping, a little looser than the
                                // flinch, so a stagger takes about a second
  // MEASURED AND RAISED. At 0.26 the spring's peak of 0.26 gave 0.068 rad —
  // 3.9 degrees — and the note above localsReact's own kick says 3.7 degrees
  // is under the threshold at which anybody can tell a person reacted at all.
  // 0.45 puts the peak at 6.7 degrees: over the flinch's 3.6 and under the
  // 8.6 of a crate landing at point-blank range, which is the right place for
  // being shouldered.
  const npcSTUM_ROLL = 0.45;    // rad of sideways lean at full stagger
  const npcSTUM_DIP  = 0.10;    // m the person drops while off balance
  // A SIT IS A BARGE ON TOP OF A STARTLE. Both numbers are deliberately mean:
  // it should happen to a player two or three times in a chapter, not twice a
  // minute.
  const npcSIT_FL    = 0.22;    // flinch already at least this deep
  const npcBARGE_HARD = 3.2;    // m/s — physBARGE_MIN, the same number
  const npcSIT_HOLD  = 2.1;     // s on the ground
  const npcSIT_COOL  = 40;      // s per person, which is the item's own figure
  const npcSIT_DROP  = 0.34;    // m the body goes down
  const npcSIT_LEAN  = 0.42;    // rad it goes back
  // ---- ...AND THE TWO CAST CHAPTERS CANNOT BE BARGED THROUGH PHYSICS -----
  //
  // MEASURED (qa/d3-react.js): the animal was driven into the nearest cast
  // member in Sydney and Pasto and reached 0.3 m and 0.2 m of the collider's
  // centre with ZERO barge events, while the same drive in Circular Quay,
  // Kyoto and Venice fired one every time. The reason is thirty lines from the
  // top of this file and it is deliberate: `npcPlaceBody` HOLDS a body
  // carrying `userData.npc` off the animal by npcBODY_CLEAR every frame, so a
  // walker cannot shove the player — and the drawn figure is not moved with
  // it. In the two chapters that use that path you walk THROUGH the person.
  //
  // So the cast is barged on PROXIMITY TO THE FIGURE instead, which is what
  // the player sees anyway. Same event, same handler, one extra gate: the
  // animal has to be moving, because standing in a crowd is not a barge and
  // the collider hold-off means it is a thing that happens constantly.
  const npcBARGE_R    = 1.05;   // m from the drawn figure. Inside npcBODY_CLEAR.
  const npcBARGE_V    = 1.30;   // m/s — capyBARGE_V, the same number
  const npcBARGE_GAP  = 0.90;   // s between them, so a walk through a crowd is
                                // a series of encounters and not a drum roll.
                                // Longer than the collider version's 0.40,
                                // because proximity is a much easier trigger
                                // than a contact and Sydney has 32 people on
                                // one lawn.
  const npcBARGE_CLOSE = 0.55;  // cos of the angle between the animal's course
                                // and the person: walking PAST somebody at
                                // arm's length is not barging them.
  let npcBargeCd = 0;
  const npcBargePayload = { rec: null, speed: 0, x: 0, z: 0 };
  function npcBargeSweep(dt, cast) {
    if (npcBargeCd > 0) { npcBargeCd -= dt; return; }
    const capy = game.capy;
    if (!capy || !capy.position || !capy.velocity) return;
    if (capy.carriedBy || capy.atHelm) return;
    const sp = Math.hypot(capy.velocity.x, capy.velocity.z);
    if (sp < npcBARGE_V) return;
    const cx = capy.position.x, cz = capy.position.z;
    let best = null, bd = npcBARGE_R * npcBARGE_R;
    for (let i = 0; i < cast.length; i++) {
      const r = cast[i];
      if (!r || !r.group || !r.group.visible) continue;
      const dx = r.group.position.x - cx, dz = r.group.position.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= bd) continue;
      // ...AND WE HAVE TO BE GOING AT THEM. Without this, threading between
      // two people at a run barges both of them.
      const d = Math.sqrt(d2) || 1e-4;
      if ((capy.velocity.x * dx + capy.velocity.z * dz) / (d * sp) < npcBARGE_CLOSE) continue;
      bd = d2; best = r;
    }
    if (!best) return;
    npcBargeCd = npcBARGE_GAP;
    npcBargePayload.rec = best;
    npcBargePayload.speed = sp;
    npcBargePayload.x = cx;
    npcBargePayload.z = cz;
    game.events.emit('npc:barge', npcBargePayload);
  }
  game.events.on('npc:barge', function (e) {
    const rec = e && e.rec;
    if (!rec) return;
    const live = game.biome && game.biome.current;
    if (!live) return;
    const sp = typeof e.speed === 'number' ? e.speed : 1.5;
    const k = clamp(0.45 + sp * 0.14, 0.45, 1.0);
    // AWAY from the animal, which is the whole difference between this and
    // localsReact: a bang makes you turn TOWARD it, a shoulder does not. The
    // flinch spring drives lean, arms and head off one number, so the yaw is
    // what decides which way the person is knocked.
    const px = e.x, pz = e.z;
    if (rec.flV !== undefined) {
      // a local
      if (rec.biome !== live) return;
      rec.flV -= npcBARGE_KICK * k;
      rec.flYaw = Math.atan2(rec.x - px, rec.z - pz);
      rec.wary = Math.min(1, (rec.wary || 0) + k * 0.5 * npcPalSoft(rec));   // O2: see npcPalSoft
      // ---- B11: AND THEY HAVE A BODY (item 4e) --------------------------
      //
      // Two of the item's three events, and the third is written down below
      // rather than half-built. Sydney's and Pasto's rosters have had a
      // `stumble` since v19; the chapter-neutral cast — which is the cast in
      // seventeen of nineteen chapters — has never had one.
      //
      // A SIT IS A BARGE ON TOP OF A STARTLE, which is the item's own rule and
      // is what makes it rare: you have to make somebody jump and then walk
      // into them while they are still jumping. `npcSIT_FL` is read off the
      // flinch spring, so "already startled" is a measurement rather than a
      // flag somebody has to remember to set.
      const already = (-(rec.fl || 0)) > npcSIT_FL;
      if (already && rec.sat <= 0 && rec.satCd <= 0 && sp >= npcBARGE_HARD) {
        rec.sat = npcSIT_HOLD;
        rec.satCd = npcSIT_COOL;
        rec.stum = 0; rec.stumV = 0;      // a sit replaces a stagger
        sfx('gasp', rec, npcSFX_VOL * 0.95, 0.86);
      } else if (rec.sat <= 0) {
        // ONLY THE VELOCITY, which is how the flinch spring beside it is
        // driven and is not a stylistic choice. The first cut also set the
        // value — `stum = min(1, stum + k)` — and a spring started at 0.6 with
        // 5.7 of negative velocity crosses zero in a tenth of a second: the
        // measured peak roll was 0.025 rad, which is 1.4 degrees, which is
        // nothing. Kicked from rest it peaks near 0.45 and reads as a stagger.
        rec.stumV -= npcSTUM_KICK * k;
      }
      sfx('gasp', rec, npcSFX_VOL * (0.55 + k * 0.45), 1.0 + k * 0.10);
      if (rec.cd <= 0 && Math.random() < npcBARGE_SAY) {
        rec.cd = rec.cool * rand(0.8, 1.4);
        // `startled` and not a pool of its own: the neutral pool already opens
        // with '!', 'Whoa —', 'Careful!', 'Do you mind?' and 'I felt that',
        // which is exactly what being shouldered is worth, and every chapter
        // that has written its own startled row gets its own voice for free.
        localReactLine(rec, npcSay(rec, 'startled'));
      }
    } else if (rec.group) {
      // a member of one of the two old casts — same idea, their own channels
      rec.alarm = Math.max(rec.alarm || 0, 0.55 + k * 0.35);
      rec.lookX = px; rec.lookZ = pz;
      sfx('gasp', rec, npcSFX_VOL * (0.55 + k * 0.45), 1.0 + k * 0.10);
      npcWitnessChain(rec);
    }
  });
  // ---- A CHAPTER CLOSING, AND NOBODY WAS WATCHING (D4) --------------------
  //
  // Nothing in this module listened for a chapter close. The one moment in an
  // eight-hour game when the place you have been annoying for an hour has a
  // reason to look at you, and the ceremony was paper, audio and confetti with
  // the whole cast facing whatever they happened to be facing.
  //
  // ATTENTION AND NOTHING ELSE, which is the same discipline npcCastWitnessAt
  // takes: nobody moves, nobody says anything, no state machine is entered and
  // no wariness is written. Thirty metres is wider than any other look in the
  // file — a witness chain is 20 and a reaction is 13 — because this is not a
  // bang somebody heard, it is a room noticing.
  const npcDONE_R    = 30;
  const npcDONE_LOOK = 3.0;    // s, and it is re-asserted after the state
                               // machines have run, exactly as witT is
  game.events.on('chapter:done', function () {
    const capy = game.capy;
    if (!capy || !capy.position) return;
    const live = game.biome && game.biome.current;
    if (!live) return;
    const cx = capy.position.x, cz = capy.position.z;
    const r2 = npcDONE_R * npcDONE_R;
    let n = 0;
    for (let i = 0; i < locals.length; i++) {
      const r = locals[i];
      if (r.biome !== live || !r.group) continue;
      const dx = cx - r.x, dz = cz - r.z;
      if (dx * dx + dz * dz > r2) continue;
      // `chatYaw`/`chatT` and not `flYaw`: this is a look, not a flinch, and
      // driving the flinch spring here would make a whole square jump at the
      // moment the game is congratulating you.
      r.chatYaw = Math.atan2(dx, dz);
      r.chatT = npcDONE_LOOK;
      n++;
    }
    const cast = live === 'sydney' ? humans : live === 'pasto' ? paHumans : null;
    if (cast) for (let i = 0; i < cast.length; i++) {
      const r = cast[i];
      if (!r || !r.group || !r.group.visible) continue;
      if (r.state === 'flee' || r.state === 'plunge' || r.state === 'swim') continue;
      const dx = cx - r.group.position.x, dz = cz - r.group.position.z;
      if (dx * dx + dz * dz > r2) continue;
      r.lookX = cx; r.lookZ = cz;
      r.witX = cx; r.witZ = cz; r.witT = npcDONE_LOOK;
      n++;
    }
    try { game.state.doneLook = n; } catch (e) { /* optional */ }
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
    // ---- 0.5 WAS TOO SOFT TO BE WITNESSED, AND IT WAS MEASURED (v33) -----
    // `kick` is strength × (0.35…1.0 by nearness), and `npcWARY_HEAT` — the
    // bar above which somebody counts as watching FOR you — is 0.35. At
    // strength 0.5, only a person inside 2.9 m of a 6.5 m circle clears it, so
    // being robbed at four metres left the victim at 0.26: reacting, flinching,
    // saying so, and not counted as a witness by anything. Which meant the
    // accumulator this batch is about could not see a robbery at all in most
    // chapters — Hong Kong and Cappadocia both, measured.
    //
    // 0.8 puts the whole of the near half of the circle over the bar and
    // leaves the rim under it, which is the right shape: you were nearly out
    // of their world. It also costs a slightly bigger flinch (9.6 against 7.4
    // at four metres) and that is correct — a splash is not a theft.
    localsReact('thief', b.position.x, b.position.z, 0.8, 6.5);
    // ...AND WHOEVER IT BELONGS TO COMES AND GETS IT.
    const own = localOwnerOf(pr);
    if (own) localOwnStart(own, pr, npcSay(own, 'thief'));
    // ...and the two chapters with no `locals` get the same event through the
    // witness chain, which is the one of the three chains that ports (v33).
    // The radius is the produce one: this is 'that happened right here'.
    npcCastWitnessAt(b.position.x, b.position.z, npcGRAZE_R);
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
    // A SPILL IS WORTH GETTING OFF YOUR STOOL FOR TOO (B9). The gate is about
    // how hard a thing hit and a spill arrives at speed 0, so the one person
    // in the world with a reason to care — whoever it belonged to — was the
    // one person who never heard about it. Sydney has had this reaction since
    // v23 and it is hardcoded to `coffee` and `icecream` behind biomeLive();
    // this is the chapter-neutral half, and it reads the flag rather than a
    // list of types, so it holds for every type 4d adds.
    if (sp < npcOWN_BANG && !p.spill) return;
    const pr = p.prop;
    if (!pr || pr.held) return;
    const own = localOwnerOf(pr);
    if (own) localOwnStart(own, pr, npcSay(own, 'startled'));
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
    own.wary = Math.min(1, (own.wary || 0) + 0.5 * npcPalSoft(own));   // O2: see npcPalSoft
    // Eating somebody's stock in front of them is the most witnessed thing in
    // the game and it is the one mischief path that never reaches localsReact.
    if (cp) npcHeatBump(cp.x, cp.z, 'graze:owner');
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
  // ---- SIT, AND BE NOTICED (B7, item 3) ---------------------------------
  //
  // MEASURED FIRST, and it moved the item: the `photo` state exists and it
  // works — a still capybara 3 to 11 m away, in view, gets photographed — but
  // `hasCamera` is set on **at most three `kind === 'tourist'` records and
  // nowhere else in the game**, and that roster is Sydney's. So the one channel
  // that pays a player for being a calm animal rather than a menace existed in
  // ONE chapter of nineteen, on three people.
  //
  // What item 3 asks for and this deliberately does NOT do is the APPROACH.
  // A local never writes its own `x`/`z` — locals are fixed, on purpose, and
  // this file says why: "a local is placed by hand behind a specific counter".
  // Walking them is a locomotion system, not a three-hour batch, and half a
  // walk is worse than none. They turn, they raise the camera, they take the
  // picture. See CONTRACT.md for the cost of the other half.
  const npcPHOTO_REST  = 6.5;   // s of loafing before anybody reaches for a phone
  const npcPHOTO_NEAR  = 3.0;   // m — inside this you are too close to frame
  const npcPHOTO_FAR   = 11.0;  // m — the tourists' own band
  const npcPHOTO_COOL  = 90;    // s per person
  // ...and the jitter at birth, so a square does not photograph you in unison
  // the first time you sit down. It was half the cooldown, which is up to
  // forty-five seconds of nobody noticing a capybara that has plainly sat
  // down — long enough to read as the feature not existing.
  const npcPHOTO_FIRST = 12;
  const npcPHOTO_HOLD  = 1.9;   // s the whole gesture lasts
  const npcPHOTO_SNAP  = 0.85;  // s in, the flash — the tourists' timing
  const npcPHOTO_ARM   = 1.55;  // rad the arms come up. A phone, not a salute.
  const npcPHOTO_HEAT  = 0.50;  // over this the square is too cross to admire you
  const npcLOC_PHOTO = ['Hold still. Hold still.', 'Nobody is going to believe this.',
    'Look at it. Just look at it.', 'One picture. One.',
    'It is not even bothered.', 'That is going on the internet.',
    'My sister will not believe me.', 'It has been there ten minutes.'];
  // ---- ...AND THE ONE FOR WHEN SOMETHING IS SITTING ON IT (N2) -----------
  //
  // THE PERCH is the best frame this game composes and the people in it had
  // exactly one thing to say about a capybara with a heron on its back, which
  // was the same eight lines they say about a capybara. This is not a new
  // gesture — it is the same photograph, with a different caption and a
  // shorter wait, because the picture is ALREADY THERE and nobody stands
  // around for six and a half seconds waiting for a bird to still be on a
  // rodent. See npcPHOTO_REST_ON.
  //
  // The lines are about the passenger and never about the capybara: what is
  // funny is that the animal is not reacting, which is the one thing this
  // whole game has been consistent about.
  const npcLOC_PERCH = ['There is something on it.', 'Does it know?',
    'It has not moved. Neither has that.', 'How long has that been there?',
    'That is not its. That belongs to somebody.',
    'They are just going to stay like that, are they.',
    'I have so many questions.', 'Neither of them is bothered.'];
  // 6.5 s for a plain loaf, and a quarter of that when something is riding.
  const npcPHOTO_REST_ON = 1.6;
  /**
   * IS SOMETHING RIDING ON THE ANIMAL. Guarded because this module is created
   * BEFORE systems.js is (…npcs → systems), which is the same lazy-null-check
   * `addCritter` and `herdOffer` both need — a straight call here is a
   * TypeError on the first frame, and the herd offer was silently skipped for
   * a whole version for exactly this reason.
   */
  function npcPerchOn() {
    return typeof game.perchCount === 'function' && game.perchCount() > 0;
  }
  // ---- SOMEBODY GIVES YOU SOMETHING (B8, item 3) -------------------------
  //
  // THE FIRST GIFT IN THE GAME. Everything else a person does to the capybara
  // is a reaction to something it did; this is the only thing anybody hands it.
  //
  // MEASURED FIRST: ten of the nineteen chapters build NO edible prop at all —
  // Iceland, Marrakech, the Drift, Venice, Palawan, Cappadocia, Manly, Sơn
  // Đoòng, Antarctica and Monte Carlo — so `graze`, and the produce reaction
  // behind it, were unreachable in more than half the game. (The item guessed
  // "eleven, or 6 of 17", two different numbers in one sentence; it is ten.)
  //
  // And the gate is reachable, which a gift hung off an unreachable number
  // would not be: `qa/fam-reach.js` puts `fam` past 0.45 in about fifteen
  // seconds of standing about in Venice and Cappadocia, and about twenty-five
  // in Marrakech, whose calm sits at 0.53 and halves the rise exactly as the
  // arithmetic says it should.
  const npcGIFT_FAM   = 0.45;   // = npcFAM_HEAT: the bar for "somebody I know"
  const npcGIFT_NEAR  = 2.2;    // m — closer than this and it lands behind you
  const npcGIFT_FAR   = 9.0;    // m — further and it is a throw, not a gift
  const npcGIFT_COOL  = 150;    // s per person. A gift that repeats is feeding.
  const npcGIFT_ARM   = 1.15;   // rad — the underarm lob
  const npcGIFT_HOLD  = 1.25;   // s of gesture
  const npcGIFT_LET   = 0.55;   // s in, it leaves the hand
  const npcGIFT_UP    = 3.1;    // m/s of loft. It arcs; it is not thrown at you.
  const npcLOC_GIFT = ['Here. Go on.', 'You have earned that.',
    'Do not tell anybody.', 'Go on then. Have it.',
    'It was going spare.', 'You have been very good.',
    'Do not make a habit of this.', 'That is the last one.'];
  // ---- THE PAT (B8, item 3) ---------------------------------------------
  // The smallest of the three and the only one that is not counted anywhere,
  // which is the item's own instruction: *nothing is scored*. Stand close to
  // somebody who knows you, do nothing for four seconds, and they reach down.
  //
  // The ear flick the item also asks for is NOT here: capybara.js publishes no
  // ear, and adding one to reach it is a rig change for a fifth of a second of
  // motion. Written down rather than quietly dropped.
  const npcPAT_FAM   = 0.45;
  const npcPAT_REST  = 4.0;    // s — shorter than the photo's: you are already there
  const npcPAT_R     = 1.9;    // m — arm's length over a counter
  const npcPAT_COOL  = 45;
  const npcPAT_HOLD  = 1.6;
  const npcPAT_ARM   = 0.62;   // rad DOWN, which on this rig is positive
  const npcLOC_PAT = ['There. Good.', 'All right. All right.',
    'You are a very large animal.', 'Yes. Hello.',
    'Do not get comfortable.', 'Look at the state of you.',
    'Right. That is enough of that.'];
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
  // ---- THE INCIDENT, FROM THIS SIDE (v37) --------------------------------
  //
  // systems.js decides WHEN — three things you did that somebody saw, in one
  // place, inside twelve seconds; see THE INCIDENT there. This decides what it
  // SOUNDS LIKE, which is this file's half of every other reaction in the game.
  //
  // Three casts and therefore three routes, which is the shape every reaction
  // in this module has had since v30: `locals` covers seventeen chapters, and
  // Sydney and Pasto predate `addLocal` and have their own. Nobody is built,
  // no state machine is touched, nothing is denied: a person turns and says one
  // line, and at most two of them do.
  function npcOnIncident(p) {
    const x = p && p.x, z = p && p.z;
    if (typeof x !== 'number' || x !== x) return;
    // The seventeen. A wider radius than a bang gets — an incident is a thing
    // the whole corner has noticed, not a noise one person was standing next to.
    localsReact('incident', x, z, 0.5, npcLOC_REACT_R * 1.7);
    const live = game.biome && game.biome.current;
    if (live !== 'sydney' && live !== 'pasto') return;
    const cast = live === 'sydney' ? humans : paHumans;
    const arr = live === 'sydney' ? npcINC_SYD : npcINC_PA;
    // The two nearest who are free to speak, and no more. Two is the same
    // ceiling npcLOC_REACT_N sets for the locals and it is there for the same
    // reason: three people saying it at once is a chorus.
    let said = 0;
    const r2 = 24 * 24;
    for (let i = 0; i < cast.length && said < 2; i++) {
      const r = cast[i];
      if (!r || !r.group || !r.group.visible || (r.talkCd || 0) > 0) continue;
      if (r.state === 'flee' || r.state === 'plunge' || r.state === 'swim') continue;
      const dx = r.group.position.x - x, dz = r.group.position.z - z;
      if (dx * dx + dz * dz > r2) continue;
      r.talkCd = rand(10, 22);
      r.lookX = x; r.lookZ = z;
      r.speak(arr[randInt(0, arr.length - 1)]);
      said++;
    }
  }
  game.events.on('capy:incident', npcOnIncident);

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
    // ---- ...AND IT ARMS THE CHAIN (F2) -----------------------------------
    // This was `localLine`, the quiet door, so finishing a task in front of a
    // square moved exactly one head — at the one moment a chapter is FOR, and
    // the one the game stages in the largest open space it has (npcLOC_WOW_R
    // is 40 m for that reason). Every other reaction in the file that is worth
    // a second look goes through `localReactLine`; this is the reaction most
    // worth one.
    localReactLine(best, arr);
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
  // =======================================================================
  // BLAME (B13, ROADMAP-FUN item 5c)
  // =======================================================================
  //
  // The joke is not that they saw you. It is that they did not see WHO, and
  // the nearest two people are now having an argument about it while the
  // actual culprit stands there watching.
  //
  // ARMED FROM `localsReact` AND NOT FROM `npcWitnessChain`, which is where
  // the item points. `npcWitnessChain` opens with
  // `if (live !== 'sydney' && live !== 'pasto') return 0` — it is a
  // two-chapter function, and blame armed there would have been a two-chapter
  // feature. `localsReact` is the chapter-neutral one, it already computes
  // `mine` (was the animal near enough for this to be its doing), and it
  // already picks out the loudest reactor. Fifth time this pass that the
  // published-looking hook was the narrow one.
  //
  // Measured first: **thirty-three `addExchange` pairs across sixteen
  // chapters**, so there is somebody to blame somebody else nearly
  // everywhere.
  //
  // NO LINE HERE NAMES WHAT WAS DONE, and none of them names the animal.
  // Every pair has to work over a smashed bowl, a spilled sack, a bin on its
  // side and a flock going up — which rules out naming any of those, and what
  // is left is what people actually say when something has happened and
  // nobody will admit to it. The accusation is always of the WRONG PERSON:
  // that is the whole of the item.
  const npcBLAME = [
    ['That was you.',                        'That was not me.'],
    ['You did that.',                        'I have been standing here.'],
    ['I saw you.',                           'You saw nothing.'],
    ['Was that you?',                        'Why would it be me?'],
    ['It was somebody.',                     'It was not this somebody.'],
    ['You were nearest.',                    'Nearest is not the same as guilty.'],
    ['Do not look at me.',                   'I am looking at you.'],
    ['Somebody is going to have to own up.', 'Somebody is.'],
    ['Well, that was not me.',               'Nobody said it was.'],
    ['I know what I saw.',                   'You do not.'],
    ['Right. Whose was that?',               'Not mine.'],
    ['You are going to blame me for that.',  'I am considering it.'],
  ];
  const npcBLAME_R    = 22;   // m from the event to a pair, either member
  const npcBLAME_COOL = 26;   // s before another pair can be armed anywhere
  const npcBLAME_SOON = 3.5;  // s — the argument starts while it is still fresh
  const npcBLAME_KEEP = 22;   // s an armed accusation waits before it is dropped
  let npcBlameCool = 0;
  let npcBlameN = 0;      // accusations made, for exAudit

  /**
   * Give the nearest exchange pair something to argue about. Once, and the
   * next thing they say is the accusation — `X.blame` is consumed by
   * npcExStep rather than pushed into the bag, so it cannot come round again
   * later out of context.
   */
  function localBlameArm(x, z) {
    if (npcBlameCool > 0 || !npcEX.length) return false;
    const live = game.biome && game.biome.current;
    if (!live) return false;
    let best = null, bd = npcBLAME_R * npcBLAME_R;
    for (let i = 0; i < npcEX.length; i++) {
      const X = npcEX[i];
      if (X.biome !== live || X.blame) continue;
      const da = (X.a.x - x) * (X.a.x - x) + (X.a.z - z) * (X.a.z - z);
      const db = (X.b.x - x) * (X.b.x - x) + (X.b.z - z) * (X.b.z - z);
      const d2 = Math.min(da, db);
      if (d2 < bd) { bd = d2; best = X; }
    }
    if (!best) return false;
    best.blame = npcBLAME[randInt(0, npcBLAME.length - 1)];
    // Brought forward: an accusation half a minute later is a non sequitur.
    if (best.t > npcBLAME_SOON) best.t = rand(1.2, npcBLAME_SOON);
    // ...AND THEIR MOUTHS ARE CLEARED, which is the difference between a
    // mechanic that works and one a player will ever hear. MEASURED: the
    // arming fired in five chapters of five and the accusation was SAID in
    // one, because the same event that armed it had just made one of the pair
    // say 'Whoa —' through localsReact, and npcExStep will not start an
    // exchange while either mouth is on its cooldown — which is `cool`, and
    // `cool` defaults to thirteen seconds. Whatever they were going to say
    // next matters less than the argument they are about to have.
    best.a.cd = 0; best.b.cd = 0;
    // ...and it does not keep. An accusation that finds its window ninety
    // seconds later is attached to nothing, and the player has walked off.
    best.blameT = npcBLAME_KEEP;
    npcBlameCool = npcBLAME_COOL;
    return true;
  }

  function npcExStep(dt) {
    if (npcBlameCool > 0) npcBlameCool -= dt;
    for (let i = 0; i < npcEX.length; i++) {
      const X = npcEX[i];
      if (!X.blame) continue;
      X.blameT -= dt;
      if (X.blameT <= 0) { X.blame = null; X.blameDrop = (X.blameDrop || 0) + 1; }
    }
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
      const da = Math.hypot(cp.x - X.a.x, cp.z - X.a.z);
      const db = Math.hypot(cp.x - X.b.x, cp.z - X.b.z);
      const near = Math.min(da, db);
      // ---- AN ACCUSATION IGNORES THE FLOOR AND THE MOUTHS (B13) --------
      // MEASURED, and it is the difference between a mechanic that works and
      // one nobody will ever hear: the arming fired in five chapters of five
      // and the accusation was said in ONE, and the audit's gate columns say
      // why — `near` was 3.2, 5.3 and 3.9 m against npcEX_MIN's 6.
      //
      // npcEX_MIN exists so an ordinary exchange is never mistaken for being
      // about the player ("nearer than this and it is about you"). An
      // accusation IS about the player, and the whole joke is that it happens
      // while they are standing there. The ceiling still applies — you have to
      // be able to read the bubbles — and so does the pair's own clock. The
      // mouths do not: whatever either of them was going to say next matters
      // less than the argument they are about to have.
      if (X.blame) {
        if (near > npcEX_MAX) { X.t = rand(2, 5); }
        else {
        // ---- B13: THE ACCUSATION JUMPS THE BAG -------------------------
        // Consumed here rather than pushed into the bag, so it is said once,
        // now, and can never come round again three minutes later attached to
        // nothing. `blameN` is the only thing about this that is visible from
        // outside — see exAudit.
        {
          X.said = X.blame;
          X.blame = null;
          X.blameN = (X.blameN || 0) + 1;
          npcBlameN++;
          X.a.cd = X.a.cool * rand(0.6, 1.1);
          localLine(X.a, [X.said[0]]);
          // ...and they turn to each other, exactly as an ordinary exchange
          // does. That is the tell that this is two people arguing and not two
          // people addressing the animal — which matters more here than
          // anywhere else in the file, because the animal did it.
          X.a.flYaw = Math.atan2(X.b.x - X.a.x, X.b.z - X.a.z); X.a.flV -= 2.2;
          X.b.flYaw = Math.atan2(X.a.x - X.b.x, X.a.z - X.b.z); X.b.flV -= 2.2;
          X.step = 1;
          X.t = 1.6 + X.said[0].length * 0.035;
        }
        }
        continue;
      }
      if (X.a.cd > 0 || X.b.cd > 0) { X.t = rand(2, 5); continue; }
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

  // One photograph at a time per chapter (B7). Six people pointing a phone at a
  // rodent in unison is a press conference; the joke is that it is ordinary.
  let locPhotoLive = 0;

  /**
   * LOB A SNACK TO THE CAPYBARA (B8). Returns the prop, or null.
   *
   * A real dynamic prop and not an effect: the whole point is that the thing
   * lands, sits there, can be eaten, kicked, carried off or dropped in the
   * canal — `graze` and the produce reaction were unreachable in ten of the
   * nineteen chapters because those chapters build nothing edible at all.
   *
   * Thrown from the HAND and not from the person's origin, and thrown UNDERARM:
   * the vertical term is what makes it read as a gift rather than as something
   * being got rid of. `physRHO.snack` is 420, so the eight chapters with water
   * in them get one that floats.
   */
  function giveSnack(rec, tx, tz) {
    if (!game.physics || typeof game.physics.spawnProp !== 'function') return null;
    const yaw = rec.yaw0 || 0;
    // Out of the hand: forward of the chest and off to the throwing side.
    const hx = rec.x + Math.sin(yaw) * 0.34 + Math.cos(yaw) * 0.20;
    const hz = rec.z + Math.cos(yaw) * 0.34 - Math.sin(yaw) * 0.20;
    let p = null;
    // `restY` keeps it out of the floor on a deck or a jetty; the body is made
    // dynamic immediately below, so the resting height is only a starting point.
    try { p = game.physics.spawnProp('snack', hx, hz, rec.y + 1.15); } catch (e) { p = null; }
    if (!p || !p.body) return null;
    const dx = tx - rec.x, dz = tz - rec.z;
    const d = Math.hypot(dx, dz) || 1;
    // Enough forward speed to cover the gap in about the time the arc takes.
    // Not aimed AT the animal: a gift that hits you is a projectile, so it is
    // thrown to land just short and roll the rest of the way.
    const v = Math.min(6.5, d * 0.9);
    p.body.wakeUp();
    p.body.velocity.set(dx / d * v, npcGIFT_UP, dz / d * v);
    p.body.angularVelocity.set(rand(-2, 2), rand(-2, 2), rand(-2, 2));
    // It is NOT theirs once it has left the hand. `owner` is what makes
    // somebody come and fetch a thing back, and the one object in this game
    // that is given away must not be the one they chase you for.
    p.owner = null;
    p.disturbed = true;
    emit('npc:gift', rec);
    sfx('rustle', rec, 0.5);
    return p;
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
    // ---- B7: how long the animal has been doing nothing ------------------
    // `capy.restT` is capybara.js's own loaf clock — the same list as the calm
    // with `heldProp` taken out of it — so a capybara standing still holding
    // somebody's hat does not get photographed for it.
    const capyOk = !!(capy && capy.position);
    const capyRest = capy ? (capy.restT || 0) : 0;
    if (locPhotoLive > 0) locPhotoLive -= dt;
    const wxRain = npcWxRain, wxGustS = npcWxGustS, wxGustX = npcWxGustX;
    const wxGustZ = npcWxGustZ, wxMotes = npcWxMotes, wxCold = npcWxCold;
    // Read ONCE for the whole population, for the same reason the weather is:
    // it is the same number for all of them and asking systems.js a hundred
    // and ten times a frame for one float is the cost that only shows up in
    // the chapter with the most people in it. See THE CALM in systems.js.
    const calmNow = typeof game.calm === 'function' ? game.calm() : 0;
    // ...and THE FLOW, read once for the whole population for exactly the same
    // reason. See npcFLOW_LOOK. `game.state.flow` is written unconditionally
    // every frame by systems.js, but this module is `mainSafe`d against a
    // systems.js that is older or has thrown, so it defaults to zero — which
    // is the no-op.
    const flowNow = (game.state && game.state.flow) || 0;
    // ...and whether this place was expecting you (see npcNOTO_TIER). A scalar
    // read once for the whole population, like the flow and the calm — and a
    // SCALAR rather than a per-person field precisely so that the order the
    // two modules' `biome:enter` handlers run in cannot matter: this one is
    // cleared and re-armed by npc.js's own handler and the tier is set by
    // systems.js whenever it likes, one frame either way.
    if (npcNotoT > 0) npcNotoT -= dt;
    const notoNow = (npcNotoT > 0 && npcNotoTier >= npcNOTO_TIER) ? 1 : 0;
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
      // ---- ...AND THE OTHER MOUTH CLOCK, WHICH NOTHING HAS EVER RUN (O1) --
      // `talkCd` is what stops an ADDRESSED line interrupting a person, and
      // it is set on a local in exactly two places: saySomebodyNear, which is
      // how B15’s rumour and every game.sayNear line finds a mouth, and THE
      // REGULARS’ own armed line. It has never been decremented anywhere but
      // `stepHuman` — which is Sydney’s and Pasto’s roster, and no local has
      // ever been through it. The field is not even in the local record’s
      // initialiser; it appears the first time somebody is picked, and it
      // stays.
      //
      // SO EVERY LOCAL IN SEVENTEEN CHAPTERS HAD ONE ADDRESSED LINE IN THEM,
      // for the life of the session. MEASURED: talkCd 20.0 for forty
      // unbroken seconds two metres from the person, with the game running.
      // sayNear picks the nearest FREE speaker, so it walks outward through
      // the cast one line each and a chapter you keep coming back to goes
      // quiet from the middle out — which is invisible, because a line that
      // is never said looks exactly like a line that was not armed.
      //
      // Found by THE REGULARS, whose whole surface is an addressed line said
      // by one named person on every arrival, and which therefore hit the
      // ceiling on the second visit rather than the twentieth.
      if (r.talkCd > 0) r.talkCd -= dt;
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
      // ---- ...AND SO DOES THE PLACE THEY ARE STANDING IN (v33) ----------
      // One read per person per frame, reused by the watch radius, the wary
      // register and the guard below. It is a sweep of at most npcHEAT_SITES
      // points, which is why the field is a handful of sites and not a grid.
      if (r.gdT > 0) r.gdT -= dt;
      const hHere = npcHeatAt(r.x, r.z);
      const nearR = r.near * (1 + (r.wary || 0) * (npcWARY_NEAR - 1));
      const near = d2 < nearR * nearR;
      // ...and they have a line for it, once, when you come back into range.
      // ---- 2e: AND THE HIGHER REGISTER COMES SOONER WHERE IT IS HOT ------
      // `npcWARY_HEAT` is the bar between "there is an animal" and "it is that
      // animal again", and in a square that has had four minutes of you it is
      // a lower bar. It is still the SAME line from the SAME pool — heat does
      // not add a register, it reaches the one that was already written.
      const waryBar = npcWARY_HEAT * (1 - hHere * npcHEAT_SOON);
      const nearNow = near && (r.wary || 0) > waryBar;
      if (nearNow && !r.waryWas && r.cd <= 0) {
        const arr = npcSay(r, 'wary');
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
      // ---- ...AND SOMEBODY TAKES A PICTURE (B7) ---------------------------
      //
      // The whole of "sit, and be noticed" that a fixed person can do. Ordered
      // below everything: a flinch, a guard, an errand and a conversation all
      // win, which is the rule item 3 asks for ("`photo` sits below every state
      // in `npcREACH_ST`") expressed in the locals' own additive pose stack
      // rather than in a state machine they do not have.
      //
      // The heat gate is the interlock the item is really about: **nobody
      // photographs you while the square is cross**, so a player who caused a
      // SCENE cannot be adored until it cools — and can cool it by doing
      // exactly what earns the photo, which is nothing at all.
      if (r.snapT > 0) {
        r.snapT -= dt;
        // The flash leaves the RIGHT HAND, which is where the arms have just
        // put the phone — not the head, and not the feet.
        if (!r.snapped && r.snapT <= npcPHOTO_HOLD - npcPHOTO_SNAP) {
          r.snapped = true;
          fireFlash(r.x + Math.sin(r.yaw0 || 0) * 0.3, r.y + 1.28,
                    r.z + Math.cos(r.yaw0 || 0) * 0.3);
          emit('npc:photo', r);
          // The RECORD and not a point: npc.js's own `sfx` reads
          // `rec.group.position` and stamps the speaker's `vpitch`, so a bare
          // `{x, y, z}` would place the shutter nowhere and give every person
          // in the game the same voice. Nothing listens to `npc:photo` today —
          // both emitters are in this file — so this is the only observable.
          sfx('pop', r);
        }
        if (r.snapT <= 0) { r.snapT = 0; r.snapped = false; }
      } else if (r.photoCd > 0) {
        r.photoCd -= dt;
      // `r.fl` and NOT `f`: the flinch is read as `const f = -r.fl` a hundred
      // lines below this, inside the `if (r.fig)` pose block, so naming `f`
      // here is a ReferenceError in a temporal dead zone — one that the `&&`
      // chain hid completely, because `r.cd <= 0` short-circuited before ever
      // reaching it. It would have fired the first time somebody's mouth was
      // free. Measured as a gate that never opened; found by reading the gates
      // one at a time when the probe returned zero everywhere.
      //
      // No `r.hud` term either. The huddle is a POSTURE — Venice sits at 0.051
      // all day, which put every person in the chapter permanently the wrong
      // side of a 0.05 threshold — and somebody slightly hunched against the
      // cold can still hold up a phone.
      //
      // And `cd` is not in here: `cd` is the SPEECH cooldown, it is 8-13 s for
      // most of a local's life because they chat every 11 to 28 seconds, and
      // coupling the gesture to it made the photograph a rare accident. The
      // picture is taken either way; only the LINE waits for a free mouth.
      } else if (r.fig && capyOk && locPhotoLive <= 0 &&
                 capyRest >= (npcPerchOn() ? npcPHOTO_REST_ON : npcPHOTO_REST) &&
                 d2 > npcPHOTO_NEAR * npcPHOTO_NEAR &&
                 d2 < npcPHOTO_FAR * npcPHOTO_FAR &&
                 (r.wary || 0) < npcWARY_HEAT && hHere < npcPHOTO_HEAT && r.sat <= 0 &&
                 !r.own && r.gest <= 0 && (r.fl || 0) > -0.02) {
        // One at a time in a chapter. Six people photographing a rodent at once
        // is a press conference, and the joke is that it is ordinary.
        locPhotoLive = npcPHOTO_HOLD + 0.4;
        r.snapT = npcPHOTO_HOLD;
        r.snapped = false;
        r.photoCd = npcPHOTO_COOL * rand(0.85, 1.25);
        r.chatYaw = Math.atan2(cx - r.x, cz - r.z);
        r.yaw0 = r.chatYaw;
        r.chatT = npcPHOTO_HOLD + 0.8;
        // The line only if the mouth is free. A photograph taken in silence is
        // a person taking a photograph; a line that jumps the speech queue is
        // this feature talking over the chapter's own dialogue.
        if (r.cd <= 0) {
          r.cd = r.cool * rand(0.8, 1.4);
          // A passenger overrides the chapter's own photo pool, and that is
          // deliberate: a Venetian's line about a capybara is written about a
          // capybara, and there is a bird on it.
          localLine(r, npcPerchOn() ? npcLOC_PERCH : (npcSay(r, 'photo') || npcLOC_PHOTO));
        }
      }
      // ---- ...AND SOMEBODY GIVES YOU SOMETHING (B8) ------------------------
      // Same shape as the photograph and the same gates, plus `fam`: this one
      // is not for a stranger who thinks you are funny, it is for somebody who
      // has had you standing about for a quarter of a minute and decided.
      if (r.giftT > 0) {
        r.giftT -= dt;
        if (!r.gifted && r.giftT <= npcGIFT_HOLD - npcGIFT_LET) {
          r.gifted = true;
          giveSnack(r, cx, cz);
        }
        if (r.giftT <= 0) { r.giftT = 0; r.gifted = false; }
      } else if (r.giftCd > 0) {
        r.giftCd -= dt;
      } else if (r.fig && capyOk && r.snapT <= 0 &&
                 (r.fam || 0) >= npcGIFT_FAM &&
                 capyRest >= npcPHOTO_REST &&
                 d2 > npcGIFT_NEAR * npcGIFT_NEAR &&
                 d2 < npcGIFT_FAR * npcGIFT_FAR &&
                 (r.wary || 0) < npcWARY_HEAT && hHere < npcPHOTO_HEAT && r.sat <= 0 &&
                 !r.own && !r.heldProp && r.gest <= 0 && (r.fl || 0) > -0.02) {
        r.giftT = npcGIFT_HOLD;
        r.gifted = false;
        r.giftCd = npcGIFT_COOL * rand(0.9, 1.3);
        r.chatYaw = Math.atan2(cx - r.x, cz - r.z);
        r.yaw0 = r.chatYaw;
        r.chatT = npcGIFT_HOLD + 1.2;
        if (r.cd <= 0) {
          r.cd = r.cool * rand(0.8, 1.4);
          localLine(r, npcSay(r, 'gift') || npcLOC_GIFT);
        }
      }
      // ---- ...AND THE PAT (B8) --------------------------------------------
      // Closer than the gift and shorter than the photo, and it happens INSIDE
      // the other two's dead zones — `npcGIFT_NEAR` is 2.2 m and the photo's
      // band starts at 3.0, so standing right beside somebody is the one place
      // neither of those can fire. That is deliberate: the three of them tile
      // the distance from nought to eleven metres and never overlap.
      if (r.patT > 0) {
        r.patT -= dt;
        if (!r.patted && r.patT <= npcPAT_HOLD * 0.5) {
          r.patted = true;
          sfx('rustle', r, 0.28, 0.8);
        }
        if (r.patT <= 0) { r.patT = 0; r.patted = false; }
      } else if (r.patCd > 0) {
        r.patCd -= dt;
      } else if (r.fig && capyOk && r.snapT <= 0 && r.giftT <= 0 &&
                 (r.fam || 0) >= npcPAT_FAM && capyRest >= npcPAT_REST &&
                 d2 < npcPAT_R * npcPAT_R &&
                 (r.wary || 0) < npcWARY_HEAT && hHere < npcPHOTO_HEAT && r.sat <= 0 &&
                 !r.own && r.gest <= 0 && (r.fl || 0) > -0.02) {
        r.patT = npcPAT_HOLD;
        r.patted = false;
        r.patCd = npcPAT_COOL * rand(0.9, 1.3);
        r.chatYaw = Math.atan2(cx - r.x, cz - r.z);
        r.chatT = npcPAT_HOLD + 0.9;
        if (r.cd <= 0) {
          r.cd = r.cool * rand(0.8, 1.4);
          localLine(r, npcSay(r, 'pat') || npcLOC_PAT);
        }
      }
      // ---- ...AND A CROSS PLACE IS SLOWER TO WARM TO YOU (B8) -------------
      // The other half of the interlock. `wary` already stops the rise dead —
      // that is the PERSON remembering — and this is the PLACE: a square that
      // has had four minutes of you warms at half rate even from somebody who
      // personally saw nothing. It is a multiplier and not a gate, so nothing
      // is ever blocked, which is the rule item 3 sets for both economies.
      const famRate = hHere >= npcPHOTO_HEAT ? 0.5 : 1;
      if (near && calmNow > 0.25 && (r.wary || 0) < npcWARY_HEAT) {
        r.fam += (dt / npcFAM_T) * calmNow * famRate;
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
        const arr = npcSay(r, 'fam');
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
          const arr = npcSay(r, 'rush');
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
            localLine(r, npcSay(r, 'drift'));
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
          localLine(r, npcSay(r, raining ? 'drizzle' : 'clearing'));
        }
      }
      const chilly = wxCold > 0 && wxGustS > npcLOC_CHILL_G;
      if (chilly !== r.chillWas) {
        r.chillWas = chilly;
        if (chilly && r.cd <= 0 && Math.random() < 0.3) {
          r.cd = r.cool * rand(1.0, 1.8);
          localLine(r, npcSay(r, 'chill'));
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
        } else if (r === marWho) {
          // ---- ...AND THE MARCH SITS BESIDE IT, ON THE SAME TERMS --------
          // Below retrieval and above the shuffle. A person already walking
          // out for their own hat is not also coming to have a word with you
          // about the chain — `marFree` refuses anybody with `own` set, so
          // these two can never both be true, and the ordering here is belt
          // and braces rather than a rule.
          marStep(r, dt);
        } else {
          if (r.marCool > 0) r.marCool -= dt;
          if (r.ownCool > 0) r.ownCool -= dt;
          r.stepT -= dt;
          if (r.stepT <= 0) {
            r.stepT = npcLOC_STEP_GAP * rand(0.45, 2.1);
            // A new spot, measured from the ANCHOR and never from where they
            // have got to — which is what stops a random walk from wandering off
            // across the square one step at a time.
            npcLocalSpot(r);
            // ---- 2b: …UNLESS THEY HAVE SOMETHING TO STAND IN FRONT OF ----
            // Points the shuffle instead of replacing it, inside the same
            // envelope, and refuses to close on the stock itself. See
            // npcHeatGuard.
            npcHeatGuard(r, hHere);
          }
        }
        const sx = r.tx - r.x, sz = r.tz - r.z;
        const sd = Math.sqrt(sx * sx + sz * sz);
        if (sd > 0.012) {
          // THE MARCH WALKS AT RETRIEVAL SPEED, for the same reason retrieval
          // does: somebody crossing a square on purpose does not shuffle.
          const step = Math.min(sd, (r.own || r === marWho ? npcOWN_V : npcLOC_STEP_V) * dt);
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
          // ...and the march follows the ground for the same reason retrieval
          // does: it can go fifteen metres, and four chapters are not flat.
          const away = r.own || r === marWho ||
                       (r.x - r.ax) * (r.x - r.ax) + (r.z - r.az) * (r.z - r.az)
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
              r.body.aabbNeedsUpdate = true;   // static: see the note below
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
            // ...AND THE BROADPHASE HAS TO BE TOLD, or the person is solid at
            // their SPAWN POINT for the rest of the chapter and walk-through
            // everywhere they actually go.
            //
            // A local is `mass: 0` with no `type`, which cannon defaults to
            // STATIC. `aabbNeedsUpdate` is raised inside Body.integrate
            // (vendor/cannon-es.js:3932) and integrate returns early for
            // anything not DYNAMIC or KINEMATIC (:3892), so a static body moved
            // by a position write NEVER refreshes its AABB — and SAP only
            // recomputes one when this flag is up (:5506). Writing the three
            // position fields moves the collider and leaves the box the
            // broadphase tests against sitting where the person used to stand.
            //
            // Measured: a Hanoi local in the `own` state let the animal pass
            // clean through — closest approach 0.24 m, and 0.88 m out the far
            // side — while every stationary local in the same chapter stopped
            // it at 0.60-0.92 m. Retrieval sends them up to nine metres.
            r.body.aabbNeedsUpdate = true;
          }
        } else r.moving = 0;
      }
      // ---- they watch you go past --------------------------------------
      if (r.group) {
        // Twice the talking radius: you are noticed a long way before you are
        // spoken to, which is how being looked at actually works.
        // ---- 2a: AND FURTHER STILL WHERE THE PLACE IS HOT (v33) ----------
        // This is the head-turn, and it was the ONE radius in the reaction
        // layer that `wary` never touched — a person who remembered you
        // watched you from further out only in the sense that they had a line
        // about it. Heat is what actually widens the circle of faces pointed
        // at the animal, which is the whole of 2a and is worth nothing unless
        // it is this number.
        // ---- ...AND FURTHER AGAIN WHEN THE ANIMAL IS MOVING WELL ---------
        // See npcFLOW_LOOK. Multiplied rather than added, and multiplied onto
        // the heat term rather than beside it, because the two are the same
        // kind of fact about the same radius: a market that is already looking
        // at you does not stop when you start running.
        const watchR = r.near * 2 * (1 + hHere * (npcHEAT_LOOK - 1))
                                  * (1 + flowNow * (npcFLOW_LOOK - 1))
                                  * (1 + notoNow * (npcNOTO_LOOK - 1));
        const inR = d2 < watchR * watchR;
        // ...AND IT GOES ON AFTER YOU HAVE GONE. See npcFLOW_HOLD. Armed while
        // the animal is inside the widened circle AND moving well, and it is
        // the arming that is gated on the flow rather than the holding — a
        // player who breaks their line two metres past somebody does not get
        // their head snapped back round mid-turn.
        if (inR && flowNow > npcFLOW_SEE) r.flowSeen = npcFLOW_HOLD;
        else if (r.flowSeen > 0) r.flowSeen -= dt;
        const watch = (inR || r.flowSeen > 0) && d2 > 0.25;
        r.watching = watch ? 1 : 0;
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
        // ---- ...AND WHAT THEY ARE ACTUALLY DOING (D7) --------------------
        // See A PERSON WITH A JOB. It runs HERE rather than down in the arm
        // block because one of the three shapes — `rock` — is a shift of
        // weight and not an arm at all, and the body's own two writes are
        // these. Rule 1 lives on `beatBusy`: talking, flinching, guarding,
        // fetching, holding an umbrella and walking all stop the job, and the
        // job is the only thing in this pose stack that yields to the rest
        // rather than adding to them.
        //
        // ...and `rock` is exempt from the two that are ARM conflicts, because
        // it is not an arm. A person can shift their weight while they are
        // talking to you and while they are holding an umbrella; they cannot
        // chop with the same arm they are gesturing with. This matters more
        // than it sounds: walking up to somebody makes them greet you, a line
        // is two to four seconds of `gest`, and the clock is four — so without
        // this exemption the job is least visible at exactly the moment
        // somebody is standing there looking at it.
        const armJob = r.beat && r.beat.kind !== 'rock';
        const beatBusy = f > 0.02 || r.grd > 0.05 || !!r.own || r.moving > 0 ||
                         (armJob && (r.gest > 0 || r.umb > 0.05));
        // ...and WHICH of the six, for beatAudit. A beat that is not happening
        // is either waiting or suppressed, and a suppressed one has six
        // possible reasons that are indistinguishable from outside.
        if (r.beat) {
          r.beatWhy = !beatBusy ? ''
            : f > 0.02 ? 'flinch' : r.grd > 0.05 ? 'guard' : r.own ? 'fetch'
            : r.moving > 0 ? 'walk' : r.gest > 0 ? 'talk' : 'umbrella';
        }
        // ---- B12: IS THE TOOL STILL THERE ------------------------------
        // Spawned lazily and asked every tick. Both are cheap and both have
        // to be here: a local is registered while its chapter is being built,
        // which is before props.js has a world to put anything in.
        if (r.beat && r.beat.tool) {
          if (!r.toolMade) localToolMake(r);
          const wasOut = r.toolOut;
          r.toolOut = localToolGone(r);
          // Coming back is the edge that re-arms the remark, and it is also
          // the whole of "put it back and they resume": nothing else has to
          // happen, because everything downstream asks `toolOut` every tick
          // rather than remembering a state.
          if (wasOut && !r.toolOut) r.toolSaid = false;
        }
        // ...and nobody carries on hammering while they are sitting on the
        // floor. The beat is the one thing a local does that has its own
        // clock, and it is the one that would look worst underneath a sit.
        const beat = (r.beat && r.fig && r.sat <= 0)
          ? localBeatStep(r, dt, beatBusy,
                          typeof game.calm === 'function' ? game.calm(r.x, r.z) : 0)
          : 0;
        // `rock` is a lean and nothing else — one sine over the action, so it
        // is a weight shift and back rather than a lurch.
        const rock = (r.beat && r.beat.kind === 'rock' && r.beatP >= 0)
          ? Math.sin(r.beatP * 6.283185) * npcBEAT_ROCK : 0;
        // ---- B11: THE STAGGER AND THE SIT (item 4e) ---------------------
        // Integrated here, beside the pose that reads them, and both are
        // additive terms on channels that already existed — no new node, no
        // new group, nothing to keep in step with the flinch.
        if (r.satCd > 0) r.satCd -= dt;
        if (r.sat > 0) {
          r.sat -= dt;
          if (r.sat < 0) r.sat = 0;
          r.stum = 0; r.stumV = 0;
        } else if (r.stum > 0.001 || Math.abs(r.stumV) > 0.001) {
          // Critically-damped, same shape as the flinch spring above it.
          r.stumV += (-npcSTUM_K * r.stum - npcSTUM_C * r.stumV) * dt;
          r.stum += r.stumV * dt;
          if (Math.abs(r.stum) < 0.004 && Math.abs(r.stumV) < 0.02) { r.stum = 0; r.stumV = 0; }
        }
        // The sit eases in fast and out slowly: going down is a fall and
        // getting up is a decision. `1 - x²` on the way out reads as somebody
        // pushing themselves back to their feet rather than being winched.
        const satK = r.sat > 0
          ? (r.sat > npcSIT_HOLD - 0.18
             ? (npcSIT_HOLD - r.sat) / 0.18
             : Math.min(1, r.sat / (npcSIT_HOLD * 0.55)))
          : 0;
        const stumA = Math.abs(r.stum);
        r.group.position.y = r.baseY + Math.sin(r.t * 1.15) * npcLOC_BOB
                             + r.mv * Math.abs(Math.sin(r.t * 7.4)) * npcLOC_STEP_BOB
                             - f * 0.045 - r.hud * 0.035
                             - stumA * npcSTUM_DIP - satK * npcSIT_DROP;
        r.group.rotation.x = -f * npcLOC_FL_LEAN + lean + r.hud * 0.06
                             - r.mv * 0.035 - satK * npcSIT_LEAN;
        r.group.rotation.z = rock + r.stum * npcSTUM_ROLL;
        // ---- AND THE LEGS SWING, ON THE BOB'S OWN PHASE (v55) -------------
        // `r.t * 7.4` is the step clock the bob one line up already runs on:
        // |sin| there is one dip per step, sin here is one swing per step with
        // the legs in antiphase, so a foot is planted at the bottom of every
        // dip. Any other phase and the figure bobs on one rhythm and steps on
        // another, which reads worse than not swinging at all.
        //
        // Scaled by r.mv, the same damped move flag, so a person who has
        // stopped closes their stance over about a sixth of a second instead of
        // freezing mid-stride. A SIT overrides it to zero: the legs are folded
        // under by npcSIT_DROP and a seated figure paddling is a puppet.
        if (r.fig && r.fig.legL) {
          const sw = r.mv * (1 - satK) * npcLOC_SWING * Math.sin(r.t * 7.4);
          r.fig.legL.rotation.x = sw;
          r.fig.legR.rotation.x = -sw;
        }
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
          // ---- B12: A LOOK AT THE HAND ---------------------------------
          // Positive is DOWN on this rig (the dip is positive), and a person
          // checking an empty hand looks down at it — so this is added, like
          // the dip and unlike the flinch. Only during the stroke, so it is a
          // glance at the thing that did not happen rather than a person who
          // has become permanently sad. It loses to the flinch for the same
          // reason everything else does.
          const hand = (r.toolOut && r.beatP >= 0)
            ? Math.sin(Math.min(1, r.beatP) * Math.PI) * npcTOOL_LOOK : 0;
          r.fig.head.rotation.x = damp(r.fig.head.rotation.x,
                                       dip - f * npcLOC_FL_HEAD
                                       - r.look * 0.62 + r.hud * 0.22 + hand,
                                       f > 0.02 ? 14 : 5, dt);
          // arms: a slow shift of weight, and one of them comes up while they
          // are actually talking — and BOTH come up, fast, on a flinch.
          if (r.gest > 0) r.gest -= dt;
          const sway = Math.sin(r.t * 0.83) * 0.07;
          const talk = r.gest > 0 ? 0.5 + Math.sin(r.t * 7.5) * 0.22 : 0;
          // ---- 2c: HANDS OVER THE STOCK (v33) ------------------------------
          // The npc.js half of "a door pulled to, a tray moved back": the
          // person whose stock it is puts their hands over it while the square
          // is hot. It rides the SAME two lines as the flinch's guard, so a
          // startled guard is both and neither fights the other, and it damps
          // in and out rather than latching — a pose that snaps is a glitch.
          // A quarter of the flinch's throw: this is a posture, not a recoil.
          r.grd = damp(r.grd, (hHere >= npcHEAT_GUARD && npcGuardSpot(r)) ? hHere : 0, 1.6, dt);
          const guard = f * npcLOC_FL_ARM + r.grd * npcHEAT_GD_ARM;
          const armL = f > 0.02 ? 22 : 4, armR = f > 0.02 ? 22 : 8;
          // THE ARM THAT IS HOLDING THE UMBRELLA CANNOT ALSO BE SWAYING. It
          // goes up and it stays there; the talking gesture is suppressed on
          // that side for as long as there is something in the hand, which is
          // what stops a person waving a canopy about while they speak.
          // ...and carrying a retrieved prop uses the same raised right arm as
          // the umbrella (F4), at half the throw: a hat held at the hip is not
          // a canopy held over the head. `max` rather than a sum, because they
          // are two reasons for ONE arm to be up and adding them would put it
          // through the shoulder in the rain.
          localOwnCarry(r, dt);
          const hold = Math.max(r.umb, r.carryW * 0.5);
          // ...and the huddle folds BOTH arms in across the body: rotation.z
          // toward the centre line, which on two boxes with no elbows is the
          // only crossed-arms available and reads correctly from six metres.
          const fold = r.hud;
          // The LEFT arm joins in only on a `reach`, because a reach is two
          // hands and a work stroke is one. That asymmetry is the whole
          // difference between somebody chopping and somebody surrendering.
          const beatL = (r.beat && r.beat.kind === 'reach') ? beat : 0;
          // ---- B7: BOTH ARMS UP, HOLDING A PHONE -------------------------
          // A subtraction like the guard and the umbrella, because on this
          // rig negative rotation.x is forward and up. It eases in over the
          // first third of the gesture and out over the last, so the picture
          // is taken at the top of a movement rather than at the start of one
          // — the flash fires at npcPHOTO_SNAP, which is inside that hold.
          //
          // It LOSES to everything: `f` (the flinch), `guard` and `hold` are
          // all still in the sum and all still larger, so a person who is
          // startled mid-photograph puts their hands up instead, which is the
          // right picture. That is the "below every state" rule the item asks
          // for, in the additive stack the locals actually have.
          const snapK = r.snapT > 0
            ? Math.min(1, Math.min(npcPHOTO_HOLD - r.snapT, r.snapT) / (npcPHOTO_HOLD * 0.3))
            : 0;
          // ...and the gift is the same envelope on ONE arm (B8): an underarm
          // lob is one hand, and using both would be a person throwing a ball
          // in from the boundary. `Math.max` and not a sum — a photograph and
          // a gift cannot happen at once (the gift's own gate refuses while
          // `snapT` is running) but the two terms share a limb and adding them
          // would put it through the shoulder if that ever changed.
          const giftK = r.giftT > 0
            ? Math.min(1, Math.min(npcGIFT_HOLD - r.giftT, r.giftT) / (npcGIFT_HOLD * 0.35))
            : 0;
          // The photo is TWO hands and the lob is ONE, which is the whole
          // difference between holding something up and throwing something.
          const snap = snapK * npcPHOTO_ARM;
          const snapR = Math.max(snap, giftK * npcGIFT_ARM);
          // ...and the pat goes the OTHER WAY. Down and forward is positive on
          // this rig, which is why it is added where the other two are taken
          // away — a reach and a raise are the same limb doing opposite things
          // and writing them as one signed term would hide that.
          const patK = r.patT > 0
            ? Math.min(1, Math.min(npcPAT_HOLD - r.patT, r.patT) / (npcPAT_HOLD * 0.35))
            : 0;
          const pat = patK * npcPAT_ARM;
          r.fig.armL.rotation.x = damp(r.fig.armL.rotation.x,
                                       sway - guard - fold * 0.42 + beatL - snap + pat,
                                       r.beatP >= 0 ? npcBEAT_LAM : armL, dt);
          r.fig.armR.rotation.x = damp(r.fig.armR.rotation.x,
                                       -sway - talk * (1 - hold) - guard
                                       - hold * npcLOC_UMB_ARM - fold * 0.42
                                       + beat - snapR + pat, r.beatP >= 0 ? npcBEAT_LAM : armR, dt);
          r.fig.armR.rotation.z = damp(r.fig.armR.rotation.z,
                                       -talk * 0.7 * (1 - hold) - f * 0.4
                                       - hold * 0.20 - fold * 0.34, armR, dt);
          r.fig.armL.rotation.z = damp(r.fig.armL.rotation.z,
                                       f * 0.4 + fold * 0.34, armL, dt);
          // ---- THE FACE (v54) ---------------------------------------------
          // Every input here already existed and none of it was drawn above
          // the neck: the flinch spring, the guard that goes up when the
          // square is hot, the errand that has them crossing the square to
          // pick their own crate up off the floor, and the huddle in the rain.
          //
          // The huddle counts as CROSS, at a third weight. Somebody caught in
          // a shower is not angry, but the eyes narrow the same way, and it is
          // the one mood input in this game that is nothing to do with the
          // capybara — which is exactly why it is worth having.
          const cross = Math.max(r.own ? 0.85 : 0, r.grd * 0.7, r.hud * 0.35);
          const mTgt = f > cross ? f : -cross;
          r.mood = damp(r.mood, mTgt, Math.abs(mTgt) > Math.abs(r.mood) ? 15 : 3.2, dt);
          npcFace(r.fig.face, r.mood, npcBlink(r, dt));
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
          localLine(b, npcSay(b, 'chatBack') || npcLOC_CHAT.back);
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
        // Through the resolver now (F2). `npcSay` answers `undefined` for a
        // kind no layer declares, so the shared pool is still the fallback and
        // no line changes until a chapter or a person is given one — see the
        // `chatOpen`/`chatBack` keys in addLocal.
        localLine(a, npcSay(a, 'chatOpen') || npcLOC_CHAT.open);
        locChatRec = b;
        locChatWhen = rand(1.4, 2.3);
        locChatT = rand(11, 28);     // ...and now the long one, so it is not a chorus
        return;
      }
    }
  }

  // =======================================================================
  // ...AND THE TWO OLDEST CASTS KNOW WHAT YOU HAVE DONE (v36)
  //
  // `localResolve` — the `{ t, after, before }` gate that lets a person say
  // something only once a task is ticked — has been the shape of every line in
  // seventeen chapters since v20, and its own design note says why: "a chapter
  // is a sequence of things happening and the people in it were outside time".
  //
  // It reached SIXTEEN of the nineteen. Sydney and Pasto predate `addLocal`
  // and their casts come out of `humans`/`paCast` and read `npcLINES`, a flat
  // table of strings that no gate has ever touched — so the two chapters with
  // the most tasks in the game (nineteen and eleven, and the largest single
  // list in it is Sydney's) were the two where nobody ever noticed anything.
  // That is the first hour of the game: the stretch where a player is deciding
  // whether the world is paying attention.
  //
  // One line of plumbing. `npcLINES` may now hold the same three forms every
  // other chapter's pool holds, `localResolve` filters them, and a pool with
  // no conditional entries in it resolves to itself and costs one pass over an
  // array of eight strings at the rate somebody says something.
  //
  // The never-twice guard still works, because it compares the RESOLVED
  // string against the last one — not an index into a list whose length now
  // changes as the chapter goes on.
  // =======================================================================
  function pickLine(npcRec, key) {
    const raw = npcLINES[key];
    if (!raw) return;
    const arr = localResolve(raw, npcRec);
    if (!arr.length) return;
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
    // matOwn, not mat().clone() — see [[clone eats the shader]]. The clone is
    // needed (this material is written per instance) but Material.copy() does
    // not carry onBeforeCompile, so the sail was one of the few opaque surfaces
    // in the harbour with no rim on it.
    const fm = matOwn(PALETTE.sail);
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
    const sm = matOwn(PALETTE.foam, { side: THREE_.DoubleSide });
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
  /**
   * ONE TICK OF SOMEBODY'S JOB. Returns the arm angle, 0 when idle.
   *
   * `busy` is rule 1: everything else this person could be doing, folded into
   * one flag by the caller. A beat that is interrupted is ABANDONED rather
   * than paused — the arm damps home and the clock starts again — because a
   * person who is startled halfway through a chop and then finishes the chop
   * is worse than one who never chopped.
   */
  // =======================================================================
  // A ROUTINE THAT CAN BE BROKEN (B12, ROADMAP-FUN item 5a)
  // =======================================================================
  //
  // Forty-four beats across seventeen chapters, and until now every one of
  // them was weather: a person hammered, poured, swept or picked on a clock,
  // and there was nothing in the world that could stop them. The comedy of the
  // Goose Game is not that people react — it is that people were DOING
  // something and now they cannot.
  //
  // WHAT WAS ALREADY THERE, and the item was right about it. `localOwnerOf`
  // gives a prop to whoever is standing nearest to where it LIVES (homeX/homeZ,
  // inside npcOWN_R), and `capy:grab` already sets `localOwnStart` on that
  // person — so a tool put down at somebody's bench is theirs, they come and
  // get it, and none of that had to be written. Measured by reading it and
  // then by taking one.
  //
  // WHAT WAS NOT. A local holds nothing (B11 measured zero holders in all
  // nineteen chapters) and no beat named an object, so there was nothing to
  // take. `tool:` on a beat names a prop TYPE; one is spawned at the person's
  // own anchor the first time their chapter is live, and from then on the beat
  // asks whether it is still there.
  const npcTOOL_R    = 3.2;    // m from the anchor: past this it is not to hand
  const npcTOOL_LOOK = 0.55;   // rad the head drops to the empty hand
  const npcTOOL_ARM  = 0.55;   // × the full stroke — a mime, not a swing

  /** Spawn the tool a beat names, once, at the person's own anchor. */
  function localToolMake(r) {
    const b = r.beat;
    if (!b || !b.tool || r.toolMade) return;
    const ph = game.physics;
    if (!ph || typeof ph.spawnProp !== 'function') return;
    r.toolMade = true;      // once, whether or not it worked — see below
    // Half a metre in front of them, on the side the working arm is.
    const fx = Math.sin(r.face), fz = Math.cos(r.face);
    const p = ph.spawnProp(b.tool, r.ax + fx * 0.55 + 0.18, r.az + fz * 0.55, r.y + 0.05);
    if (!p) return;
    r.tool = p;
    // The prop's HOME is what ownership reads, and spawnProp has just set it
    // to where it landed — which is what we want, because that is the bench.
  }

  /**
   * Is the tool to hand? True the moment it is in the animal's mouth, and
   * true while it is anywhere but home. Deliberately NOT a flag set by the
   * grab: a tool kicked into a canal is just as gone as a stolen one, and a
   * flag would have to know about every way a prop can leave.
   */
  function localToolGone(r) {
    const p = r.tool;
    if (!p) return false;
    if (p.removed || p.hidden || p.spilled) return true;
    if (p.held) return true;
    const b = p.body;
    if (!b) return true;
    const dx = b.position.x - r.ax, dz = b.position.z - r.az;
    return (dx * dx + dz * dz) > npcTOOL_R * npcTOOL_R;
  }

  function localBeatStep(r, dt, busy, calm) {
    const b = r.beat;
    if (!b) return 0;
    // Published for beatAudit and read by nothing else: a beat that is not
    // happening is either waiting (a long clock) or suppressed (rule 1), and
    // those two are the same zero from outside.
    r.beatBz = busy; r.beatCalm = calm;
    if (busy) {
      if (r.beatP >= 0) { r.beatP = -1; r.beatT = (b.every || 5) * rand(0.5, 1.1); }
      return 0;
    }
    if (r.beatP < 0) {
      r.beatT -= dt * (1 - calm * 0.35);
      if (r.beatT > 0) return 0;
      r.beatP = 0;
      return 0;
    }
    const dur = b.dur > 0.1 ? b.dur : 0.85;
    const was = r.beatP;
    r.beatP += dt / dur;
    if (b.kind === 'rock') {
      if (r.beatP >= 1) { r.beatP = -1; r.beatT = (b.every || 5) * rand(0.65, 1.5);
                          r.beatN = (r.beatN || 0) + 1; }
      return 0;
    }
    // The sound sits at the moment of contact, which is the bottom of a work
    // stroke and the top of a reach — and it is a rising edge on the phase, so
    // a frame long enough to skip past it still gets exactly one.
    const at = b.kind === 'reach' ? npcBEAT_UP : 0.72;
    if (was < at && r.beatP >= at && b.sfx && !r.toolOut &&
        !(game.state && game.state.paused)) {
      sfx(b.sfx, r, b.volume === undefined ? npcBEAT_VOL : b.volume,
          (b.pitch || 1) * rand(0.94, 1.07));
    }
    // ---- B12: THE BEAT WITH NOTHING IN IT --------------------------------
    // The silence above is half of it and the stroke is the other half. A
    // person whose cleaver has gone still starts the movement — that is what
    // a routine IS — and it dies on the way down, because there is nothing at
    // the bottom of it. Short, and no sound, and the head goes to the hand
    // (see the pose). One failed beat per absence, counted, so `beatAudit`
    // can tell a broken routine from a person who has simply not come round
    // to their next one.
    if (r.toolOut && was < at && r.beatP >= at) {
      r.toolFail = (r.toolFail || 0) + 1;
      // ...and they say so, on the FIRST empty stroke of an absence and not on
      // every one of them. `toolSaid` is cleared when the tool comes back, so
      // taking it twice gets two remarks and standing there watching somebody
      // fail at their job for a minute gets one. The pool is chapter-neutral
      // and may not name the tool — see npcLOC_SAY.notool.
      if (!r.toolSaid && r.cd <= 0) {
        r.toolSaid = true;
        r.cd = r.cool * rand(0.7, 1.2);
        localReactLine(r, npcSay(r, 'notool'));
      }
    }
    if (r.beatP >= 1) { r.beatP = -1; r.beatT = (b.every || 5) * rand(0.65, 1.5);
                        r.beatN = (r.beatN || 0) + 1; return 0; }
    const p = r.beatP;
    // A mime is a fraction of a swing: the arm starts the movement and gives
    // up on it, which reads as "that did not work" rather than as a smaller
    // person doing the same job.
    const tk = r.toolOut ? npcTOOL_ARM : 1;
    if (b.kind === 'reach') {
      // up, hold, down — the hold is what makes it a reach and not a wave
      const k = p < npcBEAT_UP ? p / npcBEAT_UP
              : p < 0.68 ? 1
              : 1 - (p - 0.68) / 0.32;
      return -k * npcBEAT_ARM * 0.78 * tk;
    }
    // work: up slowly, down through the bottom fast, and a little recovery
    if (p < npcBEAT_UP) return -(p / npcBEAT_UP) * npcBEAT_ARM * tk;
    const q = (p - npcBEAT_UP) / (1 - npcBEAT_UP);
    return (-npcBEAT_ARM * (1 - q) + npcBEAT_THRU * Math.min(1, q * 1.6) * (1 - q * 0.4)) * tk;
  }
  function emit(name, npcRec) {
    try { game.events.emit(name, { npc: npcRec }); } catch (e) { /* bus optional */ }
  }
  /**
   * A SOUND A PERSON MAKES COMES FROM WHERE THE PERSON IS STANDING.
   *
   * This was `game.sfx(n)` — no volume, no position — which is volume 1.0,
   * dead centre, in both ears. The loudest thing this game can play, and it
   * was every gasp, pop, bark and strum in nineteen chapters. The ambience
   * ladder in systems.js had exactly this bug and was fixed by putting its
   * ninety-six calls on a ring around the animal; the people were never done.
   *
   * Ninety seconds standing perfectly still on the Sydney lawn, attributed:
   *
   *     strum   x24   the busker, volume 1.0, wherever he is
   *     pop     x8    volume 1.0
   *     ...and eighty sounds in ninety seconds all told, one every 1.1 s.
   *
   * The busker is forty metres away across the Gardens and he was playing
   * inside the player's skull, on a two-to-five second loop, for ever. That is
   * the "random environment noise" — it is not random and it is not the
   * environment, it is four actors with no distance law between them and the
   * ear.
   *
   * So it goes through sfxAt, which is the law this file already had and which
   * only the ibises were using: near 7, far 70. Pass the record and a gasp is
   * over there and fades with the walk away from it. The default level is a
   * third rather than full, because 1.0 is reserved for things that happen TO
   * the player, and none of these do.
   *
   * A caller with no record still gets the level, so nothing in this file is
   * capable of playing at 1.0 by omission any more.
   */
  const npcSFX_VOL = 0.34;
  function sfx(n, rec, vol, pitch, streak) {
    const p = rec && rec.group && rec.group.position;
    const v = typeof vol === 'number' ? vol : npcSFX_VOL;
    // ...and WHOSE voice it is (F2). See `vpitch` on the three record
    // constructors: one number per person, folded in here so every call site
    // in this file gets it without one of them being touched. A caller with no
    // record — the handful that play to nobody in particular — is unchanged.
    const vp = (rec && typeof rec.vpitch === 'number' && rec.vpitch === rec.vpitch)
      ? rec.vpitch : 1;
    if (p) { sfxAt(n, p.x, p.z, v, (pitch || 1) * vp, streak); return; }
    try { game.sfx(n, { volume: v, pitch: (pitch || 1) * vp, streak: streak }); }
    catch (e) { /* optional */ }
  }

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

  // ---- ...AND THE PLAYER IS A THING TO WALK ROUND (v30) -------------------
  //
  // `navBlocked` is STATIC WORLD GEOMETRY and nothing else, so for the whole
  // life of this module a walker steered neatly around a building and then went
  // straight through the capybara. The collider is `collisionFilterMask: -1`
  // and the walker is kinematic with mass 0, so the narrowphase resolves it
  // entirely into the animal: measured in Pasto, parked with no input, a
  // passing local at 1.9 m/s put the player's own speed to 3.04 m/s and moved
  // it — and `capy.frame` was null throughout, so this is not the carry
  // channel, it is a shove. That is the mechanism behind "Pasto drifts at
  // spawn+(9,9)", which batch 4 diagnosed exactly, prescribed this fix for, and
  // did not build; it fixed the separation radius instead, which made the shove
  // smaller without removing it.
  //
  // GATED OFF FOR THE STATES THAT ARE MEANT TO REACH THE PLAYER. A chase that
  // dodges the thing it is chasing is worse than a shove, and so is a shoo, a
  // retrieval or a conversation.
  const npcPLAYER_R = 0.62;   // m. The animal's own footprint plus a little.
  const npcREACH_ST = { chase: 1, flee: 1, cornered: 1, praise: 1, chat: 1,
                        shoo: 1, carry: 1, photo: 1, own: 1, retrieve: 1 };
  function npcBlockedFor(rec, x, z, r) {
    if (navBlocked(x, z, r)) return true;
    if (!rec || npcREACH_ST[rec.state] || rec.carryT >= 0) return false;
    const capy = game.capy;
    if (!capy || !capy.position) return false;
    // Only while the animal is ACTUALLY IN THE WAY of this probe, which is what
    // makes this cheap: one squared distance per probe, no allocation.
    const dx = capy.position.x - x, dz = capy.position.z - z;
    const rr = r + npcPLAYER_R;
    return dx * dx + dz * dz < rr * rr;
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

    // the face — see npcFace. Three nodes, no geometry: the two eyes are one
    // instance and the two brows are two instances of the same buffer.
    const eyeN = new THREE_.Object3D();
    const browL = new THREE_.Object3D();
    const browR = new THREE_.Object3D();

    root.add(bob); root.add(legL); root.add(legR);
    bob.add(head); bob.add(armL); bob.add(armR);
    head.add(hatN);
    head.add(eyeN); head.add(browL); head.add(browR);
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
    // gHead is 0.32 deep centred at y 0.16, so the face is the z = +0.155
    // plane. 3 mm proud of it, or the brow z-fights the forehead at range.
    eyeN.position.set(0, 0.192, 0.158);
    browL.position.set(-0.072, 0.253, 0.158);
    browR.position.set(0.072, 0.253, 0.158);
    hatN.scale.setScalar(0);
    camN.scale.setScalar(0);
    toolN.scale.setScalar(0);
    coneN.scale.setScalar(0);

    // ---- THREE BUILDS (v54) ---------------------------------------------
    // A crowd of forty-five people was forty-five copies of one skeleton at
    // 0.93 to 1.08 scale, which is a 15 cm spread on height and NOTHING on
    // shape: from six metres they read as one man printed forty-five times in
    // different shirts. Three archetypes, picked once, cost nothing — they are
    // a scale on nodes that already exist.
    //
    // `bGirth` goes on `bob`, which carries the torso, the hips and the arm
    // ROOTS, so a heavy build is also a wider stance — and the head is
    // divided back out, because a wide man does not have a wide skull.
    // `bLeg` cannot be a second write on legL.scale.y: animHuman already owns
    // that line for the crouch, so it multiplies INTO it there.
    // The height spread is SMALL because bLeg already carries some of it: the
    // hip pivot goes up, and the torso goes up with it or the feet leave the
    // ground. Short-stout ends up about 1.58 m and tall-thin about 1.83 m.
    const arch = kind === 'ibis' ? 1 : randInt(0, 2);
    // ---- ...AND SOME OF THEM ARE CHILDREN (v54) -------------------------
    // A fourth build rather than a fourth ROLE. Everything a small person in
    // a crowd needs is already here — they wander, they queue, they startle,
    // they take photographs — and giving them a state machine of their own
    // would be nineteen new behaviours to keep working for one silhouette.
    // What a child is, mechanically, is a 1.20 m tourist with short legs and
    // a big head who takes quicker steps, and that is four numbers.
    //
    // TOURISTS ONLY, and one in seven of those. A child gardener is not a
    // joke, it is a mistake; and a crowd that is a third children reads as a
    // school trip, which Sydney is not.
    const child = kind === 'tourist' && Math.random() < npcCHILD_ODDS;
    const bH = kind === 'ibis' ? 1
      : child ? npcCHILD_H * rand(0.96, 1.04)
      : [0.95, 1.0, 1.03][arch] * rand(0.98, 1.02);
    const bGirth = kind === 'ibis' ? 1
      : child ? 1.10 : [1.16, 1.0, 0.89][arch] * rand(0.98, 1.02);
    const bLeg = kind === 'ibis' ? 1 : child ? 0.86 : [0.90, 1.0, 1.09][arch];
    root.scale.setScalar(bH);
    bob.scale.set(bGirth, 1, bGirth);
    // ...and a child's head is BIGGER relative to the body, not smaller.
    // Scaling a whole person down uniformly makes a scale model of an
    // adult, which reads as a distant adult and not as a child at all —
    // the head is the one proportion that says how old somebody is.
    const headK = child ? npcCHILD_HEAD : 1;
    head.scale.set(headK / bGirth, headK, headK / bGirth);

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
      nodes: { bob, head, hatN, armL, armR, handR, camN, toolN, coneN, legL, legR, holdN,
               eyeN, browL, browR },
      // the face pack npcFace() takes, and the two clocks that drive it
      face: { eyeN: eyeN, browL: browL, browR: browR, browY: 0.253 },
      blinkT: rand(0, npcBLINK_MAX), mood: 0,
      // build (see THREE BUILDS above). bLeg is read by animHuman, which is
      // the only place allowed to touch legL.scale.y.
      bH: bH, bGirth: bGirth, bLeg: bLeg, arch: child ? 3 : arch, child: child,
      // ---- A VOICE OF THEIR OWN (F2). See the same field on addLocal ------
      // ...and a child's is higher, which is the one place in the game where a
      // build and a voice have to agree: P5 gave one tourist in seven a head
      // 22% too big for its body, and a 1.20 m person gasping at 0.85 is the
      // sort of thing you notice without being able to say why.
      vpitch: child ? rand(1.16, 1.36) : rand(0.82, 1.22),
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
      quay: !!npcQUAY_KINDS[kind], homeYaw: 0,
      seated: 0, seatPose: 0, chatPhase: rand(0, 6.28), sipT: rand(2, 8),
      soak: 0, soakDark: 0, exasp: 0, slot: 0, table: -1,
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
      // HOW THIS ONE HOLDS YOU (D8). Only the gardener ever does, and he does
      // it in his arms for about two seconds — so this is the one carry in the
      // game where the flail is the WHOLE animation and not the first beat of
      // one. See WHO IS HOLDING YOU in capybara.js.
      hold: 'arms',
      // ...and how long they have been talking, for the gesture. Written in
      // sayBubble, which is the one place every line in this file goes
      // through, so the arm cannot get out of step with the bubble.
      gest: 0,
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
    iBrow.setColorAt(rec.idx * 2, npcColor.setHex(rec.cHr).multiplyScalar(1 - wet * 0.30));
    iBrow.setColorAt(rec.idx * 2 + 1, npcColor.setHex(rec.cHr).multiplyScalar(1 - wet * 0.30));
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
    // The brow is the HAIR colour, which is why it never needed a palette
    // entry of its own and why a blond and a black-haired man read
    // differently at range with no extra state.
    // WHITE, not capyEye (R6). The pupil's darkness moved into the geometry's
    // own colour attribute so that the white beside it could be the material's
    // `sail`; see gEyes. Nothing per-person varies about an eye, so this is a
    // constant either way.
    iEyes.setColorAt(rec.idx, npcColor.setRGB(1, 1, 1));
    iBrow.setColorAt(rec.idx * 2, npcColor.setHex(cHair));
    iBrow.setColorAt(rec.idx * 2 + 1, npcColor.setHex(cHair));
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
  // The café tables are read ONCE, by the terrace block below — this used to
  // parse `env.cafeTables` into a second list that nothing ever read, next to a
  // terrace that was asking for a name environment.js does not publish. Two
  // lists, one of them correct and dead, is exactly how that happened.
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
    // ---- SIT THEM AT THE TABLES THE CHAPTER DRAWS -----------------------
    // This asked for `terraceTables` / `diningTables`, and environment.js has
    // never published either: the name it publishes is `cafeTables`, and it is
    // the same array the hint arrow for 'cafe-table' points at. So this fell
    // through to `envRandomIn('terrace')` and seated all five diners at RANDOM
    // points on the terrace paving — measured 2.9-3.3 m from the nearest table
    // that is actually built, i.e. every one of them eating off thin air.
    //
    // It also broke the task outright. `capyOnTable` tests 1.15 m around the
    // DINER's table point, so standing on a real tabletop — the only thing in
    // the chapter you can stand on up there, and the only place the clue sends
    // you — was never within three metres of anything that could notice, and
    // 'cafe-table' could not be completed at all. The two aliases stay ahead of
    // it so a chapter that publishes its own terrace still wins.
    const src = (game.env && (game.env.terraceTables || game.env.diningTables ||
                              game.env.cafeTables)) || null;
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

  // THE COMMUTERS NEVER BOARDED ANYTHING. `quayFerry` and `quayReadFerry` read
  // the ferry's dock state, position, deck height and gangway once at build and
  // wrote them into an object nothing ever consulted — the scaffolding for a
  // boarding behaviour that was never written, alongside a `homeState` and an
  // `aboard` flag on every human that were likewise only ever initialised. All
  // of it removed rather than left to imply a feature that does not exist; the
  // ferry's own api (game.env.ferry) is unchanged and still says all of this to
  // anybody who does write it.

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
      // pair reads as a conversation from the overhead-behind camera — which
      // is what this line has always said and what the old form never did:
      // `patronN % terrTableN` with `side` flipping only after a full pass put
      // one diner at each of five tables and nobody opposite anybody. Pair them
      // off instead — table 0 gets diners 0 and 1, table 1 gets 2 and 3, and
      // the odd one out sits alone.
      const ti = terrTableN > 0 ? ((patronN >> 1) % terrTableN) : 0;
      const side = (patronN & 1) ? -1 : 1;
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
      perch: 0,                        // THE PERCH (N1) — see stepIbis
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
  iEyes.instanceColor.needsUpdate = true;
  iBrow.instanceColor.needsUpdate = true;
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
      // npcBlockedFor, not navBlocked: the capybara is an obstacle to anybody
      // not in a state whose whole point is to reach it. See npcBlockedFor.
      if (npcBlockedFor(rec, px + dx * 1.4, pz + dz * 1.4, 0.45)) {
        let found = false;
        for (let i = 0; i < npcAVOID_TRIES.length; i++) {
          const a = Math.atan2(dx, dz) + npcAVOID_TRIES[i];
          if (!npcBlockedFor(rec, px + Math.sin(a) * 1.4, pz + Math.cos(a) * 1.4, 0.45)) {
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
      // THE STRIDE IS THIS PERSON'S, not the rig's. npcLEG_L is a constant and
      // every one of these people is scaled: with three builds and a child in
      // the crowd the same constant is wrong by up to a third, and the whole
      // point of deriving gait frequency from stride is that the feet stay
      // locked to the ground instead of ice-skating. bLeg is the leg, bH is
      // the scale on the root, and the speed being divided into it is in world
      // metres — so both belong here.
      // ...DEFAULTED, because paMove also carries the llamas and the street
      // dogs, and paBuildBeast has no build fields on it. Undefined does not
      // throw here, it makes stride NaN, NaN > 0.02 is false, and every animal
      // in Pasto quietly falls through to the idle 0.4 rad/s and stops moving
      // its legs in time with the ground. A silent gait regression on two
      // species is exactly the shape this file keeps finding.
      const bl = rec.bLeg || 1, bh = rec.bH || 1;
      const stride = 2 * npcLEG_L * bl * bh * Math.sin(0.72 * gAmp);
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
    // ---- ch19 · THE FLOW ---------------------------------------------------
    // A committed animal is given npcFLOW_R instead of npcSEP_R, so the room
    // opens BEFORE the meshes touch rather than after — which is the whole
    // difference between a crowd that parts and a crowd that is bulldozed.
    const flow = capyCommitted && capySpdH > 0.9;
    const R = flow ? npcFLOW_R : npcSEP_R;
    if (d >= R) { rec.sepD = d; return; }
    if (d < 1e-4) {            // dead centre — break the tie sideways
      dx = Math.sin(rec.yaw + 1.5708); dz = Math.cos(rec.yaw + 1.5708); d = 1e-4;
    } else { dx /= d; dz /= d; }
    // ...and ACROSS the line, not back along it. Pushed radially, somebody
    // standing dead ahead is shoved down the lane in front of the animal for as
    // long as it keeps coming, which reads as being chased rather than as
    // giving way. Projected onto the perpendicular of the travel, they take one
    // step to whichever side they are already nearer and the lane is clear.
    if (flow) {
      const hx = capyVX / capySpdH, hz = capyVZ / capySpdH;
      let sx = -hz, sz = hx;                      // the left-hand normal
      if (dx * sx + dz * sz < 0) { sx = -sx; sz = -sz; }
      dx = dx * 0.30 + sx * 0.70;
      dz = dz * 0.30 + sz * 0.70;
      const m = Math.sqrt(dx * dx + dz * dz) || 1;
      dx /= m; dz /= m;
    }
    const overlap = R - d;

    // A shove that arrives out of nowhere earns a comic stagger — once, on the
    // frame the overlap starts, so it cannot buzz while the capy leans on them.
    // The +0.3 margin is hysteresis: the shove only ever settles them AT the
    // radius, so without it a capybara leaning on someone would re-trigger the
    // stagger every few frames and they would buzz.
    // ...on R and not on npcSEP_R, or the flow's wider radius settles people
    // inside the hysteresis band and every one of them buzzes a stagger.
    if (rec.sepD > R + 0.3 && rec.stumble < 0.2 && rec.dejected <= 0) {
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
  // ---- TWO OF THE NINE SKILLS ARE READ HERE (see capySkill in capybara.js) --
  // `quiet` (ch4 Kyoto) is how much of an impression the animal makes; `flow`
  // (ch19 Hanoi) is whether it is holding a line worth getting out of the way
  // of. Both are mirrored on the same tick as the position, so this file asks
  // `game.capy` once a frame rather than once per person.
  let npcIbisOffered = false;
  let capyQuiet = 1;               // multiplier on how much the animal alarms
  let capyCommitted = false;       // a steady line, held. See THE FLOW.
  function refreshCapy() {
    const c = game.capy;
    if (!c || !c.position) { capyOk = false; npcCapyOk = false; return; }
    capyX = c.position.x; capyZ = c.position.z;
    npcCapyX = capyX; npcCapyZ = capyZ; npcCapyOk = true;
    capySpd = c.velocity ? c.velocity.length() : 0;
    capyVX = c.velocity ? c.velocity.x : 0;
    capyVZ = c.velocity ? c.velocity.z : 0;
    capySpdH = Math.sqrt(capyVX * capyVX + capyVZ * capyVZ);
    capyQuiet = (typeof c.can === 'function' && c.can('quiet')) ? npcQUIET_K : 1;
    capyCommitted = !!c.committed;
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
    // 'gather' is the ending, and nothing routine may re-task somebody standing
    // in it. It is NOT in the list above on purpose: that list is the one a
    // startle can still break — being frightened out of the gathering is
    // correct, and they walk back through 'gather' again when it passes.
    if (st === 'gather') return;

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
      // ---- ...AND THE PLACE REMEMBERS TOO (v33) --------------------------
      // The same three levers heat pulls on a local, on the cast that has no
      // `locals` — job 3a. All three are attention: how far out they notice
      // you (2a), how soon they may notice you again (2a), and which of the two
      // written registers they answer in (2e). Nothing here decides whether
      // anything can be taken; this is the same sentence the wariness block
      // above it makes, one layer out.
      const hHere = npcHeatAt(rec.group.position.x, rec.group.position.z);
      const hot = wary > npcWARY_HEAT * (1 - hHere * npcHEAT_SOON);
      if (d < (9 + wary * npcWARY_SEE) * (1 + hHere * (npcHEAT_LOOK - 1)) &&
          vis > 0.28 && rec.kind !== 'jogger' &&
          st !== 'lookAt' && rec.noticeCd <= 0) {
        setState(rec, 'lookAt');
        rec.noticeCd = (hot ? 1.4 : 3.0) * (1 - hHere * npcHEAT_AGAIN);
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
  function sfxAt(name, x, z, vol, pitch, streak) {
    try {
      game.sfx(name, { volume: vol, pitch: pitch, at: { x: x, y: 0.6, z: z }, near: 7, far: 70,
                       streak: streak });
    }
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
    // ...and everybody near enough to hear it looks over. This is the third
    // mischief chain, reaching the two chapters that have no `locals`.
    npcWitnessChain(rec);
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
  /** One resolver since X8 — see waterYAt in shared.js. */
  function envWaterY(x, z) { return waterYAt(game.env, x, z, -0.5); }

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
    // NOT THE CHILDREN. One in six badly startled Sydneysiders backs off
    // the sea wall into the harbour, which is funny about an adult in a
    // suit and is not funny at all about a seven year old. They stop at
    // the coping and flail like everybody else who does not go in.
    rec.plunge = (dz < -0.3) && !rec.child && (Math.random() < npcPLUNGE_ODDS);
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
    // ...and everybody near enough to hear it looks over. This is the third
    // mischief chain, reaching the two chapters that have no `locals`.
    npcWitnessChain(rec);
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
    sfx('gasp', rec);
    emit('npc:startled', rec);
    // ...and everybody near enough to hear it looks over. This is the third
    // mischief chain, reaching the two chapters that have no `locals`.
    npcWitnessChain(rec);
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
    sfx('gasp', rec);
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
    // ...FROM THE PERSON DOING IT. sfx() places the cue off rec.group.position
    // and falls back to dead-centre mono without one, and this is the most
    // frequent chase cue in the game — the sound of somebody noticing you.
    sfx(rec.kind === 'gardener' ? 'whistle' : 'gasp', rec);
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
  // ---- ...AND THE SAME IN PASTO (v30) -----------------------------------
  // This handler was gated on `biomeLive()`, which is hard-coded to
  // isActive('sydney'), so eating produce in front of somebody got a line in
  // chapter 1 and silence in chapter 2 — a chapter with THIRTEEN edible props,
  // the most in the game. Both casts come out of `buildHuman`, so `startle` and
  // `pickLine` work on either; the only per-chapter parts are which array to
  // sweep and which pool to speak from.
  game.events.on('capy:graze', () => {
    const live = game.biome && game.biome.current;
    const cast = live === 'sydney' ? humans : live === 'pasto' ? paHumans : null;
    if (!cast) return;
    const capy = game.capy;
    if (!capy || !capy.position) return;
    const cx = capy.position.x, cz = capy.position.z;
    let best = null, bd = npcGRAZE_R * npcGRAZE_R;
    for (let i = 0; i < cast.length; i++) {
      const r = cast[i];
      if (!r.group || !r.group.visible) continue;
      if (r.state === 'chase' || r.state === 'swim' || r.state === 'plunge') continue;
      const dx = r.group.position.x - cx, dz = r.group.position.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < bd) { bd = d2; best = r; }
    }
    if (!best) return;
    startle(best, cx, cz);
    pickLine(best, live === 'pasto' ? 'paProduce' : 'shoo');
    // A shoo is a reaction, and a reaction is worth more if somebody else sees
    // it. `startle` does not emit 'npc:startled' — only flee, plunge and
    // standUp do — so the chain is armed here explicitly.
    npcWitnessChain(best);
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
          sfx('gasp', owner);
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
    // SOFT FEET SCALES WHAT IS LEFT BEHIND, NOT THE FRIGHT ITSELF (see
    // npcQUIET_K). `alarm` is untouched — a person walked into still says so,
    // still looks up, still hops — and only the memory it writes is smaller.
    // Scaling the alarm instead would have made the animal quiet by making the
    // world unresponsive, which is the opposite of the thing.
    const wleft = rec.alarm * capyQuiet;
    if (wleft > (rec.wary || 0)) rec.wary = wleft;
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
        sfx('thud', rec);
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
            sfx('gasp', rec);
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
          sfx('splash', rec);
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
          //
          // ---- ...OR TWELVE SECONDS, WHICHEVER COMES FIRST (F2) ----------
          // Every other steering state in this file has a ceiling — flee 3.5,
          // cornered 5.0, resit 9, retrieve 12, queue 26, gather 30 — and this
          // one had none: its only exit is arriving at the sea wall, and
          // `moveRec`'s seaward branch turns OFF nav rejection for it, so a
          // swimmer held off the coping by anything at all paddles for the
          // rest of the session. Twelve seconds is `retrieve`'s figure and is
          // four times the crossing: measured, the paddle from the far side of
          // the ferry berth is under three. The cost of the ceiling is that a
          // genuinely stuck swimmer glides the last stretch to the wall over
          // the climb's own 0.62 s rather than swimming it — visible once, in
          // a case that today should never happen, against a state that
          // otherwise never ends.
          if (rec.group.position.z > npcEDGE_Z + 0.15 || rec.swimT > 12) {
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
      // ---- THE LAWN: somebody came to see it (v30) -----------------------
      //
      // The finale stages seventeen souvenirs on the picnic lawn and, until
      // now, nobody came. The brief for it asked for "a small cast gathered
      // from systems that already exist" and batch 2 could not do it, for a
      // reason it wrote down precisely: Sydney registers zero `game.locals`,
      // so there was no cast to gather — its people are this module's own
      // `humans`, and gathering them needed a state here.
      //
      // The shape is the terrace's `resit`, which is the right precedent: a
      // slot assigned ONCE, an arrival test, a hard ceiling, and then damp the
      // yaw and stop. `npcGatherSlot` is written when they are recruited and
      // never recomputed, because a slot that moves is a person who never
      // arrives.
      //
      // THE CEILING IS NOT OPTIONAL. A steering state without one is how the
      // waiter went forty seconds and never reached a table, and this one
      // steers across a whole park to a point it may not be able to reach.
      // Past it they stand where they are and face the lawn anyway — which
      // reads as somebody who stopped to watch from further back, so the
      // failure mode is a picture rather than a bug.
      case 'gather': {
        const d = steerTo(rec, rec.gathX, rec.gathZ, dt);
        spd = npcGATHER_SPD;
        rec.lookX = sysFIN_LAWN_X; rec.lookZ = sysFIN_LAWN_Z;
        if (d < 0.45 || rec.stateT > npcGATHER_CEIL) {
          spd = 0;
          rec.tgtLean = 0.04;      // the smallest lean-in this rig has
        }
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
              sfx('pop', rec, 0.26, rand(1.5, 1.9));
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
              sfx('pop', rec);
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
          sfx('pop', rec);
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
        // ONE LAZY STRUM, FROM WHERE HE IS ACTUALLY SITTING. At volume 1.0 in
        // both ears every two to five seconds this was twenty-four of the
        // eighty sounds Sydney made in a minute and a half, and the single
        // loudest thing on the lawn. Through the distance law he is a busker
        // across the Gardens again: you walk toward him and he gets louder.
        if (rec.strum <= 0) { rec.strum = rand(3.4, 6.2); sfx('strum', rec, 0.30, 1); }
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
            sfx('pop', rec);
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
              if (rec.stumble < 0.1) { pickLine(rec, 'jog'); sfx('gasp', rec); }
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

    npcWitnessHold(rec, dt);
    npcSeparate(rec, dt);
    moveRec(rec, dt, spd);
    animHuman(rec, dt);
  }

  // ---- WHAT A FACE IS FOR ------------------------------------------------
  // The states were all already here; not one of them was drawn above the
  // neck. `alarm` is the startle level and damps out on its own, so it does
  // the work for anything sudden; the state names do the rest.
  //
  // Wide is surprise AND delight — a tourist lining up a photograph of a
  // capybara has the same eyes as one who has just been barged into, and that
  // is right: the joke is that the animal is the biggest thing happening to
  // any of these people all day.
  const npcMOOD_WIDE = { startled: 1, cornered: 1, plunge: 1, swim: 0.75,
                         fluster: 0.85, flee: 0.9, photo: 0.6 };
  const npcMOOD_CROSS = { chase: 1, shoo: 0.9, retrieve: 0.7 };
  function npcMoodOf(rec) {
    const s = rec.state;
    const cross = npcMOOD_CROSS[s] || 0;
    if (cross > 0) return -cross;
    // a grudge (Pasto) or a thing of theirs on the floor (Sydney) is a scowl
    // that outlives the state that caused it
    const sour = Math.max(rec.grudge > 0 ? 0.65 : 0,
                          rec.dejected > 0 && rec.dejectStage === 0 ? 0.5 : 0);
    const wide = Math.max(npcMOOD_WIDE[s] || 0, rec.alarm * 0.85);
    if (wide > sour) return wide;
    return -sour;
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
    // legs live on the root, so they have to follow the hips down by hand.
    // `bLeg` is the build (see THREE BUILDS in buildHuman) and multiplies IN
    // here rather than being a second write on scale.y from the builder —
    // two writers on one scale is the trap this file has hit before, and the
    // one that wins is whichever ran last.
    const hipY = npcLEG_L * rec.bLeg + rec.poseCrouch;
    const legK = hipY / npcLEG_L;
    n.legL.position.y = hipY;
    n.legR.position.y = hipY;
    n.legL.scale.y = legK;
    n.legR.scale.y = legK;
    // ---- THE TALKING ARM (D8) --------------------------------------------
    // One arm, on its own clock, while the bubble is up. Deliberately the same
    // shape the locals have had since P5 — up half a radian and oscillating at
    // 7.5 rad/s — because it is the same gesture and two different ones would
    // read as two different species of person standing in the same square.
    //
    // ON THE RIGHT ONLY, and masked by whatever the pose already asked that
    // arm for: somebody carrying a coffee, holding a camera up or pointing is
    // already using that arm and the state machine's answer wins. That is the
    // same `mask` the walk swing takes, one line up, for the same reason.
    if (rec.gest > 0) { rec.gest -= dt; rec.gestT = (rec.gestT || 0) + dt; }
    const talk = rec.gest > 0 ? (0.5 + Math.sin(rec.gestT * 7.5) * 0.22) * maskR : 0;
    n.armL.rotation.x = rec.poseArmL - s * amp * 0.58 * maskL;
    n.armR.rotation.x = rec.poseArmR + s * amp * 0.58 * maskR - talk;
    n.armL.rotation.z = 0.09 + rec.poseArmL * 0.06;
    n.armR.rotation.z = -0.09 - rec.poseArmR * 0.06 - talk * 0.7;

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
    // ...and the torso rides UP with a long-legged build, or a tall-thin man
    // is drawn with his hips six centimetres inside his own waistband.
    n.bob.position.y = rec.poseCrouch + breathe + Math.abs(c) * 0.05 * amp + npcHIP_Y - npcHIP_Y * cl
                       + npcLEG_L * (rec.bLeg - 1);
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

    // ---- THE FACE (v54) --------------------------------------------------
    // Both crowds come through here, so this is the only place either of them
    // gets an expression. It goes BEFORE updateMatrixWorld because the eye and
    // brow nodes are children of the head and the instance push reads their
    // world matrices — set after the update and every face is one frame late,
    // which on a startle is exactly the frame that matters.
    //
    // A face comes on fast and goes off slowly. Somebody who has just had a
    // capybara go past at seven metres a second does not relax over the same
    // interval they tensed over, and a symmetric damp reads as a mask being
    // swapped rather than as a person.
    const mTgt = npcMoodOf(rec);
    rec.mood = damp(rec.mood, mTgt, Math.abs(mTgt) > Math.abs(rec.mood) ? 15 : 3.2, dt);
    npcFace(rec.face, rec.mood, npcBlink(rec, dt));

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
    // ---- ...UNLESS IT IS ON THE CAPYBARA (N1) ---------------------------
    // A perched ibis has no target to steer at, no hop to bob with and no
    // ground under it — `rec.group.position.y = hop` below is the one line that
    // would put it back on the lawn. systems.js has already written x, y, z and
    // yaw; this keeps the neck and legs alive and leaves the rest alone.
    // `rec.perch` is re-asked every frame by `lift` on the herd offer, so an
    // ibis cannot be stranded up there. See THE PERCH in systems.js.
    if (rec.perch > 0) {
      rec.perch = Math.max(0, rec.perch - dt);
      rec.speed = 0;
      rec.peck = damp(rec.peck, 0, 4, dt);
      rec.nodes.neckN.rotation.x = rec.peck * 0.35 - 0.15;
      rec.nodes.bodyN.rotation.x = 0.16;
      rec.nodes.legA.rotation.x = 0;
      rec.nodes.legB.rotation.x = 0;
      rec.group.rotation.y = rec.yaw;
      rec.group.updateMatrixWorld(true);
      return;
    }
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
  // An empanada taken while nobody was looking, still owed a witness (F4).
  // Cleared the moment it is eaten, dropped or the row is ticked, so it cannot
  // survive into a chapter where there is no market to be seen in.
  let paEmpWanted = false;
  let paColorDirty = false;
  let paCursor = 0;
  let paLlamaMade = 0, paDogMade = 0;
  let pTorso = null, pHips = null, pHead = null, pHair = null, pArmL = null, pArmR = null;
  let pEyes = null, pBrow = null;
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
  /**
   * PASTO LOOKS AT THE ANIMAL — and a bare lookX write is worth nothing, which
   * is the trap this batch names and the closeout already paid for once:
   * twenty-odd sites inside these two state machines write lookX every frame,
   * so a notice loses to whatever the person was already doing before anybody
   * can see it. The hold is the same witT the witness chain uses, re-asserted
   * AFTER the state machine has run, and it is deliberately not a state.
   *
   * It is also the only reason chapter 2 shows up in an attention count at
   * all: `watching` is published from witT and from the states in which a
   * head is on the animal, and Pasto notices you WITHOUT changing state.
   */
  function paLookCapy(rec) {
    rec.lookX = capyX; rec.lookZ = capyZ;
    rec.witX = capyX; rec.witZ = capyZ; rec.witT = npcWIT_LOOK;
  }

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

  /**
   * Blocked, too steep to be worth the dignity, or THE ANIMAL IS THERE.
   *
   * `rec` is threaded through for the state gate alone — see npcBlockedFor.
   * Pasto is where this was measured, because Pasto is where it shows: two of
   * its nineteen kinematic bodies run a route across the plaza, and a parked
   * capybara on that route was shoved to 3.04 m/s by a walker doing 1.9.
   */
  function paRefuse(rec, px, pz, dx, dz) {
    const ax = px + dx * npcPA_PROBE, az = pz + dz * npcPA_PROBE;
    if (npcBlockedFor(rec, ax, az, 0.45)) return true;
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
      if (paRefuse(rec, px, pz, dx, dz)) {
        let found = false;
        const side = rec.avoidSide < 0 ? -1 : 1;
        for (let i = 0; i < npcAVOID_TRIES.length; i++) {
          const off = npcAVOID_TRIES[i] * side;
          const a = Math.atan2(dx, dz) + off;
          if (!paRefuse(rec, px, pz, Math.sin(a), Math.cos(a))) {
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
          if (!paRefuse(rec, px, pz, Math.sin(a), Math.cos(a))) { rec.avoidAng = side * 1.5708; found = true; }
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
      // THE STRIDE IS THIS PERSON'S, not the rig's. npcLEG_L is a constant and
      // every one of these people is scaled: with three builds and a child in
      // the crowd the same constant is wrong by up to a third, and the whole
      // point of deriving gait frequency from stride is that the feet stay
      // locked to the ground instead of ice-skating. bLeg is the leg, bH is
      // the scale on the root, and the speed being divided into it is in world
      // metres — so both belong here.
      // ...DEFAULTED, because paMove also carries the llamas and the street
      // dogs, and paBuildBeast has no build fields on it. Undefined does not
      // throw here, it makes stride NaN, NaN > 0.02 is false, and every animal
      // in Pasto quietly falls through to the idle 0.4 rad/s and stops moving
      // its legs in time with the ground. A silent gait regression on two
      // species is exactly the shape this file keeps finding.
      const bl = rec.bLeg || 1, bh = rec.bH || 1;
      const stride = 2 * npcLEG_L * bl * bh * Math.sin(0.72 * gAmp);
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
      sfx('rustle', rec);
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
        if (rec.kind === 'streetdog') { if (st !== 'bark') { paSet(rec, 'bark'); sfx('wheek', rec); } return; }
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
        if (rec.kind === 'streetdog') { if (st !== 'bark') { paSet(rec, 'bark'); sfx('wheek', rec); } return; }
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
        // ---- 2a, IN PASTO (v33) ------------------------------------------
        // The NOTICE branch and not the chase branch above it. `alertR` is
        // what starts a chase, and a chase that begins from further out is a
        // chase that can put itself between the player and a task — which is
        // the one thing heat may not do. This branch turns a head and says a
        // line, and that is all heat is allowed to buy.
        const hHere = npcHeatAt(rec.group.position.x, rec.group.position.z);
        if (st === 'stall' && d < 12 * (1 + hHere * (npcHEAT_LOOK - 1)) &&
            rec.noticeCd <= 0 && paSeeCapy(rec) > 0.30) {
          rec.noticeCd = rand(6, 12) * (1 - hHere * npcHEAT_AGAIN);
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
      // ---- 2a, and the churchgoer's half of it (v33). See the vendor above.
      const hHere = npcHeatAt(rec.group.position.x, rec.group.position.z);
      if (capyOk && rec.noticeCd <= 0 &&
          paDistToCapy(rec) < 8 * (1 + hHere * (npcHEAT_LOOK - 1)) && paSeeCapy(rec) > 0.30) {
        rec.noticeCd = rand(8, 16) * (1 - hHere * npcHEAT_AGAIN);
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
            sfx('thud', rec);
            paShoveCapy(rec, 78, 46);
            try { game.shake(0.16); } catch (e) { /* optional */ }
          }
        } else {
          rec.tgtArmR = -1.5 + Math.sin(rec.stateT * 16) * 0.7;
          rec.tgtArmL = -0.5;
          if (rec.kind === 'farmer' && d < 1.6 && rec.swatCd <= 0) {
            rec.swatCd = 2.2;
            sfx('thud', rec);
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

    npcWitnessHold(rec, dt);
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
            sfx('pop', rec);
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
              sfx('wheek', rec);
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
    pEyes.setColorAt(rec.idx, npcColor.setHex(PALETTE.capyEye));
    pBrow.setColorAt(rec.idx * 2, npcColor.setHex(cHr));
    pBrow.setColorAt(rec.idx * 2 + 1, npcColor.setHex(cHr));
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
      // A voice of their own (F2), and the llamas get one too — they go
      // through the same `sfx(name, rec, …)` door as the people do.
      vpitch: rand(0.82, 1.22),
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
      { w: 0.15, h: 0.13, d: 0.20, y: 0.84, z: 0.22, c: npcSRGB(0.82) },   // the face
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
    pEyes = mkInst(gEyes, PA_H);
    pBrow = mkInst(gBrow, PA_H * 2);
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
    //
    // ---- ...AND THE NAME IT IS PUBLISHED UNDER IS `coffeePatio` -----------
    // Neither `dryingPatio` nor `patio` has ever existed on pasto's api, so
    // this override never once fired and the fallback (46, 4) r 7.5 was the
    // whole truth. The real floor is 13 x 10 centred on (52, 12) — ten metres
    // away — which put the farmer who is supposed to be ON it out in the
    // terraces, and left `paOnPatio` testing a disc that covers only the
    // patio's south-west corner: standing on most of the drying beds did not
    // make him cross. Same defect the Sydney café tables had, in the same file.
    const cp = game.pasto && (game.pasto.dryingPatio || game.pasto.patio || game.pasto.coffeePatio);
    const dp = quayXOf(cp);
    if (dp && isFinite(dp.x) && isFinite(dp.z)) {
      npcPA_PATIO.x = dp.x; npcPA_PATIO.z = dp.z;
      // ...and the radius comes off the published footprint when there is one,
      // so the disc actually covers the floor rather than a remembered guess
      // about how big it is. Half the diagonal: a rect's own circumcircle.
      if (cp && isFinite(cp.w) && isFinite(cp.d)) {
        npcPA_PATIO.r = Math.hypot(cp.w, cp.d) * 0.5;
      }
    }

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
    pEyes.instanceColor.needsUpdate = true;
    pBrow.instanceColor.needsUpdate = true;
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
      pEyes.setMatrixAt(i, n.eyeN.matrixWorld);
      pBrow.setMatrixAt(i * 2, n.browL.matrixWorld);
      pBrow.setMatrixAt(i * 2 + 1, n.browR.matrixWorld);
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
    pEyes.instanceMatrix.needsUpdate = true;
    pBrow.instanceMatrix.needsUpdate = true;
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
    // ---- ONE TIER PER VISIT, AND THIS IS THE WHOLE OF "PER VISIT" (O1) --
    // Cleared here and nowhere else. npcPalStep sets it on the first
    // warming and systems.js decides what a warming is worth.
    npcPalWarm = false;
    npcPalLine = '';
    // O2: the prop belonged to the chapter that has just been detached, so
    // the reference is a pointer into a world that no longer exists.
    npcPalGiftP = null;
    // The ending is STAGED EVERY TIME and closed once — props.js huddles all
    // seventeen souvenirs at the next chapter's spawn on the way out, so
    // sysFinaleStage runs again on every return and this must be able to
    // answer it again. A latch that never clears would mean the lawn had a
    // crowd the first time you came home and nobody ever after.
    npcGathered = false;
    // ---- ...AND THE PLACE STARTS WATCHING THE DOOR (item 6) -------------
    // Armed on every arrival and spent by the clock in localsStep. It does
    // nothing at all unless systems.js has handed down a tier of npcNOTO_TIER
    // or better, so this line is a no-op for the whole of a quiet journey.
    npcNotoT = npcNOTO_DOOR;
    // ---- ...AND NOBODY IS STILL MARCHING IN A COUNTRY YOU HAVE LEFT -----
    // `marStep` tears itself down on a biome mismatch anyway, but only if it
    // is stepped — and it is stepped from the per-person loop, which is the
    // loop this chapter is gated out of. The same freeze `wary`, `fam` and
    // `flowSeen` all had, and the same one-line answer.
    if (marWho) { marWho.marCool = npcMAR_COOL; marWho.tx = marWho.ax; marWho.tz = marWho.az; }
    marWho = null; marT = 0;
    for (let i = 0; i < humans.length; i++) {
      if (humans[i] && humans[i].state === 'gather') setState(humans[i], 'calm');
    }
    // ---- ...AND NOBODY STAYS FRIGHTENED FOR TWO HOURS (F3) --------------
    //
    // This handler reset the bubbles, the gather and a frozen carry, and left
    // `wary` and `alarm` exactly as they were. The only thing that decays
    // `wary` is `stepHuman`, which is biome-gated — so a crowd left mid-panic
    // is FROZEN at that panic for however long the player spends in the other
    // eighteen chapters, and re-arrives hostile. It self-heals over npcWARY_T
    // once the chapter is live again, which means the wrongness lands on the
    // one frame every player of a chapter sees: its arrival shot.
    //
    // The PLACE's memory is deliberately not touched: `npcHeatSites` is
    // biome-tagged and decays on the real clock, and a square being cross with
    // you is exactly the sort of thing that should survive a walk round the
    // block. It is the individual people who should not still be mid-flinch.
    for (let i = 0; i < locals.length; i++) {
      const L = locals[i];
      if (L) { L.wary = 0; L.alarm = 0; }
      // ---- ...AND THE SAME FREEZE WITH THE SIGN FLIPPED (O1) -----------
      // `fam` has exactly the fault the paragraph above describes and it was
      // never noticed, because a frozen fondness does not look like anything.
      // MEASURED: the gondolier left at 0.618 was still at 0.618 after two
      // minutes in Kyoto — to four decimal places, because the only thing
      // that decays it is a loop this chapter is gated out of.
      //
      // THE REGULARS is what made it matter. A tier is earned by `fam`
      // crossing npcFAM_HEAT, one per visit; with the number frozen, the
      // second tier and the third and the fourth cost a step through a door
      // and back, and the whole item is bought in ninety seconds without
      // anybody sitting anywhere. Cleared here, so every visit starts the
      // twenty-five seconds again.
      //
      // AND IT IS RIGHT ON ITS OWN TERMS, not just for the tier. `fam` is
      // built out of THE CALM, which is a fact about right now; a stallholder
      // who is as fond of you as they were an hour and six chapters ago,
      // having seen nothing since, is the crowd-left-mid-panic bug being
      // read as a feature. What crosses the boundary is the TIER, which is on
      // the save file, and that is the whole of what a person is owed to
      // remember.
      if (L) { L.fam = 0; L.famWas = false; }
      // ...AND THE HELD LOOK, WHICH IS THE SAME FAULT A THIRD TIME. The only
      // thing that decays `flowSeen` is the per-person loop this chapter is
      // gated out of, so leaving a place at a sprint would leave everybody in
      // it mid-turn — and it would land on the arrival shot, exactly as the
      // frozen flinch above does. Bounded at npcFLOW_HOLD and therefore small,
      // and cleared anyway: a head still turned after a walk round the block
      // is watching a line that ended in another country.
      if (L) L.flowSeen = 0;
      // ...AND ANYTHING THEY WERE CARRYING GOES DOWN (F4). `localOwnStep` is
      // the only other place that releases the pin and it does not run in a
      // chapter that is not live — so a local halfway home with somebody's hat
      // when the white came up would leave that hat KINEMATIC for the rest of
      // the session: it could not be picked up, knocked over or made to fall,
      // in a chapter the player comes back to. Dropped where they stood, which
      // is also true: they put it down when they stopped walking.
      if (L && L.carry) localOwnDrop(L, false);
      if (L) { L.own = null; L.ownBack = false; L.ownT = 0; }
    }
    for (let i = 0; i < game.npcs.length; i++) {
      const r = game.npcs[i];
      if (r) { r.wary = 0; r.alarm = 0; }
    }
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
      sfx('gasp', best);
      // Anyone else in the market who can see it joins in. It is a small town.
      for (let i = 0; i < paHumans.length; i++) {
        const rec = paHumans[i];
        if (rec === best || rec.kind === 'churchgoer') continue;
        if (paDistToCapy(rec) < rec.alertR && paSeeCapy(rec) > 0.2) paStartChase(rec);
      }
    }
    // ---- THE JOKE IS BEING SEEN DOING IT (F4) --------------------------
    // 'Steal an empanada' ticked whether or not a single person in the market
    // had their eyes open — which makes it "pick up a pastry", and Pasto is a
    // chapter whose whole cast is built around watching you. Every piece of
    // machinery for this already existed and none of it was consulted:
    // `paSeeCapy` is a real vision test and the loop directly above already
    // uses it to decide who joins the chase.
    //
    // BUT IT IS NOT A GATE, IT IS A DEFERRAL, and that distinction is the
    // whole safety argument. A condition that can simply fail would leave a
    // row uncompletable for a player who happened to rob an empty stall — the
    // one thing a task in this game may never be. So an unseen theft ARMS the
    // row instead: keep hold of it, walk back into the market, and it ticks
    // the moment anybody clocks what you are carrying. There is no way to be
    // stuck, and the row now means what it says.
    if (prop.type === 'empanada') {
      if (paAnyoneSaw()) finish('steal-empanada');
      else paEmpWanted = true;
    } else if (prop.type === 'ruana') finish('ruana-thief');
  });

  /** Is anybody in the market actually looking at the animal right now? */
  function paAnyoneSaw() {
    for (let i = 0; i < paHumans.length; i++) {
      const rec = paHumans[i];
      if (rec.kind === 'churchgoer') continue;
      if (paDistToCapy(rec) < rec.alertR && paSeeCapy(rec) > 0.2) return true;
    }
    return false;
  }

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
    let first = null;
    for (let i = 0; i < paHumans.length; i++) {
      const rec = paHumans[i];
      if (rec.kind !== 'churchgoer') continue;
      if (!first) first = rec;
      paSet(rec, 'scandal');
      rec.alarm = 1;
      rec.hopV = 2.2;
      if (i % 2 === 0) paSay(rec, 'paScandal');
    }
    // From the churchgoers, not from the middle of your head. It is a crowd
    // reaction, so one of them stands for all of them — which is still the
    // right side of the plaza, and mono was not.
    sfx('gasp', first);
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
    // ---- the empanada, still in its mouth, in front of a witness --------
    // See the deferral in the prop:steal handler. Checked here rather than on
    // an event because "somebody notices" is a continuous fact about where the
    // animal is standing, and there is no event for walking back into view.
    // Costs one vision test per person on the frames the flag is up and
    // nothing at all on every other frame of the game.
    if (paEmpWanted) {
      const held = game.capy && game.capy.heldProp;
      if (!held || held.type !== 'empanada') paEmpWanted = false;
      else if (paAnyoneSaw()) { paEmpWanted = false; finish('steal-empanada'); }
    }
    paPush();
    if (paColorDirty) { paFlushColors(); paColorDirty = false; }
    // NOT updateBubbles(dt) — the only caller of paUpdate already ages the
    // bubbles on the line after it, and doing it here as well ran the whole
    // pool at 2x in Pasto alone: every bubble in chapter two lived half as
    // long as the same bubble anywhere else.
  }

  // ================================================================== update
  let cursor = 0;
  const all = [];
  for (let i = 0; i < humans.length; i++) all.push(humans[i]);
  for (let i = 0; i < ibises.length; i++) all.push(ibises[i]);

  // The opaque HUD panels, in NDC, refreshed on a slow tick. See
  // npcBUB_PANEL_PAD — these come from game.hud.panels(), which does a layout
  // read, so this is deliberately not a per-frame question.
  const npcBubPanels = [];
  let npcBubPanelT = 0;

  function updateBubbles(dt) {
    if (npcHeardT > 0) npcHeardT -= dt;
    npcBubPanelT -= dt;
    if (npcBubPanelT <= 0) {
      npcBubPanelT = npcBUB_PANEL_T;
      // A build without the accessor (or before systems.js is up) simply gets
      // an empty list and the bubble behaves exactly the way it did before.
      if (game.hud && typeof game.hud.panels === 'function') game.hud.panels(npcBubPanels);
      else npcBubPanels.length = 0;
    }
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
    // the speaker clock, run once rather than per bubble — see npcSpeaker
    if (npcSpeak.t > 0) npcSpeak.t -= dt;
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
        // legible up close, still readable across the lawn
        const sc = clamp(14 / Math.max(dist, 1) + 0.52, 0.78, 1.22);
        // ---- THE CLAMP HAD NO WIDTH TERM, SO THE BOX RAN OFF THE SCREEN --
        //
        // The bubble is positioned by its CENTRE (translate(-50%,-100%)) and
        // clamped to +/-0.93 in NDC, which is a limit on the anchor and says
        // nothing about the box hanging off it. Measured across a fourteen-
        // sample soak: six distinct bubbles ran off the LEFT edge, the worst
        // by 132 px of a 399 px bubble at 1920x1080 — a third of a sentence,
        // gone, in the one channel this game uses to say that somebody
        // noticed you.
        //
        // Half the box in NDC is (width * scale) / innerWidth, because NDC x
        // spans 2 across innerWidth px and the half-width is width/2. Same
        // for the height, which matters because the box is drawn ENTIRELY
        // above its anchor.
        if (!b.bw && b.shown) { b.bw = b.el.offsetWidth; b.bh = b.el.offsetHeight; }
        const halfX = b.bw ? (b.bw * sc) / Math.max(1, innerWidth) : 0.16;
        const fullY = b.bh ? (b.bh * sc * 2) / Math.max(1, innerHeight) : 0.14;
        const limX = clamp(1 - halfX - 0.012, 0.05, 0.93);
        // the bubble is drawn ABOVE this point, so leave headroom at the top
        const ny = clamp(npcV1.y, -0.80, Math.min(0.82, 1 - fullY - 0.012));
        // ---- ...AND OFF THE PAPER (v34). See npcBUB_PANEL_PAD -------------
        // Resolved AFTER the box size is known, because whether a bubble is on
        // the card is a question about the box and not about its anchor — the
        // capybara dodge above can be answered from a point, and this cannot.
        // The push goes to whichever side is nearer, which for a panel in a
        // corner is always the middle of the screen.
        // The box is drawn UPWARD from its anchor (translate(-50%,-100%)), so
        // it spans x in [bx-halfX, bx+halfX] and y in [ny, ny+fullY].
        for (let q = 0; q < npcBubPanels.length; q++) {
          const pz = npcBubPanels[q];
          const bx = clamp(npcV1.x + want, -limX, limX);
          if (bx + halfX <= pz.x0 || bx - halfX >= pz.x1) continue;
          if (ny + fullY <= pz.y0 || ny >= pz.y1) continue;
          const goR = pz.x1 + npcBUB_PANEL_PAD + halfX - bx;   // > 0, push right
          const goL = pz.x0 - npcBUB_PANEL_PAD - halfX - bx;   // < 0, push left
          want += (goR < -goL) ? goR : goL;
        }
        b.ox = damp(b.ox, want, 10, dt);
        const nx = clamp(npcV1.x + b.ox, -limX, limX);
        b.el.style.left = ((nx * 0.5 + 0.5) * 100) + '%';
        b.el.style.top = ((-ny * 0.5 + 0.5) * 100) + '%';
        b.el.style.transform = 'translate(-50%,-100%) scale(' + sc.toFixed(3) + ')';
        b.el.style.opacity = a;
        if (!b.shown) { b.el.style.display = 'block'; b.shown = true; }
      } else {
        // ---- SAID BEHIND YOU (F4) ---------------------------------------
        // A bubble whose speaker is off the frame is DISPLAY:NONE and always
        // was — which is right, a caption pinned to the edge of the screen for
        // somebody you cannot see is worse than nothing. But the line is still
        // gone, and this is the channel the game uses to say that somebody
        // noticed you: a gardener shouting at your back while you run away is
        // exactly the sentence most worth hearing, and it was the one most
        // reliably lost.
        //
        // WITHIN npcSAY_HEAR METRES ONLY. The point is a person you could
        // plausibly hear — somebody the camera happens to have swung past — and
        // not every conversation in the chapter arriving as text. Twenty-five
        // metres is the same order as the ambience ring and well inside the
        // 90 m the crowd is drawn at.
        //
        // ONCE PER LINE, on the frame it turns up, latched on the slot: this
        // runs every frame the speaker is off-screen and a toast a frame would
        // be a wall of paper. At `note` weight, which is the quiet pill — it is
        // not news, it is something you would have read if you had been looking.
        // ---- AND IT IS ON A LONG FENCE (F4) -----------------------------
        // MEASURED, standing in the middle of Sydney's crowd: TWENTY-SIX lines
        // routed to the toast in twenty seconds. Which is the feature working
        // exactly as written and completely unusable — more than one a second,
        // a wall of paper, and the note weight makes it quieter rather than
        // rarer. In a crowd most speakers are off-frame most of the time; that
        // is not a bug in the test, it is the normal case.
        //
        // So it is not "every line you could have heard", it is "once in a
        // while, something behind you" — one every npcSAY_HEAR_GAP seconds,
        // whoever gets there first. A shout at your back is worth a pill; the
        // fourth remark about the price of coffee is not.
        if (!b.said && b.t < 0.5 && dist < npcSAY_HEAR && npcHeardT <= 0 &&
            game.hud && typeof game.hud.say === 'function') {
          b.said = true;
          npcHeardT = npcSAY_HEAR_GAP;
          try { game.hud.say(b.el.textContent); } catch (e) { /* never fatal */ }
        }
        if (b.shown) { b.el.style.display = 'none'; b.shown = false; }
      }
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
    sfxAt('bark', qdog.x, qdog.z, 0.34, 1);
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
      if (qdog.barkCd <= 0) { qdog.barkCd = rand(2.5, 6); sfxAt('bark', qdog.x, qdog.z, 0.30, 1); }
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
  // LOOKING IS ON A TICK, because the answer changes at most once a minute.
  // qgFindChips walks every prop in the chapter with six field tests each, and
  // with no target and no cooldown — which is the ordinary state of Sydney —
  // that ran at 60 Hz for a condition that needs somebody to have kicked a cone
  // of chips over first. Same shape as the stall-bind timer in props.js.
  const npcQG_LOOK = 0.4;
  let qgLookT = 0;
  let qgBestMob = 0;              // most gulls on the chips at once, this session

  function qgStep(dt) {
    qgCryCd -= dt;
    if (qgCool > 0) qgCool -= dt;
    if (qgTarget && (qgTarget.removed || qgTarget.held || qgTarget.owner ||
                     qgTarget.hidden || !qgTarget.body)) { qgTarget = null; qgMobT = 0; }
    // Without the cooldown the flock re-acquires the same cone on the very frame
    // it gives up on it — `disturbed` never clears — and mobs it forever.
    qgLookT -= dt;
    if (!qgTarget && qgCool <= 0 && qgLookT <= 0) {
      qgLookT = npcQG_LOOK;
      qgTarget = qgFindChips();
      if (qgTarget) qgMobT = 0;
    }

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
      // At the chips, which is where the birds are — tx/tz are the target's
      // own position and were already in scope two lines up the function.
      if (qgCryCd <= 0) { qgCryCd = rand(0.9, 1.8); sfxAt('gull', tx, tz, npcSFX_VOL, 1); }
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
        // ...AND THE COUNT IS ON THE PAPER WHILE THEY ARE ON IT (v36).
        // `arrived`, not `qgBestMob`: the interesting number is how many are on
        // the chips RIGHT NOW, which is what changes when the player drags the
        // food into the open. Handed over every frame the mob is live, so the
        // line climbs and falls with the birds and its own watchdog takes it
        // down when they go.
        if (typeof game.recordLive === "function") {
          try { game.recordLive("seagull-chips", arrived); } catch (e) {}
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
      sfx('gasp', rec);
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

  /**
   * Every face in the live chapter, from both crowds and the locals, as what
   * the geometry is actually doing. `browT` is the tilt in radians read back
   * off the node: positive is inner-end-DOWN, which is the scowl.
   */
  function npcFaceAudit() {
    const out = [];
    const live = game.biome ? game.biome.current : '';
    const take = (id, kind, rec, f, mood, st, headN, foot) => {
      if (!f) return;
      let hd = 0, fy = 0;
      if (headN && foot) { headN.getWorldPosition(npcV1); hd = npcV1.y; fy = foot.position.y; }
      out.push({ id: id, kind: kind, state: st || '', mood: Math.round(mood * 100) / 100,
                 eyeY: Math.round(f.eyeN.scale.y * 100) / 100,
                 eyeX: Math.round(f.eyeN.scale.x * 100) / 100,
                 browY: Math.round((f.browL.position.y - f.browY) * 1000) / 1000,
                 browT: Math.round(-f.browL.rotation.z * 100) / 100,
                 arch: rec.arch === undefined ? -1 : rec.arch,
                 // HEAD ABOVE THE FEET, in world metres. Not group.scale.y
                 // times a nominal 1.72: bLeg lifts the torso as well as the
                 // hip, so the scale on the root is not the height. A build
                 // has to be a measurement of the thing that gets drawn.
                 h: hd ? Math.round((hd - fy) * 100) / 100 : -1 });
    };
    if (biomeLive()) {
      for (let i = 0; i < humans.length; i++) {
        const r = humans[i];
        take(r.id, 'roster', r, r.face, r.mood, r.state, r.nodes.head, r.group);
      }
    }
    for (let i = 0; i < paHumans.length; i++) {
      const r = paHumans[i];
      take(r.id, 'pasto', r, r.face, r.mood, r.state, r.nodes.head, r.group);
    }
    for (let i = 0; i < locals.length; i++) {
      const r = locals[i];
      if (r.biome !== live || !r.fig) continue;
      take('local' + i, 'local', r.fig, r.fig.face, r.mood, '', r.fig.head, r.fig.group);
    }
    return out;
  }

  function pushInstances() {
    for (let i = 0; i < humans.length; i++) {
      const n = humans[i].nodes;
      iTorso.setMatrixAt(i, n.bob.matrixWorld);
      iHips.setMatrixAt(i, n.bob.matrixWorld);
      iHead.setMatrixAt(i, n.head.matrixWorld);
      iHair.setMatrixAt(i, n.head.matrixWorld);
      iHat.setMatrixAt(i, n.hatN.matrixWorld);
      iEyes.setMatrixAt(i, n.eyeN.matrixWorld);
      iBrow.setMatrixAt(i * 2, n.browL.matrixWorld);
      iBrow.setMatrixAt(i * 2 + 1, n.browR.matrixWorld);
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
    iEyes.instanceMatrix.needsUpdate = true;
    iBrow.instanceMatrix.needsUpdate = true;
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
  // chatReplyBiome is WHICH WORLD THE QUESTION WAS ASKED IN. chatStep is called
  // with two different pools (Sydney's humans, Pasto's cast) through one set of
  // reply slots, and these records carry no .biome of their own the way a local
  // does — so without this the reply was owed by a person, not by a place.
  let chatReplyRec = null, chatReplyT = 0, chatReplyKey = '', chatReplyBiome = '';

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
        // the question simply hangs, which is the better joke anyway. CROSSING
        // A BORDER IS ONE OF THE THINGS THAT CAN HAPPEN: localsChat has always
        // checked this and this did not, so a reply owed in Sydney could be
        // delivered a chapter later, in the wrong register, projected from a
        // coordinate with nobody standing on it.
        if (r.group && npcCHAT_CALM[r.state] && r.dejected <= 0 &&
            chatReplyBiome === ((game.biome && game.biome.current) || '')) {
          pickLine(r, chatReplyKey);
        }
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
        chatReplyBiome = (game.biome && game.biome.current) || '';
        chatT = rand(9, 24);        // …and now the long one, so it is not a chorus
        return;
      }
    }
  }

  function update(dt) {
    if (dt > 0.08) dt = 0.08;
    npcWxRead();
    // ---- THE PLACE COOLS IN REAL TIME (v33) -------------------------------
    // Above the biome gate on purpose: a square you left in a temper is not
    // waiting for you exactly as you left it three chapters later. And the two
    // published numbers are the only way the curve is visible from outside —
    // the same reason `witLast` exists a few hundred lines up.
    npcHeatDecay(dt);
    try {
      const cp = game.capy && game.capy.body && game.capy.body.position;
      game.state.heat = cp ? npcHeatAt(cp.x, cp.z) : 0;
      const liveB = game.biome && game.biome.current;
      let hn = 0;
      for (let i = 0; i < npcHeatSites.length; i++) if (npcHeatSites[i].biome === liveB) hn++;
      game.state.heatN = hn;
    } catch (e) { /* optional */ }
    // ...and the rumour from the last place, which is looking for anybody at
    // all and therefore belongs above the gate with the heat. See npcRumArm.
    npcRumStep(dt);
    // ...and CUSTOMS, above the gate for exactly the same reason: it is
    // looking for anybody at all, and it is the one line in the game that is
    // about something the player brought with them. See npcKeepStep.
    npcKeepStep(dt);
    // ...and THE REGULARS (O1), above the gate for the same reason: the
    // armed tier line is looking for one person in seventeen chapters and
    // Sydney is not one of them.
    npcPalStep(dt);

    // --- biome gate ------------------------------------------------------
    // In Pasto every Sydneysider is detached from the scene and the physics
    // world, so no state machine, raycast or steering step may run: the whole
    // module costs one boolean per frame.
    if (!biomeLive()) {
      // …but Pasto's locals are a different crowd on the same rig, and they only
      // run while Pasto is the attached biome.
      if (paLive()) paUpdate(dt);
      // AND THE OTHER FOURTEEN CHAPTERS GET THEIR PEOPLE HERE. Both of these
      // used to sit below the Sydney gate, which is why a bubble was a thing
      // that could only happen on one lawn in the world.
      if (paLive()) chatStep(dt, paCast);
      if (paLive()) npcBargeSweep(dt, paHumans);
      localsStep(dt);
      localsChat(dt);
      npcExStep(dt);
      updateBubbles(dt);
      return;
    }
    npcBargeSweep(dt, humans);
    localsStep(dt);
    npcExStep(dt);

    // ---- AND THE BIN CHICKENS WILL FOLLOW YOU (see THE HERD in systems.js) --
    // obey 1, and chapter one is the right place for the easiest tier: a Sydney
    // ibis will take a chip out of a stranger's hand and has no opinion at all
    // about dignity. It is also the first animal a player ever meets, so if the
    // herd is ever going to be discovered by accident it is discovered here.
    //
    // OFFERED HERE AND NOT AT BUILD TIME, and that is not a style choice: this
    // module is created at boot BEFORE systems.js is (…npcs → systems), so
    // `game.herdOffer` does not exist yet in the spawn loop and the offer was
    // silently skipped — Sydney reported no recruitable kinds at all in the
    // first measured run. One null check a frame, the same way `addCritter`
    // has to be reached.
    //
    // These are full NPC records, so the put writes the TARGET as well as the
    // position: `thinkIbis` steers toward `rec.target` on its own clock and
    // would spend the next second walking back to wherever it had been going.
    // Setting both means the bird and the herd agree about where it is going
    // instead of taking turns.
    if (!npcIbisOffered && typeof game.herdOffer === 'function') {
      npcIbisOffered = true;
      game.herdOffer({
        biome: 'sydney', kind: 'ibis', obey: 1, voice: 'gull', pitch: 0.8,
        count: function () { return ibises.length; },
        at: function (n, o) {
          const r = ibises[n];
          if (!r) return;
          o.x = r.group.position.x; o.y = r.group.position.y; o.z = r.group.position.z;
        },
        put: function (n, x, z, yaw) {
          const r = ibises[n];
          if (!r) return;
          r.group.position.x = x; r.group.position.z = z;
          r.target.set(x, r.group.position.y, z);
          r.yaw = yaw;
          r.state = 'wander';
        },
        // THREE IBIS IN A ROW DOWN THE BACK. One seat each, obey 1, and six of
        // them in the first chapter of the game — which is where this mechanic
        // has to be discoverable at all. See THE PERCH in systems.js.
        span: 1,
        lift: function (n, y) {
          const r = ibises[n];
          if (!r) return;
          r.perch = 0.25;              // re-asked every frame — see stepIbis
          r.group.position.y = y;
        },
        // ---- ...AND ONE OF THEM MAY LEAVE THE GARDENS (N3) --------------
        // See THE STOWAWAY in systems.js. An ibis is four InstancedMeshes
        // driven by four node matrices, and none of them is drawn once Sydney
        // detaches — so this is the same four geometries at their REST offsets,
        // which is `buildIbis`'s own table and the pose a bird being carried is
        // in anyway. Geometries and materials shared, never cloned.
        stow: function (n) {
          const r = ibises[n];
          const g = new THREE_.Group();
          const mk = function (geo, im, x, y, z) {
            const m = new THREE_.Mesh(geo, im.material);
            m.position.set(x, y, z);
            m.castShadow = true;
            g.add(m);
            return m;
          };
          mk(gIbisBody, iIbisB, 0, 0.32, 0);
          mk(gIbisNeck, iIbisN, 0, 0.40, 0.09);
          mk(gIbisLeg, iIbisLA, -0.06, 0.32, 0);
          mk(gIbisLeg, iIbisLB, 0.06, 0.32, 0);
          g.scale.setScalar(r && r.group ? r.group.scale.x : 1);
          return g;
        },
      });
    }

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
    const live = game.biome && game.biome.current;
    // ---- AND IT REACHED ONE OF THE TWO OLD CASTS, IN ALL NINETEEN PLACES ---
    //
    // This loop had no biome gate on it and did not mention `paHumans` at all,
    // which is both halves of the same mistake and both were measured:
    //
    //   THE LEAK   `stepHuman` — the only thing that decays `rec.wary` — runs
    //              only while Sydney is attached, so a Sydneysider you startled
    //              on your way out of chapter 1 is frozen wary FOR THE REST OF
    //              THE SESSION, standing at a coordinate that exists in every
    //              other chapter too. `most-wanted` (heat ≥ 5 within 20 m) and
    //              `not-a-soul` (heat === 0) are the two finds that read this,
    //              and in seventeen chapters both were answering questions
    //              about a park in Sydney.
    //   THE GAP    Pasto's thirteen people are in `paHumans`, which nothing
    //              here ever swept — so chapter 2, the chapter with the most
    //              edible props in the game, could not raise heat at all.
    //
    // Both casts come out of the same `buildHuman`, so one gated sweep over
    // whichever of them is live is the whole fix. See BATCH7 job 3a.
    // ---- AND IT IS ONE FRAME BEHIND ITSELF IN BOTH OF THEM ----------------
    // A local's `wary` is written INLINE by localsReact, on the frame of the
    // event. These two casts do not have one: `wary` is DERIVED from `alarm`
    // inside stepHuman, on the next tick — which is a good design (six call
    // sites raise alarm and none of them had to learn a new word) and it means
    // that anything asking "who is watching for me" at the instant of an event
    // reads a crowd that has not felt it yet. Measured: two Sydneysiders at
    // wary 0.64 three metres from the stall, and npcHeat answering 0 on the
    // frame the robbery happened, three times running. `alarm` is what they
    // feel right now and `wary` is what they remember; watching for you is
    // either, so the answer is the larger.
    const cast = live === 'sydney' ? humans : live === 'pasto' ? paHumans : null;
    if (cast) {
      for (let i = 0; i < cast.length; i++) {
        const h = cast[i];
        if (!h || !h.group) continue;
        const w = Math.max(h.wary || 0, h.alarm || 0);
        if (w <= npcWARY_HEAT) continue;
        const dx = h.group.position.x - x, dz = h.group.position.z - z;
        if (dx * dx + dz * dz < r2) n++;
      }
    }
    for (let i = 0; i < locals.length; i++) {
      const L = locals[i];
      if (!L || L.biome !== live || (L.wary || 0) <= npcWARY_HEAT) continue;
      const dx = L.x - x, dz = L.z - z;
      if (dx * dx + dz * dz < r2) n++;
    }
    return n;
  }

  /**
   * SOMEBODY NEAR THIS POINT SAYS IT. True if anybody did (B3, item 1d).
   *
   * `sayAt` puts a bubble at a bare point, which is the world narrating; this
   * puts one over a PERSON, which is somebody telling you. The difference is
   * the whole of item 1d's second half.
   *
   * IT LIVES HERE AND NOT IN systems.js, and that is the point rather than
   * tidiness. The first cut of the nudge was written in systems.js against
   * `game.npcs` with the same `r.biome !== live || !r.fig` test the owner
   * search uses — and measured, in Sydney, **every one of those two conditions
   * rejects every record**: `game.npcs` entries carry neither `biome` nor
   * `fig`. Those are LOCALS' fields. The cast and the locals are two different
   * shapes in two different arrays and only this file knows which is which, so
   * only this file can answer the question. It is the Pasto-by-name family: a
   * consumer written against one collection is silently dead in the rest.
   *
   * Three refusals, each one a way for this to be worse than saying nothing:
   *   - ANIMALS DO NOT SPEAK. `game.npcs` mixes six ibises in with eleven
   *     tourists, and their `speak` is a comment — 'bin chickens do not speak.
   *     they judge.' A no-op would swallow the line in silence, and the caller
   *     would believe it had been said.
   *   - nobody mid-sentence, and nobody who has just spoken: `talkCd` is how
   *     this file stops two people answering at once.
   *   - nobody in a chapter you have left. Every biome stays resident.
   */
  function saySomebodyNear(x, z, radius, text) {
    if (!text || !game.state.started) return false;
    const live = game.biome && game.biome.current;
    if (!live) return false;
    const r2 = (radius > 0 ? radius : 12) * (radius > 0 ? radius : 12);
    let best = null, bestD = r2, bestSay = null;
    // The steering cast: Sydney's and Pasto's people, and only the PEOPLE —
    // `humans`/`paHumans` are the human sub-arrays, so the ibises, the llamas
    // and the street dog are excluded by construction rather than by a list of
    // kinds that would go stale the next time an animal is added.
    const cast = live === 'sydney' ? humans : live === 'pasto' ? paHumans : null;
    if (cast) {
      for (let i = 0; i < cast.length; i++) {
        const h = cast[i];
        if (!h || !h.group || !h.group.visible || (h.talkCd || 0) > 0) continue;
        if (h.state === 'flee' || h.state === 'plunge' || h.state === 'swim') continue;
        const dx = h.group.position.x - x, dz = h.group.position.z - z;
        const d2 = dx * dx + dz * dz;
        if (d2 < bestD) { bestD = d2; best = h; bestSay = h; }
      }
    }
    // ...and the locals, who are the only people standing in the other
    // seventeen chapters. A local's voice hangs off `anchor`, because a fixed
    // local has no head node to put a bubble on.
    for (let i = 0; i < locals.length; i++) {
      const L = locals[i];
      if (!L || L.biome !== live || !L.fig || (L.talkCd || 0) > 0) continue;
      if (!L.anchor || typeof L.anchor.speak !== 'function') continue;
      const dx = L.x - x, dz = L.z - z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestD) { bestD = d2; best = L; bestSay = L.anchor; }
    }
    if (!best || !bestSay || typeof bestSay.speak !== 'function') return false;
    best.talkCd = rand(10, 22);
    // ...and they look at you while they say it, which is the same two numbers
    // the witness chain writes and the reason a line reads as addressed to
    // somebody rather than muttered at the pavement.
    best.lookX = x; best.lookZ = z;
    try { bestSay.speak(text); } catch (e) { return false; }
    return true;
  }

  // =========================================================================
  // GOSSIP — WHAT THIS PLACE HEARD ABOUT THE LAST ONE (item 6, B15)
  //
  // `biome:enter` has carried `{ name, from }` since F3 and nothing has ever
  // read `from`. systems.js owns the counters that say whether the last place
  // has anything to talk about; this owns the voice, which is the same split
  // `sayNear` and the 150-second nudge already use.
  //
  // IT IS ARMED, NOT SAID. The obvious build says the line on arrival, and
  // MEASURED across all nineteen that lands in fourteen: four chapters have
  // nobody within sixteen metres of where you spawn (the Drift, the Pantanal,
  // Sơn Đoòng, Antarctica — all of which have six to eight people somewhere
  // else in them), and Pasto's cast is counted by `peopleNear` four seconds
  // after a crossing but is not yet eligible to speak. Both failures vanish
  // if the line waits for somebody instead of requiring somebody to be
  // standing at the door: it is armed on the way in and spent the first time
  // a person is close enough, which in a chapter with people in it is a
  // question of walking rather than of luck.
  //
  // ONE LINE PER ARRIVAL, and it is dropped on the next crossing whether it
  // was said or not — a rumour about two places ago is not gossip, it is a
  // filing system.
  // NAMED npcRum*, AND THE FIRST CUT WAS NAMED npcHeard*. `npcHeardT` is
  // already declared at the top of this module — it is the fence that lets at
  // most one OVERHEARD line become a HUD pill every nine seconds (see
  // npcSAY_HEAR_GAP and updateBubbles) — and a `let npcHeardT` inside
  // createNPCs shadows it for the whole factory body, including the three
  // places that fence is read and written eleven hundred lines above here.
  //
  // MEASURED, because it is invisible by inspection: the six-second wait
  // drained in three, at a ratio of exactly 2.01 against the wall clock, and
  // the timer later rose to 8.9 having armed at 6. Both were the pill fence —
  // one decrement a frame from updateBubbles on top of this one's, and
  // `npcHeardT = npcSAY_HEAR_GAP` when somebody was overheard. The pill fence
  // was equally broken in the other direction and nothing said so.
  //
  // The build's collision check counts TOP-LEVEL declarations across modules
  // and cannot see a shadow inside one function, so it reported no collisions.
  const npcRUM_R    = 16;    // m of earshot. Measured: see the table in CONTRACT
  const npcRUM_WAIT = 6.0;   // s after arrival before the first attempt. The
                               // place card is up for 3.6 of them and a rumour
                               // over the top of the chapter's own name is two
                               // things at once.
  const npcRUM_TRY  = 1.5;   // s between attempts, so a walk toward somebody
                               // pays inside a couple of steps of arriving
  let npcRumLine = '';
  let npcRumT = 0;
  /**
   * Arm the line for this arrival. `place` is the previous chapter's NAME —
   * "Kyoto & Uji" — and `kind` is which pool, decided by whoever knows what
   * happened there. Returns the line it will say, for the audit.
   */
  // ONE WRITER, AND IT IS CALLED ON EVERY CROSSING. Clearing the old line
  // inside this module's own `biome:enter` handler would have been the obvious
  // place and is a race: handlers run in registration order, and if systems.js
  // arms before npc.js clears, the arm is wiped by a handler for the same
  // event. So the contract is that systems.js calls this on EVERY arrival, and
  // passes no place when the last one has nothing worth repeating — which
  // clears it here, in the one function that writes it.
  function npcRumArm(place, kind) {
    npcRumLine = '';
    npcRumT = npcRUM_WAIT;
    // ---- ...AND THE TWO KINDS THAT NAME NO PLACE (item 6) ----------------
    // NOTORIETY comes through this same door and not a second one, because
    // ONE LINE PER ARRIVAL is a rule about the arrival and not about the
    // rumour: two armed sentences racing for the first mouth in earshot is
    // two people greeting you in the same breath. systems.js owns which of the
    // four kinds this arrival is worth — it holds the counters and the tier —
    // and this owns the words and the waiting, exactly as before.
    if (kind === 'noto' || kind === 'noto2') {
      const np = npcLOC_SAY[kind === 'noto2' ? 'notoriousBig' : 'notorious'];
      if (!np || !np.length) return '';
      npcRumLine = np[randInt(0, np.length - 1)];
      return npcRumLine;
    }
    if (!place) return '';
    const pool = npcLOC_SAY[kind === 'good' ? 'heardGood' : 'heardBad'];
    if (!pool || !pool.length) return '';
    npcRumLine = pool[randInt(0, pool.length - 1)].split('{P}').join(place);
    return npcRumLine;
  }
  /** The armed line and its clock, for the harness. Nothing in src reads it. */
  function npcRumAudit() {
    return { line: npcRumLine, t: +npcRumT.toFixed(2), r: npcRUM_R };
  }
  function npcRumStep(dt) {
    if (!npcRumLine || !game.state.started) return;
    npcRumT -= dt;
    if (npcRumT > 0) return;
    npcRumT = npcRUM_TRY;
    const p = game.capy && game.capy.position;
    if (!p) return;
    // A line that lands is spent; one that finds nobody is kept and tried
    // again, which is the whole point of arming it.
    if (saySomebodyNear(p.x, p.z, npcRUM_R, npcRumLine)) npcRumLine = '';
  }

  // =========================================================================
  // CUSTOMS — THE THING IN ITS MOUTH THAT IS NOT FROM HERE
  //
  // See the `keepsake` pool in npcLOC_SAY for what this says and why it is one
  // pool rather than nineteen. This is when.
  //
  // ARMED AND SPENT, exactly like the rumour above, and for the same measured
  // reason: four chapters have nobody within sixteen metres of where you land,
  // so a line that must be said AT a moment is a line that four chapters never
  // say. This one has it worse — the moment is "you are carrying something",
  // which lasts as long as you carry it — so waiting for a mouth is not a
  // fallback here, it is the whole mechanism. Pick the whisk up in Uji, walk
  // it to Hanoi, and the first person you get near has something to say about
  // it.
  //
  // THE PAIR IS THE LATCH, and it is `here|from` rather than either alone. One
  // line per object per place per visit: carrying the same shell round Venice
  // is one remark, and taking it on to Hong Kong is another, because that is a
  // different joke. Re-entering a place clears the set, because coming back
  // somewhere with the same thing in your mouth is the same joke again and it
  // has been an hour.
  //
  // IT CANNOT FIRE ON A SOUVENIR AT HOME. `from !== live` is the whole gate,
  // and it is the difference between a keepsake and a piece of luggage: the
  // pine cone lying in Manly is Manly's, and nobody remarks on a pine cone in
  // Manly.
  const npcKEEP_R    = 14;   // m of earshot. Inside npcRUM_R's 16 on purpose:
                             // a rumour is shouted across a square, an object
                             // in somebody's mouth has to be seen.
  const npcKEEP_WAIT = 2.5;  // s of carrying it before anybody remarks. Long
                             // enough that picking a thing up and putting it
                             // straight back down says nothing.
  const npcKEEP_TRY  = 2.0;  // s between attempts to find a mouth
  const npcKeepSaid = Object.create(null);   // 'here|from' -> already said
  let npcKeepLine = '';
  let npcKeepT = 0;
  let npcKeepFor = '';       // the pair the armed line is about
  let npcKeepBiome = '';     // ...and the place the `said` set belongs to
  function npcKeepStep(dt) {
    if (!game.state || !game.state.started) return;
    const live = (game.biome && game.biome.current) || '';
    // ONE WRITER AND NO EVENT HANDLER. The set is this module's alone, so the
    // race npcRumArm's note describes cannot arise here — and detecting the
    // crossing off the live name costs one string compare a frame and removes
    // a listener that would have to be reasoned about at every rollback.
    if (live !== npcKeepBiome) {
      npcKeepBiome = live;
      for (const k in npcKeepSaid) delete npcKeepSaid[k];
      npcKeepLine = ''; npcKeepFor = '';
    }
    const held = game.capy && game.capy.heldProp;
    const from = (held && !held.removed && held.keep) ? held.keep : '';
    const pair = (from && live && from !== live) ? live + '|' + from : '';
    if (pair !== npcKeepFor) {
      npcKeepFor = pair;
      npcKeepLine = '';
      npcKeepT = npcKEEP_WAIT;
      if (pair && !npcKeepSaid[pair]) {
        const pool = npcLOC_SAY.keepsake;
        if (pool && pool.length) {
          npcKeepLine = pool[randInt(0, pool.length - 1)]
                          .split('{O}').join(held.name || 'that');
        }
      }
    }
    if (!npcKeepLine) return;
    npcKeepT -= dt;
    if (npcKeepT > 0) return;
    npcKeepT = npcKEEP_TRY;
    const p = game.capy && game.capy.position;
    if (!p) return;
    if (saySomebodyNear(p.x, p.z, npcKEEP_R, npcKeepLine)) {
      npcKeepSaid[npcKeepFor] = 1;
      npcKeepLine = '';
    }
  }
  /**
   * THE TIER, HANDED DOWN (item 6). The same three-line shape as npcPalSet and
   * for the same reason: systems.js holds the number because it is a fact
   * about the journey and lives on the save file, and this module holds what
   * the number buys. This module never computes a score and that module never
   * learns what a widened radius is.
   */
  function npcNotoSet(t) { npcNotoTier = Math.max(0, Math.min(5, t | 0)); }
  /**
   * THE MARCH, FOR THE HARNESS. Nothing in src reads this. `dist` is the one
   * number that says whether it is working at all: a marcher who never closes
   * is a marcher whose steer is blocked, and that is invisible from the state.
   */
  function npcMarchAudit() {
    const cp = game.capy && game.capy.position;
    return {
      on: !!marWho, t: +marT.toFixed(2),
      dist: marWho && cp ? +Math.hypot(cp.x - marWho.x, cp.z - marWho.z).toFixed(2) : -1,
      fromAnchor: marWho ? +Math.hypot(marWho.x - marWho.ax, marWho.z - marWho.az).toFixed(2) : -1,
      at: npcMAR_GO, take: npcMAR_TAKE, out: npcMAR_OUT_T, leash: npcOWN_LEASH,
      why: marWhy, blocked: marBlocked,
    };
  }
  /** For the harness. See npcNOTO_TIER. */
  function npcNotoAudit() {
    return { tier: npcNotoTier, door: +npcNotoT.toFixed(2),
             on: npcNotoT > 0 && npcNotoTier >= npcNOTO_TIER,
             at: npcNOTO_TIER, look: npcNOTO_LOOK };
  }
  /** The armed line and its clock, for the harness. Nothing in src reads it. */
  function npcKeepAudit() {
    let said = 0;
    for (const k in npcKeepSaid) said++;
    return { line: npcKeepLine, pair: npcKeepFor, t: +npcKeepT.toFixed(2),
             r: npcKEEP_R, said: said };
  }

  // =========================================================================
  // THE REGULARS — ONE PERSON PER PLACE WHO DOES NOT FORGET (ROADMAP-NEXT 1, O1)
  //
  // Every relationship in this game is a state of the current visit. `wary`
  // and `fam` are both damped numbers on a record that is rebuilt when the
  // chapter is, `saveWrite` writes no per-person field, and the checklist is
  // the only thing that has ever crossed a reload — so a player coming back to
  // a chapter they spent an hour in is a total stranger to every person in it,
  // and the save proves they were here only with a tally.
  //
  // A REGULAR IS THE ONE PERSON PER CHAPTER WHO REMEMBERS. Five tiers, at most
  // one tier per visit, and the tier is on the file. It is not a new kind of
  // person and not a new system: it is a lookup that names somebody who is
  // already standing there, a line pool, and a counter in systems.js.
  //
  // ---- WHO, AND HOW THEY ARE NAMED ---------------------------------------
  // A local record has no id. It has no name, no kind and no key — a chapter
  // calls addLocal with coordinates and lines, and what comes back is
  // identified by nothing at all. Three ways to point at one, and the third is
  // the only honest one:
  //   BY INDEX into `locals` — stable today and silently wrong the first time
  //     a chapter file reorders two calls, which is the failure that seated
  //     five diners on thin air.
  //   BY A NEW FIELD on addLocal — correct, and seventeen biome files edited
  //     for a field only this table reads.
  //   BY WHAT THEY SAY, which is what they are. `find` is a substring of the
  //     person's own first line, so the row below IS legible as a person, and
  //     a rewording breaks it LOUDLY: `palAudit()` reports every chapter whose
  //     regular could not be found, and qa/o1-static.cjs asserts seventeen.
  //
  // SEVENTEEN, NOT NINETEEN, AND THE REASON IS NOT THE ONE THE ITEM ASSUMED.
  // Sydney and Pasto register zero locals — their people are the steering cast
  // and they walk — so neither has anybody who can be a fixed regular.
  // Measured: the item guessed the two empty chapters were the Pantanal and
  // Son Doong, and both of those have seven locals each; they are simply
  // thirty metres from the spawn, which the arming below makes irrelevant.
  //
  // ---- WHAT EARNS A TIER, AND WHAT IT COSTS ------------------------------
  // `fam` crossing npcFAM_HEAT — which is THE CALM, read on one person. It is
  // "sit near them and let something be nothing for a while", which is the one
  // thing this game has always wanted a player to be rewarded for.
  // MEASURED, four chapters, animal placed 2.5 m away and never touched again:
  // the crossing lands at 24.4 s in all four, and full familiarity at 61-97.
  // So a tier is about twenty-five seconds of deliberately doing nothing.
  //
  // IT LATCHES ON THE CROSSING AND IS NEVER A HELD STATE, and that is not
  // fussiness. In the same runs `wary` spiked to 0.5-0.97 between 25 and 30
  // seconds in every chapter with props near the counter, off a prop:impact
  // inside npcWARY_BLAME of a MOTIONLESS animal — the blame radius is a
  // radius, not an accusation — and `fam` was wiped to zero in two of the
  // four. A tier that asked the player to HOLD a number would be a coin flip
  // on the world's own furniture. Crossing it once is the whole condition.
  //
  // ---- AND THE LINE WAITS FOR THEM ---------------------------------------
  // The item wanted the tier line on arrival, and that was measured against
  // the spawns: only twelve of the seventeen have their regular within twelve
  // metres of where you land, and the Drift's is 26 m away, Son Doong's 31,
  // the Pantanal's 32. Nobody is moved and no regular is re-chosen for being
  // far away. The line is ARMED instead, exactly as B15's rumour is — held
  // until the person it belongs to is within earshot and free, then spent.
  // The difference from the rumour is the only interesting part: a rumour
  // wants ANYBODY and this wants one named person, so it cannot go through
  // saySomebodyNear and keeps its own six lines of earshot.
  const npcPAL_R    = 11;    // m the regular has to be inside to say their line
  const npcPAL_WAIT = 1.6;   // s after arming before it is first tried
  const npcPAL_TRY  = 0.8;   // s between tries while they are out of earshot
  const npcPAL_KEEP = 210;   // s an unspoken line is kept before it is dropped
  // ---- THE SEVENTEEN ------------------------------------------------------
  // `find` identifies them (see above). `who` is what the paper calls them.
  // `call` is THEIR NAME FOR YOU, which arrives at tier three and is theirs —
  // the joke of the whole item is that the capybara is famous and this person
  // is not impressed, so the name is never flattering and never the animal's.
  // `tiers` is one line per tier, said the moment the tier is earned and then
  // used as their greeting on every arrival until the next one is. That is
  // deliberate and not a saving: the line a person has for you IS the state of
  // the friendship, and hearing "Oh. It is you." on three arrivals running is
  // the joke working rather than a pool that ran dry.
  const npcPAL = {
    quay: { who: 'the platform guard', find: 'Mind the gap', call: 'Gap',
      gift: 'ticket', giftSay: 'Ferry ticket. It is yesterday\u2019s. Nobody checks.',
      tiers: ['Oh. It is you.',
              'You again. Nobody has reported you yet.',
              'Morning, Gap. That is what I have got you down as.',
              'Between us: the gate on the end has never locked.',
              'Chair is behind the barrier. Do not tell the ferry people.'] },
    kyoto: { who: 'the step-sweeper', find: 'swept this step', call: 'Sweeper',
      gift: 'dango', giftSay: 'Take one. They go hard by the evening anyway.',
      tiers: ['You are standing on the step.',
              'Sixty years, and you are the first to come back.',
              'You sweep as well as anybody. Sweeper.',
              'The moss on the north corner is four hundred years old. Nobody is told that.',
              'I have left the low stone clear. That one is yours.'] },
    cali: { who: 'the lulada seller', find: 'Lulada! Con hielo! Two thousand!', call: 'Primo',
      gift: 'cuencobowl', giftSay: 'Con hielo. Put it down and I will fill it again.',
      tiers: ['Ah. The animal.',
              'Twice. Twice is a customer.',
              'Primo. Con hielo, no charge, do not tell anybody.',
              'The good lulo comes off the second cart, never the first.',
              'That crate is yours. I stopped selling off it a week ago.'] },
    rio: { who: 'the Globo man', find: 'Biscoito Globo', call: 'Doce',
      gift: 'snack', giftSay: 'Doce. On the house, and do not tell the beach.',
      tiers: ['You are in the way.',
              'Back. Right. Still in the way.',
              'Doce, then. Sweet. You look like the sweet ones.',
              'The tide turns at the third post. That is when the beach is yours.',
              'Sit under the umbrella. It is not for customers, it is for you.'] },
    iceland: { who: 'the pylsa stand', find: 'Eina með öllu', call: 'Everything',
      gift: 'sandwich', giftSay: 'One with everything. You will not eat it. Take it.',
      tiers: ['One with everything?',
              'You do not eat them. You just stand there.',
              'One With Everything. That is your name now. You earned it.',
              'The lights are best from behind the stand, and not before midnight.',
              'The hatch is open on your side. Sit in the warm.'] },
    sahara: { who: 'the orange cart', find: 'Four dirham! Fresh', call: 'Four Dirham',
      gift: 'cuencobowl', giftSay: 'Four dirham. I am not going to say it again.',
      tiers: ['No. No animals at the cart.',
              'You came back to a man who said no. Interesting.',
              'Four Dirham. Because you have never once paid it.',
              'The drummers start when the light comes off the mosque. Not before.',
              'I have moved the crate. You fit it exactly.'] },
    drift: { who: 'the ice fisherman', find: 'I have been at it eleven years', call: 'Eleven Years',
      gift: 'mug', giftSay: 'It is hot. It will be cold in four minutes. Drink it.',
      tiers: ['There is nothing down there, and now there is you.',
              'Eleven years alone. Two days of company.',
              'Eleven Years. You have nearly been here as long as I have.',
              'Under the second ridge it is warm. Do not ask me how I know.',
              'Second stool. It has been out since you left.'] },
    venice: { who: 'the gondolier', find: 'Gondola, gondola', call: 'Fifty Minutes',
      gift: 'winebottle', giftSay: 'Not the good one. Not the bad one either.',
      tiers: ['Gondola? No. Not for you.',
              'Still no. But you are consistent.',
              'Fifty Minutes. That is what you cost me every time.',
              'The water comes up the calle before it comes up the square. Watch the calle.',
              'Get in. Sit at the front. Nobody sits at the front.'] },
    kowloon: { who: 'the egg tart baker', find: 'Egg tart', call: 'Two Minutes',
      gift: 'chips', giftSay: 'Straight out. Two minutes. Do not carry it far.',
      tiers: ['Ah. No. Shoo.',
              'Shoo. Softer, that time.',
              'Two Minutes. Because you turn up when they come out. Every time.',
              'It is the four o clock tray. It has never been the noon tray.',
              'The stool is out. It is out because of you.'] },
    palawan: { who: 'the net mender', find: 'Net has a hole', call: 'Hole',
      gift: 'basket', giftSay: 'Basket has a hole in it as well. You will manage.',
      tiers: ['Mind the net.',
              'You did mind the net. Nobody minds the net.',
              'Hole. You are named after the net. Here that is an honour.',
              'The far reef opens an hour after the tide turns, and only an hour.',
              'The dry end of the mat is yours now.'] },
    goreme: { who: 'the tea maker', find: 'There is always tea', call: 'Cay',
      gift: 'mug', giftSay: 'Tea. You did not ask. That is not how it works here.',
      tiers: ['Sit, then. Everybody sits.',
              'You sat. And you came back to sit again.',
              'Cay. That is you. You are the tea now.',
              'The balloons go up off the west field while the valley is still dark.',
              'The cushion by the stove. I have stopped putting anybody else on it.'] },
    // MANLY'S REGULAR IS THE LIFEGUARD AND WAS THE CHIP SHOP, and the reason
    // is a measurement rather than a preference. A tier is earned by sitting
    // still beside somebody, so a regular has to be somebody a capybara can
    // actually sit beside. Eight bearings at 2.4 m, forty-five seconds each:
    // at the chip shop the animal WEDGED on two of them — restT flat at 0.0
    // for the whole run, which is the calm never starting, which is the tier
    // being unreachable from that side — and slid up to 5.5 m on three more.
    // At the lifeguard it wedged on none and slid on one.
    //
    // AND MANLY IS SLOW EVEN SO. Its calm settles at 0.775 against Kyoto's
    // 0.996 (the surf keeps `chaos` alive), and `fam` rises with the calm as
    // a multiplier — so a tier here is about a minute where everywhere else
    // it is twenty-five seconds. That is the beach being a beach, and it is
    // left alone.
    manly: { who: 'the lifeguard', find: 'Swim between the flags, mate', call: 'Flags',
      gift: 'towel', giftSay: 'Towel. It is not clean. Nothing here is clean.',
      tiers: ['Not between the flags. Nothing is, today.',
              'You again. Still not between the flags.',
              'Flags. That is you. You have never once been between them.',
              'The rip runs out past the second flag. That is the fast way round.',
              'Tower is open. Sit up there, out of the wind.'] },
    pantanal: { who: 'the cattle hand', find: 'Eleven in the pen', call: 'Twelve',
      gift: 'hat', giftSay: 'Hat. The sun does not care that you are an animal.',
      tiers: ['Eleven in the pen and one at the gate.',
              'Twice at the gate. That is a habit.',
              'Twelve. I have started counting you.',
              'The otters come through at first light and not at dusk. Everybody gets that wrong.',
              'The gate is open on the shady side. That is where you go.'] },
    cave: { who: 'the rope man', find: 'Rope is good', call: 'Good Rope',
      gift: 'mug', giftSay: 'Hot. It is the only hot thing in nine hundred metres.',
      tiers: ['Do not touch the rope.',
              'You did not touch the rope. Twice.',
              'Good Rope. It is the best thing I can call anybody.',
              'There is a way through at the back of the second chamber. It is not on the survey.',
              'I have coiled one flat for you. That is a bed.'] },
    antarctic: { who: 'the base bar', find: 'We open at six', call: 'Six',
      gift: 'mug', giftSay: 'There. That is the mug nobody else gets.',
      tiers: ['We open at six. It is not six.',
              'It is not six, and here you are again.',
              'Six. Because you have never once come at six.',
              'The pack breaks off the point about an hour before anybody says it will.',
              'That end of the bench is yours. I have stopped wiping it.'] },
    monaco: { who: 'the deckhand', find: 'The owner is in Gstaad', call: 'Sir',
      gift: 'sunglasses', giftSay: 'The owner\u2019s. The owner is in Gstaad.',
      tiers: ['Off the boat. Off.',
              'Off the boat, sir. That is a promotion.',
              'Sir. I have decided you are the owner and he is not.',
              'The gate at the end of the pontoon is never locked before ten.',
              'The cushion is out. The owner has never sat on it. You have.'] },
    hanoi: { who: 'the tea lady', find: 'It is always tea', call: 'Always Tea',
      gift: 'phobowl', giftSay: 'Sit. Eat. It is not tea and I am not explaining.',
      tiers: ['Too hot for tea. Have some tea.',
              'You have had two teas and drunk neither.',
              'Always Tea. That is what the street calls you now. My fault.',
              'The traffic stops for nothing, so you go slowly. Slowly is the whole trick.',
              'The little stool. The blue one. It is not for customers.'] },
  };
  // ---- WHAT THE FRIENDSHIP BUYS (O2) --------------------------------------
  // O1 built the memory and the lines. These are the two tiers that are not
  // only a line, and the thresholds live HERE rather than in systems.js: that
  // module owns the NUMBER, because a tier is on the save file, and this one
  // owns what the number MEANS, because that is the same thing the line pool
  // is. `palSet` is the whole of the traffic between them.
  const npcPAL_MAX    = 5;
  const npcPAL_GIFT_T = 3;    // tier at which they start putting things out
  const npcPAL_SOFT_T = 4;    // ...and at which they stop noticing what you do
  const npcPAL_SOFT   = 0.25; // × the wariness THEY write. See the block below.
  const npcPAL_GIFT_CD = 95;  // s between one being put out. It is not a shop.
  const npcPAL_GIFT_R  = 12;  // m — they do not do it to an empty street
  const npcPAL_GIFT_D  = 1.35;// m from them it is set down
  const npcPAL_GIFT_KEEP = 2.2;// m: within this of them, the last one is still there
  let npcPalRec = null, npcPalFor = '';   // the cached pick and the chapter it is for
  let npcPalFind = 0;                     // s until the next attempt to find them
  let npcPalLine = '', npcPalT = 0, npcPalKeep = 0;
  let npcPalWarm = false;                 // has this visit already reported a warming
  let npcPalTier = 0;                     // O2: handed over by systems.js. See npcPalSet.
  let npcPalGiftT = 0, npcPalGiven = 0;   // O2: the gift clock, and the session count
  let npcPalGiftP = null;                 // O2: the last one, while it is still lying there
  /**
   * THE REGULAR IN THE LIVE CHAPTER, OR NULL. Cached per chapter, and the
   * cache is only filled by a HIT: a chapter's locals are registered while it
   * builds, so the first call can legitimately come before the person exists,
   * and a cached null would be permanent for the session. A miss re-searches
   * twice a second, which is a handful of string tests, and stops mattering
   * the moment the chapter has finished building.
   */
  function npcPalPick(dt) {
    const live = game.biome && game.biome.current;
    if (!live || !npcPAL[live]) { npcPalRec = null; npcPalFor = live || ''; return null; }
    if (npcPalFor === live && npcPalRec) return npcPalRec;
    if (npcPalFor !== live) { npcPalFor = live; npcPalRec = null; npcPalFind = 0; }
    npcPalFind -= dt || 0;
    if (npcPalFind > 0) return null;
    npcPalFind = 0.5;
    const find = npcPAL[live].find;
    for (let i = 0; i < locals.length; i++) {
      const L = locals[i];
      // The traveller is excluded BY NAME rather than by luck: they are the
      // nearest person to the spawn in Marrakech and in Cappadocia, they are
      // already the recurring character who remembers you, and a regular who
      // was also the traveller would be one person doing two jobs in four of
      // the seventeen chapters.
      if (!L || L.biome !== live || L.trav || !L.lines || !L.lines.length) continue;
      const f = L.lines[0];
      const t = typeof f === 'string' ? f : (f && f.t);
      if (t && t.indexOf(find) >= 0) { npcPalRec = L; return L; }
    }
    return null;
  }
  /**
   * HOLD A LINE UNTIL THE REGULAR CAN SAY IT. systems.js owns the tier and
   * calls this; the pool, the earshot and the waiting are here, which is the
   * split B15 settled. `n` is 1..5.
   */
  function npcPalArm(n) {
    const live = game.biome && game.biome.current;
    const row = live && npcPAL[live];
    npcPalLine = '';
    if (!row || !(n >= 1 && n <= npcPAL_MAX)) return '';
    npcPalLine = row.tiers[n - 1] || '';
    npcPalT = npcPAL_WAIT;
    npcPalKeep = npcPAL_KEEP;
    return npcPalLine;
  }
  /**
   * THE TIER, HANDED OVER BY THE ONLY MODULE THAT KNOWS IT (O2).
   *
   * systems.js calls this on `biome:enter` and on every bump. Nothing else
   * writes it and nothing here persists it — a reload with no save leaves it
   * at nought, which is the correct history for somebody nobody has met.
   */
  function npcPalSet(t) {
    npcPalTier = (typeof t === 'number' && t > 0) ? Math.min(npcPAL_MAX, Math.round(t)) : 0;
    return npcPalTier;
  }
  /**
   * ...AND THEY LOOK THE OTHER WAY (O2, tier 4).
   *
   * THE INTERLOCK RUNNING BACKWARDS. `wary` is the memory of what the animal
   * did and it is what shuts the charm economy down: over npcWARY_HEAT a
   * person stops warming to you, stops photographing you and stops giving you
   * anything. Until now nothing in the game could ever buy any of that back,
   * so a player who liked the mischief half was permanently poorer at the
   * quiet half. This is the first thing that goes the other way — and it is
   * ONE PERSON in a chapter, at the fourth of five tiers, so it is a friend
   * covering for you and not a difficulty setting.
   *
   * IT SCALES THE WARINESS WRITTEN AND NOT `alarm`, `fl` OR THE LINE. They
   * still jump, still turn round, still say something — the nine-skills pass
   * found that soft feet had to do exactly this or the world stops reacting,
   * which reads as a broken game rather than as a kindness. What changes is
   * only what they REMEMBER, which is the thing the tier is about.
   *
   * npcQUIET_K (0.45, soft feet) is the shape and 0.25 is the number: this is
   * meant to be more than a skill, and it is one person rather than everybody.
   */
  function npcPalSoft(rec) {
    if (!rec || npcPalTier < npcPAL_SOFT_T || rec !== npcPalRec) return 1;
    return npcPAL_SOFT;
  }
  /**
   * PUT SOMETHING OF THEIRS DOWN WHERE YOU CAN REACH IT (O2, tier 3).
   *
   * IT IS SET DOWN AND NOT THROWN, and that was measured rather than chosen.
   * B8’s gift is an underarm lob because a snack can be lobbed; a regular’s
   * own thing is a bowl, a bottle, a mug, a paper cone of chips — and eight of
   * the seventeen candidates SHATTERED OR SPILLED on landing when the lob was
   * measured (fragile: cuencobowl, mug, winebottle, sunglasses, phobowl;
   * spill: chips, coffee, flowers). Set down at rest height instead, all
   * seventeen survive and every one of them can be picked up.
   *
   * And the fiction is better for it. A stranger who likes you throws you a
   * snack; somebody who knows you puts the thing on the ground next to you
   * and looks away, which is the one theft in this game that is consented to.
   *
   * `owner` is left null on purpose, exactly as giveSnack does: the one object
   * a person means you to have must not be the one they come and fetch back.
   */
  /**
   * IS THE LAST ONE STILL LYING THERE (O2).
   *
   * MEASURED, before this existed: five minutes beside the gondolier at tier
   * three left THREE WINE BOTTLES standing on the pavement between the two of
   * them. Every one of them is correct on its own terms — the clock had run
   * down each time — and together they are a person restocking a shelf that
   * nobody is taking anything off.
   *
   * The test is where the thing IS and not whether an event fired: picked up,
   * kicked into the canal, eaten, knocked away by the animal walking past —
   * all of them read the same and all of them mean the same, which is that
   * the gift has been dealt with. A prop that has been hidden (eaten, or down
   * a vent) is parked at y -900, so the height test catches that for free.
   */
  function npcPalGiftOut(rec) {
    const p = npcPalGiftP;
    if (!p || !p.body) return false;
    if (p.held) return true;                       // in the mouth counts as still theirs
    const b = p.body.position;
    if (b.y < -100) { npcPalGiftP = null; return false; }   // hidden or destroyed
    const dx = b.x - rec.x, dz = b.z - rec.z;
    if (dx * dx + dz * dz > npcPAL_GIFT_KEEP * npcPAL_GIFT_KEEP) { npcPalGiftP = null; return false; }
    return true;
  }
  function npcPalGive(rec) {
    const row = npcPAL[npcPalFor];
    if (!row || !row.gift || !game.physics || typeof game.physics.spawnProp !== 'function') return null;
    const yaw = rec.yaw || rec.face || 0;
    const gx = rec.x + Math.sin(yaw) * npcPAL_GIFT_D + Math.cos(yaw) * 0.35;
    const gz = rec.z + Math.cos(yaw) * npcPAL_GIFT_D - Math.sin(yaw) * 0.35;
    let p = null;
    try { p = game.physics.spawnProp(row.gift, gx, gz, rec.y); } catch (e) { p = null; }
    if (!p) return null;
    p.owner = null;
    p.disturbed = true;
    npcPalGiftP = p;
    npcPalGiven++;
    emit('npc:gift', rec);
    try { game.events.emit('pal:gift', { biome: npcPalFor, kind: row.gift }); }
    catch (e) { /* the bus is optional */ }
    sfx('rustle', rec, 0.42, 0.95);
    rec.gest = Math.max(rec.gest || 0, 1.1);
    if (row.giftSay && (rec.talkCd || 0) <= 0) {
      rec.talkCd = rand(8, 16);
      rec.lookX = rec.x; rec.lookZ = rec.z;
      rec.cd = Math.max(rec.cd || 0, 4.0);
      try { rec.anchor.speak(row.giftSay); } catch (e) { /* optional */ }
    }
    return p;
  }
  /** Who a chapter's regular is, for the paper. Never their tier: that is a
   *  fact about the journey and it lives on the file, in systems.js. */
  function npcPalWho(name) {
    const row = npcPAL[name];
    return row ? { who: row.who, call: row.call, max: npcPAL_MAX } : null;
  }
  /**
   * THE HARNESS'S WINDOW, and it exists because of the `find` decision above:
   * a regular who cannot be found is a chapter with the whole item switched
   * off in it, and nothing in the game would ever say so.
   */
  function npcPalAudit() {
    const out = { found: [], missing: [], live: (game.biome && game.biome.current) || '',
                  line: npcPalLine, warm: npcPalWarm,
                  tier: npcPalTier, given: npcPalGiven,
                  giftIn: +npcPalGiftT.toFixed(1),
                  giftOut: !!(npcPalRec && npcPalGiftOut(npcPalRec)),
                  gift: (npcPAL[npcPalFor] && npcPAL[npcPalFor].gift) || null,
                  soft: npcPalRec ? npcPalSoft(npcPalRec) : 1 };
    for (const k in npcPAL) {
      let hit = null;
      for (let i = 0; i < locals.length; i++) {
        const L = locals[i];
        if (!L || L.biome !== k || L.trav || !L.lines || !L.lines.length) continue;
        const f = L.lines[0], t = typeof f === 'string' ? f : (f && f.t);
        if (t && t.indexOf(npcPAL[k].find) >= 0) { hit = L; break; }
      }
      if (hit) out.found.push({ b: k, who: npcPAL[k].who, x: +hit.x.toFixed(1),
                                z: +hit.z.toFixed(1), fam: +(hit.fam || 0).toFixed(2) });
      else out.missing.push(k);
    }
    return out;
  }
  function npcPalStep(dt) {
    if (!game.state.started) return;
    const rec = npcPalPick(dt);
    // ---- the armed line, waiting for its person -------------------------
    if (npcPalLine) {
      npcPalKeep -= dt;
      if (npcPalKeep <= 0) npcPalLine = '';
      else {
        npcPalT -= dt;
        if (npcPalT <= 0) {
          npcPalT = npcPAL_TRY;
          const p = game.capy && game.capy.position;
          // Their own mouth, and not saySomebodyNear's nearest free one: this
          // line belongs to one person, and being said by the man on the next
          // stall is worse than not being said at all.
          if (rec && p && rec.fig && rec.anchor && (rec.talkCd || 0) <= 0 && !rec.own &&
              (rec.x - p.x) * (rec.x - p.x) + (rec.z - p.z) * (rec.z - p.z) < npcPAL_R * npcPAL_R) {
            rec.talkCd = rand(10, 22);
            rec.lookX = p.x; rec.lookZ = p.z;
            rec.cd = Math.max(rec.cd || 0, 4.5);   // and they do not talk over themselves
            try { rec.anchor.speak(npcPalLine); } catch (e) { /* the bubble is optional */ }
            npcPalLine = '';
          }
        }
      }
    }
    // ---- ...and from the third tier they put something out (O2) ----------
    // On a clock rather than on an event, and deliberately not on arrival: the
    // thing is put out while you are standing there, which is the only way a
    // player sees it happen rather than finding it. They will not do it to an
    // empty street (npcPAL_GIFT_R) and they will not do it twice in a minute.
    if (npcPalGiftT > 0) npcPalGiftT -= dt;
    if (rec && npcPalTier >= npcPAL_GIFT_T && npcPalGiftT <= 0 && rec.fig &&
        !npcPalGiftOut(rec) &&
        !rec.own && rec.sat <= 0 && (rec.wary || 0) < npcWARY_HEAT) {
      const cp = game.capy && game.capy.position;
      if (cp && (rec.x - cp.x) * (rec.x - cp.x) + (rec.z - cp.z) * (rec.z - cp.z)
                < npcPAL_GIFT_R * npcPAL_GIFT_R) {
        npcPalGiftT = npcPAL_GIFT_CD * rand(0.9, 1.25);
        npcPalGive(rec);
      }
    }
    // ---- and the warming, which is what earns the tier -------------------
    // ONE REPORT PER VISIT, and it is a report and not a decision: systems.js
    // holds the number, knows whether the tier is already five, and may say
    // no. The flag is cleared by `biome:enter` and by nothing else.
    if (npcPalWarm || !rec) return;
    if ((rec.fam || 0) > npcFAM_HEAT && (rec.wary || 0) <= npcWARY_HEAT) {
      npcPalWarm = true;
      try { game.events.emit('pal:warm', { biome: npcPalFor, who: npcPAL[npcPalFor].who }); }
      catch (e) { /* the bus is optional */ }
    }
  }

  /**
   * HOW MANY PEOPLE ARE NEAR THIS POINT, IN THIS CHAPTER (B5).
   *
   * systems.js has had a `findPeople` since the finds were written, and it
   * walks `game.npcs` WITHOUT a chapter test while filtering `game.locals`
   * with one. `game.npcs` is Sydney's cast, it is built at boot whether or not
   * the player ever goes there, and it stays in the array for the session at
   * its Sydney coordinates — which nearly every chapter's spawn is a few tens
   * of metres from, because nearly every spawn is near the origin.
   *
   * MEASURED, in the Drift, which the incident chain's own comment calls "a
   * chapter with nobody in it": **twenty-seven of Sydney's thirty-eight are
   * within fifty-five metres of the spawn**, on a run that went straight there
   * from the title card and never visited Sydney at all.
   *
   * Two things read that number and both were wrong about a place because of
   * it. The incident chain's witness gate could arm off people who are not in
   * this world; and `quiet-corner` — a find whose comment says it must be "a
   * real corner of a populated place and not a free tick in the Drift" —
   * requires nobody within 55 m, which those ghosts make almost unsatisfiable
   * anywhere near the origin.
   *
   * The cast mapping is `npcHeat`'s, exactly: only two chapters have a
   * steering cast and everybody else's people are locals.
   */
  function peopleNear(x, z, r) {
    const live = game.biome && game.biome.current;
    const r2 = r * r;
    let n = 0;
    const cast = live === 'sydney' ? humans : live === 'pasto' ? paHumans : null;
    if (cast) {
      for (let i = 0; i < cast.length; i++) {
        const h = cast[i];
        if (!h || !h.group) continue;
        const dx = h.group.position.x - x, dz = h.group.position.z - z;
        if (dx * dx + dz * dz < r2) n++;
      }
    }
    for (let i = 0; i < locals.length; i++) {
      const L = locals[i];
      if (!L || L.biome !== live) continue;
      const dx = L.x - x, dz = L.z - z;
      if (dx * dx + dz * dz < r2) n++;
    }
    return n;
  }

  return { update, humans, ibises, pastoCast: paCast, pastoHumans: paHumans, pastoBeasts: paBeasts,
           peopleNear: peopleNear,
           addLocal: addLocal, addTraveller: addTraveller,
           addExchange: addExchange, say: sayAt, sayNear: saySomebodyNear, heat: npcHeat,
           // ---- THE RUMOUR FROM THE LAST PLACE (B15) ----
           // `heardArm` is the whole interface and systems.js is its only
           // caller — it owns the counters that decide whether there is
           // anything to say. `heardAudit` is the harness's window, for the
           // same reason charmAudit and notoAudit exist: an armed line that
           // never finds a speaker is invisible from outside.
           rumourArm: npcRumArm, rumourAudit: npcRumAudit,
           keepAudit: npcKeepAudit,
           notoSet: npcNotoSet, notoAudit: npcNotoAudit, marchAudit: npcMarchAudit,
           // ---- THE REGULARS (O1) ----
           // Same split as the rumour above it, and for the same reason:
           // systems.js owns the tier because the tier is on the save file,
           // and this module owns who the person is, what they say and how
           // long a line waits for them.
           palArm: npcPalArm, palWho: npcPalWho, palAudit: npcPalAudit,
           // ...and O2: the tier, which is the only thing this module is told.
           palSet: npcPalSet,
           // ---- THE PLACE, rather than the person (v33) ----
           // `placeHeat` is what the music and the finds read; `forceHeat` is
           // the differential lever and is a test hook, not a feature.
           placeHeat: npcHeatAt,
           forceHeat: function (v) { npcHeatForce = (typeof v === 'number') ? v : -1; },
           /**
            * SEND THE OWNER AFTER IT, NOW. A TEST HOOK, and never a verb — the
            * same rule and the same wording as forceHeat above.
            *
            * The retrieval errand can only be started by the player taking
            * somebody's thing, which is minutes of driving to reach and is not
            * reliably reproducible; and it now PINS the prop to the walker
            * (F4), which is the class of change that fails silently and
            * permanently. A probe that set `rec.own` by hand would be skipping
            * `localOwnStart`'s bookkeeping and grading its own homework, so it
            * goes through the real entry point and returns what that returned.
            */
           forceErrand: function (prop) {
             const rec = prop ? localOwnerOf(prop) : null;
             if (!rec) return false;
             rec.ownCool = 0;
             return localOwnStart(rec, prop, null);
           },
           /**
            * B11 (item 5d): MAKE THE PEOPLE NEAR HERE JUMP.
            *
            * `localsReact` has never been published and could not be — it only
            * knows `locals`, and Sydney's people are `humans`. `castReact` is
            * the one that asks both, and this is the first caller from outside
            * npc.js: systems.js owns the herd registry, sixteen chapters
            * register animals into it, and the animals themselves live in
            * sixteen different files. One hook, called from the one loop that
            * already walks every animal in the game.
            */
           startlePeople: function (x, z, s, r) {
             if (typeof x !== 'number' || x !== x) return;
             castReact('startled', x, z, s === undefined ? 0.5 : s, r);
           },
           /**
            * B13: WHAT THE EXCHANGE PAIRS ARE DOING, and how many of them
            * have been handed an accusation. An exchange is two people
            * talking to each other with the player eavesdropping from six to
            * twenty-six metres away, so from outside there is no way to tell
            * a pair that never fired from a pair the player never stood near
            * — and blame is a rewrite of something that already only happens
            * sometimes, which is two coats of invisibility.
            */
           exAudit: function (reset) {
             const live = game.biome && game.biome.current;
             const rows = [];
             for (let i = 0; i < npcEX.length; i++) {
               const X = npcEX[i];
               if (X.biome !== live) continue;
               // WHICH GATE REFUSED. npcExStep has four of them — the
               // pair's own clock, both mouths, and a distance window with a
               // FLOOR as well as a ceiling — and "the accusation was armed
               // and never said" is the same sentence for all four. The first
               // cut reported only `armed` and `said`, and a fix aimed at the
               // wrong gate measured as no change at all.
               const cp2 = game.capy && game.capy.position;
               const da = cp2 ? Math.hypot(cp2.x - X.a.x, cp2.z - X.a.z) : -1;
               const db = cp2 ? Math.hypot(cp2.x - X.b.x, cp2.z - X.b.z) : -1;
               rows.push({ armed: !!X.blame, said: X.blameN || 0,
                           dropped: X.blameDrop || 0,
                           t: +(X.t || 0).toFixed(1), step: X.step,
                           near: +Math.min(da, db).toFixed(1),
                           inWindow: Math.min(da, db) >= npcEX_MIN &&
                                     Math.min(da, db) <= npcEX_MAX,
                           aCd: +(X.a.cd || 0).toFixed(1), bCd: +(X.b.cd || 0).toFixed(1),
                           ax: +X.a.x.toFixed(1), az: +X.a.z.toFixed(1) });
               if (reset) { X.blameN = 0; X.blameDrop = 0; }
             }
             const r = { biome: live, pairs: rows.length, total: npcBlameN,
                         cool: +npcBlameCool.toFixed(1), rows: rows };
             if (reset) npcBlameN = 0;
             return r;
           },
           /** A test hook, never a verb — the same rule as forceHeat. */
           forceBlame: function (x, z) { return localBlameArm(x, z); },
           heatSites: npcHeatSites,
           // The register itself, for the audit that walks the capybara up to
           // every person in the game and checks somebody answers. Twenty-six
           // of them across twelve chapters is exactly the sort of list that
           // goes stale the moment a chapter moves a stall four metres.
           locals: locals,
           // ---- THE FACES (v54) ----
           // What a face is doing, read off the NODES rather than off the
           // state that was supposed to drive them. A mood that damps
           // correctly and a brow that never moves is the exact failure this
           // is here to catch, and it is invisible from a state dump.
           faceAudit: npcFaceAudit,
           // ---- WHICH POOL A PERSON IS DRAWING FROM (P6) ----
           // Returns the LAYER as well as the lines. Asserting that a
           // Venetian says something Venetian is not the same as asserting
           // that npcSay reached the chapter row rather than the neutral one
           // that happens to be in front of it, and only the layer says so.
           // ---- THROUGH THE RESOLVER, NOT BESIDE IT (F2) ------------------
           // This reimplemented npcSay's lookup, which is fine right up until
           // the lookup changes — F2 made `wary` and `incident` a MERGE and
           // this audit would have gone on reporting the old three-line pool
           // with total confidence. It calls the same function the game calls
           // now, so the two cannot disagree about anything ever again.
           sayAudit: function (kind, biome) {
             const live = biome || (game.biome && game.biome.current);
             const row = npcPLACE_SAY[live];
             const here = row && row[kind];
             const arr = npcSayFor(live, kind);
             const merged = !!(here && here.length && arr && arr.length > here.length);
             return { biome: live,
                      layer: merged ? 'place+neutral'
                           : (here && here.length) ? 'place' : 'neutral',
                      n: arr ? arr.length : 0, first: arr && arr.length ? arr[0] : null };
           },
           // ---- IS THE WORLD ANSWERING? (D3) ----
           // The reaction layer's three second-order effects are all springs
           // and timers on records nothing else reads, so from outside a
           // chapter where the chain is dead and one where nobody happened to
           // be near look identical. This is one read of the live chapter:
           // how many people are mid-flinch, how many are holding a look at
           // somebody else, and the two counters the cast chain keeps.
           //
           // `looking` is the whole point. It counts SECOND-ORDER attention —
           // a local whose `chatT` is running is one who turned because
           // somebody else reacted, which is the thing a still cannot show and
           // a state dump does not name.
           /**
            * WHO IN THIS CHAPTER HAS A JOB AND WHETHER THEY ARE DOING IT.
            *
            * A beat is a slow, jittered clock and the action is under a second
            * long, so at any given instant almost nobody is mid-swing — which
            * means a screenshot cannot tell "nobody has a beat" from "nobody
            * happens to be swinging". `swings` is the count since the last
            * reset and is the only honest answer. Nothing in src reads it.
            * See qa/d7-beat.js.
            */
           beatAudit: function (reset) {
             const live = game.biome && game.biome.current;
             const rows = [];
             let running = 0;
             for (let i = 0; i < locals.length; i++) {
               const r = locals[i];
               if (r.biome !== live || !r.beat) continue;
               if (r.beatP >= 0) running++;
               if (reset) { r.beatN = 0; r.toolFail = 0; }
               rows.push({ kind: r.beat.kind, sfx: r.beat.sfx || '',
                           every: r.beat.every || 5,
                           x: +r.x.toFixed(1), z: +r.z.toFixed(1),
                           p: +r.beatP.toFixed(2), swings: r.beatN || 0,
                           t: +(r.beatT || 0).toFixed(1), busy: !!r.beatBz,
                           calm: +(r.beatCalm || 0).toFixed(2), why: r.beatWhy || '',
                           // ---- B12: THE TOOL ----
                           // Four columns rather than one flag, because the
                           // four failures are different: a beat that names no
                           // tool, one whose tool was never spawned, one whose
                           // tool is sitting exactly where it lives, and one
                           // that has been robbed. A single boolean cannot
                           // tell the second from the third, and the second is
                           // the one that ships silently.
                           tool: (r.beat && r.beat.tool) || '',
                           toolMade: !!r.tool, toolOut: !!r.toolOut,
                           toolFail: r.toolFail || 0,
                           toolAt: r.tool && r.tool.body
                             ? +Math.hypot(r.tool.body.position.x - r.ax,
                                           r.tool.body.position.z - r.az).toFixed(2)
                             : null });
             }
             return { biome: live, withJob: rows.length, running: running, rows: rows };
           },
           /**
            * IS THE CROWD GESTURING WHEN IT SPEAKS (D8)?
            *
            * `gest` is written in sayBubble and read in animHuman, and neither
            * is reachable from outside — so a crowd whose arms never move and a
            * crowd nobody happens to be speaking in are the same screenshot.
            * `talking` is how many people in the live chapter have a bubble
            * clock running; `armMax` is the largest deviation of a right arm
            * from where the pose alone would have put it. Nothing in src reads
            * this. See qa/d8-body.js.
            */
           gestAudit: function () {
             const live = game.biome && game.biome.current;
             const cast = live === 'sydney' ? humans : live === 'pasto' ? paHumans : null;
             let talking = 0, armMax = 0, n = 0, at = null;
             if (cast) for (let i = 0; i < cast.length; i++) {
               const r = cast[i];
               n++;
               if ((r.gest || 0) > 0) {
                 talking++;
                 const a = Math.abs((r.nodes && r.nodes.armR ? r.nodes.armR.rotation.x : 0)
                                    - (r.poseArmR || 0));
                 if (a > armMax) {
                   armMax = a;
                   // ...and WHERE, because a gesture is 0.6 s long and a probe
                   // that has to find the one person doing it by walking the
                   // square will not get there in time.
                   const p = r.group ? r.group.position : null;
                   at = p ? { x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2),
                              gest: +r.gest.toFixed(2) } : null;
                 }
               }
             }
             return { biome: live, cast: n, talking: talking, armMax: +armMax.toFixed(3), at: at };
           },
           reactAudit: function () {
             const live = game.biome && game.biome.current;
             let n = 0, flinch = 0, looking = 0, wary = 0;
             for (let i = 0; i < locals.length; i++) {
               const r = locals[i];
               if (r.biome !== live) continue;
               n++;
               if (Math.abs(r.fl) > 0.02) flinch++;
               if ((r.chatT || 0) > 0) looking++;
               if ((r.wary || 0) > 0.02) wary++;
             }
             const cast = live === 'sydney' ? humans : live === 'pasto' ? paHumans : null;
             let castLook = 0;
             if (cast) for (let i = 0; i < cast.length; i++) {
               if ((cast[i].witT || 0) > 0) castLook++;
             }
             const st = game.state || {};
             return { biome: live, locals: n, flinching: flinch, looking: looking,
                      wary: wary, castWitnessing: castLook,
                      chainArmed: !!locChainFrom, witCalls: st.witCalls || 0,
                      witLast: st.witLast || 0, witSpoke: st.witSpoke || 0 };
           },
           // ...and who is mid-sentence, for the gaze. See sayBubble.
           speaker: npcSpeaker };
}
