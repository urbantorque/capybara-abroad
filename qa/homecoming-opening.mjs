// Actual opening lifecycle with deterministic clock and lens ownership.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const s=readFileSync('src/systems.js','utf8');
const fn=s.match(/  function sysOpeningPlay\(after\) \{[\s\S]*?\n  \}/)[0];
const listeners=new Map(), timers=new Map(); let id=0, calls=0, nap=-1, checks=0;
const c={sysOpenFinish:null,sysOpenT:-1,sysOPEN_HOLD:10,shotReq:null,
  game:{capy:null,frameShot:o=>c.shotReq=o},sysBagGroup:{visible:true},capyForceNap:n=>nap=n,
  window:{addEventListener:(k,v)=>listeners.set(k,v),removeEventListener:k=>listeners.delete(k)},
  setTimeout:fn=>{timers.set(++id,fn);return id;},clearTimeout:id=>timers.delete(id)};
vm.createContext(c);vm.runInContext(fn,c);
function check(ok,why){assert(ok,why);checks++;}
c.sysOpeningPlay(()=>calls++);
check(nap===1&&c.sysOpenT===10&&timers.size===1,'opening armed');
const stale=timers.values().next().value;
listeners.get('keydown')();
check(nap===-1&&c.sysOpenT===-1&&!c.sysBagGroup.visible,'skip restores pose and hides bag');
check(c.shotReq===null&&!c.sysOpenFinish&&listeners.size===0&&timers.size===0,'skip clears owned lens, timer and listeners');
stale();check(calls===1,'stale callback cannot finish twice');
c.sysOpeningPlay(()=>calls++); const newer={yaw:2};c.shotReq=newer;
timers.values().next().value();check(c.shotReq===newer&&calls===2,'completion preserves newer shot');
c.sysOpeningPlay(()=>calls++);c.sysOpeningPlay(()=>calls++);
check(calls===3&&timers.size===1&&listeners.size===2,'replay replaces prior lifecycle');
listeners.get('pointerdown')();check(calls===4&&timers.size===0,'pointer skip completes replay once');
const interrupt=s.match(/    if \(sysOpenFinish && \(ix \|\| iz[\s\S]*?\)\) sysOpenFinish\(\);/)[0];
for(const field of ['ix','iz','runHeld','honk','action','jump','slideHeld','camHandT','paused','transBusy','abroad','none']) {
  let skipped=0;
  const t={sysOpenFinish:()=>skipped++,ix:0,iz:0,runHeld:false,input:{},slideHeld:false,camHandT:0,transBusy:false,game:{state:{paused:false},biome:{current:'sydney'}}};
  if(['honk','action','jump'].includes(field))t.input[field]=true;
  else if(field==='paused')t.game.state.paused=true;
  else if(field==='abroad')t.game.biome.current='quay';
  else if(field!=='none')t[field]=1;
  vm.runInNewContext(interrupt,t);check(skipped===(field==='none'?0:1),'interruption '+field);
}
console.log(`${checks} opening lifecycle checks pass`);
