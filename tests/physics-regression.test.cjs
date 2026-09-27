"use strict";
// Behavioral regressions retained while extracting the simulator into modules.
// Physics cases run without a DOM; UI cases exercise production scripts unchanged.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  loadSimulation: load,
  loadApp,
  materialIds,
  positions,
  range,
  steps,
  consistent,
} = require("./helpers.cjs");
test("Blank initial canvas includes all material tools", () => {
  const { a } = load();
  assert.equal(a.counts.length, 18);
  assert.equal(a.counts[a.AIR], a.N);
  assert(a.cells.every((v) => v === 0));
  assert(a.fuse.every((v) => v === 0));
  assert.equal(a.pendingBlasts.length, 0);
  assert.equal(a.blastFlashes.length, 0);
  for (const id of [a.OIL, a.GUNPOWDER, a.EXPLOSION])
    assert(materialIds().includes(id), `tool ${id} exists`);
  consistent(a);
});

test("Oil and water conserve particles and sort in a narrow shaft", () => {
  const { a } = load(512),
    x = 100;
  range(a, x - 1, 30, x - 1, a.H - 1, a.STONE);
  range(a, x + 1, 30, x + 1, a.H - 1, a.STONE);
  a.put(x, a.H - 1, a.STONE);
  range(a, x, 110, x, 129, a.WATER);
  range(a, x, 130, x, a.H - 2, a.OIL);
  const expected = [a.counts[a.WATER], a.counts[a.OIL]];
  steps(a, 450);
  assert.equal(a.counts[a.WATER], expected[0]);
  assert.equal(a.counts[a.OIL], expected[1]);
  const water = positions(a, a.WATER),
    oil = positions(a, a.OIL);
  assert(
    Math.max(...oil.map((p) => p.y)) < Math.min(...water.map((p) => p.y)),
    "oil ends above water",
  );
  consistent(a);
  return {
    water: water.length,
    oil: oil.length,
    oilY: [Math.min(...oil.map((p) => p.y)), Math.max(...oil.map((p) => p.y))],
    waterY: [
      Math.min(...water.map((p) => p.y)),
      Math.max(...water.map((p) => p.y)),
    ],
  };
});

test("Oil catches fire from neighboring flame and carries its burn timer", () => {
  const { a } = load(130);
  a.put(100, 30, a.OIL);
  a.put(101, 30, a.FIRE);
  a.step();
  const oils = positions(a, a.OIL);
  assert.equal(oils.length, 1);
  assert(a.burn[oils[0].i] > 0, "oil ignites next to fire");
  const timer = a.burn[oils[0].i];
  steps(a, 15);
  const later = positions(a, a.OIL);
  assert.equal(later.length, 1);
  assert(later[0].y > 30, "burning oil remains mobile");
  assert(
    a.burn[later[0].i] > 0 && a.burn[later[0].i] < timer,
    "burn timer follows moving oil",
  );
  steps(a, 600);
  assert.equal(a.counts[a.OIL], 0, "oil eventually burns away");
  consistent(a);
  return {
    initialBurn: timer,
  };
});

test("Gunpowder settles without spontaneously igniting", () => {
  const { a } = load(711);
  range(a, 80, 20, 99, 25, a.GUNPOWDER);
  const powder = a.counts[a.GUNPOWDER];
  steps(a, 240);
  assert.equal(a.counts[a.GUNPOWDER], powder);
  assert(a.fuse.every((v) => v === 0));
  assert.equal(a.pendingBlasts.length, 0);
  assert.equal(a.blastFlashes.length, 0);
  assert.equal(a.counts[a.FIRE], 0);
  assert.equal(a.counts[a.SMOKE], 0);
  consistent(a);
  return {
    powder,
  };
});

