// Isolated replay of the shipped fuzz stimulus, with peak/contact telemetry.
// This retains its synthetic keys, spawn placement and recovery fixtures.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { openHarness, CHAPTERS } from './reimagine-harness.mjs';
const chapter=process.argv[2]||'rio',tag=process.argv[3]||'v1';
assert.ok(CHAPTERS.includes(chapter));assert.match(tag,/^[\w.-]+$/);
const name='reimagine-speed-'+chapter+'-'+tag;
const original=readFileSync(new URL('./fuzz.js',import.meta.url),'utf8');
let code=original;
function replace(pattern,replacement){
  const all=new RegExp(pattern.source,pattern.flags.includes('g')?pattern.flags:pattern.flags+'g');
  assert.equal([...code.matchAll(all)].length,1,
    'one actual fuzz instrumentation site: '+pattern);
  code=code.replace(pattern,replacement);
}
replace(/const sysFUZZ_SEC = 8;/,'const sysFUZZ_SEC = 45;');
replace(/const names = \[[^]*?\];/,'const names = '+JSON.stringify([chapter])+';');
replace(/let nanFrames = 0,/,'const speedTrace = [], speedRing = []; let speedPeak = 0, groundPeak = 0, airPeak = 0, carriedSamples = 0; let nanFrames = 0,');
replace(/const spd = Math\.hypot\(v\.x, v\.y, v\.z\); if \(spd > maxSpeed\) maxSpeed = spd;/,`
        const spd = Math.hypot(v.x, v.y, v.z); if (spd > maxSpeed) maxSpeed = spd;
        if(g.capy.grounded)groundPeak=Math.max(groundPeak,spd);else airPeak=Math.max(airPeak,spd);
        if(g.capy.carriedBy)carriedSamples++;
        const sample = { t:g.state.time, wall:performance.now()-t0, dt:g.state.rawDt,
          p:p.toArray(), body:cb.position.toArray(), v:v.toArray(), speed:spd,
          keys:[...held], grounded:!!g.capy.grounded, swimming:!!g.capy.swimming,
          carried:!!g.capy.carriedBy, impulse:g.capy.impulseSrc||null, impulseT:g.capy.impulseT,
          frame:[g.capy.frameVX,g.capy.frameVZ], ride:g.capy.rideBody?.id,
          bird:g.condor&&{active:g.condor.active,mounted:g.condor.mounted,state:g.condor.state,
            id:g.condor.body?.id,p:g.condor.body?.position.toArray(),v:g.condor.body?.velocity.toArray(),
            angular:g.condor.body?.angularVelocity.toArray()},
          rung:g.state.perfRung, terrain:terr, input:{x:g.input.x,z:g.input.z,run:g.input.run,jump:g.input.jump,action:g.input.action} };
        speedRing.push(sample); if(speedRing.length>60)speedRing.shift();
        if(spd>20&&spd>speedPeak+.5){
          speedPeak=spd;
          const contacts=[];
          for(const c of g.world.contacts||[]){const other=c.bi===cb?c.bj:c.bj===cb?c.bi:null;if(!other)continue;
            contacts.push({id:other.id,capyIsBi:c.bi===cb,mass:other.mass,type:other.type,p:other.position.toArray(),
              v:other.velocity.toArray(),normal:c.ni.toArray(),enabled:c.enabled});}
          speedTrace.push({peak:sample,contacts,before:speedRing.slice()});
        }
`);
replace(/biome: g\.biome\.current, started: g\.state\.started,/,'biome: g.biome.current, started: g.state.started, speedTrace, groundPeak, airPeak, carriedSamples,');
replace(/\/shot\?name=fuzz\.json/,'/shot?name='+name+'.json');
const probe=new Function('return ('+code+'\n);')();
if(process.argv.includes('--prepare')){console.log('Actual fuzz instrumentation sites and generated syntax pass.');process.exit(0);}
const h=await openHarness({pinRung:false});
try{
  await probe(h.page);
}finally{
  try{await h.result(name+'-metadata',{metadata:h.metadata,
    originalFuzzSha256:createHash('sha256').update(original).digest('hex'),chapter,
    scope:'Isolated 45-second shipped fuzz stimulus plus rolling peak/contact telemetry. Synthetic input and original spawn/recovery writes remain. Not natural play or a frame-time benchmark; isolated timing/state differs from the full 19-place sequence.'});
  }finally{await h.close();}
}
