async page => {
  await page.reload(); await page.waitForTimeout(4500);
  await page.keyboard.press('Digit1'); await page.waitForTimeout(7000);
  await page.keyboard.down('KeyW');
  const walk = await page.evaluate(()=>{
    const g=window.__capy, gl=g.renderer.getContext();
    const w=gl.drawingBufferWidth,h=gl.drawingBufferHeight;
    const x0=Math.round(w*0.12),ww=Math.round(w*0.76),y0=Math.round(h*0.04),hh=Math.round(h*0.42);
    const A=new Uint8Array(ww*hh*4), B=new Uint8Array(ww*hh*4);
    const series=[];
    for(let f=0; f<110; f++){
      g.state.noContact=false; g.tick(1/60,true); gl.readPixels(x0,y0,ww,hh,gl.RGBA,gl.UNSIGNED_BYTE,A);
      g.state.noContact=true;  g.tick(0,true);   gl.readPixels(x0,y0,ww,hh,gl.RGBA,gl.UNSIGNED_BYTE,B);
      g.state.noContact=false;
      let s=0;
      for(let p=0;p<A.length;p+=4){
        const d=(0.2126*B[p]+0.7152*B[p+1]+0.0722*B[p+2])-(0.2126*A[p]+0.7152*A[p+1]+0.0722*A[p+2]);
        if(d>1.5) s+=d;
      }
      series.push(Math.round(s/1000));
    }
    // biggest single-frame jump as a fraction of the running level
    let worst=0, at=-1;
    for(let i=6;i<series.length;i++){
      const base=Math.max(20,(series[i-1]+series[i-2]+series[i-3])/3);
      const j=Math.abs(series[i]-series[i-1])/base;
      if(j>worst){worst=j;at=i;}
    }
    return { n:series.length, worstJumpPct:+(100*worst).toFixed(1), atFrame:at,
             min:Math.min.apply(null,series), max:Math.max.apply(null,series),
             head:series.slice(0,12), tail:series.slice(-12) };
  });
  await page.keyboard.up('KeyW');
  const gate = await page.evaluate(()=>{
    const g=window.__capy, gl=g.renderer.getContext();
    const w=gl.drawingBufferWidth,h=gl.drawingBufferHeight;
    const x0=Math.round(w*0.12),ww=Math.round(w*0.76),y0=Math.round(h*0.04),hh=Math.round(h*0.42);
    const A=new Uint8Array(ww*hh*4), B=new Uint8Array(ww*hh*4);
    function darken(){
      g.state.noContact=false; g.tick(0,true); gl.readPixels(x0,y0,ww,hh,gl.RGBA,gl.UNSIGNED_BYTE,A);
      g.state.noContact=true;  g.tick(0,true); gl.readPixels(x0,y0,ww,hh,gl.RGBA,gl.UNSIGNED_BYTE,B);
      g.state.noContact=false;
      let s=0,n=0;
      for(let p=0;p<A.length;p+=4){
        const d=(0.2126*B[p]+0.7152*B[p+1]+0.0722*B[p+2])-(0.2126*A[p]+0.7152*A[p+1]+0.0722*A[p+2]);
        if(d>1.5){s+=d;n++;}
      }
      return {sum:Math.round(s/1000), px:n};
    }
    const out={};
    out.onGround = darken();
    // THE VERTICAL GATE. Lift the animal — a real contributor, a real slot —
    // and the ground under it must stop darkening.
    const y0b = g.capy.body.position.y;
    for (const lift of [0.6, 1.2, 3.0]) {
      g.capy.body.position.y = y0b + lift;
      g.capy.body.velocity.set(0,0,0);
      g.tick(0,true);
      out['lift' + lift] = darken();
    }
    g.capy.body.position.y = y0b;
    g.tick(0,true);
    return out;
  });
  await page.evaluate((o)=>fetch('/shot?name=pr-c5.json',{method:'POST',
    body:btoa(unescape(encodeURIComponent(JSON.stringify(o,null,1))))}),{walk,gate});
}
