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
  // ---- THE COAT (R1). Not three more materials: these are the three STOPS of
  // the vertex gradient painted over `capy`, and they live here because the
  // contract says colours live in the palette and because the next person to
  // re-time the animal's brown needs to see all four of these move together.
  // A real capybara's guard hair is near-black along the midline, warm
  // red-brown on the flank and yellow-brown at the throat where the skin shows
  // through, and the gradient is VERTICAL, not front-to-back.
  //
  //   capyFlank  = capy x 1.077                most of the animal
  //   capySpine  = capyFlank x (0.80 0.74 0.70)  the dorsal midline
  //   capyThroat = capyFlank x (1.12 1.08 1.00)  under the jaw
  //
  // WHY THE FLANK IS NOT `capy` ITSELF, which is the obvious thing and was the
  // first thing: the gradient is one wide darkening against two small
  // brightenings, so hung off `capy` it does not redistribute the animal's
  // light, it REMOVES 4.6% of it. Free contrast on Sydney's lawn; a quarter of
  // Cali's silhouette gone, and Cali is the weakest silhouette in the game.
  // The 1.077 is the number that puts the mean back — measured across four
  // chapters, not chosen (qa/coat-silh.js). The animal's identity value is
  // still `capy`: it is what the material carries and what the whole gradient
  // is quoted against.
  //
  // All three are clear of the two costumes that could be confused with the
  // animal (capyLeather 0x453729, capyParka 0xc4453d) — the wardrobe rule is
  // that a costume the colour of the animal is a lump.
  capyFlank:    0xbe8150,
  capySpine:    0x985f38,
  capyThroat:   0xd58b50,
  // ---- BLACK TIE. What the animal has on after chapter 18's dinner jacket.
  // Midnight blue rather than black, which is what a dinner jacket actually is
  // and which is the only reason it reads as a garment at blue hour instead of
  // as a hole in the animal. The satin is one step up from the cloth so the
  // lapel catches an edge, and the lens is not pure black either — a black lens
  // on a dark head is a smudge, a very dark blue-grey is a lens.
  capyTux:      0x232634,
  capyTuxSatin: 0x333747,
  capyShirt:    0xf2efe4,
  capyBowtie:   0x1a1c26,
  capyShade:    0x1b1f2a,
  capyShadeRim: 0xb8974e,
  // ---- THE REST OF THE WARDROBE. Ten chapters, one costume each.
  // Every one of these is a value a capybara's own three browns are NOT, which
  // is the only rule the set has: a hat the colour of the animal is a lump.
  capyStraw:    0xe0c98a,      // ch1  the stolen sun hat, and ch10's boater
  capyStrawDk:  0xb99e63,
  capyHatBand:  0xb0574f,
  capyNavy:     0x2b3a52,      // ch3  the ferry master's cap
  capyPeak:     0x1b2333,
  capyGold:     0xd8b158,
  capyPlumeA:   0x4bbf9a,      // ch6  Rio, and it is three colours or it is one
  capyPlumeB:   0xe8c25c,
  capyPlumeC:   0xd8628a,
  capyRibbon:   0xc0433f,      // ch10 the boater's band, and the neckerchief
  capyRubber:   0x24272c,      // ch12 mask and snorkel
  capyLens:     0x9fd6e4,
  capySnorkel:  0xe8b93c,
  // ch13 the balloon pilot. 0x7d5334 and 0x5c3c26 first, which are both a
  // capybara — the flying cap went on and DISAPPEARED, in warm Cappadocian
  // light on a warm brown animal, which is the one rule this block states and
  // the one it broke. Dark and slightly cool now, with the shearling doing the
  // separating: a leather cap needs a cream edge to be a leather cap anyway.
  capyLeather:  0x453729,
  capyLeatherDk:0x2b231b,
  capyAmber:    0xd9a24e,
  capyLifeRed:  0xc8433c,      // ch14 the surf cap, in its two colours
  capyLifeYel:  0xe6c34a,
  capyHelmet:   0xdcd7c8,      // ch16 the caver
  capyHelmetDk: 0x8f8b7e,
  capyLampOn:   0xffe9b0,
  capyParka:    0xc4453d,      // ch17 and the ruff is the whole point
  capyParkaDk:  0x8f322c,
  capyFur:      0xd9cdb4,

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

  // ---- chapter 18: Monte Carlo --------------------------------------------
  // THE ONLY CHAPTER SET AT BLUE HOUR, and the palette is built round the one
  // fact that makes that hour worth drawing: the sky is still bright and it has
  // gone COLD, while everything anybody switched on is warm. So there are two
  // families here and almost nothing in between — a cool blue-grey sea, cool
  // limestone, cool tarmac; and against them gilt, sodium, lamplight and the
  // hundred and forty lit windows of a town on a hillside. Nothing is
  // saturated: a principality at dusk is a pastel, and the loudest thing in the
  // chapter is a red-and-white kerb.
  monSea:        0x33648a,      // the Mediterranean with the light off it
  monSeaDeep:    0x1d4568,
  monSeaLt:      0x4a7fa4,
  monBasin:      0x2a4f6d,      // ...and the basin, which holds the town instead
  monBed:        0x7d8b8e,      // six metres down, and you can see it
  monFoam:       0xe4eef2,
  monQuay:       0xc4b9a2,
  monQuayDk:     0xa2977f,
  monConcrete:   0xb0aa9c,      // the tunnel, and it is the only brutal thing here
  monConcreteDk: 0x8b8578,
  monStone:      0xe8dcc0,      // belle-epoque limestone
  monStoneDk:    0xd0c3a3,
  monStoneSh:    0xa8987a,
  monOchre:      0xdfbd85,      // ...and the two other colours a Ligurian street is
  monRose:       0xdcae9a,
  monRoof:       0xb5674a,      // terracotta
  monRoofDk:     0x8e4c34,
  monCopper:     0x74ab97,      // the Casino's oxidised cupolas
  monCopperLt:   0x93c5b1,
  monGold:       0xdcb264,      // and the gilt on everything else
  monGoldDk:     0xb08a3f,
  monMarble:     0xf6ecd2,      // warmed off the true cream: under a hemisphere
                                //   the colour of the sky at twenty past eight,
                                //   an honest 0xf1ead9 renders blue-grey and a
                                //   room lit by six chandeliers looks like a
                                //   car park
  monMarbleDk:   0xdcc9a4,
  monCeil:       0xecd9b4,
  monCarpet:     0x8f3a3a,      // the one straight line in the building
  monCarpetDk:   0x6d2a2c,
  monChairR:     0x7e3a3c,
  monBaize:      0x3c7355,      // the table
  monBaizeDk:    0x2b5741,
  monBrass:      0xc9a457,
  monPaint:      0x7c6a52,      // whatever is in the frames. Nobody looks.
  monPiano:      0x2b2a2e,
  monPianoDk:    0x1d1c1f,
  monKeyW:       0xf4efe2,
  monKeyB:       0x232227,
  monWheelWood:  0x6b4630,
  monWheelRim:   0x8a5c3c,
  monWheelGrn:   0x2f7a4a,      // the zero, and it happens once in thirty-seven
  monWheelHub:   0xbfc3c8,
  monBall:       0xf2eee2,
  monChipR:      0xb04a44,
  monChipK:      0x33343a,
  monChipW:      0xefe7d4,      // ...and the plaque, which is the one you carry
  monPotTerra:   0xb9714d,
  monSoil:       0x6b5744,
  monPalm:       0x5b8a5c,
  monPalmDk:     0x466d49,
  monHedge:      0x5d7a52,
  monCypress:    0x445f46,
  monBougain:    0xb4809a,      // the one flowering thing in the principality, and it
                                //   is knocked back off the true magenta: bougainvillea
                                //   at full chroma is the only saturated thing in the
                                //   palette and it reads as a plastic tray from the road
  monTrunk:      0x8a6a4a,
  monTarmac:     0x45464e,      // the circuit
  monTarmacLt:   0x5b5c65,
  monKerbR:      0xbb4a41,      // ...and its kerbs, which are the loudest thing here
  monKerbW:      0xeee8da,
  monArmco:      0xb2b8bd,
  monArmcoDk:    0x83898e,
  monFence:      0x9aa29c,
  monStandTier:  0xb6ab95,
  monStandSeat:  0x5f7f9c,
  monSodium:     0xffc478,      // the tunnel lights, and they are the whole marquee
  monCarSilver:  0xcdd2d8,      // the car. Of course it is silver.
  monCarDk:      0x808791,
  monCarStripe:  0x8d97a2,
  monCarRed:     0xb2453f,
  monCarRedDk:   0x82302c,
  monCarBlue:    0x3b5f88,
  monCarBlueDk:  0x2a4562,
  monCarGlass:   0x33404e,
  monTyre:       0x2b2b30,
  monWheelHubDk: 0x8d9298,
  monHeadlamp:   0xfff0c4,
  monTailLamp:   0xd6483f,
  monHull:       0xf2efe6,      // a hundred and thirty feet of somebody else's money
  monHullDk:     0xd6d0c2,
  monTeak:       0xb08a55,
  monTeakDk:     0x8a6a3f,
  monMast:       0x9aa0a4,
  monEnsign:     0xc4514a,
  monCloth:      0xece5d6,
  monFlute:      0xdfe8ea,
  monAwning:     0xe2e7e6,
  monAwningRed:  0xb0574f,
  monTux:        0x282a33,      // and what everybody here is wearing
  monShirt:      0xf5f2ea,
  monSkin:       0xd8ac86,
  monHair:       0x4a3a2e,
  monGuard:      0xeeece4,      // the carabinier, in summer whites
  monGuardTrim:  0x333b52,
  monGuardBox:   0xdfd8c6,
  monClock:      0xf0e6cd,
  monMarshal:    0xdc9a3e,
  monMarshalHat: 0xc07f2c,
  monCrowdA:     0x6f7d8c,
  monCrowdB:     0x8f6f74,
  monCrowdC:     0x5f7a6a,
  monCrowdD:     0x9a8a6a,
  monCrowdE:     0x7a6f8c,
  monLamp:       0xffdca4,
  monLampWarm:   0xffc781,
  monLampPost:   0x4a4f52,
  monLampGrn:    0x8ce0a8,
  monLampRed:    0xf08a80,
  monWindow:     0xffe0ad,
  monWindowCool: 0xbcd8ec,      // ...and the fifth of them with a television on
  monPool:       0x6fa8bd,
  monRock:       0x9a907c,      // Le Rocher
  monRockDk:     0x736a58,
  monSkyTop:     0x2f4d78,      // twenty past eight, and it has just gone
  monSkyLow:     0xdba97e,
  monHaze:       0x6a7ea0,
  monSun:        0xffd0a2,

  // ---- chapter 19: Hanoi ---------------------------------------------------
  // TEN IN THE MORNING IN OCTOBER, twenty-nine degrees and eighty per cent
  // humidity, and the palette is the exact opposite of chapter 18's on purpose:
  // that one is a cold sky with warm lights in it and this one is a HOT WHITE
  // sky with nothing switched on at all. Every colour here has had forty years
  // of that sun on it — the mustard, the ochre and the jade are the three
  // colours French colonial plaster fades to and they are on ninety per cent of
  // the buildings — and against them there are exactly four saturated things: a
  // red bridge, a blue tarpaulin, the plastic stools, and two hundred and forty
  // motorbikes, none of which is the same colour as any other.
  hanConcrete:   0xd8cfba,      // pavement, and there is a great deal of it
  hanConcreteDk: 0xb6ad99,
  hanDust:       0xc7b99c,
  hanAsphalt:    0x5a5750,      // hot smooth road with no markings on it
  hanKerb:       0xbfb6a2,
  hanMud:        0xa07c56,      // the Red River is called that for a reason
  hanRiver:      0x9c7550,
  hanLake:       0x4f8168,      // Hoan Kiem, and it is GREEN. Not grey-green:
                                //   at 0x6f8f66 the whole lake read as a lawn
                                //   from any camera above about twenty metres,
                                //   which is most of them.
  hanLakeDeep:   0x2f5b4a,
  hanLakeBed:    0x4a5a3e,
  hanIslet:      0x9a9078,

  // ---- the tube houses, and their three faded colours ---------------------
  hanMustard:    0xdcbf72,
  hanOchre:      0xd39a5f,
  hanJade:       0x9fb79a,
  hanPeach:      0xdfb098,
  hanPlaster:    0xe3dac4,
  hanTrim:       0xf0e9d6,
  hanShutter:    0x5d7a56,      // and the shutters are always this green
  hanShopDk:     0x4a4238,      // the open shopfront, which is a hole
  hanTank:       0xb0b6b8,      // the water tank on every roof in the city
  hanRail:       0x8b8578,
  hanGlass:      0x8ca3a6,
  hanWindow:     0xffe6b4,
  hanWash1:      0xd7566a,      // somebody's washing, on every balcony
  hanWash2:      0x4f7fa8,
  hanWash3:      0xe0c04e,
  hanWash4:      0xefe6d8,
  hanTarp:       0x3f7fa6,      // the blue tarpaulin, and it is EVERYWHERE
  hanTarpRed:    0xb84a3c,
  hanSign1:      0xc23f34,      // the vertical painted signs
  hanSign2:      0x2f6fa0,
  hanSign3:      0xdaa520,
  hanSign4:      0xe6e0cf,
  hanPole:       0x8a8b84,
  hanCable:      0x2e2c2a,      // ...and the ball of them between every pair

  // ---- the traffic ---------------------------------------------------------
  hanBike1:      0xd94f3d,
  hanBike2:      0x3f6fa8,
  hanBike3:      0xe0d9c8,
  hanBike4:      0x4d8560,
  hanBike5:      0xe6b23a,
  hanBike6:      0x6a5f7c,
  hanBikeBody:   0x9aa0a4,
  hanSeat:       0x2f2c2a,
  hanTyre:       0x2a2a2c,
  hanChrome:     0xc8ccd0,
  hanLampGlass:  0xfff2cc,
  hanCrate:      0xb7855a,
  hanCrate2:     0x4f7fa8,
  hanRider:      0xd6d2c6,
  hanRiderLeg:   0x3c4553,
  hanHelmet:     0xe8e4d8,
  hanVisor:      0x3a4650,
  hanSkin:       0xdcae86,
  hanHair:       0x2b2320,
  hanConical:    0xe4d29a,      // the non la, and a third of them are in one

  // ---- train street --------------------------------------------------------
  hanBallast:    0x8e8577,
  hanSleeper:    0x6b5b48,
  hanRail2:      0x9a8f80,
  hanGate:       0xd9d3c4,
  hanGateRed:    0xc0392b,
  hanLoco:       0x4a6b8a,      // a Vietnamese Railways loco is blue and cream
  hanLocoDk:     0x33475c,
  hanLocoRed:    0xb03a2e,
  hanCar1:       0x54718c,
  hanCar2:       0x6d8299,

  // ---- the lake set --------------------------------------------------------
  hanTowerSt:    0xcfc3a8,      // Thap Rua, which is limestone and moss
  hanTowerDk:    0x9a9078,
  hanTowerArch:  0x6a6152,
  hanTempleW:    0xe8d9b4,
  hanTempleR:    0x9c4a35,
  hanTempleCol:  0xa8402f,
  hanTempleDoor: 0x6d3a24,
  hanHuc:        0xc4392c,      // the Huc bridge, and it is the ONE red here
  hanHucDeck:    0xa8382c,
  hanHucDk:      0x8a2c22,
  hanCurtain:    0xa83a30,
  hanPoolWall:   0xbdb3a0,
  hanPup1:       0xc4452f,      // the water puppets, and they are lacquered
  hanPup2:       0x2f6f8a,
  hanPup3:       0xd9a63a,
  hanPupFace:    0xf0dcbc,
  hanPupHat:     0x8a6a3a,
  hanLantern:    0xd9584a,
  hanLanternDk:  0x8a2f28,
  hanLeaf:       0x5f8451,
  hanLeafDk:     0x466439,
  hanTrunk:      0x7a6247,

  // ---- the bia hoi corner, the market and the rest -------------------------
  hanStoolA:     0xd94f3d,      // and there are ninety-six of them
  hanStoolB:     0x3f7fa6,
  hanStoolC:     0x4d8560,
  hanStoolD:     0xe6b23a,
  hanTableTop:   0xdcd4c2,
  hanTableLeg:   0x9aa0a4,
  hanBeer:       0xe8c96a,
  hanKeg:        0xb0b6b8,
  hanStallTop:   0xc8bda6,
  hanStallLeg:   0x8f8878,
  hanHerb:       0x6f9450,
  hanChilli:     0xc0392b,
  hanFish:       0xb8c0c4,
  hanFruit:      0xe0a03a,
  hanRice:       0xefe6cf,
  hanBasket:     0xc0a068,
  hanChair:      0xb85a3a,
  hanMirror:     0xa8bcc0,
  hanMirrorFrame:0x6b5b48,
  hanFlow1:      0xe0778f,      // the flower bicycle
  hanFlow2:      0xefe0c4,
  hanFlow3:      0xd9b23a,
  hanFlow4:      0xa8598a,
  hanCauLeg:     0x3c4553,      // the shuttlecock circle
  hanCauBase:    0xd9584a,
  hanCauFeather: 0xefe6d8,
  hanShirtW:     0xf0ece0,
  hanCrowdA:     0xc85f4a,
  hanCrowdB:     0x4f7fa8,
  hanCrowdC:     0x6f8f56,
  hanCrowdD:     0xd9b23a,
  hanCrowdE:     0xa07898,
  hanCrowdLeg:   0x40474f,
  hanDeck:       0x8a7d68,      // Long Bien
  hanSteel:      0x7d8188,
  hanPier:       0x9a9284,
  hanSkyTop:     0x9dbcd0,      // ten in the morning, and it is a HAZE
  hanSkyLow:     0xe4dcc8,
  hanHaze:       0xcfc7b2,
  hanSun:        0xfff0d2,

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
// ---------------------------------------------------------------------------
// THE RIM, AND WHY IT LIVES IN THE MATERIAL FACTORY RATHER THAN ANYWHERE ELSE.
//
// Audited across all 28 modules: there is no rim term, no fresnel, no ambient
// occlusion and no contact shadow anywhere in this game. The ONLY grazing-angle
// term in the codebase is grain()'s wet sheen, and that is gated on uGrainWet,
// so it exists only when it is raining. A capybara standing on a lawn is a flat
// brown silhouette against a flat green one with nothing at all separating them,
// and that absence is most of why the art style reads as unfinished rather than
// as deliberate. A sky-tinted rim is the single strongest polished-low-poly cue
// there is.
//
// It goes HERE because mat() is the one factory every Lambert in the game comes
// through — the animal, the props, the people, the buildings and the ground —
// and because the strength wants to be ONE number per biome rather than a
// hundred per chapter. So the hook is attached once, the numbers come off two
// shared uniforms, and turning it on for a chapter is a single float write.
//
// FOUR THINGS MAKE IT LIGHT RATHER THAN AN OUTLINE, and each of them was needed:
//
//  1. IT IS THE SKY'S COLOUR, not white. A white edge is a video-game outline;
//     an edge in the colour of the hemisphere the object is standing under reads
//     as light wrapping round it. It is the same argument the wet sheen and the
//     sky dome's horizon are already built on, and it means neon over Mong Kok
//     and flat grey over Kyoto for free.
//  2. IT DIES WITH DISTANCE. A fresnel on a ground plane is strongest where the
//     view is most grazing, which is the HORIZON — so with no distance term the
//     whole far half of every chapter lifts into a haze. Fading it out by forty
//     metres leaves it doing the one job it is for: separating things near the
//     lens from what is behind them.
//  3. IT USES gl_FrontFacing. The sky dome is drawn from the inside; taking the
//     object normal without flipping it makes dot(N, V) negative everywhere on
//     the dome, the clamp turns that into a full-strength rim, and the entire
//     sky washes out.
//  4. IT IS NOT ON TRANSPARENT OR EMISSIVE MATERIALS. A glow quad and a sheet of
//     water are exactly the surfaces whose silhouettes are meant to be soft, and
//     a rim on an additive sheet is added light on top of added light.
//
// CONTRACT: no black outlines. This is that in reverse and it breaks the same
// rule if it is pushed. If the edge reads as an edge instead of as light, it is
// too strong.
const _rimK = { value: 0 };
const _rimC = { value: new THREE.Color(1, 1, 1) };
// The two numbers live inside the shader below rather than as constants read
// into it: 42 metres is where the term is gone entirely, and the exponent is
// how tight to the silhouette it stays. Both are tuned against a photograph and
// neither is worth a uniform.
//
// 2.5 AND NOT 4. Photographed on Mong Kok at the fourth power, the rump came
// back with a pale band round it that had a hard inner boundary — an OUTLINE,
// which is the one thing CONTRACT.md forbids, arrived at from the bright side
// instead of the dark one. A tight exponent puts all of the light in the last
// few degrees before the silhouette, and a narrow bright strip against a body
// is a line drawn on it. A softer one spreads the same energy up the flank,
// which is what light wrapping round a thing actually looks like — and it costs
// nothing on the ground, because the distance fade has already taken care of
// the only place a low exponent would have shown.
/**
 * How hard the rim is in the live chapter, and the colour of the sky doing it.
 * systems.js calls this once per frame, from the hemisphere, for the same reason
 * wetTick() takes its colour from there: a rim is bounce light and bounce light
 * is the sky, so every event that already moves the atmosphere moves this too
 * and no second table has to be kept in step.
 */
export function rimTick(k, color) {
  _rimK.value = k > 0 ? (k < 2 ? k : 2) : 0;
  if (color) _rimC.value.copy(color);
}
/**
 * The declarations and the term, shared by mat()'s hook and grain()'s.
 *
 * Written as template literals rather than as joined arrays of quoted lines:
 * this is GLSL, it has no numbers to interpolate, and a shader you can read is
 * a shader whose brace you can count.
 */
