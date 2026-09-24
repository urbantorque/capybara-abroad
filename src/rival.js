// ===========================================================================
// THE RIVAL (AAA A4, 24 Sep 2026) — the ibis that followed you from Sydney.
//
// The author's note, verbatim: "there lacks any villains or consequences in
// the game". The game has a whole ladder of people who come for you (npc.js,
// THE MARCH, THE AUTHORITY) and every one of them is a local doing their job.
// Nobody is AGAINST the capybara. This is the one thing that is.
//
// Sydney's bin chicken — the white ibis the Gardens are full of, the one the
// first chapter's bin task is named for — has come along. In any chapter,
// every minute and a half or so, if there is a yuzu on the ground near you it
// drops out of the sky onto it, grabs it, looks at you, and legs it. Then:
//
//   - CATCH IT. Run it down (it runs at 3.8 and flies low at 5.2, and the
//     animal sprints at 7.4), or hop at it once it is airborne and low.
//   - WHEEK AT IT. A wheek inside six metres and it drops the fruit in fright.
//     The wheek is the game's signature verb and this is the plainest use of
//     it there has ever been: it scares the bird.
//   - LET IT GO. After nine seconds or thirty metres it is gone, and so is
//     the fruit.
//
// A catch or a fright drops the fruit where the bird was, worth ONE MORE than
// it was (the bird's own, it is implied), and the wallet takes it the usual
// way when you pick it up. A loss costs exactly the fruit, which was never
// yours. Nothing else: this is a cosy game and the rival is a nuisance, not a
// threat. It does not come during a crossing, the opening, the tutorial,
// Pause, the journal, the helm or a carry (game.rivalOK), and never twice
// inside two minutes of a visit.
//
// ONE GROUP, eight small meshes on the smooth material every animal already
// compiled; nothing when it is off (visible false). Its own module because
// npc.js is the people and it is not a person: nothing here reaches into
// another module's state — it talks through game.dropNearest / dropSteal /
// dropGive / groundY / rivalOK (systems.js) and the event bus.
// Cut: noRival.
//
// ---- THE ARC (ROADMAP-TEN T3b) ---------------------------------------------
// The review: "the ibis does the same thing in Sydney as in Hanoi and never
// appears in the ending". The premise card says an ibis is coming too, and
// that was the whole of its story. Now it reads the act (game.journeyAct(),
// 1-5 on a story file, 0 in Free Roam or on a legacy file) at the start of
// every visit, and does one of five things:
//
//   ACT I     it WATCHES. A high point near the animal — the top of a bin, a
//             rise in the ground — somewhere the lens is already looking. It
//             stands there and turns its head to follow, and ten metres is
//             too close: it goes. Nothing is taken. It ignores the grace
//             (game.graceOn), because watching is not stealing.
//   ACT II    it steals, as above. Free Roam and a legacy file are always here.
//   ACT III   as II, and once per chapter it comes for the KEEPSAKE the memory
//             beat has just put down ('story:memory'). A hop away, a look
//             back, then a run the animal can win at a sprint and not at a
//             walk; it circles inside 22 m of where it took it, and whatever
//             happens — caught, wheeked, or tired at 28 s — the keepsake falls
//             where the bird is. The memory is the save's and was never here.
//   ACT IV+   in the cold and the dark (iceland, antarctic, cave) it stands
//             HUNCHED and takes nothing. Something to eat set down within two
//             metres (a carried edible, or a yuzu) and it eats, and looks at
//             the animal for a long time. That is remembered, for the session.
//   THE END   on 'finale:staged' it lands in the mouth of the horseshoe,
//             facing the animal, and sits the coda out. If it was fed, it has
//             a yuzu in its beak.
//
// An act turn ('story:act') brings the next visit within 60 s: a theft if
// there is fruit about, a watch if there is not. No save field (the act is a
// projection of the tasks; the feeding is a session's). No new mesh, no new
// draw call: the same eight meshes, posed. Cut: noRivalArc (A4's behaviour
// in every act). game.state.qaRivalAct forces an act for the harness.
// ===========================================================================
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PALETTE, CHAPTERS, matRound, clamp, rand, lerp, dampAngle, waterYAt } from './shared.js';

const rivFIRST = [75, 110];     // s into a visit before it may come at all
const rivGAP = [85, 140];       // s between visits
const rivSEEK_R = 26;           // m: a fruit this near the animal may be taken
const rivSEEK_MIN = 5;          // m: ...and not one you are standing on
const rivRUN_V = 3.8;           // m/s on the ground
const rivFLY_V = 5.2;           // m/s low flight, once it has taken off
const rivCATCH_R = 1.35;        // m, horizontal
const rivCATCH_H = 1.4;         // m, vertical, so a hop reaches it low
const rivWHEEK_R = 6.0;         // m: a wheek inside this frightens it
const rivGIVE_UP_T = 9.0;       // s of fleeing before it is gone
const rivGIVE_UP_D = 30;        // m: or this far
// ---- the arc (T3b) ----
const rivACT_SOON = [20, 50];   // s: an act turn brings the next visit this soon (the ask: 60)
const rivWATCH_FIRST = [18, 35];// s into a visit before the act-I watcher lands
const rivWATCH_RING = [12, 28]; // m from the animal: where it looks for a high point
const rivWATCH_R = 10;          // m: the animal this near and it goes
const rivWATCH_T = 55;          // s it will stand and watch at most
const rivWATCH_RISE = 7;        // m: no higher than this over the animal, or it is out of the lens
const rivPERCH_TYPES = /bin|esky|crate|barrel|cart|bollard|drum|box/;   // prop types with a lid to stand on
const rivKEEP_AFTER = 7.5;      // s after 'story:memory': the memory card (5.6 s) has had its say
const rivKEEP_HOLD = 7.5;       // s after an act card starts, if the memory turned the fold
const rivKEEP_WAIT = 40;        // s it waits for the animal to put the keepsake down
const rivKEEP_SEEK = 26;        // m: the keepsake this near the animal, or it does not come
const rivKEEP_LEASH = 22;       // m from the snatch point; past 60 % of it the run bends round
const rivKEEP_FALL = 30;        // m: the keepsake never lands further than this (the ask)
const rivKEEP_V = [2.2, 3.6, 5.2];  // m/s with the animal far (>11) / middling (>7) / near; walk is 4.2
const rivKEEP_BURST = 6.9;      // m/s for rivKEEP_BURST_T when the animal is inside 3 m; sprint is 7.4
const rivKEEP_BURST_T = 0.8;
const rivKEEP_OPEN_T = 1.4;     // s: the getaway after the snatch, low and flapping, and no catch in it
const rivKEEP_OPEN_V = 7.0;     // m/s: from under the animal's nose it opens ~10 m (measured: a 0.8 s
                                // hop at 6.6 was caught at 0.9 s by a sprint started on the snatch)
