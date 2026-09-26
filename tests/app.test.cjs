"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadApp, materialIds, consistent } = require("./helpers.cjs");

function pointer(canvas, event, x, y, pointerId = 1, button = 0) {
  canvas.dispatch(event, { clientX: x, clientY: y, pointerId, button });
}

test("Every material button selects a valid tool with an accessible pressed state", () => {
  const { a, app, nodes } = loadApp();
  for (const id of materialIds()) {
    nodes.get("material" + id).click();
    assert.equal(app.material, id);
    for (const otherId of materialIds()) {
      assert.equal(
        nodes.get("material" + otherId).getAttribute("aria-pressed"),
        String(id === otherId),
      );
    }
    assert(!nodes.get("#element-state").textContent.includes("undefined"));
  }
  assert.equal(
    a.counts[a.AIR],
    a.N,
    "selecting a tool alone leaves a blank world",
  );
});

test("Pointer dragging paints continuous strokes and release stops painting", () => {
  const sim = loadApp(501, true);
  const { a, nodes } = sim;
  const canvas = nodes.get("#element-field");
  nodes.get("material" + a.METAL).click();
  pointer(canvas, "pointerdown", 40, 50);
  assert(canvas.hasPointerCapture(1));
  pointer(canvas, "pointermove", 90, 50);
  pointer(canvas, "pointerup", 90, 50);
  assert(!canvas.hasPointerCapture(1));
  for (let x = 40; x <= 90; x++)
    assert.equal(a.cells[50 * a.W + x], a.METAL, "stroke has no gaps");
  const metal = a.counts[a.METAL];
  pointer(canvas, "pointermove", 150, 50);
  sim.frame(0);
  sim.frame(80);
  assert.equal(a.counts[a.METAL], metal);
  assert.equal(a.tick, 0, "paused painting never advances physics");
  consistent(a);
});

test("Secondary buttons and a second pointer cannot take over an active stroke", () => {
  const { a, nodes } = loadApp(502, true);
  const canvas = nodes.get("#element-field");
  pointer(canvas, "pointerdown", 30, 30, 1, 2);
  assert.equal(a.counts[a.AIR], a.N, "secondary mouse button does not paint");
  pointer(canvas, "pointerdown", 30, 30, 1);
  const initial = a.counts[a.SAND];
  pointer(canvas, "pointerdown", 150, 80, 2);
  pointer(canvas, "pointermove", 160, 80, 2);
  assert.equal(a.counts[a.SAND], initial);
  pointer(canvas, "pointercancel", 30, 30, 1);
  assert(!canvas.hasPointerCapture(1));
});

test("Explosion clicks detonate once without continuously exploding during a drag", () => {
  const sim = loadApp(503, true);
  const { a, nodes } = sim;
  const canvas = nodes.get("#element-field");
  nodes.get("material" + a.EXPLOSION).click();
  pointer(canvas, "pointerdown", 120, 80);
  assert.equal(a.blastFlashes.length, 1);
  pointer(canvas, "pointermove", 130, 80);
  sim.frame(0);
  sim.frame(80);
  sim.frame(160);
  assert.equal(a.blastFlashes.length, 1);
  assert.equal(a.tick, 0);
  nodes.get("#element-add").click();
  assert.equal(
    a.blastFlashes.length,
    2,
    "the keyboard-accessible center control also detonates",
  );
  consistent(a);
});

test("Switching tools or resetting releases a captured pointer", () => {
  const sim = loadApp(504, true);
  const { a, nodes } = sim;
  const canvas = nodes.get("#element-field");
  pointer(canvas, "pointerdown", 40, 40);
  nodes.get("material" + a.WATER).click();
  assert(!canvas.hasPointerCapture(1));
  const water = a.counts[a.WATER];
  pointer(canvas, "pointermove", 80, 80);
  assert.equal(a.counts[a.WATER], water);
  pointer(canvas, "pointerdown", 80, 80);
  nodes.get("#element-reset").click();
  assert(!canvas.hasPointerCapture(1));
  sim.frame(0);
  sim.frame(80);
  assert.equal(
    a.counts[a.AIR],
    a.N,
    "reset does not leave a running brush behind",
  );
  assert.equal(sim.app.material, a.WATER);
});

test("Animation limits catch-up work and resumes cleanly after visibility changes", () => {
  const sim = loadApp(505);
  sim.frame(100);
  assert.equal(sim.a.tick, 0);
  sim.frame(10100);
  assert(
    sim.a.tick > 0 && sim.a.tick <= 5,
    "a long tab stall does not create unbounded work",
  );
  const before = sim.a.tick;
  sim.context.document.dispatch("visibilitychange");
  sim.frame(50100);
  assert.equal(
    sim.a.tick,
    before,
    "restoring a tab resets the elapsed-time clock",
  );
  sim.frame(50134);
  assert(sim.a.tick > before);
});

test("A system theme change refreshes and redraws the canvas", () => {
  const sim = loadApp(506);
  const before = sim.submittedFrames;
  sim.mediaQueries.get("(prefers-color-scheme: dark)").dispatch("change");
  assert(sim.submittedFrames > before);
  assert.equal(sim.lastImage.data.length, sim.a.N * 4);
});

test("Disposing the app removes input listeners, its color probe, and scheduled work", () => {
  const sim = loadApp(507);
  const { app, a, nodes } = sim;
  const root = nodes.get("#element-sandbox");
  const canvas = nodes.get("#element-field");
  pointer(canvas, "pointerdown", 50, 50);
  assert(sim.scheduledFrames > 0);
  app.dispose();
  app.dispose();
  assert.equal(sim.scheduledFrames, 0);
  assert(!canvas.hasPointerCapture(1));
  assert.equal(root.children.length, 0, "the color probe is removed");
  for (const node of nodes.values())
    assert.equal(node.listenerCount(), 0, "DOM listeners are removed");
  assert.equal(sim.context.document.listenerCount(), 0);
  for (const media of sim.mediaQueries.values())
    assert.equal(media.listenerCount(), 0);
  const particles = a.N - a.counts[a.AIR];
  pointer(canvas, "pointerdown", 150, 100);
  nodes.get("#element-add").click();
  sim.frame(1000);
  assert.equal(a.N - a.counts[a.AIR], particles);
});
