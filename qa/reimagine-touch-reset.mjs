// REIMAGINE G: execute the shipped event-only touch release helpers.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { stripComments } from '../strip-comments.mjs';
const source = stripComments(readFileSync(new URL('../src/systems.js',import.meta.url),'utf8'));
let checks=0;
const check=(ok,why)=>{assert.ok(ok,why);checks++;};
function block(at) {
  assert.ok(at>=0,'source boundary'); const open=source.indexOf('{',at);
  let depth=0,quote='',escaped=false;
  for(let i=open;i<source.length;i++) {
    const c=source[i];
    if(quote) { if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c===quote)quote=''; }
    else if('\'"`'.includes(c))quote=c;
    else if(c==='{')depth++;
    else if(c==='}'&&--depth===0)return source.slice(at,i+1);
  }
  throw Error('unclosed block');
}
const fn=name=>block(source.indexOf('function '+name+'('));
const event=name=>{
  const match=source.match(new RegExp("^  (?:document\\.)?addEventListener\\('"+name+"', function",'m'));
  assert.ok(match,'top-level lifecycle listener: '+name);
  return block(match.index);
};
function node() {
  const classes=new Set(['press','on']), handlers={};
  return {classes,handlers,style:{},classList:{remove:c=>classes.delete(c),add:c=>classes.add(c)},
    addEventListener:(type,fn)=>{handlers[type]=fn;},setPointerCapture(){}};
}
function fixture() {
  const q=vm.createContext({Math,keys:{},started:true,mouseAction:false,padJump:false,padAction:false,
    padHonk:false,padRun:false,padSlide:false,touchJump:true,touchAction:true,touchHonk:true,
    touchSlide:true,touchBack:true,touchLook:true,stickActive:true,stickX:1,stickZ:0,stickId:7,
    sysRunLatch:true,sysRunWas:true,sysSlideLatch:true,sysSlideWas:true,
    sysPinchPts:new Map([[1,{}]]),sysPinchD:8,sysDragLastX:5,dragId:7,
    jumpPend:.01,actionPend:.02,audioUnlock(){},startResume(){},sysWake(){},uiSfx(){},
    baseEl:node(),knobEl:node(),hopBtn:node(),grabBtn:node(),wheekBtn:node(),slideBtn:node()});
  q.touchLayer=node();q.touchLayer.querySelectorAll=()=>[q.hopBtn,q.grabBtn,q.wheekBtn,q.slideBtn].filter(n=>n.classes.has('press'));
  q.input={x:1,z:.5,run:true,slide:true,honk:true,whistle:true,action:true,jump:true,
    honkPressed:true,whistlePressed:true,actionPressed:true,jumpPressed:true,jumpBuf:.01,actionBuf:.02,
    clearJumpBuf(){q.jumpPend=-1;q.input.jumpBuf=-1;},clearActionBuf(){q.actionPend=-1;q.input.actionBuf=-1;}};
  vm.runInContext(['sysBufClearAll','stickEnd','bindBtn','sysTouchReset','sysTouchHide','sysInputRelease'].map(fn).join('\n'),q);
  return q;
}
const touches=q=>['touchJump','touchAction','touchHonk','touchSlide','touchBack','touchLook','stickActive'].every(k=>!q[k]);
const pressed=q=>[q.hopBtn,q.grabBtn,q.wheekBtn,q.slideBtn].some(n=>n.classes.has('press'));
const neutral=q=>['run','slide','honk','whistle','action','jump','honkPressed','whistlePressed','actionPressed','jumpPressed'].every(k=>!q.input[k])&&q.input.x===0&&q.input.z===0;

