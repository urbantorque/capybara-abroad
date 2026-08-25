import * as THREE from 'three';

// ---------------------------------------------------------------------------
// PALETTE — flat, sun-bleached, pastel. Untitled Goose Game by way of Sydney.
// Nothing outside this file may hardcode a colour.
// ---------------------------------------------------------------------------
export const PALETTE = {
  // ground & terrain
  grass:        0xa8c66c,
  grassDark:    0x8fb35a,
  grassPale:    0xc2d489,
  sand:         0xf0e0b8,
  sandDark:     0xdfcb9d,
  path:         0xe2d7bf,
  soil:         0xb08968,
  stone:        0xcfc6b4,
  stoneDark:    0xb5ab97,

  // harbour
  water:        0x8ecfd8,
  waterDeep:    0x6fb8c9,
  foam:         0xf2fbfb,

  // architecture
  sail:         0xfaf6ec,
  sailShade:    0xe6dfcd,
  sandstone:    0xe4d3ad,
  sandstoneDark:0xcbb68d,
  glass:        0xa9cdd6,
  // The floatplane off Rose Bay. Not a task: the one thing on this harbour you
  // cannot get on, cannot rob, and that does not care that you are there.
  planeYellow:  0xf0c245,
  planeStripe:  0xc4463c,
  planeFloat:   0xf2ede0,
  planeStrut:   0x6f6a60,
  planeDisc:    0xb9b6ac,
  bridge:       0xb9b3a6,

  // flora
  trunk:        0xa3714a,
  trunkDark:    0x8a5d3c,
  leafA:        0x7fae5a,
  leafB:        0x9cc06a,
  leafC:        0x69a05a,
  leafPale:     0xb6cf87,
  hedge:        0x74a057,
  palmLeaf:     0x8bb765,
  fernLeaf:     0x6f9e58,

  // flowers
  petalPink:    0xf2a7bb,
  petalYellow:  0xf5d76e,
  petalPurple:  0xb79ad4,
  petalWhite:   0xf7f3ea,
  petalRed:     0xe58370,
  petalBlue:    0x9dbde0,

  // capybara
  capy:         0xb0784a,
  capyDark:     0x94603a,
  capyLight:    0xc79063,
  capyNose:     0x5f3d29,
  capyEye:      0x2f2118,
  capyEar:      0x8a5a37,

  // people
  skin1:        0xf3cca4,
  skin2:        0xdda878,
  skin3:        0xb07a4f,
  skin4:        0x7f5333,
  hair1:        0x4a3527,
  hair2:        0x2f2620,
  hair3:        0xd8b271,
  hair4:        0x8e5a3c,
  hair5:        0xbfb6ab,

  // clothing pastels
  cloth1:       0xe98b7a,
  cloth2:       0x86b6cd,
  cloth3:       0xf3d08a,
  cloth4:       0xa8c4a2,
  cloth5:       0xd7a9c9,
  cloth6:       0xf1efe4,
  cloth7:       0xb3a7d6,
  cloth8:       0xe9b384,
  denim:        0x7d93b0,
  khaki:        0xcbb181,
  hiVis:        0xf2c14e,

  // props
  wood:         0xc0956a,
  woodDark:     0x9c774f,
  binGreen:     0x6f9a63,
  binRed:       0xcb7264,
  binLid:       0x5c7f54,
  coffee:       0xf4efe3,
  coffeeLid:    0xd6cbb6,
  coffeeLiquid: 0x7a5236,
  bread:        0xecc98d,
  lettuce:      0x9fc46f,
  tomato:       0xdf8072,
  plastic:      0xe8e2d4,
  cone:         0xe98b5f,
  metal:        0xc3c0b6,
  esky:         0xd8ddd6,
  eskyLid:      0xc96a5b,
  towel:        0xefb8a6,
  ball:         0xf0efe6,
  ballStripe:   0xe98b7a,
  ibis:         0xf4f1e6,
  ibisHead:     0x3a332c,
  screenShadow: 0x000000,

  // ---- Cali, Valle del Cauca (chapter 5) ----
  // Cali is a thousand metres up and three degrees off the equator: the light
  // is hard, high and GOLD, and everything painted has been repainted since.
  // This is the only palette in the game allowed to be loud — Kyoto whispers,
  // Cali does not — but it is loud in the way a hot afternoon is, so the reds
  // and yellows are baked rather than neon and the shadows go warm, never blue.
  caliRiver:    0x86b39a,      // the Río Cali runs green over pale stone
  caliRiverDeep:0x5f9179,
  caliStone:    0xd7cbb2,
  caliStoneDark:0xb9ac93,
  caliEarth:    0xc2a077,
  caliGrass:    0x93b160,
  caliGrassDry: 0xc0bd6d,
  caliCane:     0xa8c46a,      // sugarcane, and a lot of it
  caliCanePale: 0xcbd98a,
  caliCaneStem: 0xb8a05a,
  caliCeiba:    0x6f9354,
  caliPalm:     0x87a95c,
  // The samán is the tree of the Paseo Bolívar and it is a PARASOL — wider than
  // it is tall, flat underneath, and a colder darker green than the ceiba so a
  // line of them along the embankment reads as its own thing rather than as
  // more of the same canopy.
  caliSaman:    0x4f7a48,
  caliBougain:  0xc9418c,     // the loudest plant in the world, over every second door
  caliPlantain: 0x74a24d,
  caliChontaduro: 0xd4772e,   // the fruit, on the cart at the mirador
  caliArepa:    0xe8d9a4,
  caliEmber:    0xff9a3c,     // the charcoal under it — the only fire up there
  caliMango:    0x5f8a4c,
  // the painted street. Every one of these is a house colour you can stand in
  // front of in San Antonio or Barrio Obrero.
  caliWall1:    0xe8b44f,      // ochre
  caliWall2:    0xd9614f,      // terracotta red
  caliWall3:    0x5fa5a8,      // that specific caleño teal
  caliWall4:    0xf0e2c4,      // cream
  caliWall5:    0xc4739d,      // rosa
  caliWall6:    0x7d8fc4,      // pale indigo
  caliRoof:     0xb9614a,
  caliRoofDark: 0x94472f,
  caliShutter:  0x3f6b6d,
  caliGrille:   0x4a423a,
  // La Ermita: blue and white, and nothing else in the city looks like it
  caliErmita:   0x9fd0e0,
  caliErmitaTr: 0xf6f9fb,
  caliErmitaRf: 0x5d86a8,
  // El Gato de Tejada, and the chiva
  caliGato:     0x9a8d78,
  caliGatoDark: 0x7b7060,
  caliChiva:    0xe2452f,
  caliChivaTrim:0xf2c744,
  caliChivaBlue:0x2f6fa8,
  caliChivaGrn: 0x3f9a5c,
  // the salsoteca
  caliFloor:    0xb08048,      // sprung board, waxed
  caliFloorLit: 0xf5d98a,
  caliNeonPink: 0xf07aa8,
  caliNeonCyan: 0x6fd8e0,
  caliNeonGold: 0xf7cf5f,
  caliCristo:   0xece5d6,      // Cristo Rey, pale against the ridge
  caliRidge:    0x8a9c72,
  caliRidgeFar: 0x9fb0a8,
  caliSky:      0x8fc9e8,
  caliHaze:     0xe8dcc4,      // the valley haze is warm, not blue
  caliSun:      0xfff0cc,
  // The night the chiva climbs into. Cali sits in a bowl with a ridge on one
  // side, so the night sky over it is never black — it is the colour of a city
  // bounced off low cloud, which is warmer and much lighter than Iceland's.
  caliNightSky: 0x2e2b46,
  caliNightLow: 0x54415c,      // the band of sodium glow above the valley floor
  caliMoonC:    0xcfd0ea,      // the key light after dark: cool, and very dim
  caliCityLite: 0xffd48a,      // one window, a hundred and fifty metres away
  caliCityCool: 0xbfe4ff,      // and the mercury lamps along the avenues
  caliCable:    0x33302c,      // the tangle of it over every barrio street
  caliRoad:     0xa39a8c,      // asphalt, patched, pale with dust
  caliRoadLine: 0xdccfae,
  caliMirador:  0xd2c6ab,      // the parapet you look at the whole valley over

  // ---- Rio de Janeiro (chapter 6) ----
  // Rio is the wettest light in the game. Cali is a dry gold valley; Rio is sea
  // air, and everything is seen through it — so the greens go deep and blue
  // (Atlantic forest, not scrub), the granite goes warm grey-pink, and the sea
  // is a real ocean blue rather than Sydney's shallow harbour green. Two things
  // are allowed to be loud, and both of them are man-made: Selarón's tiles and
  // the parade. The city itself stays pastel and sun-worn behind them.
  rioSea:       0x4f9fc4,      // the Atlantic, and it is deep
  rioSeaDeep:   0x2f7ba4,
  rioSeaFoam:   0xf4fbfb,
  rioSand:      0xefe0bc,      // Copacabana, pale and very wide
  rioSandDark:  0xd9c69c,
  // the calçadão. Portuguese pavement, and the wave is the most copied piece of
  // paving on earth. Not black — the aesthetic law forbids it — but a dark
  // basalt slate that reads as black at silhouette distance.
  rioPaveDark:  0x4a4a4f,
  // the avenue is asphalt, not the calcadao: the wave needs the near-black to
  // read, a whole roadway of it just makes a hole in the middle of the picture
  rioAsphalt:   0x6f6b70,
  rioAsphaltLn: 0xe8e2d4,
  rioPavePale:  0xf1ece0,
  rioGranite:   0xbdb0a8,      // Sugarloaf and Corcovado are warm grey granite
  rioGraniteDk: 0x968b84,
  rioGraniteFar:0xa8a8ae,
  rioForest:    0x4c7a52,      // Tijuca — the biggest urban forest there is
  rioForestDk:  0x3a6142,
  rioForestPale:0x6f9a63,
  rioPalm:      0x5f8f57,
  rioPalmTrunk: 0xb0966e,
  // Santa Teresa and Lapa: colonial pastels, gone chalky in the salt
  rioWall1:     0xf0dcc0,      // cream
  rioWall2:     0xdc8f76,      // salmon
  rioWall3:     0x7fb0b8,      // sea green
  rioWall4:     0xe6c374,      // ochre
  rioWall5:     0xc08fae,      // faded rose
  rioRoof:      0xb56a52,
  rioRoofDark:  0x8f4f3c,
  rioArch:      0xf2ece0,      // the Arcos da Lapa, whitewashed
  rioArchShade: 0xd8d0c0,
  // The bonde de Santa Teresa. Two of them, and the second is a shade deeper so
  // the pass out on the arches reads as two objects rather than one reflected —
  // at the same yellow they photographed as a mirror.
  rioTramYellow:  0xf2c331,
  rioTramYellowDk:0xd9a828,
  rioTramDk:      0x4a453c,    // the frame, the running boards and the trucks
  rioTramWood:    0xb98a52,    // the benches, which run across
  rioTram:        0x9a958a,    // rail head, and it is polished steel
  // Escadaria Selarón. Two hundred odd steps, tiled by one man for twenty
  // years, and overwhelmingly RED — the other colours are accents on it.
  rioTileRed:   0xd14b3f,
  rioTileYellow:0xf0c14e,
  rioTileBlue:  0x4a86b8,
  rioTileGreen: 0x5fa06a,
  rioTileWhite: 0xf4efe2,
  // the bateria and the desfile
  rioDrum:      0xf2ead6,      // surdo skin
  rioDrumShell: 0xd4553f,
  rioDrumHoop:  0xc9c2b2,
  rioFeather1:  0xf2a64e,
  rioFeather2:  0xe45f7a,
  rioFeather3:  0x5fc0d4,
  rioFeather4:  0xf5e06a,
  rioSequin:    0xf7d98a,
  rioFloat:     0xe8dcc0,
  rioCristo:    0xdcd6cc,      // Redentor, pale against the cloud
  rioSky:       0x7fc4e8,
  rioHaze:      0xdce9ee,      // sea haze — this one IS blue, unlike Cali's
  rioSun:       0xfff2da,

  // ---- Iceland (chapter 7) ----
  // The only NIGHT in the game, and the only palette built to be read under a
  // sun that never quite gets up. Everything here is desaturated except two
  // things — the tin houses of Reykjavik and the aurora — and both of them are
  // only loud because the rest of the world has agreed to shut up. The greys
  // are BLUE-cold (Kyoto's are green-cold), the ice is not white but the pale
  // milk-blue of compressed glacier, and the sand is basalt black, which is the
  // one place in this game a near-black is honest rather than a hole.
  iceSkyNight:  0x22304a,      // the sky at midnight in September
  iceSkyLow:    0x3f5670,      // and the band of light that never leaves the north
  iceHaze:      0x4d6480,
  iceSnow:      0xeef3f6,
  iceGlacier:   0xc3dcea,      // compressed ice: milk, with blue in it
  iceGlacierDp: 0x8fbcd4,      // the crevasses
  iceGlacierBl: 0x69a2c4,      // the blue you only get a metre down
  iceMoraine:   0x6b6a68,      // the rubble the glacier pushes ahead of itself
  iceMoraineDk: 0x4e4d4c,
  iceBasalt:    0x3f4247,      // black sand, and the columns at Reynisfjara
  iceBasaltDk:  0x2e3136,
  iceLava:      0x565a58,      // an old lava field
  iceMoss:      0x93a878,      // and the moss on it, which is the only green
  iceMossPale:  0xb2c39a,
  iceLupin:     0x8f8fc4,      // the lupins, which are not native and are lovely
  iceWater:     0x5f8fa8,      // the lagoon
  iceWaterDeep: 0x3f6b86,
  iceBerg:      0xdcecf2,      // and the bergs on it
  iceGeoBlue:   0x6fc0cc,      // a geothermal pool is a colour nothing else is
  iceGeoRim:    0xd8c9a4,      // the silica rim round it
  iceSteam:     0xe4ecef,
  iceMud:       0x8a7263,
  // ---- ALTERED GROUND, WHICH IS WHAT A HIGH-TEMPERATURE FIELD IS MADE OF --
  // The floor of a hverasvaedi is not a lava field and it is emphatically not
  // a lawn: boiling water coming up through basalt strips the rock of
  // everything but its silica, and what is left is bleached white where it is
  // wettest, sulphur-yellow where the gas comes through, and iron-red where
  // it has dried and oxidised. Three values, painted into the ground mesh's
  // own vertex colours, so the basin costs nothing and can never read as
  // something lying on the grass.
  iceSinter:    0xcfc9bb,      // bleached silica, the palest ground in Iceland
  iceSulphur:   0xc9b25f,      // the crust round every vent that is still going
  iceIron:      0x9a6448,      // oxidised clay, which is most of the margin
  iceClay:      0x7a6f63,      // and the grey-brown between the two
  // Reykjavik. Corrugated iron, painted, because there was no timber worth
  // cutting and no stone worth quarrying — so the whole city is primary
  // colours arranged on a grey day.
  iceHouse1:    0xd4544f,
  iceHouse2:    0x4f86b8,
  iceHouse3:    0xe2b451,
  iceHouse4:    0x5fa07f,
  iceHouse5:    0xf0ece2,
  iceHouse6:    0x9a6fa8,
  iceRoofRed:   0xb04a44,
  iceRoofGrey:  0x6f7780,
  iceChurch:    0xdfe3e2,      // Hallgrimskirkja is bare concrete, pale as bone
  iceChurchDk:  0xbfc4c6,
  iceWindow:    0xf5e6a8,      // and every window in the city is lit
  iceHull:      0xc4543f,      // the boats in the old harbour
  iceHullBlue:  0x3f6f9a,
  iceRope:      0xbdae8f,
  icePuffin:    0xf2ede2,
  icePuffinDk:  0x35383d,
  icePuffinBk:  0xe2703f,
  // THE AURORA. Four greens and one rare magenta, because that is what it
  // actually does: the 557.7 nm oxygen line is overwhelming and everything
  // else is a rumour at the edges of it.
  iceAurora1:   0x6ff2b0,
  iceAurora2:   0x4fd8a8,
  iceAurora3:   0xa8f2d8,
  iceAurora4:   0x5fc4e0,
  iceAuroraMag: 0xc48fd8,
  iceStar:      0xf4f6ff,
  iceSun:       0xf2e0c8,      // a very low sun, and a very warm one

  // ---- Marrakech & the Erg (chapter 8) ----
  // The hottest palette in the game and the only one lit from straight
  // overhead. Everything in Marrakech is ONE colour — the city is required to
  // be, and the pigment is iron oxide out of the ground it stands on — so the
  // medina is four shades of the same red-pink ochre and the only relief is
  // what people hang on it: dyed wool, tin lanterns, mint, oranges. The desert
  // is the opposite: two colours, and one of them is the sky.
  sahOchre:     0xd9906a,      // the wall of the medina at noon
  sahOchreDk:   0xb3704f,      // and in shade
  sahOchrePale: 0xe8b48f,      // and where the sun hits it square
  sahOchreDust: 0xc4855f,
  sahPlaster:   0xefd9bd,
  sahCedar:     0x8a6039,      // the carved cedar the good doors are made of
  sahCedarDk:   0x66452a,
  sahTileGreen: 0x4f8f6a,      // the minaret's tiles, and every fountain
  sahTileBlue:  0x3f6f9a,
  sahTileWhite: 0xf2ece0,
  // The storks on the Koutoubia. Not a task: everything else in this chapter
  // wants something from you, and these want nothing at all.
  sahStork:     0xf4efe2,
  sahStorkDark: 0x2f2c28,      // the primaries, and they are the whole silhouette
  sahStorkBill: 0xd2503f,      // bill and legs, and they really are this red
  sahBrass:     0xc9a44f,      // lanterns, teapots, the whole souk
  sahBrassDk:   0x9a7a34,
  // the souk, which is where all the colour in the city has gone
  sahDye1:      0xd4443f,      // madder
  sahDye2:      0xe2a238,      // saffron
  sahDye3:      0x3f7f8f,      // indigo
  sahDye4:      0x8f4f7f,      // cochineal
  sahDye5:      0x6f9a3f,      // henna, before it goes brown
  sahRug1:      0xc45f4f,
  sahRug2:      0xe8c46f,
  sahRug3:      0x4f6f8f,
  sahMint:      0x7fa85f,
  sahOrange:    0xf0913f,
  sahAwning:    0xd9c9a4,
  sahLamp:      0xffdc9a,      // the pressure lamp over every food stall on the square
  sahCanvas:    0xe4d5b8,
  sahRope:      0xb09a72,
  // the erg
  sahSand:      0xe8bf87,      // the dunes, lit
  sahSandLit:   0xf5d9a8,      // the crest, with the sun behind it
  sahSandShade: 0xb98a5a,      // and the lee face, which is a different planet
  sahSandDeep:  0x9a6f45,
  sahGravel:    0xc4a882,      // the hamada you cross to get there
  sahPalm:      0x6f8f4f,
  sahPalmDry:   0xa89a5f,
  sahPalmTrunk: 0xa8875f,
  sahCamel:     0xc9a475,
  sahCamelDk:   0xa8845a,
  sahTent:      0x8a6f4f,      // goat hair, black-brown, and it breathes
  sahTentDk:    0x5f4a35,
  sahFire:      0xf2a03f,
  sahEmber:     0xd9542f,
  sahSmokeDust: 0xd4bc9a,
  // the storm. It is not grey — it is the dunes, airborne.
  sahStorm:     0xc49a6a,
  sahStormDeep: 0x9a7248,
  sahSkyDay:    0x8fc4dc,
  sahSkyHot:    0xd9d4bc,      // the sky at noon here is nearly white
  sahSkyNight:  0x2f3a58,
  sahStarSky:   0xf4f2e8,
  sahHaze:      0xe4cfa8,
  sahSun:       0xfff0d0,

  // ---- THE DRIFT (chapter 9) ----
  // The second night in the game and nothing like the first one. Iceland is lit
  // by windows and a sun that never quite sets; the Drift is lit by ONE MOON and
  // by things that are on fire on purpose, so the whole palette is a cold violet
  // ground with exactly four warm colours on it — the lamp, the lantern, the
  // lampflies and the blossom. Anything else warm would dilute them, and they
  // are the only navigation the chapter has.
  driVoid:      0x120f28,      // straight up
  driVoidLow:   0x241c3d,      // and down where it meets the cloud
  driHaze:      0x342a55,
  driCloud:     0xbdb2d6,      // moonlit cloud top
  driCloudLit:  0xdcd2ee,
  driCloudDeep: 0x8d82ad,
  driGrass:     0x4e7a68,      // grass at night is not grass in the day
  driGrassPale: 0x6f9581,
  driGrassDark: 0x36584f,
  driMoss:      0x5c8878,
  driRock:      0x5e5880,      // the underside of a country
  driRockDark:  0x3b365a,
  driRockPale:  0x8b84a6,
  driStone:     0x9a93b5,
  driSoil:      0x5b4b63,
  driBark:      0x554461,
  driLeafA:     0x5f8f7f,
  driLeafB:     0x7ba892,
  driBlossom:   0xf0c8dd,
  driLamp:      0xffd79a,      // the four warm ones
  driLampGlow:  0xffe9c2,
  driFly:       0xffdf9e,
  driFlyDim:    0x9a8fb0,      // ...and a lampfly asleep, which is none of them
  driPaper:     0xfdf3dc,
  driPaperDim:  0xa9a2bb,
  driStar:      0xf1ecff,
  driMoon:      0xf6f0dc,
  driRibbonA:   0x7fd8d8,
  driRibbonB:   0xd7a0d8,
  driRibbonC:   0x9fb6ee,
  driTimber:    0x5a4a48,
  driPond:      0x8497bd,
  driSeed:      0xe8e0f6,

  // ---- Kyoto & Uji (chapter 4) ----
  // A different light from anywhere else in this game. Sydney is sun-bleached
  // and Pasto is thin cold altitude; Kyoto is a wooded valley in soft haze, so
  // the greens go blue-grey rather than yellow, the timber is dark and warm
  // against it, and exactly two things are allowed to be saturated: the torii
  // and the maples. Everything else holds its breath so those two can shout.
  torii:        0xd4513c,
  toriiDark:    0xa93a2c,
  toriiBase:    0x2f2a28,
  templeWood:   0x7a4b34,
  templeWoodDk: 0x5d3827,
  templeBeam:   0x8f5c3e,
  shoji:        0xf3eee0,
  shojiFrame:   0x6d4a34,
  tatami:       0xd9cf9e,
  kawara:       0x6f7b80,      // roof tile grey-blue
  kawaraDark:   0x555f66,
  gold:         0xe0b64f,
  goldDark:     0xbd9337,
  mossKyoto:    0x6d8f5a,
  mossDark:     0x53703f,
  bambooStem:   0x93ae63,
  bambooPale:   0xb4c882,
  bambooLeaf:   0x7f9c58,
  matchaField:  0x5f8c4e,
  matchaPale:   0x86ab63,
  matchaPowder: 0x93c05c,
  teaCanopy:    0x4a5f4a,
  momiji:       0xd06a45,
  momijiDeep:   0xa8452f,
  sakura:       0xf2ccd6,
  // Inari-yama is a MOUNTAIN OF SUGI, and the wood is the reason the tunnel
  // reads as a tunnel. Blue-cold and DARK — much darker than the valley's moss,
  // because the one thing a cedar wood is, is the shade at the edge of a bright
  // lawn. Two values so the crown has a shape at a hundred metres.
  sugi:         0x4d6b4a,
  sugiDeep:     0x3a5340,
  // Sugi bark is red-brown, and it has to be DARKER than the crown it holds
  // up. At the valley's warm trunkDark the wood rendered as a hillside of pale
  // orange poles with green hats on: the trunks were the brightest thing in the
  // marquee shot and the wood read as a plantation.
  sugiBark:     0x5a3f30,
  sugiFloor:    0x59503c,      // needle litter: brown, and not grass
  lilyPad:      0x5c8a52,
  irisLeaf:     0x6e9a5b,
  teaSack:      0xc9b98a,      // the picker's basket, and the sacks at the mill
  granite:      0xa9a49c,
  graniteDark:  0x8b8780,
  gravelZen:    0xe6e0d2,
  ujiRiver:     0x7fb6c4,
  ujiRiverDeep: 0x5e97ac,
  ujiFoam:      0xeef6f5,      // the standing wave on the upstream face of a boulder
  pondWater:    0x3f6f70,      // the mirror pond: still, deep, and OLD
  pondDeep:     0x2b5155,
  ironDark:     0x2f3236,      // a fire basket, and a cormorant
  paperLantern: 0xf4e7c4,
  indigo:       0x3d5670,
  // The grey heron on the mirror pond. Not a task and not scenery: the one
  // thing in this garden that is alive and has its own opinion about you.
  heronGrey:    0x9aa6ad,
  heronPale:    0xe4e8e6,
  heronDark:    0x3f464c,
  heronBill:    0xd9b45c,
  heronLeg:     0xb08a5c,
  kyotoHaze:    0xdfe7e4,
  kyotoSky:     0xa8cfda,

  // ---- Sydney Harbour & Manly (chapter 3) ----
  // The harbour read from a boat is a different place from the harbour read
  // from the lawn: more sky, more distance, and the water carries the picture.
  // Three depths of blue-green, a foam, and a sun-glitter that is warm rather
  // than white — anything whiter reads as snow at this scale.
  seaNear:      0x8fd2da,
  seaMid:       0x5fb2c6,
  seaFar:       0x4494b4,
  seaFoam:      0xf6fdfd,
  seaGlitter:   0xfdf3d2,
  hullGreen:    0x3f6b5c,
  hullCream:    0xf6f0e0,
  hullRed:      0xc4604f,
  hullBoot:     0x2c4a44,
  deckTeak:     0xc79a63,
  deckTeakDark: 0xa87c4c,
  brassTrim:    0xd9b467,
  cliffRock:    0xd9bd94,
  cliffShade:   0xbc9c76,
  headScrub:    0x7f9b62,
  headScrubDk:  0x62804d,
  pineDark:     0x3f6146,
  pineMid:      0x4d7355,
  manlySand:    0xf4e6c4,
  // the ferry's fenders are thongs — same rubber as the promenade prop's sole
  thong:        0x86b6cd,
  buoyRed:      0xd2604f,
  buoyGreen:    0x5f9a6c,
  buoyYellow:   0xf0c65c,
  wharfIron:    0x8f9a99,
  awningManly:  0xe4795f,
  harbourHaze:  0xd6ecef,

  // ---- Pasto / Nariño, Colombia (chapter 2) ----
  // Cooler, higher-altitude greens than Sydney's sun-bleached palette, plus
  // volcanic greys and the warm colonial creams/terracottas of the plaza.
  paramoGrass:  0x8fae72,
  paramoDark:   0x76935f,
  paramoPale:   0xafc78d,
  paramoSoil:   0x8f7358,
  volcanoRock:  0x8d8378,
  volcanoDark:  0x6f665d,
  volcanoAsh:   0xa39a90,
  volcanoSnow:  0xf4f2ea,
  craterGlow:   0xd98a5f,
  smoke:        0xd8d3cc,
  peakFar:      0xb9c6cc,

  // andean flora
  frailejon:    0xb9b591,
  frailejonBloom: 0xefd97b,
  coffeeBush:   0x6f9a5c,
  coffeeLeaf:   0x5f8a52,
  coffeeCherry: 0xd06a5c,
  eucalyptAnd:  0x86a86e,
  agave:        0x9db98a,

  // colonial architecture
  adobeWall:    0xf1e6d2,
  adobeShade:   0xdcc9ab,
  roofTile:     0xc9755e,
  roofTileDark: 0xa85c48,
  churchWhite:  0xf7f2e6,
  churchTrim:   0xd9c9a8,
  balconyWood:  0xa9784f,
  cobble:       0xc8bda9,
  cobbleDark:   0xb2a691,

  // market
  awning1:      0xdd7a68,
  awning2:      0x6fa8b8,
  awning3:      0xf2c85f,
  awning4:      0xa8bd7c,
  ruana1:       0xc95f52,
  ruana2:       0x5e7fa8,
  ruana3:       0xe0b358,
  empanada:     0xe8b45f,
  arepa:        0xf0dcae,
  maiz:         0xf2cd5c,
  plantain:     0xe3c05a,
  potatoSack:   0xd8c8a6,

  // condor
  condorBody:   0x3a3630,
  condorWing:   0x2e2b26,
  condorRuff:   0xf5f1e6,
  condorHead:   0xc98f5a,
  condorBeak:   0xd8c9a4,
  condorComb:   0xb5735a,

  // pasto atmosphere
  andesSkyTop:  0x7ec8e6,
  andesFog:     0xd7e6e8,
  andesSun:     0xfff4dc,

  // atmosphere
  skyTop:       0x8fd3ea,
  skyBottom:    0xdff2f2,
  fog:          0xcfe8ef,
  sunLight:     0xfff2d4,
  skyLight:     0xbfe4f0,

  // ---- Venice (chapter 10) ----
  // Venice has almost no green in it and almost no primary colour, and the
  // whole city is two materials: Istrian stone, which is nearly white and goes
  // grey-violet in shadow, and brick, which has been rendered over in a plaster
  // that has been failing for four hundred years. Every wall here is a colour
  // that USED to be brighter — that is the entire palette, and it is why nothing
  // in it is saturated. The only two loud things in the city are the gold in the
  // basilica's mosaics and the mooring poles, which are painted like barbers'
  // shops because they belong to somebody.
  venStone:     0xe8e4d8,      // Istrian stone, dry
  venStoneWet:  0xc9c6bd,      // and the same stone under water, which matters here
  venStoneDark: 0xbdb8a8,
  // THE SQUARE IS NOT WHITE. Piazza San Marco is paved in TRACHYTE — a grey
  // volcanic stone from the Euganean hills — with white Istrian ribs laid
  // across it, and the ribs are the pattern everybody has photographed. Drawn
  // in venStone the field was the same value as the ribs, which meant: the
  // pattern was invisible, a hundred and eighty grey pigeons had nothing to sit
  // against, and — worst — a metre of green water over it read as the SAME
  // VALUE as the dry stone, which is the one thing the marquee moment may not
  // do. Measured off the rendered frame at the top of the tide, 23 Aug 2026.
  venTrachyte:  0xa8a49a,
  venTrachyteD: 0x94908a,
  venVerdigris: 0x6f9484,      // the campanile's spire, and nothing else
  venBronze:    0x8a6f47,      // the horses, the Moors, the angel's armature
  venBrick:     0xb4705c,
  venPlaster1:  0xdfa878,      // ochre, gone soft
  venPlaster2:  0xc98a7a,      // venetian red, ninety percent faded
  venPlaster3:  0xe6d2ae,      // cream
  venPlaster4:  0xd9b8a0,      // rosa
  venPlaster5:  0xb8a48c,      // the one that has given up entirely
  venRoof:      0xb5674c,      // pantiles
  venRoofDark:  0x93503a,
  venShutter:   0x6f8a72,      // that specific tired green
  venShutter2:  0x7d6a56,
  venTrim:      0xd8cdb4,
  venGold:      0xd8b45c,      // San Marco, and nothing else
  venGoldPale:  0xeacf8f,
  venMosaic:    0x4c6e86,
  venCanal:     0x6f8f7e,      // the water: green, opaque, and NOT blue
  venCanalDeep: 0x4e6d61,
  venCanalPale: 0x93ac97,
  venFoam:      0xe4ece2,
  venGondola:   0x2b2723,      // black by law since 1562
  venGondolaTr: 0xb08a4e,
  venFerro:     0xcfd2cc,      // the steel comb on the prow
  venBriccola:  0x8f6b4a,      // mooring poles
  venBriccolaR: 0xc4574c,      // and their barber stripes
  venBriccolaW: 0xe9e2d2,
  venPasserelle:0xc9a97c,      // the duckboards
  venPassLeg:   0x9a9186,
  venPigeon:    0x9aa0a6,
  venPigeonDk:  0x6d737a,
  venAwning:    0xd6c2a4,
  venLamp:      0xf2dda6,
  venLagoon:    0x7ea3a8,      // the Bacino, which IS blue, unlike the rii
  venLagoonDeep:0x5d838c,
  venSkyTop:    0xbcd0dc,      // a wet afternoon going gold
  venSkyLow:    0xf0d9bc,
  venFog:       0xdcd8cf,

  // ---- Hong Kong (chapter 11) ----
  // The one palette in this game that is allowed to be electric, because it is
  // the one place whose colour is not daylight at all: after dark Mong Kok is
  // lit by about four hundred signs, and every colour in the street is a colour
  // some shop chose. The trick that keeps it from being neon soup is that the
  // CITY is almost monochrome — wet concrete, grey tile, black window grilles —
  // and the light is the only saturated thing in frame.
  hkConcrete:   0x8c8b86,
  hkConcreteDk: 0x6b6a66,
  hkTile:       0x9aa39c,      // the green-grey mosaic tile on every 1960s block
  hkTile2:      0xb0a894,
  hkTile3:      0x8d9aa8,
  hkGrille:     0x3c3f41,      // window cages
  hkShutter:    0x55585a,
  hkWet:        0x4a4f52,      // the road, which is always wet
  hkNeonPink:   0xff5fa2,
  hkNeonCyan:   0x4ce0ec,
  hkNeonGold:   0xffc94d,
  hkNeonGreen:  0x64e88a,
  hkNeonRed:    0xff6a58,
  hkNeonBlue:   0x6f8dff,
  hkNeonWhite:  0xfaf3e2,
  hkBamboo:     0xc9a961,      // the scaffold, and it really is this colour
  hkBambooDk:   0xa1834a,
  hkLash:       0xd8d2be,      // the nylon ties holding it together
  hkAwning:     0xc4483f,
  hkAwning2:    0x3f7a63,
  hkTaxi:       0xc9463c,      // red, with a silver roof
  hkTaxiRoof:   0xcdd0cf,
  hkTram:       0x2f6b4f,
  hkCrate:      0xd2b98a,
  hkFish:       0xa9c6cc,
  hkLaundry:    0xdfd6c2,
  hkPoleSteel:  0xb9bcbb,
  hkHarbour:    0x2f4a5c,      // Victoria Harbour at night — dark, and it should be
  hkHarbourLit: 0x486a7e,
  hkFerry:      0xe4dcc6,
  hkFerryTrim:  0x3f5f4e,
  // the junk's lugsails. Deep oxblood, because that is genuinely what the
  // tanbark dye goes, and it has to hold its own against a shore full of
  // saturated light without becoming one more neon colour.
  hkJunkSail:   0x9a3327,
  hkSkyTop:     0x24304a,      // a city sky never goes black; it goes orange-brown
  hkSkyLow:     0x6a4f52,
  hkFog:        0x4a4a54,
  hkTowerA:     0x3d5568,      // the far shore, in silhouette
  hkTowerB:     0x2e4356,

  // -------------------------------------------------------------------------
  // CHAPTER 12 — PALAWAN. The first palette in this game that has to work from
  // BELOW. Everything above the waterline is bleached to almost nothing —
  // white sand, white limestone, a sky with no weather in it — because the
  // whole chapter is a bet that the colour is all underneath, and a bright
  // surface is what makes going under feel like a different room.
  //
  // The two greens are not the same green: `palShallow` is what sand looks
  // like through two metres of water and `palDeep` is what nothing looks like
  // through twenty. Everything else is graded between them by depth.
  // -------------------------------------------------------------------------
  palSand:      0xf2e9d2,      // crushed coral, and it really is this white
  palSandWet:   0xd9cfb4,
  palShallow:   0x7fd6c8,      // the famous one. sand seen through two metres.
  palMid:       0x36a5ae,
  palDeep:      0x11566e,
  palAbyss:     0x0a2f45,      // out past the drop-off, where it stops mattering
  palKarst:     0xc9c4b4,      // limestone, sun-facing
  palKarstDk:   0x8e8a7c,      // and the streaked, wet, undercut side of it
  palKarstShadow: 0x5d5b52,
  palJungle:    0x4e7a45,      // the scrub that grows out of bare rock somehow
  palJungleDk:  0x365a34,
  palPalm:      0x63935a,
  palTrunk:     0x9a8563,
  palBangkaHull: 0xe6dcc0,     // the outrigger — white hull, and always repainted
  palBangkaTrim: 0x2f7fa8,
  palBamboo:    0xd6bd7e,      // the outrigger arms, and half the jetty
  palBambooDk:  0xa8934f,
  palThatch:    0xc4a468,
  palRope:      0xbfae8e,
  palCoralPink: 0xf2879a,
  palCoralOrange: 0xf0a05c,
  palCoralViolet: 0xa87cd0,
  palCoralBrain: 0xe4d6a8,
  palCoralFan:  0xe06a7a,
  palWeed:      0x6f9a52,      // seagrass, which is the only lawn down there
  palFishA:     0xffd66b,      // a school. yellow, because a school always is.
  palFishB:     0x5ec8f0,
  palFishC:     0xf07b53,
  palTurtle:    0x6d7f4a,
  palTurtleShell: 0x8a6c3f,
  palClam:      0xbfd6d0,
  palClamLip:   0x7a4f7d,      // the mantle, which is genuinely this colour
  palPearl:     0xf6f2e6,
  palWreck:     0x6b6350,      // a bangka that did not come back
  palWreckDk:   0x4a453a,
  palCaveRock:  0x6a6458,
  palCaveDark:  0x2c2a26,
  palShaft:     0xdff3ff,      // the light coming down the hole in the roof
  palBloom:     0x63f0d8,      // the plankton, and it is the brightest thing here
  palBloomDeep: 0x2ea8c8,
  palSkyTop:    0x8fc9de,
  palSkyLow:    0xf0dcc0,
  palFog:       0x9fd0cf,
  palFogUnder:  0x2b7f92,      // the fog you get when the camera is underwater

  // -------------------------------------------------------------------------
  // CHAPTER 13 — CAPPADOCIA. Volcanic tuff at first light, which is a colour
  // most people do not believe until they have stood in it: rose, cream and
  // apricot in bands, with a hard basalt cap on top of every chimney that has
  // survived. The valley floor is still in shadow when the balloons go up, so
  // the palette runs COLD at the bottom and hot at the top — that vertical
  // gradient is the whole picture, and it is also the mechanic.
  // -------------------------------------------------------------------------
  gorTuff:      0xe8cfae,      // the rock. the whole place is one rock.
  gorTuffRose:  0xe0b49a,
  gorTuffPale:  0xf2e2c8,
  gorTuffDk:    0xa88a72,
  gorTuffShadow: 0x5c5c74,     // the valley floor before the sun gets to it — and
                               // it is BLUE, because at that hour the only thing
                               // lighting a shadow is the sky
  gorBasalt:    0x584f4c,      // the cap that stopped the cone eroding
  gorBasaltDk:  0x3d3634,
  gorSoil:      0xab9781,
  gorVine:      0x6d8a52,      // the vineyards, which are everywhere down there
  gorPoplar:    0xc8c05a,      // and the poplars, which are the only tall thing
  gorPoplarDk:  0x8f9243,
  gorScrub:     0x7d8a63,
  gorRoad:      0xb8a488,
  gorDoor:      0x3f6b7a,      // every cave door in Göreme is painted blue
  gorWindow:    0x4a3f38,
  gorCarpet:    0xa8474a,
  gorPot:       0xb4664a,      // Avanos red clay
  gorPotDk:     0x8a4634,
  gorPigeon:    0xcfc8bd,
  gorPigeonDk:  0x8e8880,
  gorEnvA:      0xe2564f,      // the balloons. six fabrics, and no two adjacent.
  gorEnvB:      0xf2a93b,
  gorEnvC:      0xf2e2b8,
  gorEnvD:      0x4a8fb8,
  gorEnvE:      0x7a5a9a,
  gorEnvF:      0x4f9a6a,
  gorBasket:    0xc9a463,      // wicker
  gorBasketDk:  0x9a7a44,
  gorBurner:    0xffb14a,      // and the one warm light in the frame at 5 a.m.
  gorSteel:     0xa8a49e,
  gorTruck:     0x5a6b52,
  gorSkyTop:    0x3f4f7a,      // still night at the zenith
  gorSkyLow:    0xf5b98a,      // and sunrise on the rim
  gorSkyHigh:   0x6a7fb0,
  gorSun:       0xffd9a0,
  gorFog:       0xd8bfa8,
  gorShadowFog: 0x8a7f8a,

  // -------------------------------------------------------------------------
  // CHAPTER 14 — MANLY. The ocean side of the peninsula, four o'clock, a
  // westerly holding the swell up. This is the same country as chapters 1 and
  // 3 and it must not read as the same PLACE: the harbour is a flat pale
  // blue-green in a bowl of sandstone, and the ocean is a deep bottle green
  // with white on it. So the sea here is the darkest water in the game and the
  // foam is the brightest thing in the frame — that contrast IS the chapter,
  // because the whole of it is reading where the white is.
  // -------------------------------------------------------------------------
  manSand:      0xe9dcb8,      // dry, and half a stop brighter than the harbour's
  manSandWet:   0xc4b28c,      // the swash zone, which moves
  manSandDeep:  0x9c8d6d,      // the bank, seen through the water
  manSea:       0x1f6272,      // out the back. deep, green, and cold-looking
  manSeaMid:    0x2c8494,
  manSeaShal:   0x51b0ad,      // over the bank
  manFace:      0x1a5a6b,      // the face of a wave, which is always darker
  manFoam:      0xf7fdfb,      // the brightest value in the chapter, on purpose
  manFoamDim:   0xd9ece8,      // and the same thing dying in the shallows
  manSpray:     0xffffff,
  manRock:      0x8a7c68,      // Hawkesbury sandstone on the point
  manRockDk:    0x5f5646,
  manRockWet:   0x4a4a42,
  manCliff:     0xa89174,      // North Head, and it is enormous
  manCliffDk:   0x6f6152,
  manScrub:     0x6d7a54,      // coastal heath. grey-green, wind-shorn, low
  manScrubDry:  0x8c8a62,
  manPine:      0x2f5240,      // Norfolk Island pine. nearly black at this hour
  manPineLt:    0x40694e,
  manTrunk:     0x6b6050,
  manPromenade: 0xcfc5ae,      // the paving along the front
  manKerb:      0xb0a68e,
  manKerbDk:    0x8e856f,      // the gutter, the slab joints, and every patch
                               // the council has ever put in the Corso
  manGrass:     0x7d9558,
  manClub:      0xf2eee0,      // the surf club: cream deco, and one red stripe
  manClubTrim:  0xc2453a,
  manClubRoof:  0x8f9a9c,
  manShopA:     0xe4cfa8,      // the Corso, which is low and pastel and awninged
  manShopB:     0xd8b9a8,
  manShopC:     0xc8d2c2,
  manAwning:    0xd4574c,
  manAwning2:   0x3f8fa0,
  manFlagRed:   0xdb4433,      // between these two, and nowhere else
  manFlagYel:   0xf5c92e,
  manPole:      0xe8e4da,
  manTower:     0xf0e6cc,      // the lifeguard tower
  manBoardA:    0xf2f0e4,      // surfboards, leaning in a rack
  manBoardB:    0xe08a4a,
  manBoardC:    0x4a9ab8,
  manBoardD:    0xd94f7a,
  manTowelA:    0xe86a52,
  manTowelB:    0x4fa8c4,
  manTowelC:    0xf2c84a,
  manTowelD:    0xf0f0e6,
  manBoat:      0xecdcb4,      // the surfboat. clinker, varnished, absurdly long
  manBoatTrim:  0xc2453a,
  manOar:       0xd8c090,
  manPoolWall:  0xc9c0a8,      // Fairy Bower, cut into the rock at the point
  manPoolFloor: 0x86a89e,
  manPoolWater: 0x5cbccc,
  manDolphin:   0x6d7f8c,
  manDolphinPl: 0xb8c2c6,
  manPelican:   0xf0ece2,
  manPelicanBk: 0x3a3a38,
  manBill:      0xe8a24a,
  manGroper:    0x3f6f9a,      // the blue groper at Shelly, and he is enormous
  manKelp:      0x5a6b3a,
  manUrchin:    0x3a2f42,
  manBin:       0x3f6b4a,
  manSkyTop:    0x6fb2d8,
  manSkyLow:    0xf6d9ac,      // four o'clock, and the westerly has dust in it
  manHaze:      0xdfd8c4,
  manSun:       0xfff0cc,

  // -------------------------------------------------------------------------
  // CHAPTER 15 — THE PANTANAL. The end of the wet, and the point of the
  // palette is that there are only two values in the whole place: GREEN and
  // BROWN WATER, and the water is a mirror. Everything interesting is a small
  // saturated thing sitting on top of that — a jabiru's red collar, a
  // hyacinth's lilac, an ipê in flower — which is exactly what the real place
  // looks like from a metre off the ground.
  // -------------------------------------------------------------------------
  panWater:     0x8a9a6a,      // the flood, and it is a MIRROR: what you see is
                               // not the water, it is the sky in the water
  panWaterDeep: 0x4a5638,
  panWaterLit:  0xc2cba4,      // two inches over grass: nearly all sky
  panRiver:     0x7d7a52,      // the river proper, and it is genuinely brown
  panRiverDeep: 0x4a4530,
  panSilt:      0x8a7550,
  panSand:      0xd9c396,      // the sandbar, which is where everything sleeps
  panMud:       0x6a5a44,
  panGrass:     0x84a04a,      // the campo. Waist-high on a capybara
  panGrassDry:  0xb0a856,
  panGrassLt:   0xa2bd62,
  panGrassDk:   0x5c7838,
  panReed:      0x7d9a4e,
  panHyacinth:  0x4f7f42,      // camalote. The floating meadow
  panHyaFlower: 0xa88cc8,
  panLily:      0x6f9a52,      // Victoria amazonica, and the rim turns UP
  panLilyRim:   0x8f4f3a,
  panLilyBud:   0xf0e2d0,
  panForest:    0x33582f,      // the gallery forest along the water
  panForestLt:  0x477038,
  panCanopy:    0x3d6a34,
  panTrunk:     0x7a6a52,
  panTrunkDk:   0x51452f,
  panDead:      0xb6a894,      // the dead trees the storks nest in
  panIpe:       0xf2c53a,      // and one tree in flower, which stops the eye
  panIpeRose:   0xd888a8,
  panCapy:      0x9a7852,      // the locals
  panCapyDk:    0x6a4e34,
  panCapyPup:   0xa98a62,
  panCaiman:    0x4e5240,      // jacaré. Two hundred to a bend, and asleep
  panCaimanDk:  0x35392c,
  panCaimanPl:  0xb4a878,
  panJabiru:    0xf4f0e6,      // white bird, black head, RED collar
  panJabiruHd:  0x2a2a2a,
  panJabiruNk:  0xc4423a,
  panHeron:     0xd8d2c0,
  panMacaw:     0x2f6fc4,      // hyacinth macaw, and it is the bluest thing here
  panMacawYel:  0xf2c53a,
  panToucan:    0x2a2a26,
  panToucanBl:  0xe8a02a,
  panOtter:     0x5a4636,
  panOtterBib:  0xe8dcc0,
  panAnteater:  0x6b6258,      // tamanduá-bandeira, and the tail is the point
  panAnteaterW: 0xe6e0d2,
  panAnteaterK: 0x2f2c28,
  panCowbird:   0x2e3038,
  panMudRut:    0x584a38,      // the wheel tracks, and there is water in them
  panCaranda:   0x9a9080,      // the fan palm. A grey pole with a starburst on it
  panNelore:    0xe4dcc8,      // the cattle. A white loaf with a HUMP on it
  panNeloreLt:  0xf2ece0,
  panNeloreDk:  0x8a7f6c,
  panFirefly:   0xd8f07a,      // and the campo at sundown, which is the point
  panEgret:     0xf8f6ee,      // a flight of them, at dusk, low over the water
  panTermite:   0x8c6a4a,      // the mounds, which are the only rock here
  panFence:     0x9a8464,      // the fazenda, and the Transpantaneira
  panPost:      0x7a6448,
  panPlank:     0xa88a5e,      // every bridge on that road is missing one
  panRoof:      0xb85a3a,
  panWall:      0xf0e6d0,
  panSkyTop:    0x5fa2d4,
  panSkyLow:    0xf4e0b8,
  panSkyDusk:   0xe8834a,      // and the crossing happens in this
  panHaze:      0xcfd6bc,
  panSun:       0xffe6b0,

  // -------------------------------------------------------------------------
  // CHAPTER 16 — SƠN ĐOÒNG. A palette for a place with no light in it is a
  // strange thing to write: almost every colour here is what a surface looks
  // like when the ONLY thing lighting it is a noise the capybara made. So the
  // rock runs cool and nearly valueless, and the four things that emit are the
  // whole chromatic range of the chapter — the echo, the glow-worms, the
  // shaft, and the green that grows under the shaft.
  // -------------------------------------------------------------------------
  cavRock:      0x4a4740,      // limestone, unlit. It is not black; nothing is
  cavRockLt:    0x6a6558,
  cavRockDk:    0x2e2c28,
  cavRockWarm:  0x6f5f4a,      // the flowstone, which is honey-coloured
  cavFlow:      0x9a8258,
  cavCalcite:   0xcfc2a0,      // the Great Wall, and it is the pale thing
  cavCalciteLt: 0xe4dcc0,
  cavPearl:     0xf2ead4,
  cavSand:      0x7a6f5c,      // the beaches inside, which are real beaches
  cavMud:       0x453c30,
  cavWater:     0x2a4a52,      // the river. Cold, clear and nearly black
  cavWaterLt:   0x3f7280,
  cavFoam:      0xc8dcdc,
  cavEcho:      0x9fe8ff,      // THE VOICE. Everything it touches goes this way
  cavEchoDim:   0x4a90a8,
  cavGlow:      0x7ef0c4,      // the worms, and they are the only nav aid
  cavGlowDim:   0x2e8a70,
  cavShaft:     0xfff4d0,      // the hole in the roof, two hundred metres up
  cavShaftLo:   0xffe0a0,
  cavJungle:    0x4f8f3a,      // and the forest growing under it. INSIDE a cave
  cavJungleLt:  0x76b84e,
  cavJungleDk:  0x2f5c2a,
  cavFern:      0x89c45c,
  cavPhyto:     0x6fa84a,      // phytokarst: the algae leans toward the light
  cavSwiftlet:  0x3a3630,
  cavFish:      0xe8e4d8,      // and it has no eyes, which you can see
  cavCricket:   0xb8a878,
  cavTent:      0xd9762e,      // the expedition. The only saturated thing in here
  cavTentB:     0x3f7fa8,
  cavRope:      0xc7b26a,      // ...and the fixed line, which says somebody rigged it
  cavMist:      0x8fa8a8,      // the cloud that forms under the doline
  cavSkyTop:    0x1a2028,      // the "sky" in here is the roof
  cavSkyLow:    0x2a3238,
  cavHaze:      0x22282c,
  cavDay:       0xbfe2ea,      // and the daylight at either end of it

  // ---- chapter 17: the Antarctic Peninsula ------------------------------
  // A place with three colours in it — white, a blue-grey sea and the black
  // rock that pokes through — and then five things that are LOUD on purpose,
  // because everything a human has ever left down there is painted so it can
  // still be found in a whiteout: an orange hull, a red hut, a green drum.
  // The whole chapter is built on that contrast.
  antSea:       0x1d3a4a,      // the Southern Ocean, and it is not blue
  antSeaDeep:   0x0e2130,
  antSeaLt:     0x2f5c6e,
  antFoam:      0xdfeef2,
  antBrash:     0xd3e3e8,      // the broken pack, and there is a great deal of it
  antBrashDk:   0xa7bfc8,
  antIce:       0xe8f2f4,      // snow, in the flat light it is nearly always in
  antIceLt:     0xf8fcfd,
  antIceSh:     0xb4cbd6,
  antBlue:      0x6fa9c2,      // and the blue that comes out where it is old
  antBlueDeep:  0x3f7c98,
  antBergLt:    0xf0f7f9,
  antBergSh:    0x9fbdcb,
  antRock:      0x4b4a4d,      // the peninsula itself, where it is not covered
  antRockLt:    0x6d6c6d,
  antRockDk:    0x2c2c30,
  antScree:     0x585149,
  antGuano:     0xb98b62,      // the colony, and it is visible from the water
  antHutRed:    0xb23a2c,
  antHutRoof:   0x333d47,
  antTimber:    0x7a6247,
  antDrum:      0x4a6b4e,
  antMast:      0x8d9296,
  antHull:      0xe0702a,      // the tender. The one warm thing on the water
  antHullDk:    0xa74a18,
  antDeck:      0x6a6357,
  antPeng:      0x1e2226,      // gentoo: black back, white front, orange bill
  antPengW:     0xf3f3ef,
  antPengBill:  0xd9542b,
  antSkua:      0x6a5e4d,
  antPetrel:    0xf7fbfb,
  // ...AND SHE IS DARK, BECAUSE THIS CHAPTER HAS AN ALBEDO CEILING.
  // 0x6d7a79 is 0.43 of albedo, and on a continent lit by a hemisphere at 1.24
  // with a white ground bounce and an ambient of 0.36, anything much over 0.25
  // saturates toward white — the same fact that hid the guano, the whalers'
  // beach and the hut windows. Photographed alongside a swimming capybara, the
  // one animal in the chapter that is supposed to be alarming came out the
  // colour of the brash ice it was swimming through. A leopard seal is almost
  // black on top and it is the darkest thing in the water for a thousand miles.
  antSealHide:  0x323d3f,      // the leopard seal, which is the wrong shape
  antSealBelly: 0x93a09e,
  antWeddell:   0x8b8678,
  antOrca:      0x121517,      // and the pod, which is the reason to come
  antOrcaW:     0xf5f7f5,
  antOrcaSaddle: 0x93a3a4,
  antSkyTop:    0x8ab2ca,
  antSkyLow:    0xe2ecf0,
  antSun:       0xfff2dc,
  antHaze:      0xc6d8e0,
  antBone:      0xd7ceb9,      // what the whalers left, and it is still there
  antWindow:    0xffd79a,

  // ---- THE MICRO-ENVIRONMENT (weather.js owns; see GLOBAL ENVIRONMENT) -----
  // Every colour the micro-atmosphere can put ON TOP of a biome. None of them
  // replaces a biome's own palette: they are what a drizzle, a cloud shadow or
  // a drifting mote ADDS, and at zero intensity none of them is drawn at all.
  wxDrizzle:    0xc9d8e2,      // a rain streak seen against a light sky
  wxDrizzleNt:  0x9fb4c6,      // ...and against a dark one, where it catches lamps
  wxHazeWet:    0xb9c6cc,      // the colour the fog goes when the air has water in it
  wxSheen:      0xd6e2e8,      // the lift a wet surface puts on whatever it reflects
  wxMist:       0xcfd9d6,      // ground mist, and the breath of a cave river
  wxFirefly:    0xd8ff9c,      // the Pantanal at dusk, and the Drift all night
  wxFireflyHot: 0xfaffd8,      // the middle of the same spark, where it blooms
  wxMote:       0xe8dfc9,      // dust in a shaft of light. Interiors, and Goreme.
  wxMoteWarm:   0xf0d9a8,
  wxSpore:      0xcfe6d2,      // whatever it is that floats about up in the Drift
  wxLeafAut:    0xd9975a,      // an autumn leaf, on its way down
  wxLeafAutB:   0xc46f42,
  wxSpray:      0xeef4f4,      // salt, thrown up the beach by a westerly
  wxSnowflake:  0xf6fbff,      // spindrift, which is not snow falling but snow moving
  wxSeed:       0xf2ead6,      // the fluff off a valley tree in Cali

  // atmosphere (Sydney)
  groundLight:  0xbcae86,
};

