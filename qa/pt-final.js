async page => {
  const out={};
  // ---- Iceland: walk off the pier toward the shopfronts, then A/B ----------
  await page.reload(); await page.waitForTimeout(4500);
  await page.keyboard.press('Digit7'); await page.waitForTimeout(7000);
  for(let s=0;s<4;s++){ await page.keyboard.down('KeyW'); await page.waitForTimeout(3000); await page.keyboard.up('KeyW'); await page.waitForTimeout(300); }
  out.iceland = await page.evaluate(()=>{
    const g=window.__capy, gl=g.renderer.getContext();
    const w=gl.drawingBufferWidth,h=gl.drawingBufferHeight;
    const x0=Math.round(w*0.20),ww=Math.round(w*0.60),y0=Math.round(h*0.08),hh=Math.round(h*0.30);
    const A=new Uint8Array(ww*hh*4);
    function band(){ gl.readPixels(x0,y0,ww,hh,gl.RGBA,gl.UNSIGNED_BYTE,A);
      let n=0,s=0,s2=0,clip=0; for(let p=0;p<A.length;p+=4){
        const L=0.2126*A[p]+0.7152*A[p+1]+0.0722*A[p+2]; n++;s+=L;s2+=L*L;
        if(A[p]>250&&A[p+1]>250&&A[p+2]>250)clip++;}
      const m=s/n; return {meanL:+m.toFixed(1), sd:+Math.sqrt(Math.max(0,s2/n-m*m)).toFixed(2), clipPct:+(100*clip/n).toFixed(2)}; }
    g.state.noSpill=false; g.tick(0,true); const on=band();
    g.state.noSpill=true;  g.tick(0,true); const off=band();
    g.state.noSpill=false; g.tick(0,true);
    fetch('/shot?name=pt-ice-on',{method:'POST',body:g.renderer.domElement.toDataURL('image/png')});
    return {biome:g.biome.current, capy:[+g.capy.position.x.toFixed(1),+g.capy.position.z.toFixed(1)], off, on};
  });
  // ---- cost, the rigorous way, in the two heaviest -------------------------
  const cost=[];
  for(const k of [['Minus','kowloon'],['Period','monaco']]){
    await page.reload(); await page.waitForTimeout(4500);
    await page.keyboard.press(k[0]); await page.waitForTimeout(8000);
    cost.push(await page.evaluate((want)=>{
      const g=window.__capy;
      function bench(off){ g.state.noSpill=off;
        for(let i=0;i<30;i++) g.tick(1/60,true);
        const t=performance.now(); for(let i=0;i<150;i++) g.tick(1/60,true);
        return (performance.now()-t)/150; }
      const a=[],b=[]; for(let i=0;i<3;i++){a.push(bench(true));b.push(bench(false));}
      g.state.noSpill=false;
      const med=x=>x.slice().sort((p,q)=>p-q)[1];
      return {want,biome:g.biome.current,offMs:+med(a).toFixed(3),onMs:+med(b).toFixed(3),
              costMs:+(med(b)-med(a)).toFixed(3)};
    },k[1]));
  }
  out.cost=cost;
  // ---- soak ---------------------------------------------------------------
  const soak=[];
  for(const k of [['Minus','kowloon'],['Period','monaco']]){
    await page.reload(); await page.waitForTimeout(4500);
    await page.keyboard.press(k[0]); await page.waitForTimeout(4000);
    for(let s=0;s<6;s++){
      await page.keyboard.down('KeyW'); await page.waitForTimeout(2600); await page.keyboard.up('KeyW');
      await page.keyboard.press('Space'); await page.waitForTimeout(1200);
      await page.keyboard.down('KeyA'); await page.waitForTimeout(2600); await page.keyboard.up('KeyA');
      await page.keyboard.press('KeyQ'); await page.waitForTimeout(1600);
      await page.keyboard.down('KeyD'); await page.waitForTimeout(2000); await page.keyboard.up('KeyD');
    }
    soak.push(await page.evaluate((want)=>{
      const g=window.__capy;
      return {want,biome:g.biome.current,t:+g.state.time.toFixed(1),
              lastError:g.state.lastError?String(g.state.lastError):null};
    },k[1]));
  }
  out.soak=soak;
  await page.evaluate((o)=>fetch('/shot?name=pt-final.json',{method:'POST',
    body:btoa(unescape(encodeURIComponent(JSON.stringify(o,null,1))))}),out);
}
