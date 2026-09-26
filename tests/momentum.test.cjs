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
test("Sand accelerates and remains a single particle", () => {
  const { a } = load();
  a.put(100, 15, a.SAND);
  const ys = [15],
    speeds = [];
  for (let t = 0; t < 12; t++) {
    a.step();
    const p = positions(a, a.SAND);
    assert.equal(p.length, 1);
    ys.push(p[0].y);
    speeds.push(a.vy[p[0].i]);
  }
  assert(ys[12] > ys[0]);
  assert(speeds[6] > speeds[0], `gravity should increase speed: ${speeds}`);
  assert(
    ys[12] - ys[8] > ys[4] - ys[0],
    `later travel should be faster: ${ys}`,
  );
  consistent(a);
  return {
    ys,
    speeds: speeds.map((v) => Math.round(v * 100) / 100),
  };
});

test("Sand and water conserved during mixing and settling", () => {
  const { a } = load();
  for (let y = 6; y < 15; y++)
    for (let x = 70; x < 115; x++) a.put(x, y, a.SAND);
  for (let y = 25; y < 40; y++)
    for (let x = 62; x < 125; x++) a.put(x, y, a.WATER);
  const expected = [a.counts[a.SAND], a.counts[a.WATER]];
  for (let t = 0; t < 180; t++) {
    a.step();
    if (t % 20 === 0) {
      assert.equal(a.counts[a.SAND], expected[0]);
      assert.equal(a.counts[a.WATER], expected[1]);
      consistent(a);
    }
  }
  consistent(a);
  return {
    sand: expected[0],
    water: expected[1],
  };
});

test("Fast sand/water cannot tunnel through a one-cell floor", () => {
  for (const seed of [5, 73, 701])
    for (const type of [1, 3]) {
      const { a } = load(seed);
      for (let x = 0; x < a.W; x++) a.put(x, 80, a.STONE);
      a.put(100, 75, type);
      a.vx[75 * a.W + 100] = 3;
      a.vy[75 * a.W + 100] = 25;
      for (let t = 0; t < 30; t++) {
        a.step();
        for (const p of positions(a, type))
          assert(p.y < 80, `type ${type} crossed floor at ${p.x},${p.y}`);
      }
      assert.equal(a.counts[a.STONE], a.W);
      consistent(a);
    }
});

test("Particles cannot escape a closed diagonal corner", () => {
  for (const seed of [7, 44, 403])
    for (const type of [1, 3]) {
      const { a } = load(seed),
        x = 80,
        y = 70,
        i = y * a.W + x;
      for (const [dx, dy] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ])
        a.put(x + dx, y + dy, a.STONE);
      a.put(x, y, type);
      a.vx[i] = 22;
      a.vy[i] = 22;
      for (let t = 0; t < 30; t++) a.step();
      assert.equal(
        a.cells[i],
        type,
        `type ${type} escaped cardinal enclosure at seed ${seed}`,
      );
      consistent(a);
    }
});

test("Water splash rebounds with lower energy then loses vertical motion", () => {
  const { a } = load(320);
  for (let x = 0; x < a.W; x++) a.put(x, 120, a.STONE);
  a.put(100, 10, a.WATER);
  const bounces = [];
  let previousVy = 0,
    maxVx = 0,
    maxVy = 0;
  for (let t = 0; t < 260; t++) {
    a.step();
    const p = positions(a, a.WATER)[0];
    assert(p && p.y < 120);
    const xVel = a.vx[p.i],
      yVel = a.vy[p.i];
    maxVx = Math.max(maxVx, Math.abs(xVel));
    maxVy = Math.max(maxVy, Math.abs(yVel));
    if (previousVy > 0 && yVel < 0) {
      const incoming = previousVy + 0.16;
      assert(
        xVel * xVel + yVel * yVel < incoming * incoming,
        "splash dissipates incident fall energy",
      );
      bounces.push({
        tick: t,
        vx: xVel,
        vy: yVel,
      });
    }
    if (t > 170)
      assert(Math.abs(yVel) < 0.001, "late water vertical velocity settled");
    previousVy = yVel;
  }
  assert(bounces.length > 0, "falling water visibly rebounds");
  assert(maxVx <= 5 && maxVy <= 4.5, "speed remains bounded");
  consistent(a);
  return {
    bounces,
    maxVx,
    maxVy,
  };
});