const _RIM_VS_COMMON = `#include <common>
varying vec3 vRimW;
varying vec3 vRimN;`;
const _RIM_VS_BEGIN = `#include <begin_vertex>
vRimW = (modelMatrix * vec4(transformed, 1.0)).xyz;
vRimN = normalize(mat3(modelMatrix) * objectNormal);`;
// ---------------------------------------------------------------------------
// SPILL — AND IT IS DELIBERATELY NOT A PointLight.
//
// Measured (qa/PRESENCE-PASS.md): eight of nine sampled chapters have ZERO
// point lights, and Hong Kong's ground reads a mean luminance of 34.1/255 with
// a sign blazing beside the animal. Monte Carlo's lamp burns white-hot over
// pavement no brighter than pavement fifteen metres away. The composite pass's
// own opening comment says the problem it exists to solve is that a light which
// does not spill is a sticker: it fixed the lens, and the lights still do not
// spill onto the floor.
//
// The obvious fix is a pool of THREE.PointLights, and it is the wrong one HERE.
// Every light three knows about changes NUM_POINT_LIGHTS, which recompiles
// every material in the chapter, and then costs a full lambert-plus-specular
// evaluation per light per fragment on all of them — for an effect that is
// wanted on the floor and on the animal and nowhere else.
//
// This is the same shape as the contact pool one field over: a fixed-size
// uniform block of the nearest N emitters, and a term that ADDS. Eight slots,
// a compile-time literal, one branch when the chapter has no emitters, no
// recompiles ever, no shadow lookups, no specular.
//
// IT LIVES IN THE RIM'S INJECTION, and that is the point. The rim already
// compiles into essentially every material in the game through mat(), it
// already carries the world position and the world normal as varyings, and it
// already sits at <opaque_fragment> where `outgoingLight` is. So the spill
// reaches the ground, the walls, the stalls AND THE CAPYBARA — which no term
// living in grain() could, because the animal's fur is not a grained material.
const _SPILL_N = 8;
const _spillP = { value: [] };   // xyz world position of the cluster, w = its reach
const _spillC = { value: [] };   // colour premultiplied by strength
const _spillOn = { value: 0 };
// HOW MANY SLOTS ARE ACTUALLY LIVE. The loop bound has to be a literal, but a
// break against a uniform is free and it is most of the cost: a chapter with
// two sign clusters in range was paying for eight, on every fragment of every
// object, and the two-thirds it was throwing away is the two-thirds this
// recovers.
const _spillN = { value: 0 };
for (let i = 0; i < _SPILL_N; i++) {
  _spillP.value.push(new THREE.Vector4(0, -9999, 0, 1));
  _spillC.value.push(new THREE.Vector3(0, 0, 0));
}
// A wall facing away from a sign is not pitch black — a lit street is full of
// bounce, and a pure lambert term on a fake light reads as a hard edge running
// down every column. A third of the light arrives regardless of facing.
const _spillWRAP = 0.34;
// HOW FAR A WET FLOOR STRETCHES A SOURCE TOWARD THE LENS, at full wetness and
// on a face pointing straight up. See the block in _RIM_FS_OUT: the reach
// along the view azimuth is multiplied by 1 + this, and across it by nothing
// at all. 2.4 is where a lamp on Mong Kok's road reads as a smear rather than
// as a puddle of light with a slightly oval edge, and it is the highest number
// that does not run the reflection off the bottom of the frame at the resting
// boom, where the ground nearest the lens is four metres from the animal.
const _spillANISO = 2.4;
/** How many slots the pool has. systems.js ranks into this many. */
export function spillSlots() { return _SPILL_N; }
/**
 * THE SAME UNIFORM OBJECTS, for the composite pass to bind (v48).
 *
 * The spill lights SURFACES — it lives in the rim's injection and reaches the
 * ground, the stalls and the animal. What it cannot reach is the air BETWEEN
 * the lens and those surfaces, because there is no fragment there: a lamp in
 * mist is a glow in nothing, and nothing is not a thing this renderer draws.
 * The composite pass is where that has to happen, because it is the only place
 * with a depth buffer and therefore the only place that knows how far the air
 * in front of each pixel goes.
 *
 * It hands back the LIVE objects rather than copies, so main.js binds them once
 * and systems.js goes on writing the pool exactly as it did — one ranking per
 * frame feeding both the surfaces and the air, which is the only way the two
 * can never disagree about where the lights are.
 *
 * `n` is a bound and not a count: systems.js packs live slots to the front.
 */
export function spillUniforms() {
  return { p: _spillP, c: _spillC, on: _spillOn, n: _spillN };
}
/**
 * Write the pool. systems.js calls this once per frame with at most
 * spillSlots() entries, already ranked and already faded:
 *
 *     list[i] = { x, y, z, r, cr, cg, cb }   // colour already scaled by strength
 *
 * Slots past `n` are zeroed for contactTick()'s reason: a source that leaves
 * the pool must not leave a lit patch behind.
 */
export function spillTick(list, n) {
  const P = _spillP.value, C = _spillC.value;
  let live = 0;
  for (let i = 0; i < _SPILL_N; i++) {
    if (i < n) {
      const e = list[i];
      P[i].set(e.x, e.y, e.z, e.r > 0.5 ? e.r : 0.5);
      C[i].set(e.cr, e.cg, e.cb);
      if (e.cr + e.cg + e.cb > 0.002) live++;
    } else {
      C[i].set(0, 0, 0);
    }
  }
  _spillOn.value = live > 0 ? 1 : 0;
  // systems.js packs the live slots to the front, so this is a bound and not
  // merely a count — see the break in the loop.
  _spillN.value = n < _SPILL_N ? n : _SPILL_N;
}

// ---------------------------------------------------------------------------
// THE SKY OCCLUSION TERM — WHY A SHADOW IN THIS GAME WAS A TINT (D1).
//
// MEASURED (qa/rv-shadow.js: render, switch sun.castShadow off, render again,
// diff): the fraction of the resting frame that is cast shadow, and how deep
// it is in levels of 255 —
//
//     sydney 10.9% / 29.4    kyoto 42.0% / 26.9
//     venice 13.0% / 25.2    sahara  6.1% / 31.1
//
// Twenty-nine levels on a 152-level lawn is a 19 per cent drop. The lighting
// comment in systems.js promises "fully lit ~1.2 albedo, open shade ~0.47",
// which is 60 per cent, and the shadow machinery is not what is wrong: 2048
// square, contact-hardened, texel-snapped. The RATIO is wrong, because a
// shadow can only ever remove the SUN's share of the light and the other three
// sources — hemi at 1.35, ambient at 0.12 and the fill — are unshadowed by
// construction. Turning the hemisphere down would darken the lit half too and
// take the whole picture with it.
//
// So: scale the INDIRECT irradiance by how much sun the fragment can see.
// Physically it is a cheat (the sun being blocked says nothing about the sky
// being blocked) and pictorially it is exactly right, because the thing that
// blocks the sun on a street is a building, and a building blocks most of the
// sky too. One number per chapter says how much of the sky survives in shade,
// so an overcast chapter — where the sun is already a rumour — can opt out
// with 1.0 and be bit-for-bit what it was.
//
// It rides the rim's injection because the rim is already on essentially every
// opaque material in the game (mat, matOwn, matSelf, and grain/sway compose on
// top of it), so this reaches the whole picture without a second program and
// without a second hook to forget.
// ---------------------------------------------------------------------------
const _skyOcc = { value: 1 };
let _shadeOn = false;
/**
 * Armed by systems.js AFTER its shadow-chunk override has actually installed —
 * that override is what declares `capyShadowV` and writes the sun visibility
 * into it. If three ever restructures the chunk the override bails, and this
 * stays false so the fragment below is never injected: both halves of the term
 * are switched by one flag, because half of it is a shader that will not link.
 */
export function shadeEnable() { _shadeOn = true; }
/**
 * How much of the SKY's light survives where the sun does not, 0..1. Called on
 * biome change from sysSHADOW_SKY; 1.0 is "no change from before this existed".
 */
export function skyOccTick(v) { _skyOcc.value = v > 0 ? (v < 1 ? v : 1) : 0; }
/** For a probe: the live value, and whether the shader half is actually in. */
export function shadeInfo() { return { sky: _skyOcc.value, on: _shadeOn }; }

// `irradiance` is the accumulated indirect (ambient + light probes + every
// hemisphere light); lights_fragment_END is what hands it to RE_IndirectDiffuse,
// so scaling it here — after the include, before the end — is the whole term.
// capyShadowV is reset on the line BEFORE the include because a material with
// receiveShadow off never enters the branch that writes it.
const _RIM_FS_SHADE = `capyShadowV = 1.0;
#include <lights_fragment_begin>
#if defined( RE_IndirectDiffuse )
  irradiance *= mix(1.0, uShadowSky, 1.0 - capyShadowV);
#endif`;

const _RIM_FS_COMMON = `#include <common>
varying vec3 vRimW;
varying vec3 vRimN;
uniform float uRimK;
uniform vec3 uRimC;
uniform float uShadowSky;
uniform vec4 uSpillP[${_SPILL_N}];
uniform vec3 uSpillC[${_SPILL_N}];
uniform float uSpillOn;
uniform float uSpillN;
uniform float uWetK;`;
// ADDED TO outgoingLight, NOT to diffuseColor. Multiplying the diffuse would
// make the rim take the object's own colour and its own lighting, which is a
// brighter version of the thing rather than light on it. Added at the end it is
// light, it is the sky's colour, and it survives the object standing in shadow
// — which is exactly where a thing most needs separating from what is behind it.
const _RIM_FS_OUT = `{
  vec3 rN = normalize(vRimN);
  if (!gl_FrontFacing) rN = -rN;
  if (uRimK > 0.0005) {
    vec3 rD = cameraPosition - vRimW;
    float rL = length(rD);
    float rf = pow(1.0 - clamp(dot(rN, rD / max(rL, 0.0001)), 0.0, 1.0), 2.5);
    rf *= clamp(1.0 - rL / 42.0, 0.0, 1.0);
    outgoingLight += rf * uRimK * uRimC;
  }
  // ---- THE SPILL. See the block above _RIM_FS_COMMON. ----------------------
  // One coherent branch in the sixteen chapters that register no emitters, so
  // they pay for this exactly nothing.
  if (uSpillOn > 0.5) {
    vec3 sAcc = vec3(0.0);
    // ---- ...AND WET GROUND STRETCHES IT TOWARD THE EYE (D5) ---------------
    // MEASURED (qa/rv-kowloon.png): the chapter whose entire subject is neon
    // on wet asphalt has no vertical smear in it — the reflections under the
    // signs are PAINTED ELLIPSES, geometry laid on the road by the chapter,
    // and the spill that actually lights that road is a circle. A reflection
    // in a wet floor is not a circle. It is the source stretched along the
    // line between it and the viewer, because a horizontal mirror moves the
    // image AWAY from you rather than sideways, and on screen that reads as a
    // vertical streak.
    //
    // So the falloff measures an ANISOTROPIC distance: the component of the
    // offset along the view azimuth is divided by k, which makes the pool of
    // light reach k times further toward and away from the lens and not one
    // centimetre further to either side. Nothing is added and nothing is
    // brightened; the same light is a different shape.
    //
    // THE WHOLE BLOCK IS BEHIND A UNIFORM. uWetK is grain()'s own wetness —
    // weather.js's shine(), wetness ABOVE the chapter's baseline, for the
    // reason stated there — so the eighteen chapters that are not being
    // rained on take one coherent branch and pay nothing, and when it is zero
    // the arithmetic below is exactly the length() it replaces (sVA is a unit
    // vector, so a² + |perp|² + y² is |sD|² when k is 1).
    float sStretch = 0.0;
    vec2 sVA = vec2(0.0, 1.0);
    if (uWetK > 0.001) {
      // GATED ON WHICH WAY THE FACE POINTS, exactly as the wet sheen is and
      // for the same reason: water lies on top of things. A wall beside a sign
      // is wet and does not mirror it downward.
      sStretch = uWetK * clamp(rN.y, 0.0, 1.0);
      vec2 sVv = vRimW.xz - cameraPosition.xz;
      float sVl = length(sVv);
      if (sVl > 0.0001) sVA = sVv / sVl;
    }
    for (int si = 0; si < ${_SPILL_N}; si++) {
      if (float(si) >= uSpillN) break;
      vec3 sD = uSpillP[si].xyz - vRimW;
      float sL = length(sD);
      float sLa = sL;
      if (sStretch > 0.001) {
        float sAx = dot(sD.xz, sVA);
        vec2 sPe = sD.xz - sVA * sAx;
        float sK = 1.0 + ${_spillANISO.toFixed(2)} * sStretch;
        sLa = sqrt(sAx * sAx / (sK * sK) + dot(sPe, sPe) + sD.y * sD.y);
      }
      // Reach, not inverse-square. A physical falloff on a fake light either
      // blows out at the source or dies before it reaches the floor, and the
      // thing being modelled here is a SIGN CLUSTER several metres across
      // rather than a point. A smooth ramp to nothing at the stated reach is
      // also what lets a source leave the pool without a visible edge.
      float sAt = 1.0 - smoothstep(uSpillP[si].w * 0.12, uSpillP[si].w, sLa);
      float sNd = max(dot(rN, sD / max(sL, 0.0001)), 0.0);
      sAcc += uSpillC[si] * sAt * (${_spillWRAP.toFixed(2)} + ${(1 - _spillWRAP).toFixed(2)} * sNd);
    }
    // MULTIPLIED BY THE ALBEDO, which is the whole difference between light and
    // paint: a magenta sign over grey asphalt makes a grey street slightly
    // magenta, and over a red awning it makes the awning glow. Added flat it
    // would wash every surface to the same colour and read as fog.
    outgoingLight += sAcc * diffuseColor.rgb;
  }
}
#include <opaque_fragment>`;
// ---------------------------------------------------------------------------
// ...AND THE ANIMAL GETS ITS OWN, ON THE SAME PROGRAM (P1)
//
// The block above reasons that what makes a rim visible is its contrast against
// the ANIMAL'S OWN INTERIOR, and it is right — but it is answering a different
// question from the one that matters here, which is whether you can find the
// capybara in the frame at all. MEASURED 2 Sep, all nineteen chapters, at the
// resting boom: render the frame, hide the animal, render again, and take the
// mean luma of every pixel that changed against what was behind it. That number
// is the silhouette contrast, and it is not the same in every chapter:
//
//   palawan 81 · pasto 78 · quay 57 · sahara 55 · venice 42 · sydney 41
//   manly 38 · iceland 32 · rio 30 · antarctic 25 · kowloon 23
//   kyoto 18 · goreme 17 · cave 14 · drift 13 · hanoi 12 · pantanal 12
//   monaco 8 · CALI 4.5
//
// Cali is four and a half levels of grey. A brown animal, a green lawn, a green
// awning over it and a grade that pulls both toward the same value: the
// silhouette is not dark against light or light against dark, it is the
// background with a different hue. Eight chapters sit under twenty.
//
// A SECOND RIM WOULD BE THE WRONG ANSWER and so would a second program: the
// term is already compiled into essentially every material in the game and
// reports one cache key so they share it. What the capybara needs is not
// another term, it is DIFFERENT NUMBERS in the one it already has — so the
// injection is factored to take its uniform objects as arguments, `matSelf`
// binds the animal's pair instead of the world's, and the program is bit for
// bit the one every wall in the chapter is already using. The capybara does not
// gain a rim here. It stops sharing the scenery's.
function _rimInjectWith(kU, cU) {
  return function (shader) {
    shader.uniforms.uRimK = kU;
    shader.uniforms.uRimC = cU;
    shader.uniforms.uShadowSky = _skyOcc;
    shader.uniforms.uSpillP = _spillP;
    shader.uniforms.uSpillC = _spillC;
    shader.uniforms.uSpillOn = _spillOn;
    shader.uniforms.uSpillN = _spillN;
    // The SAME uniform object grain() binds as uGrainWet, under a second name
    // — and the second name is not cosmetic. grain() injects its own
    // `uniform float uGrainWet;` at `#include <common>` and then calls this
    // hook, which replaces the same include again; two declarations of one
    // name in one shader is a compile error, and the material would have gone
    // black rather than warned.
    shader.uniforms.uWetK = _grainWet;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', _RIM_VS_COMMON)
      .replace('#include <begin_vertex>', _RIM_VS_BEGIN);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', _RIM_FS_COMMON)
      .replace('#include <opaque_fragment>', _RIM_FS_OUT);
    if (_shadeOn) {
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <lights_fragment_begin>', _RIM_FS_SHADE);
    }
  };
}
const _rimInject = _rimInjectWith(_rimK, _rimC);
const _selfK = { value: 0 };
const _selfC = { value: new THREE.Color(1, 1, 1) };
const _selfInject = _rimInjectWith(_selfK, _selfC);
/**
 * How hard the rim is ON THE ANIMAL, and in what colour. systems.js calls this
 * from the same place it calls rimTick, off the same hemisphere — see sysSELF.
 */
export function selfRimTick(k, color) {
  _selfK.value = k > 0 ? (k < 2 ? k : 2) : 0;
  if (color) _selfC.value.copy(color);
}
/**
 * Both rims, for an audit. A material whose hook silently failed to bind still
 * DRAWS — it is simply the one thing in the chapter with no rim on it, which is
 * matOwn's own warning and is not something a frame-mean metric can see. This
 * is how a probe tells "the animal has its own rim" from "the animal has none".
 */
export function rimInfo() {
  return { world: _rimK.value, self: _selfK.value,
           worldC: [_rimC.value.r, _rimC.value.g, _rimC.value.b],
           selfC: [_selfC.value.r, _selfC.value.g, _selfC.value.b] };
}
/**
 * A PRIVATE material that reads the animal's rim rather than the world's.
 *
 * Uncached and never shared, for matOwn's reason and one more: `mat()` caches
 * by colour, and PALETTE.capy is not unique to the capybara — handing the cache
 * a self-rimmed material under that key would put the animal's rim on whatever
 * else happens to be the same brown. Same cache key as every other rimmed
 * material on purpose: same source, same program, different uniforms.
 */
export function matSelf(color, opts) {
  const m = new THREE.MeshLambertMaterial(Object.assign({ color, flatShading: true }, opts || {}));
  if (_rimWants(opts)) {
    m.onBeforeCompile = _selfInject;
    m.customProgramCacheKey = _rimKey;
    if (!m.userData) m.userData = {};
    m.userData.capySelf = true;   // so canopyAudit can count what actually bound
  }
  return m;
}
/** True where a rim would be wrong on principle rather than merely subtle. */
function _rimWants(opts) {
  if (!opts) return true;
  if (opts.transparent) return false;
  if (opts.emissive !== undefined) return false;
  if (opts.blending !== undefined && opts.blending !== THREE.NormalBlending) return false;
  if (opts.depthWrite === false) return false;
  return true;
}

// ---------------------------------------------------------------------------
// THE LEAF — LIGHT COMING THROUGH A THING RATHER THAN OFF IT.
//
// Audited across all 28 modules before writing this: there is no translucency,
// no transmission, no wrap and no back-lighting term anywhere in this game. The
// only hits for the word are four comments about a propeller, a bag of
// biscuits, a ghost and a silhouette. So every leaf, frond, blade, petal and
// lily pad in nineteen chapters is an opaque Lambert facet — and a leaf is the
// one thing in the natural world that is famously NOT opaque. Son Doong's
// vegetation reads as cut paper for this reason and nothing else.
//
// It is the same argument the rim is built on, one surface type over: the rim
// separates a silhouette from the background, and this is what makes a canopy
// read as a canopy instead of as a green polygon with a light on it.
//
// FOUR THINGS ABOUT HOW.
//
//  1. IT IS MULTIPLIED BY THE ALBEDO. Light through a leaf comes out the
//     colour of the leaf. Added flat it is a white haze on one side of every
//     plant, which is the failure mode of every cheap version of this. Same
//     reasoning as the spill's own multiply, one line down from it.
//  2. IT IS A LOBE AROUND THE ANTI-SUN DIRECTION, not a fresnel. The eye sees
//     transmitted light when it is roughly opposite the sun THROUGH the leaf,
//     so the term peaks at dot(V, -L) and is tightened with a power. Distorted
//     toward the surface normal so a leaf turned part-way still catches some,
//     which is what the distortion term in every screen-space approximation of
//     this is for.
//  3. IT WORKS IN VIEW SPACE AND ADDS NO VARYINGS. `vViewPosition` and
//     `normal` are already in scope at <opaque_fragment> in every Lambert
//     three compiles, so the whole term is free of the plumbing the rim needs
//     — it only costs the sun direction being pushed through the camera once
//     a frame, which leafTick does for the caller.
//  4. IT IS ITS OWN PROGRAM. The rim compiles into essentially every material
//     in the game and reports ONE cache key so the hundreds of them share one
//     program; putting this term in there would make every wall, bollard and
//     capybara in the game pay a normalize and a pow for a thing only plants
//     want. A leaf material gets a second program and nothing else changes.
//
// SHADOWS ARE DELIBERATELY IGNORED. A leaf glowing in the shade is wrong and
// the fix is a shadow lookup this term cannot afford; the answer is to keep the
// strength low enough that the case never reads as a mistake. Same bargain the
// spill already takes.
const _leafL = { value: new THREE.Vector3(0, 1, 0) };   // toward the sun, VIEW space
const _leafC = { value: new THREE.Vector3(1, 1, 1) };
const _leafOn = { value: 0 };
const _leafDIST = 0.30;
const _leafPOW = 3.0;
const _leafV = new THREE.Vector3();
/**
 * The sun, for everything with a leaf on it. systems.js calls this once a
 * frame from the same place it calls rimTick — a transmitted colour is the
 * sun's colour, so every event that already moves the light moves this and no
 * second table has to be kept in step.
 *
 * `dir` is the WORLD direction from the ground toward the sun; the camera is
 * taken so the push into view space happens once here rather than in nineteen
 * chapters. `on` is the cut — see game.state.noLeaf.
 */
export function leafTick(dir, color, camera, on) {
  _leafOn.value = on === false ? 0 : 1;
  if (dir && camera) {
    _leafV.copy(dir).transformDirection(camera.matrixWorldInverse);
    _leafL.value.copy(_leafV).normalize();
  }
  if (color) _leafC.value.set(color.r, color.g, color.b);
}
const _LEAF_FS_OUT = `{
  if (uLeafOn > 0.5 && uLeafK > 0.0) {
    vec3 lV = normalize(vViewPosition);
    vec3 lH = normalize(uLeafL + normal * ${_leafDIST.toFixed(3)});
    float lB = pow(clamp(dot(lV, -lH), 0.0, 1.0), ${_leafPOW.toFixed(2)});
    outgoingLight += lB * uLeafK * uLeafC * diffuseColor.rgb;
  }
}
#include <opaque_fragment>`;
const _leafCache = new Map();
/**
 * Give a MATERIAL the term. Returns a clone; the original is untouched.
 * Chains whatever hook the material already had, exactly as sway() does — a
 * leaf material that lost its rim or its grain would be the grainOwn() bug
 * again, and a canopy is precisely the kind of thing that has both.
 */
export function leaf(m, k) {
  if (!m || !(k > 0)) return m;
  const key = m.uuid + '|' + k;
  const hit = _leafCache.get(key);
  if (hit) return hit;
  const g = m.clone();
  const prev = m.onBeforeCompile;
  const hadHook = typeof prev === 'function' && m.hasOwnProperty('onBeforeCompile');
  const prevKey = m.customProgramCacheKey;
  // Per material, so one program serves every strength in the game.
  const uK = { value: k };
  g.onBeforeCompile = function (shader) {
    if (hadHook) prev.call(this, shader);
    shader.uniforms.uLeafL = _leafL;
    shader.uniforms.uLeafC = _leafC;
    shader.uniforms.uLeafOn = _leafOn;
    shader.uniforms.uLeafK = uK;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>',
               '#include <common>\nuniform vec3 uLeafL;\nuniform vec3 uLeafC;\n' +
               'uniform float uLeafOn;\nuniform float uLeafK;')
      // The rim, if there is one, has already replaced <opaque_fragment> with
      // its own block ending in the include — so this lands OUTSIDE it and
      // both terms reach outgoingLight before it is consumed.
      .replace('#include <opaque_fragment>', _LEAF_FS_OUT);
  };
  g.customProgramCacheKey = function () {
    return 'leaf1' + (prevKey ? '|' + prevKey.call(this) : '');
  };
  // ---- THE MARKER, AND WHAT IT IS FOR NOW (P1) --------------------------
  // Kept from a feature that was measured and then removed. P1 built a
  // dissolve on this material — a cone from the lens to the animal, so a
  // canopy between the two thinned out of the way — because the camera in
  // the gardens had been photographed with two fig crowns on the eye-to-
  // capybara line and the animal nowhere in frame.
  //
  // IT WAS THE WRONG DIAGNOSIS AND THE MEASUREMENT SAID SO. Paired A/B in one
  // session (cut on and off, same frame, same camera): 24 yaws at each of four
  // stations plus thirty legs of a walk through the grove — 84,479 px of
  // capybara with the dissolve off and 84,627 with it on, a fifth of one per
  // cent, with as many yaws worse as better. The frame that started it was
  // real, and it was the LOOK RAISE (see sysLOOK_RAISE's block in systems.js):
  // the boom had been cut to 0.16 by a pine trunk and the target was still
  // aiming 1.6 m over the animal's head, so she was off the bottom of the
  // screen. Fix the raise and the foliage is beside her, not in front.
  //
  // The marker stays because `hud.canopyAudit()` walks for it, and that is how
  // the above was measured. If somebody rebuilds the dissolve, measure the
  // paired pixel count first — a zero-width ray reports "nothing in the way"
  // for a cone that is plainly changing the picture, and that instrument is
  // the reason this took three passes.
  if (!g.userData) g.userData = {};
  g.userData.capyLeaf = true;
  g.needsUpdate = true;
  _leafCache.set(key, g);
  return g;
}
/**
 * Give a MESH the term, which is what a call site actually wants.
 *
 * Deliberately NOT touching customDepthMaterial, unlike swayMesh: this term
 * only ever adds to outgoingLight and the depth pass does not have one, so
 * there is nothing there to keep in step.
 */
