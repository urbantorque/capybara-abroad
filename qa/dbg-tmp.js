async page => {
  await page.goto('http://localhost:5188/', { waitUntil: 'load' });
  await page.waitForTimeout(5500);
  await page.evaluate(() => {
    const pal={}; for(let n=1;n<=19;n++) pal[n]=3;
    localStorage.setItem('capy3.journey.v1', JSON.stringify({v:1,tasks:['to-pasto'],seen:[1,2],recs:{},ms:600000,chapms:{},finds:[],foundAt:{},inc:{},scn:{},pho:{},fed:{},pas:{},pal:pal,rep:{},biome:'sydney',fin:0,slid:1,slip:1}));
  });
  await page.reload(); await page.waitForTimeout(6500);
  await page.evaluate(()=>{const b=document.querySelector('.capyui-carry'); if(b) b.click();});
  await page.waitForTimeout(3500);
  await page.evaluate(()=>{const g=window.__capy; try{g.hud.cross('venice');}catch(e){g.biome.switchTo('venice');}});
  await page.waitForTimeout(5000);
  const r = await page.evaluate(()=>new Promise(res=>{
    const g=window.__capy; const live=g.biome.current;
    const t0=performance.now(); let snap=null;
    (function step(){
      const a=g.errAudit();
      if(a.on && !snap){
        // find the parcel among all props
        const near=g.props.filter(p=>!p.removed && p.biome===live).map(p=>({
          type:p.type, grab:!!p.grabbable, held:!!p.held, spilled:!!p.spilled,
          planted:!!p.planted, owner:!!p.owner, y:+p.body.position.y.toFixed(2),
          d:+Math.hypot(g.capy.position.x-p.body.position.x, g.capy.position.z-p.body.position.z).toFixed(1)
        })).sort((x,y2)=>x.d-y2.d).slice(0,6);
        snap={audit:a, near:near, ng30:!!g.physics.nearestGrabbable(g.capy.position,30),
              ng3:!!g.physics.nearestGrabbable(g.capy.position,3)};
      }
      if(performance.now()-t0<20000 && !snap) requestAnimationFrame(step);
      else res(snap||{none:true, audit:g.errAudit()});
    })();
  }));
  await page.evaluate(async p=>{await fetch('/shot?name=DBG',{method:'POST',body:btoa(unescape(encodeURIComponent(JSON.stringify(p))))});}, r);
}
