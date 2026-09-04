# audit-solid — walk-through structures (READ-ONLY audit, 4 Sep 2026)

Source instrument: qa/px-solid-audit.js run tag A (qa/px-solid-audit-A.json.png, 2026-09-03T12:01Z). Row = [x, z, baseY, h, meshId, dirX, dirZ, drawnDist, physDist(-1=none), hitY]. Grid 5 m, chest ray 2.5 m, keeps h>=1.6, skips transparent materials, skips origins inside a collider.

## A. Parsed audit result, per chapter (object -> hits)

Class key: veg-inst = instanced vegetation (deliberately walk-through); INST? = instanced non-vegetation (needs a name); STRUCT = non-instanced mesh.

## 1 sydney  sampled=654 hits=0 recessed=0 boxes=100 timedOut=0
| object | id | hits | h(min-max) | geo | inst(cnt) | class | bb(local) | samples |
|---|---|---|---|---|---|---|---|---|

## 2 quay  sampled=3399 hits=2 recessed=0 boxes=94 timedOut=0
| object | id | hits | h(min-max) | geo | inst(cnt) | class | bb(local) | samples |
|---|---|---|---|---|---|---|---|---|
| quay | 1264 | 2 | 1.8-2.1 | SphereGeometry | Y(134) | INST? | 0,0,0,0,1,0 | (227,-490 d+x 2.25m) (232,-490 d-x 0.96m) |

## 3 pasto  sampled=2256 hits=65 recessed=1 boxes=42 timedOut=0
| object | id | hits | h(min-max) | geo | inst(cnt) | class | bb(local) | samples |
|---|---|---|---|---|---|---|---|---|
| pasto/pastoFrailejones | 1585 | 33 | 1.6-3.4 | BufferGeometry | Y(420) | veg-inst | -1,0,-1,1,2,1 | (-77,-85 d-x 0.74m) (-77,-80 d-x 1.42m) (-77,-75 d-z 1.05m) |
| pasto/pastoShrubs | 1587 | 29 | 1.6-4.4 | BufferGeometry | Y(560) | veg-inst | -1,0,-1,1,1,1 | (-85,-20 d-x 2.11m) (-85,10 d+z 1.7m) (-85,15 d-z 2.44m) |
| pasto/pastoBunting | 1591 | 3 | 11.4-11.4 | BufferGeometry | n | STRUCT | -23,0,11,23,12,41 | (-23,40 d+x 0.72m) (20,40 d+x 2.39m) (25,40 d-x 2.39m) |
recessed (1):
- pasto/pastoCoffeeFarm x1: (68,-10 drawn 2.05 phys 2.83 h4.8)

## 4 kyoto  sampled=1806 hits=32 recessed=2 boxes=173 timedOut=0
| object | id | hits | h(min-max) | geo | inst(cnt) | class | bb(local) | samples |
|---|---|---|---|---|---|---|---|---|
| kyoto | 2056 | 17 | 10.2-18.6 | CylinderGeometry | Y(260) | INST? | 0,0,0,0,1,1 | (-100,-40 d+x 1.11m) (-95,-40 d+z 0.71m) (-95,-30 d+x 1.59m) |
| kyoto | 2046 | 6 | 15.8-22.8 | CylinderGeometry | Y(360) | INST? | 0,0,0,0,1,1 | (-27,-55 d+z 2.47m) (-27,-25 d+x 1.16m) (-20,-65 d+z 2.11m) |
| kyoto | 2040 | 3 | 5.2-8.4 | CylinderGeometry | Y(42) | INST? | 0,0,0,0,1,1 | (-100,85 d-x 0.06m) (-75,10 d-x 1.04m) (33,-55 d+z 1.65m) |
| kyoto | 2009 | 2 | 2.2-2.2 | BufferGeometry | n | STRUCT | -50,0,-3,-18,2,19 | (-37,20 d-z 1.25m) (-32,20 d-z 1.25m) |
| kyoto | 2026 | 2 | 2.6-2.6 | BufferGeometry | n | STRUCT | -8,-2,170,58,1,182 | (12,180 d+x 0.08m) (43,180 d+x 0.81m) |
| kyoto | 2015 | 1 | 6-6 | BufferGeometry | n | STRUCT | -19,0,20,-11,7,28 | (-15,20 d+z 1.1m) |
| kyoto | 2043 | 1 | 4.4-4.4 | BufferGeometry | n | STRUCT | -18,0,17,6,1,47 | (-10,25 d+x 2.01m) |
recessed (2):
- kyoto x1: (-5,-45 drawn 0.62 phys 2.12 h4.8)
- kyoto x1: (-68,-65 drawn 0.36 phys 1.56 h5.6)

