// VM contract for the human-audition destination tap. No browser or audio
// device is used: this proves topology and constructor ownership only.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync('qa/homecoming-audition.mjs', 'utf8');
const marker = 'await h.page.addInitScript(() => {';
const at = source.indexOf(marker);
assert(at >= 0, 'installTap addInitScript callback exists');
const open = source.indexOf('{', at); let depth = 0, close = open;
for (; close < source.length; close++) {
  if (source[close] === '{') depth++;
  if (source[close] === '}' && --depth === 0) break;
}
assert(close > open, 'install callback closes');
const callbackText = '() => ' + source.slice(open, close + 1);
const install = vm.runInNewContext('(' + callbackText + ')');

class AudioNodeMock {
  constructor(context, kind = 'source') { this.context = context; this.kind = kind; this.connections = []; }
  connect(destination) { this.connections.push(destination); return destination; }
  disconnect(destination) { this.connections = destination ? this.connections.filter(d => d !== destination) : []; }
}
class AudioContextMock {
  constructor() {
    this.destination = new AudioNodeMock(this, 'hardware-destination');
    this.destination.connections = [];
    this.state = 'running'; this.sampleRate = 48000;
  }
  createMediaStreamDestination() {
    const n = new AudioNodeMock(this, 'stream-destination');
    n.stream = { getTracks: () => [{ stop() {} }] }; return n;
  }
  createAnalyser() { const n = new AudioNodeMock(this, 'analyser'); n.fftSize = 0; n.smoothingTimeConstant = 1; return n; }
}

const context = vm.createContext({ AudioNode: AudioNodeMock, AudioContext: AudioContextMock,
  webkitAudioContext: AudioContextMock, window: {}, WeakSet, Object, Error });
const originalConnect = AudioNodeMock.prototype.connect;
context.window.AudioContext = AudioContextMock;
context.window.webkitAudioContext = AudioContextMock;
vm.runInContext('window.__install = (' + callbackText + '); window.__install();', context);

assert.equal(typeof context.window.AudioContext, 'function', 'wrapped constructor exposed');
assert.equal(context.window.AudioContext.prototype, AudioContextMock.prototype, 'native prototype preserved');
const ac = vm.runInContext('new window.AudioContext()', context);
assert(ac instanceof AudioContextMock, 'constructed native context remains native');
assert.equal(context.window.__qaContexts.length, 1, 'context registered');
assert.equal(ac.__qaTap, null, 'no tap before destination connection');
const sourceNode = new AudioNodeMock(ac, 'master');
const hardware = ac.destination;
sourceNode.connect(hardware);
sourceNode.connect(hardware); // duplicate native destination wiring must not duplicate the tap
const tap = ac.__qaTap;
assert(tap && tap.source === sourceNode, 'tap records the destination source');
assert.equal(sourceNode.connections.filter(node => node === hardware).length, 2, 'original hardware output retained');
assert.equal(sourceNode.connections.filter(node => node === tap.analyser).length, 1, 'one analyser branch');
assert.equal(tap.analyser.connections.filter(node => node === tap.tap).length, 1, 'analyser feeds stream destination');
assert.equal(tap.tap.connections.length, 0, 'stream destination has no outgoing connection');
assert.equal(sourceNode.connections.filter(node => node.kind === 'stream-destination').length, 0,
  'source never connects directly from or to zero-output stream destination');
assert.equal(context.window.__qaContexts[0], ac, 'registered context is captured context');
assert.equal(context.window.__qaAudioInstalled.NativeConnect.toString(), originalConnect.toString(),
  'original connect retained for restoration');
assert.notEqual(context.AudioNode.prototype.connect.toString(), originalConnect.toString(), 'prototype now carries tap wrapper');

console.log('HOMECOMING audition contract: 11 topology and ownership checks pass.');
