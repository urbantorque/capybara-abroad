// REIMAGINE G: trusted mobile contacts, interrupted without writing game input.
// Capture loss is an explicit platform-loss fixture via releasePointerCapture.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { openHarness } from './reimagine-harness.mjs';

const h = await openHarness({ width: 390, height: 844, hasTouch: true, isMobile: true });
const tag = process.argv.find(a => a.startsWith('--tag='))?.slice(6) || 'latest';
assert.match(tag, /^[\w.-]+$/);
const controlOnly = process.argv.find(a => a.startsWith('--control='))?.slice(10);
assert.ok(!controlOnly || ['stick','action','jump','honk'].includes(controlOnly));
const name = 'reimagine-touch-release-'+tag+(controlOnly?'-'+controlOnly:''), cdp = await h.context.newCDPSession(h.page);
const report = { metadata: h.metadata, cases: [], failures: [],
  scope: 'Fresh navigation per case; trusted CDP touch contacts and trusted start tap. Capture-loss cases explicitly call DOM releasePointerCapture. No game, body, task, clock or input-state writes.' };
const controls = { stick: '.capyui-zone', action: '.capyui-grab', jump: '.capyui-hop', honk: '.capyui-wheek' };
let contacts = [];
async function dispatch(type, points) {
  await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(p => ({ ...p, radiusX: 2, radiusY: 2, force: 1 })) });
  contacts = type === 'touchCancel' || (type === 'touchEnd' && !points.length) ? [] :
    type === 'touchEnd' ? contacts.filter(p => !points.some(q => q.id === p.id)) : points;
}
async function settle(ms = 160) { await h.page.waitForTimeout(ms); }
async function sample(label) {
  return h.page.evaluate(label => {
    const g = window.__capy, input = g.input;
    const classes = selector => document.querySelector(selector)?.className || null;
    return { label, t: g.state.time, hidden: document.hidden, paused: !!g.state.paused,
      input: Object.fromEntries(['x','z','run','action','jump','honk'].map(k => [k,input[k]])),
      touch: classes('.capyui-touch'), base: classes('.capyui-base'),
      buttons: Object.fromEntries(['grab','hop','wheek'].map(k => [k,classes('.capyui-'+k)])),
      knob: document.querySelector('.capyui-knob')?.style.transform,
      events: window.__touchQA.events.slice() };
  }, label);
}
function neutral(row) {
  const i = row.input;
  return Math.abs(i.x) < .001 && Math.abs(i.z) < .001 && !i.run && !i.action && !i.jump && !i.honk &&
    !row.base?.split(' ').includes('on') && Object.values(row.buttons).every(c => !c?.split(' ').includes('press'));
}
function held(row, control) {
  return control === 'stick' ? Math.hypot(row.input.x,row.input.z) > .86 && row.input.run : !!row.input[control];
}
async function point(selector, id = 1) {
  const box = await h.page.locator(selector).boundingBox();
  assert.ok(box?.width && box?.height, 'visible touch target: ' + selector);
  return { id, x: box.x + box.width * .5, y: box.y + box.height * .5 };
}
async function fresh() {
  // A reload reinitialises touch closures; no localStorage or input cleanup write.
  await h.page.reload({ waitUntil: 'load' });
  await h.page.bringToFront();
  await h.page.waitForFunction(() => !!window.__capy && !!document.querySelector('.capyui-go'));
  await h.page.evaluate(() => {
    window.__touchQA = { events: [] };
    for (const type of ['pointerdown','pointermove','pointerup','pointercancel','gotpointercapture','lostpointercapture'])
      document.addEventListener(type, e => {
        const el = e.target.closest?.('.capyui-zone,.capyui-btn');
        window.__touchQA.events.push({ type, pointerId:e.pointerId, trusted:e.isTrusted,
          pointerType:e.pointerType, target:el?.className || e.target.nodeName,
          x:e.clientX,y:e.clientY,t:performance.now() });
      }, true);
  });
  await h.page.locator('.capyui-carry:visible, .capyui-go:visible').first().tap();
  await h.page.waitForFunction(() => window.__capy.state.started && !window.__capy.state.paused);
  await settle(500);
  const touch = await h.page.evaluate(() => ({ coarse:matchMedia('(hover: none) and (pointer: coarse)').matches,
    maxTouchPoints:navigator.maxTouchPoints, shown:document.querySelector('.capyui-touch').classList.contains('on') }));
  assert.ok(touch.coarse && touch.maxTouchPoints > 0 && touch.shown, 'harness must enable genuine mobile touch: '+JSON.stringify(touch));
}
async function run(control, mode) {
  const row = { control, mode, samples: [], violations: [] }; report.cases.push(row);
  try {
    await fresh(); contacts = [];
    row.samples.push(await sample('fresh'));
    const p = await point(controls[control]);
    await dispatch('touchStart',[p]);
    if (control === 'stick') { p.x += 48; p.y -= 30; await dispatch('touchMove',[p]); }
    else { p.x += 1; await dispatch('touchMove',[p]); } // process pending capture
    await settle();
    const down = await sample('held'); row.samples.push(down);
    if (!held(down,control)) row.violations.push('control did not establish held input');
    if (!down.events.some(e => e.type === 'pointerdown' && e.trusted && e.pointerType === 'touch'))
      row.violations.push('no trusted touch pointerdown');
    if (mode === 'capture-loss') {
      row.capture = await h.page.evaluate(selector => {
        const el = document.querySelector(selector);
        const event = [...window.__touchQA.events].reverse().find(e => e.type === 'gotpointercapture' && el.hasPointerCapture(e.pointerId));
        if (!event) return { released:false };
        el.releasePointerCapture(event.pointerId);
        return { released:true,pointerId:event.pointerId,target:el.className };
      }, controls[control]);
      if (!row.capture.released) row.violations.push('capture loss fixture lacked actual capture');
      // A one-pixel move processes pending capture loss without leaving the control.
      p.x += 1; await dispatch('touchMove',[p]); await settle();
      const lost = await sample('capture lost, contact remains'); row.samples.push(lost);
      if (!lost.events.some(e => e.type === 'lostpointercapture' && e.pointerId === row.capture.pointerId))
        row.violations.push('capture loss event was not delivered');
      if (!neutral(lost)) row.violations.push('input or pressed UI persists after capture loss');
      const outside = { id:p.id,x:195,y:350 };
      await dispatch('touchMove',[outside]); await dispatch('touchEnd',[]);
    } else if (mode === 'keyboard-hide') {
      await h.page.keyboard.press('Shift'); await settle();
      const hidden = await sample('keyboard hid touch layer, contact remains'); row.samples.push(hidden);
      if (hidden.touch?.split(' ').includes('on')) row.violations.push('Shift did not hide touch layer');
      if (!neutral(hidden)) row.violations.push('input or pressed UI persists after keyboard takeover');
      await dispatch('touchEnd',[]);
    } else if (mode === 'pause') {
      const menu = await point('.capyui-menu',2);
      await dispatch('touchStart',[p,menu]); await dispatch('touchEnd',[menu]); await settle();
      const paused = await sample('menu paused, first contact remains'); row.samples.push(paused);
      if (!paused.paused) row.violations.push('actual menu did not pause');
      if (!neutral(paused)) row.violations.push('input or pressed UI persists across pause');
      await dispatch('touchEnd',[]);
      await h.page.locator('.capyui-pause.show .capyui-pausebtn.go').tap();
      await h.page.waitForFunction(() => !window.__capy.state.paused);
    } else await dispatch(mode === 'cancel' ? 'touchCancel' : 'touchEnd',[]);
    await settle(300);
    const after = await sample('released'); row.samples.push(after);
    if (!neutral(after)) row.violations.push('input or pressed UI persists after final contact release');
    row.expectedReleased = true; row.observedReleased = neutral(after);
    if (row.violations.length || mode === 'capture-loss') await h.screenshot(name+'-'+control+'-'+mode);
  } catch (error) {
    row.error = String(error.stack || error); row.violations.push('fixture error: '+error.message);
  } finally {
    if (contacts.length) { try { await dispatch('touchCancel',[]); } catch {} }
  }
  if (row.violations.length) report.failures.push({control,mode,violations:row.violations});
  console.log(JSON.stringify({control,mode,released:row.observedReleased,violations:row.violations}));
}
try {
  const selected=controlOnly?[controlOnly]:Object.keys(controls);
  for (const control of selected) for (const mode of ['end','cancel','capture-loss']) await run(control,mode);
  if(selected.includes('stick'))await run('stick','keyboard-hide');
  if (process.argv.includes('--pause')) for (const control of selected) await run(control,'pause');
  report.runtimeErrors = h.metadata.errors;
  try { await h.result(name,report); }
  catch (error) {
    // A crashed renderer cannot reach /shot; retain the failed report locally.
    writeFileSync(new URL('./'+name+'.json.png',import.meta.url),JSON.stringify({...report,sinkError:String(error)},null,2));
    throw error;
  }
  assert.deepEqual(h.metadata.errors, [], 'zero runtime errors');
  assert.deepEqual(report.failures, [], 'touch release regression: inspect full recorded case report');
} finally { await h.close(); }