## 5 cali  sampled=1892 hits=27 recessed=2 boxes=195 timedOut=0
| object | id | hits | h(min-max) | geo | inst(cnt) | class | bb(local) | samples |
|---|---|---|---|---|---|---|---|---|
| cali | 2437 | 14 | 1.9-5.6 | CylinderGeometry | Y(620) | INST? | 0,0,0,0,1,1 | (62,-30 d+z 2.03m) (67,-30 d+x 1.27m) (72,-35 d-z 1.35m) |
| cali | 2441 | 6 | 10.3-15.9 | CylinderGeometry | Y(46) | INST? | 0,0,0,0,1,1 | (-61,-20 d-x 0.03m) (-51,-30 d+x 1.42m) (-42,70 d-x 0.91m) |
| cali | 2395 | 3 | 4.8-5.5 | BufferGeometry | n | STRUCT | -210,-2,-18,210,3,15 | (-12,-5 d+x 1.37m) (-12,5 d+x 1.37m) (77,15 d-z 0.75m) |
| cali | 2406 | 2 | 11.5-13.2 | CylinderGeometry | Y(8) | INST? | 0,0,0,0,1,1 | (-61,20 d+z 1.06m) (72,20 d+z 0.98m) |
| cali | 2402 | 1 | 3.5-3.5 | BufferGeometry | n | STRUCT | -47,0,-29,61,9,92 | (52,60 d+x 1.93m) |
| cali | 2430 | 1 | 6-6 | BufferGeometry | n | STRUCT | -35,0,40,-9,6,65 | (-17,40 d-x 0.13m) |
recessed (2):
- cali x1: (18,45 drawn 0.25 phys 1.7 h7.6)
- cali x1: (42,70 drawn 2.42 phys 3.2 h13.3)

## 6 rio  sampled=1293 hits=5 recessed=0 boxes=59 timedOut=0
| object | id | hits | h(min-max) | geo | inst(cnt) | class | bb(local) | samples |
|---|---|---|---|---|---|---|---|---|
| rio | 2720 | 2 | 6.3-8.5 | CylinderGeometry | Y(110) | INST? | 0,0,0,0,1,1 | (-90,10 d-z 1.18m) (92,5 d-x 1.63m) |
| rio | 2700 | 1 | 2.3-2.3 | BufferGeometry | n | STRUCT | -13,-10,-8,12,2,10 | (-52,-30 d-z 1.18m) |
| rio | 2702 | 1 | 23.3-23.3 | BufferGeometry | n | STRUCT | 53,-2,-59,103,68,-10 | (73,-35 d-x 2.18m) |
| rio | 2707 | 1 | 4-4 | BufferGeometry | n | STRUCT | -60,2,73,39,18,79 | (35,80 d-z 0.93m) |

## 7 iceland  sampled=3461 hits=0 recessed=0 boxes=29 timedOut=0
| object | id | hits | h(min-max) | geo | inst(cnt) | class | bb(local) | samples |
|---|---|---|---|---|---|---|---|---|

