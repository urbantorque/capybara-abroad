async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5200);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2600);

  const NEED = {
    sydney:   ['sprinklers','soaking','vanParked','vanQueueSpot'],
    pasto:    ['craterCentre','onCarroza','carroza'],
    quay:     ['boat','bridge','inZone'],
    kyoto:    ['heron','heronStanding','bellRinging','inZone'],
    cali:     ['night','onFloor','mirador','onChiva','inZone'],
    rio:      ['selaron','lapa'],
    iceland:  ['fox','foxInterest','soak'],
    sahara:   ['chasing','duneTop','dusk','inZone'],
    drift:    ['orchard','lantern','lit'],
    venice:   ['pigeonsUp','cafe','flooded','inZone'],
    kowloon:  ['show','inZone'],
    palawan:  ['bangka','inZone'],
    goreme:   ['sunUp','balloon','altitude','inZone'],
    manly:    ['setNear','inZone'],
    pantanal: ['dusk','inZone'],
    cave:     ['mouth','daylight','inZone'],
    antarctic:['inZone']
  };
  const ZONES = {
    quay:['apron','manly','quay'], kyoto:['bamboo'], cali:['dancefloor'],
    venice:['piazza'], kowloon:['harbour','market'], palawan:['wreck'],
    goreme:['town','landing'], manly:['pool','shelly'],
    pantanal:['sandbar','baia','river'], antarctic:['whalers','colony'],
    cave:['passage']
  };
  const out = {};
  const names = Object.keys(NEED);
  for (const name of names) {
    const r = await page.evaluate((arg) => {
      const g = window.__capy;
      const res = { missing: [], zonesEmpty: [], err: null };
      try { g.biome.switchTo(arg.name); } catch (e) { res.err = 'switchTo: ' + e.message; return res; }
      const api = arg.name === 'sydney' ? g.env : g[arg.name];
      if (!api) { res.err = 'no api object'; return res; }
      for (const k of arg.need) if (api[k] === undefined || api[k] === null) res.missing.push(k);
      for (const z of (arg.zones || [])) {
        let hit = 0;
        for (let x = -420; x <= 460 && !hit; x += 6) {
          for (let zz = -760; zz <= 260; zz += 6) {
            let v = false;
            try { v = !!api.inZone(z, x, zz); } catch (e) { v = false; }
            if (v) { hit = 1; break; }
          }
        }
        if (!hit) res.zonesEmpty.push(z);
      }
      return res;
    }, { name, need: NEED[name], zones: ZONES[name] });
    out[name] = r;
    await page.waitForTimeout(700);
  }
  await page.evaluate((o) => {
    const b = btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1))));
    return fetch('/shot?name=dl-surface.json', { method: 'POST', body: b });
  }, out);
}
