// THE LEDGER LEAF, LOOKED AT. See jrChapLine in systems.js.
//
// The mark is written by a probe that never opens a card, so the one thing
// none of the other instruments in this batch can answer is whether the
// sentence renders — and a leaf line is UI: it can be added to the right
// object, saved, restored, and still be clipped, mis-pluralised or sitting
// under a fold nobody opens.
async page => {
  await page.goto("http://localhost:5188/", { waitUntil: "load" });
  await page.waitForTimeout(5500);
  // Seed a file with both of this batch's new leaf numbers on it, from the
  // TITLE (a live game rewrites the file before a reload can land on it).
  await page.evaluate(() => {
    try {
      localStorage.setItem("capy3.journey.v1", JSON.stringify({
        v: 1, tasks: ["to-pasto", "steal-empanada"], seen: [1, 2, 4, 8, 10],
        recs: {}, ms: 900000, chapms: {}, finds: [], foundAt: {},
        inc: { 2: 1 }, scn: {}, pho: { 6: 3 }, fed: {}, pas: {}, pal: { 10: 4 },
        rep: {}, lin: { 4: 67, 6: 64, 8: 72, 10: 52 }, err: { 10: 3, 4: 1 },
        biome: "sydney", fin: 0, slid: 1, slip: 1,
      }));
    } catch (e) {}
  });
  await page.reload();
  await page.waitForTimeout(6500);
  await page.evaluate(() => { const b = document.querySelector(".capyui-carry"); if (b) b.click(); });
  await page.waitForTimeout(3000);

  // Escape opens the pause card, which is the only door to the journey.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1200);
  const doors = await page.evaluate(() =>
    Array.from(document.querySelectorAll('button, [role="button"]'))
      .filter(b => b.offsetParent)
      .map(b => (b.textContent || '').trim().slice(0, 40)));

  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button, [role="button"]'))
      .find(x => x.offsetParent && /journey|ledger/i.test(x.textContent || ''));
    if (b) b.click();
  });
  await page.waitForTimeout(1600);

  const leaves = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('.capyui-lednoto').forEach((el) => {
      const row = el.closest('*');
      out.push((el.textContent || '').trim());
    });
    return out;
  });
  await page.screenshot({ path: 'qa/NR-ledger.png' });
  await page.evaluate(async (p) => {
    await fetch('/shot?name=NR-LED', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(p)))) });
  }, { doors: doors, leaves: leaves });
}
