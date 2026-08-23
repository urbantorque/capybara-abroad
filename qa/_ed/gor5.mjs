import fs from 'fs';
let s = fs.readFileSync('src/goreme.js', 'utf8');
function rep(a,b){const n=s.split(a).length-1;if(n!==1){console.error('FAIL('+n+'): '+a.slice(0,60));process.exit(1)}s=s.replace(a,()=>b)}
rep(`          gorPush9(vineLeaf, x, y + 0.52 * s, z, rand(-0.1, 0.1), (v * 2 + r) * 0.9,
                   rand(-0.1, 0.1), 1.05 * s, 0.44 * s, 0.95 * s);`,
`          // AND A GOBLET IS NOT A DINNER PLATE. 1.05 wide by 0.44 tall on a
          // six-segment sphere is a flat green HEXAGON lying in the dirt under
          // a camera that looks down 0.7 rad — the same failure as Iceland's
          // moss discs, the cave's moss, the Pantanal's lily rims and the
          // Drift's ferns, arrived at for the fifth time from the same
          // direction. A trained bush vine is nearly as tall as it is wide.
          gorPush9(vineLeaf, x, y + 0.62 * s, z, rand(-0.1, 0.1), (v * 2 + r) * 0.9,
                   rand(-0.1, 0.1), 0.78 * s, 0.70 * s, 0.72 * s);`);
rep(`            for (let k2 = 0; k2 < 2; k2++) {
              gorPush9(wall, x, y + 0.16 + k2 * 0.28, z, 0, yaw + Math.sin(w + k2) * 0.09, 0,
                       0.9 - k2 * 0.1, 0.30, 1.55);
            }`,
`            // THREE COURSES AND NARROWER. Two courses of 0.30 on a 0.9 m
            // footprint is a wall 60 cm high and 90 cm thick — from above, a
            // twenty-metre plank laid on the ground, which is what the first
            // render of it was. A dry terrace wall is about a metre high and
            // half a metre through, and every stone in it sits a little
            // differently, which is the only thing that stops the top of it
            // being one continuous plane.
            for (let k2 = 0; k2 < 3; k2++) {
              gorPush9(wall, x + Math.sin(w * 2.1 + k2) * 0.06, y + 0.17 + k2 * 0.33,
                       z + Math.cos(w * 1.7 + k2) * 0.06,
                       0.03 * (k2 - 1), yaw + Math.sin(w + k2) * 0.11, 0.03 * ((w + k2) % 2 ? 1 : -1),
                       0.58 - k2 * 0.06, 0.34, 1.5 - k2 * 0.08);
            }`);
fs.writeFileSync('src/goreme.js', s); console.log('ok');
