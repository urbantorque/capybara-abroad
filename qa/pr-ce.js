async page => {
  const KEYS=[['Digit1','sydney'],['Digit0','venice'],['Minus','kowloon'],['Slash','hanoi']];
  const out=[];
  for(let i=0;i<KEYS.length;i++){
    await page.reload(); await page.waitForTimeout(4500);
    await page.keyboard.press(KEYS[i][0]); await page.waitForTimeout(7000);
    const r=await page.evaluate((want)=>{
      const g=window.__capy;
      function bench(off){
        g.state.noContact=off;
        for(let k=0;k<20;k++) g.tick(1/60,true);          // warm
        const t=performance.now();
        for(let k=0;k<120;k++) g.tick(1/60,true);
        return (performance.now()-t)/120;
      }
      // interleaved, twice each way, so drift in the machine cannot land on
      // one arm of the comparison
      const a1=bench(true), b1=bench(false), a2=bench(true), b2=bench(false);
      g.state.noContact=false;
      return {want,biome:g.biome.current,
        offMs:+(((a1+a2)/2)).toFixed(3), onMs:+(((b1+b2)/2)).toFixed(3),
        costMs:+((((b1+b2)-(a1+a2))/2)).toFixed(3)};
    },KEYS[i][1]);
    out.push(r);
  }
  await page.evaluate((o)=>fetch('/shot?name=pr-ce.json',{method:'POST',
    body:btoa(unescape(encodeURIComponent(JSON.stringify(o,null,1))))}),out);
}