// ---------------------------------------------------------------------------
// Material factory. Cached, flat-shaded Lambert only. Never construct
// MeshLambertMaterial directly — go through this so the cache stays effective.
// mat(0xff0000) / mat(PALETTE.grass, { side: THREE.DoubleSide, transparent: true, opacity: .8 })
// ---------------------------------------------------------------------------
const _matCache = new Map();
export function mat(color, opts) {
  const key = color + '|' + (opts ? JSON.stringify(opts) : '');
  let m = _matCache.get(key);
  if (m) return m;
  m = new THREE.MeshLambertMaterial(Object.assign({ color, flatShading: true }, opts || {}));
  _matCache.set(key, m);
  return m;
}

// ---------------------------------------------------------------------------
// Task list — the goose-game checklist. IDs are contract-locked.
// ---------------------------------------------------------------------------
// `chapter` gates when a task is revealed. Chapter 1 is visible from the start;
// chapter 2 unlocks once every chapter-1 task is ticked (systems.js owns the reveal).
// ORDER IS PACING. systems.js shows a rolling window of the first few unticked
// tasks of wherever you are standing, so this array is not a menu — it is the
// order the player meets the game in. Two rules held it together:
//   - open on something you can do in the first ten seconds, without walking;
//   - put the big set-piece early enough to be a reward, not a reward for
//     finishing. In Pasto the condor is the whole chapter, so it is fourth: two
//     bits of market mischief to teach grab and barge, then the bird.
//
// ---------------------------------------------------------------------------
// `wow` — THE ONE MOMENT THE CHAPTER IS FOR.
//
// Ninety-one ticks all sounded exactly the same. Stealing a hat in the Botanic
// Gardens and bringing the northern sky down over a glacier both got: one tick
// chime, twelve scraps of paper, one rounded toast. The game had no way at all
// to say THIS ONE IS DIFFERENT, so the biggest twenty seconds in each chapter
// were rewarded like the smallest.
//
// Exactly ONE task per chapter carries `wow`, and the value is the caption the
// banner prints under it. The scarcity is the whole mechanism: a second one in
// a chapter would halve what the first is worth, so if a new set piece is ever
// better than the row that holds the flag, MOVE the flag — never add to it.
//
// systems.js reads it in completeTask() and pays out on three channels at once
// (see sysWOW): a euphoric lift in the score that resolves in the chapter's own
// key, a banner instead of a toast, and a burst of paper big enough to see.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// `mini` — THE MIDDLE RUNG, AND WHY THERE HAD TO BE ONE.
//
// With `wow` built, a chapter had exactly two kinds of line in it: the one
// moment it is for, and a hundred and fifteen switches. That is the right shape
// for 'steal an empanada' and it quietly flattened everything in between —
// riding a thing, being carried by a thing, standing somewhere at the moment
// something happens. Those are not the chapter's marquee and they are emphati-
// cally not 'pick the sandwich up off the rug', and there was nowhere to say so.
//
// A `mini` is a set piece that runs for twenty or thirty seconds, has a build
// and a payoff, and is worth crossing the map for — but is not what the postcard
// of the place would have on it. ONE OR TWO PER CHAPTER, never more: the same
// scarcity argument the banner is built on, one rung down. The value is the
// kicker printed over the task on the moment card.
//
// systems.js pays it out on the same three channels as `wow` and at roughly half
// of each: the same lift figure in the same key at 0.55, the moment card instead
// of the banner, eighteen scraps instead of twenty-four. It is deliberately a
// BIGGER TICK rather than a smaller marquee — the two have to stay different in
// kind or the banner stops meaning anything.
//
// A mini is also the pacing lever. Eleven of the thirteen chapters were eight
// tasks long, which measured at fifteen to twenty minutes of casual play against
// a target of twenty to thirty-five; a mini is worth two or three of those
// minutes on its own and more than that in reasons to wander about looking for
// the thing that makes it happen.
//
// ---- `act` — AND WHAT SHAPE THE CHAPTER IS (v18) --------------------------
//
// Seventeen chapters had exactly one structure between them: turn up, work
// through eight to nineteen switches in whatever order you like, tick the one
// marquee somewhere in the middle, leave. The CONTENT of them could not be more
// different and the SHAPE of them never varied once in eight hours, and shape
// is the thing a player feels at hour four rather than hour one.
//
// So a row may carry `act: 2` or `act: 3`. No `act` means act 1. The paper
// offers the lowest act that still has something open in it, and CHAPTERS.acts
// names the movement as it opens.
//
// TWO RULES, AND THE SECOND ONE IS THE WHOLE SAFETY ARGUMENT:
//
//   1. Nothing is GATED. `completeTask` has never heard of an act and never
//      will — do an act-3 thing in the first minute and it ticks, exactly as
//      it always did. An act stages the TELLING, not the world.
//   2. F and a tap still reach every open row in the chapter, whatever act it
//      is in (see todoStep/todoPinTo). A player who wants to shop the whole
//      list can, always, one keypress away. So a chapter cannot be soft-locked
//      by an act, and a task cannot be hidden from somebody looking for it.
//
// Six chapters carry one; eleven are flat lists and are untouched. That ratio
// is the point — variety means SOME of them are different, not that all of them
// are, and a game where every chapter has a twist has no twists in it.
// ---------------------------------------------------------------------------
export const TASKS = [
  // ---- Chapter 1: Sydney. The gardens, then the forecourt, then the quay ----
  { id: 'wheek',        text: 'Announce yourself (wheek)',              chapter: 1 },
  { id: 'steal-hat',    text: 'Steal a tourist’s hat',                  chapter: 1 },
  { id: 'coffee-spill', text: 'Make someone spill their flat white',    chapter: 1 },
  { id: 'picnic-thief', text: 'Steal the picnic sandwich',              chapter: 1 },
  { id: 'bin-chicken',  text: 'Knock over a bin (for the ibis)',        chapter: 1 },
  { id: 'dig-flower',   text: 'Dig up the gardener’s prize rose',       chapter: 1 },
  { id: 'chased',       text: 'Get chased by the gardener',             chapter: 1 },
  { id: 'photo-op',     text: 'Get your photo taken',                   chapter: 1 },
  { id: 'opera-stage',  text: 'Take the stage at the Opera House',      chapter: 1, wow: 'SYDNEY' },
  { id: 'ball-harbour', text: 'Put the beach ball in the harbour',      chapter: 1 },
  { id: 'swim',         text: 'Have a dignified swim',                  chapter: 1 },
  { id: 'hat-harbour',  text: 'Drop the stolen hat in the harbour',     chapter: 1 },
  // The quay is Sydney: same biome, same coordinates, a walk up the promenade
  // from the Opera House forecourt. It is not a chapter of its own — a chapter
  // is a PLACE you have to travel to, and there are two of those.
  { id: 'cafe-table',    text: 'Stand on a café table',                 chapter: 1 },
  { id: 'busker-hat',    text: 'Rob the busker mid-song',               chapter: 1 },
  { id: 'dog-loose',     text: 'Let the dog off its lead',              chapter: 1 },
  { id: 'seagull-chips', text: 'Introduce the seagulls to the chips',   chapter: 1 },
  { id: 'sprinkler',     text: 'Soak a tourist with the sprinkler',     chapter: 1 },
  { id: 'ferry-ride',    text: 'Stow away on the ferry',                chapter: 1 },
  // The mini. Sydney had exactly one moving thing in it and it was forty metres
  // offshore; this one comes past you, twice a minute, ringing.
  { id: 'whippy-run',    text: 'Ride the ice cream van down the promenade', chapter: 1,
    mini: 'MR WHIPPY' },

  // ---- Chapter 2: Pasto, Nariño — the Galeras volcano ----
  // 'to-pasto' ticks itself the moment you arrive, so the window the player
  // actually opens on is empanada / stall / whistle / ride: two easy wins in the
  // market, and then the condor, which is the thing worth coming for.
  { id: 'to-pasto',        text: 'Emigrate (somehow)',                    chapter: 2 },
  { id: 'steal-empanada',  text: 'Steal an empanada',                     chapter: 2 },
  { id: 'market-chaos',    text: 'Bring down a market stall',             chapter: 2 },
  { id: 'whistle-condor',  text: 'Call down a condor',                 chapter: 2 },
  { id: 'condor-ride',     text: 'Grab its talons and hold on',           chapter: 2, wow: 'GALERAS' },
  { id: 'thermal-peak',    text: 'Ride a thermal to the crater rim',      chapter: 2 },
  { id: 'crater-drop',     text: 'Post something into the crater',        chapter: 2 },
  { id: 'ruana-thief',     text: 'Make off with a ruana',                 chapter: 2 },
  { id: 'church-bell',     text: 'Ring the church bell (badly)',          chapter: 2 },
  { id: 'coffee-scatter',  text: 'Scatter the coffee harvest',            chapter: 2 },
  // The mini. Pasto is the Carnaval de Negros y Blancos and the chapter
  // never said so; the plaza also never moved.
  { id: 'carroza',       text: 'Ride the carnival float up the plaza',           chapter: 2,
    mini: 'EL CARNAVAL' },

  // ---- Chapter 3: Sydney Harbour — Circular Quay to Manly ----
  // A chapter is somewhere you have to travel to, and this is the only one you
  // travel to BY DRIVING. The list is therefore a voyage: take the wheel, get
  // out past the Bridge, and hold a heading for seven hundred metres of open
  // water. Everything else on it is something worth turning the wheel for.
  { id: 'to-quay',        text: 'Cast off from the Quay',                chapter: 3 },
  { id: 'take-helm',      text: 'Take the helm',                         chapter: 3 },
  { id: 'under-bridge',   text: 'Sound off under the Bridge',            chapter: 3, act: 2 },
  { id: 'yacht-race',     text: 'Cut through the yacht race',            chapter: 3, act: 2 },
  { id: 'dolphin-escort', text: 'Earn a dolphin escort',                 chapter: 3, act: 2 },
  { id: 'manly-voyage',   text: 'Bring her alongside at Manly',          chapter: 3, act: 2, wow: 'THE HARBOUR' },
  { id: 'manly-pine',     text: 'Raid the chip shop on the Corso',       chapter: 3, act: 3 },
  // The mini. The shortest list in the game, on four hundred metres of
  // water that had nothing else moving on it.
  { id: 'ferry-salute',  text: 'Trade horns with the Manly ferry',               chapter: 3, act: 2,
    mini: 'THE FRESHWATER' },

  // ---- Chapter 4: Kyoto & Uji ----
  // The quietest place in the game, which is the joke: every line on this list
  // is a small loud thing done somewhere that has been carefully arranged for
  // several hundred years. Uji is the matcha town down the river, and the
  // chapter ends there, because the tea is the point.
  { id: 'to-kyoto',       text: 'Turn up in Kyoto',                      chapter: 4 },
  // THE SECOND MINI, and the chapter had room for it: forty-four gates up a
  // mountain of sugi is the shot everybody who has ever heard of this place has
  // in their head, and it was paying out with a tick and a line of text — the
  // same channel as knocking over a lantern. See the `mini` note above and
  // [[capy3-the-middle-rung]]: a set piece worth twenty-five seconds gets the
  // half-lift and the moment card, not a bigger toast.
  { id: 'torii-run',      text: 'Run the whole torii tunnel',            chapter: 4,
    mini: 'SENBON TORII' },
  { id: 'lantern-topple', text: 'Topple a stone lantern',                chapter: 4 },
  { id: 'zen-ruin',       text: 'Redesign the rock garden',              chapter: 4 },
  { id: 'golden-swim',    text: 'Swim in the golden pond',               chapter: 4 },
  // The pond's other half. The six granite stones out to the island have been
  // there since the chapter was written, described in their own comment as the
  // only dry way aboard, and nothing ever asked anybody to use them.
  { id: 'dry-crossing',   text: 'Cross to the island without getting wet', chapter: 4 },
  { id: 'bamboo-dash',    text: 'Tear through the bamboo grove',         chapter: 4 },
  // The chapter's set piece, and the only thing in the game with nothing at all
  // to hold on to. It sits here because the four above it are the quiet ones and
  // this is where the chapter stops whispering — and because it is the way you
  // GET to Uji, so everything after it happens where the river put you.
  { id: 'uji-run',        text: 'Take the Uji down to the mill',         chapter: 4, wow: 'THE UJI' },
  { id: 'matcha-raid',    text: 'Get into the matcha at Uji',            chapter: 4 },
  { id: 'whisk-spin',     text: 'Whisk the largest bowl of tea in Japan', chapter: 4 },
  // The mini, and the one that is not a ride: the loudest object in Japan,
  // and a metre of daylight under the rim of it.
  { id: 'the-bell',      text: 'Be inside the bell when it goes',                chapter: 4,
    mini: 'THE BONSHO' },

  // ---- Chapter 5: Cali, Valle del Cauca ----
  // The salsa capital of the world, and the only chapter whose centrepiece is
  // a RHYTHM: the dance floor is judged against the actual audio clock, so
  // 'Dance salsa, properly' is the one task in the game you cannot brute-force.
  { id: 'to-cali',        text: 'Land in Cali',                          chapter: 5 },
  { id: 'gato-sit',       text: 'Sit on the Cat of Tejada',              chapter: 5 },
  { id: 'lulada',         text: 'Make off with a lulada',                chapter: 5 },
  // The Rio Cali is the axis this whole chapter is laid out along — the Gato on
  // one bank, La Ermita on the other, the chiva over the top — and in nine tasks
  // it was scenery with a bridge across it.
  { id: 'puente-ortiz',   text: 'Swim under the Puente Ortiz',             chapter: 5 },
  { id: 'chiva-ride',     text: 'Get on the chiva',                      chapter: 5 },
  // The chapter's set piece, and it is fifth for the same reason the condor is
  // fourth in Pasto: you get on the roof, and then the roof leaves. Everything
  // after this line happens at night, because the ride is what puts the sun
  // down — see caliNight() in cali.js.
  { id: 'chiva-mirador',  text: 'Ride it up to the mirador',             chapter: 5, wow: 'CALI' },
  { id: 'cane-run',       text: 'Disappear into the sugarcane',          chapter: 5 },
  { id: 'salsa-dance',    text: 'Dance salsa, properly',                 chapter: 5 },
  { id: 'cristo-rey',     text: 'Climb up to Cristo Rey',                chapter: 5 },
  // The mini, and the way back down. Everything that goes up in this game
  // has something at the far end that returns you. Cali did not.
  { id: 'cart-run',      text: 'Run the fruit barrow off the ridge',             chapter: 5,
    mini: 'LA CARRETILLA' },

  // ---- Chapter 6: Rio de Janeiro ----
  // The second chapter built on a beat, and deliberately NOT a second salsa
  // floor. Cali is a circle you stand in where any beat will do. Samba is in
  // 2/4 and the surdo — the heartbeat of a bateria, the drum you feel in your
  // chest from two streets away — lands on the TWO. So Rio's centrepiece MOVES
  // (a parade is a column going somewhere, and you have to keep station in it)
  // and only every other beat counts. Hitting the one is not a near miss; it is
  // the wrong beat, and the bateria will let you know.
  { id: 'to-rio',         text: 'Turn up in Rio',                       chapter: 6 },
  // Burle Marx's wave: the most copied paving on earth, drawn for a hundred and
  // ninety metres so it is recognisable in the very first frame, and never used.
  { id: 'calcadao',       text: 'Run the whole wave',                   chapter: 6 },
  { id: 'globo-biscuit',  text: 'Rob the biscoito Globo man',           chapter: 6 },
  { id: 'futevolei',      text: 'Head the ball into the Atlantic',      chapter: 6 },
  { id: 'kiosk',          text: 'Help yourself at the kiosk',           chapter: 6 },
  { id: 'selaron-steps',  text: 'Take Selarón’s steps at speed',        chapter: 6 },
  { id: 'bateria',        text: 'Get in among the bateria',             chapter: 6 },
  { id: 'samba-parade',   text: 'Samba down the avenue, on the two',    chapter: 6, wow: 'RIO' },
  { id: 'bondinho',       text: 'Stow away on the Sugarloaf cable car', chapter: 6 },
  { id: 'arpoador',       text: 'Take the applause at Arpoador',        chapter: 6 },
  // The mini, and it is built entirely out of flow() — a wave is a patch of
  // water that is itself going somewhere, not a force and not a new verb.
  { id: 'take-a-wave',   text: 'Take a wave in at Arpoador',                     chapter: 6,
    mini: 'THE SET' },
  // The second mini, and it was half built already: rioBuildLapa put forty-two
  // arches over Lapa with a deck on top and the comment "where the tram runs",
  // and then nothing ran on it and nothing could stand on it.
  { id: 'o-bonde',       text: 'Cross the arches on the running board',          chapter: 6,
    mini: 'O BONDE' },

  // ---- Chapter 7: Iceland — Reykjavik, the geysers and the glacier ----
  // The first chapter that happens at NIGHT, and the first one whose centrepiece
  // is not a thing you do to somebody: it is a thing the sky does to you. The
  // shape of the list is a night out — noise in town, then further and further
  // from the lights, and the last two lines are the quietest in the game.
  //
  // The pacing rule holds: 'pylsa' is four steps from where you land, and the
  // set-piece (a geyser that throws a capybara twenty-five metres) is third.
  { id: 'to-iceland',     text: 'Turn up in Iceland',                    chapter: 7 },
  { id: 'pylsa',          text: 'Rob the hot dog stand',                 chapter: 7 },
  { id: 'organ',          text: 'Lean on the church organ',              chapter: 7 },
  { id: 'geysir',         text: 'Ride Strokkur',                         chapter: 7, act: 2 },
  { id: 'puffins',        text: 'Get in among the puffins',              chapter: 7 },
  { id: 'glacier-run',    text: 'Take the glacier down in one go',       chapter: 7, act: 2 },
  // The snowcat was built as a pacing fix — the moraine is the toll on the best
  // twenty seconds in the chapter, charged every attempt — and it did the job so
  // quietly that a player could finish Iceland without ever noticing the one
  // thing in it that offers them a lift.
  { id: 'snowcat',        text: 'Cadge a lift off the piste machine',    chapter: 7, act: 2 },
  { id: 'hot-spring',     text: 'Have a long sit in the hot spring',     chapter: 7, act: 3 },
  // The mini. Iceland had a carrier already and did not need a second one;
  // what it had nothing of at all was something alive.
  { id: 'the-whale',     text: 'Be on the pier when the whale comes up',         chapter: 7,
    mini: 'THE BAY' },
  { id: 'aurora',         text: 'Bring the sky down',                    chapter: 7, act: 3, wow: 'ICELAND' },

  // ---- Chapter 8: Marrakech & the Erg ----
  // The densest place in the game immediately followed by the emptiest, which
  // is the whole chapter: the medina is a maze full of people who all want
  // something, and forty minutes east there is nothing at all in any direction.
  //
  // 'souk-escape' is the first task in this game that you can LOSE. Everything
  // else is a thing you do until it works; this one is a thing that is done to
  // you until you get out, and it is third because a chapter should show you
  // its new verb early.
  { id: 'to-sahara',      text: 'Turn up in Marrakech',                  chapter: 8 },
  { id: 'orange-cart',    text: 'Rob the orange juice cart',             chapter: 8 },
  { id: 'snake-basket',   text: 'Sit in the snake charmer’s basket',     chapter: 8 },
  { id: 'souk-escape',    text: 'Lose them in the souk',                 chapter: 8 },
  // Ninety palms in the palmeraie, and not one of them had anything on it.
  { id: 'date-palm',      text: 'Bring the dates down',                   chapter: 8, act: 2 },
  { id: 'caravan',        text: 'Ride out with the caravan',             chapter: 8, act: 2 },
  { id: 'dune-surf',      text: 'Come down the great dune',              chapter: 8, act: 2, wow: 'THE ERG' },
  { id: 'sandstorm',      text: 'Stand in the sandstorm',                chapter: 8, act: 3 },
  { id: 'fire-circle',    text: 'Take over the fire circle',             chapter: 8, act: 3 },
  // The mini, and the only one of the thirteen that uses capy.launch():
  // everything else carries you or leans on you. This throws you.
  { id: 'acrobats',      text: 'Let the acrobats throw you',                     chapter: 8,
    mini: 'JEMAA EL-FNAA' },

  // ---- Chapter 9: the Drift ----
  // The first chapter with nobody in it. Eight places in a row where the list
  // is 'take that from that person' has a ceiling, and this is what is on the
  // other side of it: a list made entirely of MOVEMENT, in a world where the
  // movement is not the movement you have spent eight chapters learning.
  //
  // 'puff-up' is second for the reason the condor is fourth in Pasto and
  // 'souk-escape' is third in Marrakech — a chapter shows you its new verb
  // early, before it asks you to rely on it. 'cloud-dive' is third and it is
  // deliberately the easiest thing on the page: the one fear this chapter has
  // to disarm in its first minute is the fear of falling off, and the fastest
  // way to disarm it is to make falling off a TICK.
  { id: 'to-drift',    text: 'Wake up somewhere impossible',              chapter: 9 },
  { id: 'puff-up',     text: 'Wheek in mid-air (trust me)',               chapter: 9 },
  { id: 'cloud-dive',  text: 'Step off the end of the jetty',             chapter: 9 },
  // The chapter's one instrument, and the thing that turns 'long-gap' from a
  // jump that sometimes works into a puzzle about WAITING.
  { id: 'weathervane', text: 'Watch the wind come all the way round',     chapter: 9 },
  { id: 'lampfly',     text: 'Introduce yourself to a lampfly',           chapter: 9 },
  { id: 'updraft',     text: 'Let a column of air carry you up',          chapter: 9 },
  // The chapter promises this and never says it out loud: falling off is not a
  // punishment, and the cloud gathers under you and gives you back. 'cloud-dive'
  // pays for the falling; nothing paid for the part that matters.
  { id: 'handed-back', text: 'Let the cloud hand you back',               chapter: 9 },
  { id: 'wander-isle', text: 'Hitch a lift on a wandering island',        chapter: 9 },
  { id: 'long-gap',    text: 'Cross twenty metres of nothing, in one go', chapter: 9 },
  { id: 'lantern',     text: 'Light the lantern at the top of the world', chapter: 9, wow: 'THE DRIFT' },
  // The mini, and the only thing up here you have to CATCH.
  { id: 'driftseed',     text: 'Cross the void on a seed',                       chapter: 9,
    mini: 'THE SEED' },

  // ---- Chapter 10: Venice ----
  // The first chapter whose OBSTACLE is the floor. Ten places in a row have
  // agreed on one thing without ever saying it — that the ground is where it
  // was last time you looked — and Venice is a city that has never agreed to
  // that in its life. The tide is a clock running under the whole chapter: the
  // calli you learn in the first two minutes are gone by the last one, the
  // duckboards are the only dry route for about ninety seconds, and then they
  // are not a route either, they are boats.
  //
  // The pacing rule holds. A theft you can do without walking is second; the
  // new verb — READ THE WATER — is fourth, on the duckboards, before anything
  // depends on it; and the set piece is seventh, because it is a thing the city
  // does to you and it should arrive when you have stopped expecting it.
  { id: 'to-venice',    text: 'Turn up in Venice',                      chapter: 10 },
  { id: 'spritz-theft', text: 'Make off with somebody’s spritz',        chapter: 10 },
  { id: 'pigeon-storm', text: 'Put up every pigeon in the piazza',      chapter: 10 },
  { id: 'passerelle',   text: 'Run the duckboards, end to end',         chapter: 10, act: 2 },
  // The duckboards end at the campo, and in the middle of the campo is the one
  // thing every square in Venice has: the cap of a rainwater cistern, because a
  // city standing in water has none of it fit to drink.
  { id: 'the-well',     text: 'Look down the campo’s well',             chapter: 10 },
  // ...and the maze the duckboards lead INTO, which had no task in it at all.
  { id: 'the-calli',    text: 'Cross the calli, side to side',          chapter: 10 },
  { id: 'gondola-ride', text: 'Ride the prow of a gondola',             chapter: 10 },
  { id: 'rialto',       text: 'Take the Rialto at a run',               chapter: 10 },
  { id: 'acqua-alta',   text: 'Be in San Marco when it goes under',     chapter: 10, act: 2, wow: 'SAN MARCO' },
  { id: 'mirror-swim',  text: 'Swim the length of the flooded square',  chapter: 10, act: 2 },
  // The mini. Everybody who lives here stands up for it; everybody who
  // does not sits down, and is laughed at.
  { id: 'traghetto',     text: 'Cross on the traghetto, standing',               chapter: 10,
    mini: 'IL TRAGHETTO' },
  // The second mini, and the only thing in this chapter that goes UP. A city
  // whose whole argument is about a metre of water never once shows you itself
  // from above; the rig for the Volo has been up since Carnevale.
  { id: 'volo',          text: 'Take the angel’s flight off the campanile',      chapter: 10,
    mini: 'IL VOLO' },

  // ---- Chapter 11: Hong Kong ----
  // Eleven chapters of moving about on a plane, and this is the one that asks
  // for the other axis. Everything on this list happens between the pavement and
  // the roof of a fourteen-storey tong lau, and the verb that gets you there —
  // hold E against bamboo and push the stick INTO it — is third, for the same
  // reason the condor is fourth in Pasto: show the new thing early, then rely
  // on it.
  //
  // The set piece is seventh and it is the only marquee moment in this game that
  // is scored: at eight o'clock the far shore lights up a tower at a time, on
  // the beat, and the only place you can see it from is somewhere you had to
  // climb to. Miss it and it comes round again, because a thing you can miss for
  // ever is a punishment and this is a game about a rodent.
  { id: 'to-kowloon',   text: 'Turn up in Kowloon',                     chapter: 11 },
  { id: 'egg-tart',     text: 'Rob the bakery on Fa Yuen Street',       chapter: 11 },
  { id: 'bamboo-climb', text: 'Go up the bamboo',                       chapter: 11 },
  { id: 'laundry-pole', text: 'Cross the street on the laundry poles',  chapter: 11 },
  { id: 'wet-market',   text: 'Let the fish out at the wet market',     chapter: 11 },
  { id: 'neon-sign',    text: 'Hang off the biggest sign in Mong Kok',  chapter: 11 },
  { id: 'symphony',     text: 'Be on the roof when the lights come on', chapter: 11, wow: 'HONG KONG' },
  { id: 'star-ferry',   text: 'Ride the Star Ferry across',             chapter: 11 },
  // Sydney sounds off under the Bridge and it is the best thirty seconds in
  // chapter three. This ship has had a horn on it since 1957.
  { id: 'ferry-horn',   text: 'Lean on the Star Ferry’s horn',          chapter: 11 },
  // Eight hundred metres of harbour across the bottom of the map, and eleven
  // tasks that never once suggested getting in it.
  { id: 'harbour-swim', text: 'Swim in Victoria Harbour',               chapter: 11 },
  // The mini. Eleven chapters, and the one surface the player spends this
  // whole chapter beside had nothing on it.
  { id: 'bus-top',       text: 'Ride the open top down the street',              chapter: 11,
    mini: 'THE OPEN TOP' },
  // The second mini. The open top gave the street something moving on it; this
  // gives it something HAPPENING on it, on a clock, whether you turn up or not.
  { id: 'choi-cheng',    text: 'Be on the lion when it takes the lettuce',       chapter: 11,
    mini: 'THE LION' },

  // CHAPTER 12 — PALAWAN. Twelve chapters in which water was a wall, a floor or
  // a road, and none in which it was a ROOM. Every line here is under it except
  // the two that get you there.
  { id: 'to-palawan',   text: 'Turn up in Palawan',                     chapter: 12 },
  { id: 'outrigger',    text: 'Ride the bangka out to the island',      chapter: 12 },
  // The oldest thing anybody has ever done off a jetty, and the exact opposite
  // of 'first-dive': that one is a key you hold, this one is a decision you make
  // at a run and then cannot take back.
  { id: 'jetty-jump',   text: 'Go off the end of the jetty',            chapter: 12 },
  { id: 'first-dive',   text: 'Go under',                               chapter: 12 },
  { id: 'the-crack',    text: 'Get into the hidden lagoon',             chapter: 12 },
  { id: 'sea-turtle',   text: 'Keep up with the turtle',                chapter: 12 },
  { id: 'giant-clam',   text: 'Take something from the giant clam',     chapter: 12 },
  { id: 'cathedral',    text: 'Find the room with the hole in the roof',chapter: 12 },
  { id: 'the-bloom',    text: 'Be under when the water lights up',      chapter: 12, wow: 'PALAWAN' },
  // The mini, and the one thing down here that reacts to you.
  { id: 'bait-ball',     text: 'Swim into the middle of the bait ball',          chapter: 12,
    mini: 'THE BALL' },
  // The second mini. Everything else that has ever carried this animal was on
  // rails — a berth, a road, a wind, a rope. This one is going where it likes.
  { id: 'the-manta',     text: 'Take hold of the manta, and stay on',            chapter: 12,
    mini: 'THE MANTA' },
  // capy.wet has existed since Sydney — it darkens the coat and it drips — and
  // it has never once been a mechanic.
  { id: 'beach-fire',   text: 'Put the beach fire out',                 chapter: 12 },

  // CHAPTER 13 — CAPPADOCIA. The opposite chapter, deliberately: dry, cold,
  // upward, and the one place in the game where the player cannot steer.
  { id: 'to-cappadocia',text: 'Turn up in Cappadocia',                  chapter: 13 },
  { id: 'chimney-top',  text: 'Top out on a fairy chimney',             chapter: 13 },
  { id: 'dovecote',     text: 'Let the pigeons out of the rock',        chapter: 13 },
  { id: 'the-tether',   text: 'Chew through something important',       chapter: 13 },
  // The launch field is the best-observed thing in this chapter — three states
  // of the same twenty minutes, side by side, floodlit, with the trucks and the
  // propane — and the list used exactly one object on it.
  { id: 'the-envelope', text: 'Walk an envelope, end to end',           chapter: 13 },
  { id: 'the-mouth',    text: 'Get inside one while it is filling',     chapter: 13 },
  { id: 'aboard',       text: 'Get in a basket before it goes',         chapter: 13 },
  { id: 'three-winds',  text: 'Ride three different winds',             chapter: 13 },
  { id: 'sunrise',      text: 'Be up there when the sun clears the rim',chapter: 13, wow: 'CAPPADOCIA' },
  { id: 'on-the-trailer', text: 'Put it down on the trailer',           chapter: 13 },
  // The mini, and it is in the chapter's name: Kapadokya is the Persian
  // katpatuka, the land of beautiful horses, and there were none.
  { id: 'the-herd',      text: 'Ride the lead mare up the valley',               chapter: 13,
    mini: 'KATPATUKA' },

  // ---- Chapter 14: Manly ----
  // The third Sydney chapter, and the argument for it is one sentence: the
  // harbour and the ocean are not the same water. Chapters 1 and 3 are both
  // played on a flat pale sheet that exists to be fallen into. Here the sea
  // has SHAPE and the shape is moving, so every line on this list is really
  // the same question — where is the white, and do you want to be in front of
  // it or behind it. The order is a swimming lesson: the beach, then the
  // shorebreak, then under it, then out the back the way the locals go, then
  // one all the way home.
  { id: 'to-manly',      text: 'Come over to the ocean side',            chapter: 14 },
  { id: 'pine-cone',     text: 'Bring down a Norfolk pine cone',         chapter: 14 },
  { id: 'move-flags',    text: 'Move the flags, and take the beach with them', chapter: 14 },
  { id: 'sandcastle',    text: 'Flatten the best sandcastle on the beach', chapter: 14 },
  { id: 'duck-dive',     text: 'Go under the white water, not over it',   chapter: 14 },
  { id: 'the-rip',       text: 'Let the rip take you out the back',       chapter: 14 },
  // The mini. Standing up is not the moment — a capybara does not stand up.
  // The moment is the two seconds where the water stops going past you and
  // starts taking you with it, which is exactly what a take-off is.
  { id: 'take-off',      text: 'Catch one',                              chapter: 14,
    mini: 'THE TAKE-OFF' },
  { id: 'all-the-way',   text: 'Take the biggest of the set to the sand', chapter: 14, wow: 'MANLY' },
  { id: 'the-bommie',    text: 'Sit on the bommie while it breaks over you', chapter: 14 },
  { id: 'bower-pool',    text: 'Swim a length of the ocean pool',         chapter: 14 },
  { id: 'blue-groper',   text: 'Introduce yourself to the blue groper',   chapter: 14 },
  // The second mini, and it is the counter-argument to the whole chapter: the
  // one way out through the break that is not swimming.
  { id: 'the-surfboat',  text: 'Go out through the break in the surfboat', chapter: 14,
    mini: 'THE SURFBOAT' },

  // ---- Chapter 15: The Pantanal ----
  // Fifteen places and the animal has never once been anywhere it is actually
  // from. This is the chapter where the capybara is not a novelty, and every
  // line on the list follows from that: nothing here is startled by you,
  // nothing here is chasing you, and the marquee is not a stunt — it is being
  // at the front of your own species.
  { id: 'to-pantanal',   text: 'Turn up in the Pantanal',                chapter: 15 },
  { id: 'the-locals',    text: 'Meet the neighbours',                    chapter: 15 },
  // The mini. The first time in fifteen chapters that the world falls in
  // behind the player instead of getting out of the way.
  { id: 'gather',        text: 'Get five of them to follow you',         chapter: 15,
    mini: 'THE HERD' },
  { id: 'camalote',      text: 'Cross the bay on the floating meadow',   chapter: 15 },
  { id: 'caiman-nap',    text: 'Sit on a sleeping jacaré',               chapter: 15 },
  { id: 'jabiru-nest',   text: 'Look into the jabiru’s nest',            chapter: 15 },
  { id: 'cowbird',       text: 'Give a cowbird a lift',                  chapter: 15 },
  { id: 'the-otters',    text: 'Get told off by the giant otters',       chapter: 15 },
  { id: 'missing-plank', text: 'Cross the bridge that is missing a plank', chapter: 15 },
  { id: 'macaw-nut',     text: 'Take a palm nut off a hyacinth macaw',   chapter: 15 },
  // The second mini, and the only carrier in the game that is walking on its
  // knuckles because its claws are too long to put down.
  { id: 'tamandua',      text: 'Ride the anteater across the campo',     chapter: 15,
    mini: 'O TAMANDUÁ' },
  { id: 'the-crossing',  text: 'Take the whole herd across the river',   chapter: 15, wow: 'O PANTANAL' },

  // ---- Chapter 16: Sơn Đoòng ----
  // Sixteen chapters and the game had never once turned the lights off. The
  // list is therefore a list about SEEING: the first four lines teach you that
  // your own voice is a torch, the middle four are things worth pointing it
  // at, and the last three are the argument — that the biggest cave passage on
  // earth has a hole in the roof, and a forest growing under the hole.
  //
  // ...AND IT IS THE MOST LITERAL SHAPE IN THE GAME (see `act` below). This
  // chapter is a LINE — z 80 to z −176, one way, through three rooms with two
  // doors between them — and it was the only chapter whose structure was
  // already a three-act play on the map and a flat list of twelve switches on
  // the card. The mouth teaches you the verb and hands you the river; the
  // Great Passage is the biggest room on earth and has a hole in the roof; and
  // the far side is over a seventy-metre wall and is where the things that
  // live here live. Nothing is gated — an act stages the telling, not the
  // world — so a player who bolts straight for the slot ticks everything on
  // the way in whatever order they meet it.
  { id: 'to-cave',       text: 'Get inside the mountain',                chapter: 16 },
  { id: 'first-echo',    text: 'Find out what your voice is for',        chapter: 16 },
  { id: 'glow-trail',    text: 'Follow the glow-worms down to the river', chapter: 16 },
  { id: 'cave-river',    text: 'Swim the river in the dark',             chapter: 16 },
  { id: 'hand-of-dog',   text: 'Top out on the biggest stalagmite',      chapter: 16, act: 2 },
  { id: 'swiftlets',     text: 'Put up the swiftlets (they steer on sound too)', chapter: 16, act: 3 },
  { id: 'cave-pearl',    text: 'Pocket a cave pearl',                    chapter: 16, act: 3 },
  { id: 'blind-fish',    text: 'Meet something with no eyes',            chapter: 16, act: 2 },
  // The mini, and the third chapter to publish climbHold. Seventy metres of
  // calcite across the whole passage, and the only way on is over it — which
  // is why it OPENS the last act rather than closing the middle one.
  { id: 'great-wall',    text: 'Climb the Great Wall of Vietnam',        chapter: 16, act: 3,
    mini: 'THE GREAT WALL' },
  { id: 'the-doline',    text: 'Stand in the light inside the mountain', chapter: 16, act: 2,
    wow: 'SƠN ĐOÒNG' },
  { id: 'phytokarst',    text: 'Shout at the garden that leans',         chapter: 16, act: 2 },
  // The second mini. There is a river in here and things come down it.
  { id: 'the-log',       text: 'Ride a log through the dark',            chapter: 16,
    mini: 'THE DRIFTWOOD' },

  // ---- Chapter 17: the Antarctic Peninsula ----
  // The first list in the game that is mostly a LIST OF PASSAGES. Sixteen
  // chapters taught a capybara to walk, swim, climb, glide and slide; this one
  // is eleven hundred metres across, it is minus nine, and the way you get
  // anywhere is the tiller. So the first three lines are the boat, the middle
  // four are the reasons to take it somewhere, and the last four are the two
  // things this place has that nowhere else does: ice you cannot stand up on,
  // and something very large that has decided to come and look at you.
  { id: 'to-antarctic',    text: 'Get to the bottom of the world',        chapter: 17 },
  { id: 'take-tiller',     text: 'Take the tiller',                       chapter: 17 },
  { id: 'the-lead',        text: 'Find the lead through the pack',        chapter: 17, act: 2 },
  { id: 'station-mug',     text: 'Rob the southernmost bar on earth',     chapter: 17 },
  { id: 'haul-out',        text: 'Haul out on a floe',                    chapter: 17, act: 2 },
  { id: 'leopard-seal',    text: 'Be looked at by a leopard seal',        chapter: 17, act: 3 },
  { id: 'berg-arch',       text: 'Take her through the arch in the berg', chapter: 17, act: 2 },
  { id: 'whale-bones',     text: 'Sit down inside the whale',             chapter: 17, act: 2 },
  { id: 'spy-hop',         text: 'Get spy-hopped',                        chapter: 17, act: 3 },
  // ...and the one thing on this list that is done with the voice rather than
  // with the boat. Four thousand of them answer, and it rolls up the hill.
  { id: 'colony-chorus',   text: 'Start something at the rookery',        chapter: 17, act: 2 },
  // The first mini: four thousand gentoos wore a track down that hill and it
  // is polished. You will go down it whether or not you meant to.
  { id: 'penguin-highway', text: 'Take the penguin highway down',         chapter: 17, act: 2,
    mini: 'THE HIGHWAY' },
  { id: 'blue-ice',        text: 'Slide the glacier into the sea',        chapter: 17, act: 2 },
  // The second mini, and the only carrier in the game that is a piece of the
  // sea. It is going north through the gate with or without you.
  { id: 'floe-drift',      text: 'Ride a floe down the channel',          chapter: 17, act: 2,
    mini: 'THE FLOE' },
  { id: 'orca-ride',       text: 'Run with the pod',                      chapter: 17, act: 3, wow: 'THE PENINSULA' },
];


