async page => {
  const out = await page.evaluate(() => {
    const g = window.__capy, o = {};
    g.biome.switchTo('kowloon');
    const b = g.capy.body, sp = g.biome.spawnOf('kowloon'), inp = g.input;
    b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    for (let i=0;i<120;i++) { inp.x=0;inp.z=0;inp.action=false; g.tick(1/60,false); }
    const L = (typeof g.locals === 'function' ? g.locals() : g.locals) || [];
    const mine = L.filter(l => !l.biome || l.biome === 'kowloon');
    o.nLocals = mine.length;
    o.locals = mine.map(l => ({ x:+(l.x||0).toFixed(1), y:+(l.y||0).toFixed(1), z:+(l.z||0).toFixed(1) }));
    const pairs = [];
    for (let i=0;i<mine.length;i++) for (let j=i+1;j<mine.length;j++) {
      const d = Math.hypot(mine[i].x-mine[j].x, mine[i].z-mine[j].z);
      if (d <= 13) pairs.push([i,j,+d.toFixed(1)]);
    }
    o.pairsWithin13 = pairs;
    // soak: watch chatT go positive
    let chats = 0, seen = new Set();
    for (let s=0;s<60*150;s++) {
      inp.x=0;inp.z=0;inp.action=false; g.tick(1/60,false);
      for (let i=0;i<mine.length;i++) if (mine[i].chatT > 4.9) { const k=i+':'+Math.round(s/60); if(!seen.has(k)){seen.add(k);chats++;} }
    }
    o.chatEvents150s = chats;
    o.said = mine.map(l => l.said || l.line || null).slice(0,10);
    return o;
  });
  await page.evaluate(async (d) => {
    await fetch('/shot?name=b3hkD.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(d)))) });
  }, out);
}
