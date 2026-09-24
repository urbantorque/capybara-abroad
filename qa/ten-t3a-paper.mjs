// ROADMAP-TEN T3a: the list paper points at something near. A fresh free
// file with the sketchbook cut (the story's list, ungated), then Kyoto, Hanoi, Hong Kong and Palawan by hud.cross: at
// arrival the paper's aimed row must be under 60 m away. The metres are read
// off the row's own readout, the text the player reads.
//   CAPY_QA_URL=http://localhost:5191/ node qa/ten-t3a-paper.mjs [tag]
import { openTitle } from './ten-t1a-open.mjs';

const tag = process.argv[2] || 'now';
const h = await openTitle({ url: process.env.CAPY_QA_URL || 'http://localhost:5188/', width: 1280, height: 720 });
const page = h.page;
const out = { checks: [] };
const ok = (name, pass, got) => out.checks.push({ name, pass: !!pass, got });
const read = () => page.evaluate(() => {
  const aim = [...document.querySelectorAll('.capyui-todo li .capyui-aim.on')].find(a => a.offsetParent !== null);
  const li = aim ? aim.closest('li') : null;
  return { row: li ? li.textContent.replace(aim.textContent, '').trim().slice(0, 60) : '',
           dist: aim ? aim.textContent.trim() : '', near: window.__capy.state.qaNearRows(),
           free: window.__capy.state.qaFreePaper().on };
});
try {
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => window.__capy && document.querySelector('.capyui-go'));
  await page.waitForTimeout(900);
  await page.evaluate(() => { const b = document.querySelector('.capyui-go[data-free]') || document.querySelector('.capyui-go.alt'); b.click(); });
  await page.waitForTimeout(2500);
  await page.evaluate(() => document.querySelector('.capyui-pick.hero').click());
  await page.waitForFunction(() => window.__capy.state.started === true, null, { timeout: 90000 });
  await page.waitForTimeout(8000);
  // the list paper on every place: a free file with the sketchbook cut is the
  // same experience paper the story draws, without the story's gates
  await page.evaluate(() => { window.__capy.state.noFreePaper = true; });
  for (const n of ['kyoto', 'hanoi', 'kowloon', 'palawan']) {
    // the story's opening and the premise refuse a crossing for a while;
    // ask again every ten seconds, as a player at a board would
    for (let t = 0; t < 12; t++) {
      await page.evaluate(b => window.__capy.hud.cross(b), n);
      try { await page.waitForFunction(b => window.__capy.biome.current === b, n, { timeout: 10000 }); break; }
      catch (e) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); await page.keyboard.press('Escape'); }
    }
    await page.waitForTimeout(6500);
    const r = await read();
    out[n] = r;
    const m = /^(\d+) m/.exec(r.dist);
    ok(n + ': the aimed row is under 60 m at arrival', r.dist === 'here' || /^[↑↓]/.test(r.dist) || (m && +m[1] < 60), r.row + ' · ' + r.dist);
    if (n === 'kyoto') await page.screenshot({ path: 'qa/ten-t3a-paper-kyoto-' + tag + '.png' });
  }
  ok('no runtime errors', !h.errors.length, h.errors.slice(0, 3));
} catch (e) { out.fatal = String(e.stack || e).slice(0, 600); }
finally {
  console.log(JSON.stringify(out, null, 1));
  console.log('T3a paper: ' + out.checks.filter(c => c.pass).length + '/' + out.checks.length);
  await h.close();
}
