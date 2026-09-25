/** Canvas rendering and theme resolution. No simulation state is changed here. */
(function (namespace) {
  "use strict";

  function createRenderer(canvas, simulation, root) {
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx)
      throw new Error("This browser could not create a 2D canvas context.");
    const { IDs, isSolid, paletteTokens, noise } = namespace.Materials;
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
    const { W, H, N, cells, shade, life, burn, fuse, metalHeat, blastFlashes } =
      simulation;
    canvas.width = W;
    canvas.height = H;
    const frame = ctx.createImageData(W, H);
    let palette = [];
    const probe = document.createElement("span");
    probe.style.display = "none";
    root.appendChild(probe);
    const colorCanvas = document.createElement("canvas");
    colorCanvas.width = colorCanvas.height = 1;
    const colorCtx = colorCanvas.getContext("2d", { willReadFrequently: true });
    function resolveColor(token) {
      probe.style.color = "var(" + token + ")";
      colorCtx.clearRect(0, 0, 1, 1);
      colorCtx.fillStyle = getComputedStyle(probe).color;
      colorCtx.fillRect(0, 0, 1, 1);
      return [...colorCtx.getImageData(0, 0, 1, 1).data].slice(0, 3);
    }
    function refreshColors() {
      const bases = paletteTokens.map(resolveColor);
      palette = bases.map((base, type) =>
        Array.from({ length: 24 }, (_, s) => {
          const variation =
            ((s % 8) - 3.5) * noise[type] + (s >= 16 ? -19 : s >= 8 ? 24 : 0);
          return base.map((c) =>
            Math.max(0, Math.min(255, Math.round(c + variation))),
          );
        }),
      );
    }

    function draw() {
      const tick = simulation.tick;
      const bg = palette[AIR][0];
      for (let i = 0; i < N; i++) {
        const type = cells[i];
        let variant = shade[i],
          displayType = type;
        if (type === SNOW) {
          if (i >= W && cells[i - W] === SNOW) variant += 16;
        } else if (isSolid(type)) {
          if (i < W || cells[i - W] !== type) variant += 8;
          else if (i >= N - W || cells[i + W] !== type) variant += 16;
          if (type === WOOD && burn[i] > 0) {
            displayType = FIRE;
            variant = (shade[i] + (tick >> 2)) & 7;
          }
        } else if (type === WATER || type === ACID || type === OIL) {
          if (i < W || cells[i - W] === AIR) variant += 8;
        } else if (type === LAVA || type === FIRE)
          variant = (shade[i] + (tick >> 2)) & 7;
        if (type === OIL && burn[i] > 0) {
          displayType = FIRE;
          variant = (shade[i] + (tick >> 2)) & 7;
        }
        if (type === GUNPOWDER && fuse[i] > 0) {
          displayType = FIRE;
          variant = shade[i];
        }
        let c = palette[displayType][variant];
        const p = i * 4;
        const glow =
          type === METAL
            ? Math.max(0, Math.min(0.9, (metalHeat[i] - 30) / 210))
            : type === CHARCOAL && burn[i] > 0
              ? 0.65 + 0.15 * (((tick >> 3) + shade[i]) & 1)
              : 0;
        if (glow) {
          const ember = palette[LAVA][shade[i]];
          c = c.map((channel, k) => channel + (ember[k] - channel) * glow);
        }
        const alpha =
          type === SMOKE || type === STEAM ? Math.min(0.82, life[i] / 90) : 1;
        frame.data[p] = bg[0] + (c[0] - bg[0]) * alpha;
        frame.data[p + 1] = bg[1] + (c[1] - bg[1]) * alpha;
        frame.data[p + 2] = bg[2] + (c[2] - bg[2]) * alpha;
        frame.data[p + 3] = 255;
      }
      for (const flash of blastFlashes) {
        const progress = flash.age / flash.duration,
          reach = flash.radius * (0.2 + 0.8 * progress);
        const color = palette[FIRE][12];
        for (
          let y = Math.max(0, Math.floor(flash.y - reach - 2));
          y <= Math.min(H - 1, flash.y + reach + 2);
          y++
        ) {
          for (
            let x = Math.max(0, Math.floor(flash.x - reach - 2));
            x <= Math.min(W - 1, flash.x + reach + 2);
            x++
          ) {
            const distance = Math.hypot(x - flash.x, y - flash.y);
            const ring = Math.abs(distance - reach) < 1.1 ? 0.5 : 0;
            const center =
              Math.max(0, 1 - distance / Math.max(1, flash.radius * 0.5)) *
              0.45;
            const alpha = Math.max(ring, center) * (1 - progress),
              p = (y * W + x) * 4;
            for (let k = 0; k < 3; k++)
              frame.data[p + k] =
                frame.data[p + k] * (1 - alpha) + color[k] * alpha;
          }
        }
      }
      ctx.putImageData(frame, 0, 0);
    }

    function dispose() {
      probe.remove();
    }
    refreshColors();
    return { draw, refreshColors, dispose };
  }
  namespace.createRenderer = createRenderer;
})((globalThis.PixelSandbox = globalThis.PixelSandbox || {}));
