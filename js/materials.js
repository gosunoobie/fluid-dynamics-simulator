/** Material IDs and shared classification. Load before the engine and renderer. */
(function (namespace) {
  "use strict";

  const IDs = Object.freeze({
    AIR: 0,
    SAND: 1,
    STONE: 2,
    WATER: 3,
    LAVA: 4,
    SMOKE: 5,
    WOOD: 6,
    FIRE: 7,
    ACID: 8,
    STEAM: 9,
    OIL: 10,
    GUNPOWDER: 11,
    DEBRIS: 12,
    ICE: 13,
    SNOW: 14,
    METAL: 15,
    ASH: 16,
    CHARCOAL: 17,
    EXPLOSION: -1,
  });
  const {
    AIR,
    SAND,
    STONE,
    WATER,
    LAVA,
    SMOKE,
    WOOD,
    FIRE,
    ACID,
    STEAM,
    OIL,
    GUNPOWDER,
    DEBRIS,
    ICE,
    SNOW,
    METAL,
    ASH,
    CHARCOAL,
    EXPLOSION,
  } = IDs;
  const names = [
    "Eraser",
    "Sand",
    "Stone",
    "Water",
    "Lava",
    "Smoke",
    "Wood",
    "Fire",
    "Acid",
    "Steam",
    "Oil",
    "Gunpowder",
    "Debris",
    "Ice",
    "Snow",
    "Metal",
    "Ash",
    "Charcoal",
  ];
  const descriptions = [
    "removes any material",
    "accelerates, piles up, and sinks through water",
    "solid, textured rock",
    "accelerates, splashes, and extinguishes fire",
    "flows slowly and ignites fuel",
    "rises and fades away",
    "burns and chars into charcoal",
    "ignites wood, charcoal, oil, and gunpowder",
    "splashes and dissolves solids",
    "rises and fades away",
    "floats on water and burns",
    "falls into piles and ignites in chain reactions",
    "falls after a blast",
    "solid and brittle; melts with heat or slowly in water",
    "falls softly, piles up, and melts in water or heat",
    "stays fixed, conducts heat, and resists blasts; acid corrodes it",
    "falls slowly into piles and does not burn",
    "falls, smolders into ash, and can be quenched with water",
  ];
  const paletteTokens = [
    "--muted",
    "--sand-base",
    "--stone-base",
    "--water-base",
    "--lava-base",
    "--smoke-base",
    "--wood-base",
    "--fire-base",
    "--acid-base",
    "--steam-base",
    "--oil-base",
    "--powder-base",
    "--stone-base",
    "--ice-base",
    "--snow-base",
    "--metal-base",
    "--ash-base",
    "--charcoal-base",
  ];
  const noise = [
    0, 3.1, 5.8, 0.7, 7, 2.1, 4.4, 9, 1.6, 1.2, 1.8, 4.3, 6, 3.5, 1.6, 3, 3,
    3.8,
  ];
  const isGas = (t) => t === SMOKE || t === FIRE || t === STEAM;
  const isPowder = (t) =>
    t === SAND ||
    t === GUNPOWDER ||
    t === DEBRIS ||
    t === SNOW ||
    t === ASH ||
    t === CHARCOAL;
  const isLiquid = (t) => t === WATER || t === LAVA || t === ACID || t === OIL;
  const isMobile = (t) => isPowder(t) || isLiquid(t);
  const isSolid = (t) => t === STONE || t === WOOD || t === ICE || t === METAL;
  const isCold = (t) => t === ICE || t === SNOW;
  const isFuel = (t) => t === WOOD || t === OIL || t === CHARCOAL;

  namespace.Materials = Object.freeze({
    IDs,
    names: Object.freeze(names),
    descriptions: Object.freeze(descriptions),
    paletteTokens: Object.freeze(paletteTokens),
    noise: Object.freeze(noise),
    isGas,
    isPowder,
    isLiquid,
    isMobile,
    isSolid,
    isCold,
    isFuel,
  });
})((globalThis.PixelSandbox = globalThis.PixelSandbox || {}));