for(const mode of ['pointerup','pointercancel','lostpointercapture']) {
  const q=fixture();q.stickEnd({pointerId:99,type:mode});
  check(q.stickActive&&q.stickId===7,'unrelated finger cannot release stick');
  q.stickEnd({pointerId:7,type:mode});
  check(!q.stickActive&&q.stickId===-1&&q.stickX===0&&q.stickZ===0,'stick released: '+mode);
  check(!q.baseEl.classes.has('on')&&q.knobEl.style.transform==='translate(0px,0px)','stick UI released: '+mode);
  check(q.touchAction&&q.touchJump,'stick release preserves other held fingers');
  check(q.sysRunLatch===(mode==='pointerup'),'normal toggle tap preserved, interrupted hold cleared');
}
for(const [button,flag,edge,buffer] of [['hopBtn','touchJump','jumpPressed','jumpBuf'],
  ['grabBtn','touchAction','actionPressed','actionBuf'],['wheekBtn','touchHonk','honkPressed',null],
  ['slideBtn','touchSlide',null,null]]) {
  for(const mode of ['pointerup','pointercancel','lostpointercapture']) {
    const q=fixture(),el=q[button];
    q.bindBtn(el,()=>{},()=>{q[flag]=false;});
    check(typeof el.handlers.lostpointercapture==='function','button subscribes to lost capture');
    el.handlers[mode]({type:mode});
    check(!q[flag]&&!el.classes.has('press'),'button releases held state and UI: '+button+'/'+mode);
    check(q.stickActive,'button release does not cancel separate stick contact');
    if(edge)check(q.input[edge]===(mode==='pointerup'),'cancelled touch edge cleared; ordinary tap retained');
    if(buffer)check((q.input[buffer]>=0)===(mode==='pointerup'),'cancelled buffer cleared; ordinary tap buffered');
    if(button==='slideBtn')check(q.sysSlideLatch===(mode==='pointerup'),'slide toggle distinguishes normal and cancelled release');
  }
}
{
  const q=fixture();q.sysTouchHide();
  check(touches(q)&&!pressed(q),'takeover clears every touch channel and pressed class');
  check(q.stickId===-1&&q.stickX===0&&q.stickZ===0&&!q.baseEl.classes.has('on'),'takeover clears stick');
  check(!q.touchLayer.classes.has('on'),'takeover hides touch controls');
  check(q.jumpPend===-1&&q.actionPend===-1,'takeover clears touch-only pending verbs');
  check(!q.sysRunLatch&&!q.sysSlideLatch,'takeover clears interrupted held toggles');
}
for(const owner of ['keyboard','pad','mouse']) {
  const q=fixture();
  if(owner==='keyboard')q.keys={Space:true,KeyE:true,KeyQ:true,ShiftLeft:true,KeyG:true};
  if(owner==='pad')q.padJump=q.padAction=q.padHonk=q.padRun=q.padSlide=true;
  if(owner==='mouse')q.mouseAction=true;
  q.sysTouchReset();
  check(touches(q),'touch sources release beside '+owner);
  check(q.input.actionBuf>=0&&q.input.actionPressed,'incoming '+owner+' action retained');
  if(owner!=='mouse') {
    check(q.input.jumpBuf>=0&&q.input.jumpPressed&&q.input.honkPressed,'incoming '+owner+' other edges retained');
    check(q.sysRunLatch&&q.sysSlideLatch,'other device still owns physical toggle holds');
  }
}
{
  const q=fixture();q.keys={KeyW:true,Space:true,KeyE:true};q.mouseAction=true;
  q.sysInputRelease();
  check(touches(q)&&!pressed(q),'context interruption clears touches/UI');
  check(neutral(q),'context interruption immediately publishes neutral input without tick');
  check(Object.values(q.keys).every(v=>!v)&&!q.mouseAction&&q.dragId===-1,'context clears keys/mouse');
  check(q.sysPinchPts.size===0&&q.sysPinchD===0&&q.sysDragLastX===null,'context clears pinch');
  check(q.jumpPend===-1&&q.actionPend===-1,'context clears all pending buffers');
}
{
  const q=fixture();for(const key of ['touchJump','touchAction','touchHonk','touchSlide','touchBack','touchLook','stickActive'])q[key]=false;
  q.sysInputRelease();
  check(q.sysRunLatch&&q.sysSlideLatch,'idle accessibility toggles survive interruption');
  check(neutral(q),'idle toggles do not keep published paused input active');
}
for(const route of [fn('pauseShow'),event('blur'),event('visibilitychange')])
  check(route.includes('sysInputRelease();'),'pause/blur/hidden route uses shared context release');
for(const route of [event('keydown'),fn('sysSawMouse'),event('gamepadconnected'),fn('padPoll')])
  check(route.includes('sysTouchHide();'),'device takeover uses shared touch release');
check(source.includes("zoneEl.addEventListener('lostpointercapture', stickEnd);"),'stick capture-loss wiring');
check((source.match(/touchLayer\.classList\.remove\('on'\)/g)||[]).length===1,'one touch-layer hide writer');
check(!fn('update').includes('sysTouchReset(')&&!fn('update').includes('sysInputRelease('),'no per-frame reset polling');
check(!/game\.state|saveSoon|prefsSoon|no[A-Z]/.test(fn('sysTouchReset')+fn('sysInputRelease')),'no gameplay flag or save mutation');
console.log(`REIMAGINE touch reset: ${checks} checks passed.`);
