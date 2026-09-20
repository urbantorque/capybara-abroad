import * as THREE from 'three';
import { PALETTE, mat, EMIT_OVER } from './shared.js';

// ===========================================================================
// far.js — THE FAR PLANE (ROADMAP-WOW2 V3, 20 Sep 2026)
//
// A horizon in this game was mostly the dome. The planes-only depth sweep
// (qa/wow-depth-after.js) put the far share at 0.02–0.23 in the open
// chapters, and where a chapter did have something out there it was a
// terrain pad that the ground mesh cut off (Monaco's Tête de Chien at z 220),
// a 2.4 m strip closing the harbour (Sydney's far shore at z -126), or a
// row of towers with nothing under them (Kowloon's far shore). Nothing
// moved out there except what a chapter had built for its own reasons — the
// harbour's sails, the junk, the orca pod.
//
// Three builders, shared by every chapter, so that a far layer is one call
// and one shape of thing everywhere:
//
//   farLayer(spec)   N ridge wedges merged into ONE mesh, flat Lambert, in
//                    the chapter's own far tone, fogged by scene.fog like
//                    anything else — the fog IS the distance cue, which is
//                    why the wedge sits where the fog reads at 30–60 % and
//                    not at 300 m by reflex (a linear fog swallows a wedge
//                    past its far distance entirely; Sydney's is 90–230).
//   farMover(spec)   one small thing on a loop out there — ≤ 40 triangles,
//                    a polyline path walked at constant speed, a period of
//                    60–120 s, so it crosses the arrival frame about once a
//                    minute and is otherwise not there.
//   farLights(spec)  a sparse instanced dot mesh for the night chapters,
//                    over-white (EMIT_OVER) so the bloom pass takes them.
//
// and farBundle() to hold the three, gate them and answer the audit.
//
// THE LAWS. Every top-level name is `far`-prefixed (the bundler
// concatenates). `PALETTE` colours only: a far tone is a PALETTE colour
// lerped toward the chapter's haze, never a literal. `flatShading: true`
// through mat(). One `game.state.noFar` cuts the lot (the group hides, the
// mover stops ticking — ≤ 0.1 ms when cut); at governor rung ≥ 1 the mover
// and the lights park and the static silhouette stays, because a merged
// mesh that is drawn once costs nothing worth saving.
//
// A WEDGE IS A RIDGE, NOT A BOX. Each one is a profile — a run of (x, h)
// points across its width — with a crest line at z = 0 and two slopes down
// to a base well below the ground (`y0`, -30 m by default: the ground mesh
// ends before the wedge in most chapters and a base at 0 would float over
// the horizon colour). 4(N-1) triangles for an N-point profile; six points is
// a mountain, three is a hill, and two rows of them at different depths is
// a range. The sun lights the crest's two faces differently, which is what
// makes a flat-shaded ridge read as a ridge and not as a strip.
// ===========================================================================

const farV = new THREE.Vector3();
const farC = new THREE.Color();
const farC2 = new THREE.Color();

/**
 * A far tone from two PALETTE colours: `base` pulled `k` of the way toward
 * `haze`. Returns a hex number so mat() can cache it like any other colour.
 * The fog then does the rest per metre, so a tone here is "what it would be
 * with no air in the way" — a darker thing than it will ever be seen as.
 */
export function farTone(base, haze, k) {
  farC.set(base); farC2.set(haze);
  return farC.lerp(farC2, k === undefined ? 0.35 : k).getHex();
}

/**
 * The static silhouette. spec:
 *   wedges  [{ x, z, w, d, yaw, profile: [[t, h], ...] }]
 *             t runs -1..1 across the width, h is metres above ground at
 *             that point; the ends are pinned to the base whatever is given.
 *             `d` is the ridge's depth (crest to foot, both sides), `yaw`
 *             the ridge's bearing. Or the short form { x, z, w, h, d, yaw }
 *             for a plain three-point hill with its peak at `skew` (-1..1).
 *   color   a hex number (use farTone)
 *   y0      the base, default -30
 *   name    'far-<chapter>' — the depth instruments find the layer by this
 */