## 8 sahara  sampled=3817 hits=12 recessed=2 boxes=220 timedOut=1
| object | id | hits | h(min-max) | geo | inst(cnt) | class | bb(local) | samples |
|---|---|---|---|---|---|---|---|---|
| sahara | 3442 | 5 | 1.7-2.6 | BufferGeometry | n | STRUCT | 193,8,-38,282,41,58 | (258,55 d+z 2.07m) (263,55 d+z 1.69m) (273,-35 d-z 1.84m) |
| sahara | 3292 | 3 | 5.2-5.2 | BufferGeometry | n | STRUCT | -22,0,-15,22,5,15 | (-65,35 d-z 0.08m) (-60,25 d-x 1.87m) (-55,40 d+z 0.14m) |
| sahara | 3278 | 2 | 2.6-2.6 | BufferGeometry | n | STRUCT | -24,0,-76,73,14,70 | (-2,20 d-x 0.98m) (8,20 d-x 1.19m) |
| sahara/sahVar:horn:c20 | 3414 | 1 | 1.7-1.7 | SphereGeometry | Y(14) | INST? | 0,0,0,0,1,0 | (258,-80 d+x 1.46m) |
| sahara/sahVar:horn:c25 | 3424 | 1 | 1.7-1.7 | SphereGeometry | Y(28) | INST? | 0,0,0,0,1,0 | (312,-80 d+x 0.7m) |
recessed (2):
- Mesh x1: (170,-85 drawn 0.21 phys 2.04 h1.7)
- sahara x1: (195,30 drawn 1.65 phys 2.38 h2.3)

## 9 drift  sampled=224 hits=39 recessed=1 boxes=73 timedOut=0
| object | id | hits | h(min-max) | geo | inst(cnt) | class | bb(local) | samples |
|---|---|---|---|---|---|---|---|---|
| drift/dri:fardress | 3744 | 14 | 4.8-12.3 | BufferGeometry | n | STRUCT | -406,6,-398,382,145,277 | (-110,40 d-z 1.28m) (-110,45 d-z 1.24m) (35,-140 d+x 1.21m) |
| drift | 3737 | 10 | 8.3-13.4 | PlaneGeometry | Y(152) | INST? | 0,0,0,1,0,1 | (-48,-110 d-x 0.96m) (-38,-120 d+x 1.78m) (-38,-115 d+x 0.91m) |
| drift | 3733 | 5 | 9.2-13 | CylinderGeometry | Y(192) | INST? | 0,0,0,0,1,1 | (-68,-150 d-x 1.92m) (-38,-105 d+x 1.31m) (-27,-115 d-z 1.75m) |
| drift | 3738 | 4 | 9.4-12.3 | CylinderGeometry | Y(16) | INST? | 0,0,0,0,1,1 | (-38,-110 d+x 0.94m) (-37,-125 d+z 2.28m) (5,30 d+x 0.15m) |
| drift | 3739 | 3 | 9.9-11.8 | CylinderGeometry | Y(16) | INST? | 0,0,0,0,1,1 | (-73,-150 d+x 1.54m) (-37,-110 d-x 1.64m) (-12,25 d-x 1.96m) |
| drift | 3740 | 2 | 7.8-8.9 | PlaneGeometry | Y(7038) | INST? | 0,0,0,1,0,1 | (-63,-85 d+x 2.39m) (-32,-120 d+z 1.77m) |
| drift/dri:isles | 3725 | 1 | 8.3-8.3 | BufferGeometry | n | STRUCT | -77,29,-199,70,109,44 | (-2,30 d+x 1.08m) |
recessed (1):
- drift x1: (-7,0 drawn 0.1 phys 1.88 h11.2)

## 10 venice  sampled=846 hits=7 recessed=0 boxes=219 timedOut=0
| object | id | hits | h(min-max) | geo | inst(cnt) | class | bb(local) | samples |
|---|---|---|---|---|---|---|---|---|
| venice | 4024 | 5 | 2.8-15.1 | BufferGeometry | n | STRUCT | -77,-3,-56,-37,22,4 | (-77,-55 d+z 1.45m) (-77,-50 d-z 2m) (-77,-20 d+z 1.72m) |
| venice | 4026 | 2 | 14.3-18.3 | BufferGeometry | n | STRUCT | -164,-4,-85,-78,18,16 | (-130,-65 d-x 0.17m) (-93,-5 d+z 0.54m) |

## 11 kowloon  sampled=691 hits=2 recessed=0 boxes=153 timedOut=0
| object | id | hits | h(min-max) | geo | inst(cnt) | class | bb(local) | samples |
|---|---|---|---|---|---|---|---|---|
| kowloon | 4337 | 2 | 4.1-4.1 | BufferGeometry | n | STRUCT | -11,-4,-157,12,37,-53 | (-5,-65 d+x 0.77m) (5,-65 d-x 0.77m) |

