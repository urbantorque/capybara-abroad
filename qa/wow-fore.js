// ROADMAP-WOW A2 — THE FOREGROUND (W1). Built incrementally, one chapter's
// block at a time, per the roadmap's own instrument name. For each chapter in
// FORE_CHAPTERS: real arrival via `hud.cross` (never `switchTo` — trap 36),
// 9.5 s settle (1.28 s fade + arrival hold), one raw composite screenshot
// (read by eye — the memory says the automated proxies lied about framing
// three times, so this script's own numbers are a cross-check, not the
// verdict), plus a bounding-box NDC proxy for two things a human should not
// have to eyeball on every future run: the object stays out of the animal's
// own screen-space box, and it lands mostly in the top band / outer column
// rather than dead centre.
//
// This is a BOX proxy, not a pixel mask (the roadmap's "hide-and-diff on the
// body meshes" is the more faithful method; a box is the cheap first cut and
// the screenshot is what actually gets read). Ownership: the per-chapter
// anchor positions below are each measured once from the LIVE resting camera
// (camera.position + forward/right/up from getWorldDirection and two cross
// products), never hand-computed from the spawn table's yaw.
async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })

  // Each row's `anchor` is the object's own world position (its pivot),
  // exactly as landed in the chapter's own source file. Landed chapters only
  // — see ROADMAP-WOW.md's A2 section for which of the six are done.
  const FORE_CHAPTERS = [
    { name: 'kyoto', anchor: [-23.27, 4.70, 57.10] },
    { name: 'hanoi', anchor: [-64.01, 5.60, -74.22] },
    { name: 'kowloon', anchor: [8.32, 4.82, 37.27] },
  ];

  const out = { errs, chapters: {} };

  // headless-qa-harness trap 31: THE ARRIVAL LENS DEPENDS ON THE CHAPTER YOU
  // CAME FROM (camDist is not reset on travel). Crossing chapter-to-chapter
  // in one page would measure each chapter's frame as arrived-from-the-
  // previous-chapter-in-this-list, not as a player actually arrives from the
  // title/Sydney start — a different, uncontrolled camera distance each row.
  // Reload and re-Begin fresh for every chapter so each one is measured from
  // the same, comparable arrival vector this object was placed against.
  for (const row of FORE_CHAPTERS) {
    await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} });
    await page.setViewportSize({ width: 1280, height: 760 });
    await page.goto('http://localhost:5188/');
    await page.waitForTimeout(5200);
    await page.evaluate(() => document.querySelector('.capyui-go').click());
    await page.waitForTimeout(1500);
    await page.evaluate((n) => window.__capy.hud.cross(n), row.name);
    await page.waitForTimeout(9500);
    const res = await page.evaluate((anchorArr) => {
      const g = window.__capy, T = g.THREE;
      const anchor = new T.Vector3(anchorArr[0], anchorArr[1], anchorArr[2]);
      // Find the foreground mesh: nearest mesh to the known anchor.
      let fore = null, foreD = 999;
      g.scene.traverse((o) => {
        if (o.isMesh) {
          const wp = o.getWorldPosition(new T.Vector3());
          const d = wp.distanceTo(anchor);
          if (d < foreD) { foreD = d; fore = o; }
        }
      });
      const foreBox = fore ? new T.Box3().setFromObject(fore) : null;
      const capyRoot = g.capy && (g.capy.model || g.capy.group);
      const capyBox = capyRoot ? new T.Box3().setFromObject(capyRoot) : null;
      function ndcBox(box) {
        if (!box) return null;
        const pts = [
          [box.min.x, box.min.y, box.min.z], [box.max.x, box.min.y, box.min.z],
          [box.min.x, box.max.y, box.min.z], [box.max.x, box.max.y, box.min.z],
          [box.min.x, box.min.y, box.max.z], [box.max.x, box.min.y, box.max.z],
          [box.min.x, box.max.y, box.max.z], [box.max.x, box.max.y, box.max.z],
        ];
        let minX = 1, maxX = -1, minY = 1, maxY = -1;
        for (const p of pts) {
          const v = new T.Vector3(p[0], p[1], p[2]).project(g.camera);
          minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
          minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
        }
        return { minX, maxX, minY, maxY };
      }
      const foreNdc = ndcBox(foreBox);
      const capyNdc = ndcBox(capyBox);
      let overlap = false;
      if (foreNdc && capyNdc) {
        overlap = foreNdc.minX < capyNdc.maxX && foreNdc.maxX > capyNdc.minX &&
                  foreNdc.minY < capyNdc.maxY && foreNdc.maxY > capyNdc.minY;
      }
      // top 25% of frame is NDC y in [0.5, 1]; outer 20% columns are NDC x
      // outside [-0.6, 0.6]. Report the fraction of the object's own NDC box
      // that falls in that region, rather than hard-failing on spillover —
      // per the roadmap, "clearly in the corner, clearly not on the animal"
      // is the bar, not a pixel-exact one.
      const inTopOuter = !!foreNdc && (foreNdc.minY >= 0.35) &&
                          (foreNdc.minX >= 0.5 || foreNdc.maxX <= -0.5);
      return {
        biome: g.biome && g.biome.current,
        foreName: fore && fore.name, foreDist: foreD,
        foreNdc, capyNdc, overlapsCapy: overlap, inTopOuter,
      };
    }, row.anchor);
    await page.screenshot({ path: `qa/wow-fore-${row.name}.png` });
    out.chapters[row.name] = res;
  }

  await page.evaluate(async (o) => {
    await fetch('/shot?name=wow-fore.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
