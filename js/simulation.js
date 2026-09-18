/** DOM-independent falling-particle simulation. All state belongs to one world. */
(function (namespace) {
  "use strict";

  /** Create a blank world. Supply a seeded random function for reproducible scenes. */
  function createSimulation({
    width = 240,
    height = 160,
    random = Math.random,
  } = {}) {
    if (
      !Number.isInteger(width) ||
      !Number.isInteger(height) ||
      width < 4 ||
      height < 4 ||
      width > 512 ||
      height > 512
    ) {
      throw new RangeError(
        "World dimensions must be integers between 4 and 512.",
      );
    }
    if (typeof random !== "function")
      throw new TypeError(
        "random must be a function returning values in [0, 1).",
      );
    const W = width,
      H = height,
      N = W * H;
    const {
      IDs,
      isGas,
      isPowder,
      isLiquid,
      isMobile,
      isSolid,
      isCold,
      isFuel,
    } = namespace.Materials;
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
    const cells = new Uint8Array(N),
      shade = new Uint8Array(N);
    const life = new Uint16Array(N),
      burn = new Uint16Array(N);
    const vx = new Float32Array(N),
      vy = new Float32Array(N);
    const remX = new Float32Array(N),
      remY = new Float32Array(N);
    const grounded = new Uint8Array(N);
    const fuse = new Uint8Array(N);
    const melt = new Float32Array(N);
    const metalHeat = new Float32Array(N),
      heatNext = new Float32Array(N);
    const updated = new Uint32Array(N),
      born = new Uint32Array(N);
    const counts = new Int32Array(18);
    counts[AIR] = N;
    const pendingBlasts = [],
      blastFlashes = [];

    let tick = 0;

    function setCell(i, type) {
      if (
        !Number.isInteger(i) ||
        i < 0 ||
        i >= N ||
        !Number.isInteger(type) ||
        type < AIR ||
        type >= counts.length
      ) {
        throw new RangeError(
          "setCell requires a valid cell index and material ID.",
        );
      }
      counts[cells[i]]--;
      counts[type]++;
      cells[i] = type;
      burn[i] = 0;
      vx[i] =
        vy[i] =
        remX[i] =
        remY[i] =
        fuse[i] =
        melt[i] =
        metalHeat[i] =
        heatNext[i] =
          0;
      grounded[i] = isSolid(type) ? 1 : 0;
      const x = i % W,
        y = (i / W) | 0;
      const patch = ((Math.floor(x / 3) * 73) ^ (Math.floor(y / 3) * 151)) & 7;
      shade[i] =
        type === STONE
          ? Math.max(0, Math.min(7, patch + ((random() * 3) | 0) - 1))
          : type === WOOD
            ? (x + Math.floor(Math.sin(y * 0.21) * 2)) % 5 === 0
              ? 1
              : 4 + ((random() * 3) | 0)
            : type === ICE
              ? (x + y * 2) % 17 === 0 || (x - y + W) % 23 === 0
                ? 7
                : 2 + ((random() * 4) | 0)
              : type === METAL
                ? (y % 7 < 2 ? 6 : 3) + (x % 17 === 0 ? 1 : 0)
                : (random() * 8) | 0;
      life[i] =
        type === FIRE
          ? 35 + ((random() * 45) | 0)
          : type === SMOKE
            ? 180 + ((random() * 160) | 0)
            : type === STEAM
              ? 100 + ((random() * 90) | 0)
              : type === ACID
                ? 6
                : 0;
      updated[i] = born[i] = tick;
    }
    function ignite(i) {
      const type = cells[i];
      if (type === GUNPOWDER) {
        if (fuse[i] === 0) {
          fuse[i] = 3 + ((random() * 5) | 0);
          born[i] = tick;
        }
      } else if (
        type === OIL &&
        burn[i] === 0 &&
        !(i >= W && cells[i - W] === WATER)
      ) {
        burn[i] = 190 + ((random() * 120) | 0);
        born[i] = tick;
      } else if (
        (type === WOOD || type === CHARCOAL) &&
        burn[i] === 0 &&
        !neighbors(i).some((j) => cells[j] === WATER)
      ) {
        burn[i] =
          type === CHARCOAL
            ? 240 + ((random() * 180) | 0)
            : 150 + ((random() * 120) | 0);
        born[i] = tick;
      }
    }
    function put(x, y, type, motionX = 0, motionY = 0) {
      if (
        !Number.isInteger(x) ||
        !Number.isInteger(y) ||
        !Number.isInteger(type) ||
        x < 0 ||
        x >= W ||
        y < 0 ||
        y >= H ||
        type < AIR ||
        type >= counts.length
      )
        return;
      const i = y * W + x;
      if (type === FIRE && (isFuel(cells[i]) || cells[i] === GUNPOWDER)) {
        ignite(i);
        return;
      }
      if (type !== AIR && cells[i] !== AIR && !isGas(cells[i])) return;
      setCell(i, type);
      if (isMobile(type)) {
        const limit = type === LAVA ? 0.8 : 3.5;
        vx[i] = Math.max(-limit, Math.min(limit, motionX));
        vy[i] = Math.max(-limit, Math.min(limit, motionY));
      }
    }
    function brush(x, y, type, solid = false, motionX = 0, motionY = 0) {
      if (type === EXPLOSION) return;
      const r = isSolid(type) ? 3 : type === AIR ? 7 : 4;
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          if (
            dx * dx + dy * dy <= r * r &&
            (isSolid(type) || type === AIR || solid || random() < 0.38)
          )
            put(x + dx, y + dy, type, motionX, motionY);
        }
    }
    function stroke(a, b, type) {
      const length = Math.min(
        600,
        Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y))),
      );
      const motionX = (b.x - a.x) * 0.14,
        motionY = (b.y - a.y) * 0.14;
      for (let j = 0; j <= length; j++)
        brush(
          Math.round(a.x + ((b.x - a.x) * j) / length),
          Math.round(a.y + ((b.y - a.y) * j) / length),
          type,
          false,
          motionX,
          motionY,
        );
    }
    function neighbors(i) {
      const x = i % W,
        result = [];
      if (i >= W) result.push(i - W);
      if (i < N - W) result.push(i + W);
      if (x > 0) result.push(i - 1);
      if (x < W - 1) result.push(i + 1);
      return result;
    }
    function swap(a, b) {
      for (const field of [
        cells,
        shade,
        life,
        burn,
        born,
        vx,
        vy,
        remX,
        remY,
        fuse,
        melt,
        metalHeat,
        heatNext,
      ]) {
        const t = field[a];
        field[a] = field[b];
        field[b] = t;
      }
      updated[a] = updated[b] = tick;
      grounded[a] = grounded[b] = 0;
    }
    function refreshSupport() {
      // Support is a connection to fixed terrain or the floor, not merely an
      // occupied neighboring cell. An airborne column must keep falling.
      for (let i = N - 1; i >= 0; i--) {
        const type = cells[i];
        grounded[i] = isSolid(type)
          ? 1
          : isMobile(type) &&
              Math.abs(vy[i]) < 0.35 &&
              (i >= N - W || grounded[i + W])
            ? 1
            : 0;
      }
    }
    function hasSupportBelow(i, type) {
      return i >= N - W || (!canFallInto(i + W, type) && grounded[i + W] === 1);
    }
    function explode(x, y, radius = 18, power = 6) {
      if (![x, y, radius, power].every(Number.isFinite))
        throw new RangeError("Explosion parameters must be finite numbers.");
      x = Math.max(0, Math.min(W - 1, Math.round(x)));
      y = Math.max(0, Math.min(H - 1, Math.round(y)));
      radius = Math.max(4, Math.min(24, radius));
      power = Math.max(1, Math.min(8, power));
      if (blastFlashes.length >= 24) blastFlashes.shift();
      blastFlashes.push({ x, y, radius, age: 0, duration: 14 });
      for (
        let py = Math.max(0, y - Math.ceil(radius));
        py <= Math.min(H - 1, y + radius);
        py++
      ) {
        for (
          let px = Math.max(0, x - Math.ceil(radius));
          px <= Math.min(W - 1, x + radius);
          px++
        ) {
          const dx = px - x,
            dy = py - y,
            distance = Math.hypot(dx, dy);
          if (distance > radius) continue;
          const i = py * W + px,
            strength = 1 - distance / radius,
            type = cells[i];
          if (type === GUNPOWDER) {
            ignite(i);
          } else if (type === STONE) {
            if (distance < radius * 0.58 || random() < strength * 0.7)
              setCell(i, random() < 0.32 ? DEBRIS : AIR);
          } else if (type === WOOD) {
            if (distance < radius * 0.8 || random() < strength) {
              setCell(i, random() < 0.7 ? CHARCOAL : ASH);
              ignite(i);
            } else ignite(i);
          } else if (type === ICE) {
            // Ice is brittle: the hot center melts it, the fringe scatters snow.
            if (distance < radius * 0.75 || random() < strength)
              setCell(
                i,
                distance < radius * 0.28
                  ? STEAM
                  : distance < radius * 0.55
                    ? WATER
                    : SNOW,
              );
          } else if (type === SNOW) {
            melt[i] += strength * 16;
            if (melt[i] >= 8)
              setCell(i, distance < radius * 0.28 ? STEAM : WATER);
          } else if (type === METAL) {
            metalHeat[i] = Math.min(240, metalHeat[i] + strength * 100);
          } else if (type === OIL || type === CHARCOAL) {
            ignite(i);
          } else if (
            type === WATER &&
            distance < radius * 0.4 &&
            random() < 0.2
          )
            setCell(i, STEAM);
          if (cells[i] === AIR && random() < strength * 0.15) setCell(i, FIRE);
          if (isMobile(cells[i]) || isGas(cells[i])) {
            const angle = distance === 0 ? random() * Math.PI * 2 : 0;
            const ux = distance ? dx / distance : Math.cos(angle),
              uy = distance ? dy / distance : Math.sin(angle);
            const force = power * (0.25 + 0.75 * strength);
            vx[i] = Math.max(-7, Math.min(7, vx[i] + ux * force));
            vy[i] = Math.max(-7, Math.min(7, vy[i] + uy * force - force * 0.2));
            remX[i] = remY[i] = 0;
            grounded[i] = 0;
            updated[i] = tick;
          }
        }
      }
    }
    function detonatePowder(i) {
      // Consume a small packet per event, then ignite neighboring packets.
      // A bounded queue keeps large powder piles responsive without recursion.
      if (pendingBlasts.length >= 96) {
        fuse[i] = 1;
        return;
      }
      const x = i % W,
        y = (i / W) | 0;
      let fuel = 0;
      for (let dy = -3; dy <= 3; dy++)
        for (let dx = -3; dx <= 3; dx++) {
          const px = x + dx,
            py = y + dy;
          if (dx * dx + dy * dy > 9 || px < 0 || px >= W || py < 0 || py >= H)
            continue;
          const j = py * W + px;
          if (cells[j] === GUNPOWDER) {
            fuel++;
            setCell(j, random() < 0.55 ? FIRE : SMOKE);
          }
        }
      pendingBlasts.push({
        x,
        y,
        radius: 7 + Math.min(4, Math.sqrt(fuel)),
        power: 4 + Math.min(2, fuel * 0.09),
      });
    }
    function processBlasts() {
      const amount = Math.min(8, pendingBlasts.length);
      for (let n = 0; n < amount; n++) {
        const blast = pendingBlasts.shift();
        explode(blast.x, blast.y, blast.radius, blast.power);
      }
    }
    function updateMetalHeat() {
      if (counts[METAL] === 0) return;
      // Read the previous field for every cell so heat cannot race across a
      // whole plate in one scan. Values are relative heat, not real degrees.
      for (let i = 0; i < N; i++) {
        if (cells[i] !== METAL) continue;
        const current = metalHeat[i];
        let change = -0.12;
        for (const j of neighbors(i)) {
          const type = cells[j];
          if (type === METAL) change += (metalHeat[j] - current) * 0.2;
          else if (type === LAVA) change += 16;
          else if (type === FIRE) change += 6;
          else if (isFuel(type) && burn[j] > 0) change += 5;
          else if (type === WATER) change -= Math.min(5, current * 0.15);
          else if (isCold(type)) change -= Math.min(2, current * 0.05);
        }
        heatNext[i] = Math.max(0, Math.min(240, current + change));
      }
      metalHeat.set(heatNext);
    }
    function reactions() {
      updateMetalHeat();
      // Cold cells absorb heat before flames can spread. Melt progress belongs
      // to the particle, so moving snow keeps its accumulated warmth.
      for (let n = 0; n < N; n++) {
        const i = tick & 1 ? n : N - 1 - n,
          type = cells[i];
        if (!isCold(type) || born[i] === tick) continue;
        let heat = 0;
        for (const j of neighbors(i)) {
          const other = cells[j];
          if (other === LAVA) {
            setCell(j, STONE);
            setCell(i, STEAM);
            break;
          }
          if (other === FIRE) {
            setCell(j, AIR);
            heat += 8;
          } else if (isFuel(other) && burn[j] > 0) heat += 2;
          else if (other === METAL && metalHeat[j] > 25) {
            const absorbed = Math.min(4, metalHeat[j] / 40);
            heat += absorbed;
            metalHeat[j] -= absorbed;
          } else if (other === STEAM) {
            setCell(j, WATER);
            heat += 8;
          } else if (other === WATER) heat += type === SNOW ? 2 : 0.15;
        }
        if (cells[i] !== type) continue;
        melt[i] += heat;
        if (melt[i] >= (type === SNOW ? 8 : 40)) {
          const mx = vx[i],
            my = vy[i],
            rx = remX[i],
            ry = remY[i];
          setCell(i, WATER);
          vx[i] = mx;
          vy[i] = my;
          remX[i] = rx;
          remY[i] = ry;
        }
      }
      // Cooling happens before movement, so touching water cannot escape a
      // reaction merely because it was visited first in the movement scan.
      for (let i = 0; i < N; i++) {
        if (cells[i] !== WATER || born[i] === tick) continue;
        const near = neighbors(i);
        for (const j of near) {
          if (cells[j] === LAVA) {
            setCell(j, STONE);
            setCell(i, STEAM);
            break;
          }
          if (cells[j] === FIRE) setCell(j, AIR);
          if ((cells[j] === WOOD || cells[j] === CHARCOAL) && burn[j] > 0)
            burn[j] = 0;
        }
      }
      for (let n = 0; n < N; n++) {
        const i = tick & 1 ? n : N - 1 - n,
          type = cells[i];
        if (
          type === AIR ||
          type === SAND ||
          type === STONE ||
          type === WATER ||
          type === ASH ||
          isCold(type) ||
          born[i] === tick
        )
          continue;
        if (type === SMOKE || type === STEAM) {
          if (life[i] > 0) life[i]--;
          if (life[i] === 0) setCell(i, AIR);
          continue;
        }
        const near = neighbors(i);
        if (type === FIRE) {
          // Water next to a flame extinguishes it before it can ignite wood.
          if (near.some((j) => cells[j] === WATER)) {
            setCell(i, AIR);
            continue;
          }
          for (const j of near) ignite(j);
          if (life[i] > 0) life[i]--;
          if (life[i] === 0) setCell(i, random() < 0.8 ? SMOKE : AIR);
        } else if (isFuel(type) && burn[i] > 0) {
          if (
            type === OIL
              ? i >= W && cells[i - W] === WATER
              : near.some((j) => cells[j] === WATER)
          ) {
            burn[i] = 0;
            continue;
          }
          burn[i]--;
          if (burn[i] === 0) {
            if (type === WOOD) {
              setCell(i, CHARCOAL);
              ignite(i);
            } else if (type === CHARCOAL) {
              const mx = vx[i],
                my = vy[i],
                rx = remX[i],
                ry = remY[i];
              setCell(i, ASH);
              vx[i] = mx;
              vy[i] = my;
              remX[i] = rx;
              remY[i] = ry;
            } else setCell(i, random() < 0.7 ? SMOKE : AIR);
            continue;
          }
          for (const j of near) {
            if (
              random() <
              (type === OIL ? 0.06 : type === CHARCOAL ? 0.025 : 0.012)
            )
              ignite(j);
            const emission =
              type === CHARCOAL
                ? j === i - W
                  ? 0.045
                  : 0.004
                : j < i
                  ? 0.17
                  : 0.025;
            if (cells[j] === AIR && random() < emission)
              setCell(
                j,
                random() < (type === CHARCOAL ? 0.25 : 0.82) ? FIRE : SMOKE,
              );
          }
        } else if (type === METAL && metalHeat[i] > 0) {
          for (const j of near) {
            if (cells[j] === WATER && metalHeat[i] >= 100) {
              setCell(j, STEAM);
              metalHeat[i] -= 55;
            } else if (metalHeat[i] >= 85) ignite(j);
          }
        } else if (type === GUNPOWDER && fuse[i] > 0) {
          fuse[i]--;
          if (fuse[i] === 0) detonatePowder(i);
        } else if (type === LAVA) {
          for (const j of near) ignite(j);
          if (i >= W && cells[i - W] === AIR && random() < 0.009)
            setCell(i - W, FIRE);
        } else if (type === ACID) {
          const offset = (random() * near.length) | 0;
          for (let k = 0; k < near.length; k++) {
            const j = near[(k + offset) % near.length],
              target = cells[j];
            const chance =
              target === METAL
                ? 0.008
                : target === STONE
                  ? 0.04
                  : target === WOOD
                    ? 0.18
                    : target === ICE
                      ? 0.16
                      : isPowder(target)
                        ? 0.12
                        : 0;
            if (chance && random() < chance) {
              setCell(j, isCold(target) ? WATER : AIR);
              life[i]--;
              if (life[i] === 0) setCell(i, WATER);
              break;
            }
          }
        }
      }
    }
    function canFallInto(j, type, downward = true) {
      const other = cells[j];
      if (other === AIR) return true;
      // Density displacement is allowed after the water's own update. Both
      // endpoints are stamped by swap so displaced water is not updated again.
      if (
        downward &&
        isPowder(type) &&
        type !== SNOW &&
        (other === WATER || other === ACID || other === OIL)
      )
        return true;
      if (downward && (type === WATER || type === ACID) && other === OIL)
        return true;
      if (downward && isLiquid(type) && other === SNOW) return true;
      if (updated[j] === tick) return false;
      if (isGas(other)) return true;
      return false;
    }
    function canTravel(i, dx, dy, type) {
      const x = i % W,
        y = (i / W) | 0,
        nx = x + dx,
        ny = y + dy;
      if (nx < 0 || nx >= W || ny < 0 || ny >= H) return false;
      if (!canFallInto(ny * W + nx, type, dy > 0)) return false;
      // A diagonal move needs at least one open orthogonal route. This keeps
      // particles out of sealed corners while still allowing sand to slide.
      if (
        dx &&
        dy &&
        !canFallInto(i + dx, type, false) &&
        !canFallInto(i + dy * W, type, dy > 0)
      )
        return false;
      return true;
    }
    function traceMotion(start, dx, dy, type) {
      let i = start,
        lastX = 0,
        lastY = 0,
        hitX = false,
        hitY = false,
        displaced = false,
        blockY = -1;
      const steps = Math.max(Math.abs(dx), Math.abs(dy));
      for (let s = 1; s <= steps; s++) {
        const ox = Math.round((dx * s) / steps),
          oy = Math.round((dy * s) / steps);
        const sx = ox - lastX,
          sy = oy - lastY;
        lastX = ox;
        lastY = oy;
        if (!canTravel(i, sx, sy, type)) {
          hitX = sx !== 0;
          hitY = sy !== 0;
          const x = i % W,
            y = (i / W) | 0,
            nx = x + sx,
            ny = y + sy;
          if (sy) {
            // A sidewall is not vertical support when the cell directly below
            // is another falling particle. Prefer that actual vertical blocker.
            const vertical = i + sy * W;
            blockY =
              ny < 0 || ny >= H
                ? -2
                : !canFallInto(vertical, type, sy > 0)
                  ? vertical
                  : nx < 0 || nx >= W
                    ? vertical
                    : ny * W + nx;
            if (blockY >= 0 && canFallInto(blockY, type, sy > 0))
              blockY = i + sy * W;
          }
          // Slide along an obstacle if one component of the path is free.
          if (sx && sy && canTravel(i, sx, 0, type)) {
            const j = i + sx;
            displaced = cells[j] !== AIR;
            swap(i, j);
            i = j;
            hitX = false;
          } else if (sx && sy && canTravel(i, 0, sy, type)) {
            const j = i + sy * W;
            displaced = cells[j] !== AIR;
            swap(i, j);
            i = j;
            hitY = false;
          }
          break;
        }
        const j = i + sx + sy * W;
        displaced = cells[j] !== AIR;
        swap(i, j);
        i = j;
        // Stop at a displaced liquid/gas cell so momentum cannot repeatedly
        // exchange one particle through an entire column in the same tick.
        if (displaced) break;
      }
      return { i, hitX, hitY, displaced, blockY };
    }
    function settle(start, type) {
      let i = start;
      const x = i % W,
        y = (i / W) | 0;
      if (vy[i] < -0.1 || !hasSupportBelow(i, type)) return i;
      const dir =
        Math.abs(vx[i]) > 0.2 ? Math.sign(vx[i]) : random() < 0.5 ? -1 : 1;
      for (const d of [dir, -dir]) {
        if (canTravel(i, d, 1, type)) {
          const j = i + W + d;
          swap(i, j);
          vx[j] = d * (type === LAVA ? 0.18 : 0.45);
          vy[j] = 0.25;
          remX[j] = remY[j] = 0;
          return j;
        }
      }
      if (isPowder(type)) {
        vx[i] *= 0.25;
        vy[i] = 0;
        remX[i] = remY[i] = 0;
        return i;
      }
      for (const d of [dir, -dir]) {
        if (!canTravel(i, d, 0, type)) continue;
        const distance = type === LAVA || type === OIL ? 1 : 2;
        const result = traceMotion(i, d * distance, 0, type);
        i = result.i;
        vx[i] = d * (type === LAVA ? 0.2 : 0.65);
        vy[i] = 0;
        remX[i] = remY[i] = 0;
        return i;
      }
      vx[i] = vy[i] = remX[i] = remY[i] = 0;
      return i;
    }
    function moveDown() {
      for (let y = H - 1; y >= 0; y--) {
        const forward = ((tick + y) & 1) === 0;
        for (let n = 0; n < W; n++) {
          const x = forward ? n : W - 1 - n,
            start = y * W + x,
            type = cells[start];
          if (!isMobile(type) || updated[start] === tick) continue;
          updated[start] = tick;
          const thick = type === LAVA,
            soft = type === SNOW,
            dust = type === ASH;
          vx[start] *= thick
            ? 0.8
            : dust
              ? 0.9
              : soft || type === OIL
                ? 0.94
                : 0.985;
          const gravity = thick
            ? 0.055
            : soft
              ? 0.045
              : dust
                ? 0.06
                : type === CHARCOAL
                  ? 0.12
                  : 0.16;
          const terminal = thick
            ? 1.1
            : soft
              ? 0.9
              : dust
                ? 1.2
                : type === CHARCOAL
                  ? 3.5
                  : 4.5;
          vy[start] = Math.min(terminal, vy[start] + gravity);
          vx[start] = Math.max(-5, Math.min(5, vx[start]));
          vy[start] = Math.max(-4.5, vy[start]);
          const targetX = remX[start] + vx[start],
            targetY = remY[start] + vy[start];
          const dx = Math.trunc(targetX),
            dy = Math.trunc(targetY);
          remX[start] = targetX - dx;
          remY[start] = targetY - dy;
          const impact = vy[start],
            result = traceMotion(start, dx, dy, type);
          let i = result.i;
          if (result.displaced) {
            vx[i] *= 0.45;
            vy[i] *= 0.4;
            remX[i] = remY[i] = 0;
          }
          // Particle contacts are inelastic: do not invent a sideways rebound.
          if (result.hitX) {
            vx[i] = 0;
            remX[i] = 0;
          }
          const supported = hasSupportBelow(i, type);
          if (result.hitY || (!result.displaced && impact > 0 && supported)) {
            remY[i] = 0;
            const stableHit =
              supported ||
              (result.hitY &&
                dy > 0 &&
                ((result.blockY === -2 && i >= N - W) ||
                  (result.blockY >= 0 && grounded[result.blockY] === 1)));
            if (
              stableHit &&
              impact > 2 &&
              (type === WATER || type === ACID || type === OIL)
            ) {
              const direction =
                Math.abs(vx[i]) > 0.25
                  ? Math.sign(vx[i])
                  : random() < 0.5
                    ? -1
                    : 1;
              const damping = type === OIL ? 0.6 : 1;
              vx[i] =
                direction *
                Math.min(3.2, impact * (0.4 + random() * 0.25)) *
                damping;
              vy[i] = -impact * (0.2 + random() * 0.15) * damping;
            } else if (!stableHit && impact > 0 && result.blockY >= 0) {
              // A faster falling particle catches up to the particle below it.
              // Match its downward speed instead of converting speed into lift.
              vy[i] = Math.min(impact, Math.max(0, vy[result.blockY]));
            } else {
              vy[i] = 0;
              if (isPowder(type) || thick) vx[i] *= 0.4;
            }
          }
          // Lava's settling flow is also throttled, while falling speed is
          // governed by its acceleration and terminal velocity above.
          if (!result.displaced && (!thick || tick % 3 === 0))
            i = settle(i, type);
          updated[i] = tick;
          grounded[i] =
            Math.abs(vy[i]) < 0.35 && hasSupportBelow(i, type) ? 1 : 0;
        }
      }
    }
    function moveGas() {
      for (let y = 0; y < H; y++) {
        const forward = ((tick + y) & 1) === 0;
        for (let n = 0; n < W; n++) {
          const x = forward ? n : W - 1 - n,
            i = y * W + x;
          if (!isGas(cells[i]) || updated[i] === tick) continue;
          if (y === 0) {
            setCell(i, AIR);
            continue;
          }
          if (Math.abs(vx[i]) + Math.abs(vy[i]) > 0.25) {
            vx[i] *= 0.9;
            vy[i] = (vy[i] - 0.08) * 0.9;
            const ax = remX[i] + vx[i],
              ay = remY[i] + vy[i];
            const dx = Math.trunc(ax),
              dy = Math.trunc(ay);
            remX[i] = ax - dx;
            remY[i] = ay - dy;
            const result = traceMotion(i, dx, dy, cells[i]),
              j = result.i;
            if (result.hitX) {
              vx[j] = 0;
              remX[j] = 0;
            }
            if (result.hitY) {
              vy[j] = 0;
              remY[j] = 0;
            }
            updated[j] = tick;
            continue;
          }
          vx[i] = vy[i] = 0;
          const d = random() < 0.5 ? -1 : 1;
          let dest = -1;
          const order = random() < 0.38 ? [d, 0, -d] : [0, d, -d];
          for (const dx of order) {
            if (x + dx < 0 || x + dx >= W) continue;
            const j = i - W + dx;
            if (cells[j] === AIR && (dx === 0 || cells[i + dx] === AIR)) {
              dest = j;
              break;
            }
          }
          if (dest < 0)
            for (const dx of [d, -d]) {
              if (x + dx >= 0 && x + dx < W && cells[i + dx] === AIR) {
                dest = i + dx;
                break;
              }
            }
          if (dest >= 0) swap(i, dest);
        }
      }
    }
    function step() {
      tick = (tick + 1) >>> 0;
      if (tick === 0) {
        updated.fill(0);
        born.fill(0);
        tick = 1;
      }
      for (let n = blastFlashes.length - 1; n >= 0; n--) {
        blastFlashes[n].age++;
        if (blastFlashes[n].age >= blastFlashes[n].duration)
          blastFlashes.splice(n, 1);
      }
      reactions();
      processBlasts();
      refreshSupport();
      moveDown();
      moveGas();
    }

    /** Clear particles and all transient physics state without touching UI selection. */
    function reset() {
      for (const field of [
        cells,
        shade,
        life,
        burn,
        updated,
        born,
        vx,
        vy,
        remX,
        remY,
        grounded,
        fuse,
        melt,
        metalHeat,
        heatNext,
      ])
        field.fill(0);
      pendingBlasts.length = blastFlashes.length = 0;
      counts.fill(0);
      counts[AIR] = N;
      tick = 0;
    }

    return {
      ...IDs,
      W,
      H,
      N,
      cells,
      shade,
      life,
      burn,
      updated,
      born,
      vx,
      vy,
      remX,
      remY,
      grounded,
      fuse,
      melt,
      metalHeat,
      heatNext,
      counts,
      pendingBlasts,
      blastFlashes,
      put,
      setCell,
      brush,
      stroke,
      step,
      reset,
      ignite,
      explode,
      neighbors,
      refreshSupport,
      traceMotion,
      get tick() {
        return tick;
      },
    };
  }
  namespace.createSimulation = createSimulation;
})((globalThis.PixelSandbox = globalThis.PixelSandbox || {}));
