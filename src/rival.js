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
// ===========================================================================
import * as THREE from 'three';
import { PALETTE, matRound, clamp, rand, lerp } from './shared.js';

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

export function createRival(game) {
  const root = new THREE.Group();
  root.name = 'rivalIbis';
  root.visible = false;
  const white = matRound(PALETTE.ibis), dark = matRound(PALETTE.ibisHead), fruit = matRound(PALETTE.yuzu);
  const mk = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; root.add(o); return o; };
  // the body, facing +Z: an ibis is a white football on two sticks with a
  // black head and a beak like a sickle
  const body = mk(new THREE.SphereGeometry(1, 10, 8), white, 0, 0.52, 0);
  body.scale.set(0.17, 0.15, 0.26);
  const tail = mk(new THREE.ConeGeometry(0.09, 0.2, 6), dark, 0, 0.55, -0.3);
  tail.rotation.x = -Math.PI / 2 - 0.3;
  const neck = mk(new THREE.CylinderGeometry(0.03, 0.045, 0.34, 6), dark, 0, 0.78, 0.18);
  neck.rotation.x = 0.35;
  const head = mk(new THREE.SphereGeometry(0.065, 8, 6), dark, 0, 0.94, 0.26);
  const beak = new THREE.Group(); beak.position.set(0, 0.93, 0.31); root.add(beak);
  const b1 = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.022, 0.16, 5), dark); b1.rotation.x = Math.PI / 2 + 0.25; b1.position.set(0, -0.01, 0.07); b1.castShadow = true; beak.add(b1);
  const b2 = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.012, 0.12, 5), dark); b2.rotation.x = Math.PI / 2 + 0.75; b2.position.set(0, -0.05, 0.17); b2.castShadow = true; beak.add(b2);
  const carry = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), fruit); carry.position.set(0, -0.08, 0.2); carry.visible = false; beak.add(carry);
  const legGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.42, 4); legGeo.translate(0, -0.21, 0);
  const legL = mk(legGeo, dark, -0.06, 0.42, 0), legR = mk(legGeo, dark, 0.06, 0.42, 0);
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

  const say = (text) => { if (typeof game.toast === 'function') game.toast(text); };
  const honk = (v, pch) => { if (typeof game.sfx === 'function') game.sfx('gull', { volume: v, pitch: pch, at: root.position }); };
  const gy = (x, z) => (typeof game.groundY === 'function' ? game.groundY(x, z) : 0);

  function hide(nextWait) {
    state = 'off'; t = 0; root.visible = false; carry.visible = false; target = null; worth = 0;
    waitT = nextWait;
  }
  function drop(reason) {
    // where it is, on the ground, one more than it took
    const x = root.position.x, z = root.position.z;
    if (worth > 0 && typeof game.dropGive === 'function') game.dropGive(x, z, worth + 1);
    carry.visible = false;
    honk(0.55, 0.8);
    say(reason + '  ·  it dropped your yuzu, and one of its own');
    if (typeof game.confetti === 'function') game.confetti(x, root.position.y + 0.6, z, 6);
    try { game.events.emit('rival:dropped', { x: x, z: z, how: reason }); } catch (e) { /* bus optional */ }
    worth = 0;
    state = 'out'; t = 0;
  }

  game.events.on('capy:wheek', function (e) {
    if ((state !== 'flee' && state !== 'fly' && state !== 'gloat') || worth <= 0) return;
    const p = (e && e.position) || (game.capy && game.capy.position);
    if (!p) return;
    const d = Math.hypot(p.x - root.position.x, p.z - root.position.z);
    if (d < rivWHEEK_R) drop('the ibis jumped');
  });

  function pose(dt, flying) {
    flap += dt * (flying ? 16 : 0);
    const f = flying ? Math.sin(flap) * 0.9 : -1.35;
    wingL.rotation.z = -f; wingR.rotation.z = f;
    gait += dt * (flying ? 0 : 14);
    const g = flying ? 0.9 : Math.sin(gait) * 0.6;
    legL.rotation.x = flying ? 0.9 : g; legR.rotation.x = flying ? 0.9 : -g;
    neck.rotation.x = 0.35 + (flying ? 0.4 : Math.abs(Math.sin(gait * 0.5)) * 0.25);
  }

  function update(dt) {
    if (!(dt > 0)) return;
    const live = game.biome && game.biome.current;
    if (live !== biome) { biome = live || ''; hide(rand(rivFIRST[0], rivFIRST[1])); return; }
    const cp = game.capy && game.capy.position;
    const ok = !game.state.noRival && typeof game.rivalOK === 'function' && game.rivalOK() && !!cp;
    if (state === 'off') {
      if (!ok) return;
      waitT -= dt;
      if (waitT > 0) return;
      const d = typeof game.dropNearest === 'function' ? game.dropNearest(cp.x, cp.z, rivSEEK_R) : null;
      if (!d || Math.hypot(d.x - cp.x, d.z - cp.z) < rivSEEK_MIN) { waitT = 6; return; }
      // in from behind the fruit, as seen from the animal, nine metres up
      target = d;
      dir.set(d.x - cp.x, 0, d.z - cp.z).normalize();
      from.set(d.x + dir.x * 16, gy(d.x, d.z) + 9, d.z + dir.z * 16);
      root.position.copy(from); root.visible = true; state = 'in'; t = 0;
      honk(0.5, 0.75);
      if (!lastSeen) say('the ibis from the Gardens. it has seen your yuzu.');
      lastSeen = 1;
      return;
    }
    if (!ok && state !== 'out') { hide(rand(rivGAP[0], rivGAP[1])); return; }
    t += dt;
    if (state === 'in') {
      const k = Math.min(1, t / 2.2), e = 1 - (1 - k) * (1 - k);
      const ty = gy(target.x, target.z);
      pos.set(lerp(from.x, target.x, e), lerp(from.y, ty, e) + Math.sin(k * Math.PI) * 1.5, lerp(from.z, target.z, e));
      yaw = Math.atan2(target.x - from.x, target.z - from.z);
      root.position.copy(pos); root.rotation.set(0, yaw, 0);
      pose(dt, true);
      if (k >= 1) {
        worth = typeof game.dropSteal === 'function' ? game.dropSteal(target.prop) : 0;
        if (!worth) { state = 'out'; t = 0; return; }   // you got there first
        carry.visible = true; state = 'gloat'; t = 0;
        honk(0.6, 0.72);
        say('the ibis has your yuzu. catch it, or wheek at it.');
        try { game.events.emit('rival:stole', { x: target.x, z: target.z, worth: worth }); } catch (e) { /* optional */ }
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
        worth = 0; carry.visible = false;
        state = 'out'; t = 0;
      }
      return;
    }
    if (state === 'out') {
      // up and away, and gone after two and a half seconds
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
             at: root.visible ? [+root.position.x.toFixed(1), +root.position.y.toFixed(1), +root.position.z.toFixed(1)] : null };
  };
  /** For a probe: bring it now (the wait only; every other gate still holds). */
  game.rivalSoon = function () { if (state === 'off') waitT = 0; };

  return { update: update };
}
