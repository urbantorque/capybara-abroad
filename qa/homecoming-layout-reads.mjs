// The traveller needs world coordinates, never a DOM screen measurement.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const s = readFileSync('src/systems.js','utf8'), npc = readFileSync('src/npc.js','utf8');
const code = s.match(/game\.exitBoard = function \(screen\) \{[\s\S]*?\n  \};/);
assert(code);
let reads = 0;
const q = vm.createContext({ game:{}, boardObj:{faceY:2,topY:3,hx:4,hz:5}, boardFor:'monaco',
  boardX:1,boardY:2,boardZ:3,boardYaw:4,BOARD_ROWS:5,BOARD_FLAPS:6,boardBody:{},
  boardScreen:()=>{reads++;return {x:7,y:8};} });
vm.runInContext(code[0],q);
const world = q.game.exitBoard(false);
assert.equal(reads,0); assert.equal(world.screen,null); assert.equal(world.biome,'monaco');
assert.equal(q.game.exitBoard().screen.x,7); assert.equal(reads,1);
q.game.exitBoard(true); assert.equal(reads,2);
q.boardObj=null; assert.equal(q.game.exitBoard(false),null); assert.equal(reads,2);
assert(npc.includes("game.exitBoard(false) : null"));
console.log('9 board projection ownership checks pass');