## 12 palawan  sampled=345 hits=3 recessed=0 boxes=67 timedOut=0
| object | id | hits | h(min-max) | geo | inst(cnt) | class | bb(local) | samples |
|---|---|---|---|---|---|---|---|---|
| palawan/palBeach | 4627 | 3 | 9.4-10.2 | BufferGeometry | n | STRUCT | -56,-1,13,57,15,66 | (-48,40 d-z 0.34m) (-43,55 d-x 1.29m) (-38,60 d+z 0.26m) |

## 13 goreme  sampled=1638 hits=16 recessed=1 boxes=92 timedOut=0
| object | id | hits | h(min-max) | geo | inst(cnt) | class | bb(local) | samples |
|---|---|---|---|---|---|---|---|---|
| goreme | 5035 | 5 | 3.6-14.9 | BufferGeometry | n | STRUCT | -32,1,-15,36,9,22 | (-8,10 d+x 1.6m) (-3,10 d+z 1.54m) (-3,15 d+x 1.33m) |
| goreme/gorValley | 4888 | 4 | 9.3-16.5 | BufferGeometry | n | STRUCT | -57,-7,-103,78,30,21 | (-37,20 d+x 2.05m) (-27,0 d-z 1.23m) (-3,0 d+x 1.51m) |
| goreme | 4890 | 3 | 4.1-11.5 | BufferGeometry | n | STRUCT | -53,-3,-104,58,36,76 | (-23,70 d-z 2.08m) (-8,55 d-x 2.42m) (-3,40 d-x 0.67m) |
| goreme/gorScat:vine:c25 | 5007 | 2 | 8.5-17.8 | SphereGeometry | Y(66) | INST? | 0,0,0,1,1,0 | (82,-65 d-x 0.1m) (82,-60 d-z 0.14m) |
| goreme/gorScat:vine:c24 | 4998 | 1 | 6.9-6.9 | SphereGeometry | Y(69) | INST? | 0,0,0,1,1,0 | (82,-80 d-z 1.78m) |
| goreme/gorScat:poplarT:c27 | 5026 | 1 | 14.6-14.6 | CylinderGeometry | Y(3) | INST? | 0,0,0,0,1,1 | (68,5 d+z 0.78m) |
recessed (1):
- goreme x1: (-42,65 drawn 1.1 phys 2 h3.5)

## 14 manly  sampled=1175 hits=0 recessed=0 boxes=86 timedOut=0
| object | id | hits | h(min-max) | geo | inst(cnt) | class | bb(local) | samples |
|---|---|---|---|---|---|---|---|---|

## 15 pantanal  sampled=1948 hits=10 recessed=0 boxes=82 timedOut=0
| object | id | hits | h(min-max) | geo | inst(cnt) | class | bb(local) | samples |
|---|---|---|---|---|---|---|---|---|
| Mesh | 1206 | 9 | 1.9-1.9 | SphereGeometry | n | STRUCT | -200,-200,-200,200,200,200 | (-47,-120 d-z 1.7m) (-43,-120 d-z 2.11m) (-18,-125 d-z 0.46m) |
| pantanal | 5600 | 1 | 11.4-11.4 | BufferGeometry | n | STRUCT | -118,0,-119,120,13,95 | (92,-110 d+z 0.43m) |

## 16 cave  sampled=1835 hits=2 recessed=0 boxes=181 timedOut=0
| object | id | hits | h(min-max) | geo | inst(cnt) | class | bb(local) | samples |
|---|---|---|---|---|---|---|---|---|
| cave | 5815 | 1 | 31.8-31.8 | BufferGeometry | n | STRUCT | -85,-25,-197,85,90,55 | (-75,-155 d-z 0.9m) |
| cave | 5827 | 1 | 1.6-1.6 | BufferGeometry | n | STRUCT | -16,10,-201,16,25,-199 | (-17,-200 d+x 0.67m) |

