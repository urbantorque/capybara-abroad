async page => {
  const KEYS=[['Minus','kowloon'],['Period','monaco'],['Digit7','iceland'],['Digit1','sydney']];
  const out=[];
  for(let i=0;i<KEYS.length;i++){
    await page.reload(); await page.waitForTimeout(4500);
    await page.keyboard.press(KEYS[i][0]); await page.waitForTimeout(8000);
    const r=await page.evaluate((want)=>{
      const g=window.__capy, gl=g.renderer.getContext();
      const w=gl.drawingBufferWidth,h=gl.drawingBufferHeight;
      const x0=Math.round(w*0.20),ww=Math.round(w*0.60),y0=Math.round(h*0.08),hh=Math.round(h*0.30);
      const A=new Uint8Array(ww*hh*4), B=new Uint8Array(ww*hh*4);
      function band(buf){
        gl.readPixels(x0,y0,ww,hh,gl.RGBA,gl.UNSIGNED_BYTE,buf);
        let n=0,s=0,s2=0,clip=0; const bk=new Set();
        for(let p=0;p<buf.length;p+=4){const R=buf[p],G=buf[p+1],Bl=buf[p+2];
          const L=0.2126*R+0.7152*G+0.0722*Bl; n++;s+=L;s2+=L*L;
          bk.add(((R>>3)<<10)|((G>>3)<<5)|(Bl>>3));
          if(R>250&&G>250&&Bl>250)clip++;}
        const mean=s/n;
        return {meanL:+mean.toFixed(1), sd:+Math.sqrt(Math.max(0,s2/n-mean*mean)).toFixed(2),
                cols:bk.size, clipPct:+(100*clip/n).toFixed(2)};
      }
      g.state.noSpill=false; g.tick(0,true); const on=band(A);
      g.state.noSpill=true;  g.tick(0,true); const off=band(B);
      g.state.noSpill=false; g.tick(0,true);
      function bench(off2){ g.state.noSpill=off2;
        for(let k=0;k<20;k++) g.tick(1/60,true);
        const t=performance.now(); for(let k=0;k<120;k++) g.tick(1/60,true);
        return (performance.now()-t)/120; }
      const a1=bench(true), b1=bench(false), a2=bench(true), b2=bench(false);
      g.state.noSpill=false;
      return {want,biome:g.biome.current,err:g.state.lastError?String(g.state.lastError):null,
        off, on, costMs:+(((b1+b2)-(a1+a2))/2).toFixed(3), onMs:+((b1+b2)/2).toFixed(3)};
    },KEYS[i][1]);
    out.push(r);
  }
  await page.evaluate((o)=>fetch('/shot?name=pt-spill.json',{method:'POST',
    body:btoa(unescape(encodeURIComponent(JSON.stringify(o,null,1))))}),out);
}
