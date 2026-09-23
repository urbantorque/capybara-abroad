// One context, one naturally accumulated save. Public chapter arrivals are
// fixtures; this does not claim natural discovery or use of every travel door.
// --prepare compiles checked adaptations and prints hashes without a browser.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { stripComments } from '../strip-comments.mjs';

const args=process.argv.slice(2),prepare=args.includes('--prepare'),homecoming=args.includes('--homecoming');
const resumeArg=args.find(a=>a.startsWith('--resume='));
const resumeTag=resumeArg?.slice(9);
const resumeGate=args.includes('--resume-gate');
const stopArg=args.find(a=>a.startsWith('--stop-after='));
const stopAfter=stopArg?.slice(13);
if(resumeArg)assert(homecoming&&/^[\w-]+$/.test(resumeTag),'resume requires a safe Homecoming artifact tag');
if(resumeGate)assert(resumeArg,'--resume-gate requires --resume');
if(stopArg)assert(homecoming&&stopAfter==='kyoto','bounded earned-route diagnostic stops only after Kyoto');
const labels=args.filter(a=>a!=='--prepare'&&a!=='--homecoming'&&a!=='--resume-gate'&&a!==resumeArg&&a!==stopArg);
assert.ok(labels.length<=1,'usage: node qa/reimagine-journey-chain.mjs [tag] [--prepare] [--homecoming]');
const tag=labels[0]||'first';assert.match(tag,/^[\w-]+$/);
const prefix=(homecoming?'homecoming':'reimagine')+'-journey-chain-'+tag;
const read=name=>readFileSync(new URL(name,import.meta.url),'utf8');
const hash=text=>createHash('sha256').update(text).digest('hex');
const shared=read('../src/shared.js'),first=shared.indexOf('export const TASKS ='),last=shared.indexOf('// RECORDS —',first);
assert.ok(first>=0&&last>first,'authored route section');
const data=vm.runInNewContext(shared.slice(first,last).replace(/^export /gm,'')+
  '\n({TASKS,CHAPTERS,JOURNEY,CHAPTER_EXPERIENCES,chapterExperience,homecomingMemory,homecomingProgress})');
assert.equal(data.JOURNEY.join(','),'1,3,2,4,12,15,19','checked recommended route');
const routeIds=homecoming?[1,3,2,15,4,19,12,16,18,7]:data.JOURNEY;
const route=routeIds.map(n=>({n,chapter:data.CHAPTERS.find(c=>c.n===n).biome}));
data.earnedRoute=routeIds;
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const parameters=['assert','readFileSync','vm','openHarness','process','sourceUrl','journeyData'];
const allowedImports=new Set(["import assert from 'node:assert/strict';","import { readFileSync } from 'node:fs';",
  "import vm from 'node:vm';","import { openHarness } from './reimagine-harness.mjs';"]);