test("Heated gunpowder ignites a finite chain reaction", () => {
  const { a } = load(410);
  range(a, 85, a.H - 1, 155, a.H - 1, a.STONE);
  range(a, 100, a.H - 7, 139, a.H - 2, a.GUNPOWDER);
  a.put(99, a.H - 3, a.FIRE);
  const powder = a.counts[a.GUNPOWDER];
  a.step();
  assert(
    a.fuse.some((v) => v > 0) || a.pendingBlasts.length > 0,
    "heat arms powder",
  );
  let maxFlashes = a.blastFlashes.length,
    minPowder = powder,
    consumptionFrames = 0;
  for (let t = 0; t < 700; t++) {
    a.step();
    maxFlashes = Math.max(maxFlashes, a.blastFlashes.length);
    if (a.counts[a.GUNPOWDER] < minPowder) {
      consumptionFrames++;
      minPowder = a.counts[a.GUNPOWDER];
    }
    if (t % 50 === 0) consistent(a);
  }
  assert(minPowder < powder, "ignited powder is consumed");
  assert(consumptionFrames >= 2, "powder propagates over multiple frames");
  assert(maxFlashes > 0, "chain produces blast effects");
  assert.equal(a.pendingBlasts.length, 0, "chain queue drains");
  assert(
    a.fuse.every((v) => v === 0),
    "all active fuses complete",
  );
  assert.equal(a.blastFlashes.length, 0, "transient blast effects expire");
  consistent(a);
  return {
    initialPowder: powder,
    remainingPowder: minPowder,
    consumptionFrames,
    maxFlashes,
  };
});

test("Explosion carves rock and wood and imparts finite outward momentum", () => {
  const { a } = load(318);
  range(a, 95, 60, 105, 80, a.STONE);
  range(a, 106, 64, 109, 76, a.WOOD);
  range(a, 111, 65, 114, 75, a.SAND);
  const stone = a.counts[a.STONE],
    wood = a.counts[a.WOOD];
  a.explode(100, 70, 18, 6);
  assert(a.counts[a.STONE] < stone, "blast breaks stone");
  assert(a.counts[a.WOOD] < wood, "blast damages wood");
  assert(a.counts[a.DEBRIS] > 0, "blast leaves mobile debris");
  assert(a.blastFlashes.length > 0, "blast creates a short visual effect");
  const moving =
    Array.from(a.vx).some((v) => Math.abs(v) > 0.01) ||
    Array.from(a.vy).some((v) => Math.abs(v) > 0.01);
  assert(moving, "blast pushes particles");
  const right = positions(a, a.SAND).filter((p) => p.x > 100);
  assert(
    right.some((p) => a.vx[p.i] > 0),
    "sand to the right gets outward horizontal velocity",
  );
  consistent(a);
  steps(a, 100);
  consistent(a);
  return {
    stoneBefore: stone,
    stoneAfter: a.counts[a.STONE],
    woodBefore: wood,
    woodAfter: a.counts[a.WOOD],
  };
});

test("Blast-speed debris, liquids and cold powder cannot tunnel through a thin wall", () => {
  for (const typeName of ["SAND", "WATER", "OIL", "GUNPOWDER", "DEBRIS"]) {
    const { a } = load(719);
    range(a, 120, 0, 120, a.H - 1, a.STONE);
    a.put(111, 70, a[typeName]);
    if (typeName === "GUNPOWDER") {
      a.vx[70 * a.W + 111] = 6;
      a.vy[70 * a.W + 111] = -0.5;
    } else a.explode(99, 70, 18, 6);
    const wall = Array.from(
      {
        length: a.H,
      },
      (_, y) => a.cells[y * a.W + 120],
    );
    assert(
      wall.every((v) => v === a.STONE),
      "wall outside blast radius is untouched",
    );
    for (let t = 0; t < 70; t++) {
      a.step();
      for (const p of positions(a, a[typeName]))
        assert(p.x < 120, `${typeName} crosses wall at ${p.x},${p.y}`);
    }
    assert(
      Array.from(
        {
          length: a.H,
        },
        (_, y) => a.cells[y * a.W + 120],
      ).every((v) => v === a.STONE),
      `${typeName}: wall remains intact`,
    );
    consistent(a);
  }
});

test("Reset clears fuses, blasts and momentum while retaining pause", () => {
  const sim = loadApp(),
    { a, nodes } = sim;
  a.put(10, 10, a.GUNPOWDER);
  a.ignite(10 * a.W + 10);
  a.explode(100, 70);
  a.pendingBlasts.push({
    x: 5,
    y: 5,
    radius: 4,
    power: 1,
  });
  assert(a.fuse.some((v) => v > 0));
  nodes.get("#element-pause").click();
  assert.equal(a.paused, true);
  nodes.get("#element-reset").click();
  for (const field of [
    a.cells,
    a.shade,
    a.life,
    a.burn,
    a.fuse,
    a.melt,
    a.metalHeat,
    a.updated,
    a.born,
    a.vx,
    a.vy,
    a.remX,
    a.remY,
    a.grounded,
  ])
    assert(
      field.every((v) => v === 0),
      "reset clears all cell arrays",
    );
  assert.equal(a.pendingBlasts.length, 0);
  assert.equal(a.blastFlashes.length, 0);
  assert.equal(a.tick, 0);
  assert.equal(a.paused, true);
  assert.equal(a.counts[a.AIR], a.N);
  sim.frame(16);
  sim.frame(64);
  assert.equal(a.tick, 0, "paused rendering does not advance simulation");
  consistent(a);
});

