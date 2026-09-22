// D4 actual card functions, including reuse and mid-card fallback.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const source=readFileSync('src/systems.js','utf8');
const inherited=execFileSync('git',['show','2891ecc:src/systems.js'],{encoding:'utf8',maxBuffer:15000000});
const css=s=>s.match(/function sysBuildCSS\([^]*?\n\}/)[0];
// M2a adds only a lesson subtree and prevents horizontal title scrolling.
// Keep the historical whole-sheet comparison outside these named additions.
const withoutLearning = css(source)
  .replace("'.capyui-homevisit .capyui-jrled{min-height:44px;letter-spacing:.04em;text-transform:none;}',\n", '')
  .replace("'.capyui-homevisit .capyui-jrled{min-height:44px;letter-spacing:.04em;text-transform:none;}',\r\n", '')
  .replace(/\/\* HOMECOMING title:[^]*?\/\* HOMECOMING title end\. \*\/\r?\n/, '')
  .replace(/\/\* HOMECOMING learning reference:[^]*?\/\* HOMECOMING learning reference end\. \*\/\r?\n/, '')
  .replace(/\/\* HOMECOMING atlas:[^]*?\/\* HOMECOMING atlas end\. \*\/\r?\n/, '')
  .replace('overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;', 'overflow-y:auto;overscroll-behavior:contain;');
assert.ok(withoutLearning.replace(/\/\* D4: the reward[^]*?(?=\/\* ---------- flight readout)/,'\n')===css(inherited),
  'inherited CSS, including arrivals, unchanged outside earned and learning selectors');
const top=source.match(/function sysEarnedCardLive\([^]*?\n\}/)[0];
const fn=name=>source.match(new RegExp('  function '+name+'\\([^]*?\\n  \\}'))[0];
const gate=new Function(top+';return sysEarnedCardLive;')();
let checks=0;
for(const requested of [false,true])for(const cut of [false,true])for(const rung of [undefined,0,1,2,3]) {
  assert.equal(gate(requested,cut,rung),requested&&!cut&&(rung|0)<1);checks++;
}
const nodes={};
for(const n of ['placeEl','placeH','placeSub','placeNews','placeLine','marqNameEl']) {
  const classes=new Set();nodes[n]={textContent:'',hidden:false,classList:{
    add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c),
    toggle:(c,on)=>on?classes.add(c):classes.delete(c)}};
}
const game={state:{noEarnedCard:false,perfRung:0}}, timers=new Map();let seq=0;
const ctx=new Function('game','nodes','setTimeout','clearTimeout',`
  const {placeEl,placeH,placeSub,placeNews,placeLine,marqNameEl}=nodes;
  let placeEarned=false,placeEarnedOn=false,placeEarnedDuplicate=false,placeEarnedTitle='',
      wowEarnedOn=false,showPlaceLast='',sysPlaceCardAt=0,placeTimer=0;
  const sysSay=x=>x,sysWall=()=>0,sysFADE_CARD=3600,sysLINE_CARD=3400;
  ${top};${fn('placeEarnedTick')};${fn('showPlace')};${fn('sysPlaceLine')};
  return {tick:placeEarnedTick,show:showPlace,line:sysPlaceLine,
    continuation:(on,title)=>{wowEarnedOn=on;marqNameEl.textContent=title;},
    release:()=>{showPlaceLast='';placeEl.classList.remove('show');}};
`)(game,nodes,(fn,ms)=>{const id=++seq;timers.set(id,{fn,ms});return id;},id=>timers.delete(id));
ctx.show('THE OPERA HOUSE CONCERT','completed instruction',null,true);
assert.ok(nodes.placeEl.classList.contains('earned-card'));
assert.equal(nodes.placeSub.textContent,'completed instruction');
assert.equal([...timers.values()][0].ms,3600);
ctx.continuation(true,'THE OPERA HOUSE CONCERT');ctx.tick();
assert.ok(nodes.placeEl.classList.contains('earned-duplicate'));
ctx.continuation(true,'DIFFERENT TITLE');ctx.tick();
assert.ok(!nodes.placeEl.classList.contains('earned-duplicate'));
for(const mode of ['flag','rung']) {
  game.state.noEarnedCard=mode==='flag';game.state.perfRung=mode==='rung'?1:0;ctx.tick();
  assert.ok(!nodes.placeEl.classList.contains('earned-card'));
  assert.equal(nodes.placeSub.textContent,'completed instruction');
  assert.equal(timers.size,1,'fallback does not restart timer');
  game.state.noEarnedCard=false;game.state.perfRung=0;ctx.tick();
  assert.ok(nodes.placeEl.classList.contains('earned-card'));
}
for(const timer of [...timers.values()])timer.fn();
assert.ok(!nodes.placeEl.classList.contains('show'),'actual authored expiry hides card');
game.state.noEarnedCard=true;ctx.tick();game.state.noEarnedCard=false;ctx.tick();
assert.ok(!nodes.placeEl.classList.contains('show'),'fallback cannot resurrect expired card');
ctx.show('KYOTO','ordinary arrival','news');
assert.ok(!nodes.placeEl.classList.contains('earned-card'));
assert.equal(nodes.placeNews.textContent,'news');
ctx.show('THE FERRY TO MANLY','completed instruction',null,true);
assert.equal(ctx.line('cannot replace active reward'),false);
assert.ok(nodes.placeEl.classList.contains('earned-card'));
ctx.release();assert.equal(ctx.line('ordinary live line'),true);
assert.ok(!nodes.placeEl.classList.contains('earned-card'));
assert.ok(nodes.placeEl.classList.contains('line'));
assert.ok(source.includes('showPlace(wow, r.def ? r.def.text : id, null, true);'));
assert.equal((source.match(/classList.toggle\('earned-card'/g)||[]).length,1,'one class writer');
console.log(`Earned card: ${checks} actual gate combinations plus timer, reuse, duplicate and fallback lifecycle passed.`);
