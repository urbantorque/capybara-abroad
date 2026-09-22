// Actual opening lifecycle with deterministic clock and lens ownership.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const s=readFileSync('src/systems.js','utf8');
const fn=s.match(/  function sysOpeningPlay\(after\) \{[\s\S]*?\n  \}/)[0];
const listeners=new Map(), timers=new Map(); let id=0, calls=0, nap=-1, checks=0;
const classes=new Set(['bare']);
const c={sysOpenFinish:null,sysOpenPending:true,sysOpenT:-1,sysOPEN_HOLD:10,shotReq:null,
  hudRoot:{classList:{toggle:(k,v)=>v?classes.add(k):classes.delete(k),remove:k=>classes.delete(k)}},
  game:{state:{},capy:null,frameShot:o=>c.shotReq=o},sysBagGroup:{visible:true},capyForceNap:n=>nap=n,
  window:{addEventListener:(k,v)=>listeners.set(k,v),removeEventListener:k=>listeners.delete(k)},
  setTimeout:fn=>{timers.set(++id,fn);return id;},clearTimeout:id=>timers.delete(id)};
vm.createContext(c);vm.runInContext(fn,c);
function check(ok,why){assert(ok,why);checks++;}
c.sysOpeningPlay(()=>calls++);
check(nap===1&&c.sysOpenT===10&&timers.size===1,'opening armed');
check(!c.sysOpenPending,'opening clears pending title fade');
check(classes.has('opening-quiet')&&classes.has('bare'),'opening owns a separate paper state');
const stale=timers.values().next().value;
listeners.get('keydown')();
check(nap===-1&&c.sysOpenT===-1&&!c.sysBagGroup.visible,'skip restores pose and hides bag');
check(c.shotReq===null&&!c.sysOpenFinish&&listeners.size===0&&timers.size===0,'skip clears owned lens, timer and listeners');
check(!classes.has('opening-quiet')&&classes.has('bare'),'completion preserves user paper preference');
stale();check(calls===1,'stale callback cannot finish twice');
c.sysOpeningPlay(()=>calls++); const newer={yaw:2};c.shotReq=newer;
timers.values().next().value();check(c.shotReq===newer&&calls===2,'completion preserves newer shot');
c.sysOpeningPlay(()=>calls++);c.sysOpeningPlay(()=>calls++);
check(calls===3&&timers.size===1&&listeners.size===2,'replay replaces prior lifecycle');
listeners.get('pointerdown')();check(calls===4&&timers.size===0,'pointer skip completes replay once');
c.game.state.noOpeningQuiet=true;c.sysOpeningPlay(()=>{});
check(!classes.has('opening-quiet'),'cut preserves inherited paper');listeners.get('keydown')();
check(s.includes('(sysOpenT < 0 || game.state.noOpeningQuiet)'), 'guided walk waits for the quiet opening');
const delayed=s.match(/\/\/ The title fade is not ownership[\s\S]*?\n      \}, 700\);/)[0].replace(/\n      \}, 700\);$/, '');
for(const blocked of ['none','stopped','paused','crossing','abroad']){
  let played=0;
  const d={sysOpenPending:true,started:blocked!=='stopped',transBusy:blocked==='crossing',
    game:{state:{paused:blocked==='paused'},biome:{current:blocked==='abroad'?'quay':'sydney'}},
    sysOpeningPlay:()=>played++};
  vm.runInNewContext('(function(){'+delayed+'})()',d);
  check(!d.sysOpenPending&&played===(blocked==='none'?1:0),'delayed opening ownership '+blocked);
}
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
