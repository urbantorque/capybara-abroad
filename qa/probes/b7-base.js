async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(3000);

  const TAG = 'after';
  const out = await page.evaluate(async () => {
    const g = window.__capy, THREE = g.THREE;
    if (g.biome.current !== 'sydney') g.biome.switchTo('sydney');
    for (let i = 0; i < 30; i++) g.tick(1 / 60, false);
    const r = { live: g.biome.current };

    // ---- the ring metric, exactly as rev-people.js computes it
    const meshes = [];
    g.scene.traverse((o) => {
      if (!o.isMesh && !o.isInstancedMesh) return;
      let p = o, vis = true;
      while (p) { if (!p.visible) { vis = false; break; } p = p.parent; }
      if (!vis) return;
      const gm = o.geometry;
      if (!gm) return;
      if (!gm.boundingSphere) gm.computeBoundingSphere();
      if (gm.boundingSphere && gm.boundingSphere.radius > 60) return;
      meshes.push(o);
    });
    const sp = g.biome.spawnOf('sydney');
    const wp = new THREE.Vector3(), mat4 = new THREE.Matrix4();
    const pts = [];
    for (const o of meshes) {
      o.updateWorldMatrix(true, false);
      if (o.isInstancedMesh) {
        for (let i = 0; i < o.count; i++) {
          o.getMatrixAt(i, mat4);
          wp.setFromMatrixPosition(mat4);
          o.localToWorld(wp);
          if (wp.x === wp.x) pts.push(wp.x, wp.z);
        }
      } else {
        wp.setFromMatrixPosition(o.matrixWorld);
        if (wp.x === wp.x) pts.push(wp.x, wp.z);
      }
    }
    r.propPoints = pts.length / 2;
    function ring(rad) {
      const cells = {};
      let n = 0, full = 0;
      for (let a = 0; a < 30; a++) {
        const th = a / 30 * Math.PI * 2;
        const cx = sp.x + Math.cos(th) * rad, cz = sp.z + Math.sin(th) * rad;
        const key = Math.round(cx / 20) + ',' + Math.round(cz / 20);
        if (cells[key]) continue;
        cells[key] = 1; n++;
        let c = 0;
        for (let i = 0; i < pts.length; i += 2) {
          if (Math.abs(pts[i] - cx) <= 10 && Math.abs(pts[i + 1] - cz) <= 10) { c++; if (c >= 2) break; }
        }
        if (c >= 2) full++;
      }
      return n ? Math.round(100 * full / n) : 0;
    }
    r.rings = { r20: ring(20), r45: ring(45), r70: ring(70), r95: ring(95) };

    // ---- triangles
    let tris = 0;
    g.scene.traverse((o) => {
      if (!o.isMesh && !o.isInstancedMesh) return;
      let p = o, vis = true;
      while (p) { if (!p.visible) { vis = false; break; } p = p.parent; }
      if (!vis) return;
      const gm = o.geometry; if (!gm) return;
      const t = gm.index ? gm.index.count / 3 : (gm.attributes.position ? gm.attributes.position.count / 3 : 0);
      tris += t * (o.isInstancedMesh ? o.count : 1);
    });
    r.tris = Math.round(tris);

    // ---- WHAT IS THE WHITE PLANE AT (48, 46)?
    const ray = new THREE.Raycaster(); ray.far = 60;
    const org = new THREE.Vector3(), down = new THREE.Vector3(0, -1, 0);
    r.probe = [];
    for (const [x, z] of [[48, 46], [46, 44], [50, 48], [58, 50], [40, 40]]) {
      g.capy.group.visible = false;
      org.set(x, 20, z); ray.set(org, down);
      const hits = ray.intersectObject(g.scene, true);
      const row = { at: [x, z], hits: [] };
      for (let k = 0; k < hits.length && row.hits.length < 3; k++) {
        let o = hits[k].object, vis = true;
        while (o) { if (!o.visible) { vis = false; break; } o = o.parent; }
        if (!vis) continue;
        const ob = hits[k].object;
        const gm = ob.geometry;
        if (gm && !gm.boundingBox) gm.computeBoundingBox();
        let nm = ob.name || '', q = ob.parent, guard = 0;
        while (q && guard++ < 5) { if (q.name) nm = nm ? (q.name + '/' + nm) : q.name; q = q.parent; }
        row.hits.push({
          y: +hits[k].point.y.toFixed(2), name: nm || ob.type,
          geo: gm ? gm.type : '?',
          tris: gm ? (gm.index ? gm.index.count / 3 : gm.attributes.position.count / 3) : 0,
          col: ob.material && ob.material.color ? '#' + ob.material.color.getHexString() : '',
          bb: gm && gm.boundingBox ? [
            +gm.boundingBox.min.x.toFixed(1), +gm.boundingBox.min.y.toFixed(1), +gm.boundingBox.min.z.toFixed(1),
            +gm.boundingBox.max.x.toFixed(1), +gm.boundingBox.max.y.toFixed(1), +gm.boundingBox.max.z.toFixed(1)] : null,
        });
      }
      g.capy.group.visible = true;
      r.probe.push(row);
    }

    // ---- ms/tick
    const b = g.capy.body;
    b.position.set(sp.x, 1, sp.z); b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    for (let i = 0; i < 120; i++) g.tick(1 / 60, false);
    const ts = [];
    for (let i = 0; i < 300; i++) {
      g.input.x = Math.sin(i / 40) * 0.8; g.input.z = 0.8;
      const t0 = performance.now(); g.tick(1 / 60, false); ts.push(performance.now() - t0);
    }
    g.input.x = 0; g.input.z = 0;
    ts.sort((a, c) => a - c);
    r.med = +ts[150].toFixed(3); r.p90 = +ts[270].toFixed(3);
    r.bodies = g.world.bodies.length;
    return r;
  });

  await page.evaluate(async (o) => {
    await fetch('/shot?name=b7-base.json', {
      method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
    });
  }, out);

  // ---- the frames
  const SHOTS = [['gardens', 58, 50, 2.4], ['east', 48, 30, 1.6],
                 ['northlawn', 0, 66, 0.0], ['ne', 40, 60, 0.8]];
  for (const [tag, x, z, yaw] of SHOTS) {
    await page.evaluate(async (q) => {
      function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
      const g = window.__capy;
      const b = g.capy.body;
      g.capy.face(q.yaw); g.capy.carriedBy = null;
      b.position.set(q.x, 0.6, q.z);
      b.velocity.set(0, 0, 0); b.angularVelocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      g.renderer.setSize(1280, 700, false);
      for (let i = 0; i < 70; i++) g.tick(1 / 60, false);
      await sleep(350);
      g.tick(1 / 60, true);
      const p = g.capy.renderPosition;
      g.camera.position.set(p.x - Math.sin(q.yaw) * 11, p.y + 6.5, p.z - Math.cos(q.yaw) * 11);
      g.camera.lookAt(p.x + Math.sin(q.yaw) * 8, p.y + 1.0, p.z + Math.cos(q.yaw) * 8);
      g.camera.updateMatrixWorld(true);
      g.renderer.setRenderTarget(null);
      g.renderer.render(g.scene, g.camera);
      const url = g.renderer.domElement.toDataURL('image/png');
      await fetch('/shot?name=b7-' + q.tag + '-' + q.t + '.png', { method: 'POST', body: url.split(',')[1] });
    }, { tag: tag, x: x, z: z, yaw: yaw, t: TAG });
    await page.waitForTimeout(350);
  }
}