test("New buttons select materials and explosion tool without invalid cells", () => {
  const sim = loadApp(),
    { a, nodes } = sim;
  for (const id of [a.OIL, a.GUNPOWDER, a.EXPLOSION]) {
    nodes.get("material" + id).click();
    assert(!nodes.get("#element-state").textContent.includes("undefined"));
    nodes.get("#element-add").click();
    consistent(a);
  }
  assert(a.counts[a.OIL] > 0);
  assert(a.counts[a.GUNPOWDER] > 0);
  assert(a.blastFlashes.length > 0);
});
function movingPositions(a, type) {
  return positions(a, type).map((p) => ({
    ...p,
    vx: a.vx[p.i],
    vy: a.vy[p.i],
  }));
}
function fallOnly(a, type, frames, label, { expectVertical = false } = {}) {
  let minVy = Infinity,
    maxHorizontal = 0;
  for (let frame = 0; frame < frames; frame++) {
    a.step();
    for (const p of movingPositions(a, type)) {
      assert(p.y < a.H - 5, `${label}: test must remain airborne, y=${p.y}`);
      minVy = Math.min(minVy, p.vy);
      maxHorizontal = Math.max(maxHorizontal, Math.abs(p.vx));
      assert(
        p.vy >= -1e-6,
        `${label}: spurious upward velocity ${p.vy} at frame ${frame}, cell ${p.x},${p.y}`,
      );
      if (expectVertical)
        assert(
          Math.abs(p.vx) < 1e-6,
          `${label}: spurious sideways velocity ${p.vx} at frame ${frame}`,
        );
    }
    consistent(a);
  }
  return {
    minVy,
    maxHorizontal,
  };
}
for (const type of [3, 8, 10]) {
  const name = type === 3 ? "Water" : type === 8 ? "Acid" : "Oil";
  test(`${name}: faster falling particle catches slower particle without rebounding`, () => {
    const { a } = load(301);
    a.put(100, 20, type);
    a.put(100, 22, type);
    a.vy[20 * a.W + 100] = 4;
    a.vy[22 * a.W + 100] = 1;
    return fallOnly(a, type, 12, `${name} falling pair`);
  });
  test(`${name}: initial falling contact does not manufacture sideways motion`, () => {
    const { a } = load(301);
    a.put(100, 20, type);
    a.put(100, 22, type);
    a.vy[20 * a.W + 100] = 4;
    a.vy[22 * a.W + 100] = 1;
    return fallOnly(a, type, 1, `${name} first contact`, {
      expectVertical: true,
    });
  });
  test(`${name}: dense block stays airborne without upward rebounds`, () => {
    const { a } = load(456);
    range(a, 95, 10, 107, 21, type);
    const initial = a.counts[type];
    const report = fallOnly(a, type, 27, `${name} dense block`);
    assert.equal(a.counts[type], initial);
    return report;
  });
  test(`${name}: staggered stream does not rebound in freefall`, () => {
    const { a } = load(792);
    for (let y = 8; y < 50; y += 3) {
      a.put(100, y, type);
      a.vy[y * a.W + 100] = 0.7 + (50 - y) / 14;
    }
    const initial = a.counts[type];
    const report = fallOnly(a, type, 18, `${name} staggered stream`);
    assert.equal(a.counts[type], initial);
    return report;
  });
}
test("Water hitting a fixed floor still splashes", () => {
  const { a } = load(320);
  range(a, 0, 120, a.W - 1, 120, a.STONE);
  a.put(100, 10, a.WATER);
  let splashes = 0,
    maxVx = 0;
  for (let frame = 0; frame < 95; frame++) {
    a.step();
    const p = movingPositions(a, a.WATER)[0];
    assert(p.y < 120);
    if (p.vy < 0) {
      splashes++;
      maxVx = Math.max(maxVx, Math.abs(p.vx));
    }
  }
  assert(splashes > 0);
  assert(maxVx > 0);
  consistent(a);
  return {
    splashes,
    maxVx,
  };
});