function compile(name,body,original,imports=[],notes=[]) {
  assert.ok(!/^\s*(?:import|export)\s/m.test(body)&&!body.includes('import.meta.url')&&!/\bimport\s*\(/.test(body),'no remaining module syntax');
  assert.ok(!/localStorage\s*\.\s*(?:clear|setItem|removeItem)|addInitScript/.test(body),'adapter cannot reset or seed save');
  return {name,url:new URL(name,import.meta.url).href,run:new AsyncFunction(...parameters,body),
    manifest:{file:name,sourceSha256:hash(original),adaptedSha256:hash(body),imports,notes}};
}
function adapt(name) {
  const original=read(name),imports=[];
  const body=stripComments(original).replace(/^import[^\r\n]+;\s*$/gm,line=>{
    const trimmed=line.trim();assert.ok(allowedImports.has(trimmed),'review new import in '+name+': '+trimmed);
    imports.push(trimmed);return '';
  }).replaceAll('import.meta.url','sourceUrl');
  assert.ok(imports.includes("import { openHarness } from './reimagine-harness.mjs';"),'driver uses injected harness');
  assert.equal((body.match(/await openHarness\(/g)||[]).length,1,'one injected harness request');
  assert.ok(body.includes('finally')&&body.includes('await h.close()'),'driver has owned close lifecycle');
  return compile(name,body,original,imports,['Only static imports and import.meta.url adapted. All driver assertions and reloads retained.']);
}
const drivers=new Map(route.filter(({chapter})=>!['cave','iceland','monaco'].includes(chapter)).map(({chapter})=>[chapter,adapt(chapter==='pasto'?
  'reimagine-boarding-browser.mjs':'reimagine-natural-'+chapter+'.mjs')]));

// Reuse the tested homecoming movement/rest helpers, never its seeded setup or
// presentation-state fixture. Extraction is checked against named functions.
const homeName='reimagine-homecoming-browser.mjs',homeOriginal=read(homeName),homeClean=stripComments(homeOriginal);
function extractFunction(source,name) {
  const match=source.match(new RegExp('^(?:async )?function '+name+'\\(','m'));
  assert.ok(match,'homecoming helper '+name);const start=match.index,open=source.indexOf('{',start);
  let depth=0,quote='',escaped=false;
  for(let i=open;i<source.length;i++) {
    const c=source[i];
    if(quote){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c===quote)quote='';}
    else if('\'"`'.includes(c))quote=c;
    else if(c==='{')depth++;
    else if(c==='}'&&--depth===0)return source.slice(start,i+1);
  }
  throw Error('unclosed helper '+name);
}
const helpers=['number','setKeys','observeKeys','state','live','sample','go','walkHome','restOnLawn'];
const homeBody=`
const systems=readFileSync(new URL('../src/systems.js',sourceUrl),'utf8');
const capySource=readFileSync(new URL('../src/capybara.js',sourceUrl),'utf8');
${helpers.map(n=>extractFunction(homeClean,n)).join('\n')}
const lawn={x:number('sysFIN_X'),z:number('sysFIN_Z'),radius:number('sysFIN_IN'),
  loaf:number('sysFIN_LOAF'),hold:number('sysFIN_HOLD'),rest:number('capyLOAF_T',capySource)};
const h=await openHarness(),name='homecoming',keys=new Set(),release=()=>setKeys(new Set());
const report={metadata:h.metadata,lawn,steps:[],navigation:[],rest:[],keys:[]};
try {
  await observeKeys();await h.start();await h.arrive('sydney');
  const initial=await sample('cumulative journey returned home');live(initial);
  assert.ok(journeyData.earnedRoute.every(n=>initial.gates.find(g=>g.n===n)?.enough),'all required earned memories reached home');
  assert.equal(initial.saved.fin,0,'ending not previously spent');
  assert.equal(initial.coda.done,false);assert.equal(initial.finaleOn,true);
  await h.screenshot(name+'-arrival');await walkHome();await h.screenshot(name+'-before');
  const rested=await restOnLawn(true,'first earned homecoming');
  assert.equal(rested.coda.done,true,'real loaf spends closing beat');
  await h.page.waitForTimeout(1400);await h.screenshot(name+'-coda');
  let end;const deadline=Date.now()+25000;
  do {end=await state();live(end,true);report.rest.push({label:'coda to ledger',...end});
    if(end.ledger.shown&&end.saved.fin===1)break;await h.page.waitForTimeout(250);
  }while(Date.now()<deadline);
  assert.equal(end.saved.fin,1,'ending persisted by actual writer');
  assert.equal(end.ledger.shown,true);assert.equal(end.ledger.title,'BACK WHERE IT BEGAN');
  assert.equal(end.coda.whole,true);assert.equal(end.coda.notes,20,'whole twenty-note coda');
  assert.ok(end.saved.nb?.fin?.t,'closing notebook persisted');assert.equal(end.gates.every(g=>g.complete),false);
  report.ending=end;await h.page.waitForTimeout(1200);await h.screenshot(name+'-ledger');
  report.keys=await h.page.evaluate(()=>window.__homecomingKeys);
  await h.page.reload();await observeKeys();await h.start();
  const restored=await sample('cumulative completed save restored');live(restored);
  assert.equal(restored.saved.fin,1);assert.equal(restored.coda.done,true);assert.equal(restored.coda.notes,0);
  assert.deepEqual(restored.saved.nb.fin,end.saved.nb.fin,'closing page not awarded on load');
  await walkHome();const again=await restOnLawn(false,'completed journey revisited');
  assert.equal(again.saved.fin,1);assert.equal(again.coda.done,true);
  assert.deepEqual(again.saved.nb.fin,end.saved.nb.fin,'repeat loaf does not rewrite ending');
  report.revisited=again;await h.screenshot(name+'-reload-rest');
  report.keys.push(...await h.page.evaluate(()=>window.__homecomingKeys));
  assert.ok(report.keys.some(k=>['KeyW','KeyA','KeyS','KeyD'].includes(k.key))&&report.keys.every(k=>k.trusted));
  assert.deepEqual(h.metadata.errors,[]);await h.result(name,report);
}catch(error){await release();report.failure=String(error.stack||error);
  try{await sample('failure');await h.screenshot(name+'-failure');}catch{}
  await h.result(name+'-failure',report);throw error;
}finally{await h.close();}
`;
const home=compile(homeName,homeBody,homeOriginal,[],[
  'Only named navigation/rest/read helpers reused; fixture save, task seeding, empty-mode and presentation helpers excluded.',
  'Finale assertions use actual accumulated progress, ordinary ending, twenty notes, persisted fin and duplicate-free reload/rest.']);
const supportSources=['reimagine-harness.mjs','../src/systems.js','../src/pasto.js','../src/props.js','../src/npc.js','../src/capybara.js'];
if(homecoming)supportSources.push('homecoming-late-memory.mjs','homecoming-monaco-memory.mjs');
const manifest={route,sources:[...drivers.values(),home].map(d=>d.manifest),
  supportSources:supportSources.map(file=>({file,sha256:hash(read(file))})),sharedSha256:hash(shared),
  traps:['One fresh browser/context only; each injected driver close is a no-op.',
    'Driver reloads retain the same storage; wrapper start only starts an unstarted page.',
    'Palawan leaves the journal open; a real Escape closes it before the next chapter.',
    'Pasto flight restores its exact condor.update observer and removes diagnostic timers/listeners before leaving the driver.',
    'At most three real Pasto flight attempts; early release failures remain recorded. No reload, task seed or body move between attempts.',
    'Kyoto journey mode requires the authored river finish; bonus gates/chute are reported, with perfect-run assertions retained in the standalone driver.',
    'Public hud.cross chapter transitions are fixtures, not naturally opened travel doors.',
    'Waypoint and physics telemetry assist play; this is not novice/unguided enjoyment proof.']};
let resume=null;
if(resumeTag){
  const file='homecoming-journey-chain-'+resumeTag+'-failure.json.png',raw=read(file),prior=JSON.parse(raw);
  // A failed stage can persist a partial task set that its fresh driver cannot
  // replay. The last completed gate is an earned, unmodified checkpoint too.
  const priorSave=resumeGate?prior.gates?.at(-1)?.saved:(prior.lastSave||prior.gates?.at(-1)?.saved);
  assert(prior.homecoming&&priorSave&&prior.failure,'an actual failed earned Story checkpoint is required');
  assert.equal(prior.manifest.sharedSha256,manifest.sharedSha256,'same progression authoring');
  for(const item of prior.manifest.supportSources.filter(s=>s.file.startsWith('../src/')))
    assert.equal(item.sha256,hash(read(item.file)),'same production source '+item.file);
  assert.equal(priorSave.arcV1,1);assert.equal(priorSave.journeyMode,'story');assert(!priorSave.fin);
  for(const gate of prior.gates)assert((gate.saved.tasks||[]).every(id=>priorSave.tasks.includes(id)),'checkpoint retains earlier earned tasks');
  resume={file,sha256:hash(raw),save:priorSave,priorGates:prior.gates,priorFailure:prior.failure,
    checkpointSource:resumeGate||!prior.lastSave?'last-complete-gate':'failure-capture'};
  manifest.traps.push('Resumed mode restores the exact persisted save from a prior failed test; this is cross-session earned continuity, not a fresh single-context completion.');
}
if(prepare){console.log(JSON.stringify({prepared:true,browserLaunched:false,...manifest},null,2));process.exit(0);}

const {openHarness}=await import('./reimagine-harness.mjs');
// The retained seven-stop mode explicitly starts with an empty legacy file.
// A fresh file now belongs to the five-act story, including in Free Roam.
const legacyEmpty={v:1,tasks:[],seen:[],biome:'sydney',ms:0,tut:1,fin:0};
const root=await openHarness(homecoming?{story:true,...(resume?{storage:{'capy3.journey.v1':resume.save}}:{})}:{storage:{'capy3.journey.v1':legacyEmpty}}),
  report={homecoming,resumedFrom:resume,emptyLegacyFixture:homecoming?null:legacyEmpty,metadata:root.metadata,manifest,stages:[],gates:[],startedAt:new Date().toISOString()};
let current='initial',lastTasks=[];
async function ensureRunning() {
  if(!await root.page.evaluate(()=>window.__capy.state.started))await root.start();
}
function harnessFor(stage) {
  const stats={opens:0,starts:0,startNoops:0,arrivals:[],closeNoops:0,artifacts:[]};
  report.stages.push({stage,stats});
  return async options=>{
    assert.ok(!options||Object.keys(options).length===0,'driver must not request seeded/second context');stats.opens++;
    assert.equal(stats.opens,1,'one wrapper request per driver');
    return {...root,start:async()=>{stats.starts++;if(await root.page.evaluate(()=>window.__capy.state.started))stats.startNoops++;else await root.start();},
      arrive:async chapter=>{stats.arrivals.push(chapter);await root.arrive(chapter);},close:async()=>{stats.closeNoops++;},
      screenshot:async original=>{const artifact=prefix+'-'+stage+'-'+original;stats.artifacts.push(artifact+'.png');
        try{report.lastSave=await root.page.evaluate(()=>JSON.parse(localStorage.getItem('capy3.journey.v1')||'{}'));}catch{}
        return root.screenshot(artifact);},
      result:async(original,payload)=>{const artifact=prefix+'-'+stage+'-'+original;stats.artifacts.push(artifact+'.json.png');
        try{report.lastSave=await root.page.evaluate(()=>JSON.parse(localStorage.getItem('capy3.journey.v1')||'{}'));}catch{}
        return root.result(artifact,{...payload,driverScope:payload.scope,
          scope:'Same cumulative context/save. '+manifest.traps.slice(-2).join(' '),chainStage:stage});}};
  };
}
async function closeTravelCard() {
  const shown=await root.page.evaluate(()=>({paused:!!window.__capy.state.paused,
    journal:!!document.querySelector('.capyui-jr')?.classList.contains('show')}));
  if(shown.journal){await root.page.keyboard.press('Escape');await root.page.waitForFunction(()=>!window.__capy.state.paused);}
  else assert.equal(shown.paused,false,'unexpected modal between stages');
}
async function gateSnapshot(label,completed) {
  const row=await root.page.evaluate(label=>{
    const g=window.__capy;return {label,chapter:g.biome.current,time:g.state.time,hidden:document.hidden,
      paused:!!g.state.paused,gates:g.gateInfo(),saved:JSON.parse(localStorage.getItem('capy3.journey.v1')||'{}')};
  },label);
  const tasks=row.saved.tasks||[];
  assert.ok(lastTasks.every(id=>tasks.includes(id)),'previously earned tasks survive cumulative save');
  for(const n of completed){assert.equal(row.gates.find(g=>g.n===n)?.enough,true,'live cumulative memory '+n);
    assert.equal((homecoming?data.homecomingMemory:data.chapterExperience)(n,id=>tasks.includes(id)).enough,true,'saved cumulative memory '+n);}
  if(homecoming){
    assert.equal(row.saved.arcV1,1);assert.equal(row.saved.journeyMode,'story');
    row.progress=data.homecomingProgress(id=>tasks.includes(id));
  }
  assert.equal(row.hidden,false);report.gates.push(row);lastTasks=tasks.slice();await root.result(prefix,report);
}
async function execute(driver,stage,argv=[]) {
  current=stage;const before=Date.now(), index=report.stages.length;
  try { await driver.run(assert,readFileSync,vm,harnessFor(stage),{argv:['node',driver.url,...argv]},driver.url,data); }
  catch(error) { if(report.stages[index])report.stages[index].failure=String(error.stack||error);throw error; }
  finally { if(report.stages[index])report.stages[index].elapsedMs=Date.now()-before; }
}

async function flyPasto(driver) {
  for(let attempt=1;attempt<=3;attempt++) {
    try { await execute(driver,'pasto-attempt-'+attempt,['chain','--flap','--steer']);return; }
    catch(error) {
      // Only an actually lost ride is retryable. Broken assertions, crashes
      // and navigation failures remain terminal, with their original evidence.
      if(attempt===3||error.code!=='ERR_ASSERTION'||
        !/^steered signature remains mounted(?:\n|$)/.test(error.message))throw error;
      assert.deepEqual(root.metadata.errors,[],'no runtime error hidden by a flight retry');
      await root.result(prefix,report);
      await root.page.waitForFunction(()=>{const g=window.__capy;
        return g.biome.current==='pasto'&&!g.state.paused&&!document.hidden&&
          !g.condor.mounted&&!g.capy.carriedBy&&(g.capy.grounded||g.capy.swimming);
      },null,{timeout:15000});
      assert.equal(await root.page.evaluate(()=>window.__capy.taskDone('condor-ride')),false,
        'retry only before the signature was earned');
    }
  }
}

// The pastry must be witnessed and then kept four seconds/15m or twelve seconds.
// Read-only live stall/prop positions select the open plaza-side approach.
async function empanadaSupport() {
  current='pasto-pastry';const out={steps:[],navigation:[],keys:[]},held=new Set();
  const keyset=async want=>{for(const k of [...held])if(!want.has(k)){await root.page.keyboard.up(k);held.delete(k);}
    for(const k of want)if(!held.has(k)){await root.page.keyboard.down(k);held.add(k);}};
  const release=()=>keyset(new Set());
  const radius=Number(read('../src/capybara.js').match(/const capyGRAB_RADIUS\s*=\s*([\d.]+)/)?.[1]);
  assert.ok(radius>0,'actual grab radius');
  async function state(label) {
    return root.page.evaluate(({label,radius})=>{
      const g=window.__capy,p=g.capy.position,nearest=g.physics.nearestGrabbable(p,radius);
      return {label,t:g.state.time,p:p.toArray(),yaw:g.input.camYaw,hidden:document.hidden,paused:!!g.state.paused,
        chapter:g.biome.current,carried:!!g.capy.carriedBy,held:g.capy.heldProp?.type||null,
        nearest:nearest?{type:nearest.type,bodyId:nearest.body?.id}:null,
        done:g.taskDone('steal-empanada'),gate:g.gateInfo(2),getaway:g.physics.getawayAudit()};
    },{label,radius});
  }
  async function walk(target,r=.65,maxMs=25000,run=false) {
    const until=Date.now()+maxMs;let best=Infinity,progress=Date.now();
    try{while(Date.now()<until){const s=await state('pastry walk');
      assert.ok(!s.hidden&&!s.paused&&s.chapter==='pasto','visible Pasto support');
      out.navigation.push({target,...s});const dx=target.x-s.p[0],dz=target.z-s.p[2],d=Math.hypot(dx,dz);
      if(d<r)return;if(d<best-.2){best=d;progress=Date.now();}
      assert.ok(Date.now()-progress<6500,'pastry approach blocked: '+JSON.stringify(s));
      const x=dx*Math.cos(s.yaw)-dz*Math.sin(s.yaw),z=dx*Math.sin(s.yaw)+dz*Math.cos(s.yaw),want=new Set(run?['Shift']:[]);
      if(Math.abs(x)>Math.abs(z)*.42)want.add(x>0?'d':'a');if(Math.abs(z)>Math.abs(x)*.42)want.add(z>0?'s':'w');
      await keyset(want);await root.page.waitForTimeout(90);
    }throw Error('pastry navigation timed out');}finally{await release();}
  }
  try {
    await root.page.waitForFunction(()=>{const s=JSON.parse(localStorage.getItem('capy3.journey.v1')||'{}');return ['whistle-condor','condor-ride'].every(id=>s.tasks?.includes(id));},null,{timeout:12000});
    await root.page.reload();await ensureRunning();
    assert.equal(await root.page.evaluate(()=>window.__capy.biome.current),'pasto','flight reload returns to Pasto');
    await root.page.evaluate(()=>{window.__chainPastryKeys=[];for(const type of ['keydown','keyup'])document.addEventListener(type,e=>
      window.__chainPastryKeys.push({type,key:e.code,trusted:e.isTrusted,t:window.__capy.state.time}));});
    out.steps.push(await state('post-flight pastry start'));
    const target=await root.page.evaluate(()=>{
      const g=window.__capy;
      const candidates=g.props.filter(p=>p.type==='empanada'&&p.biome==='pasto'&&!p.removed&&!p.held&&p.grabbable&&p.stall)
        .map(p=>({x:p.body.position.x,y:p.body.position.y,z:p.body.position.z,bodyId:p.body.id,
          stall:{x:p.stall.x,z:p.stall.z,yaw:p.stall.yaw}}));
      // The west-row stall has an open eastern face, clear of fountain/benches.
      const chosen=candidates.filter(p=>p.stall.x<-20&&p.stall.z>=18&&p.stall.z<=22)
        .sort((a,b)=>b.z-a.z)[0];
      if(!chosen)return {candidates,chosen:null};
      const approach={x:chosen.x+1.30,z:chosen.z};
      return {candidates,chosen,approach,navBlocked:g.pasto.navBlocked(approach.x,approach.z,.5),
        hint:g.hintTarget('steal-empanada'),note:'navBlocked includes broad awning footprint; final reach uses actual grabbable distance, not a teleport through it.'};
    });
    out.target=target;assert.ok(target.chosen,'live western stall empanada exists');
    await walk({x:-12,z:26});await walk({x:-18,z:26});
    await walk({x:-18,z:target.approach.z});await walk(target.approach,.18);
    // Only press E when the actual pickup query selects this food.
    let s=await state('at stall');out.steps.push(s);
    assert.equal(s.nearest?.type,'empanada','actual nearest grabbable is empanada');
    await root.hold('e',90);await root.page.waitForTimeout(250);s=await state('grabbed');out.steps.push(s);
    assert.equal(s.held,'empanada','real key took pastry');
    await walk({x:-18,z:26},.8,25000,true);await walk({x:-12,z:26},.8,25000,true);
    await walk({x:-12,z:8},.8,25000,true);
    const deadline=Date.now()+16000;
    while(Date.now()<deadline){s=await state('witnessed getaway');out.steps.push(s);if(s.done)break;
      assert.equal(s.held,'empanada','pastry retained until task pays');await root.page.waitForTimeout(250);}
    assert.equal(s.done,true,'actual witnessed theft/getaway awarded');assert.equal(s.gate.enough,true);
    await root.page.waitForFunction(()=>JSON.parse(localStorage.getItem('capy3.journey.v1')||'{}').tasks?.includes('steal-empanada'),null,{timeout:12000});
    out.keys=await root.page.evaluate(()=>window.__chainPastryKeys);assert.ok(out.keys.length&&out.keys.every(k=>k.trusted));
    await root.screenshot(prefix+'-pasto-pastry');await root.result(prefix+'-pasto-pastry',out);
  }catch(error){out.failure=String(error.stack||error);try{out.steps.push(await state('failure'));await root.screenshot(prefix+'-pasto-pastry-failure');}catch{}
    await root.result(prefix+'-pasto-pastry-failure',out);throw error;
  }finally{await release();}
}
try {
  const initial=await root.page.evaluate(()=>JSON.parse(localStorage.getItem('capy3.journey.v1')||'{}'));
  if(resume)assert.deepEqual(initial.tasks,resume.save.tasks,'exact earned checkpoint restored');
  else assert.equal((initial.tasks||[]).length,0,'one fresh unseeded journey');
  assert.equal(initial.fin||0,0);
  report.initialSave=initial;await root.result(prefix,report);
  const completed=[];
  if(resume){
    await ensureRunning();
    for(const {n} of route){if(data.homecomingMemory(n,id=>initial.tasks.includes(id)).enough)completed.push(n);else break;}
    await gateSnapshot('actual earned checkpoint resumed',completed);
  }
  for(const {n,chapter} of route) {
    if(completed.includes(n))continue;
    if(completed.length)await closeTravelCard();
    if(homecoming){
      const earned=await root.page.evaluate(()=>JSON.parse(localStorage.getItem('capy3.journey.v1')||'{}').tasks||[]);
      assert(data.homecomingProgress(id=>earned.includes(id)).open.includes(n),'earned chapter access before arrival '+chapter);
    }
    if(['cave','iceland','monaco'].includes(chapter)){
      current=chapter;
      const injected=await harnessFor(chapter)({});
      const result=chapter==='monaco'?await (await import('./homecoming-monaco-memory.mjs')).monacoMemory(injected):
        await (await import('./homecoming-late-memory.mjs')).lateMemory(injected,chapter);
      report.stages.at(-1).pass=result.pass;
    }
    else if(chapter==='pasto')await flyPasto(drivers.get(chapter));
    else await execute(drivers.get(chapter),chapter,chapter==='kyoto'?['--journey']:[]);
    if(chapter==='pasto') {
      const memory=await root.page.evaluate(()=>window.__capy.gateInfo(2));
      if(!memory.enough)await empanadaSupport();
      else report.stages.at(-1).supportChoice={alreadyEarned:true,experience:memory.experience,
        note:'The actual condor flight also earned sufficient authored support actions; no extra task imposed.'};
    }
    await closeTravelCard();completed.push(n);await gateSnapshot(chapter+' earned and persisted',completed);
    if(chapter===stopAfter)break;
  }
  if(!stopAfter){
    await execute(home,'homecoming');await gateSnapshot('ending survived reload and repeat rest',routeIds);
    assert.equal(report.gates.at(-1).saved.fin,1);
  }
  assert.deepEqual(root.metadata.errors,[]);
  report.finishedAt=new Date().toISOString();report.pass=true;report.partial=!!stopAfter;
  await root.result(prefix,report);
  console.log(JSON.stringify({pass:true,artifact:prefix+'.json.png',stages:report.stages.map(s=>s.stage),
    fin:stopAfter?null:1,partial:!!stopAfter}));
}catch(error){report.failure={stage:current,error:String(error.stack||error)};
  try{report.lastSave=await root.page.evaluate(()=>JSON.parse(localStorage.getItem('capy3.journey.v1')||'{}'));}catch{}
  if(!report.lastSave&&report.gates.length)report.lastSave=report.gates.at(-1).saved;
  try{await root.screenshot(prefix+'-failure');}catch{}
  await root.result(prefix+'-failure',report);
  throw error;
}finally{try{await root.close();}catch{}}