## 17 antarctic  sampled=4399 hits=3 recessed=0 boxes=105 timedOut=0
| object | id | hits | h(min-max) | geo | inst(cnt) | class | bb(local) | samples |
|---|---|---|---|---|---|---|---|---|
| antarctic | 6112 | 2 | 2.3-2.5 | BoxGeometry | Y(1400) | INST? | 0,0,0,1,1,1 | (-172,-440 d+x 1.59m) (-162,-440 d-x 1.1m) |
| antarctic | 6074 | 1 | 1.9-1.9 | PlaneGeometry | n | STRUCT | -212,-31,-502,212,62,122 | (-187,-235 d+z 2.33m) |

## 18 monaco  sampled=2615 hits=1 recessed=0 boxes=26 timedOut=1
| object | id | hits | h(min-max) | geo | inst(cnt) | class | bb(local) | samples |
|---|---|---|---|---|---|---|---|---|
| Mesh | 1206 | 1 | 1.7-1.7 | SphereGeometry | n | STRUCT | -200,-200,-200,200,200,200 | (-135,65 d-x 0.17m) |

## 19 hanoi  sampled=2481 hits=0 recessed=0 boxes=87 timedOut=0
| object | id | hits | h(min-max) | geo | inst(cnt) | class | bb(local) | samples |
|---|---|---|---|---|---|---|---|---|