export function farLayer(spec) {
  const y0 = spec.y0 === undefined ? -30 : spec.y0;
  const pos = [], nor = [], idx = [];
  let n = 0;
  const push = (x, y, z) => { pos.push(x, y, z); nor.push(0, 1, 0); return n++; };
  for (const w of spec.wedges || []) {
    const yaw = w.yaw || 0, cy = Math.cos(yaw), sy = Math.sin(yaw);
    const hw = (w.w || 60) * 0.5, hd = (w.d || 24) * 0.5;
    let prof = w.profile;
    if (!prof) {
      const s = w.skew || 0;
      prof = [[-1, 0], [s, w.h || 20], [1, 0]];
    }
    // world position of a profile-space point (u across, v depth)
    const at = (u, v) => [w.x + u * cy + v * sy, w.z - u * sy + v * cy];
    const N = prof.length;
    const crest = [], front = [], back = [];
    for (let i = 0; i < N; i++) {
      const u = prof[i][0] * hw;
      const h = (i === 0 || i === N - 1) ? y0 : (w.y === undefined ? 0 : w.y) + prof[i][1];
      let p = at(u, 0);  crest.push(push(p[0], h, p[1]));
      p = at(u, hd);     front.push(push(p[0], y0, p[1]));
      p = at(u, -hd);    back.push(push(p[0], y0, p[1]));
    }
    for (let i = 0; i < N - 1; i++) {
      // front slope (faces +v), back slope (faces -v), wound outward
      idx.push(front[i], front[i + 1], crest[i + 1], front[i], crest[i + 1], crest[i]);
      idx.push(back[i + 1], back[i], crest[i], back[i + 1], crest[i], crest[i + 1]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  const m = new THREE.Mesh(g, mat(spec.color === undefined ? PALETTE.stoneDark : spec.color));
  m.name = spec.name || 'far-layer';
  m.castShadow = false; m.receiveShadow = false;
  m.matrixAutoUpdate = false;
  m.userData.farTris = idx.length / 3;
  return m;
}

// ---- the mover's shapes ----------------------------------------------------
// A box is twelve triangles; everything below is boxes and single quads,
// counted in the comment beside it. Local space: +z is forward.
function farBox(P, I, cx, cy, cz, sx, sy, sz) {
  const x0 = cx - sx / 2, x1 = cx + sx / 2, y0 = cy - sy / 2, y1 = cy + sy / 2, z0 = cz - sz / 2, z1 = cz + sz / 2;
  const b = P.length / 3;
  P.push(x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1);
  const F = [[0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7], [1, 5, 6, 2], [3, 2, 6, 7], [4, 5, 1, 0]];
  for (const f of F) I.push(b + f[0], b + f[1], b + f[2], b + f[0], b + f[2], b + f[3]);
}
function farQuad(P, I, a, b, c, d) {
  const s = P.length / 3;
  P.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], d[0], d[1], d[2]);
  I.push(s, s + 1, s + 2, s, s + 2, s + 3);
}
function farTri(P, I, a, b, c) {
  const s = P.length / 3;
  P.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  I.push(s, s + 1, s + 2);
}

/**
 * One thing that moves out there. spec:
 *   kind    'ferry' | 'ship' | 'plane' | 'sail' | 'train' | 'car' | 'birds'
 *   path    [[x, y, z], ...] — walked at constant speed, start to end, then
 *           (after the gap) again from the start. Put both ends past the
 *           frame's edge or in the fog and the jump is never seen.
 *   period  seconds for one pass INCLUDING the gap (60–120)
 *   duty    fraction of the period spent on the path (default 0.7)
 *   scale   metres per unit of the shape (default 1)
 *   color   hex — the body; `lit` hex — the over-white part, where the kind
 *           has one (a ferry's saloon, the car's lamps)
 *   phase   0..1 start offset, so two chapters' movers are not in step
 */
export function farMover(spec) {
  const P = [], I = [];
  const kind = spec.kind || 'ferry';
  const s = spec.scale || 1;
  let litFrom = 0;              // index where the over-white part begins
  let flap = null;              // the birds' wingtip vertex indices
  if (kind === 'ferry' || kind === 'ship') {
    farBox(P, I, 0, 1.2, 0, 6, 2.4, 28);            // hull       12
    litFrom = I.length;
    farBox(P, I, 0, 4.0, -2, 5, 2.6, 16);           // saloon     12  (lit)
  } else if (kind === 'plane') {
    farBox(P, I, 0, 0, 0, 2.2, 2.2, 22);            // fuselage   12
    farQuad(P, I, [-13, 0, 2], [13, 0, 2], [13, 0, -2], [-13, 0, -2]);   // wing  2
    farQuad(P, I, [-5, 0, -10], [5, 0, -10], [5, 0, -12], [-5, 0, -12]); // tail  2
    farQuad(P, I, [0, 0, -8], [0, 0, -12], [0, 5, -13], [0, 5, -10]);    // fin   2
  } else if (kind === 'sail') {
    farBox(P, I, 0, 0.8, 0, 3, 1.6, 10);            // hull       12
    litFrom = I.length;
    farTri(P, I, [0, 2, 3], [0, 2, -3], [0, 13, -1]); // main       1  (pale)
  } else if (kind === 'train') {
    farBox(P, I, 0, 1.6, 6, 2.8, 3.2, 12);          // three cars 36
    farBox(P, I, 0, 1.6, -7, 2.8, 3.2, 12);
    farBox(P, I, 0, 1.6, -20, 2.8, 3.2, 12);
  } else if (kind === 'car') {
    litFrom = 0;                                    // lamps only  4
    farQuad(P, I, [-1.2, 0, 0], [-0.4, 0, 0], [-0.4, 0.8, 0], [-1.2, 0.8, 0]);
    farQuad(P, I, [0.4, 0, 0], [1.2, 0, 0], [1.2, 0.8, 0], [0.4, 0.8, 0]);
  } else if (kind === 'birds') {
    // a V of seven, two triangles each: body-root to each wingtip     14
    flap = [];
    for (let i = 0; i < 7; i++) {
      const row = Math.ceil(i / 2), side = i === 0 ? 0 : (i % 2 ? -1 : 1);
      const bx = side * row * 5, bz = -row * 4.5;
      const tipL = P.length / 3 + 2;
      farTri(P, I, [bx, 0, bz + 1.2], [bx, 0, bz - 0.6], [bx - 3.2, 0.4, bz - 0.4]);
      const tipR = P.length / 3 + 2;
      farTri(P, I, [bx, 0, bz - 0.6], [bx, 0, bz + 1.2], [bx + 3.2, 0.4, bz - 0.4]);
      flap.push(tipL, tipR, i);
    }
  }
  const g = new THREE.BufferGeometry();
  const arr = new Float32Array(P.length);
  for (let i = 0; i < P.length; i++) arr[i] = P[i] * s;
  g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  g.setIndex(I);
  g.computeVertexNormals();
  const body = mat(spec.color === undefined ? PALETTE.stoneDark : spec.color, { side: THREE.DoubleSide });
  let mesh;
  if (spec.lit !== undefined && litFrom < I.length) {
    farC.set(spec.lit).multiplyScalar(EMIT_OVER);
    const lit = new THREE.MeshBasicMaterial({ color: farC.clone(), fog: false, side: THREE.DoubleSide });
    g.addGroup(0, litFrom, 0);
    g.addGroup(litFrom, I.length - litFrom, 1);
    mesh = new THREE.Mesh(g, litFrom > 0 ? [body, lit] : [lit, lit]);
  } else {
    mesh = new THREE.Mesh(g, body);
  }
  mesh.name = 'far-mover-' + kind;
  mesh.castShadow = false; mesh.receiveShadow = false;
  mesh.frustumCulled = true;
  mesh.userData.farTris = I.length / 3;

  // ---- the path, by arc length ---------------------------------------------
  const path = spec.path || [[0, 0, 0], [1, 0, 0]];
  const seg = [];
  let L = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    seg.push(l); L += l;
  }
  const period = spec.period || 90;
  const duty = spec.duty === undefined ? 0.7 : spec.duty;
  let t = (spec.phase || 0) * period;
  const posAttr = g.attributes.position;
  const baseY = flap ? Float32Array.from(flap.map(k => posAttr.getY(k))) : null;
  const handle = {
    mesh,
    period,
    /** advance by dt; place the mesh; hide it during the gap */
    update(dt) {
      t += dt;
      const u = (t % period) / period;
      if (u > duty) { if (mesh.visible) mesh.visible = false; return; }
      if (!mesh.visible) mesh.visible = true;
      let sAlong = u / duty * L;
      let i = 0;
      while (i < seg.length - 1 && sAlong > seg[i]) { sAlong -= seg[i]; i++; }
      const a = path[i], b = path[i + 1], k = seg[i] > 0 ? Math.min(1, sAlong / seg[i]) : 0;
      mesh.position.set(a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k);
      const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
      mesh.rotation.set(0, Math.atan2(dx, dz), 0);
      if (kind === 'plane') mesh.rotateX(-Math.atan2(dy, Math.hypot(dx, dz)));
      if (flap) {
        // wingtips beat about the root: ~2 Hz, each bird a little out of step
        for (let j = 0; j < flap.length; j += 3) {
          const w = Math.sin(t * 11 + flap[j + 2] * 1.7) * 2.2 * s;
          posAttr.setY(flap[j], baseY[j] + w);
          posAttr.setY(flap[j + 1], baseY[j + 1] + w);
        }
        posAttr.needsUpdate = true;
      }
    },
  };
  handle.update(0);
  return handle;
}

