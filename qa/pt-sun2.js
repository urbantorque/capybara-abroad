async page => {
  const KEYS=[['Digit6','rio'],['Equal','palawan'],['Digit4','kyoto'],['Minus','kowloon'],['Digit0','venice']];
  const out=[];
  for(let i=0;i<KEYS.length;i++){
    await page.reload(); await page.waitForTimeout(4500);
    await page.keyboard.press(KEYS[i][0]); await page.waitForTimeout(7500);
    out.push(await page.evaluate((want)=>{
      const g=window.__capy, gl=g.renderer.getContext();
      const w=gl.drawingBufferWidth,h=gl.drawingBufferHeight;
      const x0=0,ww=w,y0=Math.round(h*0.70),hh=Math.round(h*0.30);
      const A=new Uint8Array(ww*hh*4), B=new Uint8Array(ww*hh*4);
      function band(buf){ gl.readPixels(x0,y0,ww,hh,gl.RGBA,gl.UNSIGNED_BYTE,buf);
        let n=0,s=0,s2=0,clip=0; const bk=new Set();
        for(let p=0;p<buf.length;p+=4){const R=buf[p],G=buf[p+1],Bl=buf[p+2];
          const L=0.2126*R+0.7152*G+0.0722*Bl; n++;s+=L;s2+=L*L;
          bk.add(((R>>3)<<10)|((G>>3)<<5)|(Bl>>3)); if(R>250&&G>250&&Bl>250)clip++;}
        const m=s/n; return {meanL:+m.toFixed(1), sd:+Math.sqrt(Math.max(0,s2/n-m*m)).toFixed(2),
                             cols:bk.size, clipPct:+(100*clip/n).toFixed(2)}; }
      // the dome repaints on change, so each arm needs two ticks: one to notice
      // and repaint, one to draw what was painted.
      g.state.noSun=false; g.tick(1/60,true); g.tick(0,true); const on=band(A);
      g.state.noSun=true;  g.tick(1/60,true); g.tick(0,true); const off=band(B);
      g.state.noSun=false; g.tick(1/60,true); g.tick(0,true);
      let moved=0,n=0;
      for(let p=0;p<A.length;p+=4){ n++;
        if(Math.abs(A[p]-B[p])+Math.abs(A[p+1]-B[p+1])+Math.abs(A[p+2]-B[p+2])>4) moved++; }
      const sun=g.scene.children.filter(o=>o.isDirectionalLight)[0];
      return {want,biome:g.biome.current,err:g.state.lastError?String(g.state.lastError):null,
              ownSky:!g.scene.children.some(o=>o.renderOrder===-20&&o.visible),
              sunInt:+sun.intensity.toFixed(2), off, on,
              skyPixelsChangedPct:+(100*moved/n).toFixed(2)};
    },KEYS[i][1]));
  }
  await page.evaluate((o)=>fetch('/shot?name=pt-sun2.json',{method:'POST',
    body:btoa(unescape(encodeURIComponent(JSON.stringify(o,null,1))))}),out);
}
