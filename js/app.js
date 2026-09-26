/** Browser input, accessible controls, and fixed-timestep animation. */
(function (namespace) {
  "use strict";

  const root = document.getElementById("element-sandbox");
  if (!root) return;
  const canvas = root.querySelector("#element-field");
  const simulation = namespace.createSimulation();
  const renderer = namespace.createRenderer(canvas, simulation, root);
  const { IDs, names, descriptions, isSolid } = namespace.Materials;
  const { AIR, SAND, EXPLOSION } = IDs;
  const { W, H } = simulation;
  const buttons = [...root.querySelectorAll("[data-material]")];
  const pauseButton = root.querySelector("#element-pause");
  const addButton = root.querySelector("#element-add");
  const stateLabel = root.querySelector("#element-state");
  const countLabel = root.querySelector("#element-count");
  const cleanups = [];
  const STEP_MS = 1000 / 60;
  let material = SAND;
  let paused = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let pointer = null,
    pointerId = null,
    painting = false;
  let lastTime = null,
    accumulator = 0,
    countTime = 0,
    animationId = null;
  let disposed = false;

  function listen(target, event, callback) {
    target.addEventListener(event, callback);
    cleanups.push(() => target.removeEventListener(event, callback));
  }

  function showCount() {
    countLabel.textContent =
      (simulation.N - simulation.counts[AIR]).toLocaleString() + " pixels";
  }

  function syncControls() {
    pauseButton.textContent = paused ? "Resume" : "Pause";
    pauseButton.setAttribute("aria-pressed", String(paused));
    addButton.textContent =
      material === EXPLOSION
        ? "Detonate center"
        : material === AIR
          ? "Erase center"
          : "Add " + names[material].toLowerCase();
    stateLabel.textContent =
      (material === EXPLOSION
        ? "Explosion · click to break terrain and launch particles"
        : names[material] + " · " + descriptions[material]) +
      (paused ? " · paused" : "");
  }

  function pos(event) {
    const box = canvas.getBoundingClientRect();
    return {
      x: Math.floor(((event.clientX - box.left) * W) / box.width),
      y: Math.floor(((event.clientY - box.top) * H) / box.height),
    };
  }

  function detonate(x, y) {
    simulation.explode(x, y);
    showCount();
    renderer.draw();
    stateLabel.textContent =
      "Explosion triggered" + (paused ? " · paused" : "");
  }

  function stopPainting() {
    const captured = pointerId;
    painting = false;
    pointer = null;
    pointerId = null;
    if (captured !== null && canvas.hasPointerCapture(captured))
      canvas.releasePointerCapture(captured);
  }

  listen(canvas, "pointerdown", (event) => {
    if (event.button !== 0 || pointerId !== null) return;
    const point = pos(event);
    if (material === EXPLOSION) {
      detonate(point.x, point.y);
    } else {
      pointerId = event.pointerId;
      canvas.setPointerCapture(pointerId);
      painting = true;
      pointer = point;
      simulation.brush(point.x, point.y, material, true);
      showCount();
      renderer.draw();
    }
    event.preventDefault();
  });
  listen(canvas, "pointermove", (event) => {
    if (!painting || event.pointerId !== pointerId) return;
    const next = pos(event);
    simulation.stroke(pointer, next, material);
    pointer = next;
    renderer.draw();
  });
  const release = (event) => {
    if (event.pointerId === pointerId) stopPainting();
  };
  for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
    listen(canvas, event, release);

  for (const button of buttons)
    listen(button, "click", () => {
      stopPainting();
      material = Number(button.dataset.material);
      buttons.forEach((other) =>
        other.setAttribute("aria-pressed", String(other === button)),
      );
      syncControls();
    });
  listen(pauseButton, "click", () => {
    paused = !paused;
    accumulator = 0;
    syncControls();
  });
  listen(addButton, "click", () => {
    const centerX = Math.floor(W / 2),
      centerY = Math.floor(H / 2);
    if (material === EXPLOSION) {
      detonate(centerX, centerY);
      return;
    }
    if (material === AIR) simulation.brush(centerX, centerY, AIR, true);
    else
      for (let y = 12; y < 24; y++)
        for (let x = centerX - 8; x < centerX + 8; x++) {
          if (isSolid(material) || Math.random() < 0.7)
            simulation.put(x, y, material);
        }
    showCount();
    renderer.draw();
    stateLabel.textContent =
      (material === AIR ? "Center erased" : names[material] + " added") +
      (paused ? " · paused" : "");
  });
  listen(root.querySelector("#element-reset"), "click", () => {
    stopPainting();
    simulation.reset();
    accumulator = 0;
    lastTime = null;
    showCount();
    renderer.draw();
    stateLabel.textContent = "Canvas cleared" + (paused ? " · paused" : "");
  });

  const theme = matchMedia("(prefers-color-scheme: dark)");
  const repaintTheme = () => {
    renderer.refreshColors();
    renderer.draw();
  };
  if (theme.addEventListener) listen(theme, "change", repaintTheme);
  listen(document, "visibilitychange", () => {
    lastTime = null;
    accumulator = 0;
  });

  function animate(time) {
    if (disposed) return;
    if (!root.isConnected) {
      dispose();
      return;
    }
    const dt =
      lastTime === null ? 0 : Math.max(0, Math.min(time - lastTime, 80));
    lastTime = time;
    accumulator += dt;
    let iterations = 0;
    while (accumulator >= STEP_MS && iterations < 5) {
      if (painting && pointer) simulation.brush(pointer.x, pointer.y, material);
      if (!paused) simulation.step();
      accumulator -= STEP_MS;
      iterations++;
    }
    renderer.draw();
    if (time - countTime > 250) {
      showCount();
      countTime = time;
    }
    animationId = requestAnimationFrame(animate);
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    stopPainting();
    cancelAnimationFrame(animationId);
    cleanups.forEach((cleanup) => cleanup());
    renderer.dispose();
  }

  // A controller is available for debugging; each factory-created world is independent.
  namespace.app = {
    simulation,
    renderer,
    get paused() {
      return paused;
    },
    get material() {
      return material;
    },
    dispose,
  };
  syncControls();
  showCount();
  renderer.draw();
  animationId = requestAnimationFrame(animate);
})((globalThis.PixelSandbox = globalThis.PixelSandbox || {}));
