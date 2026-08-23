import fs from 'fs';
const tpl = fs.readFileSync('qa/LR-shot.tpl.js', 'utf8');
fs.writeFileSync('qa/LR-run.js', tpl.replace('__SPOTS__', process.argv[2]));