## Ranked non-vegetation objects (all chapters)
| # | chap | object | hits | h | inst | geo | samples |
|---|---|---|---|---|---|---|---|
| 1 | 4 kyoto | kyoto | 17 | 10.2-18.6 | Y(260) | CylinderGeometry | (-100,-40 d+x 1.11m) (-95,-40 d+z 0.71m) (-95,-30 d+x 1.59m) |
| 2 | 5 cali | cali | 14 | 1.9-5.6 | Y(620) | CylinderGeometry | (62,-30 d+z 2.03m) (67,-30 d+x 1.27m) (72,-35 d-z 1.35m) |
| 3 | 9 drift | drift/dri:fardress | 14 | 4.8-12.3 | n | BufferGeometry | (-110,40 d-z 1.28m) (-110,45 d-z 1.24m) (35,-140 d+x 1.21m) |
| 4 | 9 drift | drift | 10 | 8.3-13.4 | Y(152) | PlaneGeometry | (-48,-110 d-x 0.96m) (-38,-120 d+x 1.78m) (-38,-115 d+x 0.91m) |
| 5 | 15 pantanal | Mesh | 9 | 1.9-1.9 | n | SphereGeometry | (-47,-120 d-z 1.7m) (-43,-120 d-z 2.11m) (-18,-125 d-z 0.46m) |
| 6 | 4 kyoto | kyoto | 6 | 15.8-22.8 | Y(360) | CylinderGeometry | (-27,-55 d+z 2.47m) (-27,-25 d+x 1.16m) (-20,-65 d+z 2.11m) |
| 7 | 5 cali | cali | 6 | 10.3-15.9 | Y(46) | CylinderGeometry | (-61,-20 d-x 0.03m) (-51,-30 d+x 1.42m) (-42,70 d-x 0.91m) |
| 8 | 8 sahara | sahara | 5 | 1.7-2.6 | n | BufferGeometry | (258,55 d+z 2.07m) (263,55 d+z 1.69m) (273,-35 d-z 1.84m) |
| 9 | 9 drift | drift | 5 | 9.2-13 | Y(192) | CylinderGeometry | (-68,-150 d-x 1.92m) (-38,-105 d+x 1.31m) (-27,-115 d-z 1.75m) |
| 10 | 10 venice | venice | 5 | 2.8-15.1 | n | BufferGeometry | (-77,-55 d+z 1.45m) (-77,-50 d-z 2m) (-77,-20 d+z 1.72m) |
| 11 | 13 goreme | goreme | 5 | 3.6-14.9 | n | BufferGeometry | (-8,10 d+x 1.6m) (-3,10 d+z 1.54m) (-3,15 d+x 1.33m) |
| 12 | 9 drift | drift | 4 | 9.4-12.3 | Y(16) | CylinderGeometry | (-38,-110 d+x 0.94m) (-37,-125 d+z 2.28m) (5,30 d+x 0.15m) |
| 13 | 13 goreme | goreme/gorValley | 4 | 9.3-16.5 | n | BufferGeometry | (-37,20 d+x 2.05m) (-27,0 d-z 1.23m) (-3,0 d+x 1.51m) |
| 14 | 3 pasto | pasto/pastoBunting | 3 | 11.4-11.4 | n | BufferGeometry | (-23,40 d+x 0.72m) (20,40 d+x 2.39m) (25,40 d-x 2.39m) |
| 15 | 4 kyoto | kyoto | 3 | 5.2-8.4 | Y(42) | CylinderGeometry | (-100,85 d-x 0.06m) (-75,10 d-x 1.04m) (33,-55 d+z 1.65m) |
| 16 | 5 cali | cali | 3 | 4.8-5.5 | n | BufferGeometry | (-12,-5 d+x 1.37m) (-12,5 d+x 1.37m) (77,15 d-z 0.75m) |
| 17 | 8 sahara | sahara | 3 | 5.2-5.2 | n | BufferGeometry | (-65,35 d-z 0.08m) (-60,25 d-x 1.87m) (-55,40 d+z 0.14m) |
| 18 | 9 drift | drift | 3 | 9.9-11.8 | Y(16) | CylinderGeometry | (-73,-150 d+x 1.54m) (-37,-110 d-x 1.64m) (-12,25 d-x 1.96m) |
| 19 | 12 palawan | palawan/palBeach | 3 | 9.4-10.2 | n | BufferGeometry | (-48,40 d-z 0.34m) (-43,55 d-x 1.29m) (-38,60 d+z 0.26m) |
| 20 | 13 goreme | goreme | 3 | 4.1-11.5 | n | BufferGeometry | (-23,70 d-z 2.08m) (-8,55 d-x 2.42m) (-3,40 d-x 0.67m) |
| 21 | 2 quay | quay | 2 | 1.8-2.1 | Y(134) | SphereGeometry | (227,-490 d+x 2.25m) (232,-490 d-x 0.96m) |
| 22 | 4 kyoto | kyoto | 2 | 2.2-2.2 | n | BufferGeometry | (-37,20 d-z 1.25m) (-32,20 d-z 1.25m) |
| 23 | 4 kyoto | kyoto | 2 | 2.6-2.6 | n | BufferGeometry | (12,180 d+x 0.08m) (43,180 d+x 0.81m) |
| 24 | 5 cali | cali | 2 | 11.5-13.2 | Y(8) | CylinderGeometry | (-61,20 d+z 1.06m) (72,20 d+z 0.98m) |
| 25 | 6 rio | rio | 2 | 6.3-8.5 | Y(110) | CylinderGeometry | (-90,10 d-z 1.18m) (92,5 d-x 1.63m) |
| 26 | 8 sahara | sahara | 2 | 2.6-2.6 | n | BufferGeometry | (-2,20 d-x 0.98m) (8,20 d-x 1.19m) |
| 27 | 9 drift | drift | 2 | 7.8-8.9 | Y(7038) | PlaneGeometry | (-63,-85 d+x 2.39m) (-32,-120 d+z 1.77m) |
| 28 | 10 venice | venice | 2 | 14.3-18.3 | n | BufferGeometry | (-130,-65 d-x 0.17m) (-93,-5 d+z 0.54m) |
| 29 | 11 kowloon | kowloon | 2 | 4.1-4.1 | n | BufferGeometry | (-5,-65 d+x 0.77m) (5,-65 d-x 0.77m) |
| 30 | 13 goreme | goreme/gorScat:vine:c25 | 2 | 8.5-17.8 | Y(66) | SphereGeometry | (82,-65 d-x 0.1m) (82,-60 d-z 0.14m) |
| 31 | 17 antarctic | antarctic | 2 | 2.3-2.5 | Y(1400) | BoxGeometry | (-172,-440 d+x 1.59m) (-162,-440 d-x 1.1m) |
| 32 | 4 kyoto | kyoto | 1 | 6-6 | n | BufferGeometry | (-15,20 d+z 1.1m) |
| 33 | 4 kyoto | kyoto | 1 | 4.4-4.4 | n | BufferGeometry | (-10,25 d+x 2.01m) |
| 34 | 5 cali | cali | 1 | 3.5-3.5 | n | BufferGeometry | (52,60 d+x 1.93m) |
| 35 | 5 cali | cali | 1 | 6-6 | n | BufferGeometry | (-17,40 d-x 0.13m) |
| 36 | 6 rio | rio | 1 | 2.3-2.3 | n | BufferGeometry | (-52,-30 d-z 1.18m) |
| 37 | 6 rio | rio | 1 | 23.3-23.3 | n | BufferGeometry | (73,-35 d-x 2.18m) |
| 38 | 6 rio | rio | 1 | 4-4 | n | BufferGeometry | (35,80 d-z 0.93m) |
| 39 | 8 sahara | sahara/sahVar:horn:c20 | 1 | 1.7-1.7 | Y(14) | SphereGeometry | (258,-80 d+x 1.46m) |
| 40 | 8 sahara | sahara/sahVar:horn:c25 | 1 | 1.7-1.7 | Y(28) | SphereGeometry | (312,-80 d+x 0.7m) |
| 41 | 9 drift | drift/dri:isles | 1 | 8.3-8.3 | n | BufferGeometry | (-2,30 d+x 1.08m) |
| 42 | 13 goreme | goreme/gorScat:vine:c24 | 1 | 6.9-6.9 | Y(69) | SphereGeometry | (82,-80 d-z 1.78m) |
| 43 | 13 goreme | goreme/gorScat:poplarT:c27 | 1 | 14.6-14.6 | Y(3) | CylinderGeometry | (68,5 d+z 0.78m) |
| 44 | 15 pantanal | pantanal | 1 | 11.4-11.4 | n | BufferGeometry | (92,-110 d+z 0.43m) |
| 45 | 16 cave | cave | 1 | 31.8-31.8 | n | BufferGeometry | (-75,-155 d-z 0.9m) |
| 46 | 16 cave | cave | 1 | 1.6-1.6 | n | BufferGeometry | (-17,-200 d+x 0.67m) |
| 47 | 17 antarctic | antarctic | 1 | 1.9-1.9 | n | PlaneGeometry | (-187,-235 d+z 2.33m) |
| 48 | 18 monaco | Mesh | 1 | 1.7-1.7 | n | SphereGeometry | (-135,65 d-x 0.17m) |

