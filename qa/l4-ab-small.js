async page => {
  await page.reload();
  await page.waitForTimeout(6000);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3000);
  const out = {};
  for (const n of ['hanoi', 'goreme', 'monaco', 'kyoto']) {
    await page.evaluate((name) => { window.__capy.hud.cross(name); }, n);
    await page.waitForTimeout(5000);
    out[n] = await page.evaluate(() => {
      const g = window.__capy;
      const by = {};
      let casters = 0, small = 0;
      const sph = new g.THREE.Vector3();
      g.scene.traverse(o => {
        if (!o.isMesh || !o.castShadow) return;
        let v = true; for (let p = o; p; p = p.parent) if (!p.visible) { v = false; break; }
        if (!v) return;
        casters++;
        const geo = o.geometry; if (!geo.boundingSphere) geo.computeBoundingSphere();
        const s = o.getWorldScale(sph); const r = geo.boundingSphere.radius * Math.max(s.x, s.y, s.z);
        if (r >= 0.35) return;
        small++;
        const chain = []; for (let p = o; p && chain.length < 4; p = p.parent) chain.push((p.name || p.type) + (p.isInstancedMesh ? '[I' + p.count + ']' : ''));
        const key = chain.join('<') + ' ' + geo.type + ' r=' + r.toFixed(2) + (o.userData && o.userData.prop ? ' prop' : '');
        by[key] = (by[key] || 0) + 1;
      });
      const top = Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 25);
      return { casters, small, top };
    });
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l4-ab-small.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
