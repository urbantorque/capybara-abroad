async page => {
  const out = await page.evaluate(() => {
    const g = window.__capy, o = {};
    const b = g.capy.body, k = g.kowloon, inp = g.input, cam = g.camera, sc = g.scene;
    const shoot = (label, px, py, pz, faceX, faceZ) => {
      b.position.set(px, py, pz); b.velocity.set(0,0,0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      for (let i=0;i<60*400;i++) {
        inp.camYaw=0; inp.x=faceX; inp.z=faceZ; inp.action=false; inp.run=false;
        g.tick(1/60,false);
        if (k.showing() && k.litTowers() >= 14) break;
      }
      const d = new g.THREE.Vector3(); cam.getWorldDirection(d);
      const towers = [];
      sc.traverse(n => {
        if (!n.isMesh) return;
        if (!n.geometry.boundingSphere) { try { n.geometry.computeBoundingSphere(); } catch(e){ return; } }
        const bs = n.geometry.boundingSphere; if (!bs) return;
        n.updateWorldMatrix(true,false);
        const c = bs.center.clone().applyMatrix4(n.matrixWorld);
        if (c.z < -150 && c.y > 15) {
          const v = c.clone().project(cam);
          towers.push([+v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(3)]);
        }
      });
      const inFrame = towers.filter(t => Math.abs(t[0])<=1 && Math.abs(t[1])<=1 && t[2]<1).length;
      return { label, on:k.showing(), lit:k.litTowers(), sky:+g.kowloon.skyward().toFixed(2),
               camPitchDeg:+(Math.asin(d.y)*180/Math.PI).toFixed(1),
               camHeadingDeg:+(Math.atan2(d.x,d.z)*180/Math.PI).toFixed(1),
               fog:{n:+sc.fog.near.toFixed(0), f:+sc.fog.far.toFixed(0)},
               nTowers: towers.length, inFrame, sample: towers.slice(0,6) };
    };
    o.roofFacingNorth = shoot('roof, driving -z', -19, 35.2, 0, 0, -1);
    o.roofFacingWall  = shoot('roof, driving -x', -19, 35.2, 0, -1, 0);
    o.pier            = shoot('pier end',          0, 0.5, -74, 0, -1);
    return o;
  });
  await page.evaluate(async (d) => {
    await fetch('/shot?name=b3hkB.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(d)))) });
  }, out);
}
