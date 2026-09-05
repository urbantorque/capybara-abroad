async page => {
  const out = { errors: [] };
  page.on('console', m => { if (m.type() === 'error') out.errors.push(m.text().slice(0, 160)); });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:5188/');
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });

  // ---- the arrival, frame by frame ---------------------------------------
  await page.reload();
  // shots during the deal-in; the card is built a few hundred ms after load
  await page.waitForTimeout(4200);
  const t0 = Date.now();
  const arr = [];
  for (let i = 0; i < 9; i++) {
    arr.push(await page.evaluate(() => {
      const c = document.querySelector('.capyui-card');
      if (!c) return { t: -1, none: true };
      const cs = getComputedStyle(c);
      const kids = [...document.querySelectorAll('.capyui-p1 > *')]
        .map(e => +(+getComputedStyle(e).opacity).toFixed(2));
      return { op: +(+cs.opacity).toFixed(2), tr: cs.transform, kids };
    }));
    await page.waitForTimeout(90);
  }
  out.arrival = arr;
  await page.waitForTimeout(2500);
  out.arrivalEnd = await page.evaluate(() => {
    const c = document.querySelector('.capyui-card');
    return { op: +(+getComputedStyle(c).opacity).toFixed(2),
      tr: getComputedStyle(c).transform,
      kids: [...document.querySelectorAll('.capyui-p1 > *')]
        .map(e => +(+getComputedStyle(e).opacity).toFixed(2)) };
  });

  // ---- the hover lift, which forwards had pinned --------------------------
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(3000);
  const tile = page.locator('.capyui-picks .capyui-pick').nth(2);
  const b4 = await tile.evaluate(e => getComputedStyle(e).transform);
  await tile.hover();
  await page.waitForTimeout(420);
  const af = await tile.evaluate(e => getComputedStyle(e).transform);
  out.lift = { before: b4, after: af, works: b4 !== af };
  // and the hero's proportions while we are here
  out.hero = await page.evaluate(() => {
    const h = document.querySelector('.capyui-pick.hero');
    const a = h.querySelector('.capyui-pickart').getBoundingClientRect();
    const bd = h.querySelector('.capyui-pickbody');
    const br = bd.getBoundingClientRect();
    const r = h.getBoundingClientRect();
    return { artPct: +(a.width / r.width * 100).toFixed(1),
      bodyW: Math.round(br.width),
      bodyBg: getComputedStyle(bd).backgroundImage.slice(0, 60) };
  });

  // ---- the turn back, sampled --------------------------------------------
  const turn = [];
  await page.evaluate(() => { window.__t = performance.now(); });
  await page.keyboard.press('Escape');
  for (let i = 0; i < 8; i++) {
    turn.push(await page.evaluate(() => {
      const p1 = document.querySelector('.capyui-p1'), p2 = document.querySelector('.capyui-p2');
      return { ms: Math.round(performance.now() - window.__t),
        p1: p1.hidden ? 'hidden' : +(+getComputedStyle(p1).opacity).toFixed(2),
        p2: p2.hidden ? 'hidden' : +(+getComputedStyle(p2).opacity).toFixed(2),
        both: !p1.hidden && !p2.hidden };
    }));
    await page.waitForTimeout(45);
  }
  out.turn = turn;
  out.bothEver = turn.some(r => r.both);
  await page.waitForTimeout(1200);
  out.afterTurn = await page.evaluate(() => {
    const p1 = document.querySelector('.capyui-p1');
    return { p1op: +(+getComputedStyle(p1).opacity).toFixed(2),
      p1tr: getComputedStyle(p1).transform,
      hidden2: document.querySelector('.capyui-p2').hidden,
      focus: document.activeElement ? document.activeElement.textContent.trim().slice(0, 14) : '' };
  });

  // ---- reduced motion: the end state, immediately -------------------------
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await page.waitForTimeout(4300);
  out.reducedEarly = await page.evaluate(() => {
    const c = document.querySelector('.capyui-card');
    if (!c) return { none: true };
    return { op: +(+getComputedStyle(c).opacity).toFixed(2),
      kids: [...document.querySelectorAll('.capyui-p1 > *')]
        .map(e => +(+getComputedStyle(e).opacity).toFixed(2)) };
  });
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(260);
  out.reducedTurn = await page.evaluate(() => ({
    p2hidden: document.querySelector('.capyui-p2').hidden,
    p2op: +(+getComputedStyle(document.querySelector('.capyui-p2')).opacity).toFixed(2),
  }));
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  await page.evaluate(o => fetch('/shot?name=tt.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