/**
 * Sparse lights far off — a window row on a far shore, a corniche, a harbour.
 * spec:
 *   points  [[x, y, z], ...]
 *   color   hex (PALETTE); rendered × EMIT_OVER so the bloom takes them
 *   size    metres across, default 1.6 — at 300 m that is four pixels and a
 *           halo, which is what a lit window across water is
 * One InstancedMesh of crossed quads (4 triangles each), no fog: a light is
 * not a surface, and the haze that would dim it is what the bloom draws.
 */
export function farLights(spec) {
  const pts = spec.points || [];
  const sz = spec.size || 1.6;
  const P = [], I = [];
  farQuad(P, I, [-sz / 2, 0, 0], [sz / 2, 0, 0], [sz / 2, sz, 0], [-sz / 2, sz, 0]);
  farQuad(P, I, [0, 0, -sz / 2], [0, 0, sz / 2], [0, sz, sz / 2], [0, sz, -sz / 2]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setIndex(I);
  g.computeVertexNormals();
  farC.set(spec.color === undefined ? PALETTE.hanWindow : spec.color).multiplyScalar(EMIT_OVER * (spec.k || 1));
  const m = new THREE.MeshBasicMaterial({ color: farC.clone(), fog: false, side: THREE.DoubleSide });
  const mesh = new THREE.InstancedMesh(g, m, Math.max(1, pts.length));
  const M = new THREE.Matrix4();
  for (let i = 0; i < pts.length; i++) {
    M.makeRotationY(i * 0.7).setPosition(pts[i][0], pts[i][1], pts[i][2]);
    mesh.setMatrixAt(i, M);
  }
  mesh.count = pts.length;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.name = 'far-lights';
  mesh.castShadow = false; mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  mesh.userData.farTris = 4 * pts.length;
  return mesh;
}

/**
 * The per-chapter bundle. `farBundle({ name, layer, mover, lights })` adds
 * whatever it is given to one group the chapter parents under its root, and
 * returns { group, update(game, dt), audit() }.
 *
 *   update  hides the group on game.state.noFar (the cut: nothing is
 *           drawn, nothing is ticked); parks the mover and the lights at
 *           perfRung ≥ 1; ticks the mover; publishes itself as game.far so
 *           the instruments find the LIVE chapter's layer. Called from the
 *           chapter's own update, which already skips when it is not the
 *           live biome.
 *   audit   { name, tris, calls, wedges, mover: [x, y, z] | null, lights }
 */
export function farBundle(spec) {
  const group = new THREE.Group();
  group.name = 'far-' + (spec.name || 'chapter');
  const layer = spec.layer || null, mover = spec.mover || null, lights = spec.lights || null;
  if (layer) group.add(layer);
  if (mover) group.add(mover.mesh);
  if (lights) group.add(lights);
  let parked = false;
  const handle = {
    group, layer, mover, lights,
    update(game, dt) {
      const st = game.state || {};
      const cut = !!st.noFar;
      if (group.visible === cut) group.visible = !cut;
      if (cut) return;
      const park = (st.perfRung | 0) > 0;
      if (park !== parked) {
        parked = park;
        if (mover) mover.mesh.visible = !park;
        if (lights) lights.visible = !park;
      }
      if (mover && !park) mover.update(dt);
      game.far = handle;
    },
    audit() {
      const tris = (layer ? layer.userData.farTris : 0) + (mover ? mover.mesh.userData.farTris : 0) + (lights ? lights.userData.farTris : 0);
      const mp = mover && mover.mesh.visible ? mover.mesh.getWorldPosition(farV) : null;
      return {
        name: group.name, tris,
        calls: (layer ? 1 : 0) + (mover ? (Array.isArray(mover.mesh.material) ? 2 : 1) : 0) + (lights ? 1 : 0),
        wedges: layer ? layer.geometry.index.count / 3 : 0,
        mover: mp ? [+mp.x.toFixed(1), +mp.y.toFixed(1), +mp.z.toFixed(1)] : null,
        moverPeriod: mover ? mover.period : 0,
        lights: lights ? lights.count : 0,
        parked, cut: !group.visible,
      };
    },
  };
  return handle;
}