test("Water hitting a settled pool still splashes", () => {
  const { a } = load(333);
  range(a, 70, 120, 130, 120, a.STONE);
  range(a, 70, 102, 70, 119, a.STONE);
  range(a, 130, 102, 130, 119, a.STONE);
  range(a, 71, 110, 129, 119, a.WATER);
  steps(a, 35);
  a.put(100, 30, a.WATER);
  a.vy[30 * a.W + 100] = 3;
  let splash = false;
  for (let frame = 0; frame < 35; frame++) {
    a.step();
    if (movingPositions(a, a.WATER).some((p) => p.vy < -0.1)) splash = true;
  }
  assert(splash);
  consistent(a);
  return {
    splash,
  };
});

test("Ice and snow tools paint and render from an initially blank canvas", () => {
  const sim = loadApp(),
    { a, nodes } = sim;
  for (const id of [a.ICE, a.SNOW]) {
    assert(materialIds().includes(id));
    nodes.get("material" + id).click();
    assert(!nodes.get("#element-state").textContent.includes("undefined"));
    nodes.get("#element-add").click();
    assert(a.counts[id] > 0);
    a.draw();
    consistent(a);
    nodes.get("#element-reset").click();
  }
  assert(a.melt.every((v) => v === 0));
  sim.frame(16);
});

test("Ice remains fixed and neither cold material melts without heat", () => {
  const { a } = load(811);
  range(a, 80, 60, 85, 65, a.ICE);
  range(a, 105, 10, 112, 19, a.SNOW);
  const frozen = Array.from(a.cells)
      .map((t, i) => (t === a.ICE ? i : -1))
      .filter((i) => i >= 0),
    ice = a.counts[a.ICE],
    snow = a.counts[a.SNOW];
  steps(a, 450);
  assert.equal(a.counts[a.ICE], ice);
  assert.equal(a.counts[a.SNOW], snow);
  for (const i of frozen)
    assert.equal(a.cells[i], a.ICE, "ice remains at original location");
  assert.equal(a.counts[a.WATER], 0);
  assert.equal(a.counts[a.STEAM], 0);
  assert(
    positions(a, a.SNOW).every((p) => p.y > 100),
    "snow falls to the floor",
  );
  assert(a.melt.every((v) => v === 0));
  consistent(a);
  return {
    ice,
    snow,
  };
});

test("Snow falls slower than sand without spontaneous rebound", () => {
  const { a } = load(812);
  a.put(80, 10, a.SNOW);
  a.put(150, 10, a.SAND);
  for (let t = 0; t < 25; t++) {
    a.step();
    const s = positions(a, a.SNOW)[0];
    assert(a.vy[s.i] >= 0, "falling snow never bounces upward");
    assert.equal(a.vx[s.i], 0, "unforced snow does not gain side momentum");
  }
  const snow = positions(a, a.SNOW)[0],
    sand = positions(a, a.SAND)[0];
  assert(snow.y > 10, "snow falls");
  assert(snow.y < sand.y, "snow falls slower than sand");
  consistent(a);
  return {
    snowY: snow.y,
    sandY: sand.y,
    snowVy: a.vy[snow.i],
  };
});

test("Snow carries partial melt heat while moving and clears it when transformed", () => {
  const { a } = load(813);
  const i = 10 * a.W + 100;
  a.put(100, 10, a.SNOW);
  a.melt[i] = 3;
  steps(a, 30);
  const snow = positions(a, a.SNOW)[0];
  assert(snow.y > 10);
  assert.equal(a.melt[snow.i], 3, "heat follows snow");
  assert.equal(a.melt[i], 0, "old location has no ghost heat");
  a.setCell(snow.i, a.WATER);
  assert.equal(a.melt[snow.i], 0, "phase change clears heat");
  consistent(a);
});