const rivKEEP_BURST_CD = 2.0;   // s before the next one: a sprinting animal closes 2.2 m/s between
                                // (measured at 4.6 / 6.6 / 2.4: a perfect chaser had it in 3.1 s)
const rivKEEP_LOOK = 2.4;       // s between looks back, when the animal is 3.5 m or more behind
const rivKEEP_LOOK_T = 0.55;    // s a look lasts: it stops, turns, bobs
const rivKEEP_T = 28;           // s, then it tires and lets it go
const rivWALL_LEN = 1.6;        // m of ray ahead of the running bird, at 0.5 m
const rivWALL_TRY = [0.5, 1.0, 1.6, 2.3];   // rad either side, tried in turn
const rivCOLD = { iceland: 1, antarctic: 1, cave: 1 };
const rivCOLD_FIRST = [20, 40]; // s into a visit before it comes to stand
const rivCOLD_RING = [6, 10];   // m from the animal
const rivCOLD_T = 90;           // s it stands there, or until the animal is 40 m off
const rivFEED_R = 2.2;          // m: food set down this near it is a gift (the ask: 2)
const rivFIN_SIDE = 0.45;       // rad off the mouth's centre line: beside the lens, not in it
// ---- AND THE SQUARE HAS OPINIONS (AAA A4) ----------------------------------
// The author asked for more humour and more randomness in what people say.
// The theft is the funniest thing that happens in front of them, so the
// nearest bystander to the bird says something about it — two times in three,
// from a pool, through game.sayNear, the same door every chapter's own
// remarks use. Nobody names a place: the bird is in all nineteen.
const rivSAY = {
  stole: ['Is that bird with you? It looks like it is with you.',
          'That bird has done this before. Look at it.',
          'Not the ibis. Anything but the ibis.',
          'It flew a very long way for one piece of fruit.',
          'Somebody should do something. Not me.',
          'The bird has a plan and the capybara does not.'],
  dropped: ['Ha. The bird blinked first.',
            'Did you see its face? It did not expect that.',
            'Serves it right, honestly.',
            'One shout and it folded. Good.'],
  escaped: ['And it is gone. They always go.',
            'Well. That was a yuzu.',
            'It will be back. It is always back.',
            'Round one to the bird.'],
  // T3b: the keepsake is not fruit, and the square can tell
  keep: ['That was not food. The bird knows it was not food.',
         'It took the little ornament. Go on, get it.',
         'The bird is looking back. It wants to be chased.',
         'Whatever that was, the capybara wants it back.'],
};
// ...and the animal's own lines, the toast channel, third person (T3b)
const rivLINE = {
  watch: 'the ibis from the Gardens. only watching, for now.',
  keep: 'the ibis has the keepsake. run it down, or wheek at it.',
  keepFell: '  ·  the keepsake fell out of its beak',
  tired: 'the ibis tired of it, and let the keepsake go.',
  cold: 'the ibis, hunched against the cold. it has not come for anything.',
  fed: 'the ibis ate it, and looked at the animal for a long time.',
};
function rivPick(a) { return a[Math.floor(Math.random() * a.length)]; }

