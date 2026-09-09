async page => {
  const KEYS=[['Digit1','sydney'],['Digit6','rio'],['Equal','palawan'],['Minus','kowloon'],['Digit0','venice']];
  const out=[];
  for(let i=0;i<KEYS.length;i++){
    await page.reload(); await page.waitForTimeout(4500);
    await page.keyboard.press(KEYS[i][0]); await page.waitForTimeout(7500);
    out.push(await page.evaluate((want)=>{
      const g=window.__capy, gl=g.renderer.getContext();
      const w=gl.drawingBufferWidth,h=gl.drawingBufferHeight;
      // the SKY band: top quarter, full width
      const x0=0,ww=w,y0=Math.round(h*0.74),hh=Math.round(h*0.26);
      const A=new Uint8Array(ww*hh*4);
      gl.readPixels(x0,y0,ww,hh,gl.RGBA,gl.UNSIGNED_BYTE,A);
      let n=0,s=0,s2=0,clip=0,hot=0; const bk=new Set();
      for(let p=0;p<A.length;p+=4){const R=A[p],G=A[p+1],B=A[p+2];
        const L=0.2126*R+0.7152*G+0.0722*B; n++;s+=L;s2+=L*L;
        bk.add(((R>>3)<<10)|((G>>3)<<5)|(B>>3));
        if(R>250&&G>250&&B>250)clip++; if(L>235)hot++;}
      const m=s/n;
      return {want,biome:g.biome.current,err:g.state.lastError?String(g.state.lastError):null,
        sunInt:+g.scene.children.filter(o=>o.isDirectionalLight).map(o=>o.intensity)[0]?.toFixed(2),
        skyMean:+m.toFixed(1), skySD:+Math.sqrt(Math.max(0,s2/n-m*m)).toFixed(2),
        skyCols:bk.size, clipPct:+(100*clip/n).toFixed(2), hotPct:+(100*hot/n).toFixed(2)};
    },KEYS[i][1]));
  }
  await page.evaluate((o)=>fetch('/shot?name=pt-sun.json',{method:'POST',
    body:btoa(unescape(encodeURIComponent(JSON.stringify(o,null,1))))}),out);
}
