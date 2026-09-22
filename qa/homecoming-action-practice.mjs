import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripComments } from '../strip-comments.mjs';
import vm from 'node:vm';

const source = stripComments(readFileSync('src/systems.js', 'utf8'));
function body(name) {
  const at = source.indexOf('function ' + name + '('), start = source.indexOf('{', at);
  let depth = 0, end = start;
  for (; end < source.length; end++) { if (source[end] === '{') depth++; if (source[end] === '}' && --depth === 0) break; }
  return source.slice(at, end + 1);
}
function el(tag, cls, text) {
  return { tag, cls, textContent: text || '', children: [], events: {}, hidden: false,
    dataset: {}, style: { transform: '' }, appendChild(c) { this.children.push(c); c.parentNode = this; return c; },
    setAttribute(k, v) { this[k] = v; }, addEventListener(k, f) { this.events[k] = f; },
    click() { if (!this.disabled) this.events.click?.(); },
    focus() { this.focused = true; } };
}
const pool = source.match(/const sysLEARN_ACTION = \{[\s\S]*?\n\};/)[0];
const context = vm.createContext({ sysEl: el });
vm.runInContext(pool + '\n' + body('learnMovePractice') + '\n' + body('learnInteractionPractice') + '\nthis.builders = { learnMovePractice, learnInteractionPractice };', context);
const builders = context.builders;
const move = builders.learnMovePractice();
assert.equal(move.children[0].textContent, 'Try the movement diagram');
move.children[0].events.click();
const scene = move.children[1], controls = move.children[2], reset = move.children[4];
const board = scene.children[0], marker = board.children[0];
assert.equal(scene.focused, true);
scene.events.keydown({ code: 'ArrowRight', preventDefault() {}, stopPropagation() {} });
assert(marker.style.transform.includes('18px'), 'keyboard movement changes only marker');
scene.events.keydown({ code: 'ArrowUp', preventDefault() {}, stopPropagation() {} });
assert(marker.style.transform.includes('-18px'), 'forward movement reaches the local target axis');
controls.children[5].events.click();
assert.equal(scene.dataset.view, '90', 'native camera control rotates local practice view');
assert.equal(board.style.transform, 'rotate(90deg)', 'rotation is rendered, not only metadata');
reset.events.click();
assert.equal(marker.style.transform, 'translate(0px,0px)');
controls.children[5].click();
scene.events.keydown({ code: 'KeyD', preventDefault() {}, stopPropagation() {} });
assert.equal(marker.style.transform, 'translate(0px,-18px)', 'inverse rotation keeps right camera-relative');
for (let i = 0; i < 12; i++) scene.events.keydown({ code: 'KeyD', preventDefault() {}, stopPropagation() {} });
assert.equal(marker.style.transform, 'translate(0px,-54px)', 'both coordinate bounds remain clamped');
scene.events.keydown({ code: 'KeyS', preventDefault() {}, stopPropagation() {} });
assert.equal(marker.style.transform, 'translate(18px,-54px)', 'backward movement follows rotated view');
scene.events.keydown({ code: 'KeyC', preventDefault() {}, stopPropagation() {} });
assert.equal(board.style.transform, 'rotate(0deg)', 'C recentres without moving the marker');
assert.equal(marker.style.transform, 'translate(18px,-54px)');
scene.events.keydown({ code: 'Tab', preventDefault() { assert.fail('Tab must remain native'); }, stopPropagation() { assert.fail('Tab must propagate'); } });
const interaction = builders.learnInteractionPractice();
interaction.children[0].events.click();
const approach = interaction.children[1], action = interaction.children[2], wheek = interaction.children[3], ireset = interaction.children[5];
assert(action.disabled && wheek.disabled, 'interaction starts out of range');
approach.events.click(); assert(!action.disabled && !wheek.disabled, 'approach enables contextual actions');
action.events.click(); assert.equal(action.textContent, 'E · put down');
interaction.events.keydown({ code: 'KeyE', repeat: true, preventDefault() {}, stopPropagation() {} });
assert.equal(action.textContent, 'E · put down', 'held E does not rapidly toggle');
interaction.events.keydown({ code: 'KeyE', preventDefault() {}, stopPropagation() {} });
assert.equal(action.textContent, 'E · pick up', 'focused E drops local prop');
wheek.events.click(); assert(interaction.children[4].textContent.includes('answers'));
ireset.events.click(); assert(action.disabled && !interaction.children[4].textContent.includes('answers'), 'reset clears local interaction');
assert(!body('learnMovePractice').includes('game.') && !body('learnInteractionPractice').includes('game.'), 'builders do not access live game state');
assert(!body('learnMovePractice').includes('localStorage') && !body('learnInteractionPractice').includes('localStorage'), 'builders do not access saves');
console.log('HOMECOMING action practice: isolated builders, rotation, bounds, keys and resets pass.');