export function createRival(game) {
  const root = new THREE.Group();
  root.name = 'rivalIbis';
  root.visible = false;
  const white = matRound(PALETTE.ibis), dark = matRound(PALETTE.ibisHead), fruit = matRound(PALETTE.yuzu);
  // T3b: two pivots so it can hunch, sit and peck — `upper` (everything above
  // the legs, hinged at the feet) and `neckG` (neck, head and beak, hinged at
  // the shoulder). The same eight meshes at the same rest positions.
  const upper = new THREE.Group(); root.add(upper);
  const neckG = new THREE.Group(); neckG.position.set(0, 0.62, 0.12); upper.add(neckG);
  const mk = (geo, m, x, y, z, par) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; (par || upper).add(o); return o; };
  // the body, facing +Z: an ibis is a white football on two sticks with a
  // black head and a beak like a sickle
  const body = mk(new THREE.SphereGeometry(1, 10, 8), white, 0, 0.52, 0);
  body.scale.set(0.17, 0.15, 0.26);
  const tail = mk(new THREE.ConeGeometry(0.09, 0.2, 6), dark, 0, 0.55, -0.3);
  tail.rotation.x = -Math.PI / 2 - 0.3;
  const neck = mk(new THREE.CylinderGeometry(0.03, 0.045, 0.34, 6), dark, 0, 0.16, 0.06, neckG);
  neck.rotation.x = 0.35;
  const head = mk(new THREE.SphereGeometry(0.065, 8, 6), dark, 0, 0.32, 0.14, neckG);
  const beak = new THREE.Group(); beak.position.set(0, 0.31, 0.19); neckG.add(beak);
  const b1 = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.022, 0.16, 5), dark); b1.rotation.x = Math.PI / 2 + 0.25; b1.position.set(0, -0.01, 0.07); b1.castShadow = true; beak.add(b1);
  const b2 = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.012, 0.12, 5), dark); b2.rotation.x = Math.PI / 2 + 0.75; b2.position.set(0, -0.05, 0.17); b2.castShadow = true; beak.add(b2);
  const carry = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), fruit); carry.position.set(0, -0.08, 0.2); carry.visible = false; beak.add(carry);
  const legGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.42, 4); legGeo.translate(0, -0.21, 0);
  const legL = mk(legGeo, dark, -0.06, 0.42, 0, root), legR = mk(legGeo, dark, 0.06, 0.42, 0, root);
  // wings: a flat white blade with a black tip, hinged at the shoulder
  const wingGeo = new THREE.BoxGeometry(0.46, 0.025, 0.2); wingGeo.translate(0.23, 0, 0);
  const wingL = mk(wingGeo, white, -0.1, 0.6, 0.02), wingR = mk(wingGeo, white, 0.1, 0.6, 0.02);
  wingL.rotation.y = Math.PI;
  // a cartoon ibis: 1.3x a real one, or at the resting boom it is a gull
  root.scale.setScalar(1.3);
  game.scene.add(root);

  let state = 'off', t = 0, waitT = rand(rivFIRST[0], rivFIRST[1]), biome = '';
  let worth = 0, target = null, flee = 0, lastSeen = 0;
  const from = new THREE.Vector3(), pos = new THREE.Vector3(), dir = new THREE.Vector3();
  let yaw = 0, flap = 0, gait = 0, vy = 0;
  // ---- the arc's state (T3b); every one of these is the session's, none saved
  let mode = 'off';             // what this visit is: yuzu | watch | keep | cold | fin (off between)
  let actSoon = false;          // an act turned: the next visit comes early, fruit or none
  let keepPend = null;          // { ch, t, wait }: a keepsake it means to come for
  const keepDone = Object.create(null);   // chapter -> it has had its go
  let keepProp = null, keepType = 0, keepFlee = 0;
  const keepFrom = new THREE.Vector3();
  let lookT = 0, lookLeft = 0, burstT = 0, burstCD = 0, hopY = 0, hopV = 0;
  let perchProp = null, perchX = 0, perchZ = 0;
  let hunchK = 0, sitK = 0, peckK = 0, hunchWant = 0;
  let feedProp = null, feedT = 0, fed = 0, eatT = -1, eatYuzu = null, fedThisVisit = false;
  let watchSaid = false, coldSaid = false, keepSaid = false;
  let finSeat = null, visits = 0, steerSide = 1;
  const v1 = new THREE.Vector3();
  const rayA = new CANNON.Vec3(), rayB = new CANNON.Vec3(), rayR = new CANNON.RaycastResult();
  /** A static collider (not the ground) within rivWALL_LEN along (mx, mz)? */
  function wallAhead(x, y, z, mx, mz) {
    const w = game.world;
    if (!w || typeof w.raycastClosest !== 'function') return false;
    rayA.set(x, y + 0.5, z); rayB.set(x + mx * rivWALL_LEN, y + 0.5, z + mz * rivWALL_LEN);
    rayR.reset();
    w.raycastClosest(rayA, rayB, { skipBackfaces: true }, rayR);
    return rayR.hasHit && !!rayR.body && rayR.body.type === CANNON.Body.STATIC && !(rayR.shape instanceof CANNON.Heightfield);
  }

  const say = (text) => { if (typeof game.toast === 'function') game.toast(text); };
  const honk = (v, pch) => { if (typeof game.sfx === 'function') game.sfx('gull', { volume: v, pitch: pch, at: root.position }); };
  const gy = (x, z) => (typeof game.groundY === 'function' ? game.groundY(x, z) : 0);
  const remark = (kind) => {
    if (Math.random() > 0.67 || typeof game.sayNear !== 'function') return;
    try { game.sayNear(root.position.x, root.position.z, 18, rivPick(rivSAY[kind])); } catch (e) { /* optional */ }
  };
  // the live chapter's own hooks, the way systems.js finds them (sysLiveBiomeApi)
  const liveApi = () => (biome === 'sydney' ? game.env : game[biome]) || null;
  const wy = (x, z) => waterYAt(liveApi(), x, z, -400);

  /** The act this visit is played in: 0 is A4's bird (free, legacy, or cut). */
  function arcAct() {
    if (game.state.noRivalArc) return 0;
    const q = game.state.qaRivalAct;
    if (typeof q === 'number') return q;
    return typeof game.journeyAct === 'function' ? (game.journeyAct() | 0) : 0;
  }
  function arcMode(act) {
    if (act === 1) return 'watch';
    if (act >= 4 && rivCOLD[biome]) return 'cold';
    return 'yuzu';
  }
  function firstWait() {
    const m = arcMode(arcAct());
    const r = m === 'watch' ? rivWATCH_FIRST : m === 'cold' ? rivCOLD_FIRST : rivFIRST;
    return rand(r[0], r[1]);
  }
  /** Watching is not stealing: the grace does not keep it away (T3b). */
  function watchOK(cp) {
    if (game.state.noRival || !game.state.started || game.state.paused || !cp) return false;
    if (typeof game.rivalOK === 'function' && game.rivalOK()) return true;
    return typeof game.graceOn === 'function' && game.graceOn();
  }

  // ---- THE KEEPSAKE IN ITS BEAK (T3b) --------------------------------------
  // npc.js's errand pin, and its rule: THE PIN COMES OFF ON EVERY PATH OUT.
  // `frozen` keeps props.js's step off it (the solver, the rescue, the gust);
  // KINEMATIC with no collision response means it cannot barge the animal or
  // be barged; not grabbable, so nothing can take it out of a beak that is
  // not a mouth props.js knows about. keepLoose hands it back through
  // physics.dropOwned — the door npc.js uses — and puts the type back.
  function keepTake(p) {
    keepProp = p; keepType = p.body.type;
    p.frozen = true; p.grabbable = false;
    p.body.type = CANNON.Body.KINEMATIC; p.body.updateMassProperties();
    p.body.collisionResponse = false; p.body.allowSleep = false;
    p.body.velocity.set(0, 0, 0); p.body.angularVelocity.set(0, 0, 0);
    p.body.wakeUp();
  }
  function keepRide() {
    const p = keepProp;
    if (!p) return;
    if (p.removed || p.held) { keepLoose(0, 0, 0); return; }
    root.updateMatrixWorld(true);
    carry.getWorldPosition(v1);
    v1.y -= 0.06;
    p.body.position.set(v1.x, v1.y, v1.z);
    p.body.quaternion.setFromEuler(0, yaw, 0);
    p.body.velocity.set(0, 0, 0); p.body.angularVelocity.set(0, 0, 0);
    if (p.body.previousPosition) p.body.previousPosition.copy(p.body.position);
    if (p.body.interpolatedPosition) p.body.interpolatedPosition.copy(p.body.position);
    p.mesh.position.copy(v1);
    p.mesh.rotation.set(0, yaw, 0);
  }
  function keepLoose(vx, vy2, vz) {
    const p = keepProp;
    keepProp = null;
    if (!p || p.removed) return;
    // the mesh from the body: a crossing may have moved the body to the new
    // spawn's fan (props.js's biome:enter) and dropOwned reads the mesh
    p.mesh.position.set(p.body.position.x, p.body.position.y, p.body.position.z);
    p.frozen = false;
    if (!p.held && game.physics && typeof game.physics.dropOwned === 'function') {
      try { game.physics.dropOwned(p, vx, vy2, vz); } catch (e) { /* the pin below still comes off */ }
    }
    if (!p.held) {
      p.body.type = (keepType && keepType !== CANNON.Body.KINEMATIC) ? keepType : CANNON.Body.DYNAMIC;
      p.body.updateMassProperties();
      p.body.collisionResponse = true;
      p.body.allowSleep = true;
      p.body.wakeUp();
    }
    p.frozen = false;
    if (p.grabbable === false && !p.planted) p.grabbable = true;
  }

  function hide(nextWait) {
    if (keepProp) keepLoose(0, 0.5, 0);
    state = 'off'; t = 0; root.visible = false; carry.visible = false; target = null; worth = 0;
    mode = 'off'; perchProp = null; feedProp = null; eatT = -1; eatYuzu = null;
    hunchK = 0; sitK = 0; peckK = 0; hunchWant = 0; root.rotation.set(0, yaw, 0);
    waitT = actSoon ? Math.min(nextWait, rand(rivACT_SOON[0], rivACT_SOON[1])) : nextWait;
  }
  function drop(reason) {
    const x = root.position.x, z = root.position.z;
    if (keepProp) {
      // the keepsake: forward and up out of the beak, and the animal's again
      keepLoose(Math.sin(yaw) * 0.8, 1.8, Math.cos(yaw) * 0.8);
      honk(0.55, 0.8);
      say(reason + rivLINE.keepFell);
      if (typeof game.confetti === 'function') game.confetti(x, root.position.y + 0.6, z, 8);
      try { game.events.emit('rival:dropped', { x: x, z: z, how: reason, keep: true }); } catch (e) { /* bus optional */ }
      remark('dropped');
      state = 'out'; t = 0;
      return;
    }
    // where it is, on the ground, one more than it took
    if (worth > 0 && typeof game.dropGive === 'function') game.dropGive(x, z, worth + 1);
    carry.visible = false;
    honk(0.55, 0.8);
    say(reason + '  ·  it dropped your yuzu, and one of its own');
    if (typeof game.confetti === 'function') game.confetti(x, root.position.y + 0.6, z, 6);
    try { game.events.emit('rival:dropped', { x: x, z: z, how: reason }); } catch (e) { /* bus optional */ }
    remark('dropped');
    worth = 0;
    state = 'out'; t = 0;
  }

  game.events.on('capy:wheek', function (e) {
    const yuzu = (state === 'flee' || state === 'fly' || state === 'gloat') && worth > 0;
    const keep = !!keepProp && state === 'krun';
    if (!yuzu && !keep) return;
    const p = (e && e.position) || (game.capy && game.capy.position);
    if (!p) return;
    const d = Math.hypot(p.x - root.position.x, p.z - root.position.z);
    if (d < rivWHEEK_R) drop('the ibis jumped');
  });
  // ---- the arc's ears (T3b) ----
  game.events.on('story:memory', function (e) {
    if (game.state.noRivalArc || !e || keepDone[e.chapter]) return;
    // the memory's own act, or the act the story is in: a memory that turns
    // III into IV is still Act III's keepsake
    if (e.act !== 3 && arcAct() !== 3) return;
    keepPend = { ch: e.chapter, t: rivKEEP_AFTER, wait: 0 };
  });
  game.events.on('story:act', function () {
    if (game.state.noRivalArc) return;
    actSoon = true;
    if (keepPend) keepPend.t = Math.max(keepPend.t, rivKEEP_HOLD);   // the act card has the frame
    if (state === 'off') waitT = Math.min(waitT, rand(rivACT_SOON[0], rivACT_SOON[1]));
  });
  game.events.on('capy:drop', function (e) {
    if (state !== 'hunch' || !e || !e.prop) return;
    const ty = game.physics && typeof game.physics.typeOf === 'function' ? game.physics.typeOf(e.prop.type) : null;
    if (ty && ty.edible) { feedProp = e.prop; feedT = 4; }
  });
  // The finale's own event (systems.js sysFinaleStage). T4a may stage later
  // than it does today; this only records the seat, and update() takes it
  // whenever the ring is up and the live world is Sydney.
  game.events.on('finale:staged', function (e) {
    if (game.state.noRivalArc || !e || typeof e.x !== 'number') return;
    const a = (typeof e.mouth === 'number' ? e.mouth : 0) + rivFIN_SIDE;
    const r = (e.r || 2.6) * 1.05;
    finSeat = { x: e.x + Math.cos(a) * r, z: e.z + Math.sin(a) * r, cx: e.x, cz: e.z };
  });

  function pose(dt, flying) {
    flap += dt * (flying ? 16 : 0);
    const f = flying ? Math.sin(flap) * 0.9 : -1.35;
    // T3b: a bird that has stopped (watching, hunched, sat, eating) folds the
    // blades back along its sides; A4's raised pair is the thief's
    const fold = !flying && (state === 'watch' || state === 'hunch' || state === 'sit');
    wingL.rotation.set(0, fold ? -Math.PI / 2 : Math.PI, fold ? 0.12 : -f);
    wingR.rotation.set(0, fold ? Math.PI / 2 : 0, fold ? -0.12 : f);
    // ...and in against the body, low: at the shoulder the football is only
    // 0.14 wide and a folded blade there read as two arms (the Iceland close-up)
    wingL.position.set(fold ? -0.03 : -0.1, fold ? 0.55 : 0.6, 0.02);
    wingR.position.set(fold ? 0.03 : 0.1, fold ? 0.55 : 0.6, 0.02);
    gait += dt * (flying ? 0 : 14);
    const g = flying ? 0.9 : Math.sin(gait) * 0.6;
    legL.rotation.x = flying ? 0.9 : g; legR.rotation.x = flying ? 0.9 : -g;
    neck.rotation.x = 0.35 + (flying ? 0.4 : Math.abs(Math.sin(gait * 0.5)) * 0.25);
    // T3b: hunched (fluffed, the head drawn in, the beak down), sat (the legs
    // folded under) and a peck (the body tips, the neck swings down)
    const h = hunchK, s = sitK, k = peckK;
    const sink = 0.1 * h + 0.2 * s;
    upper.position.y = -sink;
    upper.rotation.x = 0.35 * k;
    legL.position.y = legR.position.y = 0.42 - sink;
    legL.scale.y = legR.scale.y = Math.max(0.3, (0.42 - sink) / 0.42);
    body.scale.set(0.17 + 0.03 * h, 0.15 + 0.04 * h, 0.26);
    neckG.position.set(0, 0.62 - 0.15 * h, 0.12 - 0.07 * h);
    neckG.rotation.x = 1.3 * k;
    neck.scale.y = 1 - 0.5 * h;
    beak.rotation.x = 0.45 * h;
    if (h > 0.5 && !flying) {
      // a shiver: short bursts, not a hum
      const sh = Math.sin(game.state.time * 1.7) > 0.6 ? Math.sin(game.state.time * 43) * 0.035 * h : 0;
      root.rotation.z = sh;
    } else root.rotation.z = 0;
  }

  // ---- A PLACE TO STAND (T3b) ----------------------------------------------
  // The watcher wants a HIGH point the lens can see; the cold bird wants
  // level ground a few metres off. Both from what the chapter already
  // publishes: its terrain (groundY) and its furniture (game.props, the heavy
  // ones — a bin lid, an esky — never a hat). Scored, not searched: a ring of
  // points, the camera's forward half first, water refused. One pass per
  // visit, ~50 groundY calls.
  function findStand(cp, high) {
    const ring = high ? rivWATCH_RING : rivCOLD_RING;
    const mid = (ring[0] + ring[1]) * 0.5;
    const base = gy(cp.x, cp.z);
    let fx = 0, fz = 0;
    if (game.camera) { game.camera.getWorldDirection(v1); const l = Math.hypot(v1.x, v1.z) || 1; fx = v1.x / l; fz = v1.z / l; }
    let best = null, bs = -1e9;
    const consider = (x, z, top, prop) => {
      const dx = x - cp.x, dz = z - cp.z, d = Math.hypot(dx, dz);
      if (d < ring[0] || d > ring[1]) return;
      if (wy(x, z) > top - 0.05) return;           // not on the water
      const rise = top - base;
      if (rise > rivWATCH_RISE || rise < -3) return;
      // in the lens: the resting frame is ~80 degrees across, so the middle
      // of it scores and the edge barely does
      const ahead = (dx * fx + dz * fz) / (d || 1);
      const view = ahead > 0.85 ? 4 : ahead > 0.6 ? 1.5 : 0;
      const s = (high ? rise * 0.8 : -Math.abs(rise) * 1.5) + view - Math.abs(d - mid) * 0.1 + Math.random() * 0.3;
      if (s > bs) { bs = s; best = { x: x, z: z, top: top, prop: prop || null }; }
    };
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * Math.PI * 2;
      for (let j = 0; j < 3; j++) {
        const r = lerp(ring[0] + 0.5, ring[1] - 0.5, j / 2);
        const x = cp.x + Math.sin(a) * r, z = cp.z + Math.cos(a) * r;
        consider(x, z, gy(x, z));
      }
    }
    const arr = high ? game.props : null;
    const typeOf = game.physics && game.physics.typeOf;
    if (arr && typeOf) {
      for (let i = 0; i < arr.length; i++) {
        const p = arr[i];
        if (p.removed || p.held || p.owner || p.keep || !p.body || (p.biome && p.biome !== biome)) continue;
        const ty = typeOf(p.type);
        // heavy and flat-topped, by name: a sign's box is taller than its board
        // (the bird stood 0.2 m over the Opera House sign) and a deckchair is a
        // slope that the tourists move (it left, 'knocked', in two seconds)
        if (!ty || !(ty.mass >= 2) || !(ty.hy > 0.2) || !rivPERCH_TYPES.test(p.type)) continue;
        consider(p.body.position.x, p.body.position.z, p.body.position.y + ty.hy, p);
      }
    }
    return best;
  }
  /** In from beyond the point, as seen from the animal, nine metres up. */
  function flyIn(tx, tz, ty, cp, m) {
    target = { x: tx, z: tz, top: ty };
    dir.set(tx - cp.x, 0, tz - cp.z);
    if (dir.lengthSq() < 1e-4) dir.set(0, 0, 1);
    dir.normalize();
    from.set(tx + dir.x * 16, ty + 9, tz + dir.z * 16);
    root.position.copy(from); root.visible = true; state = 'in'; t = 0; mode = m;
    actSoon = false; visits++;
    honk(0.5, 0.75);
  }
  function startStand(cp, m) {
    const s = findStand(cp, m === 'watch');
    if (!s) { waitT = 6; return; }
    perchProp = s.prop; perchX = s.prop ? s.prop.body.position.x : 0; perchZ = s.prop ? s.prop.body.position.z : 0;
    fedThisVisit = false;
    flyIn(s.x, s.z, s.top, cp, m);
  }
  /** Act III: is the keepsake down, near, and loose? Then come for it. */
  function keepTry(dt, cp) {
    keepPend.t -= dt;
    if (keepPend.t > 0) return true;
    keepPend.wait += dt;
    const def = CHAPTERS.find(function (c) { return c.n === keepPend.ch; });
    const ph = game.physics;
    const p = def && ph && typeof ph.keepOut === 'function' ? ph.keepOut(def.biome) : null;
    if (keepPend.wait > rivKEEP_WAIT || (!p && keepPend.wait > 6)) { keepPend = null; return false; }
    if (!p || p.held || p.removed || p.owner || p.frozen || !p.body) return true;
    const b = p.body.position;
    if (Math.hypot(b.x - cp.x, b.z - cp.z) > rivKEEP_SEEK) return true;
    keepDone[keepPend.ch] = true; keepPend = null;
    flyIn(b.x, b.z, gy(b.x, b.z), cp, 'keep');
    target.prop = p;
    if (!keepSaid && typeof game.frameShot === 'function') {
      // the first one, the lens turns so the bird comes in beyond the animal
      try { game.frameShot({ yaw: Math.atan2(cp.x - b.x, cp.z - b.z), hold: 2.4 }); } catch (e) { /* optional */ }
    }
    return true;
  }

  function update(dt) {
    if (!(dt > 0)) return;
    const live = game.biome && game.biome.current;
    if (live !== biome) { biome = live || ''; visits = 0; hide(firstWait()); return; }
    const cp = game.capy && game.capy.position;
    const ok = !game.state.noRival && typeof game.rivalOK === 'function' && game.rivalOK() && !!cp;
    // ---- the end (T3b): the ring is up, so it comes and sits
    const finOn = !!finSeat && !game.state.noRival && !game.state.noRivalArc && biome === 'sydney' && !!game.state.finaleOn;
    if (finSeat && !finOn && (biome !== 'sydney' || !game.state.finaleOn)) finSeat = null;
    if (finOn && mode !== 'fin' && cp) {
      if (keepProp) keepLoose(0, 0.5, 0);
      worth = 0; carry.visible = false; hunchK = 0; peckK = 0;
      flyIn(finSeat.x, finSeat.z, gy(finSeat.x, finSeat.z), cp, 'fin');
      return;
    }
    if (mode === 'fin' && !finOn && state !== 'off') { mode = 'yuzu'; state = 'out'; t = 0; }
    if (state === 'off') {
      if (!cp) return;
      if (keepPend && ok && keepTry(dt, cp)) return;
      const m = arcMode(arcAct());
      if (!(m === 'watch' ? watchOK(cp) : ok)) return;
      // the act can change under a wait (a story file starts in Sydney with
      // no biome:enter, and read 0 until it had begun): the first visit of a
      // chapter keeps its own clock
      if (!visits && m !== 'yuzu') {
        const r = m === 'watch' ? rivWATCH_FIRST : rivCOLD_FIRST;
        if (waitT > r[1]) waitT = rand(r[0], r[1]);
      }
      waitT -= dt;
      if (waitT > 0) return;
      if (m === 'watch' || m === 'cold') { startStand(cp, m); return; }
      const d = typeof game.dropNearest === 'function' ? game.dropNearest(cp.x, cp.z, rivSEEK_R) : null;
      if (!d || Math.hypot(d.x - cp.x, d.z - cp.z) < rivSEEK_MIN) {
        // an act has just turned and there is nothing to take: it shows itself anyway
        if (actSoon && !game.state.noRivalArc) { startStand(cp, 'watch'); return; }
        waitT = 6; return;
      }
      // in from behind the fruit, as seen from the animal, nine metres up
      target = d;
      dir.set(d.x - cp.x, 0, d.z - cp.z).normalize();
      from.set(d.x + dir.x * 16, gy(d.x, d.z) + 9, d.z + dir.z * 16);
      root.position.copy(from); root.visible = true; state = 'in'; t = 0; mode = 'yuzu'; actSoon = false; visits++;
      honk(0.5, 0.75);
      if (!lastSeen) {
        say('the ibis from the Gardens. it has seen your yuzu.');
        // ...and the first time, the lens turns so the bird is in the frame
        // beyond the animal: yaw is the bearing from the animal to the camera,
        // so it is the bearing AWAY from the fruit. Any input takes it back.
        if (typeof game.frameShot === 'function') {
          try { game.frameShot({ yaw: Math.atan2(cp.x - d.x, cp.z - d.z), hold: 2.6 }); } catch (e) { /* optional */ }
        }
      }
      lastSeen = 1;
      return;
    }
    const okNow = mode === 'fin' ? !game.state.noRival : mode === 'watch' ? watchOK(cp) : ok;
    if (!okNow && state !== 'out') { hide(rand(rivGAP[0], rivGAP[1])); return; }
    t += dt;
    if (state === 'in') {
      if (mode === 'keep') {
        // the keepsake may still be rolling: land where it is now
        const p = target.prop;
        if (!p || p.removed || p.held || p.frozen) { state = 'out'; t = 0; return; }
        target.x = p.body.position.x; target.z = p.body.position.z; target.top = gy(target.x, target.z);
      }
      const k = Math.min(1, t / (mode === 'yuzu' ? 2.2 : 2.6)), e = 1 - (1 - k) * (1 - k);
      const ty = mode === 'yuzu' ? gy(target.x, target.z) : target.top;
      pos.set(lerp(from.x, target.x, e), lerp(from.y, ty, e) + Math.sin(k * Math.PI) * 1.5, lerp(from.z, target.z, e));
      yaw = Math.atan2(target.x - from.x, target.z - from.z);
      root.position.copy(pos); root.rotation.set(0, yaw, 0);
      pose(dt, k < 0.92);
      if (k < 1) return;
      if (mode === 'yuzu') {
        worth = typeof game.dropSteal === 'function' ? game.dropSteal(target.prop) : 0;
        if (!worth) { state = 'out'; t = 0; return; }   // you got there first
        carry.visible = true; state = 'gloat'; t = 0;
        honk(0.6, 0.72);
        say('the ibis has your yuzu. catch it, or wheek at it.');
        try { game.events.emit('rival:stole', { x: target.x, z: target.z, worth: worth }); } catch (e) { /* optional */ }
        remark('stole');
      } else if (mode === 'keep') {
        keepTake(target.prop);
        keepFrom.copy(root.position);
        keepFlee = 0; lookT = rivKEEP_OPEN_T; lookLeft = 0;
        burstT = rivKEEP_OPEN_T; burstCD = rivKEEP_BURST_CD; hopY = 0; hopV = 4.2;
        state = 'krun'; t = 0;
        honk(0.65, 0.7);
        say(rivLINE.keep); keepSaid = true;
        try { game.events.emit('rival:stole', { x: target.x, z: target.z, worth: 0, keep: true }); } catch (e) { /* optional */ }
        remark('keep');
      } else if (mode === 'watch') { state = 'watch'; t = 0; }
      else if (mode === 'cold') { state = 'hunch'; t = 0; hunchWant = 1; }
      else if (mode === 'fin') {
        state = 'sit'; t = 0;
        carry.visible = fed > 0;           // it remembered
        try { game.events.emit('rival:seated', { x: target.x, z: target.z, fed: fed }); } catch (e) { /* optional */ }
      }
      return;
    }
    if (state === 'watch' || state === 'sit') {
      // it stands where it landed and turns its head to follow the animal
      const bx = root.position.x, bz = root.position.z;
      const d = Math.hypot(cp.x - bx, cp.z - bz);
      yaw = dampAngle(yaw, Math.atan2(cp.x - bx, cp.z - bz), 4, dt);
      root.rotation.set(0, yaw, 0);
      const top = state === 'sit' ? gy(bx, bz) : target.top;
      root.position.y = top + (Math.sin(t * 2.1) > 0.8 ? Math.abs(Math.sin(t * 9)) * 0.03 : 0);
      neckG.rotation.z = Math.sin(t * 0.9) * 0.22;
      if (state === 'sit') { sitK = Math.min(1, sitK + dt * 1.5); pose(dt, false); return; }
      pose(dt, false);
      if (!watchSaid && d < 22) { watchSaid = true; say(rivLINE.watch); }
      const knocked = perchProp && (perchProp.removed || perchProp.held ||
        Math.hypot(perchProp.body.position.x - perchX, perchProp.body.position.z - perchZ) > 0.3);
      if (d < rivWATCH_R || t > rivWATCH_T || knocked) {
        neckG.rotation.z = 0;
        yaw = Math.atan2(bx - cp.x, bz - cp.z);     // away, over its shoulder
        honk(0.4, 0.9);
        try { game.events.emit('rival:left', { how: d < rivWATCH_R ? 'near' : knocked ? 'knocked' : 'bored' }); } catch (e) { /* optional */ }
        state = 'out'; t = 0;
      }
      return;
    }
    if (state === 'hunch') {
      const bx = root.position.x, bz = root.position.z;
      const d = Math.hypot(cp.x - bx, cp.z - bz);
      hunchK = Math.min(hunchWant, hunchK + dt * 1.2) + Math.max(0, hunchK - hunchWant) * (1 - dt);
      if (!coldSaid && d < 16 && t > 1.5) { coldSaid = true; say(rivLINE.cold); }
      // something to eat within two metres: a carried edible put down, or a yuzu
      if (eatT < 0) {
        let fx = null;
        if (feedProp) {
          feedT -= dt;
          if (feedProp.removed || feedProp.held || feedT <= 0) feedProp = null;
          else if (Math.hypot(feedProp.body.position.x - bx, feedProp.body.position.z - bz) < rivFEED_R) fx = feedProp.body.position;
        }
        if (!fx && typeof game.dropNearest === 'function') {
          const y = game.dropNearest(bx, bz, rivFEED_R);
          if (y) { eatYuzu = y; fx = y; }
        }
        if (fx) { eatT = 0; target.x = fx.x; target.z = fx.z; feedProp = null; }
      }
      if (eatT >= 0) {
        // over to it, three pecks, and then the look
        eatT += dt;
        const ex = target.x - root.position.x, ez = target.z - root.position.z, ed = Math.hypot(ex, ez);
        yaw = dampAngle(yaw, Math.atan2(ex, ez), 6, dt);
        if (ed > 0.45) { root.position.x += ex / ed * 1.2 * dt; root.position.z += ez / ed * 1.2 * dt; peckK = 0; pose(dt, false); }
        else { peckK = Math.abs(Math.sin(eatT * 6)); gait = 0; pose(dt * 0.01, false); }
        root.position.y = gy(root.position.x, root.position.z);
        root.rotation.set(root.rotation.x, yaw, root.rotation.z);
        if (eatT > 3.2) {
          eatT = -1; peckK = 0;
          if (eatYuzu && typeof game.dropSteal === 'function') game.dropSteal(eatYuzu.prop);
          eatYuzu = null;
          fed++; fedThisVisit = true; hunchWant = 0.35; t = Math.max(t, rivCOLD_T - 10);
          say(rivLINE.fed);
          honk(0.3, 1.05);
          try { game.events.emit('rival:fed', { fed: fed }); } catch (e) { /* optional */ }
        }
        return;
      }
      yaw = dampAngle(yaw, Math.atan2(cp.x - bx, cp.z - bz), d < 14 ? 2 : 0.5, dt);
      root.rotation.set(0, yaw, root.rotation.z);
      root.position.y = gy(bx, bz);
      pose(dt * 0.01, false);   // stood still: the gait does not run
      if (t > rivCOLD_T || d > 40) {
        yaw = Math.atan2(bx - cp.x, bz - cp.z); hunchK = 0;
        honk(0.3, 0.8);
        state = 'out'; t = 0;
      }
      return;
    }
    if (state === 'krun') {
      // ---- the run it can lose (T3b) ----
      keepFlee += dt; lookT -= dt; burstCD -= dt; burstT -= dt;
      const bx = root.position.x, bz = root.position.z;
      dir.set(bx - cp.x, 0, bz - cp.z);
      const d = dir.length() || 1; dir.multiplyScalar(1 / d);
      const ox = bx - keepFrom.x, oz = bz - keepFrom.z, orr = Math.hypot(ox, oz);
      const g = gy(bx, bz), w = wy(bx, bz);
      if (lookLeft > 0) {
        // the look back: stopped, turned round, a bob — it wants to be chased
        lookLeft -= dt;
        yaw = dampAngle(yaw, Math.atan2(cp.x - bx, cp.z - bz), 14, dt);
        root.rotation.set(0, yaw, 0);
        root.position.y = Math.max(g, w + 0.9) + Math.abs(Math.sin(t * 9)) * 0.05;
        pose(dt, false);
      } else {
        if (lookT <= 0 && d > 3.5) { lookLeft = rivKEEP_LOOK_T; lookT = rivKEEP_LOOK + rand(-0.4, 0.6); if (Math.random() < 0.5) honk(0.35, 0.95); }
        if (d < 3 && burstCD <= 0) { burstT = rivKEEP_BURST_T; burstCD = rivKEEP_BURST_CD; hopV = 2.6; }
        const v = keepFlee < rivKEEP_OPEN_T ? rivKEEP_OPEN_V : burstT > 0 ? rivKEEP_BURST : d > 11 ? rivKEEP_V[0] : d > 7 ? rivKEEP_V[1] : rivKEEP_V[2];
        // away from the animal with a weave; past 60 % of the leash it bends
        // round the snatch point, so a clever animal can cut the corner
        const bend = Math.sin(keepFlee * 1.3) * 0.45;
        let mx = dir.x * Math.cos(bend) - dir.z * Math.sin(bend), mz = dir.x * Math.sin(bend) + dir.z * Math.cos(bend);
        const lk = clamp((orr - rivKEEP_LEASH * 0.6) / (rivKEEP_LEASH * 0.4), 0, 1.5);
        if (lk > 0 && orr > 0.01) {
          const ix = -ox / orr, iz = -oz / orr;
          let tx = -iz, tz = ix;
          if (tx * mx + tz * mz < 0) { tx = -tx; tz = -tz; }
          mx = mx * (1 - Math.min(1, lk)) + (tx * 0.8 + ix * 0.6 * lk) * Math.min(1, lk);
          mz = mz * (1 - Math.min(1, lk)) + (tz * 0.8 + iz * 0.6 * lk) * Math.min(1, lk);
          const ml = Math.hypot(mx, mz) || 1; mx /= ml; mz /= ml;
        }
        // ...and round a wall, never through one: measured in Kyoto, a bird
        // that ran by position went over the Gion fence and the animal stood
        // at it for 26 s. One ray a frame at knee height; if it hits a static
        // collider (not the ground's heightfield) the run swings to the first
        // clear bearing either side, keeping to the side it last chose.
        if (wallAhead(bx, root.position.y, bz, mx, mz)) {
          let got = false;
          for (let i = 0; i < rivWALL_TRY.length && !got; i++) {
            const a = rivWALL_TRY[i] * steerSide;
            for (let sgn = 1; sgn >= -1 && !got; sgn -= 2) {
              const ca = Math.cos(a * sgn), sa = Math.sin(a * sgn);
              const cx = mx * ca - mz * sa, cz = mx * sa + mz * ca;
              if (!wallAhead(bx, root.position.y, bz, cx, cz)) { mx = cx; mz = cz; got = true; if (sgn < 0) steerSide = -steerSide; }
            }
          }
          if (!got) hopV = Math.max(hopV, 4.2);   // boxed in: it flaps up and over
        }
        root.position.x += mx * v * dt; root.position.z += mz * v * dt;
        // the burst is a flapping hop; over water it skims
        hopV -= 9.8 * dt; hopY = Math.max(0, hopY + hopV * dt); if (hopY === 0) hopV = 0;
        const g2 = gy(root.position.x, root.position.z), w2 = wy(root.position.x, root.position.z);
        const skim = w2 > g2 - 0.05;
        root.position.y = (skim ? w2 + 0.9 : g2) + hopY;
        yaw = dampAngle(yaw, Math.atan2(mx, mz), 10, dt);
        root.rotation.set(0, yaw, 0);
        pose(dt * (v / rivRUN_V), hopY > 0.05 || skim || burstT > 0);
      }
      keepRide();
      if (!keepProp) { state = 'out'; t = 0; return; }   // the animal's mouth outranks the beak
      // caught: near enough across and up (a hop counts), after the first hop away
      const hx = cp.x - root.position.x, hz = cp.z - root.position.z;
      if (keepFlee > rivKEEP_OPEN_T && Math.hypot(hx, hz) < rivCATCH_R &&
          Math.abs(cp.y - (root.position.y + 0.4)) < rivCATCH_H) { drop('caught it'); return; }
      if (keepFlee > rivKEEP_T || orr > rivKEEP_FALL - 1) {
        keepLoose(0, 0.6, 0);
        say(rivLINE.tired);
        honk(0.45, 0.85);
        try { game.events.emit('rival:dropped', { x: root.position.x, z: root.position.z, how: 'tired', keep: true }); } catch (e) { /* optional */ }
        state = 'out'; t = 0;
      }
      return;
    }
    if (state === 'gloat') {
      // a look at you, a bob, and then it goes
      yaw = Math.atan2(cp.x - root.position.x, cp.z - root.position.z);
      root.rotation.set(0, yaw, 0);
      root.position.y = gy(root.position.x, root.position.z) + Math.abs(Math.sin(t * 9)) * 0.05;
      pose(dt, false);
      if (t > 0.7) { state = 'flee'; t = 0; flee = 0; }
      return;
    }
    if (state === 'flee' || state === 'fly') {
      flee += dt;
      // away from the animal, bending a little so it is not a straight line
      dir.set(root.position.x - cp.x, 0, root.position.z - cp.z);
      const dd = dir.length() || 1; dir.multiplyScalar(1 / dd);
      const bend = Math.sin(flee * 1.7) * 0.5;
      const bx = dir.x * Math.cos(bend) - dir.z * Math.sin(bend), bz = dir.x * Math.sin(bend) + dir.z * Math.cos(bend);
      if (state === 'flee' && (t > 1.3 || dd < 3.5)) { state = 'fly'; vy = 2.4; }
      const v = state === 'fly' ? rivFLY_V : rivRUN_V;
      root.position.x += bx * v * dt; root.position.z += bz * v * dt;
      const g = gy(root.position.x, root.position.z);
      if (state === 'fly') {
        // low: between 1.2 and 2.6 m, so a hop can still reach it
        const want = g + 1.6 + Math.sin(flee * 2.3) * 0.7;
        vy += (want - root.position.y) * 6 * dt - vy * 2.5 * dt;
        root.position.y += vy * dt;
      } else root.position.y = g;
      yaw = Math.atan2(bx, bz); root.rotation.set(state === 'fly' ? 0.15 : 0, yaw, 0);
      pose(dt, state === 'fly');
      // caught: near enough across and up (a hop counts)
      const hx = cp.x - root.position.x, hz = cp.z - root.position.z;
      if (Math.hypot(hx, hz) < rivCATCH_R && Math.abs(cp.y - (root.position.y + 0.4)) < rivCATCH_H) { drop('caught it'); return; }
      if (flee > rivGIVE_UP_T || dd > rivGIVE_UP_D) {
        say('the ibis got away with a yuzu.');
        honk(0.45, 0.85);
        try { game.events.emit('rival:escaped', { worth: worth }); } catch (e) { /* optional */ }
        remark('escaped');
        worth = 0; carry.visible = false;
        state = 'out'; t = 0;
      }
      return;
    }
    if (state === 'out') {
      // up and away, and gone after two and a half seconds
      hunchK = Math.max(0, hunchK - dt * 3); sitK = Math.max(0, sitK - dt * 3); peckK = 0;
      root.position.y += (3.5 + t * 3) * dt;
      root.position.x += Math.sin(yaw) * 4 * dt; root.position.z += Math.cos(yaw) * 4 * dt;
      root.rotation.set(0.25, yaw, 0);
      pose(dt, true);
      if (t > 2.5) hide(rand(rivGAP[0], rivGAP[1]));
    }
  }

  // The harness's window: what it is doing and when it will next come.
  game.rivalAudit = function () {
    return { state: state, t: +t.toFixed(2), wait: +waitT.toFixed(1), worth: worth, visible: root.visible,
             at: root.visible ? [+root.position.x.toFixed(1), +root.position.y.toFixed(1), +root.position.z.toFixed(1)] : null,
             // T3b: the arc
             mode: mode, act: arcAct(), arcMode: arcMode(arcAct()), keep: !!keepProp,
             keepPend: keepPend ? { ch: keepPend.ch, t: +keepPend.t.toFixed(1) } : null,
             keepFrom: keepProp || state === 'krun' ? [+keepFrom.x.toFixed(1), +keepFrom.z.toFixed(1)] : null,
             look: lookLeft > 0, hunch: +hunchK.toFixed(2), sit: +sitK.toFixed(2), fed: fed,
             perch: state === 'watch' && target ? { top: +target.top.toFixed(2), prop: perchProp ? perchProp.type : null } : null,
             seat: finSeat ? [+finSeat.x.toFixed(1), +finSeat.z.toFixed(1)] : null, yaw: +yaw.toFixed(2) };
  };
  /** For a probe: bring it now (the wait only; every other gate still holds). */
  game.rivalSoon = function () { if (state === 'off') waitT = 0; if (keepPend) keepPend.t = 0; };

  return { update: update };
}