## B. Code pass — helper conventions (read 4 Sep 2026)

Drawing: every chapter merges through a merger object whose `box(x,y,z,w,h,d,...)` takes FULL sizes (shared.js:4729; quay.js:351 and venice.js:336 have their own, same convention). Physics helpers:

| helper | file:line | extents | notes |
|---|---|---|---|
| envStaticBox / envPoolBox | environment.js:770 / 783 | HALF | Sydney |
| quayStaticBox / quayPoolBox | quay.js:459 / 446 | HALF | |
| kyoStaticBox / kyoStaticPair | kyoto.js:305 / 273 | HALF | |
| caliStaticBox | cali.js:344 | HALF | |
| pastoBodyBox | pasto.js:~1205 | HALF | pasto has no single-box helper; pool only |
| manPoolBox | manly.js:399 | HALF | **manStaticBox (373) is FULL** — mixed file |
| panPoolBox | pantanal.js:421 | HALF | **panStaticBox (395) is FULL** — mixed file |
| antStaticBox | antarctic.js:476 | FULL | |
| cavStaticBox | cave.js:387 | FULL | |
| driStaticBox / driStaticGroup.add | drift.js:494 / 529 | FULL | |
| gorStaticBox | goreme.js:438 | FULL | |
| iceStaticBox / iceStaticGroup.add | iceland.js:445 / 466 | FULL | |
| hkStaticBox | kowloon.js:324 | FULL | |
| monStaticBox / monPoolBox | monaco.js:546 / 534 | FULL | |
| palStaticBox / palPoolBox | palawan.js:453 | FULL / (check) | |
| rioStaticBox / rioStaticGroup.add | rio.js:288 / 310 | FULL | takes ry AND rz |
| sahStaticBox / sahStaticGroup.add | sahara.js:369 / 392 | FULL | |
| venStaticBox | venice.js:529 | FULL | ry+rz through THREE Euler YXZ |
| hanPoolBox | hanoi.js:396 | FULL | |
| npc.js addLocal body | npc.js:1908 | HALF (0.26,0.85,0.24) | static box per talking local, every chapter |
| npc.js addBodyAt | npc.js:4539 | HALF | KINEMATIC; Sydney crowd (4761), Pasto cast (8362), Pasto animals (8395) |

