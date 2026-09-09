async page => {
  const KEYS = [['Digit1','sydney'],['Digit6','rio'],['Period','monaco'],['Equal','palawan']];
  const out = [];
  for (let i=0;i<KEYS.length;i++){
    await page.reload(); await page.waitForTimeout(4500);
    await page.keyboard.press(KEYS[i][0]); await page.waitForTimeout(7000);
    const r = await page.evaluate((want)=>{
      const g=window.__capy;
      g.tick(1/60,true);
      const url = g.renderer.domElement.toDataURL('image/png');
      fetch('/shot?name=pr-c1-'+want,{method:'POST',body:url});
      const gl=g.renderer.getContext();
      const w=gl.drawingBufferWidth,h=gl.drawingBufferHeight;
      const x0=Math.round(w*0.20),ww=Math.round(w*0.60),y0=Math.round(h*0.08),hh=Math.round(h*0.30);
      const buf=new Uint8Array(ww*hh*4);
      g.tick(1/60,true); gl.readPixels(x0,y0,ww,hh,gl.RGBA,gl.UNSIGNED_BYTE,buf);
      let n=0,s=0,s2=0; const bk=new Set();
      for(let p=0;p<buf.length;p+=4){const R=buf[p],G=buf[p+1],B=buf[p+2];
        const L=0.2126*R+0.7152*G+0.0722*B; n++; s+=L; s2+=L*L;
        bk.add(((R>>3)<<10)|((G>>3)<<5)|(B>>3));}
      const mean=s/n;
      const t0=performance.now(); for(let k=0;k<30;k++) g.tick(1/60,true);
      return {want,biome:g.biome&&g.biome.current,err:g.state&&g.state.lastError?String(g.state.lastError):null,
        meanL:+mean.toFixed(1),sd:+Math.sqrt(Math.max(0,s2/n-mean*mean)).toFixed(2),cols:bk.size,
        ms:+((performance.now()-t0)/30).toFixed(2)};
    },KEYS[i][1]);
    out.push(r);
  }
  await page.evaluate((o)=>fetch('/shot?name=pr-c1.json',{method:'POST',
    body:btoa(unescape(encodeURIComponent(JSON.stringify(o,null,1))))}),out);
}
