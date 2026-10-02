# Development guide

## Requirements

- Playing: a current JavaScript-enabled browser with Canvas 2D and pointer-event support.
- Development scripts and automated tests: Node.js 20 or newer.
- No third-party packages, framework, compiler, or asset pipeline.

Run commands from the directory containing `package.json`:

```sh
npm start
npm run check
npm test
```

`npm start` runs the local server at `http://127.0.0.1:8080`. It stays active until you press Ctrl+C. Run checks and tests in a second terminal, or stop the server first. `npm run check` and `npm test` exit after their work finishes. No `npm install` is needed.

The same commands can be run without npm:

```sh
node scripts/serve.cjs
node scripts/check.cjs
node scripts/test.cjs
```

## Editing the project

Open the extracted folder in your editor. Change markup in `index.html`, appearance in `css/styles.css`, rules in `js/simulation.js`, and input behavior in `js/app.js`. Refresh the browser after saving. There is no generated output to commit and no build command to run.

Preserve the script order in `index.html`: materials, simulation, renderer, app. These files use the `PixelSandbox` global namespace; they are not ES modules. Changing to `type="module"` would change the direct-file opening behavior and requires a deliberate project-wide migration.

## Engine API example

After loading `materials.js` and `simulation.js`, code can create an engine without creating a UI:

```js
const { Materials, createSimulation } = globalThis.PixelSandbox;
const { SAND, STONE, WATER } = Materials.IDs;

const simulation = createSimulation({
  width: 240,
  height: 160,
  random: Math.random,
});

for (let x = 80; x < 160; x += 1) {
  simulation.put(x, 120, STONE);
}
simulation.brush(105, 30, SAND, true);
simulation.brush(135, 30, WATER, true);

for (let tick = 0; tick < 120; tick += 1) {
  simulation.step();
}

simulation.explode(120, 105, 12, 5);
simulation.reset();
```

`put(x, y, type, motionX = 0, motionY = 0)` follows painting rules: it will not overwrite occupied non-gas cells, except that erasing removes material and painting fire can ignite existing fuel. `brush` applies a circular stamp. `stroke` interpolates between `{x, y}` points. `explode` accepts grid coordinates, radius, and power; radius and power are bounded by the engine. `step()` advances one simulation tick, and `reset()` returns the engine to an empty state.

For fixtures or intentional replacement, `setCell(index, type)` manages counts and particle metadata. Treat it as a low-level method: calculate an in-bounds index and use a real stored material ID. Never pass the explosion tool ID as a cell type.

Inject a seeded `random` function for reproducible tests. The default uses `Math.random`, so interactive outcomes vary.

## Adding a material

1. Append a stable ID and update metadata, counts, category helpers, and palette tables. Keep the tool-only explosion ID out of cell arrays.
2. Add a CSS color token with readable light and dark appearances, and decide how the renderer textures or highlights it.
3. Define initialization and particle metadata. Any new per-particle field must be initialized, swapped, and reset correctly.
4. Define motion: fixed solid, powder, liquid, or gas. Review gravity, drag, terminal speed, support, and density displacement.
5. Define reactions and their order, including water, fire, lava, acid, cold material, metal heat, and explosions. Ensure finite fuels or counters terminate.
6. Add the control, description, and keyboard-accessible Add behavior where appropriate.
7. Test meaningful interactions, conservation where expected, boundaries, state transfer, and reset. Preserve the midair collision regression checks.
8. Update `MATERIALS.md`, this documentation when the API changes, and `CHANGELOG.md`.

## Changing grid size

The engine constructor accepts integer dimensions from 4 through 512 cells per axis. Keep the renderer's canvas dimensions and pointer-coordinate mapping aligned with the simulation. Larger grids increase the cost of full-grid reactions, support scans, movement, and rendering; do not assume a visually larger canvas requires more logical cells.

## Static deployment

Copy `index.html`, `css/`, and `js/` to any static host while preserving relative paths. Documentation, tests, and development scripts do not need to be hosted. No server-side runtime or environment secrets are required. The bundled HTTP server is a local development tool, not a hardened public service.

## Troubleshooting

| Symptom                               | Check                                                                                                                         |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| The page is blank or unstyled         | Extract the whole ZIP and preserve adjacent `css` and `js` folders. Do not open a file from inside the compressed archive.    |
| Nothing moves                         | Select Resume; reduced-motion preferences start the simulation paused.                                                        |
| A material will not overwrite another | Erase first. Painting intentionally avoids replacing occupied non-gas cells.                                                  |
| `node` or `npm` is not recognized     | Use direct-file mode to play, or install Node.js 20+ and reopen the terminal for development.                                 |
| Port 8080 is busy                     | Choose another port: macOS/Linux `PORT=8081 npm start`; PowerShell `$env:PORT=8081; npm start`. Open `http://127.0.0.1:8081`. |
| Tests cannot find files               | Run them from the project folder containing `package.json`.                                                                   |
| Your changes do not appear            | Save the edited file, refresh, and inspect the browser console for errors or failed file loads.                               |

For a reproducible bug report, include the material arrangement, sequence of actions, pause state, browser/version, and any console error.