// ---------------------------------------------------------------------------
// THE PLACES, IN ORDER. One row per chapter: which biome it is, what it is
// called, and the line under the name.
//
// This used to live in three places at once — the title card's picker, the
// overseas terminal's if-ladder and the place card each arrival shows — which
// was survivable at two chapters and is not at eight. Everything that needs to
// know where chapter n IS now asks here.
// ---------------------------------------------------------------------------
// One row per chapter, and it is now the ONLY row. What started as
// "which biome is chapter n" has absorbed every other per-place constant that
// used to live as an if-ladder in systems.js — the arrival task, the far plane,
// whether the shadow frustum goes deep, which music palette, the line on the
// title card and the line the game says as you land. There were eleven of those
// ladders, in five files, and the ninth chapter shipped with two of them missing
// a rung. A table cannot be missing a rung.
//
//   arrive  the task ticked by turning up (Sydney and the Quay are not travelled to)
//   far     camera far plane — how much of the place you can see at once
//   tall    RELIEF, not altitude: does the shadow frustum need the deep box
//   pal     index into sysMUS_PAL. Not the chapter number: chapter 3 has two
//           (alongside and under way), so everything after it is offset by one.
//   hint    the line under the name on the title card's picker
//   open    the first thing the game says to you when you arrive
//   way     the one way out of the place, in words
//
// ---- AND THREE THAT SAY WHAT SHAPE THE CHAPTER IS (v18) -------------------
//
//   keep    THE SOUVENIR. What you take away from this place — held the moment
//           the chapter is finished and never again lost. It is a PROJECTION of
//           the save rather than a new field in it: you hold chapter n's keep
//           exactly when every task in chapter n is ticked, so there is nothing
//           to migrate, nothing to desync, and no way to hold one you did not
//           earn. Seventeen of them are the only thing in this game that
//           crosses a chapter boundary; see the shelf in systems.js.
//   acts    OPTIONAL. A chapter may be a list — eleven of them are, and that is
//           the default and costs nothing — or it may have MOVEMENTS. One entry
//           per act, `{ kick, line }`, the caption and the sentence shown when
//           that act opens. Entry 0 describes act 1 and is never announced,
//           because the chapter's arrival card has just said it.
//   win     OPTIONAL. How many open rows the paper shows at once here. Default
//           is sysTODO_WINDOW (4). A chapter that wants to be a corridor rather
//           than a menu sets 2; one that wants to be a sprawl sets 6.
export const CHAPTERS = [
  { n: 1, biome: 'sydney',  name: 'Sydney',          sub: 'the gardens, unsupervised',
    arrive: '',           far: 400,  tall: false, pal: 0,
    hint: 'the gardens, unsupervised',                open: 'be a menace.', way: 'the ferry at the Quay',
    keep: 'a tourist’s hat' },
  { n: 2, biome: 'pasto',   name: 'Pasto, Nariño',   sub: '2 527 metres up, and no better behaved',
    arrive: 'to-pasto',   far: 900,  tall: true,  pal: 1,
    hint: '2 527 m up, and a condor',                 open: 'be a menace.', way: 'the crater on Galeras',
    keep: 'a condor’s flight feather' },
  { n: 3, biome: 'quay',    name: 'Circular Quay',   sub: 'she sails when you say she sails',
    arrive: 'to-quay',    far: 1600, tall: false, pal: 2,
    hint: 'a boat, and Manly somewhere north',        open: 'find the wheel.', way: 'up the Corso at Manly',
    keep: 'an unpunched ferry ticket', win: 3,
    acts: [
      { kick: 'THE QUAY', line: 'she is yours. find the wheel.' },
      { kick: 'OPEN WATER', line: 'seven hundred metres, and nothing to hit but the headlands.' },
      { kick: 'MANLY', line: 'bring her alongside. the Corso is up the hill.' },
    ] },
  { n: 4, biome: 'kyoto',   name: 'Kyoto & Uji',     sub: 'and Uji, an hour down the river',
    arrive: 'to-kyoto',   far: 700,  tall: false, pal: 4,
    hint: 'ten thousand gates and a lot of tea',      open: 'be a menace. quietly.', way: 'the bridge at Uji',
    keep: 'a tea whisk, slightly chewed' },
  { n: 5, biome: 'cali',    name: 'Cali',            sub: 'the salsa capital of the world',
    arrive: 'to-cali',    far: 1000, tall: false, pal: 5,
    hint: 'the salsa capital of the world',           open: 'listen first.', way: 'the bridge over the Rio Cali',
    keep: 'a stick of sugarcane' },
  { n: 6, biome: 'rio',     name: 'Rio de Janeiro',  sub: 'and the bateria is already moving',
    arrive: 'to-rio',     far: 1400, tall: false, pal: 6,
    hint: 'a bateria, and it is not waiting for you', open: 'follow the drums.', way: 'the rock at Arpoador',
    keep: 'a tile off Selarón’s steps' },
  { n: 7, biome: 'iceland', name: 'Iceland',         sub: 'half past eleven, and the sun is not the plan',
    arrive: 'to-iceland', far: 1200, tall: true,  pal: 7,
    hint: 'dark, and the ground does not hold',       open: 'nobody is out. that is the good news.', way: 'the end of the pier',
    keep: 'a piece of the glacier',
    acts: [
      { kick: 'REYKJAVÍK', line: 'nobody is out. that is the good news.' },
      { kick: 'OUT OF TOWN', line: 'the ground stops holding you somewhere past here.' },
      { kick: 'AND THEN SIT STILL', line: 'there is nothing left to knock over. good.' },
    ] },
  { n: 8, biome: 'sahara',  name: 'Marrakech',       sub: 'and forty minutes east of it, nothing at all',
    arrive: 'to-sahara',  far: 1600, tall: true,  pal: 8,
    hint: 'a maze, and then no maze at all',          open: 'do not rob anybody yet. or do.', way: 'the fire at the desert camp',
    keep: 'an orange off the cart',
    acts: [
      { kick: 'JEMAA EL-FNAA', line: 'do not rob anybody yet. or do.' },
      { kick: 'EAST, THEN', line: 'the maze stops. everything stops.' },
      { kick: 'AFTER THE STORM', line: 'it is evening, and somebody has lit a fire.' },
    ] },
  { n: 9, biome: 'drift',   name: 'The Drift',       sub: 'nobody is entirely sure how you got up here',
    arrive: 'to-drift',   far: 1500, tall: true,  pal: 9,
    hint: 'no ground to speak of, and a wind',        open: 'nothing here is nailed down. including the ground.', way: 'the lantern plinth, once it is lit',
    keep: 'a seed-head, still trying to leave' },
  { n: 10, biome: 'venice', name: 'Venice',          sub: 'and the water is coming in',
    arrive: 'to-venice',  far: 900,  tall: false, pal: 10,
    hint: 'the floor is negotiable',                  open: 'the tide is early. mind the paving.', way: 'the two columns on the Molo',
    keep: 'a pigeon feather from the Piazza',
    acts: [
      { kick: 'LOW WATER', line: 'the tide is early. mind the paving.' },
      { kick: 'ACQUA ALTA', line: 'the siren went four times. the square is going under.' },
    ] },
  { n: 11, biome: 'kowloon', name: 'Hong Kong',      sub: 'up is a direction here',
    arrive: 'to-kowloon', far: 1300, tall: true,  pal: 11,
    hint: 'a wall of light, and a way up it',         open: 'nothing on this street is at ground level.', way: 'the end of the Star Ferry pier',
    keep: 'a length of scaffold bamboo' },
  { n: 12, biome: 'palawan', name: 'Palawan',        sub: 'the interesting half is underneath',
    arrive: 'to-palawan', far: 1100, tall: true,  pal: 12,
    hint: 'twelve chapters of paddling. enough.',     open: 'you are a semi-aquatic rodent. act like one.', way: 'the end of the bamboo jetty',
    keep: 'a pearl out of the giant clam' },
  { n: 13, biome: 'goreme',  name: 'Cappadocia',     sub: 'and you do not get a steering wheel',
    arrive: 'to-cappadocia', far: 2200, tall: true, pal: 13,
    hint: 'no steering. only up and down.',           open: 'the wind goes a different way at every height. that is the whole game.', way: 'the landing plain, once you have flown',
    keep: 'a scrap of balloon envelope' },
  { n: 14, biome: 'manly',  name: 'Manly',            sub: 'the other side of the Corso, and it is not the harbour',
    arrive: 'to-manly',   far: 1500, tall: false, pal: 14,
    hint: 'the sea has a shape here',                 open: 'the white bits are where it is breaking.', way: 'between the red and yellow flags',
    keep: 'a Norfolk pine cone' },
  { n: 15, biome: 'pantanal', name: 'The Pantanal',   sub: 'where you are, as it happens, from',
    arrive: 'to-pantanal', far: 1300, tall: false, pal: 15,
    hint: 'you are not the strangest thing here',     open: 'nobody here is going to look at you twice.', way: 'the last bridge on the Transpantaneira',
    keep: 'a water hyacinth, flowering' },
  { n: 16, biome: 'cave',   name: 'Sơn Đoòng',        sub: 'and the only light is the one you make',
    arrive: 'to-cave',    far: 800,  tall: false, pal: 16,
    hint: 'no light in here but yours',               open: 'wheek. it is the only way to see anything.', way: 'the slot of daylight at the far end',
    keep: 'a cave pearl', win: 2,
    acts: [
      { kick: 'THE MOUTH', line: 'wheek. it is the only way to see anything.' },
      { kick: 'THE GREAT PASSAGE', line: 'ninety metres across, and there is a hole in the roof.' },
      { kick: 'THE FAR SIDE', line: 'seventy metres of calcite, and then whatever lives past it.' },
    ] },
  { n: 17, biome: 'antarctic', name: 'Antarctica',   sub: 'and you are not walking anywhere',
    arrive: 'to-antarctic', far: 2000, tall: true, pal: 17,
    hint: 'too cold to walk. take the boat.',         open: 'the orange boat at the end of the jetty. that is the chapter.', way: 'the head of the station jetty',
    keep: 'the station’s enamel mug', win: 3,
    acts: [
      { kick: 'THE STATION', line: 'too cold to walk. take the boat.' },
      { kick: 'THE ICE', line: 'four rocks, eleven hundred metres apart.' },
      { kick: 'THE PACK', line: 'there is something under the boat.' },
    ] },
];
export function chapterOf(biome) {
  for (let i = 0; i < CHAPTERS.length; i++) if (CHAPTERS[i].biome === biome) return CHAPTERS[i].n;
  return 1;
}
export function chapterDef(n) { return CHAPTERS[n - 1] || CHAPTERS[0]; }