export function leafMesh(mesh, k) {
  if (!mesh || !mesh.material || !(k > 0)) return mesh;
  mesh.material = leaf(mesh.material, k);
  return mesh;
}

const _matCache = new Map();
export function mat(color, opts) {
  const key = color + '|' + (opts ? JSON.stringify(opts) : '');
  let m = _matCache.get(key);
  if (m) return m;
  m = new THREE.MeshLambertMaterial(Object.assign({ color, flatShading: true }, opts || {}));
  if (_rimWants(opts)) {
    m.onBeforeCompile = _rimInject;
    // Every rimmed material injects the SAME source, so they must all report the
    // same key or three compiles one program per material instead of sharing
    // across the hundreds of them that differ only in a colour uniform.
    m.customProgramCacheKey = _rimKey;
  }
  _matCache.set(key, m);
  return m;
}
// The key has to move with the shade term or a session that armed it late
// would share a program compiled without it. `_shadeOn` is set once at boot,
// before anything renders, so in practice every material agrees — this is the
// honest spelling of that, not a case anybody will hit.
function _rimKey() { return _shadeOn ? 'rim2s' : 'rim2'; }

// ---------------------------------------------------------------------------
// matOwn — A RIMMED MATERIAL THAT NOBODY ELSE SHARES.
//
// Exactly grainOwn's problem one layer down, and the same silent shape. mat()
// caches by colour+options, so a caller that needs a PRIVATE material — because
// it writes .color or .emissive on it every frame — has to clone. But
// `Material.copy()` copies a fixed list of properties and `onBeforeCompile` is
// not on it, so
//
//     mat(PALETTE.palFishA).clone()
//
// hands back a material whose rim hook is GONE, along with the
// customProgramCacheKey that lets the rimmed materials share one program. The
// mesh still draws; it is simply the one opaque batch in the chapter with no
// rim on it, which is not something a frame-mean metric can see.
//
// Same guarantee as the clone, without the loss: build it uncached, and attach
// the hook to the thing that is actually used.
// ---------------------------------------------------------------------------
export function matOwn(color, opts) {
  const m = new THREE.MeshLambertMaterial(Object.assign({ color, flatShading: true }, opts || {}));
  if (_rimWants(opts)) {
    m.onBeforeCompile = _rimInject;
    m.customProgramCacheKey = _rimKey;
  }
  return m;
}

// ---------------------------------------------------------------------------
// OVER-WHITE — A THING THAT MAKES LIGHT SHOULD BE BRIGHTER THAN A THING THAT
// DOES NOT, AND FOR EIGHT CHAPTERS IT WAS NOT (D5).
//
// The bright pass takes one THRESHOLD per chapter (`sysGRADES`), and a
// threshold is a single number asked to answer two different questions at
// once: "which pixels are lamps" and "which pixels are merely pale". In a
// chapter with a lantern over a limestone street those are not separable —
// D45-13 (Göreme) and D45-11 (Mong Kok) are both a picture of a threshold set
// low enough to find the lamps and therefore low enough to find the road
// markings, the paving and half the sky.
//
// The fix is not a better threshold. It is to stop asking the threshold to do
// it: a lamp should RENDER above 1.0, so that any threshold at or below white
// finds it and nothing that is merely white can follow it up there. The scene
// target is HalfFloat (see main.js) so values over 1.0 survive the whole way
// to the bright pass, and `sparkle` has been exploiting exactly this since
// v13 — its own comment says the amount "is deliberately allowed to exceed
// 1.0, because the composite pass blooms anything over the biome's threshold".
// This is that argument applied to the things that are actually lights.
//
// 1.45, and it is a HEADROOM rather than a brightness. An emitter that was
// rendering at 0.90 of white now renders at 1.31 — visually almost unchanged,
// because everything downstream of the bright pass runs through the grade's
// shoulder, which is a tone curve and has always compressed the top. What
// changes is that it is now unambiguously ON THE LAMP SIDE of any threshold a
// chapter cares to set. Higher than this and a lamp starts to bloom as a
// disc rather than as a source.
export const EMIT_OVER = 1.45;
/**
 * A LANTERN, A NEON TUBE, A LIT WINDOW — the emitter constructor the chapters
 * were each writing their own copy of (antarctic, cave, göreme, hanoi,
 * kowloon and palawan all had one, character for character).
 *
 * `k` is the intensity a chapter would have written by hand; the over-white
 * is applied here so that the number in a chapter goes on meaning what it
 * meant and there is one place to change how far past white an emitter goes.
 */
export function matEmit(color, k, opts) {
  return mat(color, Object.assign({ emissive: color,
                                    emissiveIntensity: (k === undefined ? 1 : k) * EMIT_OVER },
                                  opts || {}));
}
/**
 * ...and the same for the ones that MOVE, which is most of the interesting
 * ones: a lamp coming on at dusk, a brazier flickering, a bulb pulsing.
 * Those write `emissiveIntensity` every frame and would otherwise walk
 * straight past matEmit's factor on the first frame after construction.
 */
