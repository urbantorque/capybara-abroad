import fs from 'fs'
const scan = fs.readFileSync('qa/b4ui-scan.txt', 'utf8')
const src = process.argv[2]
const dst = process.argv[3]
fs.writeFileSync(dst, fs.readFileSync(src, 'utf8').replace('/*SCAN*/', scan))
console.log('wrote', dst)
