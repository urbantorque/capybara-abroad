async page => {
  const KEYS=[['Equal','palawan'],['Digit4','kyoto'],['Digit2','pasto']];
  const out=[];
  for(let i=0;i<KEYS.length;i++){
    await page.reload(); await page.waitForTimeout(4500);
    await page.keyboard.press(KEYS[i][0]); await page.waitForTimeout(7000);
    const r=await page.evaluate((want)=>{
      const g=window.__capy, gl=g.renderer.getContext();
      const w=gl.drawingBufferWidth,h=gl.drawingBufferHeight;
      const A=new Uint8Array(w*h*4), B=new Uint8Array(w*h*4);
      const gu=g.weather?g.weather.gust():null;
      const mag=gu?Math.hypot(gu.x,gu.z):0;
      // A: the world as it is. B: the SAME frame with the wind vector zeroed,
      // which is the only input sway() has. dt = 0 throughout, so nothing else
      // in the world can move between them.
      g.tick(0,true); gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,A);
      const sx=gu?gu.x:0, sz=gu?gu.z:0;
      if(gu){gu.x=0;gu.z=0;}
      g.tick(0,true); gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,B);
      if(gu){gu.x=sx;gu.z=sz;}
      g.tick(0,true);
      let moved=0,n=0,sum=0;
      const rows=new Array(10).fill(0);
      for(let y=0;y<h;y++) for(let x=0;x<w;x++){
        const p=(y*w+x)*4;
        const d=Math.abs(A[p]-B[p])+Math.abs(A[p+1]-B[p+1])+Math.abs(A[p+2]-B[p+2]);
        n++; if(d>8){moved++;sum+=d;rows[Math.min(9,Math.floor(y/h*10))]++;}
      }
      return {want,biome:g.biome.current,err:g.state.lastError?String(g.state.lastError):null,
              gustMag:+mag.toFixed(2), swayK:+(Math.min(mag/3.5,1.4)).toFixed(2),
              movedPct:+(100*moved/n).toFixed(3),
              rowsBottomToTop:rows.map(v=>Math.round(v/100))};
    },KEYS[i][1]);
    out.push(r);
  }
  await page.evaluate((o)=>fetch('/shot?name=pr-s4.json',{method:'POST',
    body:btoa(unescape(encodeURIComponent(JSON.stringify(o,null,1))))}),out);
}
