"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");

const projectRoot = path.resolve(__dirname, "..");

/** Reproducible random source for behavioral tests; production uses Math.random. */
function seededRandom(seed = 420) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function evaluate(context, filename) {
  const absolute = path.join(projectRoot, filename);
  vm.runInContext(fs.readFileSync(absolute, "utf8"), context, {
    filename: absolute,
  });
}

/** Load the real engine without providing any browser globals. */
function loadEngine() {
  const context = vm.createContext({ console });
  evaluate(context, "js/materials.js");
  evaluate(context, "js/simulation.js");
  return context.PixelSandbox;
}

function loadSimulation(seed = 420, options = {}) {
  const namespace = loadEngine();
  return {
    a: namespace.createSimulation({ random: seededRandom(seed), ...options }),
    namespace,
  };
}

function materialIds() {
  return [
    ...fs
      .readFileSync(path.join(projectRoot, "index.html"), "utf8")
      .matchAll(/data-material="(-?\d+)"/g),
  ].map((match) => Number(match[1]));
}

/**
 * Small DOM/canvas adapter for application wiring tests. This runs the production
 * scripts unchanged. It checks events and pixels submitted to the canvas, not a
 * browser's CSS layout or GPU rendering.
 */
function loadApp(seed = 420, reducedMotion = false) {
  const html = fs.readFileSync(path.join(projectRoot, "index.html"), "utf8");
  const ids = materialIds();
  const nodes = new Map();
  const animationCallbacks = new Map();
  const mediaQueries = new Map();
  let animationId = 0;
  let generatedId = 0;
  let submittedFrames = 0;
  let lastImage = null;

  function eventTarget(target) {
    const listeners = new Map();
    target.addEventListener = (event, callback) => {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(callback);
    };
    target.removeEventListener = (event, callback) =>
      listeners.get(event)?.delete(callback);
    target.dispatch = (event, args = {}) => {
      const payload = { target, preventDefault() {}, ...args };
      for (const callback of [...(listeners.get(event) || [])])
        callback(payload);
    };
    target.listenerCount = () =>
      [...listeners.values()].reduce((sum, set) => sum + set.size, 0);
    return target;
  }

  function makeContext() {
    return {
      fillStyle: "#778899",
      createImageData: (width, height) => ({
        width,
        height,
        data: new Uint8ClampedArray(width * height * 4),
      }),
      clearRect() {},
      fillRect() {},
      beginPath() {},
      arc() {},
      stroke() {},
      fill() {},
      save() {},
      restore() {},
      getImageData: () => ({
        data: new Uint8ClampedArray([112, 130, 145, 255]),
      }),
      putImageData(image) {
        lastImage = image;
        submittedFrames++;
      },
    };
  }

  function node(key) {
    if (nodes.has(key)) return nodes.get(key);
    const captures = new Set();
    const classes = new Set();
    const canvasContext = makeContext();
    const element = eventTarget({
      style: {},
      dataset: {},
      textContent: "",
      value: "",
      isConnected: true,
      width: 240,
      height: 160,
      children: [],
      classList: {
        add: (name) => classes.add(name),
        remove: (name) => classes.delete(name),
        contains: (name) => classes.has(name),
      },
      setAttribute(name, value) {
        this[name] = String(value);
      },
      getAttribute(name) {
        return this[name] ?? null;
      },
      removeAttribute(name) {
        delete this[name];
      },
      appendChild(child) {
        this.children.push(child);
        child.parentNode = this;
        return child;
      },
      removeChild(child) {
        this.children = this.children.filter((item) => item !== child);
        child.parentNode = null;
      },
      remove() {
        this.parentNode?.removeChild(this);
        this.isConnected = false;
      },
      getContext: () => canvasContext,
      getBoundingClientRect: () => ({
        left: 0,
        top: 0,
        width: 240,
        height: 160,
      }),
      setPointerCapture: (id) => captures.add(id),
      hasPointerCapture: (id) => captures.has(id),
      releasePointerCapture: (id) => captures.delete(id),
      querySelector: (selector) => node(selector),
      querySelectorAll: (selector) =>
        selector === "[data-material]"
          ? ids.map((id) => {
              const button = node("material" + id);
              button.dataset.material = String(id);
              return button;
            })
          : [],
      click() {
        this.dispatch("click");
      },
    });
    nodes.set(key, element);
    return element;
  }

  const document = eventTarget({
    readyState: "complete",
    hidden: false,
    getElementById: (id) => node("#" + id),
    querySelector: (selector) => node(selector),
    createElement: (tag) => node("generated-" + tag + "-" + generatedId++),
  });
  document.documentElement = node("html");
  document.body = node("body");
  const randomMath = Object.create(Math);
  randomMath.random = seededRandom(seed);
  const context = {
    console,
    Math: randomMath,
    document,
    getComputedStyle: () => ({
      color: "#778899",
      getPropertyValue: () => "#778899",
    }),
    matchMedia: (query) => {
      if (!mediaQueries.has(query))
        mediaQueries.set(
          query,
          eventTarget({
            matches: query.includes("reduced-motion") && reducedMotion,
          }),
        );
      return mediaQueries.get(query);
    },
    requestAnimationFrame(callback) {
      const id = ++animationId;
      animationCallbacks.set(id, callback);
      return id;
    },
    cancelAnimationFrame: (id) => animationCallbacks.delete(id),
    performance: { now: () => 0 },
  };
  eventTarget(context);
  context.window = context;
  vm.createContext(context);
  const scripts = [
    ...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi),
  ].map((match) => match[1]);
  assert(scripts.length >= 4, "entry page loads the four local modules");
  for (const filename of scripts) evaluate(context, filename);
  const app = context.PixelSandbox.app;
  assert(app, "application exposes its lifecycle controller");
  // The adapter keeps legacy assertions concise while paused/draw remain UI-owned.
  const a = new Proxy(app.simulation, {
    get(target, key) {
      if (key === "paused") return app.paused;
      if (key === "draw") return () => app.renderer.draw();
      return Reflect.get(target, key);
    },
  });
  return {
    a,
    app,
    nodes,
    context,
    mediaQueries,
    frame(time) {
      const scheduled = [...animationCallbacks.entries()];
      for (const [id, callback] of scheduled) {
        animationCallbacks.delete(id);
        callback(time);
      }
    },
    get scheduledFrames() {
      return animationCallbacks.size;
    },
    get submittedFrames() {
      return submittedFrames;
    },
    get lastImage() {
      return lastImage;
    },
  };
}