// ---------------------------------------------------------------------------
// RECORDS — the tasks that are worth doing WELL, not merely doing.
//
// Every one of the seventy-four tasks is a switch: you have done it or you have
// not, and once you have there is no reason on earth to do it again. That is
// fine for 'steal a hat' and it quietly wastes the best twenty seconds in the
// game, because a run down a glacier is a thing you want to be BETTER at and
// the game had nowhere to put that.
//
// So: a task may declare a number it is measured by. It is kept, it is beaten,
// and it is shown. Nothing is gated on it — a record is never a requirement,
// because the moment it is, a cosy game about a rodent has an exam in it.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// FINDS — the things nobody tells you about (v19)
//
// A hundred and ninety-nine tasks, and every single one of them is delivered
// the same way: it appears on the paper, an arrow points at it, a beacon stands
// on the spot and a distance counts down. That is an excellent net and it is
// also the ONLY way anything in this game has ever been handed over — so in
// seventeen dense, hand-built worlds, nothing has ever been FOUND.
//
// A find is the other kind. It is never on the paper, it has no arrow, no
// beacon, no clue and no distance; it is not required for anything and it gates
// nothing. It ticks quietly into the journal and stands on the ledger next to
// the place it happened, and the whole of its design is that the game turns out
// to have been watching something you did not know it could see.
//
// THREE RULES THEY ALL OBEY:
//
//   1. NOTHING IS EVER LISTED. If it needs telling, it is a task and belongs in
//      TASKS with the other hundred and ninety-nine.
//   2. NOTHING CAN BE MISSED. Every one of them can be done at any point, in
//      any order, for ever — the same law the chapters already keep.
//   3. NOTHING IS BLOCKED BY ONE. No task, no record, no chapter and no exit
//      depends on a find existing, so a player who never notices any of them
//      plays exactly the game that shipped yesterday.
//
// `where` is the line the ledger prints under the place it happened. `chapter`
// is 0 for the ones that can happen anywhere and a number for the ones that
// belong to a place. The predicates are sysFINDS in systems.js, because every
// one of them is a question about live world state and that is where the live
// world state is.
//
// AND A FOURTH RULE, FOR THE ONES THAT BELONG TO A PLACE (v20, 24 Aug 2026)
//
//   4. A PLACE FIND MAY NOT BE A TASK WITH THE PAPER TAKEN AWAY. The first
//      twenty were all questions about the moveset or the clock — diving,
//      climbing, cold, breath, stillness, distance, being watched — which is
//      why they could be chapter-neutral, and it is also why, after nineteen
//      versions, nothing in seventeen dense hand-built worlds had ever been
//      found IN one of them. A player who noticed something in Venice was
//      shown the identical sentence they had been shown in Iceland.
//
//      The test for whether a place find is a find: could a player plausibly
//      do it without ever knowing it was there? If it needs an objective to
//      make sense of it, it is a task, and it belongs in TASKS with the other
//      hundred and ninety-nine.
//
// Two things about the fields, both of which have bitten:
//
//   - `qa/audit-tasks.mjs` finds a row by matching `id` IMMEDIATELY FOLLOWED BY
//     `text`. Every field goes AFTER `text` or the row silently stops existing
//     as far as four of the six checks are concerned.
//   - a wrong `chapter` does not throw and does not warn at runtime: the sweep
//     simply never reaches the row. The audit checks the number against
//     CHAPTERS for exactly that reason.
// ---------------------------------------------------------------------------
export const FINDS = [
  // ---- WHAT YOU BROUGHT WITH YOU ----------------------------------------
  // The dive, the climb and the cold are the moveset arriving somewhere it was
  // never taught, which is the entire argument for making them properties of
  // the world instead of properties of a chapter. See capyCanDive.
  { id: 'brought-dive',   text: 'Went under somewhere nobody asked you to' },
  { id: 'long-breath',    text: 'Held one breath for twenty-five seconds' },
  { id: 'dark-water',     text: 'Went under where you could not see the bottom' },
  { id: 'brought-climb',  text: 'Climbed something in a place that never mentioned climbing' },
  { id: 'cold-swim',      text: 'Swam in water nobody sensible swims in' },
  { id: 'the-deep-end',   text: 'Found the bottom of the deepest water here' },

  // ---- WHAT NOBODY SAW --------------------------------------------------
  // Wariness denies nothing anywhere in the game (see the npcWARY_ block in
  // npc.js). This is the one place it is allowed to have teeth, because this is
  // the only content that was written knowing it exists.
  { id: 'not-a-soul',     text: 'Took something with four people in sight and not one of them looking' },
  { id: 'most-wanted',    text: 'Got five people watching you at once' },
  { id: 'forgiven',       text: 'Stayed where you could be seen until somebody stopped minding' },
  { id: 'red-handed',     text: 'Robbed somebody who was already watching you' },

  // ---- WHAT YOU DID WITH THE TIME ---------------------------------------
  { id: 'perfectly-still', text: 'Did nothing whatsoever for a full minute' },
  { id: 'out-in-it',      text: 'Stood out in a shower from the first drop to the last' },
  { id: 'wrung-out',      text: 'Got as wet as it is possible to get' },
  { id: 'nothing-left',   text: 'Ran until there was nothing left in you' },
  { id: 'own-beat',       text: 'Moved on the beat for eight bars, with nobody scoring it' },
  { id: 'scenic-route',   text: 'Walked a kilometre in one place' },

  // ---- WHERE YOU WENT ---------------------------------------------------
  { id: 'high-point',     text: 'Stood on the highest ground there is here' },
  { id: 'far-corner',     text: 'Went as far out as this world goes' },
  { id: 'quiet-corner',   text: 'Found the one part of this place with nobody in it' },
  { id: 'long-drop',      text: 'Fell twenty-five metres and walked away from it' },

  // ---- AND THE ONES THAT BELONG TO A PLACE (v20) -------------------------
  // Two per chapter, thirty-four in all, and every one of them is about a
  // thing that world had already drawn and had never once asked after. They
  // are gated by `chapter` — see the note above and the sweep in findTick —
  // so a question about a gondola is never asked in Antarctica.
  //
  // The shape they all share, and it is the fourth rule made concrete: NONE OF
  // THEM IS A THING TO GO AND DO. Every one is something a player might turn
  // out to have done — standing still somewhere, being somewhere when
  // something else happened, going at a thing the long way round, or doing
  // the opposite of what the chapter's own task list asks for in the same
  // place. Nine of the thirty-four are literally "you were there and you did
  // nothing", which is a state this game had never rewarded once.

  // ---- 1, Sydney --------------------------------------------------------
  // The valve plate is trodden on to soak a TOURIST (`sprinkler`). Nobody had
  // ever been asked what happens if you stand in it yourself.
  { id: 'the-sprinkler',  text: 'Stood in the sprinkler until there was not a dry bit left', chapter: 1 },
  { id: 'the-queue',      text: 'Queued at the ice-cream van like an ordinary customer', chapter: 1 },

  // ---- 2, Pasto ---------------------------------------------------------
  { id: 'the-rim-walk',   text: 'Walked the crater rim right round to the other side', chapter: 2 },
  // `carroza` pays out for riding it UP the plaza and stops watching there.
  { id: 'the-whole-ride', text: 'Stayed on the float for the whole of its circuit', chapter: 2 },

  // ---- 3, Circular Quay -------------------------------------------------
  { id: 'let-her-sit',    text: 'Stopped her in the middle of the harbour and let her sit', chapter: 3,
    where: 'Stopped in the middle of the harbour, and let her sit' },
  // `under-bridge` is sounding the horn beneath it, from the wheelhouse.
  { id: 'swam-the-bridge', text: 'Swam under the Bridge, which is not what it is for', chapter: 3 },

  // ---- 4, Kyoto ---------------------------------------------------------
  // The garden's one animal that can DECIDE to leave, and it decides about you.
  { id: 'the-heron',      text: 'Got close enough to make the heron leave', chapter: 4 },
  // ...and the exact opposite of `bamboo-dash`, in the same grove.
  { id: 'still-bamboo',   text: 'Stood still in the bamboo until it was the loudest thing there', chapter: 4 },

  // ---- 5, Cali ----------------------------------------------------------
  { id: 'floor-after-dark', text: 'Came back down to the dance floor after dark', chapter: 5 },
  // `chiva-mirador` is the ride up. This is the walk up.
  { id: 'walked-the-hill', text: 'Walked up to the mirador instead of taking the chiva', chapter: 5 },

  // ---- 6, Rio -----------------------------------------------------------
  // `selaron-steps` is taking them at speed.
  { id: 'on-the-steps',   text: 'Sat down on the steps and let the city go past', chapter: 6 },
  // `o-bonde` crosses the arches along the top.
  { id: 'under-the-arches', text: 'Stood underneath the arches instead of on top of them', chapter: 6 },

  // ---- 7, Iceland -------------------------------------------------------
  // It has always answered a wheek and nothing could ever tell that it had.
  { id: 'the-fox',        text: 'Called an arctic fox over, and it came most of the way', chapter: 7 },
  { id: 'spring-and-sky', text: 'Sat in the hot spring with the weather coming down on you', chapter: 7 },

  // ---- 8, Marrakech -----------------------------------------------------
  // `souk-escape` is losing a chase in it. This is being in it for its own sake.
  { id: 'lost-in-the-souk', text: 'Spent a long time in the souk with nobody chasing you', chapter: 8 },
  { id: 'dune-at-dusk',   text: 'Was on top of the great dune when the light went', chapter: 8 },

  // ---- 9, the Drift -----------------------------------------------------
  { id: 'the-orchard',    text: 'Sat down in the orchard and let the seeds go past', chapter: 9 },
  // `lantern` pays out the instant it lights. Nobody had ever stayed.
  { id: 'after-the-lantern', text: 'Stayed up at the lantern after you had lit it', chapter: 9 },

  // ---- 10, Venice -------------------------------------------------------
  // `pigeon-storm` puts every one of them up. This is the other half of it.
  { id: 'pigeons-back',   text: 'Stood still long enough for the pigeons to come back', chapter: 10 },
  { id: 'flooded-cafe',   text: 'Sat at a café table with the water over the floor', chapter: 10 },

  // ---- 11, Hong Kong ----------------------------------------------------
  // `symphony` is being on the roof when the lights come on. These are the two
  // worst seats in Kowloon for it, and one of them is a joke.
  { id: 'lit-from-the-water', text: 'Was in the harbour, in the water, when the lights came on', chapter: 11 },
  { id: 'missed-the-show', text: 'Was in the wet market when the harbour lit up, and missed all of it', chapter: 11,
    where: 'Missed the whole light show from inside the wet market' },

  // ---- 12, Palawan ------------------------------------------------------
  // Drawn, collided, lit, and on nobody's list.
  { id: 'inside-the-wreck', text: 'Went inside the wreck, which nobody ever mentions', chapter: 12 },
  { id: 'under-the-bangka', text: 'Went under the outrigger and looked up at it', chapter: 12 },

  // ---- 13, Cappadocia ---------------------------------------------------
  // `sunrise` is being up in a balloon when the sun clears the rim.
  { id: 'dawn-from-below', text: 'Was down in the town when the sun came up, instead of up in it', chapter: 13 },
  { id: 'kept-up',        text: 'Kept up with the horses on your own four feet', chapter: 13 },

  // ---- 14, Manly --------------------------------------------------------
  { id: 'over-the-wall',  text: 'Was in the ocean pool when a wave came over the wall', chapter: 14 },
  { id: 'round-the-corner', text: 'Went round the corner to the quiet beach', chapter: 14 },

  // ---- 15, the Pantanal -------------------------------------------------
  { id: 'on-the-sandbar', text: 'Stood on the sandbar in the middle of the river', chapter: 15 },
  { id: 'dusk-afloat',    text: 'Was still out on the water when the light went', chapter: 15 },

  // ---- 16, Sơn Đoòng ----------------------------------------------------
  { id: 'nothing-behind', text: 'Went far enough in that there was no daylight behind you', chapter: 16 },
  { id: 'wet-in-a-mountain', text: 'Stood still under a drip until it had got you', chapter: 16 },

  // ---- 17, the Antarctic Peninsula --------------------------------------
  { id: 'the-whalers',    text: 'Went into the whaling station that nobody uses any more', chapter: 17 },
  // ...and the exact opposite of `colony-chorus`, in the middle of the colony.
  { id: 'ignored',        text: 'Stood about in the middle of the colony and was completely ignored', chapter: 17 },
];

