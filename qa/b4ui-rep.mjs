import fs from 'fs'
for (const f of process.argv.slice(2)) {
  const o = JSON.parse(fs.readFileSync(f, 'utf8'))
  for (const r of o.panels || []) {
    const bits = []
    if (r.unreachable.length) bits.push('UNREACH ' + r.unreachable.map(u => `${u.c}<${u.par}>[hid ${u.hidden} sc${u.scrollers} r${u.rect} c${u.clip}]"${u.t}"`).join(' | '))
    if (r.truncated.length) bits.push('TRUNC ' + r.truncated.map(u => `${u.c}(${u.have}/${u.need})"${u.t}"`).join(' | '))
    if (r.tiny.length) bits.push('TINY ' + r.tiny.map(u => `${u.c}@${u.px}"${u.t}"`).join(' | '))
    if (r.smallHit.length) bits.push('HIT ' + r.smallHit.map(u => `${u.c} ${u.w}x${u.h}"${u.t}"`).join(' | '))
    if (r.docOverflowX) bits.push('DOC-OVERFLOW-X')
    const dl = (r.dialogs || []).map(d => `${d.c}:${d.name || 'NONAME'}${d.modal === 'true' ? '' : ':NOTMODAL'}`).join(',')
    console.log(`[${r.size} ${r.panel}] cand=${r.nCand} foc=${r.focusables} dlg=${dl || '-'}${r.keysOpen !== undefined ? ' keysOpen=' + r.keysOpen : ''}${r.photoOn !== undefined ? ' photoOn=' + r.photoOn : ''}`)
    for (const b of bits) console.log('    ' + b)
  }
  for (const e of o.esc || []) console.log(`ESC ${e.size} after ${e.after}: jr=${e.st.jr} led=${e.st.led} alb=${e.st.alb} focus=${e.st.active}`)
}
