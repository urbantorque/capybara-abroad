async page => {
  const KEYS=[['Digit1','sydney'],['Digit6','rio'],['Digit0','venice'],['Equal','palawan'],['Digit4','kyoto'],['Slash','hanoi']];
  const out=[];
  for(let i=0;i<KEYS.length;i++){
    await page.reload(); await page.waitForTimeout(4500);
    await page.keyboard.press(KEYS[i][0]); await page.waitForTimeout(7500);
    out.push(await page.evaluate((want)=>{
      const g=window.__capy, gl=g.renderer.getContext();
      const w=gl.drawingBufferWidth,h=gl.drawingBufferHeight;
      const A=new Uint8Array(w*h*4), B=new Uint8Array(w*h*4);
      function shot(buf){ gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,buf);
        let s=0,n=0,clip=0; for(let p=0;p<buf.length;p+=4){
          const L=0.2126*buf[p]+0.7152*buf[p+1]+0.0722*buf[p+2]; s+=L;n++;
          if(buf[p]>250&&buf[p+1]>250&&buf[p+2]>250)clip++; }
        return {mean:s/n, clip:100*clip/n}; }
      g.state.noSpill=false; g.tick(0,true); const on=shot(A);
      g.state.noSpill=true;  g.tick(0,true); const off=shot(B);
      g.state.noSpill=false; g.tick(0,true);
      let moved=0,n=0;
      for(let p=0;p<A.length;p+=4){ n++;
        if(Math.abs(A[p]-B[p])+Math.abs(A[p+1]-B[p+1])+Math.abs(A[p+2]-B[p+2])>6) moved++; }
      return {want, biome:g.biome.current, err:g.state.lastError?String(g.state.lastError):null,
              wholeFrameMeanOff:+off.mean.toFixed(1), wholeFrameMeanOn:+on.mean.toFixed(1),
              clipOff:+off.clip.toFixed(2), clipOn:+on.clip.toFixed(2),
              pixelsChangedPct:+(100*moved/n).toFixed(2)};
    },KEYS[i][1]));
  }
  await page.evaluate((o)=>fetch('/shot?name=pt-reg.json',{method:'POST',
    body:btoa(unescape(encodeURIComponent(JSON.stringify(o,null,1))))}),out);
}
