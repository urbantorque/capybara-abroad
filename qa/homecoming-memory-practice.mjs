// Real rule and builder in a DOM-only context: no game or save writer exists.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const s=readFileSync('src/systems.js','utf8'),shared=readFileSync('src/shared.js','utf8');
const builder=s.match(/  function learnMemoryPractice\(\) \{[^]*?\n  \}/)[0];
const pool=s.match(/const sysLEARN_MEMORY = \{[^]*?\n\};/)[0];
const rules=shared.slice(shared.indexOf('export const TASKS ='),shared.indexOf('// RECORDS —')).replace(/^export /gm,'');
class El{
  constructor(tag,cls,text){this.tag=tag;this.className=cls||'';this.textContent=text||'';this.children=[];this.events={};this.attrs={};this.dataset={};this.hidden=false;this.focused=false;}
  appendChild(c){this.children.push(c);return c;}
  addEventListener(n,f){this.events[n]=f;}
  setAttribute(n,v){this.attrs[n]=v;}
  focus(){this.focused=true;}
}
for(const story of [true,false]){
  const q=vm.createContext({homecomingArc:story,sysEl:(...args)=>new El(...args)});
  vm.runInContext(rules+'\n'+pool+'\n'+builder,q);
  const host=q.learnMemoryPractice(),open=host.children[0];open.events.click();
  const choices=host.children.filter(c=>c.className==='capyui-memorypractice-choice');
  const status=host.children.find(c=>c.className==='capyui-memorypractice-status');
  const reset=host.children.at(-1),count=host.children.length;
  open.events.click();assert.equal(host.children.length,count,'no duplicate panel');
  assert.equal(choices.length,story?4:3);assert(choices[0].focused);
  const click=i=>choices[i].events.click();
  const complete=()=>status.textContent.includes('complete');
  assert(!complete());click(0);assert(!complete(),'core alone is insufficient');
  if(story){
    click(1);assert(!complete(),'both core options still need a distinct support');
    click(2);assert(complete());click(0);assert(complete(),'quiet route works without signature');
    click(1);assert(!complete());click(3);assert(!complete(),'two small moments are not a core');
  }else{
    click(1);assert(!complete(),'legacy still needs two supports');click(2);assert(complete());
    click(0);assert(!complete(),'legacy signature stays required');
  }
  reset.events.click();assert(!complete());assert(choices.every(c=>c.attrs['aria-pressed']==='false'));
  assert.equal(status.attrs.role,'status');assert.equal(status.attrs['aria-live'],'polite');
}
console.log('Memory rehearsal: Story alternatives, legacy rules, toggles, reset, focus and writer isolation pass.');