export function emitSet(m, k) {
  if (m) m.emissiveIntensity = (k > 0 ? k : 0) * EMIT_OVER;
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
  // ---- ACT TWO: THE FORECOURT (F4) --------------------------------------
  // Sydney was the last flat list in the first third of the game and the one
  // where a shape matters most: it is the chapter every player opens on, it
  // has nineteen rows — the longest list anywhere — and it is laid out as
  // three obvious places you walk between. The gardens, the forecourt, the
  // promenade. All the acts do is put the paper in the one you are standing
  // in; nothing is gated, and F still reaches every row (see the two rules
  // above).
  { id: 'opera-stage',  text: 'Take the stage at the Opera House',      chapter: 1, act: 2, wow: 'SYDNEY' },
  { id: 'ball-harbour', text: 'Put the beach ball in the harbour',      chapter: 1, act: 2 },
  { id: 'swim',         text: 'Have a dignified swim',                  chapter: 1, act: 2 },
  { id: 'hat-harbour',  text: 'Drop the stolen hat in the harbour',     chapter: 1, act: 2 },
  // The quay is Sydney: same biome, same coordinates, a walk up the promenade
  // from the Opera House forecourt. It is not a chapter of its own — a chapter
  // is a PLACE you have to travel to, and there are two of those.
  // ---- ACT THREE: THE PROMENADE. The café, the busker, the chip shop, the
  // van and the wharf are all the walk north from the forecourt — and the
  // ferry is the door out of the chapter, so the last movement ends where the
  // chapter does. `dog-loose` and `sprinkler` stay in act one: both are on the
  // lawn, and both are things you do to somebody having a nice afternoon,
  // which is what act one IS.
  { id: 'cafe-table',    text: 'Stand on a café table',                 chapter: 1, act: 3 },
  { id: 'busker-hat',    text: 'Rob the busker mid-song',               chapter: 1, act: 3 },
  { id: 'dog-loose',     text: 'Let the dog off its lead',              chapter: 1 },
  { id: 'seagull-chips', text: 'Introduce the seagulls to the chips',   chapter: 1, act: 3 },
  { id: 'sprinkler',     text: 'Soak a tourist with the sprinkler',     chapter: 1 },
  { id: 'ferry-ride',    text: 'Stow away on the ferry',                chapter: 1, act: 3 },
  // The mini. Sydney had exactly one moving thing in it and it was forty metres
  // offshore; this one comes past you, twice a minute, ringing.
  { id: 'whippy-run',    text: 'Ride the ice cream van down the promenade', chapter: 1,
    act: 3, mini: 'MR WHIPPY' },

  // ---- Chapter 2: Pasto, Nariño — the Galeras volcano ----
  // 'to-pasto' ticks itself the moment you arrive, so the window the player
  // actually opens on is empanada / stall / whistle / ride: two easy wins in the
  // market, and then the condor, which is the thing worth coming for.
  { id: 'to-pasto',        text: 'Emigrate (somehow)',                    chapter: 2 },
  { id: 'steal-empanada',  text: 'Steal an empanada',                     chapter: 2 },
  { id: 'market-chaos',    text: 'Bring down a market stall',             chapter: 2 },
  { id: 'whistle-condor',  text: 'Call down a condor',                 chapter: 2, act: 2 },
  { id: 'condor-ride',     text: 'Grab its talons and hold on',           chapter: 2, act: 2, wow: 'GALERAS' },
  { id: 'thermal-peak',    text: 'Ride a thermal to the crater rim',      chapter: 2, act: 3 },
  { id: 'crater-drop',     text: 'Post something into the crater',        chapter: 2, act: 3 },
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
  { id: 'to-kyoto',       text: 'Get off the train at Kyoto',            chapter: 4 },
  // ---- THE NEAREST THING FIRST, AND ONLY IN THIS CHAPTER (B6) ----------
  // Kyoto is the one chapter that ticks NOTHING in ninety seconds, under both
  // drivers, in four consecutive runs of `qa/first-five.js`. Its act one is the
  // most spread-out in the game — measured from the spawn: the lantern 19 m,
  // the rock garden 47, the pond 72, the stepping stones 76, the river 79, the
  // torii 98, the bamboo 118 — and the paper offers rows in AUTHOR ORDER, so
  // the top row on arrival was the second-furthest thing in the chapter.
  //
  // Nothing moves in the world. The lantern was always nineteen metres away;
  // it was simply listed under a hundred-metre walk. `torii-run` keeps its
  // mini and its place in the chapter, one row down, and the marquee line (B1)
  // is what says the chapter is about the river now — which is the job the
  // first row used to be doing badly.
  { id: 'lantern-topple', text: 'Topple a stone lantern',                chapter: 4 },
  // THE SECOND MINI, and the chapter had room for it: forty-four gates up a
  // mountain of sugi is the shot everybody who has ever heard of this place has
  // in their head, and it was paying out with a tick and a line of text — the
  // same channel as knocking over a lantern. See the `mini` note above and
  // [[capy3-the-middle-rung]]: a set piece worth twenty-five seconds gets the
  // half-lift and the moment card, not a bigger toast.
  { id: 'torii-run',      text: 'Run the whole torii tunnel',            chapter: 4,
    mini: 'SENBON TORII' },
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
  { id: 'matcha-raid',    text: 'Get into the matcha at Uji',            chapter: 4, act: 2 },
  { id: 'whisk-spin',     text: 'Whisk the largest bowl of tea in Japan', chapter: 4, act: 2 },
  // The mini, and the one that is not a ride: the loudest object in Japan,
  // and a metre of daylight under the rim of it.
  { id: 'the-bell',      text: 'Be inside the bell when it goes',                chapter: 4, act: 2,
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
  { id: 'chiva-ride',     text: 'Get on the chiva',                      chapter: 5, act: 2 },
  // The chapter's set piece, and it is fifth for the same reason the condor is
  // fourth in Pasto: you get on the roof, and then the roof leaves. Everything
  // after this line happens at night, because the ride is what puts the sun
  // down — see caliNight() in cali.js.
  { id: 'chiva-mirador',  text: 'Ride it up to the mirador',             chapter: 5, act: 2, wow: 'CALI' },
  { id: 'cane-run',       text: 'Disappear into the sugarcane',          chapter: 5 },
  { id: 'salsa-dance',    text: 'Dance salsa, properly',                 chapter: 5 },
  { id: 'cristo-rey',     text: 'Climb up to Cristo Rey',                chapter: 5, act: 3 },
  // The mini, and the way back down. Everything that goes up in this game
  // has something at the far end that returns you. Cali did not.
  { id: 'cart-run',      text: 'Run the fruit barrow off the ridge',             chapter: 5, act: 3,
    mini: 'LA CARRETILLA' },

  // ---- Chapter 6: Rio de Janeiro ----
  // The second chapter built on a beat, and deliberately NOT a second salsa
  // floor. Cali is a circle you stand in where any beat will do. Samba is in
  // 2/4 and the surdo — the heartbeat of a bateria, the drum you feel in your
  // chest from two streets away — lands on the TWO. So Rio's centrepiece MOVES
  // (a parade is a column going somewhere, and you have to keep station in it)
  // and only every other beat counts. Hitting the one is not a near miss; it is
  // the wrong beat, and the bateria will let you know.
  { id: 'to-rio',         text: 'Arrive in Rio, loudly',                 chapter: 6 },
  // Burle Marx's wave: the most copied paving on earth, drawn for a hundred and
  // ninety metres so it is recognisable in the very first frame, and never used.
  { id: 'calcadao',       text: 'Run the whole wave',                   chapter: 6 },
  { id: 'globo-biscuit',  text: 'Rob the biscoito Globo man',           chapter: 6 },
  { id: 'futevolei',      text: 'Head the ball into the Atlantic',      chapter: 6 },
  { id: 'kiosk',          text: 'Help yourself at the kiosk',           chapter: 6 },
  { id: 'selaron-steps',  text: 'Take Selarón’s steps at speed',        chapter: 6, act: 2 },
  { id: 'bateria',        text: 'Get in among the bateria',             chapter: 6, act: 2 },
  { id: 'samba-parade',   text: 'Samba down the avenue, on the two',    chapter: 6, act: 2, wow: 'RIO' },
  { id: 'bondinho',       text: 'Stow away on the Sugarloaf cable car', chapter: 6, act: 3 },
  { id: 'arpoador',       text: 'Take the applause at Arpoador',        chapter: 6, act: 3 },
  // The mini, and it is built entirely out of flow() — a wave is a patch of
  // water that is itself going somewhere, not a force and not a new verb.
  { id: 'take-a-wave',   text: 'Take a wave in at Arpoador',                     chapter: 6,
    mini: 'THE SET' },
  // The second mini, and it was half built already: rioBuildLapa put forty-two
  // arches over Lapa with a deck on top and the comment "where the tram runs",
  // and then nothing ran on it and nothing could stand on it.
  { id: 'o-bonde',       text: 'Cross the arches on the running board',          chapter: 6, act: 2,
    mini: 'O BONDE' },
  // ---- THE SECOND FLIER, AND IT IS DELIBERATELY NOT A THIRD SET PIECE -----
  // condor.js stopped belonging to Pasto (see condorHost) and Rio is the second
  // chapter to host it: eighty-four metres of Corcovado for the air to rise off
  // and nine frigatebirds already drawn over the bay, which nothing could reach.
  //
  // Two ordinary lines and no `mini`, on purpose. Rio already carries the wow
  // (samba-parade) and TWO minis — it was one of the four chapters the pacing
  // audit measured shortest, so it got a second — and the middle-rung rule says
  // no chapter has two of the same KIND of moment in it. A third elevated
  // moment here would take from the three that are already earned. The flight
  // is its own reward; it does not need a banner to say so.
  { id: 'fragata',       text: 'Call down a fragata',                            chapter: 6, act: 3 },
  { id: 'fragata-ride',  text: 'Ride the sea breeze up the Sugarloaf',           chapter: 6, act: 3 },

  // ---- Chapter 7: Iceland — Reykjavik, the geysers and the glacier ----
  // The first chapter that happens at NIGHT, and the first one whose centrepiece
  // is not a thing you do to somebody: it is a thing the sky does to you. The
  // shape of the list is a night out — noise in town, then further and further
  // from the lights, and the last two lines are the quietest in the game.
  //
  // The pacing rule holds: 'pylsa' is four steps from where you land, and the
  // set-piece (a geyser that throws a capybara twenty-five metres) is third.
  { id: 'to-iceland',     text: 'Get off the boat at Reykjavík',         chapter: 7 },
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
  { id: 'to-sahara',      text: 'Walk into Jemaa el-Fnaa',               chapter: 8 },
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
  { id: 'updraft',     text: 'Let a column of air carry you up',          chapter: 9, act: 2 },
  // The chapter promises this and never says it out loud: falling off is not a
  // punishment, and the cloud gathers under you and gives you back. 'cloud-dive'
  // pays for the falling; nothing paid for the part that matters.
  { id: 'handed-back', text: 'Let the cloud hand you back',               chapter: 9, act: 2 },
  { id: 'wander-isle', text: 'Hitch a lift on a wandering island',        chapter: 9, act: 2 },
  { id: 'long-gap',    text: 'Cross twenty metres of nothing, in one go', chapter: 9, act: 2 },
  { id: 'lantern',     text: 'Light the lantern at the top of the world', chapter: 9, act: 2, wow: 'THE DRIFT' },
  // The mini, and the only thing up here you have to CATCH.
  { id: 'driftseed',     text: 'Cross the void on a seed',                       chapter: 9, act: 2,
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
  { id: 'to-venice',    text: 'Step off onto a wet pavement',           chapter: 10 },
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
  { id: 'to-kowloon',   text: 'Get out at street level in Mong Kok',    chapter: 11 },
  { id: 'egg-tart',     text: 'Rob the bakery on Fa Yuen Street',       chapter: 11 },
  { id: 'bamboo-climb', text: 'Go up the bamboo',                       chapter: 11, act: 2 },
  { id: 'laundry-pole', text: 'Cross the street on the laundry poles',  chapter: 11, act: 2 },
  { id: 'wet-market',   text: 'Let the fish out at the wet market',     chapter: 11 },
  { id: 'neon-sign',    text: 'Hang off the biggest sign in Mong Kok',  chapter: 11, act: 2 },
  { id: 'symphony',     text: 'Be on the roof when the lights come on', chapter: 11, act: 2, wow: 'HONG KONG' },
  { id: 'star-ferry',   text: 'Ride the Star Ferry across',             chapter: 11, act: 3 },
  // Sydney sounds off under the Bridge and it is the best thirty seconds in
  // chapter three. This ship has had a horn on it since 1957.
  { id: 'ferry-horn',   text: 'Lean on the Star Ferry’s horn',          chapter: 11, act: 3 },
  // Eight hundred metres of harbour across the bottom of the map, and eleven
  // tasks that never once suggested getting in it.
  { id: 'harbour-swim', text: 'Swim in Victoria Harbour',               chapter: 11, act: 3 },
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
  { id: 'to-palawan',   text: 'Wash up on a beach, for once on purpose', chapter: 12 },
  { id: 'outrigger',    text: 'Ride the bangka out to the island',      chapter: 12 },
  // The oldest thing anybody has ever done off a jetty, and the exact opposite
  // of 'first-dive': that one is a key you hold, this one is a decision you make
  // at a run and then cannot take back.
  { id: 'jetty-jump',   text: 'Go off the end of the jetty',            chapter: 12 },
  { id: 'first-dive',   text: 'Go under',                               chapter: 12, act: 2 },
  { id: 'the-crack',    text: 'Get into the hidden lagoon',             chapter: 12, act: 2 },
  { id: 'sea-turtle',   text: 'Keep up with the turtle',                chapter: 12, act: 2 },
  { id: 'giant-clam',   text: 'Take something from the giant clam',     chapter: 12, act: 2 },
  { id: 'cathedral',    text: 'Find the room with the hole in the roof',chapter: 12, act: 3 },
  { id: 'the-bloom',    text: 'Be under when the water lights up',      chapter: 12, act: 3, wow: 'PALAWAN' },
  // The mini, and the one thing down here that reacts to you.
  { id: 'bait-ball',     text: 'Swim into the middle of the bait ball',          chapter: 12, act: 2,
    mini: 'THE BALL' },
  // The second mini. Everything else that has ever carried this animal was on
  // rails — a berth, a road, a wind, a rope. This one is going where it likes.
  { id: 'the-manta',     text: 'Take hold of the manta, and stay on',            chapter: 12, act: 2,
    mini: 'THE MANTA' },
  // capy.wet has existed since Sydney — it darkens the coat and it drips — and
  // it has never once been a mechanic.
  { id: 'beach-fire',   text: 'Put the beach fire out',                 chapter: 12 },

  // CHAPTER 13 — CAPPADOCIA. The opposite chapter, deliberately: dry, cold,
  // upward, and the one place in the game where the player cannot steer.
  { id: 'to-cappadocia',text: 'Be in the valley before it gets light',  chapter: 13 },
  { id: 'chimney-top',  text: 'Top out on a fairy chimney',             chapter: 13 },
  { id: 'dovecote',     text: 'Let the pigeons out of the rock',        chapter: 13 },
  { id: 'the-tether',   text: 'Chew through something important',       chapter: 13 },
  // The launch field is the best-observed thing in this chapter — three states
  // of the same twenty minutes, side by side, floodlit, with the trucks and the
  // propane — and the list used exactly one object on it.
  { id: 'the-envelope', text: 'Walk an envelope, end to end',           chapter: 13, act: 2 },
  { id: 'the-mouth',    text: 'Get inside one while it is filling',     chapter: 13, act: 2 },
  { id: 'aboard',       text: 'Get in a basket before it goes',         chapter: 13, act: 2 },
  { id: 'three-winds',  text: 'Ride three different winds',             chapter: 13, act: 3 },
  { id: 'sunrise',      text: 'Be up there when the sun clears the rim',chapter: 13, act: 3, wow: 'CAPPADOCIA' },
  { id: 'on-the-trailer', text: 'Put it down on the trailer',           chapter: 13, act: 3 },
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
  { id: 'duck-dive',     text: 'Go under the white water, not over it',   chapter: 14, act: 2 },
  { id: 'the-rip',       text: 'Let the rip take you out the back',       chapter: 14, act: 2 },
  // The mini. Standing up is not the moment — a capybara does not stand up.
  // The moment is the two seconds where the water stops going past you and
  // starts taking you with it, which is exactly what a take-off is.
  { id: 'take-off',      text: 'Catch one',                              chapter: 14, act: 2,
    mini: 'THE TAKE-OFF' },
  { id: 'all-the-way',   text: 'Take the biggest of the set to the sand', chapter: 14, act: 2, wow: 'MANLY' },
  { id: 'the-bommie',    text: 'Sit on the bommie while it breaks over you', chapter: 14, act: 3 },
  { id: 'bower-pool',    text: 'Swim a length of the ocean pool',         chapter: 14, act: 3 },
  { id: 'blue-groper',   text: 'Introduce yourself to the blue groper',   chapter: 14, act: 3 },
  // The second mini, and it is the counter-argument to the whole chapter: the
  // one way out through the break that is not swimming.
  { id: 'the-surfboat',  text: 'Go out through the break in the surfboat', chapter: 14, act: 2,
    mini: 'THE SURFBOAT' },

  // ---- Chapter 15: The Pantanal ----
  // Fifteen places and the animal has never once been anywhere it is actually
  // from. This is the chapter where the capybara is not a novelty, and every
  // line on the list follows from that: nothing here is startled by you,
  // nothing here is chasing you, and the marquee is not a stunt — it is being
  // at the front of your own species.
  { id: 'to-pantanal',   text: 'Come home, apparently',                  chapter: 15 },
  { id: 'the-locals',    text: 'Meet the neighbours',                    chapter: 15 },
  // The mini. The first time in fifteen chapters that the world falls in
  // behind the player instead of getting out of the way.
  { id: 'gather',        text: 'Get five of them to follow you',         chapter: 15,
    mini: 'THE HERD' },
  { id: 'camalote',      text: 'Cross the bay on the floating meadow',   chapter: 15, act: 2 },
  { id: 'caiman-nap',    text: 'Sit on a sleeping jacaré',               chapter: 15 },
  { id: 'jabiru-nest',   text: 'Look into the jabiru’s nest',            chapter: 15 },
  { id: 'cowbird',       text: 'Give a cowbird a lift',                  chapter: 15 },
  { id: 'the-otters',    text: 'Get told off by the giant otters',       chapter: 15, act: 2 },
  { id: 'missing-plank', text: 'Cross the bridge that is missing a plank', chapter: 15, act: 2 },
  { id: 'macaw-nut',     text: 'Take a palm nut off a hyacinth macaw',   chapter: 15, act: 2 },
  // The second mini, and the only carrier in the game that is walking on its
  // knuckles because its claws are too long to put down.
  { id: 'tamandua',      text: 'Ride the anteater across the campo',     chapter: 15, act: 2,
    mini: 'O TAMANDUÁ' },
  { id: 'the-crossing',  text: 'Take the whole herd across the river',   chapter: 15, act: 2, wow: 'O PANTANAL' },

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

  // ---- Chapter 18: Monte Carlo -------------------------------------------
  // A HEIST, IN THREE MOVEMENTS, and the acts are geography: the water, the
  // building, and the road. It is the first list in this game with a THRESHOLD
  // on it (ten up at the wheel) and the first with a row you can be thrown out
  // of the middle of — and neither of them can lock anything, because the
  // penalty for being caught is ten seconds and the stack only ever goes up.
  { id: 'to-monaco',    text: 'Get past the door',                      chapter: 18 },
  { id: 'superyacht',   text: 'Board a boat nobody invited you onto',   chapter: 18 },
  { id: 'black-tie',    text: 'Acquire a dinner jacket',                chapter: 18 },
  { id: 'high-dive',    text: 'Go off the top deck into the harbour',   chapter: 18 },
  { id: 'the-rock',     text: 'Get up onto the Rock',                   chapter: 18 },
  { id: 'palace-guard', text: 'Make the palace guard break',            chapter: 18 },
  // Act two. The one building in this game with an inside, and the only room
  // in it where anybody minds that you are there.
  { id: 'pass-the-door',text: 'Get past the man on the door',           chapter: 18, act: 2 },
  { id: 'the-floor',    text: 'Cross the floor without being seen',     chapter: 18, act: 2 },
  { id: 'chip-stack',   text: 'Leave the table ten up',                 chapter: 18, act: 2 },
  { id: 'champagne',    text: 'Redistribute the champagne',             chapter: 18, act: 2 },
  { id: 'piano-solo',   text: 'Give the salon a piano solo',            chapter: 18, act: 2 },
  // The first mini, and the only carrier in the game that is furniture.
  { id: 'the-wheel',    text: 'Ride the roulette wheel',                chapter: 18, act: 2,
    mini: 'ROUGE ET NOIR' },
  // Act three. Everything here happens on the roof of somebody else's car.
  { id: 'chicane',      text: 'Put the chicane in the harbour',         chapter: 18, act: 3 },
  // The second mini: the slowest corner in motor racing, which is the only
  // reason a capybara can get onto a moving car at all.
  { id: 'the-hairpin',  text: 'Take the Fairmont hairpin on the roof',  chapter: 18, act: 3,
    mini: 'LE GRAND VIRAGE' },
  { id: 'the-tunnel',   text: 'Go through the tunnel on the roof',      chapter: 18, act: 3,
    wow: 'MONTE CARLO' },

  // ---- Chapter 19: Hanoi --------------------------------------------------
  // THE THIRTY-SIX STREETS, THE LAKE, AND THE LINE — and the three acts are
  // three VOLUMES: a river of two hundred and forty engines, then the one
  // quiet place in the city, then an alley that goes completely silent eleven
  // seconds before it is not silent at all.
  { id: 'to-hanoi',     text: 'Get across the first road',              chapter: 19 },
  { id: 'cross-the-road', text: 'Cross the road without stopping',      chapter: 19 },
  { id: 'pho-raid',     text: 'Get your whole face in a bowl of pho',   chapter: 19 },
  { id: 'flower-bike',  text: 'Unload a flower bicycle',                chapter: 19 },
  { id: 'barber',       text: 'Look into the pavement barber’s mirror', chapter: 19 },
  // The first mini, and the fourteenth thing in this game that carries you.
  { id: 'ride-the-flow', text: 'Get on a scooter and stay on it',       chapter: 19,
    mini: 'HANG NGANG' },
  // The second mini. Ninety-six of them, twenty centimetres high.
  { id: 'the-stools',   text: 'Bring down the whole terrace',           chapter: 19,
    mini: 'BIA HOI' },
  // Act two: everything inside the ring road, which is where it is quiet.
  { id: 'the-huc',      text: 'Cross the red bridge',                   chapter: 19, act: 2 },
  { id: 'turtle-tower', text: 'Get out to the tower on the island',     chapter: 19, act: 2 },
  { id: 'shuttlecock',  text: 'Stand in the middle of the da cau',      chapter: 19, act: 2 },
  { id: 'water-puppets',text: 'Get in among the water puppets',         chapter: 19, act: 2 },
  { id: 'egg-coffee',   text: 'Take an egg coffee off a balcony',       chapter: 19, act: 2 },
  // Act three: the line, and the only thing in this chapter you do by not
  // moving at all.
  { id: 'fold-the-street', text: 'Be there when the street folds up',   chapter: 19, act: 3 },
  { id: 'long-bien',    text: 'Walk out onto the old bridge',           chapter: 19, act: 3 },
  { id: 'the-train',    text: 'Be in the alley when it comes through',  chapter: 19, act: 3,
    wow: 'TRAIN STREET' },
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
//
// ---- AND ONE THAT SAYS WHAT THE CHAPTER IS FOR (B1) -----------------------
//
//   marquee THE THING THIS PLACE EXISTS FOR, AS A POINT AND AS A SENTENCE.
//           `{ x, z, up, say }`. Every chapter has exactly one `wow` row and
//           the game has always known which — but the interface pointed at it
//           NOWHERE: the arrival card names the place, the paper offers the
//           lowest act with anything open, and in EIGHTEEN of the nineteen the
//           `wow` sits in act two or three — every chapter but Kyoto, whose
//           `uji-run` is the only marquee in act one. So a player who picked
//           Cappadocia off the title card because they wanted to fly a balloon
//           arrived to three rows about pigeons. `qa/p6-static.cjs` prints the
//           split, so that eighteen cannot go stale in silence.
//
//           `up` is metres ABOVE THE GROUND at (x, z), not an absolute height,
//           and that is the whole reason this is four numbers rather than
//           three: a marquee point is a composition — the middle of the sails,
//           the shaft of daylight, the crest of the dune — and it has to stay
//           the middle of the thing when the terrain under it is retuned. The
//           ground is sampled off the live biome's own terrainHeight, so a
//           chapter with no relief (Sydney) reads zero and `up` is absolute
//           there by construction.
//
//           `say` is WHERE TO LOOK and never HOW TO DO IT — the row already
//           names the verb and `sysHINTS[id].clue` already teaches the button.
//           It is the same register as `way`.
//
//           A chapter whose marquee MOVES publishes `marqueeAt()` on its own
//           api (pasto.js does, for the condor) and that wins while it answers.
//           See sysMarqueePoint.
export const CHAPTERS = [
  { n: 1, biome: 'sydney',  name: 'Sydney',          sub: 'the gardens, unsupervised',
    arrive: '',           far: 400,  tall: false, pal: 0,
    hint: 'the gardens, unsupervised',                open: 'be a menace.', way: 'the ferry wharf at the Quay',
    keep: 'a tourist’s hat',
    marquee: { x: 0, z: 2.5, up: 11, say: 'the white sails, at the far end of the gardens' },
    // ---- THE FIRST CHAPTER HAD NO SHAPE EITHER (F4) --------------------
    // Nineteen rows — the longest list in the game — offered four at a time in
    // author order, in the one chapter every player opens on. `win: 4` rather
    // than the three Pasto and the Quay use, because act one is ten rows and
    // this is also the chapter that is teaching a player what the paper IS:
    // four is enough to read as a menu of choices and still short enough to
    // finish. The three movements are three PLACES, which is how this chapter
    // is actually laid out and how anybody walks it.
    win: 4,
    acts: [
      { kick: 'THE GARDENS', line: 'nobody here has met one of you before.' },
      { kick: 'THE FORECOURT', line: 'the white sails, and the water under them.' },
      { kick: 'THE PROMENADE', line: 'north, past the buskers. the ferry goes from the end.' },
    ],
    note: 'Nobody in these gardens had ever had to think about a rodent this size. Several of them do now.' },
  { n: 2, biome: 'pasto',   name: 'Pasto, Nariño',   sub: '2 527 metres up, and no better behaved',
    arrive: 'to-pasto',   far: 900,  tall: true,  pal: 1,
    hint: '2 527 m up, and a condor',                 open: 'two thousand five hundred metres up, and nobody told them.', way: 'the crater on Galeras',
    keep: 'a condor’s flight feather', win: 3,
    marquee: { x: -40, z: -70, up: 26, say: 'the bird, and the mountain it has been circling' },
    note: 'The bird was up there the whole time you were stealing potatoes.',
    // ---- THE SECOND CHAPTER HAD NO SHAPE (R8) --------------------------
    // Pasto is a town, then a bird, then a mountain — the geography says so
    // and the task list already sorted that way — and it was served as one
    // flat eleven-row list, which is the shape a player meets in chapter 1 and
    // then again in chapter 2. Nothing is gated: see the `act` note above.
    acts: [
      { kick: 'PASTO', line: 'be a menace.' },
      { kick: 'SOMETHING ENORMOUS', line: 'it has been circling since you got here.' },
      { kick: 'GALERAS', line: 'the mountain is live, and the only way up is the bird.' },
    ] },
  { n: 3, biome: 'quay',    name: 'Circular Quay',   sub: 'she sails when you say she sails',
    // ---- NO `arrive`, AND IT IS THE ONE CHAPTER THAT SHOULD NOT HAVE ONE (F1)
    //
    // `arrive` means "tick this the instant the white clears", and for the
    // seventeen chapters whose first row is a turning-up it is honest. Chapter
    // three's first row is not a turning-up: it is `to-quay`, "Cast off from
    // the Quay", clue "take her out past the wharf" — and quay.js has always
    // implemented it properly, at `quayCastOff`, once the wheel is yours and
    // she is 26 m off the apron. That code could never run. `jrTravel` ticked
    // the row inside `biomeFadeTo`'s callback, so the task was done before the
    // player could see the paper, and the clue described an action the game
    // had just credited them with.
    //
    // The consequence was the chapter's shape: act one is declared as THE QUAY
    // (2 rows) and arrived with one of the two already crossed off. It now
    // reads as written — find the wheel, then take her out — and the eighteen
    // other free arrival ticks stay as they are, because theirs are true.
    far: 1600, tall: false, pal: 2,
    hint: 'a boat, and Manly somewhere north',        open: 'find the wheel.', way: 'up the Corso at Manly',
    keep: 'an unpunched ferry ticket', win: 3,
    marquee: { x: 6.6, z: 6, up: 4, say: 'she is at the wharf, and Manly is an hour north' },
    note: 'You took a boat off a man who had been driving it for eleven years, and he watched you dock it.',
    acts: [
      { kick: 'THE QUAY', line: 'she is yours. find the wheel.' },
      { kick: 'OPEN WATER', line: 'seven hundred metres, and nothing to hit but the headlands.' },
      { kick: 'MANLY', line: 'bring her alongside. the Corso is up the hill.' },
    ] },
  { n: 4, biome: 'kyoto',   name: 'Kyoto & Uji',     sub: 'and Uji, an hour down the river',
    arrive: 'to-kyoto',   far: 700,  tall: false, pal: 4,
    hint: 'ten thousand gates and a lot of tea',      open: 'four hundred years of arrangement, and you.', way: 'the bridge at Uji',
    keep: 'a tea whisk, slightly chewed',
    marquee: { x: 4, z: 128, up: 3, say: 'an hour down the river, where the water runs fast' },
    note: 'Ten thousand gates, and for one afternoon the loudest thing in Kyoto was you.',
    acts: [
      { kick: 'KYOTO', line: 'everything here has been arranged very carefully for a very long time.' },
      { kick: 'UJI', line: 'an hour down the river, and the tea is the whole point of the town.' },
    ] },
  { n: 5, biome: 'cali',    name: 'Cali',            sub: 'the salsa capital of the world',
    arrive: 'to-cali',    far: 1000, tall: false, pal: 5,
    hint: 'the salsa capital of the world',           open: 'listen first.', way: 'the bridge over the Río Cali',
    keep: 'a stick of sugarcane',
    marquee: { x: 30, z: 40, up: 3, say: 'the party bus. it goes up the hill and it does not wait' },
    note: 'You got the timing right some while before you understood what you were counting.',
    acts: [
      { kick: 'THE CITY', line: 'listen first. everything here is on top of the same beat.' },
      { kick: 'THE CHIVA', line: 'the party bus goes up the hill. be on it.' },
      { kick: 'THE RIDGE', line: 'from up here you can see the whole of what you have done.' },
    ] },
  { n: 6, biome: 'rio',     name: 'Rio de Janeiro',  sub: 'and the bateria is already moving',
    arrive: 'to-rio',     far: 1400, tall: false, pal: 6,
    hint: 'a bateria, and it is not waiting for you', open: 'follow the drums.', way: 'the rock at Arpoador',
    keep: 'a tile off Selarón’s steps',
    marquee: { x: -47.8, z: 46, up: 4, say: 'the avenue, and the drums are already on it' },
    note: 'The bateria did not slow down for you, and you did not ask it to.',
    acts: [
      { kick: 'COPACABANA', line: 'four kilometres of pavement with a pattern in it.' },
      { kick: 'THE AVENUE', line: 'follow the drums. they have already started.' },
      { kick: 'THE MOUNTAIN', line: 'there is a cable car, and there is a much better way up.' },
    ] },
  { n: 7, biome: 'iceland', name: 'Iceland',         sub: 'half past eleven, and the sun is not the plan',
    arrive: 'to-iceland', far: 1200, tall: true,  pal: 7,
    hint: 'dark, and the ground does not hold',       open: 'it will not get properly dark. plan accordingly.', way: 'the end of the pier',
    keep: 'a piece of the glacier',
    marquee: { x: -40, z: -10, up: 60, say: 'the whole sky, out past the last of the town lights' },
    note: 'It never got properly dark, so nothing you did here was ever quite unobserved.',
    acts: [
      { kick: 'REYKJAVÍK', line: 'nobody is out. that is the good news.' },
      { kick: 'OUT OF TOWN', line: 'the ground stops holding you somewhere past here.' },
      { kick: 'AND THEN SIT STILL', line: 'there is nothing left to knock over. good.' },
    ] },
  { n: 8, biome: 'sahara',  name: 'Marrakech',       sub: 'and forty minutes east of it, nothing at all',
    arrive: 'to-sahara',  far: 1600, tall: true,  pal: 8,
    hint: 'a maze, and then no maze at all',          open: 'a thousand people in this square and every one of them is working.', way: 'the fire at the desert camp',
    keep: 'an orange off the cart',
    marquee: { x: 276, z: 10, up: 4, say: 'east, past where the maze stops. the big one' },
    note: 'By the second evening the square knew your face.',
    acts: [
      { kick: 'JEMAA EL-FNAA', line: 'do not rob anybody yet. or do.' },
      { kick: 'EAST, THEN', line: 'the maze stops. everything stops.' },
      { kick: 'AFTER THE STORM', line: 'it is evening, and somebody has lit a fire.' },
    ] },
  { n: 9, biome: 'drift',   name: 'The Drift',       sub: 'nobody is entirely sure how you got up here',
    arrive: 'to-drift',   far: 1500, tall: true,  pal: 9,
    hint: 'no ground to speak of, and a wind',        open: 'nobody is entirely sure how you got up here, you included.', way: 'the lantern plinth, once it is lit',
    keep: 'a seed-head, still trying to leave',
    marquee: { x: 36, z: -190, up: 8, say: 'the plinth at the top of the world, and it is unlit' },
    note: 'There was no floor, and you stopped minding somewhere over the third island.',
    acts: [
      { kick: 'NO GROUND', line: 'nothing here is nailed down. step off something and find out.' },
      { kick: 'THE WIND', line: 'it goes a different way at every height, and all of it goes up.' },
    ] },
  { n: 10, biome: 'venice', name: 'Venice',          sub: 'and the water is coming in',
    arrive: 'to-venice',  far: 900,  tall: false, pal: 10,
    hint: 'the floor is negotiable',                  open: 'the ground here is a negotiation with the sea, and the sea is early.', way: 'the two columns on the Molo',
    keep: 'a pigeon feather from the Piazza',
    marquee: { x: -4, z: -35, up: 7, say: 'this square, and the sea is coming up through it' },
    note: 'The water came up over the paving and everybody carried on doing what they were doing.',
    acts: [
      { kick: 'LOW WATER', line: 'the tide is early. mind the paving.' },
      { kick: 'ACQUA ALTA', line: 'the siren went four times. the square is going under.' },
    ] },
  { n: 11, biome: 'kowloon', name: 'Hong Kong',      sub: 'up is a direction here',
    arrive: 'to-kowloon', far: 1300, tall: true,  pal: 11,
    hint: 'a wall of light, and a way up it',         open: 'seven million people on a piece of rock, and they all went upwards.', way: 'the end of the Star Ferry pier',
    keep: 'a length of scaffold bamboo',
    // up 34 and not 45: `symphony`'s own hint target is a roof at 34.6 m, and a
    // point eleven metres over it is eleven metres of empty sky — measured, in
    // qa/MF-kowloon.png, which framed black. The subject is the roof you have
    // to be standing on and the wall of neon under it, not the air above both.
    marquee: { x: -19.1, z: 0, up: 34, say: 'the roof at the top of the scaffold, and the towers from up there' },
    note: 'You spent most of this chapter above the people who live in it.',
    acts: [
      { kick: 'MONG KOK', line: 'nothing on this street is at ground level.' },
      { kick: 'UP', line: 'the scaffold is a staircase. everybody here already knows that.' },
      { kick: 'THE HARBOUR', line: 'down at last, and the water is the other half of the city.' },
    ] },
  { n: 12, biome: 'palawan', name: 'Palawan',        sub: 'the interesting half is underneath',
    arrive: 'to-palawan', far: 1100, tall: true,  pal: 12,
    hint: 'twelve chapters of paddling. enough.',     open: 'you have been paddling about on the top of the water for eleven chapters.', way: 'the end of the bamboo jetty',
    keep: 'a pearl out of the giant clam',
    marquee: { x: 0, z: -70, up: 1, say: 'out past the reef, and then straight down' },
    note: 'Eleven chapters of paddling about on the surface, and the whole thing was underneath.',
    acts: [
      { kick: 'THE ISLAND', line: 'a beach, a jetty, and a boat that goes out to the good part.' },
      { kick: 'UNDER', line: 'you are a semi-aquatic rodent. act like one.' },
      { kick: 'THE DARK WATER', line: 'past the light, and it gets better.' },
    ] },
  { n: 13, biome: 'goreme',  name: 'Cappadocia',     sub: 'and you do not get a steering wheel',
    arrive: 'to-cappadocia', far: 2200, tall: true, pal: 13,
    hint: 'no steering. only up and down.',           open: 'the wind goes a different way at every height. that is the whole game.', way: 'the landing plain, once you have flown',
    keep: 'a scrap of balloon envelope',
    marquee: { x: 0, z: -40, up: 12, say: 'the launch field. eighty of them go up at first light' },
    note: 'You could not steer, and it turned out that was never the problem.',
    acts: [
      { kick: 'THE VALLEY', line: 'soft rock, and everybody who ever lived here dug into it.' },
      { kick: 'THE ENVELOPE', line: 'eighty of them go up at dawn, and they are filling now.' },
      { kick: 'ALOFT', line: 'the wind goes a different way at every height. that is the whole game.' },
    ] },
  { n: 14, biome: 'manly',  name: 'Manly',            sub: 'the other side of the Corso, and it is not the harbour',
    arrive: 'to-manly',   far: 1500, tall: false, pal: 14,
    hint: 'the sea has a shape here',                 open: 'this is the side of the peninsula that faces the whole Pacific.', way: 'between the red and yellow flags',
    keep: 'a Norfolk pine cone',
    marquee: { x: 0, z: -23.8, up: 1, say: 'out the back, where the sets come from' },
    note: 'The sea here has a shape, and it took you a while to stop arguing with it.',
    acts: [
      { kick: 'THE BEACH', line: 'a kilometre of sand and nobody in charge of any of it.' },
      { kick: 'OUT THE BACK', line: 'the white bits are where it is breaking. go under them, never over.' },
      { kick: 'THE OTHER WATER', line: 'there is a pool cut into the rocks, and something living in it.' },
    ] },
  { n: 15, biome: 'pantanal', name: 'The Pantanal',   sub: 'where you are, as it happens, from',
    arrive: 'to-pantanal', far: 1300, tall: false, pal: 15,
    hint: 'you are not the strangest thing here',     open: 'you are, as far as anybody here is concerned, from round here.', way: 'the last bridge on the Transpantaneira',
    keep: 'nothing. it was yours already.',
    marquee: { x: -34, z: -53, up: 2, say: 'the river, and the whole herd has to be on the far side of it' },
    // ...and no picture of it, which is the whole exception. Eighteen cards
    // hold up a drawn object; this one holds up the sentence and nothing
    // else, and the empty frame is what makes the sentence land.
    keepNone: true,
    note: 'Nobody looked up. Nobody looked up once.',
    acts: [
      { kick: 'THE NEIGHBOURS', line: 'there are eleven of you standing in this water and nobody has noticed.' },
      { kick: 'THE CAMPO', line: 'a hundred and forty kilometres of raised dirt and a hundred and twenty bridges.' },
    ] },
  { n: 16, biome: 'cave',   name: 'Sơn Đoòng',        sub: 'and the only light is the one you make',
    arrive: 'to-cave',    far: 800,  tall: false, pal: 16,
    hint: 'no light in here but yours',               open: 'nine kilometres of it, and no light that you did not bring.', way: 'the slot of daylight at the far end',
    keep: 'a cave pearl', win: 2,
    marquee: { x: 4, z: -48, up: 40, say: 'there is a hole in the roof of this mountain' },
    note: 'You made the only light there was, and it went out every few seconds.',
    acts: [
      { kick: 'THE MOUTH', line: 'wheek. it is the only way to see anything.' },
      { kick: 'THE GREAT PASSAGE', line: 'ninety metres across, and there is a hole in the roof.' },
      { kick: 'THE FAR SIDE', line: 'seventy metres of calcite, and then whatever lives past it.' },
    ] },
  { n: 17, biome: 'antarctic', name: 'Antarctica',   sub: 'and you are not walking anywhere',
    arrive: 'to-antarctic', far: 2000, tall: true, pal: 17,
    hint: 'too cold to walk. take the boat.',         open: 'the orange boat at the end of the jetty. that is the chapter.', way: 'the head of the station jetty',
    keep: 'the station’s enamel mug', win: 3,
    marquee: { x: 14.3, z: -169.5, up: 2, say: 'out in the channel, wherever the blows are' },
    note: 'Nothing on this continent had any opinion about you whatsoever.',
    acts: [
      { kick: 'THE STATION', line: 'too cold to walk. take the boat.' },
      { kick: 'THE ICE', line: 'four rocks, eleven hundred metres apart.' },
      { kick: 'THE PACK', line: 'there is something under the boat.' },
    ] },
  { n: 18, biome: 'monaco', name: 'Monte Carlo',   sub: 'and somebody in there is going to mind',
    arrive: 'to-monaco', far: 1800, tall: true, pal: 19,
    hint: 'the first place that minds you being here', open: 'somewhere in this town is the first person who will mind.',
    way: 'the steps of the Casino',
    keep: 'a mother-of-pearl plaque', win: 3,
    marquee: { x: 152, z: -12, up: 4, say: 'the tunnel under the hotel, and they go through it flat out' },
    note: 'The first place in the world that asked what you thought you were doing.',
    acts: [
      { kick: 'THE PORT', line: 'it is twenty past eight. everything is switched on.' },
      { kick: 'THE ROOMS', line: 'five people in there are paid to look at the room.' },
      { kick: 'THE CIRCUIT', line: 'the white lines are not decoration.' },
    ] },
  { n: 19, biome: 'hanoi', name: 'Hanoi',          sub: 'and the road is not going to stop for you',
    arrive: 'to-hanoi', far: 1100, tall: false, pal: 20,
    hint: 'the road is not going to stop',            open: 'seven million people and six million of them are on a moped.',
    way: 'the head of the Long Biên bridge',
    keep: 'a plastic stool, slightly cracked', win: 3,
    marquee: { x: -82, z: 46, up: 3, say: 'an alley the exact width of a train' },
    note: 'You crossed six lanes without stopping and the road never noticed you were there.',
    acts: [
      { kick: 'THE THIRTY-SIX STREETS', line: 'do not wait for a gap. there is no gap.' },
      { kick: 'INSIDE THE RING', line: 'it is quiet in here. that is the whole rule.' },
      { kick: 'THE LINE', line: 'when the horn goes, get in a doorway.' },
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
//
// ---- ...AND `par`: THE TARGET BEFORE THERE IS A BEST (v36) ----------------
//
// Fifty-three numbers, and a record only ever compared you to YOURSELF — so on
// a first attempt it compared you to nothing at all. The live line said `no
// best yet`, which is a true sentence that tells a player nothing about
// whether the run they just made was any good, and the block that draws it
// (see THE RECORD YOU CANNOT SEE WHILE YOU ARE SETTING IT in systems.js) had
// already written down the diagnosis: "a player attempting one of the measured
// tasks is running against an invisible target".
//
// `par` is that target. It is optional, it is authored, and it is the figure a
// considered attempt reaches and a first one does not.
//
//   IT GATES NOTHING AND IT DENIES NOTHING. It is a comparison. No task is
//   harder, no record is refused, and a row with no `par` behaves exactly as
//   it did before this field existed — which is why thirteen of them still
//   have none: a par nobody can defend is worse than no par at all.
//
//   IT DOES NOT BREAK THE SILENCE ON A FIRST RUN. `recordValue` still says
//   nothing when there is no previous figure to beat, and that stays. What a
//   par changes is the LIVE line, which is where the target belongs — it is
//   on screen before the attempt and for the whole of it.
//
//   IT IS SAID ONCE, EVER. Crossing it for the first time gets one line, and
//   the game stores nothing new to know that: "have I passed par" is
//   `jrRecs[id]` read against `par`, the same way the shelf is the tick list
//   read a different way.
//
// EVERY FIGURE BELOW IS DERIVED FROM A CONSTANT THE SOURCE ALREADY STATES —
// the task's own gate improved on, or a fraction of a population or a length
// that is written down somewhere. The provenance is on the row. Where neither
// exists the row has no `par`, and `qa/audit-tasks.mjs` reports the coverage
// so the gap stays visible instead of going quiet.
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
  // ---- ...AND WHAT SAT ON YOU WHILE YOU DID IT (N1/N2) ------------------
  // THE PERCH's discovery channel. Nobody is told a heron will stand on them:
  // you find out by sitting still for long enough beside one, which is the
  // obey ladder's own lesson taught upward. Three, and they are the three
  // stages of the mechanic — it happened, you walked off with it, you got the
  // whole back full — so the second and third are questions the first asks.
  { id: 'sat-on',         text: 'Held still long enough that something climbed on you' },
  { id: 'carried-on',     text: 'Walked fifty metres with a passenger' },
  { id: 'full-house',     text: 'Had three of them on your back at once' },
  { id: 'stowaway',       text: 'Took something across a border' },

  // ---- WHERE YOU WENT ---------------------------------------------------
  { id: 'high-point',     text: 'Stood on the highest ground there is here' },
  { id: 'far-corner',     text: 'Went as far out as this world goes' },
  { id: 'quiet-corner',   text: 'Found the one part of this place with nobody in it' },
  { id: 'long-drop',      text: 'Fell twenty-five metres and walked away from it' },

  // ---- ...AND THE ONE THE PLACE PUT UP ABOUT YOU (B15) ------------------
  // From notoriety tier 3 the chapter you arrive in has a poster of you near
  // the spawn — see physBuildPoster. Taking it is the only find in this table
  // that is about a thing the game only makes once you have earned it, which
  // is the point: it cannot be gone looking for, and a player who never
  // causes any trouble will never see one.
  { id: 'took-the-poster', text: 'Took the poster of yourself down off its post' },

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
  // `cathedral` pays out for FINDING the room with the hole in the roof. The
  // bar of daylight that comes through it was drawn, was published as a zone,
  // and for eleven versions nothing in the game ever asked about it — and it is
  // the picture the whole chapter resolves into.
  { id: 'in-the-shaft',   text: 'Went down and stood in the one bar of daylight that reaches the floor', chapter: 12,
    where: 'Stood on the sand in the shaft of light, under the hole in the roof' },

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
  // `first-echo` pays out on the frame the noise leaves you. This is the other
  // second of it, and it is the only thing in the chapter that reads
  // `echoReady()` — a published hook with no caller until now.
  { id: 'let-it-return',  text: 'Called into the dark and held still until the whole of it came back', chapter: 16 },

  // ---- 17, the Antarctic Peninsula --------------------------------------
  { id: 'the-whalers',    text: 'Went into the whaling station that nobody uses any more', chapter: 17 },
  // ...and the exact opposite of `colony-chorus`, in the middle of the colony.
  { id: 'ignored',        text: 'Stood about in the middle of the colony and was completely ignored', chapter: 17 },

  // ---- 18, Monte Carlo --------------------------------------------------
  // The tunnel is the chapter's marquee and it is a ride. This is the same
  // hundred and eleven metres done the only other way there is, which is the
  // deliberate-opposite shape half the place finds already have.
  { id: 'over-the-tunnel', text: 'Went over the top of the tunnel instead of through it', chapter: 18 },
  // ...and the Rock, at the far end of a chapter that is entirely about the
  // other end. Nothing is happening up there and that is what it is for.
  { id: 'nothing-up-here', text: 'Sat down on the Rock with the whole principality going on below you', chapter: 18,
    where: 'Sat on the Rock while everything happened somewhere else' },

  // ---- 19, Hanoi --------------------------------------------------------
  // The chapter's first act is about never stopping. This is the exact
  // opposite done in the exact same place, and it is the thing a player is
  // most likely to have done BY ACCIDENT the first time they stepped off a
  // kerb: froze, and found out that it works anyway.
  { id: 'stood-in-the-river', text: 'Stood perfectly still in the traffic and let all of it go round you', chapter: 19 },
  // ...and the one street in the Old Quarter with nothing coming down it,
  // which is a railway.
  { id: 'quiet-alley',    text: 'Found the one street in this city with nothing coming down it', chapter: 19,
    where: 'Found the quietest street in Hanoi, which is a railway' },
];

/** Every find id, for the audit and the save. */

export const RECORDS = {
  'uji-run':       { label: 'the river in', unit: ' s', better: 'lower', dp: 1 },
  // ---- KYOTO HAD ONE NUMBER IN IT (v51) ---------------------------------
  // Eleven tasks and a single record, which made it the thinnest chapter in the
  // game to come back to — and it had TWO set pieces sitting there with a clock
  // in them by construction, both of which switched themselves off for ever the
  // first time they were done. See kyoCheckTorii and kyoCheckBamboo: the run
  // re-arms now, so these two rows are things you can be better at rather than
  // switches you flipped once.
  //
  // BOTH PARS ARE MEASURED, NOT GUESSED. A scripted steer holding sprint the
  // whole way, aimed gate to gate, does the tunnel in 24.7 s and the grove in
  // 14.5 s — those are the machine floors, and a par a player cannot reach is
  // worse than no par at all. The figures below sit above them by about the
  // margin a person steering an S-curve uphill on a stamina bar actually loses.
  // ...and Cali, which had two, and was the OTHER chapter that measured dead in
  // free play. Same shape and the same one-line cause as the two below — see
  // the cane block in cali.js.
  // Machine floor measured at 6.5 s — thirty-four metres of cane at a flat
  // sprint, slightly downhill. Eight is a player who runs it straight.
  'cane-run':      { label: 'the cane in', unit: ' s', better: 'lower', dp: 1, par: 8 },
  'torii-run':     { label: 'the tunnel in', unit: ' s', better: 'lower', dp: 1, par: 32 },
  'bamboo-dash':   { label: 'the grove in', unit: ' s', better: 'lower', dp: 1, par: 17 },
  'glacier-run':   { label: 'top speed', unit: ' m/s', better: 'higher', dp: 1, par: 18 },
  'dune-surf':     { label: 'top speed', unit: ' m/s', better: 'higher', dp: 1 },
  'souk-escape':   { label: 'shook them in', unit: ' s', better: 'lower', dp: 1 },
  'selaron-steps': { label: 'the whole flight in', unit: ' s', better: 'lower', dp: 1, par: 7 },
  // ---- THE THREE THE PARITY SWEEP LEFT UNCLAIMED (R7) ---------------------
  // Each of these was already being MEASURED by the chapter that owns it and
  // then discarded the frame it ticked: the calçadão's 132 m span, the calli's
  // side-to-side extent, and — the odd one out — the Rialto, which the task
  // asks you to take AT A RUN and which nothing was clocking at all.
  //
  // A RECORDS key has to be a TASK id or the row is invisible: the chapter
  // board and the picker both look it up as RECORDS[taskId] (systems.js), so
  // the roadmap's working name of 'calcadao-run' would have filed a number
  // nothing could ever show. Same trap as the api-key mismatch that seated five
  // diners on thin air.
  //
  // ALL THREE PARS ARE MEASURED, MACHINE FLOOR FIRST — see qa/r7-pars.js. A par
  // under the floor is unreachable by anybody, and a par a scripted sprint
  // beats by half is not a par.
  // The counted band is 188 m and 132 of them tick it. A scripted walk-on at
  // the west end and a flat sprint east reaches 181.8 three times out of three,
  // so that is the ceiling rather than a floor; 165 is a person who runs nearly
  // all of it without putting a foot on the sand.
  'calcadao':      { label: 'longest run', unit: ' m of the wave', better: 'higher', dp: 0, par: 165 },
  // The maze is exactly 48 m across — the extent is clamped to it — and 36 tick
  // it. 48.0 measured three times out of three, so 44 is a full crossing that
  // gives away one wrong turn.
  'the-calli':     { label: 'crossed', unit: ' m of the maze', better: 'higher', dp: 1, par: 44 },
  // Machine floor 4.3 s, side to side over the arch at a flat sprint on the
  // published axis. 5.5 is a person who slows at the top, which everybody does,
  // because that is what the bridge is for.
  'rialto':        { label: 'over the top in', unit: ' s', better: 'lower', dp: 1, par: 5.5 },
  'samba-parade':  { label: 'longest run', unit: ' on the two', better: 'higher', dp: 0, par: 16 },
  'salsa-dance':   { label: 'longest run', unit: ' on the beat', better: 'higher', dp: 0, par: 16 },
  'geysir':        { label: 'thrown', unit: ' m up', better: 'higher', dp: 0, par: 22 },
  'hot-spring':    { label: 'sat still for', unit: ' s', better: 'higher', dp: 1, par: 58 },
  'long-gap':      { label: 'longest crossing', unit: ' m', better: 'higher', dp: 1, par: 25 },
  // ...and this one is an ALTITUDE, not a rise: driRecord files driColPeak.
  // The Anvil, where the first column starts, is at 41.5 m and the Orchard the
  // column serves is at 80 — so eighty is riding one the whole way up.
  'updraft':       { label: 'carried up to', unit: ' m', better: 'higher', dp: 0, par: 80 },
  'passerelle':    { label: 'the boards in', unit: ' s', better: 'lower', dp: 1 },
  'pigeon-storm':  { label: 'put up', unit: ' at once', better: 'higher', dp: 0, par: 120 },
  // hkROOF_Y — the deck the scaffold serves — is 34.2 m, and the tick is at 20.
  'bamboo-climb':  { label: 'highest hold', unit: ' m', better: 'higher', dp: 0, par: 32 },
  'laundry-pole':  { label: 'crossed in', unit: ' s', better: 'lower', dp: 1 },
  'first-dive':    { label: 'deepest', unit: ' m down', better: 'higher', dp: 1, par: 10 },
  'sea-turtle':    { label: 'stayed with it', unit: ' s', better: 'higher', dp: 1, par: 30 },
  'cathedral':     { label: 'held your breath', unit: ' s', better: 'higher', dp: 1, par: 16 },
  'three-winds':   { label: 'highest', unit: ' m up', better: 'higher', dp: 0 },
  'on-the-trailer':{ label: 'landed within', unit: ' m', better: 'lower', dp: 1, par: 3 },
  // THE FIRST THREE CHAPTERS HAD NO NUMBER IN THEM AT ALL. Nineteen records
  // across thirteen places and not one of them in Sydney, on the harbour or in
  // Pasto — so the three chapters a player meets FIRST were also the only three
  // with nothing to come back for once the list was ticked. Each of these hangs
  // off the task that is already the best thing in its chapter.
  'manly-voyage':  { label: 'the passage in', unit: ' s', better: 'lower', dp: 1, par: 66 },
  // …and the two other things on the harbour worth doing WELL rather than
  // merely doing. Both were switches that flipped at two and at six seconds
  // and then stopped caring, on a chapter whose whole body is one long run.
  'yacht-race':    { label: 'threaded', unit: ' of the six', better: 'higher', dp: 0, par: 5 },
  'dolphin-escort':{ label: 'they stayed', unit: ' s', better: 'higher', dp: 1, par: 20 },
  'thermal-peak':  { label: 'carried up to', unit: ' m', better: 'higher', dp: 0 },
  // ---- AND A THIRD FOR THE SECOND CHAPTER (R8) ---------------------------
  // Pasto's two numbers were both on the condor, so the whole town half of the
  // chapter had nothing to come back for. The task says 'Ring the church bell
  // (badly)' and it ticked on the first stroke, which is the least bad way to
  // ring a bell.
  //
  // It is the ANGLE and not a count of strokes, because a count measured
  // exactly backwards: see THE SWING in pasto.js, where one strike and walking
  // away scored 17 and working the rope scored 6. Strikes add to the swing in
  // its direction of travel, so this rewards timing, and a pendulum only ever
  // loses amplitude on its own.
  //
  // MEASURED: one strike and hands off reaches 39.5 degrees and stays there
  // for thirty seconds; a scripted puller working the rope takes it to 179.6,
  // which is the bell all but over the top and the ceiling. Ninety is the bell
  // horizontal — mouth sideways, well past anything one blow can do, and a
  // thing you can see from the plaza.
  'church-bell':   { label: 'swung it to', unit: ' degrees', better: 'higher', dp: 0, par: 90 },
  'seagull-chips': { label: 'put up', unit: ' gulls at once', better: 'higher', dp: 0, par: 6 },
  // …and the chapter's mini. Twelve seconds on the roof ticks it; the number
  // is how far you actually rode, which is a different and much better
  // question, because the promenade is sixty-two metres long and the van
  // turns round at both ends.
  'whippy-run':    { label: 'rode', unit: ' m in one go', better: 'higher', dp: 0, par: 52 },
  // Same question, on the other chapter whose mini is a ride you climb onto.
  'carroza':       { label: 'carried', unit: ' m up the plaza', better: 'higher', dp: 0, par: 27 },
  // The minis that are worth doing WELL as well as doing. Only two of the
  // thirteen are: a gravity ride has a number in it by construction, and so
  // does anything with a clock on it.
  'cart-run':      { label: 'top speed', unit: ' m/s', better: 'higher', dp: 1, par: 8.5 },
  'take-a-wave':   { label: 'longest ride', unit: ' m', better: 'higher', dp: 1, par: 32 },
  'acrobats':      { label: 'thrown', unit: ' m up', better: 'higher', dp: 1, par: 10 },
  'driftseed':     { label: 'carried', unit: ' m', better: 'higher', dp: 0, par: 80 },
  // The three new places. A surf zone, a herd and a cave passage all have a
  // number in them by construction — how far, how many, how long — and a
  // chapter whose best line is a RIDE has to have somewhere to put it, or the
  // ride is a switch you flip once.
  'the-rip':       { label: 'out the back in', unit: ' s', better: 'lower', dp: 1 },
  'all-the-way':   { label: 'longest ride', unit: ' m', better: 'higher', dp: 1, par: 55 },
  'take-off':      { label: 'fastest take-off', unit: ' m/s', better: 'higher', dp: 1, par: 6 },
  'the-crossing':  { label: 'brought over', unit: ' of them', better: 'higher', dp: 0, par: 7 },
  'cowbird':       { label: 'carried it for', unit: ' s', better: 'higher', dp: 1, par: 45 },
  'gather':        { label: 'longest string', unit: ' behind you', better: 'higher', dp: 0, par: 8 },
  'great-wall':    { label: 'the wall in', unit: ' s', better: 'lower', dp: 1 },
  'swiftlets':     { label: 'put up', unit: ' at once', better: 'higher', dp: 0, par: 60 },
  'the-log':       { label: 'stayed on for', unit: ' m', better: 'higher', dp: 0, par: 90 },
  // Chapter 17. Three of the four things worth doing WELL down there are
  // things you cannot do at all in any other chapter, which is a reasonable
  // definition of what a chapter is for.
  'orca-ride':       { label: 'held station for', unit: ' s', better: 'higher', dp: 1, par: 18 },
  'penguin-highway': { label: 'the hill in', unit: ' s', better: 'lower', dp: 1, par: 24 },
  'blue-ice':        { label: 'top speed', unit: ' m/s', better: 'higher', dp: 1, par: 12 },
  'floe-drift':      { label: 'carried', unit: ' m', better: 'higher', dp: 0, par: 90 },
  // Chapter 18. Four numbers, and three of them are the reason to come back:
  // a stack is a thing you can be better at, a crossing is a thing you can be
  // quieter at, and a tunnel is a thing you can be faster through. The fourth
  // is nine and a half metres of yacht and is simply funny.
  'chip-stack':      { label: 'left the table', unit: ' up', better: 'higher', dp: 0, par: 20 },
  'the-floor':       { label: 'across in', unit: ' s', better: 'lower', dp: 1 },
  'the-tunnel':      { label: 'through it at', unit: ' m/s', better: 'higher', dp: 1, par: 22 },
  'the-hairpin':     { label: 'rode', unit: ' m of the lap', better: 'higher', dp: 0 },
  'high-dive':       { label: 'went in from', unit: ' m up', better: 'higher', dp: 1, par: 9 },
  // Chapter 19, and the first of these is the best question in the game: not
  // how fast you crossed, not how far — HOW MANY OF THEM HAD TO GO ROUND YOU.
  // It is the only number here that measures a crossing rather than a walk.
  'cross-the-road':  { label: 'made', unit: ' of them go round you', better: 'higher', dp: 0 },
  'ride-the-flow':   { label: 'carried', unit: ' m through the quarter', better: 'higher', dp: 0 },
  'the-stools':      { label: 'had', unit: ' down at once', better: 'higher', dp: 0, par: 30 },
  'the-train':       { label: 'stood your ground within', unit: ' m of it', better: 'lower', dp: 2, par: 1.8 },
};


/** Highest chapter number present in TASKS. */
export function chapterCount() {
  let n = 1;
  for (let i = 0; i < TASKS.length; i++) if ((TASKS[i].chapter || 1) > n) n = TASKS[i].chapter;
  return n;
}

/**
 * THE ONE ROW A CHAPTER IS FOR, or null. See TASKS' `wow` note and CHAPTERS'
 * `marquee` note.
 *
 * The marquee law is one `wow` per chapter and nothing enforces it, so this
 * answers the FIRST — a second one in a chapter would be a mistake somebody
 * has to see rather than a silently different answer depending on which
 * reader asked.
 */
export function wowOfChapter(n) {
  for (let i = 0; i < TASKS.length; i++) {
    if ((TASKS[i].chapter || 1) === n && TASKS[i].wow) return TASKS[i];
  }
  return null;
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

/**
 * WHERE THE WATER IS AT A POINT, and there is now exactly one answer to that.
 *
 * ---- THE ASYMMETRY THIS REPLACES (X8) ------------------------------------
 * Five modules needed the live waterline and they asked for it two different
 * ways. props.js, weather.js and npc.js called `waterHeightAt` unconditionally.
 * capybara.js and systems.js called it ONLY when the chapter also set
 * `localWater: true` — a flag three chapters out of nineteen set — and
 * otherwise took the flat `waterLevel` datum.
 *
 * That was written down as "harmless today, and a trap for the fourth chapter
 * that adds a swell". It was not harmless. Measured over a 24 x 24 grid inside
 * bounds() in every chapter (qa/px-hooks.js), four chapters that do NOT set the
 * flag disagree with themselves:
 *
 *   kyoto   0.577 m     monaco  0.627 m
 *   quay    0.289 m     cali    0.100 m
 *
 * So in four chapters a prop floated on the visible surface while the animal
 * beside it solved its swim threshold, its float target, its clamber ceiling
 * and its wake rings against a datum up to 63 cm away — and the camera decided
 * whether the frame was underwater against that same wrong datum.
 *
 * Kyoto had already noticed and worked around it the only way the gate allowed:
 * it REWROTE its own published `waterLevel` every frame from the animal's
 * position, so that a chapter with two waters 45 cm apart could get the right
 * one. That is the tell. A published datum that changes because the player
 * walked somewhere is not a datum, and everything else reading it — the
 * minimap, a prop's rest height on a still day — got the swing for free.
 *
 * There is no flag here, because there never needed to be one: a chapter with
 * no swell returns its own waterLevel from waterHeightAt and the two answers
 * are identical. `localWater` is kept as documentation of which chapters have a
 * surface with shape in it; nothing branches on it any more.
 *
 * Returns `miss` where the chapter has no water at all — capybara.js wants
 * -0.5 there and systems.js wants -Infinity, so neither gets a special case.
 */
export function waterYAt(api, x, z, miss) {
  if (api) {
    if (typeof api.waterHeightAt === 'function') {
      // Guarded, because npc.js has always guarded it and was right to: a
      // chapter that has been registered but not built can throw out of any of
      // its published hooks, and a waterline is asked for on frames where that
      // is true.
      try {
        // No sentinel test: a dry chapter publishes -400 from BOTH of these
        // (goreme, sahara), so the two paths agree and nothing needs a threshold.
        const y = api.waterHeightAt(x, z);
        if (typeof y === 'number' && y === y) return y;
      } catch (e) { /* fall through to the datum */ }
    }
    const w = api.waterLevel;
    if (typeof w === 'number' && w === w) return w;
  }
  return miss;
}
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

// ---------------------------------------------------------------------------
// SHORE — WHERE THE LAND MEETS THE WATER, AND IT DID NOT (D5).
//
// MEASURED (`grep -c foam`): Manly 34, Rio 15, the Quay 6, and Palawan,
// Venice, Antarctica and Iceland ZERO. Four chapters whose whole subject is a
// coastline draw the land and the water as two flat sheets that happen to
// intersect, and the tell is `qa/rv-antarctic.png`: the floes sit ON a grey
// wash rather than IN it, because nothing anywhere says where the surface
// crosses them.
//
// THE HEIGHT IS THE WHOLE TRICK, AND grain() ALREADY HAS IT. Every grained
// fragment carries `vGrainW`, its own world position, and a chapter's
// waterline is one float. So `uShoreY - vGrainW.y` is the depth of THIS
// fragment below the surface, for free, on materials that already exist —
// which is the difference between this and a foam mesh per shoreline, and
// the reason it can go on nineteen chapters' worth of merged world geometry
// without a single new draw call.
//
// It reaches three things that all wanted it and none of which are the sea:
//
//   THE BEACH        a wide band where the sand shelves, so the water's edge
//                    is a lace of foam instead of a straight polygon join;
//   A WALL OR A FLOE the same band on a near-vertical face, which is a
//                    horizontal line at the waterline — the one mark that
//                    puts a floe IN the water rather than on it;
//   THE SEABED       everything below the line, tinted with depth, which is
//                    what a transparent sea (Palawan at 0.45) was missing.
//
// AND IT IS THE GENERALISATION OF SOMETHING THAT ALREADY SHIPPED. `venWet` in
// venice.js has run `uVenWaterY - vVenW.y` through a wet band and a static
// 0.11 m rim line since chapter 10, on the acqua alta's moving waterline —
// one chapter's private copy of exactly this term, with no animation in it.
// Venice keeps its numbers and loses its copy.
const _shoreY = { value: -9999 };
/**
 * WHERE THE WATERLINE IS, for every shored material in the live chapter.
 * systems.js calls this once per frame off the biome's own `shoreY()` hook,
 * or its `waterLevel` where it has none.
 *
 * The default is -9999 and that matters: a chapter with no water at all — or
 * one whose module never publishes a level — puts the band a mile under the
 * world and every shored fragment takes the `sd < 0` branch, which is the
 * picture exactly as it was. A missing hook is a no-op, never a black band.
 */
export function shoreTick(y) {
  _shoreY.value = (typeof y === 'number' && y === y) ? y : -9999;
}
/** What the shore term is reading, for an audit that wants to know whether a
 *  chapter is wired at all rather than merely whether it looks right. */
export function shoreY() { return _shoreY.value; }

// ---------------------------------------------------------------------------
// CONTACT — THE OTHER HALF OF THE RIM, AND THE REASON NOTHING IN THIS GAME
// LOOKED LIKE IT WAS RESTING ON ANYTHING.
//
// The rim (see _rimInject above) separates a silhouette from the BACKGROUND.
// Photographed, that worked. What it cannot do — and what six of six frames in
// qa/PRESENCE-PASS.md show — is separate a thing from the FLOOR: the capybara
// casts a soft offset sun shadow and has no darkening at all under its feet,
// and the bench legs, the bollards and the tree trunks all meet the ground on a
// clean seam. Everything floats.
//
// THE THREE THINGS THIS IS DELIBERATELY NOT:
//
//   Not SSAO. No second render target, no depth prepass, no normal buffer. The
//   composite pass is doing enough work and this is a flat-shaded low-poly game.
//
//   Not decals. Alpha-blended dark quads bring z-fighting on a heightfield and
//   transparency sorting against the weather motes — and Sydney already has
//   flat lilac jacaranda decals on the lawn, which are the worst-looking thing
//   in qa/na-sydney.png. A second family of flat blobs is not the answer.
//
//   Not per-object. A term on the object darkens the OBJECT; what has to darken
//   is the surface the object is standing on, which belongs to a different mesh
//   and usually to a different module.
//
// So it is a term in the fragment shader of the surfaces that already take
// grain(), fed a fixed-size uniform pool of the nearest contact points. No
// extra draw calls, no sorting, no z-fighting, correct on a heightfield, and it
// composites with the grain rather than on top of it.
//
// TWELVE SLOTS, and the number is a compile-time literal because a GLSL ES 1.0
// array size and loop bound have to be. It is a shared uniform block, so twelve
// contact patches on every grained surface in the live chapter cost twelve
// vec4 writes per frame in total, not per material — the same deal grainTick()
// and rimTick() already get.
const _CONTACT_N = 12;
// xyz = the world position of the contact centre, at the object's BASE, not its
// origin. w = the radius of its footprint.
const _contactP = { value: [] };
// 0..1, and it is faded rather than switched: a patch that pops on as the
// distance ranking changes reads as a bug, and it is the first thing that gets
// skipped under time pressure. systems.js owns the ramp.
const _contactK = { value: [] };
// One float so an empty pool costs a coherent branch and not twelve iterations.
const _contactOn = { value: 0 };
for (let i = 0; i < _CONTACT_N; i++) {
  _contactP.value.push(new THREE.Vector4(0, -9999, 0, 1));
  _contactK.value.push(0);
}
// The deepest a fully-weighted patch is allowed to take the diffuse. This is
// contact, not drama: past about a third the ring stops reading as the absence
// of bounce light and starts reading as paint, which is the failure mode of
// every decal-based version of this effect.
const _contactMAX = 0.32;
// Absolute metres, NOT a multiple of the radius. A prop on a balcony must not
// darken the street six metres below it, and expressing that gate in radii
// makes the cut-off depend on how big the prop is — so a market stall on a
// terrace would reach further down than a bin on one. The gate closes a metre
// below the object's base whatever the object is.
const _contactRISE0 = 0.25;
const _contactRISE1 = 1.00;
/** How many slots the pool has. systems.js ranks into this many. */
export function contactSlots() { return _CONTACT_N; }
/**
 * Write the pool. systems.js calls this once per frame with at most
 * contactSlots() entries, already ranked and already faded:
 *
 *     list[i] = { x, y, z, r, k }
 *
 * Slots beyond `n` are zeroed, so a contributor that leaves the pool cannot
 * leave a dark patch behind — which it would, silently, if this only ever wrote
 * the slots it was given.
 */
export function contactTick(list, n) {
  const P = _contactP.value, K = _contactK.value;
  let live = 0;
  for (let i = 0; i < _CONTACT_N; i++) {
    if (i < n) {
      const e = list[i];
      P[i].set(e.x, e.y, e.z, e.r > 0.06 ? e.r : 0.06);
      K[i] = e.k > 0 ? (e.k < 1 ? e.k : 1) : 0;
      if (K[i] > 0.002) live++;
    } else {
      K[i] = 0;
    }
  }
  _contactOn.value = live > 0 ? 1 : 0;
}

// ---------------------------------------------------------------------------
// SWAY — NINETEEN WORLDS OF PALMS AND CLOTH, AND NOT ONE OF THEM MOVED.
//
// `wxMOOD` in weather.js is nineteen hand-set rows of real wind — a base speed,
// a gust swing, a frequency and a bearing. Sydney is 3.4 m/s swinging 1.6 at
// 0.070 Hz on a bearing of 1.90 rad; Kyoto is a still 1.1; Pasto is 2.6 swinging
// 1.9. It is damped, it gusts, it has a direction, and `gust()` hands it out as
// a live vector.
//
// It had exactly two readers — the shove on a loose prop (props.js) and an NPC's
// reaction (npc.js) — and a grep across all twenty-seven modules for foliage,
// canopy, frond, banner, awning, laundry, sail, tarp or flag motion returned
// NOTHING. There was no vertex animation anywhere in this game. The player
// could feel a gust push a bin and could not see the world it was blowing
// through.
//
// THE ONE DECISION THIS HELPER IS BUILT AROUND, and the batch that specified it
// was right to demand it up front: MOST CHAPTER GEOMETRY IS MERGED, so "how far
// is this vertex above the object's own base" is unanswerable — the base is the
// merged root, and a canopy twelve metres up would sway like twelve metres of
// rope. Three answers were available and only one of them is cheap:
//
//   NOT a per-vertex base attribute — that means touching every merger in the
//   game, and the mergers are the most load-bearing code in the chapters.
//   NOT "only unmerged meshes" — that is most of the foliage excluded.
//   BUT a WINDOW on a local axis, `lo`..`hi`, declared by the call site, which
//   already knows how tall its own palms are. On an InstancedMesh the window is
//   in the instance's OWN frame, which is why instanced foliage — Palawan's
//   ninety palms, Marrakech's dates — is the cleanest possible target: each
//   frond arrives in its own coordinates with its base at the origin.
//
// AND THE DIRECTION IS A WORLD DIRECTION, PUSHED THROUGH THE TRANSPOSE.
// `transformed` is local and pre-instancing, so displacing it by a world vector
// would have every frond of a radiating crown bend a different way. GLSL ES has
// no inverse(), but the rotation part of a model matrix is orthonormal and its
// inverse IS its transpose — and `v * M` in GLSL is exactly `transpose(M) * v`.
// So one multiply puts the world wind into local space. Where the instance
// matrix also carries scale the transpose is off by that scale, which comes out
// as a bigger frond swinging further: wrong in theory and right in the picture.
const _swayT = { value: 0 };
const _swayD = { value: new THREE.Vector2(0, 1) };  // unit, world x/z
const _swayK = { value: 0 };                        // 0 (still) .. ~1.4 (gusting)
// The wind speed that counts as a full-strength sway. Chosen against the table
// rather than by eye: at 3.5 the still chapters (Kyoto 1.1, Son Doong 0.6) come
// out near a third and the open ones (Sydney 3.4, Manly, Antarctica) near one,
// which is the ordering wxMOOD already asserts.
const _swayREF = 3.5;
/**
 * The wind, once per frame, for every swaying material in the game.
 *
 * `g` is weather.js's `gust()` — a VECTOR in m/s that already carries the
 * biome's base wind, its bearing and its gusting, damped. Passing the vector
 * rather than a speed and an angle is deliberate: the direction and the
 * strength must never be able to disagree about which frame they are in.
 */
export function swayTick(t, g) {
  _swayT.value = t;
  const gx = g ? g.x : 0, gz = g ? g.z : 0;
  const m = Math.sqrt(gx * gx + gz * gz);
  if (m > 0.0001) _swayD.value.set(gx / m, gz / m);
  const k = m / _swayREF;
  _swayK.value = k > 0 ? (k < 1.4 ? k : 1.4) : 0;
}

// --- THE WAKE (v44) ---------------------------------------------------------
// Every swaying thing in the game answers the wind and NOTHING answered the
// animal. A capybara at a flat run through a reed bed, a rice paddy, a bamboo
// grove or a row of market awnings went through them as though it were a
// photograph of a capybara: the one moving object in the world had no effect on
// the only surfaces built to move.
//
// It is the same shader hook and the same ramp — the tip moves and the base
// does not — with a second, radial displacement pushed away from one point. So
// it costs one uniform, seven lines of GLSL, and NOTHING per chapter: every
// mesh that already swayed now also parts, in all nineteen worlds, including
// the ones written before this existed.
//
// `x`/`z` is where the animal is and `k` is how hard it is pushing, which is
// its own speed — a walk brushes the grass and a run shoves it. Packed into one
// vec3 because three uniforms that must never disagree about which frame they
// are in should be one uniform. See swayTick, which has the same rule.
const _wakeP = { value: new THREE.Vector3(0, 0, 0) };   // world x, world z, strength
const _wakeREF = 6.6;    // m/s that counts as a full push (a shade under capyRUN)
// The radius is the animal plus a little — a capybara is 1.1 m long and what
// parts around it should read as contact, not as a force field. The amount is
// deliberately under the wind's own: a gust moves a frond further than a
// capybara does, and it would be a strange world where that were not true.
const _WAKE_R = 1.75;    // m
const _WAKE_A = 0.34;    // m of travel at the tip, at the radius centre, at a run
export function wakeTick(x, z, speed) {
  _wakeP.value.set(x, z, Math.min(1, Math.max(0, speed / _wakeREF)));
}

const _swayCache = new Map();
function _swayInject(shader, amount, axis, lo, hi, stiff, hz) {
  shader.uniforms.uSwayT = _swayT;
  shader.uniforms.uSwayD = _swayD;
  shader.uniforms.uSwayK = _swayK;
  shader.uniforms.uWakeP = _wakeP;
  const span = (hi - lo) > 0.0001 ? (hi - lo) : 0.0001;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>',
             '#include <common>\nuniform float uSwayT;\nuniform vec2 uSwayD;\nuniform float uSwayK;\nuniform vec3 uWakeP;')
    .replace('#include <begin_vertex>', [
      '#include <begin_vertex>',
      '{',
      // The ramp, on the call site's own axis and window. pow() rather than a
      // linear ramp because a frond is not a rope: the base of anything that
      // sways is stiffer than its tip, and the exponent is the only knob that
      // tells a palm from a banner.
      '  float swR = clamp((transformed.' + axis + ' - ' + lo.toFixed(4) + ') * ' +
                    (1 / span).toFixed(6) + ', 0.0, 1.0);',
      '  swR = pow(swR, ' + stiff.toFixed(3) + ');',
      // THE PHASE, AND IT HAS TO COME FROM SOMEWHERE THAT DOES NOT MOVE WITH
      // THE CAMERA. On an instanced mesh it is the instance's own origin, so a
      // crown of nine fronds moves as one tree and the tree next to it does
      // not; on a merged mesh there is only one origin, so it falls back to the
      // vertex's own world position and the sway travels across the surface —
      // which is what a gust crossing a row of awnings actually looks like.
      '  vec4 swO = vec4(0.0, 0.0, 0.0, 1.0);',
      '  #ifdef USE_INSTANCING',
      '    swO = instanceMatrix * swO;',
      '  #else',
      '    swO = vec4(transformed, 1.0);',
      '  #endif',
      '  swO = modelMatrix * swO;',
      '  float swP = swO.x * 0.31 + swO.z * 0.27;',
      // TWO FREQUENCIES, NOT ONE. A single sine is a metronome and a whole
      // street of awnings breathing on it reads as one organism. The slow term
      // is the lean into the gust; the fast one, at a quarter of the weight and
      // an incommensurate ratio, is the flutter that stops it looping visibly.
      '  float swA = sin(uSwayT * ' + (0.90 * hz).toFixed(4) + ' + swP) * 0.74',
      '            + sin(uSwayT * ' + (2.73 * hz).toFixed(4) + ' + swP * 1.7 + 1.3) * 0.26;',
      '  float swM = swR * ' + amount.toFixed(4) + ' * uSwayK * swA;',
      // ...and back into local space through the transpose. See the note above.
      '  mat3 swB = mat3(modelMatrix);',
      '  #ifdef USE_INSTANCING',
      '    swB = swB * mat3(instanceMatrix);',
      '  #endif',
      '  transformed += vec3(uSwayD.x, 0.0, uSwayD.y) * swB * swM;',
      // ---- THE WAKE. Same ramp, radial instead of directional. -----------
      // Squared falloff rather than linear: a linear one has a hard outer edge
      // that travels across a reed bed like a ring, and the whole effect is
      // supposed to be something you notice without being able to point at.
      // The tip is what moves — swR again — so the bases stay put and the bed
      // opens rather than sliding.
      '  vec2 wkD = swO.xz - uWakeP.xy;',
      '  float wkL = length(wkD);',
      '  if (wkL < ' + _WAKE_R.toFixed(3) + ' && wkL > 0.0001 && uWakeP.z > 0.0) {',
      '    float wkF = 1.0 - wkL * ' + (1 / _WAKE_R).toFixed(6) + ';',
      '    wkF = wkF * wkF * uWakeP.z * swR * ' + _WAKE_A.toFixed(4) + ';',
      '    transformed += vec3(wkD.x / wkL, 0.0, wkD.y / wkL) * swB * wkF;',
      '  }',
      '}',
    ].join('\n'));
}
/**
 * A swaying clone of `m`. Returns a CLONE for grain()'s reason: mat() hands back
 * a shared cached material and compiling a hook onto it would sway every mesh in
 * the game that happens to share a hex.
 *
 *   amount  metres of travel at the tip at a full gust, 0 (off, THE DEFAULT)
 *   axis    'x' | 'y' | 'z' — which LOCAL axis the ramp runs along. 'z' for
 *           Palawan's fronds, whose own frame runs 0 (base) to 1 (tip) in z.
 *   lo, hi  the window on that axis, in the mesh's own units
 *   stiff   the exponent on the ramp: 1 a rope, 3 a trunk
 *   hz      frequency multiplier, for something lighter or heavier than a leaf
 */
export function sway(m, opts) {
  const o = opts || {};
  const amount = o.amount === undefined ? 0 : o.amount;
  if (!(amount > 0)) return m;
  const axis = o.axis === 'x' ? 'x' : (o.axis === 'z' ? 'z' : 'y');
  const lo = o.lo === undefined ? 0 : o.lo;
  const hi = o.hi === undefined ? 1 : o.hi;
  const stiff = o.stiff === undefined ? 1.6 : o.stiff;
  const hz = o.hz === undefined ? 1 : o.hz;
  const key = m.uuid + '|' + amount + '|' + axis + '|' + lo + '|' + hi + '|' + stiff + '|' + hz;
  const hit = _swayCache.get(key);
  if (hit) return hit;
  const g = m.clone();
  const prev = m.onBeforeCompile;
  // The clone drops onBeforeCompile — that is grainOwn()'s bug, and a swaying
  // rimmed material would silently lose its rim the way five seas once lost
  // their glitter. Whatever the source had runs first, then the sway.
  const hadHook = typeof prev === 'function' && m.hasOwnProperty('onBeforeCompile');
  const prevKey = m.customProgramCacheKey;
  g.onBeforeCompile = function (shader) {
    if (hadHook) prev.call(this, shader);
    _swayInject(shader, amount, axis, lo, hi, stiff, hz);
  };
  g.customProgramCacheKey = function () {
    return 'sway' + key + (prevKey ? '|' + prevKey.call(this) : '');
  };
  g.needsUpdate = true;
  _swayCache.set(key, g);
  return g;
}
/**
 * Make one mesh sway — material AND shadow.
 *
 * THE HALF THAT WOULD OTHERWISE BE FORGOTTEN. The shadow pass compiles its own
 * program from its own material, so a mesh that sways in the colour pass and
 * not in the depth pass has a shadow that walks away from it — and it is
 * exactly the kind of thing that survives review because the shadow is the last
 * place anybody looks. Doing both in one call is the only way it cannot be
 * half-done.
 */
export function swayMesh(mesh, opts) {
  if (!mesh || !mesh.material) return mesh;
  let o = opts || {};
  // `leaf` RIDES ALONG HERE because this call is already the marker for "this
  // mesh is a plant" — every swaying thing in the game is foliage, so opting a
  // chapter's greenery into the transmission term is one word on a line that
  // already exists. Read BEFORE the `auto` branch below, which rebuilds `o` as
  // a copy and would drop it. A plant that does not sway (a jacaranda crown, a
  // lily pad) uses leafMesh() directly.
  const lk = (opts && opts.leaf) || 0;
  if (!(o.amount > 0)) return leafMesh(mesh, lk);
  // ---- `auto: true` — TAKE THE WINDOW FROM THE GEOMETRY ITSELF (v44) -------
  // The window is the one thing a call site gets wrong, because it is the one
  // thing that is a property of the GEOMETRY and not of the plant: a unit
  // cylinder built centred runs -0.5..0.5 and one built based runs 0..1, they
  // look identical in the file that uses them, and getting it backwards bends
  // the tuft into the ground instead of away from it. Every geometry in this
  // game knows its own extent, so ask it.
  //
  // This is what makes the wake affordable to roll out: opting a chapter's
  // foliage in is now one line that cannot be wrong about a shape somebody
  // else authored. Explicit lo/hi still win, for the three call sites that
  // deliberately window a SUBSET of their geometry.
  if (o.auto && mesh.geometry) {
    const ax = o.axis === 'x' ? 'x' : (o.axis === 'z' ? 'z' : 'y');
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const bb = mesh.geometry.boundingBox;
    if (bb) {
      // ROUNDED, because lo/hi go into the program cache key: two tuft batches
      // whose bounding boxes differ in the fifth decimal are the same plant and
      // must not compile two shaders.
      const lo = Math.round(bb.min[ax] * 100) / 100;
      const hi = Math.round(bb.max[ax] * 100) / 100;
      if (hi - lo > 0.0001) {
        // A COPY, not a mutation of the caller's object: these option literals
        // are frequently shared between several batches in one loop.
        o = { amount: o.amount, axis: ax, lo: lo, hi: hi, stiff: o.stiff, hz: o.hz };
      }
    }
  }
  mesh.material = sway(mesh.material, o);
  // AFTER the sway, so leaf() chains onto it rather than being overwritten by
  // it — the same ordering rule the sway itself follows with the rim.
  if (lk > 0) mesh.material = leaf(mesh.material, lk);
  if (mesh.castShadow) {
    const d = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    const amount = o.amount;
    const axis = o.axis === 'x' ? 'x' : (o.axis === 'z' ? 'z' : 'y');
    const lo = o.lo === undefined ? 0 : o.lo;
    const hi = o.hi === undefined ? 1 : o.hi;
    const stiff = o.stiff === undefined ? 1.6 : o.stiff;
    const hz = o.hz === undefined ? 1 : o.hz;
    d.onBeforeCompile = function (shader) { _swayInject(shader, amount, axis, lo, hi, stiff, hz); };
    d.customProgramCacheKey = function () { return 'swayD' + amount + axis + lo + hi + stiff + hz; };
    mesh.customDepthMaterial = d;
  }
  return mesh;
}

const _grainCache = new Map();
export function grain(m, opts) {
  const o = opts || {};
  const scale = o.scale === undefined ? 0.7 : o.scale;
  const amount = o.amount === undefined ? 0.12 : o.amount;
  const warp = o.warp === undefined ? 0.35 : o.warp;
  // ---------------------------------------------------------------------
  // NEAR — THE OCTAVE THE FIELD WAS MISSING, AND THE FADE THAT LETS IT EXIST.
  //
  // Measured (qa/vis-flat2.js, bottom third / centre 60%): the ground is 40-55%
  // of every frame and in most chapters it is one value. Palawan's sand came
  // back at SD 2.05 over five distinct 5-bit colours; Sydney's lawn at 4.30 over
  // thirteen. Rio measured 51 for one reason only — it has a GRAPHIC on the
  // floor. Nothing else about its renderer differs.
  //
  // grain() was not wrong, it was an octave and a half too low to see. `scale`
  // 0.5-0.72 puts the coarse term at a metre and a half and the fine one at half
  // a metre; the gameplay band of the frame is ground three to six metres from
  // the lens, where half a metre is a third of the screen height. There was
  // nothing in the field at the size of a tuft, a paving joint or a ripple in
  // sand.
  //
  // WHY IT COULD NOT SIMPLY BE TURNED UP, and this is the whole reason the fade
  // is the enabling change rather than a nicety: the base grain has NO distance
  // term. Raise its frequency and the far half of a hundred-and-sixty-metre lawn
  // is sampled far under Nyquist, so it stops being noise and becomes crawl —
  // it boils as the camera moves. `sparkle` solved exactly this, for exactly
  // this reason, with `fwidth`; this is the same solution one field over.
  //
  //   near       peak-to-peak fraction of the diffuse, 0 (off) .. ~0.4
  //   nearScale  multiplier ON TOP of `scale`, so a chapter that already knows
  //              how big its ground features are gets the near octave in
  //              proportion for free
  //
  // DEFAULTS TO ZERO. Every existing call site keeps the picture it was tuned
  // against until it opts in, one at a time.
  //
  // The fade goes to nothing at a footprint of half a cell, which IS Nyquist for
  // a smoothstep-interpolated value noise: one cycle per cell needs two pixels
  // per cycle, so one pixel may cover at most half a cell before what is drawn
  // stops being the field and starts being an alias of it. Hence * 2.0 and not
  // the sparkle's 0.60 — a sparkle is a thresholded speck and dies honestly much
  // later.
  //
  // And it is sampled in a ROTATED frame. Value noise sits on a square lattice;
  // stacked on the base octave at the same orientation the two agree along the
  // axes and the eye finds the grid. Half a radian is enough that it never does.
  const near = o.near === undefined ? 0 : o.near;
  const nearScale = o.nearScale === undefined ? 6 : o.nearScale;
  // ---------------------------------------------------------------------
  // BROAD — THE OCTAVE ABOVE, AND THE ONE CHANNEL THIS FIELD NEVER HAD.
  //
  // Everything above varies BRIGHTNESS. `gn` is a multiply on the diffuse and
  // so is `gnr`, and between them they run from a metre and a half down to a
  // few centimetres. Two things were still missing and they are the same
  // thing looked at twice:
  //
  //   - THERE IS NO OCTAVE ABOVE A METRE AND A HALF. A lawn is not uniform
  //     over thirty metres, it is patchy over ten; sand is packed in some
  //     places and loose in others; a piazza has been mended. At 1/scale the
  //     field is finer than any of that, so a big ground still reads as one
  //     value with a texture on it rather than as a place with variation in
  //     it. The ground is 40-55% of every frame in this game.
  //   - AND NOTHING HERE HAS EVER MOVED A HUE. Grass yellows where it is dry
  //     and goes blue-green in the damp; sand goes pink dry and grey packed.
  //     A pure luminance field cannot say any of that, and a flat hue over
  //     half the picture is most of what makes a large surface read as a
  //     polygon rather than as ground.
  //
  // ONE SAMPLE DOES BOTH, and they are CORRELATED ON PURPOSE: the gain is
  // per-channel, so the bright half of the field goes warm and the dark half
  // goes cool. That is not a shortcut, it is the physical case — a dip in a
  // lawn is darker because it sees less sun and cooler because what it does
  // see is sky. At broad = 0.10 the warm-to-cool spread across the whole
  // field is about 7%, which is the same order as the split tone in the lens
  // pass and, like it, is meant to be invisible until it is switched off.
  //
  // NO DISTANCE FADE, unlike `near` and unlike the sparkle: at roughly an
  // eighteen-metre wavelength this field is never within an octave of Nyquist
  // in any frame this camera can compose, so there is nothing to alias and
  // the fwidth those two need would cost a derivative for nothing.
  //
  // It is WARPED BY `gn`, which is already computed and therefore free, for
  // the reason the near octave is: value noise sits on a square lattice, and
  // an eighteen-metre lattice across a thirty-metre frame is two cells and
  // shows itself as two soft squares.
  // IN METRES, and taken off the world position rather than off `gq`. Every
  // other octave in here is a multiple of `scale`, which is a per-chapter
  // number between 0.24 and 0.62 — so the same multiplier would put this
  // field at eighteen metres in Kyoto and forty-six in Hanoi, and "how big is
  // a patch of ground" is not a thing that varies by a factor of three
  // between two streets. A wavelength is the honest unit for it.
  //
  // Sampled on XZ only: a wall gets one value up its whole height, which is
  // what a wall does. There is no y-warp for the same reason `gq` has one —
  // that warp exists so a vertical face does not get a stretched copy of the
  // fine field, and at sixteen metres there is nothing to stretch.
  const broad = o.broad === undefined ? 0 : o.broad;
  const broadM = o.broadM === undefined ? 16 : o.broadM;
  // How the per-channel gain splits. Red rises fastest and blue slowest, so
  // the bright half of the field is the warm half. Not in PALETTE because it
  // is not a colour — it is the shape of a ramp, exactly like MAIN_SPLIT_WARM.
  const _BROAD_K = [1.35, 1.0, 0.62];
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
  // CONTACT — see the block above _grainCache. Off unless a call site asks, so
  // every surface in the game keeps the picture it was tuned against until it
  // opts in, one at a time.
  //
  // NEVER ON WATER, and never on the wet-only build. A sea does not have things
  // resting on it — the capybara swims IN it — and `spark > 0` is this helper's
  // existing and only marker for "this material is a sea", exactly as the wet
  // term already uses it. The wet-only build is props.js's one shared material
  // and its whole invariant is "the wet gate and nothing else".
  const cont = (wetOnly || spark > 0 || o.contact === undefined) ? 0 : o.contact;
  // SHORE — see the block above _shoreY. Off unless a call site asks, and off
  // on a sea and on the wet-only build for the same two reasons `contact` is:
  // `spark > 0` is this helper's marker for "this material IS the water", and
  // a waterline drawn on the water is a line drawn on itself; and props.js's
  // one shared material is the wet gate and nothing else.
  const shore = (wetOnly || spark > 0 || o.shore === undefined) ? 0 : o.shore;
  // The band, in METRES, and it is a height rather than a multiple of `scale`
  // for the reason `broadM` is: how far up a wall the water slaps is a fact
  // about water, not about how coarse a chapter's ground grain is.
  const shoreBand = o.shoreBand === undefined ? 0.35 : o.shoreBand;
  // How dark a soaked surface goes, and over what height it gets there. The
  // pair of them are venWet's `mix(1.0, 0.72, smoothstep(-0.40, 0.03, vd))`
  // with the numbers named: a chapter that wants Venice's wet stone asks for
  // Venice's numbers and gets Venice's picture.
  const shoreDark = o.shoreDark === undefined ? 0.80 : o.shoreDark;
  const shoreWet = o.shoreWet === undefined ? 0.40 : o.shoreWet;
  // DEPTH. How far down the tint saturates, and how far toward the tint colour
  // it goes there. Only visible through a transparent sea, so it is zero by
  // default and Palawan is the chapter that asks.
  const shoreDeep = o.shoreDeep === undefined ? 3.5 : o.shoreDeep;
  const shoreTint = o.shoreTint === undefined ? 0 : o.shoreTint;
  const shoreTintC = o.shoreTintColor === undefined ? 0x2a6f86 : o.shoreTintColor;
  const shoreCol = o.shoreColor === undefined ? 0xffffff : o.shoreColor;
  const shoreScale = o.shoreScale === undefined ? 1.6 : o.shoreScale;
  // BOTH CACHES COME OFF THIS ONE STRING — the material cache below and
  // customProgramCacheKey at the bottom of the hook — so a new option that is
  // not in it gets two call sites sharing one compiled program, and which one
  // you get depends on draw order. That is the failure this key was written
  // for; `broad` and `broadScale` change the source, so they are in it.
  const key = m.uuid + '|' + scale + '|' + amount + '|' + warp + '|' + near + '|' + nearScale + '|' +
              spark + '|' + sparkScale + '|' + sparkSpeed + '|' + sparkCut + '|' + sparkBand + '|' + sparkCol +
              '|' + cont + '|' + (wetOnly ? 'w' : '') + '|' + broad + '|' + broadM +
              '|' + shore + '|' + shoreBand + '|' + shoreDark + '|' + shoreWet + '|' + shoreDeep +
              '|' + shoreTint + '|' + shoreTintC + '|' + shoreCol + '|' + shoreScale;
  const hit = _grainCache.get(key);
  if (hit) return hit;

  const g = m.clone();
  // ...AND THE CLONE DROPS THE RIM WITH IT. Material.copy() does not carry
  // onBeforeCompile — that is the whole of the grainOwn() bug, one function
  // down — so every grained surface in the game would have been the only
  // thing in it without a rim. grain() re-injects it at the bottom of its own
  // hook, and it asks the SOURCE material whether a rim belongs there at all:
  // a sea and a glow quad are not things you put an edge on.
  const rimHere = !wetOnly && spark <= 0 && !m.transparent &&
                  m.blending === THREE.NormalBlending && m.depthWrite !== false &&
                  !(m.emissive && (m.emissive.r > 0.001 || m.emissive.g > 0.001 || m.emissive.b > 0.001));
  const sc = new THREE.Color(sparkCol);
  const shc = new THREE.Color(shoreCol);
  const shtc = new THREE.Color(shoreTintC);
  // THE WET TERM IS FOR GROUND, NOT FOR WATER. `spark > 0` is this helper's
  // existing and only marker for "this material is a sea", and darkening a sea
  // because it is raining on it is nonsense twice over — it is already water,
  // and it already has the sparkle doing the same job better.
  const wet = spark <= 0;
  g.onBeforeCompile = function (shader) {
    if (spark > 0 || shore > 0) shader.uniforms.uGrainT = _grainTime;
    if (shore > 0) shader.uniforms.uShoreY = _shoreY;
    if (wet) {
      shader.uniforms.uGrainWet = _grainWet;
      shader.uniforms.uGrainWetC = _grainWetC;
    }
    if (cont > 0) {
      shader.uniforms.uCtcP = _contactP;
      shader.uniforms.uCtcK = _contactK;
      shader.uniforms.uCtcOn = _contactOn;
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
        (spark > 0 || shore > 0) ? 'uniform float uGrainT;' : '',
        shore > 0 ? 'uniform float uShoreY;' : '',
        cont > 0 ? 'uniform vec4 uCtcP[' + _CONTACT_N + '];' : '',
        cont > 0 ? 'uniform float uCtcK[' + _CONTACT_N + '];' : '',
        cont > 0 ? 'uniform float uCtcOn;' : '',
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
        // ---- THE NEAR-FIELD OCTAVE ------------------------------------
        // One more octave, six-ish times finer, in a frame rotated half a
        // radian so it never lines up with the lattice underneath it, and
        // faded out on its own screen-space footprint so the far ground is
        // exactly as smooth as it was before this existed. See the note on
        // `near` above for why the fade is the enabling half.
        // AND IT HAS TO BE TWO OCTAVES, WHICH THE FIRST BUILD LEARNED THE HARD
        // WAY. One octave of value noise at an amplitude big enough to measure
        // does not read as ground, it reads as SQUARES: smoothstep has zero
        // derivative at the cell boundary, so every cell of the lattice shows
        // its own edge and a lawn comes out looking quilted. Photographed at
        // near 0.36 the Botanic Gardens were unmistakably a grid. A second
        // octave at 2.17x, in a frame rotated another radian, has no shared
        // boundary anywhere with the first, and the quilt goes.
        (wetOnly || near <= 0) ? '' : '  vec2 gnq = vec2(gq.x * 0.8776 - gq.y * 0.4794,',
        (wetOnly || near <= 0) ? '' : '                  gq.x * 0.4794 + gq.y * 0.8776) * ' + nearScale.toFixed(4) + ' + 41.7;',
        // ...AND THE LATTICE STILL SHOWED, so the sample is DOMAIN-WARPED by
        // the octave underneath it before either one is taken. `gn` is already
        // computed and its wavelength is a metre and a half, so pushing the
        // near coordinate around by a cell and a half of it bends the whole
        // near lattice into slow curves — for two multiplies and no extra hash.
        // Photographed on the Piazzetta at near 0.62 the flagstones were a
        // visible diagonal grid; warped, the same number reads as worn stone.
        // It also has to happen BEFORE fwidth is taken, or the footprint fade
        // is measuring a field that is not the one being drawn.
        (wetOnly || near <= 0) ? '' : '  gnq += gn * 3.0;',
        (wetOnly || near <= 0) ? '' : '  vec2 gnq2 = vec2(gnq.x * 0.5403 - gnq.y * 0.8415,',
        (wetOnly || near <= 0) ? '' : '                   gnq.x * 0.8415 + gnq.y * 0.5403) * 2.17 + 11.3;',
        // Each octave fades on ITS OWN footprint. Sharing the coarse one's
        // fade would leave the fine one alive a full octave past Nyquist,
        // which is precisely the crawl this whole term exists to avoid.
        (wetOnly || near <= 0) ? '' : '  float nfw = max(fwidth(gnq.x), fwidth(gnq.y));',
        (wetOnly || near <= 0) ? '' : '  float gnr = ((grNoise(gnq) - 0.5) * 0.62 * clamp(1.0 - nfw * 2.00, 0.0, 1.0)',
        (wetOnly || near <= 0) ? '' : '             + (grNoise(gnq2) - 0.5) * 0.38 * clamp(1.0 - nfw * 4.34, 0.0, 1.0))',
        (wetOnly || near <= 0) ? '' : '             * ' + near.toFixed(4) + ';',
        // ---- THE BROAD OCTAVE ------------------------------------------
        // See the note on `broad` above. Warped by `gn` before it is sampled,
        // which costs two multiplies and is what stops an eighteen-metre
        // lattice reading as two soft squares across a frame.
        (wetOnly || broad <= 0) ? '' : '  vec2 gbq = vGrainW.xz * ' + (1 / broadM).toFixed(5) + ' + 7.13;',
        (wetOnly || broad <= 0) ? '' : '  gbq += gn * 0.8;',
        (wetOnly || broad <= 0) ? '' : '  float gb = (grNoise(gbq) - 0.5) * ' + broad.toFixed(4) + ';',
        // ONE multiply, not two: a second `*=` on the same channel compounds,
        // so a chapter that tuned `amount` against the picture would quietly
        // get a different number back the day it opted into `near`. The broad
        // term joins the same bracket for the same reason — and it is the one
        // term in here that is a vec3, because it is the only one that moves a
        // hue rather than a level.
        wetOnly ? '' : '  diffuseColor.rgb *= vec3(1.0 + gn * ' + amount.toFixed(4) +
                       ((!wetOnly && near > 0) ? ' + gnr' : '') + ')' +
                       ((!wetOnly && broad > 0)
                         ? ' + gb * vec3(' + _BROAD_K[0].toFixed(3) + ', ' +
                           _BROAD_K[1].toFixed(3) + ', ' + _BROAD_K[2].toFixed(3) + ')'
                         : '') + ';',
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
        shore > 0 ? [
          // ---- THE WATER'S EDGE ------------------------------------------
          // `sd` is metres BELOW the waterline: positive under, negative above.
          // See the block above _shoreY for why this is free.
          '  {',
          '    float sd = uShoreY - vGrainW.y;',
          // 1. THE SOAK, and it is venWet's band with its numbers named. It
          //    runs from `shoreWet` metres ABOVE the line (spray and the last
          //    wave) down through it, so a beach is dark for a stride before
          //    the water starts rather than at a polygon join.
          '    float sWet = smoothstep(' + (-shoreWet).toFixed(3) + ', 0.03, sd);',
          '    diffuseColor.rgb *= mix(1.0, ' + shoreDark.toFixed(3) + ', sWet);',
          // 2. DEPTH. Only ever visible through a transparent sea, so it is
          //    off unless a chapter asks — and it MULTIPLIES the albedo rather
          //    than mixing toward a flat colour, because what depth does is
          //    take the red out of what is down there, not paint it blue.
          shoreTint > 0 ? '    float sDep = smoothstep(0.0, ' + shoreDeep.toFixed(3) + ', sd);' : '',
          shoreTint > 0 ? '    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(' +
                          shtc.r.toFixed(4) + ', ' + shtc.g.toFixed(4) + ', ' + shtc.b.toFixed(4) +
                          '), sDep * ' + shoreTint.toFixed(3) + ');' : '',
          // 3. THE LACE, and the surge is what stops it being a contour line.
          //    Two slow sines — one global, one that travels across the world
          //    — move the CENTRE of the band a few centimetres up and down, so
          //    the edge advances and retreats along the whole shore instead of
          //    every metre of it pulsing together.
          '    float sSur = sin(uGrainT * 0.63) * 0.055',
          '              + sin(uGrainT * 0.29 + vGrainW.x * 0.058 + vGrainW.z * 0.041) * 0.075;',
          '    float sBand = 1.0 - smoothstep(0.0, ' + shoreBand.toFixed(4) + ', abs(sd - sSur));',
          // SQUARED, so the band has a soft shoulder and a bright middle. A
          // linear ramp over a third of a metre reads as a gradient, and foam
          // is not a gradient.
          '    sBand *= sBand;',
          // ...AND IT DIES WHEN IT STOPS BEING RESOLVABLE. `fwidth(sd)` is how
          // many metres of height one pixel covers here, which on a shelving
          // beach is millimetres and on a sea wall a hundred metres off is more
          // than the band is tall. Past that there is nothing honest left to
          // draw and a sub-pixel band does not shimmer, it crawls — the
          // sparkle's own lesson, one field over.
          //
          // 0.55, NOT 1.0, AND THE FIRST BUILD USED 1.0 AND WAS WRONG. A fade
          // that reaches nothing the moment one pixel covers one band is a fade
          // that switches the effect OFF at the range you actually look at a
          // coastline from: measured in Antarctica, where the beach falls at
          // about one in one-and-a-half, the shoreline twenty metres from the
          // lens has fwidth(sd) ≈ 0.18 against a 0.22 band, and the lace was
          // simply GONE in the wide shot and present in the close one. It goes
          // out over 1.8 bands instead, so a distant shore keeps a dim
          // continuous line — which is what distant foam is — and only stops
          // when there is genuinely nothing left.
          '    sBand *= clamp(1.0 - fwidth(sd) * ' + (0.55 / shoreBand).toFixed(4) + ', 0.0, 1.0);',
          '    vec2 slq = vGrainW.xz * ' + shoreScale.toFixed(4) +
            ' + vec2(uGrainT * 0.11, uGrainT * -0.07);',
          // WARPED, AND ROTATED, AND BOTH FOR THE REASON THE NEAR OCTAVE IS.
          // Value noise sits on a square lattice and smoothstep has zero
          // derivative at a cell boundary, so a THRESHOLDED field of it does
          // not read as foam, it reads as a quilt: photographed on the black
          // sand at Reynisfjara the first build was a row of white rectangles
          // a metre across, which is the same failure the Botanic Gardens had
          // at `near` 0.36. `gn` is already computed a few lines up and is
          // free; it bends the whole lattice into slow curves. The second
          // octave is then turned a radian as well, so it shares no boundary
          // anywhere with the first.
          '    slq += gn * 2.2;',
          '    vec2 slq2 = vec2(slq.x * 0.5403 - slq.y * 0.8415,',
          '                     slq.x * 0.8415 + slq.y * 0.5403) * 2.31 + 5.71;',
          '    float sln = grNoise(slq) * 0.62 + grNoise(slq2) * 0.38;',
          // A NARROW RAMP, for the sparkle's reason: foam is a thresholded
          // thing with holes in it, and a wide ramp turns it into a wash.
          '    float sLace = smoothstep(0.46, 0.68, sln) * sBand;',
          '    sLace *= clamp(1.0 - max(fwidth(slq.x), fwidth(slq.y)) * 0.30, 0.0, 1.0);',
          '    diffuseColor.rgb += sLace * ' + shore.toFixed(4) +
            ' * vec3(' + shc.r.toFixed(4) + ', ' + shc.g.toFixed(4) + ', ' + shc.b.toFixed(4) + ');',
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
        cont > 0 ? [
          // ---- CONTACT ---------------------------------------------------
          // LAST IN THE BLOCK, AND THAT IS THE ONE ORDERING DECISION HERE.
          // It multiplies AFTER the wet sheen has been added, so a contact ring
          // on wet asphalt attenuates the highlight as well as the diffuse —
          // which is what occlusion does, and what a ring drawn before the
          // sheen would fail to do in exactly the chapter (Mong Kok in the
          // rain) where it is most visible.
          //
          // AND IT MULTIPLIES diffuseColor, NOT outgoingLight. The rim is ADDED
          // to outgoing light on purpose: a rim is light. This is the opposite
          // — it is light that never arrived — so it belongs on the albedo,
          // where the sun's own shading then acts on it. Added to outgoing
          // light instead, a patch would survive into shadow at full strength
          // and read as paint on the floor.
          '  if (uCtcOn > 0.5) {',
          '    float cOcc = 0.0;',
          '    for (int ci = 0; ci < ' + _CONTACT_N + '; ci++) {',
          '      vec4 cp = uCtcP[ci];',
          '      float cr = cp.w;',
          '      float cd = length(vGrainW.xz - cp.xz);',
          // A FLAT CORE OUT TO 0.45 OF THE FOOTPRINT, then a smooth fall to
          // nothing at the rim — and the 0.45 is the second half of the lesson
          // sysCTC_SPREAD carries. The patch is 1.9x the object's half-width,
          // so the object's own silhouette ends at roughly 0.53 of the radius:
          // everything inside that is hidden underneath the thing and every
          // bit of strength spent there is spent where nobody can see it. A
          // core that runs out to just short of the silhouette puts nearly the
          // whole term in the ring that actually reads. At 0.18 the visible
          // edge got 61 % of the strength; at 0.45 it gets 94 %.
          '      float cf = 1.0 - smoothstep(cr * 0.45, cr, cd);',
          // THE VERTICAL GATE, IN ABSOLUTE METRES. See _contactRISE0/1: a gate
          // expressed in radii would let a market stall on a terrace reach
          // further down than a bin on the same terrace, which is nonsense.
          '      cf *= 1.0 - smoothstep(' + _contactRISE0.toFixed(3) + ', ' +
                                           _contactRISE1.toFixed(3) + ', abs(vGrainW.y - cp.y));',
          // MAX, NOT SUM. Two tourists standing together are two patches, not a
          // hole in the pavement, and a sum is how every naive version of this
          // ends up with black wherever a crowd forms.
          '      cOcc = max(cOcc, cf * uCtcK[ci]);',
          '    }',
          '    diffuseColor.rgb *= 1.0 - cOcc * ' + (cont * _contactMAX).toFixed(4) + ';',
          '  }',
        ].join('\n') : '',
        '}',
      ].join('\n'));
    // LAST, and it has to BE last: _rimInject anchors on '#include <common>'
    // and on '#include <opaque_fragment>', and grain's own replacements above
    // keep the '#include <common>' text at the head of what they substitute —
    // so running it here finds both anchors, and running it first would leave
    // grain with nothing left to match.
    if (rimHere) _rimInject(shader);
  };
  // Without this three shares one compiled program between the grained and the
  // ungrained variant of the same material config, and which one you get
  // depends on draw order.
  g.customProgramCacheKey = function () { return 'grain' + key + (rimHere ? '|r' : ''); };
  // FOR THE AUDIT, AND FOR THE REASON rimInfo() EXISTS. A material whose shore
  // option was dropped on the way through a clone still DRAWS — it is simply
  // the one thing on the coastline with no waterline on it, which is not
  // something a frame-mean metric can see. This is how `qa/d5-shore.js` tells
  // "this chapter is wired" from "this chapter looks about right".
  if (!g.userData) g.userData = {};
  g.userData.grainShore = shore;
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
// AND IT MUST NOT WRITE INTO THE OPTIONS OBJECT IT IS GIVEN.
//
// Every one of these chapters fires its cues through ONE shared, mutated
// options object — `manSfx`, `panSfx`, `sysSpatial` — reused for the life of
// the page precisely so that a sound in an update loop allocates nothing.
// Writing `at` into that object would leave it there, and the next forty mono
// calls that only set volume and pitch would inherit a position from whatever
// last happened to be placed. That is the shared-cache bug this codebase has
// already paid for twice (mat() keyed by colour, grain() keyed by uuid), and
// it would be silent: a gull would simply start coming from a wave.
//
// So the fields are COPIED into one dedicated object and the caller’s is left
// exactly as it was. sfx() reads it synchronously, so one is enough — the same
// reason `manSfx` itself is one object.
const sharedPlaced = { volume: 1, pitch: 1, at: { x: 0, y: 0, z: 0 }, near: 0, far: 0,
                       force: false, ui: false, streak: undefined, wet: undefined };
export function placeCue(o, x, y, z, far) {
  const src = o || {};
  if (!(x === x && z === z)) return src;   // NaN in, mono out — never a throw
  const p = sharedPlaced;
  p.volume = src.volume !== undefined ? src.volume : 1;
  p.pitch  = src.pitch  !== undefined ? src.pitch  : 1;
  p.force  = !!src.force;
  p.ui     = !!src.ui;
  p.streak = src.streak;
  p.wet    = src.wet;
  p.at.x = x; p.at.y = y || 0; p.at.z = z;
  const f = far > 0 ? far : 120;
  p.near = f;
  p.far = f + 46;
  return p;
}

// ===========================================================================
// THE EXIT BOARD — THE DOOR, AS AN OBJECT (D6)
//
// Every chapter has exactly one way out of it. `CHAPTERS.way` has carried the
// SENTENCE describing that door since the departures board was built, and D6's
// first session put a mark for it on the chart and an arrow on the paper — so
// by the end of it the exit existed in three places, all of them ON THE GLASS.
// In the WORLD it was an empty patch of jetty, or of crater rim, or of sand
// between two flags, indistinguishable from the forty metres either side of it.
// Nineteen chapters of hand-built scenery and the single most important object
// in each of them was drawn by the HUD.
//
// So: a board. It stands at the door, it is the thing the arrow points at, and
// three wheeks in front of it opens the card that IS it — see sysBoard* in
// systems.js for the camera move that ties the two together.
//
// FOUR THINGS IT IS DELIBERATELY NOT:
//
//  - It is not a switch. Nothing is gated on touching it, reading it or even
//    finding it; the exit zone is exactly where it always was and the board
//    stands BESIDE that zone rather than in it. A player who never looks at one
//    loses nothing at all.
//  - It is not a sign with words on it. This game has no text in the world and
//    is not about to grow a font atlas: it is a DEPARTURES BOARD, six rows of
//    split-flap tiles with a colour chip at the head of each, and the colour is
//    the destination's own — `sysMARKS[biome].tint`, the same wash that backs
//    that chapter's tile on the picker. Somebody who has been to Venice knows
//    the colour of the Venice row before they can read anything.
//  - It is not nineteen models. One builder, three MOUNTS — a pair of posts, a
//    stone stele, a hanging beam — and a per-chapter dressing, because a timber
//    noticeboard on the rim of an active volcano is a joke and a carved stone
//    marker at the head of a Hong Kong ferry pier is a different one.
//  - It is not a moving thing that demands attention. See tick(): one tile
//    turns over about every 2.4 s, only while somebody is near enough to see
//    it, never under calm, and it makes no noise of its own — the clack is
//    systems.js's, rationed and placed. That is rule 1 of the ambient movers.
//
// FOUR DRAW CALLS, whatever the dressing: the mount, the frame and the face are
// one merged mesh; the flaps are one InstancedMesh of `rows * BOARD_FLAPS`; the
// chips are another; and the lamp, where a chapter is dark enough to need one,
// is the fourth.
// ===========================================================================
export const BOARD_ROWS  = 6;     // destinations shown. Six fits 1.06 m of face.
export const BOARD_FLAPS = 5;     // tiles per row — a time, at a glance
const _BD_PANEL_H = 1.46;         // m, the face
const _BD_PANEL_W = 2.60;         // m, before o.w
const _BD_FLIP    = 0.26;         // s a tile takes to turn over
const _BD_EVERY   = 2.40;         // s between turns, on average
const _BD_JITTER  = 1.60;         // s of scatter on that, so it is not a metronome
// The two tones a tile alternates between. A row for a chapter you have
// finished flips between the paper white and the gold; one for a chapter you
// have not flips between two slates, so a board read at a glance says how much
// of the journey is behind you without saying anything at all.
const _BD_LIT_A   = 0xfaf6ec;
const _BD_LIT_B   = 0xe0b64f;
// ...AND THE DIM PAIR IS NOT NEARLY AS DIM AS IT WANTS TO BE. At 0x4a4a48 on
// a 0x2f2a24 face the rows had almost no contrast against the board, and since
// a fresh save has nothing finished, EVERY row on EVERY board was dim: the
// nineteen photographs came back with a black rectangle in a frame on a post
// in fourteen of them. A split-flap board that is off is still a grid of pale
// tiles; it is the CHARACTERS that are dark.
const _BD_DIM_A   = 0x8b867c;
const _BD_DIM_B   = 0x6d685e;

const _bBox = new THREE.BoxGeometry(1, 1, 1);
const _bM4  = new THREE.Matrix4();
const _bQ   = new THREE.Quaternion();
const _bE   = new THREE.Euler();
const _bP   = new THREE.Vector3();
const _bS   = new THREE.Vector3();

// The twentieth copy of this merger in the repo, and the first one in shared.js.
// It is here rather than in a chapter because the board belongs to no chapter.
function _bMerger() {
  const pos = [], nor = [], col = [], idx = [];
  const c = new THREE.Color();
  const M = {
    n: 0,
    add(geo, color) {
      const g = geo.clone();
      g.applyMatrix4(_bM4);
      const p = g.attributes.position.array, nm = g.attributes.normal.array;
      c.set(color);
      const start = M.n;
      for (let i = 0; i < p.length; i += 3) {
        pos.push(p[i], p[i + 1], p[i + 2]);
        nor.push(nm[i], nm[i + 1], nm[i + 2]);
        col.push(c.r, c.g, c.b);
      }
      const vc = p.length / 3;
      if (g.index) {
        const ia = g.index.array;
        for (let i = 0; i < ia.length; i++) idx.push(start + ia[i]);
      } else {
        for (let i = 0; i < vc; i++) idx.push(start + i);
      }
      M.n += vc;
      g.dispose();
    },
    box(x, y, z, w, h, d, color, rx, ry, rz) {
      _bE.set(rx || 0, ry || 0, rz || 0);
      _bM4.compose(_bP.set(x, y, z), _bQ.setFromEuler(_bE), _bS.set(w, h, d));
      M.add(_bBox, color);
    },
    build() {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.setIndex(idx);
      g.computeBoundingSphere();
      return g;
    }
  };
  return M;
}

// ===========================================================================
// SOMETHING ON A STRING — hangThing().
//
// The five shapes the pendulum in props.js is given to swing (see THINGS THAT
// HANG). One builder, one merged geometry per call, one draw call each, and
// the CONTRACT IS THE ORIGIN: everything is built hanging in local -Y from
// (0, 0, 0), because props.js writes rotation.x/z on the group it is handed
// and a pendulum whose pivot is not its origin swings like a thrown brick.
//
// There is no rope drawn above y = 0 either: whatever the caller hangs this
// from is already there and a second cord over the top of it is z-fighting.
//
// Five shapes, and they are five because that is how many kinds of hanging
// thing there turn out to be in nineteen places: something that rings,
// something that glows, something that says a word, a row of small things on a
// line, and a piece of cloth that shows you the wind. Anything else is one of
// those with a different colour on it.
export const HANG_KINDS = ['chime', 'lantern', 'sign', 'strand', 'sock'];

/**
 * @param kind one of HANG_KINDS
 * @param o    { a, b, c, len }  three colours and how far down it reaches.
 *             `a` is the body, `b` the trim, `c` the cord/fittings.
 * @returns    a Group with ONE child mesh, origin at the pivot.
 */
export function hangThing(kind, o) {
  const a = (o && o.a) || PALETTE.wood;
  const b = (o && o.b) || PALETTE.gold;
  const c = (o && o.c) || PALETTE.woodDark;
  const len = (o && o.len > 0.15) ? o.len : 0.55;
  const M = _bMerger();
  const cord = 0.028;
  if (kind === 'chime') {
    // A cap, and five tubes of four different lengths under it. The odd count
    // and the uneven lengths are the whole of why it reads as a chime and not
    // as a bundle of dowel.
    const drop = len * 0.30;
    M.box(0, -drop * 0.5, 0, cord, drop, cord, c);
    M.box(0, -drop, 0, 0.20, 0.035, 0.20, b);
    const tn = 5;
    for (let i = 0; i < tn; i++) {
      const ang = (i / tn) * 6.283185;
      const rr = 0.075;
      const tl = len * (0.44 + ((i * 3) % 4) * 0.09);
      M.box(Math.cos(ang) * rr, -drop - tl * 0.5 - 0.02, Math.sin(ang) * rr,
            0.032, tl, 0.032, i % 2 ? b : a);
    }
    // the sail, which is what a chime actually catches the air with
    M.box(0, -len * 0.94, 0, 0.14, 0.16, 0.012, a);
  } else if (kind === 'lantern') {
    const drop = len * 0.16;
    const h = len * 0.62;
    M.box(0, -drop * 0.5, 0, cord, drop, cord, c);
    M.box(0, -drop - 0.02, 0, 0.20, 0.05, 0.20, c);            // the cap
    // Four ribs and a belly: an octagon costs eight boxes and reads no
    // better than four at the six metres this game is played at.
    M.box(0, -drop - h * 0.5 - 0.04, 0, 0.26, h, 0.26, a);
    M.box(0, -drop - h * 0.5 - 0.04, 0, 0.28, h * 0.24, 0.28, b);
    M.box(0, -drop - h - 0.06, 0, 0.16, 0.04, 0.16, c);        // the base
    const tas = len - drop - h - 0.10;
    if (tas > 0.04) M.box(0, -drop - h - 0.08 - tas * 0.5, 0, 0.05, tas, 0.05, b);
  } else if (kind === 'sign') {
    // Two short chains and a board, hung EDGE ON to its own swing: a shop sign
    // is a plate and the whole point of one is that it turns.
    const drop = len * 0.22;
    for (let s = -1; s <= 1; s += 2) {
      M.box(s * 0.16, -drop * 0.5, 0, cord, drop, cord, c);
    }
    const h = len - drop - 0.02;
    M.box(0, -drop - h * 0.5, 0, 0.46, h, 0.05, a);
    M.box(0, -drop - h * 0.5, 0.032, 0.40, h * 0.72, 0.012, b);
    M.box(0, -drop - 0.02, 0, 0.50, 0.04, 0.07, c);
  } else if (kind === 'sock') {
    // A pennant: a sleeve that gets narrower, with a band round the mouth. It
    // hangs limp and lifts on the swing, which is the honest way to draw a
    // windsock without a cloth simulation.
    const drop = len * 0.12;
    M.box(0, -drop * 0.5, 0, cord, drop, cord, c);
    M.box(0, -drop - 0.03, 0, 0.20, 0.05, 0.20, c);
    const seg = 4;
    const sl = (len - drop - 0.06) / seg;
    for (let i = 0; i < seg; i++) {
      const w = 0.19 - i * 0.035;
      M.box(0, -drop - 0.06 - sl * (i + 0.5), 0, w, sl * 0.98, w, i % 2 ? a : b);
    }
  } else {
    // 'strand' — a row of small things on a line, and the one kind that is
    // built to be walked through: it reaches nearly the whole way down.
    const n = 7;
    const step = len / (n + 0.6);
    M.box(0, -0.02, 0, cord * 1.4, 0.05, cord * 1.4, c);
    for (let i = 0; i < n; i++) {
      const y = -0.06 - step * i;
      const w = 0.075 - (i % 3) * 0.012;
      M.box(0, y - step * 0.5, 0, cord, step, cord, c);
      M.box(0, y - step, 0, w, w * 0.9, w * 0.55, i % 3 === 1 ? b : a);
    }
  }
  const g = M.build();
  const mesh = new THREE.Mesh(g, mat(0xffffff, { vertexColors: true }));
  mesh.castShadow = true;
  mesh.receiveShadow = false;
  // THE YAW GOES ON THE CHILD, not on the group. props.js writes rotation.x and
  // rotation.z on the group to swing it, and a yaw on that same object would
  // put those two angles in the object's own turned frame — so a sign facing
  // north-east would swing north-east, which is not what a thing on a string
  // does. One node of indirection, and the two rotations cannot interfere.
  mesh.rotation.y = (o && o.yaw) || 0;
  const grp = new THREE.Group();
  grp.add(mesh);
  return grp;
}


/**
 * BUILD ONE. Local space: the face looks down +Z and the foot sits at y = 0, so
 * the caller places it with position and rotation.y and nothing else.
 *
 *   style   'post' | 'stele' | 'hang' — the mount
 *   w       face width, default 2.60
 *   wood    the mount's own colour, and the frame's
 *   woodDk  its shadow side
 *   face    the board face — dark, in every dressing, because that is what
 *           makes a pale flap read as a character rather than as a tile
 *   trim    the header strip
 *   lamp    a colour, or nothing: a hooded strip over the face, over-white so
 *           it survives to the bright pass (see EMIT_OVER)
 *   mat     the material to draw the merged part with. The CALLER's, so the
 *           board picks up the chapter's own grain, shore and wet terms.
 *   chips   BOARD_ROWS colours, head of each row
 *   lit     BOARD_ROWS booleans — is that chapter finished
 */
export function exitBoard(o) {
  const opt = o || {};
  const style = opt.style === 'stele' ? 'stele' : opt.style === 'hang' ? 'hang' : 'post';
  const W = opt.w > 0 ? opt.w : _BD_PANEL_W;
  const H = _BD_PANEL_H;
  const wood = opt.wood !== undefined ? opt.wood : PALETTE.wood;
  const woodDk = opt.woodDk !== undefined ? opt.woodDk : PALETTE.woodDark;
  const face = opt.face !== undefined ? opt.face : 0x2f2a24;
  const trim = opt.trim !== undefined ? opt.trim : PALETTE.gold;
  const group = new THREE.Group();
  const S = _bMerger();

  // ---- the mount ---------------------------------------------------------
  // PB is where the face begins. A stele holds it low and a hanging beam holds
  // it high, which is most of what makes the three read as different objects.
  // ...AND ONE DOOR IN THE GAME HAS A ROOF OVER IT. Sydney's exit zone is the
  // footprint of the wharf shelter, so the board has to fit UNDER a 2.7 m
  // soffit — which is where a ferry timetable actually lives. `pb` drops the
  // face and `hood: false` takes off the pitched cap it does not need indoors.
  const PB = typeof opt.pb === 'number' ? opt.pb
           : style === 'stele' ? 0.95 : style === 'hang' ? 1.30 : 1.05;
  const hood = opt.hood !== false;
  const px = W * 0.5 - 0.14;
  if (style === 'stele') {
    // A cut block, tapered, on a plinth: the shape a marker takes in a place
    // that has no timber in it — a crater rim, a piazza, a plain of tuff.
    S.box(0, 0.11, 0, W * 0.86, 0.22, 0.72, woodDk);
    S.box(0, PB * 0.5 + 0.10, 0, W * 0.70, PB - 0.10, 0.52, wood);
    S.box(0, PB + H + 0.20, 0, W + 0.30, 0.20, 0.60, woodDk);
  } else {
    const top = PB + H + (style === 'hang' ? 0.55 : 0.16);
    for (let s = -1; s <= 1; s += 2) {
      S.box(s * px, top * 0.5, 0, 0.15, top, 0.15, wood);
      S.box(s * px, 0.09, 0, 0.30, 0.18, 0.30, woodDk);
    }
    if (style === 'hang') {
      // the beam, and the two links the board swings from
      S.box(0, top - 0.09, 0, W + 0.60, 0.18, 0.18, woodDk);
      for (let s = -1; s <= 1; s += 2) {
        S.box(s * (W * 0.32), PB + H + 0.30, 0, 0.07, 0.44, 0.07, PALETTE.metal);
      }
    } else if (hood) {
      // a pitched hood, because everything else in this game that faces the
      // weather has one and a flat-topped board photographs as a slab
      for (let e = -1; e <= 1; e += 2) {
        S.box(0, PB + H + 0.26, e * 0.16, W + 0.36, 0.09, 0.42, woodDk, e * 0.42, 0, 0);
      }
    }
  }

  // ---- the frame, the face, the header ------------------------------------
  const cy = PB + H * 0.5;
  S.box(0, cy, 0, W + 0.16, H + 0.16, 0.12, wood);
  S.box(0, cy, 0.068, W, H, 0.03, face);
  S.box(0, PB + H - 0.15, 0.088, W - 0.14, 0.20, 0.02, trim);
  // three marks on the header, in the postcards' dialect: a chevron pointing
  // the way out, and two rules. It says "onward" and does not say it in words.
  const hy = PB + H - 0.15;
  S.box(-W * 0.5 + 0.30, hy, 0.102, 0.11, 0.11, 0.02, face, 0, 0, Math.PI * 0.25);
  S.box(W * 0.5 - 0.46, hy, 0.102, 0.44, 0.035, 0.02, face);
  S.box(W * 0.5 - 0.46, hy - 0.07, 0.102, 0.30, 0.035, 0.02, face);

  const solid = new THREE.Mesh(S.build(), opt.mat || mat(0xffffff, { vertexColors: true }));
  solid.castShadow = true;
  solid.receiveShadow = true;
  group.add(solid);

  // ---- the rows ------------------------------------------------------------
  // Top row at the top of the face, under the header, reading down: the order
  // is the journey's, so the row nearest the header is the next place.
  const rowTop = PB + H - 0.38;
  const rowPitch = 0.1766;
  const chipX = -W * 0.5 + 0.20;
  const flapX0 = -W * 0.5 + 0.61;
  const flapStep = (W - 0.86) / (BOARD_FLAPS - 1);

  const chipGeo = new THREE.BoxGeometry(0.15, 0.125, 0.03);
  const chips = new THREE.InstancedMesh(chipGeo, opt.mat || mat(0xffffff, { vertexColors: true }),
                                        BOARD_ROWS);
  chips.castShadow = false;
  chips.receiveShadow = true;
  const flapGeo = new THREE.BoxGeometry(flapStep - 0.06, 0.125, 0.025);
  const flaps = new THREE.InstancedMesh(flapGeo, opt.mat || mat(0xffffff, { vertexColors: true }),
                                        BOARD_ROWS * BOARD_FLAPS);
  flaps.castShadow = false;
  flaps.receiveShadow = true;
  // Neither pool is ever frustum-culled on its own bounds: an InstancedMesh
  // computes them from the geometry and not from the instances, so a board seen
  // edge-on from twenty metres pops its own tiles out.
  chips.frustumCulled = false;
  flaps.frustumCulled = false;

  const fx = new Float32Array(BOARD_ROWS * BOARD_FLAPS);
  const fy = new Float32Array(BOARD_ROWS * BOARD_FLAPS);
  const col = new THREE.Color();
  const ident = new THREE.Matrix4();
  for (let r = 0; r < BOARD_ROWS; r++) {
    const y = rowTop - r * rowPitch;
    ident.makeTranslation(chipX, y, 0.10);
    chips.setMatrixAt(r, ident);
    chips.setColorAt(r, col.set(0x808080));
    for (let k = 0; k < BOARD_FLAPS; k++) {
      const i = r * BOARD_FLAPS + k;
      fx[i] = flapX0 + k * flapStep;
      fy[i] = y;
      ident.makeTranslation(fx[i], fy[i], 0.10);
      flaps.setMatrixAt(i, ident);
      flaps.setColorAt(i, col.set(_BD_DIM_A));
    }
  }
  chips.instanceMatrix.needsUpdate = true;
  flaps.instanceMatrix.needsUpdate = true;
  group.add(chips);
  group.add(flaps);

  // ---- the lamp -------------------------------------------------------------
  let lamp = null;
  if (opt.lamp !== undefined && opt.lamp !== null) {
    const lm = matEmit(opt.lamp, 1);
    lamp = new THREE.Mesh(new THREE.BoxGeometry(W - 0.30, 0.07, 0.10), lm);
    lamp.position.set(0, PB + H + 0.04, 0.22);
    lamp.castShadow = false;
    lamp.receiveShadow = false;
    group.add(lamp);
  }

  // ---- the turning over ------------------------------------------------------
  const tone = new Uint8Array(BOARD_ROWS * BOARD_FLAPS);   // which of the pair
  const litRow = new Uint8Array(BOARD_ROWS);
  let flipI = -1, flipT = 0, flipNext = _BD_EVERY * 0.5, flipHalf = false;
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const one = new THREE.Vector3(1, 1, 1);
  const at = new THREE.Vector3();

  function paint(i) {
    const r = (i / BOARD_FLAPS) | 0;
    const a = litRow[r] ? _BD_LIT_A : _BD_DIM_A;
    const b = litRow[r] ? _BD_LIT_B : _BD_DIM_B;
    flaps.setColorAt(i, col.set(tone[i] ? b : a));
    if (flaps.instanceColor) flaps.instanceColor.needsUpdate = true;
  }

  /**
   * `chipColors` and `done` are both BOARD_ROWS long. Called on build and again
   * whenever the journey moves under a board that is already standing.
   */
  function sync(chipColors, done) {
    for (let r = 0; r < BOARD_ROWS; r++) {
      chips.setColorAt(r, col.set(chipColors && chipColors[r] !== undefined
                                  ? chipColors[r] : 0x807a70));
      litRow[r] = done && done[r] ? 1 : 0;
    }
    if (chips.instanceColor) chips.instanceColor.needsUpdate = true;
    for (let i = 0; i < BOARD_ROWS * BOARD_FLAPS; i++) {
      // A deterministic scatter, not Math.random: a board rebuilt on a return
      // visit that dealt itself a different pattern would read as a different
      // object standing in the same place.
      tone[i] = ((i * 7 + ((i / BOARD_FLAPS) | 0) * 3) % 5) < 2 ? 1 : 0;
      paint(i);
    }
  }

  /**
   * `near` is the caller's answer to "is anybody close enough for this to be
   * worth a matrix write", and it is the whole cost control: away from the
   * door this does nothing but count down a float.
   */
  function tick(dt, near) {
    if (flipI >= 0) {
      flipT += dt;
      const u = flipT / _BD_FLIP;
      if (!flipHalf && u >= 0.5) {
        // The tile changes at the moment it is edge-on, which is the only
        // moment the change cannot be seen. That is what a split-flap does.
        flipHalf = true;
        tone[flipI] = tone[flipI] ? 0 : 1;
        paint(flipI);
      }
      const a = u >= 1 ? 0 : Math.PI * (u < 0.5 ? u * 2 : 2 - u * 2);
      e.set(-a, 0, 0);
      m4.compose(at.set(fx[flipI], fy[flipI], 0.10), q.setFromEuler(e), one);
      flaps.setMatrixAt(flipI, m4);
      flaps.instanceMatrix.needsUpdate = true;
      if (u >= 1) { flipI = -1; flipT = 0; flipHalf = false; }
      return -1;
    }
    if (!near || calmOn()) return -1;
    flipNext -= dt;
    if (flipNext > 0) return -1;
    flipNext = _BD_EVERY + Math.random() * _BD_JITTER;
    flipI = (Math.random() * BOARD_ROWS * BOARD_FLAPS) | 0;
    flipT = 0; flipHalf = false;
    return flipI;                       // the caller rations the clack
  }

  function dispose() {
    solid.geometry.dispose();
    chipGeo.dispose();
    flapGeo.dispose();
    chips.dispose();
    flaps.dispose();
    if (lamp) lamp.geometry.dispose();
  }

  sync(null, null);
  return {
    group, sync, tick, dispose,
    /** local y of the middle of the face — what a camera should be looking at */
    faceY: cy,
    /** local y of the top of the whole object, mount included */
    topY: PB + H + (style === 'stele' ? 0.30 : style === 'hang' ? 0.85 : hood ? 0.36 : 0.16),
    /** half-extents of the one collider this is worth giving, in local axes */
    hx: W * 0.5 + 0.10, hz: 0.30
  };
}


// ===========================================================================
// LESS MOTION, AND ONE PLACE THAT KNOWS (R4)
//
// THREE MODULES HAD THREE COPIES OF THE SAME MEDIA QUERY. systems.js read it
// into `sysCalmMotion`, the minimap read it AGAIN into its own `mapCalm`, and
// weather.js read it a third time into `wxCalm` — all three as module consts,
// resolved at load. That was tolerable while the only writer was the operating
// system and the answer could never change; the moment R4 put a switch on the
// pause card it became the classic shape this codebase has paid for before
// (see the reference-frames note): a setting that moves four of the five things
// it names and silently leaves the fifth — here, two hundred tumbling petals
// and a pulsing ring in the corner — running at full tilt.
//
// One channel. `calmSysNow` is what the machine asks for, kept up to date.
// `calmPref` is what the player asked for, and `null` — the default — means
// "whatever the machine said", which is bit-for-bit the behaviour every one of
// those three consts had. Everything decorative that loops for ever, and
// everything that stops time, calls calmOn().
// ===========================================================================
// ---- ...AND THE MACHINE IS ALLOWED TO CHANGE ITS MIND (P2) ---------------
// `calmSys` was a const read once at load, so a player who turns reduced-motion
// on in the OS while the game is open got nothing until they reloaded — and the
// place they are most likely to do that is halfway through the chapter that
// made them want it. `matchMedia` fires `change` for exactly this; it is two
// lines and it costs nothing when nobody ever touches the setting.
//
// `calmSysNow` and not a reassigned export: a live binding that other modules
// read through `calmOn()` is the whole point of there being one channel, and
// nothing outside this file has ever needed the raw system answer.
let calmSysNow = !!(typeof window !== 'undefined' && window.matchMedia &&
                    window.matchMedia('(prefers-reduced-motion: reduce)').matches);
try {
  if (typeof window !== 'undefined' && window.matchMedia) {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onCalm = function (e) { calmSysNow = !!e.matches; };
    if (mq.addEventListener) mq.addEventListener('change', onCalm);
    else if (mq.addListener) mq.addListener(onCalm);      // Safari < 14
  }
} catch (e) { /* a browser with no matchMedia at all keeps the boot answer */ }
let calmPref = null;
export function calmOn() { return calmPref === null ? calmSysNow : !!calmPref; }
/** null follows the system; true/false override it. Returns the live answer. */
export function calmSet(v) {
  calmPref = (v === null || v === undefined) ? null : !!v;
  return calmOn();
}
/** What the player chose, NOT what is in force — the switch's own state. */
export function calmPreference() { return calmPref; }
