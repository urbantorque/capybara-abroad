async page => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:5188/');
  await page.waitForTimeout(6500);
  const out = [];
  for (let i = 0; i < 8; i++) {
    const yaw = -Math.PI + i * Math.PI / 4;
    await page.evaluate(y => { window.__TY = y; }, yaw);
    await page.waitForTimeout(900);
    const m = await page.evaluate(() => {
      const g = window.__capy;
      const c = g.camera, p = g.capy && g.capy.group ? g.capy.group.position : null;
      // where the animal lands in the frame, in NDC
      let nx = -9, ny = -9;
      if (p) {
        const v = new g.THREE.Vector3(p.x, p.y + 0.5, p.z);
        v.project(c);
        nx = +v.x.toFixed(3); ny = +v.y.toFixed(3);
      }
      return { cam: c.position.toArray().map(v => +v.toFixed(2)), nx, ny };
    });
    out.push({ i, yaw: +yaw.toFixed(2), ...m });
    await page.screenshot({ path: 'qa/TY-' + i + '.png' });
  }
  await page.evaluate(o => fetch('/shot?name=ty.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), out);
}