test("Snow stays above a resting water column until it melts", () => {
  const { a } = load(814),
    x = 100;
  range(a, x - 1, 40, x - 1, a.H - 1, a.STONE);
  range(a, x + 1, 40, x + 1, a.H - 1, a.STONE);
  a.put(x, a.H - 1, a.STONE);
  range(a, x, 115, x, a.H - 2, a.WATER);
  a.put(x, 95, a.SNOW);
  const water = a.counts[a.WATER];
  let contact = false;
  for (let t = 0; t < 180; t++) {
    a.step();
    const snow = positions(a, a.SNOW);
    if (snow.length) {
      const top = Math.min(...positions(a, a.WATER).map((p) => p.y));
      assert(snow[0].y < top, "snow cannot sink through the water");
      if (a.melt[snow[0].i] > 0) contact = true;
    }
  }
  assert(contact, "snow contacts water");
  assert.equal(a.counts[a.SNOW], 0, "water melts snow");
  assert.equal(
    a.counts[a.WATER],
    water + 1,
    "melted snow becomes one water pixel",
  );
  consistent(a);
});
function coldPocket(a, type, heatType) {
  const x = 100,
    y = 100;
  a.put(x, y, type);
  a.put(x + 1, y, heatType);
  for (const [dx, dy] of [
    [-1, 0],
    [0, -1],
    [0, 1],
    [1, -1],
    [1, 1],
    [2, 0],
  ])
    a.put(x + dx, y + dy, a.STONE);
  return {
    i: y * a.W + x,
    j: y * a.W + x + 1,
  };
}
test("Water gradually melts ice and melts snow faster with particle conservation", () => {
  let snowMelt = 0,
    iceMelt = 0;
  for (const name of ["SNOW", "ICE"]) {
    const { a } = load(815);
    coldPocket(a, a[name], a.WATER);
    let elapsed = 0;
    while (a.counts[a[name]] && elapsed < 400) {
      a.step();
      elapsed++;
    }
    assert.equal(a.counts[a[name]], 0, `${name} melts in contact with water`);
    assert.equal(a.counts[a.WATER], 2, `${name} converts to one water cell`);
    if (name === "SNOW") snowMelt = elapsed;
    else iceMelt = elapsed;
    consistent(a);
  }
  assert(snowMelt < iceMelt, "snow melts sooner than ice");
  return {
    snowMelt,
    iceMelt,
  };
});

test("Fire is quenched by cold pixels and snow melts faster than ice", () => {
  for (const name of ["SNOW", "ICE"]) {
    const { a } = load(816);
    const { i, j } = coldPocket(a, a[name], a.FIRE);
    a.step();
    assert.equal(a.counts[a.FIRE], 0, "cold extinguishes the adjacent flame");
    if (name === "SNOW")
      assert.equal(a.counts[a.WATER], 1, "one flame melts snow");
    else {
      assert.equal(
        a.cells[i],
        a.ICE,
        "one flame does not melt a whole ice pixel",
      );
      assert(a.melt[i] > 0);
      for (let n = 0; n < 10 && a.cells[i] === a.ICE; n++) {
        a.setCell(j, a.FIRE);
        a.step();
      }
      assert.equal(a.cells[i], a.WATER, "repeated heat melts ice");
    }
    consistent(a);
  }
});

test("Lava converts ice or snow to steam and cools into stone", () => {
  for (const name of ["ICE", "SNOW"]) {
    const { a } = load(817);
    a.put(100, 100, a[name]);
    a.put(101, 100, a.LAVA);
    a.step();
    assert.equal(a.counts[a[name]], 0);
    assert.equal(a.counts[a.LAVA], 0);
    assert.equal(a.counts[a.STEAM], 1);
    assert.equal(a.counts[a.STONE], 1);
    consistent(a);
  }
});

test("Cold ice condenses adjacent steam and absorbs its heat", () => {
  const { a } = load(818);
  const { i } = coldPocket(a, a.ICE, a.STEAM);
  a.step();
  assert.equal(a.counts[a.STEAM], 0);
  assert.equal(a.counts[a.WATER], 1);
  assert.equal(a.counts[a.ICE], 1);
  assert(a.melt[i] > 0, "condensing steam adds heat to ice");
  consistent(a);
});

test("Burning wood and oil melt cold material", () => {
  for (const fuel of ["WOOD", "OIL"])
    for (const cold of ["ICE", "SNOW"]) {
      const { a } = load(819);
      const { j } = coldPocket(a, a[cold], a[fuel]);
      a.ignite(j);
      assert(a.burn[j] > 0, `${fuel} initially burning`);
      steps(a, 130);
      assert.equal(a.counts[a[cold]], 0, `${fuel} melts ${cold}`);
      assert(a.counts[a.WATER] > 0, `${cold} produces water`);
      consistent(a);
    }
});

