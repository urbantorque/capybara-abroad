async page => {
  const out=[];
  for(let rep=0; rep<3; rep++){
    await page.reload(); await page.waitForTimeout(4500);
    await page.keyboard.press('Minus'); await page.waitForTimeout(8000);
    const r=await page.evaluate((rp)=>{
      const g=window.__capy;
      function bench(off){ g.state.noSpill=off;
        for(let k=0;k<30;k++) g.tick(1/60,true);
        const t=performance.now(); for(let k=0;k<150;k++) g.tick(1/60,true);
        return (performance.now()-t)/150; }
      const a=[],b=[];
      for(let i=0;i<3;i++){ a.push(bench(true)); b.push(bench(false)); }
      g.state.noSpill=false;
      const med=x=>x.slice().sort((p,q)=>p-q)[1];
      return {rep:rp, biome:g.biome.current,
        offMs:+med(a).toFixed(3), onMs:+med(b).toFixed(3),
        costMs:+(med(b)-med(a)).toFixed(3),
        off:a.map(v=>+v.toFixed(2)), on:b.map(v=>+v.toFixed(2))};
    },rep);
    out.push(r);
  }
  await page.evaluate((o)=>fetch('/shot?name=pt-cost.json',{method:'POST',
    body:btoa(unescape(encodeURIComponent(JSON.stringify(o,null,1))))}),out);
}
