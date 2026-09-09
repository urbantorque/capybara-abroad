async page => {
  // ---------------------------------------------------------------------------
  // qa/b0-selftest.js — PROVE THE RECORDER BEFORE A PERSON SITS DOWN (B0)
  //
  // This is NOT the B0 session and cannot be: it is a script, and the whole
  // value of B0 is that a script is exactly what a stranger is not. It is here
  // because a recorder that is first run on a real ten-minute session and turns
  // out to be broken has wasted the one thing that is expensive — the person.
  //
  // So it drives the game the way the session's shape will look: press Begin,
  // wander, try some keys the game has never mentioned, open the journal, go
  // looking for the controls, and stand still long enough to register a gap.
  // Then `qa/b0-notes.js` has to report all six of those back.
  //
  // Run after qa/b0-watch.js, in the same session.
  // ---------------------------------------------------------------------------
  const hold = async (k, ms) => {
    await page.keyboard.down(k);
    await page.waitForTimeout(ms);
    await page.keyboard.up(k);
  };
  await page.waitForTimeout(1500);
  await page.keyboard.press('Digit1');          // Begin, in Sydney
  await page.waitForTimeout(9000);

  // wander for a bit, the way somebody who has just been handed a keyboard does
  for (const [k, ms] of [['KeyW', 1800], ['KeyA', 900], ['KeyW', 1400], ['KeyD', 1100]]) {
    await hold(k, ms);
    await page.waitForTimeout(300);
  }
  await page.keyboard.press('Space');
  await page.waitForTimeout(600);

  // ...and the keys a stranger reaches for that this game does not use. NOT F
  // or R, which look unused and are both on the legend's fold (aim at another
  // task; put me back) — the first cut of this test picked them and the
  // recorder correctly refused to call them unmentioned.
  for (const k of ['KeyI', 'KeyO', 'KeyT', 'Digit3']) {
    await page.keyboard.press(k);
    await page.waitForTimeout(400);
  }
  await page.keyboard.press('KeyQ');            // one that IS on the legend
  await page.waitForTimeout(900);

  // stand still long enough to be a gap worth writing down
  await page.waitForTimeout(23000);

  // go looking for instructions: the journal, then the controls fold
  await page.keyboard.press('KeyJ');
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const d = document.querySelector('.capyui-jrkeys');
    if (d) d.open = true;
  });
  await page.waitForTimeout(1500);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1200);
  await hold('KeyW', 2000);
  await page.waitForTimeout(1500);
}
