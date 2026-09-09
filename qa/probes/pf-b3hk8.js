async page => {
  const out = await page.evaluate(() => {
    const g = window.__capy, o = {};
    const sc = g.scene || (g.renderer && g.renderer.scene);
    o.fog = sc && sc.fog ? { near: sc.fog.near, far: sc.fog.far, col: sc.fog.color && sc.fog.color.getHexString() } : null;
    const cam = g.camera;
    o.cam = { x:+cam.position.x.toFixed(1), y:+cam.position.y.toFixed(1), z:+cam.position.z.toFixed(1),
              far: cam.far, fov: cam.fov };
    const d = new g.THREE.Vector3(); cam.getWorldDirection(d);
    o.camDir = [+d.x.toFixed(2), +d.y.toFixed(2), +d.z.toFixed(2)];
    o.camYawDeg = +(Math.atan2(d.x, d.z)*180/Math.PI).toFixed(1);
    o.camPitchDeg = +(Math.asin(d.y)*180/Math.PI).toFixed(1);
    // find the tower meshes: anything in the kowloon root far to -z
    const towers = [];
    sc.traverse(n => {
      if (!n.isMesh && !n.isInstancedMesh) return;
      n.updateWorldMatrix(true,false);
      if (!n.geometry || !n.geometry.boundingSphere) { try { n.geometry.computeBoundingSphere(); } catch(e){ return; } }
      const bs = n.geometry.boundingSphere; if (!bs) return;
      const c = bs.center.clone().applyMatrix4(n.matrixWorld);
      if (c.z < -150) towers.push({ name: n.name||n.type, x:+c.x.toFixed(0), y:+c.y.toFixed(0), z:+c.z.toFixed(0),
                                    r:+bs.radius.toFixed(0), vis: n.visible,
                                    ndc: (function(){ const v=c.clone().project(cam); return [+v.x.toFixed(2),+v.y.toFixed(2),+v.z.toFixed(3)]; })() });
    });
    o.farThings = towers.slice(0,12);
    o.nFar = towers.length;
    return o;
  });
  await page.evaluate(async (d) => {
    await fetch('/shot?name=b3hk9.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(d)))) });
  }, out);
}
