async page => {
  const LAST = 'orca-ride';
  const ids = await page.evaluate(async () => (await fetch('/qa/all-task-ids.json')).json());
  const out = { taskCount: ids.length, last: LAST };
  // 230 of 231, standing in Antarctica — the shape a real completionist is in
  // one tick before the end of the game, and the shape the receipt used to fire
  // in. Written once with page.evaluate and never with addInitScript, which
  // would wipe the file at the reload below (harness trap 10).
  await page.evaluate(o => {
    localStorage.clear();
    localStorage.setItem('capy3.journey.v1', JSON.stringify({
      v: 1, tasks: o.ids.filter(x => x !== o.last),
      seen: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19],
      recs: {}, ms: 3600000, chapms: {}, finds: [], foundAt: {},
      biome: 'antarctic', fin: 0
    }));
  }, { ids: ids, last: LAST });
  await page.reload();
  await page.evaluate(() => new Promise(r => setTimeout(r, 5000)));
  await page.keyboard.press('Enter');          // carry on, into Antarctica
  await page.evaluate(() => new Promise(r => setTimeout(r, 5000)));

  out.landed = await page.evaluate(o => {
    const g = window.__capy;
    return { biome: g.biome.current, started: !!g.state.started,
             done: g.hud.tasksDone(), lastDone: !!g.hud.isTaskDone(o.last) };
  }, { last: LAST });

  // ---- THE 231st TICK, IN ANTARCTICA -------------------------------------
  await page.evaluate(o => { window.__capy.hud.completeTask(o.last); }, { last: LAST });

  // The end waits for the chapter ceremony it just started:
  // 1100 + sysKEEP_WAIT(2700) + sysKEEP_CARD(3400) + 500 = 7700 ms.
  out.steps = [];
  for (let i = 0; i < 16; i++) {
    await page.evaluate(() => new Promise(r => setTimeout(r, 1000)));
    const s = await page.evaluate(() => {
      const g = window.__capy;
      const led = document.querySelector('.capyui-led');
      const place = document.querySelector('.capyui-place');
      const toasts = Array.from(document.querySelectorAll('.capyui-toast'))
        .map(t => t.textContent);
      return {
        led: !!(led && led.classList.contains('show')),
        ledText: led && led.classList.contains('show')
          ? (led.textContent || '').slice(0, 60) : null,
        place: !!(place && place.classList.contains('show')),
        placeText: place && place.classList.contains('show')
          ? (place.textContent || '').slice(0, 90) : null,
        paused: !!g.state.paused,
        done: g.hud.tasksDone()
      };
    });
    out.steps.push({ s: i + 1, led: s.led, place: s.place, placeText: s.placeText,
                     paused: s.paused, done: s.done, ledText: s.ledText });
    if (s.ledText) out.receiptText = s.ledText;
  }
  out.receiptShown = out.steps.some(s => s.led);
  out.pointedHome = out.steps.some(s =>
    s.placeText && s.placeText.indexOf('THAT IS EVERYTHING') >= 0);

  // ---- AND THE SAVE THE PLAYER WOULD COME BACK TO -------------------------
  out.saved = await page.evaluate(() => {
    try {
      const o = JSON.parse(localStorage.getItem('capy3.journey.v1'));
      return { n: o.tasks.length, fin: o.fin, biome: o.biome,
               hasTold: Object.prototype.hasOwnProperty.call(o, 'told') };
    } catch (e) { return { err: String(e) }; }
  });

  // ---- A RETURNING PLAYER WHO FINISHED AND CLOSED THE TAB -----------------
  // completeTask's `silent` branch returns above the doneCount test, so this
  // path used to say nothing at all about where the ending is.
  await page.reload();
  await page.evaluate(() => new Promise(r => setTimeout(r, 5000)));
  await page.keyboard.press('Enter');
  // SAMPLED, NOT SNAPSHOT. A toast lives 2.2 s and fades over 0.4 s, so a
  // single read at +7 s reports an empty rail for a line that was said at +2.2.
  const seen = [];
  let retLed = false, retBiome = '', retDone = 0;
  for (let i = 0; i < 20; i++) {
    await page.evaluate(() => new Promise(r => setTimeout(r, 600)));
    const s = await page.evaluate(() => {
      const g = window.__capy;
      const led = document.querySelector('.capyui-led');
      return {
        biome: g.biome.current, done: g.hud.tasksDone(),
        led: !!(led && led.classList.contains('show')),
        toasts: Array.from(document.querySelectorAll('.capyui-toast')).map(t => t.textContent)
      };
    });
    retLed = retLed || s.led; retBiome = s.biome; retDone = s.done;
    for (const t of s.toasts) if (seen.indexOf(t) < 0) seen.push(t);
  }
  out.returned = { biome: retBiome, done: retDone, led: retLed, toasts: seen,
                   saidHome: seen.some(t => t.indexOf('the lawn in Sydney') >= 0) };

  out.err = await page.evaluate(() => {
    const g = window.__capy; return g.state.lastError ? String(g.state.lastError) : null;
  });
  const b = await page.evaluate(o =>
    btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), out);
  await page.evaluate(s => fetch('/shot?name=r2-lastdoor.json', { method: 'POST', body: s }), b);
}
