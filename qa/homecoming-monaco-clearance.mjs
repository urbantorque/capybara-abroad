// Read the shipped footprints and road, not a separately maintained map.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
const baseline=process.argv.includes('--baseline');
const source=baseline?execFileSync('git',['show','50083ad:src/monaco.js'],{encoding:'utf8'}):readFileSync('src/monaco.js','utf8');
const array=name=>vm.runInNewContext(source.match(new RegExp('const '+name+' = (\\[[\\s\\S]*?\\n\\]);'))[1]);
const town=array('monTOWN'),track=array('monTRACK');
const half=Number(source.match(/const monTRACK_HALF\s*=\s*([\d.]+)/)?.[1]);assert(half>0);
function intersects(row,a,b,pad){
  const c=Math.cos(row[5]),s=Math.sin(row[5]);
  const local=p=>[(p[0]-row[0])*c-(p[1]-row[1])*s,(p[0]-row[0])*s+(p[1]-row[1])*c];
  const p=local(a),q=local(b),extent=[row[2]/2+pad,row[3]/2+pad];let lo=0,hi=1;
  for(let axis=0;axis<2;axis++){
    const d=q[axis]-p[axis];
    if(Math.abs(d)<1e-9){if(Math.abs(p[axis])>extent[axis])return false;continue;}
    const t1=(-extent[axis]-p[axis])/d,t2=(extent[axis]-p[axis])/d;
    lo=Math.max(lo,Math.min(t1,t2));hi=Math.min(hi,Math.max(t1,t2));if(lo>hi)return false;
  }return true;
}
const clashes=town.map((row,i)=>({i,x:row[0],z:row[1],segments:track.flatMap((a,j)=>
  intersects(row,a,track[(j+1)%track.length],half+.25)?[j]:[])})).filter(row=>row.segments.length);
const helper=source.match(/function monTownRoadClear\(t\) \{[\s\S]*?\n\}/)?.[0];
assert(baseline||helper,'shipped footprint guard exists');
const drawn=[],collided=[],meshes=[];
const ctx=vm.createContext({monTOWN:town,monTRACK:track,monTRACK_HALF:half,
  monMerger:()=>({build:()=>({})}),monPoolBody:()=>({}),monTerrain:()=>0,monVCF:()=>({}),
  monBlockOf:(k,...row)=>drawn.push(row),monPoolBox:(body,...row)=>collided.push(row),monPoolDone:()=>{},
  THREE:{Mesh:class {constructor(geometry,material){this.geometry=geometry;this.material=material;}}}});
vm.runInContext((helper||'')+'\n'+source.match(/function monBuildTown\(game, root\) \{[\s\S]*?\n\}/)[0],ctx);
ctx.monBuildTown({}, {add:mesh=>meshes.push(mesh)});
assert.equal(town.length,45,'authored table retained');
assert.equal(clashes.length,11,'measured road conflicts');
const blocked=new Set(clashes.map(row=>row.i)),clear=town.filter((_,i)=>!blocked.has(i));
assert.equal(drawn.length,clear.length,'no drawn building occupies reserved road');
assert.equal(collided.length,clear.length,'collision follows the same selection');
for(let i=0;i<clear.length;i++){
  assert.deepEqual(drawn[i],Array.from(clear[i]));
  const [x,z,w,d,h,yaw]=clear[i];
  assert.deepEqual(collided[i],[x,h*.5,z,w,h+2.4,d,yaw]);
}
assert.equal(meshes.length,1,'town keeps one merged draw');
for(let i=0;i<town.length;i++)assert.equal(ctx.monTownRoadClear(town[i]),!blocked.has(i));
for(const yaw of [0,.3,Math.PI/2,Math.PI]){
  assert.equal(ctx.monTownRoadClear([600,600,16,13,20,yaw,'pale']),true,'distant footprint retained');
  for(const p of track)assert.equal(ctx.monTownRoadClear([p[0],p[1],2,2,5,yaw,'pale']),false,'road node stays clear');
}
console.log(JSON.stringify({pass:true,authored:town.length,retained:drawn.length,removed:clashes.length,mergedDraws:meshes.length}));
