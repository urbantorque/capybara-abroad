async page => {
  await page.reload(); await page.waitForTimeout(4500);
  await page.keyboard.press('Digit5'); await page.waitForTimeout(7000);
  const r = await page.evaluate(()=>{
    const g=window.__capy;
    const rc=new g.THREE.Raycaster();
    const down=new g.THREE.Vector3(0,-1,0);
    const org=new g.THREE.Vector3();
    const pts=[[-16,-19],[-16,-26],[-30,-20],[-40,-24],[0,-20],[10,-22],[-16,-15],[-16,-32]];
    const rows=pts.map(p=>{
      org.set(p[0],30,p[1]); rc.set(org,down);
      const hits=rc.intersectObject(g.scene,true).filter(h=>h.object.visible);
      const h=hits[0];
      return {xz:p, y:h?+h.point.y.toFixed(3):null,
              name:h?(h.object.name||h.object.type):null,
              verts:h&&h.object.geometry?h.object.geometry.attributes.position.count:null,
              inst:h?!!h.object.isInstancedMesh:null};
    });
    return {rows, terrainAt:[-16,-19, +g.cali.terrainHeight(-16,-19).toFixed(3)]};
  });
  await page.evaluate((o)=>fetch('/shot?name=pt-cali2.json',{method:'POST',
    body:btoa(unescape(encodeURIComponent(JSON.stringify(o))))}),r);
}
