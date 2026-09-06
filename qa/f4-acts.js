async page => {
  const wait = ms => page.evaluate(m => new Promise(r => setTimeout(r, m)), ms);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.reload();
  await wait(4500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await wait(6500);
  await page.keyboard.press('Digit1');
  await wait(5000);
  const out = { steps: [] };
  const look = async (label) => {
    const s = await page.evaluate(function (l) {
      const rows = [];
      document.querySelectorAll('.capyui-todo li.capyui-task:not(.capyui-hidden)').forEach(function (e) {
        const t = e.querySelector('.capyui-tier');
        rows.push(((e.querySelector('.capyui-txt') || {}).textContent || '') +
                  (t ? '  [' + t.className.replace('capyui-tier ', '') + ']' : ''));
      });
      const c = document.querySelector('.capyui-todo .capyui-count') ||
                document.querySelector('.capyui-todo > div:last-child');
      return { at: l, rows: rows,
               foot: (function(){ const n = document.querySelector('.capyui-todo'); 
                                  return n ? (n.textContent.match(/SYDNEY[^]*$/) || [''])[0].trim() : ''; })() };
    }, label);
    out.steps.push(s);
    const box = await page.evaluate(() => {
      const el = document.querySelector('.capyui-todo'); const r = el.getBoundingClientRect();
      return { x: Math.max(0, Math.round(r.x) - 8), y: Math.max(0, Math.round(r.y) - 8),
               width: Math.round(r.width) + 16, height: Math.round(r.height) + 16 };
    });
    await page.screenshot({ path: 'qa/F4-act-' + label + '.png', clip: box });
  };
  await look('1');
  await page.evaluate(() => {
    const g = window.__capy;
    ['wheek','steal-hat','coffee-spill','picnic-thief','bin-chicken','dig-flower',
     'chased','photo-op','dog-loose','sprinkler'].forEach(id => g.completeTask(id));
    return true;
  });
  await wait(3500);
  await look('2');
  await page.evaluate(() => {
    const g = window.__capy;
    ['opera-stage','ball-harbour','swim','hat-harbour'].forEach(id => g.completeTask(id));
    return true;
  });
  await wait(3500);
  await look('3');
  out.err = await page.evaluate(() => window.__capy.state.lastError ? String(window.__capy.state.lastError) : null);
  const bl = await page.evaluate(o => btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), out);
  await page.evaluate(s => fetch('/shot?name=f4-acts.json', { method: 'POST', body: s }), bl);
}
