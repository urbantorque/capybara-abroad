async page => {
  // ---------------------------------------------------------------------------
  // qa/q2-foot.js — THE VARIETY TERM AND THE LEDGER'S LAST LINE (Q2)
  //
  // Two things, and both of them are numbers rather than opinions:
  //
  //  1. WHAT VARIETY DOES TO A TIER TABLE THAT WAS ALREADY CALIBRATED. B14's
  //     boundaries were set on a measured directed run worth 17 points. The
  //     same file is replayed here through forceNoto/forceRep — the masher's
  //     shape (eight names that are two names) and a stylist's (the same
  //     trouble, spread over nine) — and the tier is read off both.
  //  2. THE FOOT, ON A PHONE. It is now up to three clauses long, and the
  //     final one is the last line this game ever says. Measured at 360 px:
  //     how many lines, and does it stay inside the card.
  // ---------------------------------------------------------------------------
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(6000);

  const out = { errs: errs, cases: [] };
  // the measured masher file, and a stylist with exactly the same trouble
  const CASES = [
    { who: 'nobody', rep: {}, noto: [0, 0, 1] },
    { who: 'the measured masher', rep: { 'hat-trick': 7, 'kleptomania': 1 }, noto: [6, 6, 3] },
    { who: 'the same trouble, spread', noto: [6, 6, 3],
      rep: { 'hat-trick': 1, 'kleptomania': 1, 'bin-day': 1, 'deep-six': 1,
             'flat-white': 1, 'mopping-up': 1, 'smash-grab': 1, 'high-tea': 1 } },
    { who: 'one name, once', rep: { 'same-again': 1 }, noto: [1, 0, 1] },
    { who: 'all forty', noto: [40, 20, 12], rep: 'ALL' },
  ];
  await page.setViewportSize({ width: 360, height: 740 });
  await page.waitForTimeout(400);
  for (const c of CASES) {
    out.cases.push(await page.evaluate((cc) => {
      const g = window.__capy;
      let rep = cc.rep;
      if (rep === 'ALL') {
        // every id the table holds, asked for rather than hard-coded: forty
        // strings copied into a probe go stale the first time one is renamed.
        rep = {};
        const ids = g.repDebug().ids || [];
        for (const id of ids) rep[id] = 1;
      }
      g.hud.forceRep(rep);
      g.hud.forceNoto(cc.noto[0], cc.noto[1], cc.noto[2], 0, 0);
      g.hud.ledger();
      for (let i = 0; i < 30; i++) g.tick(1 / 60, false);
      const foot = document.querySelector('.capyui-ledfoot');
      const cs = getComputedStyle(foot);
      const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
      const r = foot.getBoundingClientRect();
      const a = g.hud.notoAudit();
      const res = { who: cc.who, foot: foot.textContent,
                    lines: Math.round(r.height / lh), fs: +parseFloat(cs.fontSize).toFixed(1),
                    w: Math.round(r.width), offScreen: r.left < 0 || r.right > innerWidth + 1,
                    noto: { inc: a.inc, scn: a.scn, spread: a.spread, variety: a.variety,
                            score: a.score, tier: a.tier, name: a.name } };
      // ...and the same line as the game's LAST one, which no probe can reach
      // by playing: the tier clause only appears on the final ledger.
      const final = foot.textContent.indexOf('you leave as') >= 0 ? foot.textContent
        : (foot.textContent.split('  ·  ')[0] + '  ·  you leave as ' + a.name +
           (res.foot.indexOf('they had') >= 0
             ? '  ·  ' + res.foot.slice(res.foot.indexOf('they had')) : ''));
      foot.textContent = final;
      const r2 = foot.getBoundingClientRect();
      res.final = final;
      res.finalLines = Math.round(r2.height / lh);
      res.finalOff = r2.left < 0 || r2.right > innerWidth + 1;
      foot.textContent = res.foot;
      return res;
    }, c));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  out.errN = errs.length;
  await page.evaluate((o) => fetch('/shot?name=q2-foot.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), out);
}
