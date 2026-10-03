# Pixel Sandbox

A falling-sand simulator made with plain HTML, CSS, and JavaScript. Paint materials onto a blank canvas and experiment with flowing water, fire, cooling, corrosion, heat conduction, and explosions.

This is an original, Noita-inspired experiment. It does not use Noita's engine, source code, or assets.

## Open and play

1. Extract the complete ZIP. Keep `index.html`, `css`, and `js` together.
2. On macOS, double-click the ZIP in Finder, then open `index.html`. On Windows, choose **Extract All**, open the extracted folder, then double-click `index.html`.
3. If the file opens in an editor, right-click it and choose **Open With** → your browser.

The simulator runs directly from that file. You do not need Node.js, an account, an internet connection, or an installation step to play. Use a current browser with JavaScript and Canvas 2D enabled.

## Controls

| Control            | Action                                                                                         |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| Material buttons   | Select what to paint.                                                                          |
| Drag on the canvas | Paint with a mouse, pen, or touch. Dragging also gives moving particles an initial velocity.   |
| Add material       | Place the selected material near the top center; useful without pointer painting.              |
| Explosion          | Select the tool and click the canvas for one blast. Its action button detonates at the center. |
| Eraser             | Drag to remove material. Its action button erases the center.                                  |
| Pause / Resume     | Stop or restart simulation updates. Painting and manual explosions still work while paused.    |
| Reset canvas       | Clear all particles, heat, and explosion effects. Keep the selected material and pause state.  |

The canvas starts empty. If your device requests reduced motion, it starts paused; select **Resume** when ready. Buttons support normal keyboard focus and activation. The Add button provides a keyboard alternative for adding material, but arbitrary canvas painting requires a pointing device.

## Included features

- Fifteen selectable materials: sand, stone, water, lava, smoke, wood, fire, acid, oil, gunpowder, ice, snow, metal, ash, and charcoal.
- Gravity, particle velocity, piles, density swaps, and liquid splashes against supported surfaces.
- Oil that floats on water; gunpowder chain reactions and a manual explosion tool.
- Ice and snow that melt, cold material that cools lava, and internal steam particles.
- Fixed metal that conducts relative heat, resists blasts, and slowly corrodes in acid.
- Wood that chars into charcoal; charcoal that smolders into falling ash.
- Textured pixel rendering, system light/dark themes, pause, reset, and live particle count.

The default grid is 240 × 160 cells. The rules aim for responsive, understandable interactions, rather than physically accurate chemistry or a complete recreation of Noita. See [material behavior](docs/MATERIALS.md) for the exact distinctions.

## Run a local server

This is optional, but convenient during development. Install Node.js 20 or newer, open Terminal on macOS or PowerShell on Windows, and move into the extracted project folder:

```sh
cd path/to/pixel-sandbox
npm start
```

Open <http://127.0.0.1:8080> in your browser. Keep the terminal running; press **Ctrl+C** to stop the server. If the folder path contains spaces, enclose it in quotes. For example: `cd "/Users/your-name/Downloads/pixel-sandbox"`.

There are no npm dependencies and no `npm install` or build step. You can also start the server with `node scripts/serve.cjs`.

## Project layout

| Path                 | Purpose                                                         |
| -------------------- | --------------------------------------------------------------- |
| `index.html`         | Standalone page and accessible controls.                        |
| `css/styles.css`     | Layout, component styles, and material color tokens.            |
| `js/materials.js`    | Material IDs, metadata, palettes, and category helpers.         |
| `js/simulation.js`   | DOM-independent particle state, motion, and reactions.          |
| `js/renderer.js`     | Canvas pixels, material textures, heat glow, and blast effects. |
| `js/app.js`          | Input handling, UI state, timing, and application startup.      |
| `scripts/`           | Dependency-free local server and project checks.                |
| `tests/`             | Automated Node.js regression tests.                             |
| `docs/`              | Engine, materials, development, and testing documentation.      |
| `.github/workflows/` | Automated repository checks.                                    |

## Develop and verify

```sh
npm run check
npm test
```

The application uses ordinary deferred scripts and a shared `globalThis.PixelSandbox` namespace. It has no bundler, framework, external fonts, or CDN assets. Edit a file, save it, and refresh the browser.

Start with [development setup](docs/DEVELOPMENT.md), [architecture](docs/ARCHITECTURE.md), and [testing](docs/TESTING.md). See [CONTRIBUTING.md](CONTRIBUTING.md) before changing the simulation rules.

## Limitations

- Fixed stone, wood, ice, and metal remain suspended when unsupported; there is no rigid-body simulation.
- Heat exists as local melt progress and a relative heat field in metal, not a world-wide temperature or pressure solver.
- Blast effects use a radius and distance falloff. A wall does not shield material within that radius.
- There is no save/load, undo, multiplayer, sound, or persistent scene storage. Reloading or resetting clears the scene.
- Automated physics checks do not replace testing the interface in a real browser.

For static hosting, serve the project folder with `index.html` as its entry point. There is no application backend or production build. The bundled server is intended for local development.

## Project status and licensing

This package exports the simulator developed through the current material additions. See [CHANGELOG.md](CHANGELOG.md) for the included scope and [NOTICE.md](NOTICE.md) for attribution and licensing status. No open-source license has been selected; the npm package is marked private and unlicensed.