test("Sand sinks through resting water in a narrow flooded shaft", () => {
  const { a } = load(125),
    x = 100;
  for (let y = 50; y < a.H; y++) {
    a.put(x - 1, y, a.STONE);
    a.put(x + 1, y, a.STONE);
  }
  a.put(x, a.H - 1, a.STONE);
  for (let y = 60; y < a.H - 1; y++) a.put(x, y, a.WATER);
  a.put(x, 52, a.SAND);
  const water = a.counts[a.WATER];
  for (let t = 0; t < 360; t++) a.step();
  const sand = positions(a, a.SAND);
  assert.equal(sand.length, 1);
  assert.equal(sand[0].x, x);
  assert.equal(
    sand[0].y,
    a.H - 2,
    "sand must sink all the way through settled water",
  );
  assert.equal(a.counts[a.WATER], water);
  consistent(a);
  return {
    finalSand: sand[0],
    water,
  };
});

test("Water still cools lava into stone and steam", () => {
  const { a } = load();
  a.put(50, 80, a.WATER);
  a.put(51, 80, a.LAVA);
  a.step();
  assert.equal(a.counts[a.LAVA], 0);
  assert.equal(a.counts[a.WATER], 0);
  assert.equal(a.counts[a.STONE], 1);
  assert.equal(a.counts[a.STEAM], 1);
  consistent(a);
});

test("Smoke rises and eventually dissipates", () => {
  const { a } = load();
  a.put(100, 100, a.SMOKE);
  const startLife = a.life[100 * a.W + 100];
  for (let t = 0; t < 12; t++) a.step();
  const smoke = positions(a, a.SMOKE);
  assert.equal(smoke.length, 1);
  assert(smoke[0].y < 100);
  assert(a.life[smoke[0].i] < startLife);
  for (let t = 0; t < 400; t++) a.step();
  assert.equal(a.counts[a.SMOKE], 0);
  consistent(a);
});

test("Fire still ignites wood and water extinguishes burning wood", () => {
  const { a } = load();
  a.put(70, 80, a.WOOD);
  a.put(71, 80, a.FIRE);
  a.step();
  assert(a.burn[80 * a.W + 70] > 0);
  a.put(69, 80, a.WATER);
  a.step();
  assert.equal(a.burn[80 * a.W + 70], 0);
  consistent(a);
});

test("Reset clears particles, momentum, subcells and time while retaining pause", () => {
  const sim = loadApp(),
    { a, nodes } = sim;
  a.put(10, 10, a.SAND);
  a.vx[10 * a.W + 10] = 12;
  a.vy[10 * a.W + 10] = 7;
  a.remX[10 * a.W + 10] = 0.5;
  a.remY[10 * a.W + 10] = 0.8;
  a.step();
  nodes.get("#element-pause").click();
  assert.equal(a.paused, true);
  nodes.get("#element-reset").click();
  for (const field of [
    a.cells,
    a.shade,
    a.life,
    a.burn,
    a.updated,
    a.born,
    a.vx,
    a.vy,
    a.remX,
    a.remY,
  ])
    assert(
      field.every((v) => v === 0),
      "reset arrays",
    );
  assert.equal(a.tick, 0);
  assert.equal(a.paused, true);
  assert.equal(a.counts[a.AIR], a.N);
  sim.frame(16);
  sim.frame(64);
  assert.equal(a.tick, 0, "paused animation does not advance simulation");
  a.put(10, 10, a.SAND);
  nodes.get("#element-pause").click();
  sim.frame(128);
  assert(a.tick > 0, "resume advances simulation");
  consistent(a);
});

test("Reduced motion starts paused", () => {
  const { a, nodes } = loadApp(33, true);
  assert.equal(a.paused, true);
  assert.equal(nodes.get("#element-pause").textContent, "Resume");
});
