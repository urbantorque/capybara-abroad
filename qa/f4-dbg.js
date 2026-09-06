async page => {
  const wait = ms => page.evaluate(m => new Promise(r => setTimeout(r, m)), ms);
  await page.reload();
  await wait(7000);
  await page.keyboard.press('Digit1');
  await wait(4500);
  const out = await page.evaluate(() => ({
    started: window.__capy.state.started,
    todo: !!document.querySelector('.capyui-todo'),
    tasks: document.querySelectorAll('.capyui-task').length,
    tier: document.querySelectorAll('.capyui-tier').length,
    wow: document.querySelectorAll('.capyui-tier.wow').length,
    mini: document.querySelectorAll('.capyui-tier.mini').length,
    meas: document.querySelectorAll('.capyui-meas').length,
    sampleClass: (function () {
      const e = document.querySelector('.capyui-tier');
      return e ? e.className : 'NONE';
    })(),
  }));
  const bl = await page.evaluate(o => btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), out);
  await page.evaluate(s => fetch('/shot?name=f4-dbg.json', { method: 'POST', body: s }), bl);
}
