// Execute the production rehearsal builder without a game wallet or saver.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { stripComments } from '../strip-comments.mjs';
const s = stripComments(readFileSync('src/systems.js', 'utf8'));
const pool = s.match(/const sysLEARN_SHOP = \{[\s\S]*?\n\};/)[0];
const at = s.indexOf('function learnShopPractice()');
let end = s.indexOf('{', at), depth = 0;
for (; end < s.length; end++) {
  if (s[end] === '{') depth++;
  if (s[end] === '}' && --depth === 0) break;
}
function el(tag, cls, text) {
  return { tag, cls, textContent: text || '', children: [], events: {}, attrs: {},
    appendChild(n) { this.children.push(n); }, addEventListener(k,v) { this.events[k] = v; },
    setAttribute(k,v) { this.attrs[k] = v; }, focus() { this.focused = true; },
    querySelector(selector) { return this.children.find(n => '.' + n.cls === selector) || null; } };
}
let checks = 0;
for (const price of [25,40]) {
  const q = vm.createContext({ sysEl: el, upgradeDef: id => {
    assert.equal(id, 'puff'); return { name:'MORE PUFF', line:'Actual shop effect.', tiers:[{price}] };
  } });
  vm.runInContext(pool + '\n' + s.slice(at,end+1),q);
  const host = q.learnShopPractice(), find = c => host.querySelector('.capyui-practice-' + c);
  assert.equal(host.children.length,1); find('open').events.click();
  const n = host.children.length; find('open').events.click(); assert.equal(host.children.length,n);
  assert(find('buy').disabled && find('collect').focused);
  find('buy').events.click(); assert(find('wallet').textContent.includes(String(price-5)));
  find('collect').events.click(); find('collect').events.click();
  assert(find('wallet').textContent.includes(String(price)) && !find('buy').disabled);
  assert(find('buy').textContent.includes(String(price)));
  find('buy').events.click(); find('buy').events.click();
  assert.equal(find('wallet').textContent,'Practice wallet: 0 yuzu');
  assert(find('buy').disabled && find('collect').disabled);
  assert(find('status').textContent.includes('unchanged'));
  assert.equal(find('status').attrs['aria-live'],'polite');
  find('reset').events.click(); assert(find('buy').disabled && !find('collect').disabled);
  assert(find('wallet').textContent.includes(String(price-5)));
  checks += 12;
}
console.log(checks + ' isolated purchase checks pass');
