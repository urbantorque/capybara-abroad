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
      // ONLY the sway clock advances. dt = 0, so the camera, the cast, the
      // props and the physics are all frozen; anything that differs between
      // these two frames is a vertex that moved.
      g.tick(0,true); gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,A);
      const t0=g.state.time; g.state.time = t0 + 1.10;
      g.tick(0,true); gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,B);
      g.state.time = t0;
      let moved=0, n=0;
      const rows=new Array(10).fill(0);
      for(let y=0;y<h;y++) for(let x=0;x<w;x++){
        const p=(y*w+x)*4;
        const d=Math.abs(A[p]-B[p])+Math.abs(A[p+1]-B[p+1])+Math.abs(A[p+2]-B[p+2]);
        n++; if(d>8){moved++; rows[Math.min(9,Math.floor(y/h*10))]++;}
      }
      const gu=g.weather?g.weather.gust():null;
      return {want, biome:g.biome.current, err:g.state.lastError?String(g.state.lastError):null,
              gustMag: gu?+Math.hypot(gu.x,gu.z).toFixed(2):null,
              movedPct:+(100*moved/n).toFixed(3),
              rowsBottomToTop: rows.map(v=>Math.round(v/1000))};
    },KEYS[i][1]);
    out.push(r);
  }
  await page.evaluate((o)=>fetch('/shot?name=pr-s3.json',{method:'POST',
    body:btoa(unescape(encodeURIComponent(JSON.stringify(o,null,1))))}),out);
}