test("Explosions melt or vaporize ice and snow and clear melt metadata", () => {
  for (const name of ["ICE", "SNOW"]) {
    const { a } = load(820);
    range(a, 98, 68, 102, 72, a[name]);
    const before = a.counts[a[name]];
    for (const p of positions(a, a[name])) a.melt[p.i] = 2;
    a.explode(100, 70, 18, 6);
    assert(a.counts[a[name]] < before, "blast damages cold material");
    assert(
      a.counts[a.WATER] + a.counts[a.STEAM] > 0,
      "blast creates water or steam",
    );
    for (let i = 0; i < a.N; i++)
      if (a.cells[i] !== a.ICE && a.cells[i] !== a.SNOW)
        assert.equal(a.melt[i], 0, "non-cold cells have no melt metadata");
    steps(a, 100);
    consistent(a);
  }
});

test("Reset clears partial melt and preserves pause and selected cold material", () => {
  const sim = loadApp(),
    { a, nodes } = sim;
  nodes.get("material" + a.SNOW).click();
  a.put(100, 10, a.SNOW);
  a.melt[10 * a.W + 100] = 5;
  nodes.get("#element-pause").click();
  nodes.get("#element-reset").click();
  assert(a.melt.every((v) => v === 0));
  assert(a.cells.every((v) => v === 0));
  assert.equal(a.counts[a.AIR], a.N);
  assert.equal(a.paused, true);
  nodes.get("#element-add").click();
  assert(a.counts[a.SNOW] > 0, "selection is retained");
  sim.frame(16);
  sim.frame(64);
  assert.equal(a.tick, 0);
  consistent(a);
});

test("Metal, ash and charcoal are selectable and paintable while paused", () => {
  const sim = loadApp(),
    { a, nodes } = sim;
  nodes.get("#element-pause").click();
  assert(
    a.metalHeat.every((v) => v === 0),
    "metal starts cold",
  );
  for (const id of [a.METAL, a.ASH, a.CHARCOAL]) {
    assert(materialIds().includes(id), `tool ${id} exists`);
    nodes.get("material" + id).click();
    assert(!nodes.get("#element-state").textContent.includes("undefined"));
    nodes.get("#element-add").click();
    assert(a.counts[id] > 0, "button paints selected material");
    a.draw();
    sim.frame(16);
    sim.frame(64);
    assert.equal(a.tick, 0, "painting does not advance a paused world");
    nodes.get("#element-reset").click();
  }
  assert(a.metalHeat.every((v) => v === 0));
  consistent(a);
});

test("Metal remains fixed through flame, lava, and repeated explosions", () => {
  const { a } = load(901);
  range(a, 98, 68, 102, 72, a.METAL);
  const original = positions(a, a.METAL).map((p) => p.i);
  a.put(103, 70, a.LAVA);
  a.put(97, 70, a.FIRE);
  steps(a, 20);
  for (let n = 0; n < 6; n++) a.explode(100, 70, 18, 8);
  steps(a, 180);
  assert.equal(a.counts[a.METAL], original.length);
  for (const i of original) {
    assert.equal(a.cells[i], a.METAL);
    assert.equal(a.vx[i], 0);
    assert.equal(a.vy[i], 0);
  }
  consistent(a);
  return {
    metalPixels: original.length,
  };
});

test("Ash falls slower than sand, piles up, and is not combustible", () => {
  const { a } = load(902);
  a.put(80, 10, a.ASH);
  a.put(150, 10, a.SAND);
  steps(a, 30);
  const ash = positions(a, a.ASH)[0],
    sand = positions(a, a.SAND)[0];
  assert(ash.y > 10 && ash.y < sand.y, "ash falls gently");
  assert(a.vy[ash.i] >= 0);
  const ashY = ash.y,
    sandY = sand.y;
  a.ignite(ash.i);
  assert.equal(a.burn[ash.i], 0, "ash cannot ignite");
  a.put(ash.x + 1, ash.y, a.FIRE);
  steps(a, 450);
  assert.equal(a.counts[a.ASH], 1, "ash survives nearby fire");
  assert.equal(positions(a, a.ASH)[0].y, a.H - 1, "ash settles on floor");
  consistent(a);
  return {
    ashY,
    sandY,
  };
});

