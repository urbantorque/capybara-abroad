async page => {
  const KEYS = ['Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8','Digit9',
                'Digit0','Minus','Equal','BracketLeft','BracketRight','Semicolon','Quote',
                'Comma','Period','Slash'];
  const NAMES = ['sydney','pasto','quay','kyoto','cali','rio','iceland','sahara','drift',
                 'venice','kowloon','palawan','goreme','manly','pantanal','cave','antarctic',
                 'monaco','hanoi'];
  const out = [];
  for (let i = 0; i < 19; i++) {
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await page.reload();
    await page.waitForTimeout(5200);
    await page.keyboard.press(KEYS[i]);
    await page.waitForTimeout(7000);
    const row = await page.evaluate(async () => {
      const g = window.__capy;
      const c = g.canvas || g.renderer.domElement;
      const P = g.post.params;
      const keep = { dof: P.dof, air: P.air, crease: P.crease };
      // AIR ALONE, against nothing. The defocus also lowers local max-minus-min
      // and would be counted as desaturation if it were in the arm; it is not
      // desaturation, it is a blur, and mixing the two is how a budget gets
      // spent on the wrong term.
      const ARMS = [['off', 0], ['air', keep.air]];
      const shots = [];
      for (const [tag, air] of ARMS) {
        P.dof = 0; P.crease = 0; P.air = air;
        g.post.render();
        shots.push([tag, c.toDataURL('image/png')]);
      }
      P.dof = keep.dof; P.air = keep.air; P.crease = keep.crease;
      const cv = document.createElement('canvas');
      cv.width = c.width; cv.height = c.height;
      const cx = cv.getContext('2d', { willReadFrequently: true });
      const res = {};
      for (const [tag, url] of shots) {
        const im = new Image();
        await new Promise(r => { im.onload = r; im.src = url; });
        cx.drawImage(im, 0, 0);
        const px = cx.getImageData(0, 0, cv.width, cv.height).data;
        let cT = 0, cM = 0, nT = 0, nM = 0, lT = 0;
        for (let y = 0; y < cv.height; y += 2) {
          for (let x = 0; x < cv.width; x += 2) {
            const i2 = (y * cv.width + x) * 4;
            const mx = Math.max(px[i2], px[i2 + 1], px[i2 + 2]);
            const mn = Math.min(px[i2], px[i2 + 1], px[i2 + 2]);
            if (y < cv.height / 3) {
              cT += mx - mn; nT++;
              lT += 0.2126 * px[i2] + 0.7152 * px[i2 + 1] + 0.0722 * px[i2 + 2];
            } else if (y < cv.height * 2 / 3) { cM += mx - mn; nM++; }
          }
        }
        res[tag] = { chT: cT / nT, chM: cM / nM, lumT: lT / nT };
      }
      return { biome: g.biome && g.biome.current, air: keep.air, airMax: P.airMax,
               dChT: +((res.air.chT / res.off.chT - 1) * 100).toFixed(1),
               dChM: +((res.air.chM / res.off.chM - 1) * 100).toFixed(1),
               dLumT: +(res.air.lumT - res.off.lumT).toFixed(2) };
    });
    row.want = NAMES[i];
    out.push(row);
  }
  await page.evaluate(o => fetch('/shot?name=depthchroma.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out);
}