/** Every find id, for the audit and the save. */
export function findIds() {
  const out = [];
  for (let i = 0; i < FINDS.length; i++) out.push(FINDS[i].id);
  return out;
}

export const RECORDS = {
  'uji-run':       { label: 'the river in', unit: ' s', better: 'lower', dp: 1 },
  'glacier-run':   { label: 'top speed', unit: ' m/s', better: 'higher', dp: 1 },
  'dune-surf':     { label: 'top speed', unit: ' m/s', better: 'higher', dp: 1 },
  'souk-escape':   { label: 'shook them in', unit: ' s', better: 'lower', dp: 1 },
  'selaron-steps': { label: 'the whole flight in', unit: ' s', better: 'lower', dp: 1 },
  'samba-parade':  { label: 'longest run', unit: ' on the two', better: 'higher', dp: 0 },
  'salsa-dance':   { label: 'longest run', unit: ' on the beat', better: 'higher', dp: 0 },
  'geysir':        { label: 'thrown', unit: ' m up', better: 'higher', dp: 0 },
  'hot-spring':    { label: 'sat still for', unit: ' s', better: 'higher', dp: 1 },
  'long-gap':      { label: 'longest crossing', unit: ' m', better: 'higher', dp: 1 },
  'updraft':       { label: 'carried up to', unit: ' m', better: 'higher', dp: 0 },
  'passerelle':    { label: 'the boards in', unit: ' s', better: 'lower', dp: 1 },
  'pigeon-storm':  { label: 'put up', unit: ' at once', better: 'higher', dp: 0 },
  'bamboo-climb':  { label: 'highest hold', unit: ' m', better: 'higher', dp: 0 },
  'laundry-pole':  { label: 'crossed in', unit: ' s', better: 'lower', dp: 1 },
  'first-dive':    { label: 'deepest', unit: ' m down', better: 'higher', dp: 1 },
  'sea-turtle':    { label: 'stayed with it', unit: ' s', better: 'higher', dp: 1 },
  'cathedral':     { label: 'held your breath', unit: ' s', better: 'higher', dp: 1 },
  'three-winds':   { label: 'highest', unit: ' m up', better: 'higher', dp: 0 },
  'on-the-trailer':{ label: 'landed within', unit: ' m', better: 'lower', dp: 1 },
  // THE FIRST THREE CHAPTERS HAD NO NUMBER IN THEM AT ALL. Nineteen records
  // across thirteen places and not one of them in Sydney, on the harbour or in
  // Pasto — so the three chapters a player meets FIRST were also the only three
  // with nothing to come back for once the list was ticked. Each of these hangs
  // off the task that is already the best thing in its chapter.
  'manly-voyage':  { label: 'the passage in', unit: ' s', better: 'lower', dp: 1 },
  // …and the two other things on the harbour worth doing WELL rather than
  // merely doing. Both were switches that flipped at two and at six seconds
  // and then stopped caring, on a chapter whose whole body is one long run.
  'yacht-race':    { label: 'threaded', unit: ' of the six', better: 'higher', dp: 0 },
  'dolphin-escort':{ label: 'they stayed', unit: ' s', better: 'higher', dp: 1 },
  'thermal-peak':  { label: 'carried up to', unit: ' m', better: 'higher', dp: 0 },
  'seagull-chips': { label: 'put up', unit: ' gulls at once', better: 'higher', dp: 0 },
  // …and the chapter's mini. Twelve seconds on the roof ticks it; the number
  // is how far you actually rode, which is a different and much better
  // question, because the promenade is sixty-two metres long and the van
  // turns round at both ends.
  'whippy-run':    { label: 'rode', unit: ' m in one go', better: 'higher', dp: 0 },
  // Same question, on the other chapter whose mini is a ride you climb onto.
  'carroza':       { label: 'carried', unit: ' m up the plaza', better: 'higher', dp: 0 },
  // The minis that are worth doing WELL as well as doing. Only two of the
  // thirteen are: a gravity ride has a number in it by construction, and so
  // does anything with a clock on it.
  'cart-run':      { label: 'top speed', unit: ' m/s', better: 'higher', dp: 1 },
  'take-a-wave':   { label: 'longest ride', unit: ' m', better: 'higher', dp: 1 },
  'acrobats':      { label: 'thrown', unit: ' m up', better: 'higher', dp: 1 },
  'driftseed':     { label: 'carried', unit: ' m', better: 'higher', dp: 0 },
  // The three new places. A surf zone, a herd and a cave passage all have a
  // number in them by construction — how far, how many, how long — and a
  // chapter whose best line is a RIDE has to have somewhere to put it, or the
  // ride is a switch you flip once.
  'the-rip':       { label: 'out the back in', unit: ' s', better: 'lower', dp: 1 },
  'all-the-way':   { label: 'longest ride', unit: ' m', better: 'higher', dp: 1 },
  'take-off':      { label: 'fastest take-off', unit: ' m/s', better: 'higher', dp: 1 },
  'the-crossing':  { label: 'brought over', unit: ' of them', better: 'higher', dp: 0 },
  'cowbird':       { label: 'carried it for', unit: ' s', better: 'higher', dp: 1 },
  'gather':        { label: 'longest string', unit: ' behind you', better: 'higher', dp: 0 },
  'great-wall':    { label: 'the wall in', unit: ' s', better: 'lower', dp: 1 },
  'swiftlets':     { label: 'put up', unit: ' at once', better: 'higher', dp: 0 },
  'the-log':       { label: 'stayed on for', unit: ' m', better: 'higher', dp: 0 },
  // Chapter 17. Three of the four things worth doing WELL down there are
  // things you cannot do at all in any other chapter, which is a reasonable
  // definition of what a chapter is for.
  'orca-ride':       { label: 'held station for', unit: ' s', better: 'higher', dp: 1 },
  'penguin-highway': { label: 'the hill in', unit: ' s', better: 'lower', dp: 1 },
  'blue-ice':        { label: 'top speed', unit: ' m/s', better: 'higher', dp: 1 },
  'floe-drift':      { label: 'carried', unit: ' m', better: 'higher', dp: 0 },
};


