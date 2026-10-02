# Architecture

## Responsibilities and loading

The browser loads four ordinary deferred scripts in this order:

1. `materials.js` defines the stable material IDs and category helpers.
2. `simulation.js` defines the particle engine.
3. `renderer.js` defines the Canvas 2D renderer.
4. `app.js` creates the engine and renderer, attaches controls, and starts the animation loop.

Each module adds its API to `globalThis.PixelSandbox`. This small shared namespace allows the page to run directly from `file://` without an ES-module server or a bundler. The simulation itself has no DOM dependency and can run in the Node test harness.

## Grid and state

The default grid is 240 cells wide and 160 high. A cell at `(x, y)` has linear index `y * width + x`. Each location contains one material ID. Material metadata is separate from per-cell state.

| Field                   | Meaning                                                                                       |
| ----------------------- | --------------------------------------------------------------------------------------------- |
| `cells`, `shade`        | Material ID and stable texture variation.                                                     |
| `life`, `burn`          | Lifetime, acid strength, and remaining combustion duration.                                   |
| `vx`, `vy`              | Horizontal and vertical velocity in cells per simulation tick. Positive `vy` points downward. |
| `remX`, `remY`          | Fractional movement carried into the next tick.                                               |
| `grounded`              | Connection to fixed terrain or the floor.                                                     |
| `fuse`                  | Remaining gunpowder ignition delay.                                                           |
| `melt`                  | Accumulated melting progress for ice and snow.                                                |
| `metalHeat`, `heatNext` | Current and next relative metal heat fields. These are not degrees.                           |
| `updated`, `born`       | Tick stamps that control movement and newborn reactions.                                      |
| `counts`                | Count of every material, including empty cells.                                               |

Typed arrays keep the fixed-size fields compact. Particle swaps transfer their associated state, including burning, fuse, and melting progress. Replacing a cell clears obsolete state and updates the material counts. Use engine mutation methods instead of writing directly to `cells`; direct writes can make counts and particle metadata inconsistent.

`pendingBlasts` holds delayed gunpowder events. `blastFlashes` holds short-lived rendering effects. `reset()` clears all simulation state and restores the empty-cell count. Selection, pause state, pointer capture, and animation timing belong to the application layer.

## A simulation tick

`step()` advances the integer tick and performs these stages:

1. Age the visible blast effects.
2. Conduct metal heat, react cold materials, cool materials with water, and process burning, fuses, lava, and acid.
3. Process a bounded batch of queued explosions.
4. Recompute support from fixed terrain and the floor.
5. Move powders and liquids from bottom to top, alternating the horizontal scan direction.
6. Move gases from top to bottom.

Reaction ordering matters. Cooling occurs before movement, so a touching water particle cannot evade its reaction merely by moving first. A newborn particle does not immediately repeat a reaction in its creation tick. Metal conduction reads the previous heat field and writes the next field, preventing heat from racing across an entire plate in one scan.

The application schedules ticks at a nominal 60 Hz using `requestAnimationFrame` and an accumulator. It caps elapsed time and catch-up work to avoid a long backlog after a slow or inactive frame. Rendering and input remain available while physics is paused.

## Motion and contact

Moving material accumulates gravity and fractional displacement. Path tracing visits intermediate grid locations before moving a fast particle, which prevents ordinary movement from jumping through a thin wall. Diagonal travel requires an open orthogonal route, avoiding leaks through sealed corners.

Contact with another falling particle is inelastic: a faster particle catches up and matches downward motion instead of gaining upward velocity. Splashes require a sufficiently fast liquid impact against actual support. Merely having an occupied cell underneath is not enough. This distinction preserves the fix for particles bouncing against each other in midair.

At rest, powders try to move diagonally downward. Liquids also spread horizontally. Material-specific drag, gravity, terminal speed, and settling limits distinguish lava, oil, snow, ash, and charcoal. Density displacement is a small set of explicit rules, not a general mass solver.

## Reactions and explosions

Reactions inspect orthogonal neighbors with boundary checks. Combustion uses counters and probabilistic spread. Acid has a finite number of successful dissolution events. Cold material accumulates melt progress; metal stores and diffuses relative heat.

Explosions damage cells within a bounded radius and add outward velocity to mobile material and gases. Metal survives a blast but gains heat. Gunpowder consumes a local packet, then queues an explosion that can ignite another packet. Event and flash limits prevent unbounded recursive chain reactions.

Blast influence is not occlusion-aware: a barrier can survive while material on its far side is affected. Subsequent particle motion still observes grid collisions.

## Rendering and input

The renderer resolves CSS color tokens, builds shade variants, and writes an `ImageData` frame. It adds exposed-edge highlights, animated fire, fading gases, heated-metal glow, charcoal embers, and blast rings. Logical pixels are scaled with pixelated CSS rendering.

The application maps pointer coordinates to logical grid coordinates, interpolates brush strokes, manages pointer capture, and updates native buttons and status text. It starts on a blank canvas and respects the initial reduced-motion preference by starting paused.

The architecture intentionally keeps physics, appearance, and controls separate. UI changes should not need new simulation rules, and physics tests should not require a canvas.
