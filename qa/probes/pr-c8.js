async page => {
  await page.reload(); await page.waitForTimeout(4500);
  await page.keyboard.press('Digit1'); await page.waitForTimeout(7000);
  const r = await page.evaluate(()=>{
    const g=window.__capy;
    const out={};
    let withMesh=0, inst=0, held=0;
    for(let i=0;i<g.props.length;i++){const p=g.props[i];
      if(p.mesh) withMesh++; if(p.instGroup) inst++; if(p.held) held++;}
    out.props={total:g.props.length, withMesh, inst, held};
    let npcGroup=0;
    for(let i=0;i<g.npcs.length;i++) if(g.npcs[i] && g.npcs[i].group) npcGroup++;
    out.npcs={total:g.npcs.length, withGroup:npcGroup};
    try{
      let best=null,bd=1e9;
      for(let i=0;i<g.props.length;i++){const p=g.props[i];
        if(!p||!p.mesh||p.held) continue;
        const d=p.mesh.position.distanceTo(g.camera.position);
        if(d<bd){bd=d;best=p;}
      }
      out.best = best? {type:best.type, d:+bd.toFixed(1), hasBody:!!best.body} : null;
      const v=new g.THREE.Vector3().copy(best.mesh.position).project(g.camera);
      out.proj=[+v.x.toFixed(3),+v.y.toFixed(3)];
    }catch(e){ out.err=String(e && e.stack || e).slice(0,400); }
    return out;
  });
  await page.evaluate((o)=>fetch('/shot?name=pr-c8.json',{method:'POST',
    body:btoa(unescape(encodeURIComponent(JSON.stringify(o,null,1))))}),r);
}