## C. Code pass — functions that draw >= 3 merged boxes and add no collider (xtab over all 19 files)

Excluding birds/fish/animals and the unit-geometry init functions. `<-` marks the draw line.

| chapter | function | file:line | what it draws | verdict (code) |
|---|---|---|---|---|
| 1 sydney | envBuildTraffic | environment.js:1881 | moving ferries 1.6x0.66x6.6 hull, on water | low: water, moving |
| 2 quay | quayBuildMoorings | quay.js:2580 | moored yachts (hull 1.55x0.72x5.6, cabin 1.05x0.5) on water | low-med: reachable by swimming, walk-through |
| 2 quay | quayBuildTraffic | quay.js:2963 | cars + 3 trucks (2.9x2.6x14.4) on the bridge deck | low: bridge deck reachability unknown |
| 2 quay | quayBuildFleet | quay.js:3618 | sailing fleet on water, moving | low |
| 2 quay | quayBuildCrowd / quayBuildPax | quay.js:4360 / 4509 | instanced crowd figures (0.48x0.52 shirt, ~1.0 m tall) | PLAUSIBLE walk-through people |
| 4 kyoto | kyoBuildSando | kyoto.js:2317, lanterns at ~2373 (`S.box(mx-3.0, my+0.55, mz, 0.72, 1.10, 0.72)` + cap 0.92x0.14) | stone lanterns along the sando, 1.24 m tall, every path segment; bamboo rail posts 0.09 (thin) | PLAUSIBLE: too tall to step (0.40), no body; the marquee lanterns in kyoBuildLanterns DO have kyoStaticBox (kyoto.js:915) |
| 4 kyoto | kyoBuildPickers | kyoto.js:1900 | tea pickers (figures) | PLAUSIBLE people |
| 5 cali | caliBuildDancers / caliBuildWatchers / caliBuildMiradorLife | cali.js:2544 / 2987 / 2850 | instanced figures | PLAUSIBLE people |
| 6 rio | rioBuildCorcovado | rio.js:1741 | Cristo, 5x1.8x4 plinth + 6.4 m figure, at rioCORCOVADO (-96,78) on an 84 m peak | low: summit, likely unreachable |
| 6 rio | rioBuildPeople | rio.js:2420 | pavement crowd | PLAUSIBLE people |
| 8 sahara | sahBuildPeople / sahBuildPursuers | sahara.js:1626 / 1919 | djellaba figures (cyl r0.2-0.26, 1.4 m) | PLAUSIBLE people |
| 10 venice | venBuildFar | venice.js:3748 | Arsenale block at (40,108) — outside z bound 60; second block 30x6x30 + r11 cyl at (-86,46) | check reachability of (-86,46) |
| 10 venice | venBuildLamps | venice.js:3944 | lamp posts (thin) | low |
| 10 venice | venBuildCrowd | venice.js:5796 | instanced crowd | PLAUSIBLE people |
| 13 goreme | gorFigure calls | goreme.js:1729-1750 (drawn by gorFigure 3123) | three tea drinkers + one on a roof, merged into the town mesh | PLAUSIBLE people, no body |
| 14 manly | manPutFigure calls | manly.js:1643-1656 | surf-club counter staff, queue of ~6, café diners x2 tables — merged into the town mesh | PLAUSIBLE people, no body |
| 14 manly | manBuildBathers | manly.js:2495 | bathers in the water | low |
| 18 monaco | monBuildSmallCraft / monBuildWatchers | monaco.js:2917 / 3136 | small boats on water; watchers | low / PLAUSIBLE people |
| 19 hanoi | hanBuildStools | hanoi.js:2458 | plastic stools (low, < 0.5 m) | low: steppable |

Helpers whose CALLERS do carry the body (checked, clean): hanHouse (hanoi.js:987/1914 -> hanPoolBox), monBlockOf (monaco.js:1361 -> monPoolBox with full extents, +2.4 m taller than drawn), palHull beached bangkas (palawan.js:1068 -> palPoolBox), driAddIsle (deck bodies added by the island loop via driStaticGroup).
