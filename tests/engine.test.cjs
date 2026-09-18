"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  loadEngine,
  loadSimulation,
  seededRandom,
  range,
  steps,
  consistent,
} = require("./helpers.cjs");

const stateFields = [
  "cells",
  "shade",
  "life",
  "burn",
  "updated",
  "born",
  "vx",
  "vy",
  "remX",
  "remY",
  "grounded",
  "fuse",
  "melt",
  "metalHeat",
  "heatNext",
  "counts",
];

function snapshot(world) {
  return Object.fromEntries([
    ...stateFields.map((name) => [name, Array.from(world[name])]),
    ["tick", world.tick],
    ["pendingBlasts", JSON.parse(JSON.stringify(world.pendingBlasts))],
    ["blastFlashes", JSON.parse(JSON.stringify(world.blastFlashes))],
  ]);
}

function mixedScene(world) {
  range(world, 0, 31, 47, 31, world.METAL);
  range(world, 6, 21, 19, 29, world.WATER);
  range(world, 25, 24, 34, 29, world.OIL);
  range(world, 6, 3, 16, 6, world.SAND);
  range(world, 27, 7, 31, 9, world.GUNPOWDER);
  world.put(26, 8, world.FIRE);
  world.put(39, 18, world.WOOD);
  world.put(40, 18, world.LAVA);
  world.put(4, 11, world.SNOW);
}

test("Engine loads without document, canvas, or animation globals", () => {
  const namespace = loadEngine();
  const world = namespace.createSimulation({ width: 32, height: 24 });
  assert.equal(world.N, 768);
  assert.equal(world.counts[world.AIR], world.N);
  world.put(10, 2, world.SAND);
  steps(world, 30);
  assert.equal(world.counts[world.SAND], 1);
  assert(world.cells[2 * world.W + 10] === world.AIR);
  consistent(world);
});

test("Two worlds share material definitions but never mutable simulation state", () => {
  const namespace = loadEngine();
  const first = namespace.createSimulation({
    width: 48,
    height: 32,
    random: seededRandom(1),
  });
  const second = namespace.createSimulation({
    width: 48,
    height: 32,
    random: seededRandom(2),
  });
  for (const name of stateFields)
    assert.notEqual(first[name], second[name], name);
  const untouched = snapshot(second);
  mixedScene(first);
  steps(first, 24);
  first.explode(15, 20);
  first.reset();
  assert.deepEqual(
    snapshot(second),
    untouched,
    "editing, stepping, blasting, and resetting cannot affect another world",
  );
});

test("An injected seeded random source reproduces a reactive scene exactly", () => {
  const first = loadSimulation(481, { width: 48, height: 32 }).a;
  const second = loadSimulation(481, { width: 48, height: 32 }).a;
  mixedScene(first);
  mixedScene(second);
  steps(first, 160);
  steps(second, 160);
  assert.deepEqual(snapshot(first), snapshot(second));
  consistent(first);
});

test("Reset clears every engine field, including the heat diffusion buffer", () => {
  const { a } = loadSimulation(482, { width: 48, height: 32 });
  mixedScene(a);
  a.melt[11 * a.W + 4] = 3;
  a.metalHeat[31 * a.W + 9] = 120;
  a.heatNext[31 * a.W + 9] = 20;
  steps(a, 5);
  a.explode(24, 16);
  a.pendingBlasts.push({ x: 20, y: 20, radius: 5, power: 2 });
  a.reset();
  for (const name of stateFields.filter((name) => name !== "counts")) {
    assert(
      a[name].every((value) => value === 0),
      `${name} is clear`,
    );
  }
  assert.equal(a.pendingBlasts.length, 0);
  assert.equal(a.blastFlashes.length, 0);
  assert.equal(a.tick, 0);
  assert.equal(a.counts[a.AIR], a.N);
  consistent(a);
});

test("World size and direct cell writes reject invalid inputs without corrupting state", () => {
  const namespace = loadEngine();
  for (const options of [
    { width: 0 },
    { height: 513 },
    { width: 20.5 },
    { height: NaN },
  ]) {
    assert.throws(() => namespace.createSimulation(options), {
      name: "RangeError",
    });
  }
  assert.throws(() => namespace.createSimulation({ random: 42 }), {
    name: "TypeError",
  });
  const a = namespace.createSimulation({ width: 8, height: 8 });
  for (const [index, type] of [
    [-1, a.SAND],
    [a.N, a.SAND],
    [0, a.EXPLOSION],
    [0, 18],
    [0.5, a.SAND],
  ]) {
    assert.throws(() => a.setCell(index, type), { name: "RangeError" });
  }
  for (const [x, y, type] of [
    [-1, 0, a.SAND],
    [8, 0, a.SAND],
    [0, 8, a.SAND],
    [0, 0, a.EXPLOSION],
    [0, 0, 18],
  ]) {
    a.put(x, y, type);
  }
  assert.equal(a.counts[a.AIR], a.N);
  consistent(a);
});

test("Particles in a minimum-size world remain inside bounds", () => {
  const { a } = loadSimulation(483, { width: 4, height: 4 });
  a.put(0, 0, a.SAND);
  a.put(1, 0, a.WATER);
  a.put(2, 0, a.SNOW);
  a.put(3, 0, a.ASH);
  steps(a, 30);
  assert.equal(a.cells.length, 16);
  consistent(a);
});

test("Airborne water alongside a fixed wall does not mistake that wall for landing support", () => {
  const { a } = loadSimulation(301);
  range(a, 120, 0, 120, a.H - 1, a.STONE);
  a.put(119, 20, a.WATER);
  a.put(119, 21, a.WATER);
  a.vx[20 * a.W + 119] = 3;
  a.vy[20 * a.W + 119] = 4;
  a.vy[21 * a.W + 119] = 0.1;
  a.step();
  for (let i = 0; i < a.N; i++) {
    if (a.cells[i] === a.WATER)
      assert(a.vy[i] >= 0, "an airborne contact cannot cause a splash");
  }
  consistent(a);
});