/** Highest chapter number present in TASKS. */
export function chapterCount() {
  let n = 1;
  for (let i = 0; i < TASKS.length; i++) if ((TASKS[i].chapter || 1) > n) n = TASKS[i].chapter;
  return n;
}

/** Task ids for a chapter, in list order. */
export function tasksInChapter(n) {
  const out = [];
  for (let i = 0; i < TASKS.length; i++) if ((TASKS[i].chapter || 1) === n) out.push(TASKS[i].id);
  return out;
}

// ---------------------------------------------------------------------------
// Small maths helpers
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// SOLID INDEX — navBlocked() for free, off the colliders you already built.
//
// Five chapters (Circular Quay, Kyoto, Cali, Rio, Iceland) published no
// navBlocked() at all. npc.js returns false when a biome has none, so in those
// five the crowd's steering, its separation and its line-of-sight all treated
// every building as open air, and people walked through walls and saw through
// them. Prop placement had the same hole.
//
// Hand-authoring five more rect tables would mean five more things to forget
// when a building moves. This indexes the static boxes AS THEY ARE CREATED, so
// the nav answer and the collision answer can never drift apart.
//
// The height test is the whole subtlety. A static box is not automatically an
// obstacle: a road slab, a pontoon, a deck and a quay apron are all static
// boxes you are meant to stand ON. So a box only blocks if its top stands
// solidRISE above the local ground — a kerb is not a wall — and its underside
// is low enough to matter to something 0.7 m tall. An awning at head height
// stops nobody.
const solidRISE = 0.62;   // m of step-up that stops being walkable and starts being wall
const solidDUCK = 0.55;   // m of clearance underneath that a capybara simply goes under