function positions(a, type) {
  const list = [];
  for (let i = 0; i < a.N; i++) {
    if (a.cells[i] === type)
      list.push({ i, x: i % a.W, y: Math.floor(i / a.W) });
  }
  return list;
}

function range(a, x0, y0, x1, y1, type) {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) a.put(x, y, type);
  }
}

function steps(a, count) {
  for (let tick = 0; tick < count; tick++) a.step();
}

function consistent(a) {
  const histogram = Array(a.counts.length).fill(0);
  for (const type of a.cells) {
    assert(type >= 0 && type < histogram.length, `valid material ID ${type}`);
    histogram[type]++;
  }
  assert.deepEqual(Array.from(a.counts), histogram, "counts match grid");
  for (let i = 0; i < a.N; i++) {
    assert(
      Number.isFinite(a.vx[i]) && Number.isFinite(a.vy[i]),
      "finite velocity",
    );
    assert(
      Number.isFinite(a.remX[i]) && Number.isFinite(a.remY[i]),
      "finite subcell position",
    );
    assert(
      Number.isFinite(a.metalHeat[i]) && a.metalHeat[i] >= 0,
      "finite nonnegative metal heat",
    );
    if (a.cells[i] !== a.METAL)
      assert.equal(a.metalHeat[i], 0, "heat belongs only to metal cells");
  }
}

module.exports = {
  projectRoot,
  seededRandom,
  loadEngine,
  loadSimulation,
  loadApp,
  materialIds,
  positions,
  range,
  steps,
  consistent,
};
