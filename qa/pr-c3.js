async page => {
  const KEYS=[['Digit1','sydney'],['Digit6','rio'],['Digit0','venice'],['Period','monaco']];
  const out=[];
  for(let i=0;i<KEYS.length;i++){
    await page.reload(); await page.waitForTimeout(4500);
    await page.keyboard.press(KEYS[i][0]); await page.waitForTimeout(7000);
    const r = await page.evaluate((want)=>{
      const g=window.__capy, gl=g.renderer.getContext();
      const w=gl.drawingBufferWidth,h=gl.drawingBufferHeight;
      const x0=Math.round(w*0.12),ww=Math.round(w*0.76),y0=Math.round(h*0.04),hh=Math.round(h*0.42);
      const A=new Uint8Array(ww*hh*4), B=new Uint8Array(ww*hh*4);
      // frame with contact ON, then the identical frame with it OFF. The pool
      // is the only thing that changes; nothing else in the world advances.
      g.state.noContact=false; g.tick(0,true); gl.readPixels(x0,y0,ww,hh,gl.RGBA,gl.UNSIGNED_BYTE,A);
      g.state.noContact=true;  g.tick(0,true); gl.readPixels(x0,y0,ww,hh,gl.RGBA,gl.UNSIGNED_BYTE,B);
      g.state.noContact=false;
      let n=0,touched=0,sum=0,mx=0,sumOn=0;
      for(let p=0;p<A.length;p+=4){
        const la=0.2126*A[p]+0.7152*A[p+1]+0.0722*A[p+2];
        const lb=0.2126*B[p]+0.7152*B[p+1]+0.0722*B[p+2];
        const d=lb-la;              // OFF minus ON: contact only ever darkens
        n++; sumOn+=la;
        if(d>1.5){touched++; sum+=d; if(d>mx)mx=d;}
      }
      return {want,biome:g.biome.current,err:g.state.lastError?String(g.state.lastError):null,
        bandMeanL:+(sumOn/n).toFixed(1),
        touchedPct:+(100*touched/n).toFixed(2),
        meanDarkenOfTouched:+(touched?sum/touched:0).toFixed(1),
        maxDarken:Math.round(mx)};
    },KEYS[i][1]);
    out.push(r);
  }
  await page.evaluate((o)=>fetch('/shot?name=pr-c3.json',{method:'POST',
    body:btoa(unescape(encodeURIComponent(JSON.stringify(o,null,1))))}),out);
}