export function makeSolidIndex() {
  const list = [];
  return {
    /** Half-extents, matching CANNON.Box. `ry` is the box's own yaw. */
    add(x, y, z, hx, hy, hz, ry) {
      if (!(x === x) || !(y === y) || !(z === z)) return;
      list.push({
        x, z, hx, hz, ry: ry || 0,
        cos: Math.cos(ry || 0), sin: Math.sin(ry || 0),
        top: y + hy, bot: y - hy,
      });
    },
    count() { return list.length; },
    /** True where something of radius `r` cannot stand. `groundY` may be null. */
    blocked(px, pz, r, groundY) {
      const rad = r || 0;
      for (let i = 0; i < list.length; i++) {
        const b = list[i];
        // into the box's own frame, so a rotated façade is tested as it is drawn
        const dx = px - b.x, dz = pz - b.z;
        const lx = dx * b.cos + dz * b.sin;
        const lz = -dx * b.sin + dz * b.cos;
        if (lx < -b.hx - rad || lx > b.hx + rad) continue;
        if (lz < -b.hz - rad || lz > b.hz + rad) continue;
        let g = 0;
        if (groundY) { const h = groundY(px, pz); if (h === h) g = h; }
        if (b.top <= g + solidRISE) continue;    // a kerb, a deck, a road: walk on it
        if (b.bot >= g + solidDUCK) continue;    // an awning, a beam, an arch: walk under it
        return true;
      }
      return false;
    },
  };
}

