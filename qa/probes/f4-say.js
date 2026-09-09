async page => {
  const wait = ms => page.evaluate(m => new Promise(r => setTimeout(r, m)), ms);
  await page.reload();
  await wait(4500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await wait(6500);
  await page.keyboard.press('Digit1');
  await wait(4000);
  const out = await page.evaluate(() => {
    const g = window.__capy;
    const before = document.querySelectorAll('.capyui-bub').length;
    const toasts0 = document.querySelectorAll('.capyui-toast').length;
    let threw = null, ret;
    try { ret = g.say('press Q to beat the wings. it climbs.'); } catch (e) { threw = String(e); }
    return { sayIs: typeof g.say, arity: g.say ? g.say.length : -1,
             threw: threw, ret: ret === undefined ? 'undefined' : String(ret),
             bubblesBefore: before,
             bubblesAfter: document.querySelectorAll('.capyui-bub').length,
             toastsBefore: toasts0,
             toastsAfter: document.querySelectorAll('.capyui-toast').length,
             hudSay: typeof (g.hud && g.hud.say) };
  });
  const bl = await page.evaluate(o => btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), out);
  await page.evaluate(s => fetch('/shot?name=f4-say.json', { method: 'POST', body: s }), bl);
}
