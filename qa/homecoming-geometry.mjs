// Separate CPU geometry creation from first-use GPU residency across revisits.
// The inventory excludes private post/shadow internals; counts are not bytes.
import assert from 'node:assert/strict';
import { openHarness, CHAPTERS } from './reimagine-harness.mjs';
const tag=process.argv[2]||'v1';assert.match(tag,/^[\w-]+$/);
const h=await openHarness({pinRung:false});
const report={metadata:h.metadata,rows:[],registry:[],scope:'Real Free Roam menu, public arrival fixtures and trusted movement. Active scene plus retained chapter objects; private render internals excluded. No forced GC or game/save writes.'};
const known=new Map();let previous=new Set();
async function sample(label){
  const state=await h.page.evaluate(chapters=>{
    const g=window.__capy,inventory=new Map();
    function scan(root,owner){
      root?.traverse?.(o=>{
        const geo=o.geometry;if(!geo||inventory.has(geo.uuid))return;
        inventory.set(geo.uuid,{id:geo.uuid,type:geo.type,owner,name:o.name||o.parent?.name||'',
          vertices:geo.attributes.position?.count||0});
      });
    }
    for(const chapter of chapters)for(const root of g.biome.objectsOf(chapter)||[])scan(root,chapter);
    scan(g.scene,'global');
    return {chapter:g.biome.current,inventory:[...inventory.values()],resident:{...g.renderer.info.memory},
      programs:g.renderer.info.programs.length,focused:document.hasFocus(),hidden:document.hidden,
      error:g.state.lastError,finite:g.capy.position.toArray().every(Number.isFinite)};
  },CHAPTERS);
  assert(state.focused&&!state.hidden&&state.finite&&!state.error);assert.deepEqual(h.metadata.errors,[]);
  const current=new Set(state.inventory.map(x=>x.id));
  const added=state.inventory.filter(x=>!known.has(x.id));
  for(const item of added){known.set(item.id,item);report.registry.push(item);}
  const row={label,...state,newGeometry:added.map(x=>x.id),removed:[...previous].filter(id=>!current.has(id)),
    retainedByOwner:Object.fromEntries(CHAPTERS.concat('global').map(owner=>[owner,state.inventory.filter(x=>x.owner===owner).length]))};
  delete row.inventory;row.retainedGeometry=current.size;report.rows.push(row);previous=current;
  await h.result('homecoming-geometry-'+tag,report);
  console.log(JSON.stringify({label,chapter:row.chapter,resident:row.resident.geometries,retained:current.size,newGeometry:added.length,removed:row.removed.length}));
}
try{
  await h.start();
  for(const [i,chapter] of ['sydney','hanoi','monaco','sydney','hanoi','monaco','sydney'].entries()){
    await h.arrive(chapter);await sample(i+'-'+chapter+'-arrival');
    for(const key of ['w','d','s','a'])await h.hold(key,7500);
    await sample(i+'-'+chapter+'-moved');
  }
  report.pass=true;
}catch(e){report.failure=String(e.stack||e);process.exitCode=1;}
finally{await h.result('homecoming-geometry-'+tag,report);await h.close();}