export function rand(a, b) { return a + Math.random() * (b - a); }
export function randInt(a, b) { return Math.floor(a + Math.random() * (b - a + 1)); }
export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
/** Frame-rate independent exponential smoothing. */
export function damp(current, target, lambda, dt) {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

/**
 * damp(), FOR A HEADING, AND EVERY CHAPTER IN THIS GAME NEEDED IT.
 *
 * damp() is a plain lerp and knows nothing about circles; atan2 returns
 * (-pi, pi]. Put the two together — which is what `yaw = damp(yaw,
 * Math.atan2(dx, dz), k, dt)` does — and the moment the bearing crosses due
 * south the error flips from +3.14 to -3.14 and the thing takes THE LONG WAY
 * ROUND: a full turn on the spot, at damping speed, every single time.
 *
 * Cappadocia's chase truck found this and wrapped it by hand. Nothing else
 * did, and there were six more of them: Manly's blue groper (which swims a
 * closed circle, so it crossed twice a lap, for ever), the Pantanal's cattle
 * turning to look at you, its jabiru turning to face the nest — and, worst of
 * all, THE FOLLOWER HERD, which is the marquee of chapter 15: nine capybaras
 * walking down the player's own trail, spinning on their own axis every time
 * the player rounded a corner through south.
 *
 * The fix is one line of arithmetic and it belongs here rather than in seven
 * files. Feed it a heading and it takes the short way, always.
 */
export function dampAngle(current, target, lambda, dt) {
  let d = target - current;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  return current + d * (1 - Math.exp(-lambda * dt));
}

// ---------------------------------------------------------------------------
// GRAIN — the one thing thirteen chapters of flat colour were missing.
//
// Every ground in this game is a single enormous mesh in a single colour, and
// at the gameplay camera (six metres up, 41 degrees down) that mesh is two
// thirds of the frame. Sydney's lawn IS vertex-coloured — but on a noise whose
// wavelength is thirty-three metres, and the frame is thirty metres wide, so
// what the player actually sees is one flat green wall. The same is true of
// the Quay apron, the Piazzetta, the Palawan sand and the Kowloon carriageway.
//
// The fix is NOT a texture (there are none in this game and there will be
// none). It is a procedural break-up in WORLD space, evaluated in the shader,
// costing no draw call, no triangle and no byte of memory: two octaves of value
// noise multiplying the diffuse term by a few per cent. It rides on the mesh's
// own world position, so it never swims when the camera moves — which is the
// entire reason it cannot be done in the post pass.
//
// It is deliberately opt-in. Applied to everything it would read as dirt;
// applied to the four or five biggest surfaces in a chapter it reads as ground.
//
//   const m = grain(mat(PALETTE.sand), { scale: 0.6, amount: 0.13 });
//
//   scale   cycles per metre — 0.5 is a metre-and-a-half patchiness, 2 is gravel
//   amount  peak-to-peak fraction of the diffuse colour, 0.06 (whisper) .. 0.22
//   warp    how much the vertical axis shears into the sample, so that WALLS
//           get variation too instead of streaking; 0 for a pure ground plane
//
// Returns a CLONE — mat() hands back a shared cached material and compiling a
// hook onto it would grain every mesh in the game that happens to share a hex.
// ---------------------------------------------------------------------------
// ONE uniform object, shared by every grained material in the game. three reads
// `uniform.value` at draw time, so moving the water in eight chapters at once is
// a single float write per frame and no per-material work whatsoever.
const _grainTime = { value: 0 };
/** Advance the sparkle clock. systems.js calls this once per frame. */
export function grainTick(t) { _grainTime.value = t; }

// ---------------------------------------------------------------------------
// ...AND TWO MORE SHARED UNIFORMS, FOR THE WET GROUND.
//
// Same trick as the sparkle clock and for the same reason: one float and one
// colour written per frame move every grained surface in the live chapter, at
// no per-material cost at all.
//
// WHY THIS IS IN THE SURFACE SHADER AND NOT ONLY IN THE COMPOSITE PASS. The
// first version of the micro-weather expressed a wet street entirely through
// the grade — more bloom, a lower threshold, a little more saturation — and in
// Kowloon that looked right, because Mong Kok is full of lights for a wet road
// to reflect. In Kyoto and Venice it did almost nothing, because a lowered
// bloom threshold needs something bright on the ground to bite on and there
// was nothing: the grass and the stone were exactly as light as they had been
// in the dry. Wetness was in the lens and not on the floor.
//
// What wet ground actually does is two things, and only the second of them
// can be faked in a post pass:
//
//   1. IT GOES DARKER. Water fills the surface's micro-pores and light that
//      would have scattered straight back out is trapped instead. Porous
//      things — stone, soil, sand, grass — lose 20-40 % of their diffuse.
//   2. IT ACQUIRES A SHEEN at grazing angles, which is the half that makes it
//      read as WET rather than merely as in shadow.
//
// The sheen is also what gives the composite pass its missing subject: it is
// allowed to run over 1.0, so the biome's own lowered threshold now has a real
// highlight on the ground to bloom, exactly the way `sparkle` feeds it on
// water.
//
// The colour is written from the HEMISPHERE, so a wet street reflects the sky
// it is actually under — neon over Mong Kok, flat grey over Kyoto — and every
// event that already moves the atmosphere moves the reflection with it. That
// is the same argument the sky dome's horizon colour is built on.
const _grainWet = { value: 0 };
const _grainWetC = { value: new THREE.Color(1, 1, 1) };
/**
 * How wet every grained surface is, and what colour the sky it is reflecting.
 * systems.js calls this once per frame. `level` is weather.js's `shine()` —
 * wetness ABOVE the chapter's own baseline — for the reason stated there: a
 * chapter authored wet was coloured that way on purpose and must not be
 * re-graded the day a weather system arrives.
 */
export function wetTick(level, color) {
  _grainWet.value = level > 0 ? (level < 1 ? level : 1) : 0;
  if (color) _grainWetC.value.copy(color);
}
const _wetDARK  = 0.26;   // fraction of the diffuse a fully wet surface loses
const _wetSHEEN = 0.55;   // ...and how hard the grazing highlight comes back
const _wetPOW   = 4.0;    // how tight to the grazing angle the sheen stays

const _grainCache = new Map();
export function grain(m, opts) {
  const o = opts || {};
  const scale = o.scale === undefined ? 0.7 : o.scale;
  const amount = o.amount === undefined ? 0.12 : o.amount;
  const warp = o.warp === undefined ? 0.35 : o.warp;
  // SPARKLE — the second half of this helper, and it is only ever for water.
  //
  // Lambert has no specular term, so every water surface in this game is a flat
  // wash of one colour: the harbour at Circular Quay is a third of the frame and
  // a single value of cyan, and the bay in Palawan is most of a chapter. What
  // makes water read as water at this camera angle is not waves — the meshes
  // already have those and you cannot see them from six metres up — it is
  // GLITTER: a sparse, moving field of points far brighter than the surface.
  //
  // Two value-noise fields multiplied together and thresholded gives a sparse
  // scatter for the price of four hash calls; drifting the sample point on the
  // shared clock makes it travel. The amount is deliberately allowed to exceed
  // 1.0, because the composite pass in main.js blooms anything over the biome's
  // threshold — which is what turns a bright pixel into a glint.
  // WET WITHOUT GRAIN — for the things STANDING on the ground rather than the
  // ground itself. The wet term below is gated on which way a face points, and
  // that gate is the whole reason this option is cheap: the top of a bin faces
  // up and its sides do not, so a prop takes the rain correctly for free. What
  // a prop must NOT take is the world-space grain noise — it is scaled for a
  // road or a lawn and on a half-metre object it reads as dirt. props.js builds
  // ONE shared material for every instanced prop in the game, so this is one
  // shader compile for all thirty-one types in all seventeen chapters.
  const wetOnly = o.wetOnly === true;
  // wetOnly wins over a sparkle, so the invariant above ("the wet gate and
  // nothing else") holds no matter what a call site passes.
  const spark = (wetOnly || o.sparkle === undefined) ? 0 : o.sparkle;
  const sparkScale = o.sparkleScale === undefined ? 2.2 : o.sparkleScale;
  const sparkSpeed = o.sparkleSpeed === undefined ? 0.42 : o.sparkleSpeed;
  // The threshold, and the WIDTH of the ramp above it. The ramp matters more
  // than the threshold: two multiplied noises almost never reach 1.0, so a
  // smoothstep(cut, 1.0) leaves every speck at a third of the strength it was
  // asked for and the whole sea reads as dirty rather than bright. A narrow
  // band saturates, which is what a glint is.
  const sparkCut = o.sparkleCut === undefined ? 0.52 : o.sparkleCut;
  const sparkBand = o.sparkleBand === undefined ? 0.11 : o.sparkleBand;
  const sparkCol = o.sparkleColor === undefined ? 0xffffff : o.sparkleColor;
  const key = m.uuid + '|' + scale + '|' + amount + '|' + warp + '|' +
              spark + '|' + sparkScale + '|' + sparkSpeed + '|' + sparkCut + '|' + sparkBand + '|' + sparkCol +
              '|' + (wetOnly ? 'w' : '');
  const hit = _grainCache.get(key);
  if (hit) return hit;

  const g = m.clone();
  const sc = new THREE.Color(sparkCol);
  // THE WET TERM IS FOR GROUND, NOT FOR WATER. `spark > 0` is this helper's
  // existing and only marker for "this material is a sea", and darkening a sea
  // because it is raining on it is nonsense twice over — it is already water,
  // and it already has the sparkle doing the same job better.
  const wet = spark <= 0;
  g.onBeforeCompile = function (shader) {
    if (spark > 0) shader.uniforms.uGrainT = _grainTime;
    if (wet) {
      shader.uniforms.uGrainWet = _grainWet;
      shader.uniforms.uGrainWetC = _grainWetC;
    }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>',
               '#include <common>\nvarying vec3 vGrainW;' +
               (wet ? '\nvarying vec3 vGrainN;' : ''))
      // `objectNormal` is defined by <beginnormal_vertex>, which three emits
      // BEFORE <begin_vertex> — so the world normal can be taken here without
      // a second replacement. It is needed in world space rather than view
      // space because the whole question the fragment asks is "is this facing
      // UP", and up is a world direction.
      .replace('#include <begin_vertex>',
               '#include <begin_vertex>\nvGrainW = (modelMatrix * vec4(transformed, 1.0)).xyz;' +
               (wet ? '\nvGrainN = normalize(mat3(modelMatrix) * objectNormal);' : ''));
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', [
        '#include <common>',
        'varying vec3 vGrainW;',
        wet ? 'varying vec3 vGrainN;' : '',
        wet ? 'uniform float uGrainWet;' : '',
        wet ? 'uniform vec3 uGrainWetC;' : '',
        spark > 0 ? 'uniform float uGrainT;' : '',
        // Nothing samples the noise field in the wet-only build, so the helpers
        // do not go in either — the shader is the wet gate and nothing else.
        wetOnly ? '' : 'float grHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }',
        wetOnly ? '' : 'float grNoise(vec2 p){',
        wetOnly ? '' : '  vec2 i = floor(p), f = fract(p);',
        wetOnly ? '' : '  vec2 u = f * f * (3.0 - 2.0 * f);',
        wetOnly ? '' : '  return mix(mix(grHash(i), grHash(i + vec2(1.0, 0.0)), u.x),',
        wetOnly ? '' : '             mix(grHash(i + vec2(0.0, 1.0)), grHash(i + vec2(1.0, 1.0)), u.x), u.y);',
        wetOnly ? '' : '}',
      ].join('\n'))
      // AFTER color_fragment, so it modulates the vertex colours a biome has
      // already baked in rather than being overwritten by them.
      .replace('#include <color_fragment>', [
        '#include <color_fragment>',
        '{',
        wetOnly ? '' : '  vec2 gq = vec2(vGrainW.x + vGrainW.y * ' + (0.71 * warp).toFixed(4) + ',',
        wetOnly ? '' : '                 vGrainW.z + vGrainW.y * ' + (0.43 * warp).toFixed(4) + ') * ' + scale.toFixed(4) + ';',
        wetOnly ? '' : '  float gn = grNoise(gq) * 0.64 + grNoise(gq * 2.83 + 19.31) * 0.36 - 0.5;',
        wetOnly ? '' : '  diffuseColor.rgb *= 1.0 + gn * ' + amount.toFixed(4) + ';',
        wet ? [
          // ---- THE WET SURFACE ------------------------------------------
          // GATED ON WHICH WAY THE FACE POINTS, and that gate is most of what
          // makes it convincing for free: water lies on TOP of things. A road,
          // a lawn, a roof and a jetty get the whole effect; a wall, a tree
          // trunk and the side of a market stall get almost none of it, which
          // is exactly what a street looks like after rain and would have cost
          // a per-mesh flag to fake any other way.
          '  if (uGrainWet > 0.001) {',
          '    float wUp = clamp(vGrainN.y, 0.0, 1.0);',
          '    float wK = uGrainWet * wUp * wUp;',
          '    diffuseColor.rgb *= 1.0 - wK * ' + _wetDARK.toFixed(4) + ';',
          // The sheen. A grazing-angle term against the real view vector —
          // `cameraPosition` is one of three's default uniforms and is there in
          // every fragment shader it compiles. Deliberately allowed to run over
          // 1.0: the composite pass blooms whatever clears the biome's
          // threshold, and the wet-street grade has already LOWERED that
          // threshold, so this is the highlight it was lowered for.
          '    vec3 wV = normalize(cameraPosition - vGrainW);',
          '    float wF = pow(1.0 - clamp(dot(vGrainN, wV), 0.0, 1.0), ' + _wetPOW.toFixed(1) + ');',
          '    diffuseColor.rgb += wK * wF * ' + _wetSHEEN.toFixed(4) + ' * uGrainWetC;',
          '  }',
        ].join('\n') : '',
        spark > 0 ? [
          '  vec2 sq = (vGrainW.xz + vec2(uGrainT * ' + sparkSpeed.toFixed(3) + ',',
          '                               uGrainT * ' + (-sparkSpeed * 0.62).toFixed(3) + '))',
          '            * ' + sparkScale.toFixed(4) + ';',
          '  float sp = grNoise(sq) * grNoise(sq * 1.87 + 7.31);',
          '  sp = smoothstep(' + sparkCut.toFixed(3) + ', ' + (sparkCut + sparkBand).toFixed(3) + ', sp);',
          // THE TWO THINGS THAT MAKE IT WATER RATHER THAN STATIC.
          //
          // 1. It has to DIE WITH DISTANCE. A one-cell speck a hundred metres
          //    out is smaller than a pixel, and a sub-pixel speck does not
          //    twinkle, it crawls: the whole far half of the harbour boils as
          //    the camera moves. fwidth gives the sample footprint in cells,
          //    and once one pixel covers half a cell there is nothing honest
          //    left to draw, so it goes.
          // 2. It has to COME IN PATCHES. Real glitter is a sun path and a bit
          //    of chop, not an even dusting; one very low-frequency noise,
          //    drifting slowly, turns an even field into bands.
          '  float sfw = max(fwidth(sq.x), fwidth(sq.y));',
          '  sp *= clamp(1.0 - sfw * 0.60, 0.0, 1.0);',
          '  sp *= smoothstep(0.24, 0.60, grNoise(vGrainW.xz * 0.055 + uGrainT * 0.021));',
          '  diffuseColor.rgb += sp * ' + spark.toFixed(4) +
            ' * vec3(' + sc.r.toFixed(4) + ', ' + sc.g.toFixed(4) + ', ' + sc.b.toFixed(4) + ');',
        ].join('\n') : '',
        '}',
      ].join('\n'));
  };
  // Without this three shares one compiled program between the grained and the
  // ungrained variant of the same material config, and which one you get
  // depends on draw order.
  g.customProgramCacheKey = function () { return 'grain' + key; };
  g.needsUpdate = true;
  _grainCache.set(key, g);
  return g;
}

// ---------------------------------------------------------------------------
// grainOwn — A GRAINED MATERIAL THAT NOBODY ELSE SHARES.
//
// THE BUG THIS EXISTS TO KILL, because it was live in five places and it is
// completely silent: `THREE.Material.prototype.copy()` copies a fixed list of
// properties and `onBeforeCompile` is NOT on it. So
//
//     grain(mat(0xffffff, {...}), { sparkle: 0.42 }).clone()
//
// hands back a material with the hook GONE — `b.onBeforeCompile` falls back to
// the empty one on the prototype (measured on three r169: hasOwnProperty false,
// identical to Material.prototype.onBeforeCompile). The clone was there for a
// good reason — mat() caches by colour+options, and the grain cache keys off
// `m.uuid`, so two chapters asking for the same water get the SAME instance and
// a tide that writes `.color` every frame dyes the other one — but it was
// applied one step too late, and it threw away the whole point of the call.
//
// It cost Venice's flooded square (the chapter's marquee moment), the Bacino,
// Victoria Harbour, the Drift's cloud sea and Iceland's sea their glitter AND
// their break-up. All five rendered as one flat Lambert value, which is exactly
// what grain() was written to stop.
//
// The fix is one step earlier: clone the BASE, which gives it a fresh uuid, so
// the grain cache misses and grain() returns a private grained clone with the
// hook still attached. Same guarantee, opposite order.
// ---------------------------------------------------------------------------
export function grainOwn(m, opts) { return grain(m.clone(), opts); }

// ---------------------------------------------------------------------------
// GIVE A CUE A BEARING WITHOUT TOUCHING THE LEVEL A CHAPTER ALREADY TUNED.
//
// THE SAME FINDING IN EVERY BATCH OF THE PAYOFF PASS, AND IT IS ALWAYS THE
// LOUDEST SOUND IN THE CHAPTER. Batch 3 found 31 mono cues in Marrakech and a
// silent marquee in Venice; batch 4 measured 24 mono calls in Cappadocia, 48 in
// Manly, 47 in the Pantanal, 35 in Palawan and 29 in Antarctica — five whole
// chapters in which nothing at all has a direction, including the one sound the
// player is owed. What made it so easy to leave was that every one of these
// files ALREADY computes the source's (x, z) in order to scale the volume by
// distance, and then throws the position away.
//
// `at:` in systems.js's sfx() would give it a pan, but it also applies its OWN
// inverse-distance rolloff — so passing the position alone attenuates
// everything twice and the chapter's tuning is silently halved. The chapter's
// own `heard` helper has a curve its call sites are balanced against, and it
// should keep owning the volume.
//
// So: `near` is set to the chapter's own `far`, which makes audioPlace's gain
// exactly 1.0 everywhere the chapter thinks the sound is audible, and leaves
// PAN as the only thing it contributes. The outer `far` clears sysSFX_FADE
// (45 m) so its taper never reaches back inside the audible range.
//
//     sfx('bell', placeCue({ volume: 0.3 * h, pitch: 1.6 }, x, y, z, 95))
//
// Mutates and returns the options object, so it wraps an existing call in one
// line and no allocation is added to a per-frame path.
// ---------------------------------------------------------------------------
export function placeCue(o, x, y, z, far) {
  const opts = o || {};
  if (!(x === x && z === z)) return opts;   // NaN in, mono out — never a throw
  opts.at = { x: x, y: y || 0, z: z };
  const f = far > 0 ? far : 120;
  opts.near = f;
  opts.far = f + 46;
  return opts;
}
