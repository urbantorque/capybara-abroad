import fs from 'fs';
let s = fs.readFileSync('src/drift.js', 'utf8');
function rep(a, b) { const n = s.split(a).length - 1; if (n !== 1) { console.error('FAIL(' + n + '): ' + a.slice(0,60)); process.exit(1) } s = s.replace(a, () => b) }
rep('    const n = dark ? 4 : Math.round(hx * hz * 0.10) + 4;',
    '    const n = dark ? 7 : Math.round(hx * hz * 0.17) + 5;');
rep("    curtain(s, s.y, s.hx, s.hz, s.yaw, s.drop, deep ? 0.34 : 1.20, i + 3);",
    "    curtain(s, s.y, s.hx, s.hz, s.yaw, s.drop, deep ? 0.50 : 1.45, i + 3);");
rep('const driAIR_N = 210;', 'const driAIR_N = 280;');
fs.writeFileSync('src/drift.js', s); console.log('ok');
