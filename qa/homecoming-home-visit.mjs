// Execute the shipped invitation policy; staging is session-local, not a save.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const s = readFileSync('src/systems.js', 'utf8');
const body = s.slice(s.indexOf('  function homeVisitOffered('), s.indexOf('  function journeyNext('));
let progress = { ready:false, memories:[[1,3]] }, held = new Set([1,3]);
const c = { game:{state:{homecomingArc:true}}, jrDepart:true, chapMax:19,
  journeyProgress:()=>progress, keepHeld:n=>held.has(n), sysShelfSpoken:{} };
vm.createContext(c); vm.runInContext(body, c);
let checks=0;
function check(here, expected) { assert.equal(c.homeVisitOffered(here),expected); checks++; }
check(3,true); check(1,false);
c.jrDepart=false; check(3,true); c.jrDepart=true;
c.game.state.homecomingArc=false; check(3,false); c.game.state.homecomingArc=true;
progress.memories=[[1]]; check(3,false); progress.memories=[[1,3]];
c.sysShelfSpoken[3]=true; check(3,false);
held.add(5); check(5,true); c.sysShelfSpoken[5]=true; check(5,false);
progress.ready=true; c.sysShelfSpoken={}; check(9,false);
progress.ready=false; check(3,true);
assert(s.includes('jrHomeVisit.hidden = !homeVisitOffered(here);')); checks++;
assert(s.includes('jrDepart = true; jrTravel(1);')); checks++;
console.log(`${checks} home invitation checks pass`);