test("Unheated charcoal conserves its particles without spontaneous ignition", () => {
  const { a } = load(903);
  range(a, 80, 20, 90, 28, a.CHARCOAL);
  const initial = a.counts[a.CHARCOAL];
  steps(a, 300);
  assert.equal(a.counts[a.CHARCOAL], initial);
  assert.equal(a.counts[a.ASH], 0);
  assert(a.burn.every((v) => v === 0));
  assert(positions(a, a.CHARCOAL).every((p) => p.y > 100));
  consistent(a);
  return {
    charcoal: initial,
  };
});

test("Burning charcoal carries its timer as it falls and eventually becomes ash", () => {
  const { a } = load(904);
  a.put(100, 10, a.CHARCOAL);
  a.ignite(10 * a.W + 100);
  const initialBurn = a.burn[10 * a.W + 100];
  assert(initialBurn > 0);
  steps(a, 18);
  const charcoal = positions(a, a.CHARCOAL)[0];
  assert(charcoal, "charcoal smolders for longer than 18 ticks");
  assert(charcoal.y > 10, "burning charcoal remains mobile");
  assert(
    a.burn[charcoal.i] > 0 && a.burn[charcoal.i] < initialBurn,
    "burn follows the particle",
  );
  steps(a, 1200);
  assert.equal(a.counts[a.CHARCOAL], 0);
  assert.equal(a.counts[a.ASH], 1, "one charcoal yields one ash cell");
  assert(
    a.burn.every((v) => v === 0),
    "ash has no burning timer",
  );
  consistent(a);
  return {
    initialBurn,
  };
});

test("Wood burnout leaves burning charcoal and then ash", () => {
  const { a } = load(905);
  const i = 100 * a.W + 100;
  a.put(100, 100, a.WOOD);
  a.burn[i] = 1;
  a.step();
  assert.equal(a.counts[a.WOOD], 0);
  assert.equal(a.counts[a.CHARCOAL], 1, "wood chars instead of disappearing");
  const charcoal = positions(a, a.CHARCOAL)[0];
  assert(a.burn[charcoal.i] > 0, "fresh charcoal continues smoldering");
  steps(a, 1200);
  assert.equal(a.counts[a.CHARCOAL], 0);
  assert.equal(a.counts[a.ASH], 1);
  consistent(a);
});

test("Water extinguishes charcoal while preserving charcoal and water", () => {
  const { a } = load(906);
  const { i } = coldPocket(a, a.CHARCOAL, a.WATER);
  a.burn[i] = 100;
  a.step();
  assert.equal(a.counts[a.CHARCOAL], 1);
  assert.equal(a.counts[a.WATER], 1);
  assert(
    a.burn.every((v) => v === 0),
    "water immediately extinguishes charcoal",
  );
  steps(a, 150);
  assert.equal(
    a.counts[a.CHARCOAL],
    1,
    "quenched charcoal is not silently consumed",
  );
  assert.equal(a.counts[a.ASH], 0);
  consistent(a);
});

test("Painting fire over charcoal ignites the existing fuel", () => {
  const { a } = load(907);
  const i = 20 * a.W + 100;
  a.put(100, 20, a.CHARCOAL);
  a.put(100, 20, a.FIRE);
  assert.equal(a.cells[i], a.CHARCOAL);
  assert(a.burn[i] > 0);
  assert.equal(a.counts[a.FIRE], 0);
  consistent(a);
});

test("Heat moves only between touching metal and never wraps a row", () => {
  const { a } = load(908);
  const x = 100,
    y = 80;
  for (const [px, py] of [
    [x, y],
    [x + 1, y],
    [x + 2, y],
    [x + 3, y + 1],
    [0, 31],
    [a.W - 1, 30],
  ])
    a.put(px, py, a.METAL);
  a.metalHeat[y * a.W + x] = 180;
  a.metalHeat[30 * a.W + a.W - 1] = 180;
  steps(a, 12);
  assert(a.metalHeat[y * a.W + x + 2] > 0, "heat crosses connected metal");
  assert.equal(
    a.metalHeat[(y + 1) * a.W + x + 3],
    0,
    "heat cannot jump a diagonal air gap",
  );
  assert.equal(
    a.metalHeat[31 * a.W],
    0,
    "last column does not touch next row first column",
  );
  for (const p of positions(a, a.METAL))
    assert(
      a.metalHeat[p.i] >= 0 && a.metalHeat[p.i] <= 180,
      "heat remains bounded",
    );
  consistent(a);
});

