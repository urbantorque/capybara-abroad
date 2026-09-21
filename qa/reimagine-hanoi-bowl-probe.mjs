// Read-only collider audit at the actual loose pho bowl, then staged view.
import assert from 'node:assert/strict';
import { openHarness } from './reimagine-harness.mjs';
const tag=process.argv[2]||'v1';assert.match(tag,/^[\w.-]+$/);
const h=await openHarness(),name='reimagine-hanoi-bowl-probe-'+tag;
try{
  await h.start();await h.arrive('hanoi');
  const result=await h.page.evaluate(async()=>{
    const g=window.__capy,C=await import('cannon-es'),actual={...g.hanoi.pho()},inside=[];
    const p={x:actual.x,y:g.hanoi.terrainHeight(actual.x,actual.z)+.55,z:actual.z};
    const point=new C.Vec3(p.x,p.y,p.z),local=new C.Vec3(),v=new C.Vec3(),inverse=new C.Quaternion();
    for(const b of g.world.bodies){if(b.mass!==0)continue;b.pointToLocalFrame(point,local);
      for(let i=0;i<b.shapes.length;i++){const s=b.shapes[i],e=s.halfExtents;if(!e)continue;
        local.vsub(b.shapeOffsets[i],v);b.shapeOrientations[i].conjugate(inverse);inverse.vmult(v,v);
        if(Math.abs(v.x)<e.x&&Math.abs(v.y)<e.y&&Math.abs(v.z)<e.z)
          inside.push({body:b.id,shape:i,bodyPosition:b.position.toArray(),offset:b.shapeOffsets[i].toArray(),halfExtents:e.toArray(),pointInShape:v.toArray()});
      }
    }
    g.tick=()=>{};g.camera.position.set(p.x-9,p.y+5,p.z+8);g.camera.lookAt(p.x,p.y,p.z);g.camera.updateMatrixWorld(true);g.post.render();
    return{bowl:actual,authoredGroundCandidate:p,inside,task:g.taskDone('pho-raid'),chapter:g.biome.current};
  });
  await h.screenshot(name);await h.result(name,{...result,metadata:h.metadata});console.log(JSON.stringify(result,null,2));
  assert.deepEqual(result.inside,[],'authored bowl point is outside all static box colliders');
  assert.deepEqual(h.metadata.errors,[]);
}finally{await h.close();}
