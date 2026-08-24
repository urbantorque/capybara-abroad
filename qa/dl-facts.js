async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5200);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2600);
  const PLAN = {
    pasto:    { zones: ['crater'], pts: ['craterCentre'], clocks: [] },
    quay:     { zones: ['apron','manly'], pts: [], clocks: [] },
    kyoto:    { zones: ['bamboo'], pts: ['heron'], clocks: [] },
    cali:     { zones: ['dancefloor'], pts: ['mirador'], clocks: ['night'] },
    rio:      { zones: [], pts: ['selaron','lapa'], clocks: [] },
    iceland:  { zones: ['spring'], pts: ['fox','spring'], clocks: ['soak'] },
    sahara:   { zones: ['souk'], pts: ['duneTop'], clocks: ['dusk'] },
    drift:    { zones: ['orchard'], pts: ['orchard','lantern'], clocks: ['lit'] },
    venice:   { zones: ['piazza'], pts: ['cafe'], clocks: ['flooded','tide','pigeonsUp'] },
    kowloon:  { zones: ['harbour','market'], pts: [], clocks: ['show'] },
    palawan:  { zones: ['wreck'], pts: ['bangka','wreck'], clocks: [] },
    goreme:   { zones: ['town','landing'], pts: ['balloon','landing'], clocks: ['sunUp','altitude'] },
    manly:    { zones: ['pool','shelly'], pts: ['pool','shelly'], clocks: ['setNear'] },
    pantanal: { zones: ['sandbar','baia'], pts: ['sandbar'], clocks: ['dusk'] },
    cave:     { zones: ['passage'], pts: ['mouth'], clocks: ['daylight'] },
    antarctic:{ zones: ['whalers','colony'], pts: ['whalers','colony'], clocks: [] }
  };
  const out = {};
  for (const name of Object.keys(PLAN)) {
    out[name] = await page.evaluate((arg) => {
      const g = window.__capy;
      const res = { zones: {}, pts: {}, clocks: {} };
      g.biome.switchTo(arg.name);
      for (let i = 0; i < 40; i++) g.tick(1/60, false);
      const a = g[arg.name];
      for (const z of arg.zones) {
        let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9,n=0;
        for (let x=-420;x<=460;x+=4) for (let zz=-760;zz<=260;zz+=4) {
          let v=false; try { v=!!a.inZone(z,x,zz); } catch(e){}
          if (v){n++; if(x<x0)x0=x; if(x>x1)x1=x; if(zz<z0)z0=zz; if(zz>z1)z1=zz;}
        }
        res.zones[z] = n ? {n, x0, x1, z0, z1} : null;
      }
      for (const p of arg.pts) {
        const v = a[p];
        const o = (typeof v === 'function') ? v() : v;
        res.pts[p] = o ? { x: +(+o.x).toFixed(1), y: o.y === undefined ? null : +(+o.y).toFixed(1), z: +(+o.z).toFixed(1) } : null;
      }
      // clocks: min/max over 90 simulated seconds
      const mins = {}, maxs = {};
      for (const c of arg.clocks) { mins[c] = 1e9; maxs[c] = -1e9; }
      for (let i = 0; i < 5400; i++) {
        g.tick(1/60, false);
        if (i % 15) continue;
        for (const c of arg.clocks) {
          let v = 0; try { v = a[c](); } catch (e) { v = NaN; }
          v = (v === true) ? 1 : (v === false ? 0 : v);
          if (v < mins[c]) mins[c] = v; if (v > maxs[c]) maxs[c] = v;
        }
      }
      for (const c of arg.clocks) res.clocks[c] = [ +(+mins[c]).toFixed(2), +(+maxs[c]).toFixed(2) ];
      return res;
    }, { name, ...PLAN[name] });
  }
  await page.evaluate((o) => fetch('/shot?name=dl-facts.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out);
}