test("Heated metal ignites adjacent charcoal and melts ice", () => {
  for (const neighbor of ["CHARCOAL", "ICE"]) {
    const { a } = load(909);
    const { i, j } = coldPocket(a, a.METAL, a[neighbor]);
    let activated = false;
    for (let t = 0; t < 180; t++) {
      a.metalHeat[i] = 180;
      a.step();
      if (neighbor === "CHARCOAL" && a.burn[j] > 0) {
        activated = true;
        break;
      }
      if (neighbor === "ICE" && a.counts[a.ICE] === 0) {
        activated = true;
        break;
      }
    }
    assert(activated, `hot metal affects ${neighbor}`);
    assert.equal(a.cells[i], a.METAL, "conductor remains metal");
    consistent(a);
  }
});

test("Water cools hot metal faster than air and leaves the metal intact", () => {
  const dry = load(910).a,
    wet = load(910).a;
  const dryPocket = coldPocket(dry, dry.METAL, dry.AIR),
    wetPocket = coldPocket(wet, wet.METAL, wet.WATER);
  dry.metalHeat[dryPocket.i] = 180;
  wet.metalHeat[wetPocket.i] = 180;
  steps(dry, 10);
  steps(wet, 10);
  assert(
    wet.metalHeat[wetPocket.i] < dry.metalHeat[dryPocket.i],
    "water cools metal",
  );
  assert.equal(wet.counts[wet.METAL], 1);
  consistent(wet);
  return {
    dryHeat: dry.metalHeat[dryPocket.i],
    wetHeat: wet.metalHeat[wetPocket.i],
  };
});

test("Acid eventually corrodes metal and never leaves heat on a replaced cell", () => {
  const { a } = load(911);
  const { i, j } = coldPocket(a, a.METAL, a.ACID);
  let elapsed = 0;
  for (; elapsed < 6000 && a.cells[i] === a.METAL; elapsed++) {
    // Keep a stable neighboring acid cell, isolating corrosion from liquid flow.
    if (a.cells[j] !== a.ACID) a.setCell(j, a.ACID);
    a.metalHeat[i] = 80;
    a.step();
  }
  assert.notEqual(a.cells[i], a.METAL, "acid can corrode metal");
  assert.equal(a.metalHeat[i], 0, "replaced metal clears retained heat");
  consistent(a);
  return {
    elapsed,
  };
});

test("Reset removes metal heat and combustion while retaining the selected tool", () => {
  const sim = loadApp(),
    { a, nodes } = sim;
  a.put(100, 50, a.METAL);
  a.metalHeat[50 * a.W + 100] = 180;
  a.put(110, 10, a.CHARCOAL);
  a.ignite(10 * a.W + 110);
  nodes.get("material" + a.METAL).click();
  nodes.get("#element-pause").click();
  nodes.get("#element-reset").click();
  assert(a.metalHeat.every((v) => v === 0));
  assert(a.burn.every((v) => v === 0));
  assert.equal(a.counts[a.AIR], a.N);
  assert(a.paused);
  nodes.get("#element-add").click();
  assert(a.counts[a.METAL] > 0);
  assert(
    a.metalHeat.every((v) => v === 0),
    "new metal has no residual heat",
  );
  consistent(a);
});

test("Ash and charcoal remain inelastic while colliding in midair", () => {
  for (const name of ["ASH", "CHARCOAL"]) {
    const { a } = load(912);
    range(a, 95, 10, 107, 21, a[name]);
    const initial = a.counts[a[name]];
    fallOnly(a, a[name], 27, `${name} dense block`);
    assert.equal(a.counts[a[name]], initial);
  }
});

test("Fast ash and charcoal cannot tunnel through a thin metal wall", () => {
  for (const name of ["ASH", "CHARCOAL"]) {
    const { a } = load(913);
    range(a, 120, 0, 120, a.H - 1, a.METAL);
    a.put(111, 70, a[name]);
    a.vx[70 * a.W + 111] = 6;
    a.vy[70 * a.W + 111] = -0.5;
    for (let t = 0; t < 70; t++) {
      a.step();
      assert(
        positions(a, a[name]).every((p) => p.x < 120),
        `${name} cannot tunnel`,
      );
    }
    assert.equal(a.counts[a.METAL], a.H);
    assert.equal(a.counts[a[name]], 1);
    consistent(a);
  }
});
