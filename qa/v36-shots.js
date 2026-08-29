async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(3500);

  const out = {};

  // ---- BEFORE: no pictures anywhere --------------------------------------
  out.before = await page.evaluate(() => {
    const g = window.__capy;
    return { album: g.hud.albumAudit().n,
             shots: document.querySelectorAll('img.capyui-shot').length };
  });

  // ---- take one in Sydney, and one in Venice -----------------------------
  await page.keyboard.press('KeyK');
  await page.waitForTimeout(900);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1400);
  await page.keyboard.press('KeyK');
  await page.waitForTimeout(700);

  await page.evaluate(() => { window.__capy.biome.switchTo('venice'); });
  await page.waitForTimeout(3500);
  await page.keyboard.press('KeyK');
  await page.waitForTimeout(900);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1400);
  await page.keyboard.press('KeyK');
  await page.waitForTimeout(700);

  out.taken = await page.evaluate(() => {
    const g = window.__capy;
    const a = g.hud.albumAudit();
    return { album: a.n, places: a.places };
  });

  // ---- the departures board ----------------------------------------------
  await page.keyboard.press('Tab');
  await page.waitForTimeout(1400);
  out.board = await page.evaluate(() => {
    const rows = document.querySelectorAll('.capyui-jrmark');
    let withShot = 0;
    const which = [];
    rows.forEach((r, i) => {
      const im = r.querySelector('img.capyui-shot');
      if (im) { withShot++; which.push(i + 1); }
    });
    return { rows: rows.length, withShot: withShot, chapters: which,
             totalImgs: document.querySelectorAll('img.capyui-shot').length };
  });

  // ...and open it a second time, to prove the row does not stack images
  await page.keyboard.press('Escape');
  await page.waitForTimeout(700);
  await page.keyboard.press('Tab');
  await page.waitForTimeout(1200);
  out.boardAgain = await page.evaluate(() => {
    const rows = document.querySelectorAll('.capyui-jrmark');
    let most = 0;
    rows.forEach(r => { most = Math.max(most, r.querySelectorAll('img.capyui-shot').length); });
    return { mostImagesOnOneRow: most };
  });

  // ---- the ledger --------------------------------------------------------
  out.ledger = await page.evaluate(() => {
    const b = document.querySelector('.capyui-jrled') ||
              [...document.querySelectorAll('button,summary')]
                .find(e => /ledger/i.test(e.textContent || ''));
    if (b) b.click();
    return { clicked: !!b };
  });
  await page.waitForTimeout(1600);
  out.ledgerShots = await page.evaluate(() => {
    const marks = document.querySelectorAll('.capyui-ledmark');
    let withShot = 0;
    marks.forEach(m => { if (m.querySelector('img.capyui-shot')) withShot++; });
    return { leaves: marks.length, withShot: withShot };
  });

  await page.evaluate(async (o) => {
    await fetch('/shot?name=v36-shots.json', {
      method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
    });
  }, out);
}
