# Testing

## Automated commands

### Export validation

This packaged version passed `npm run check` and all **83 automated tests** on Node.js 24.19.0 (Linux): 50 material/reaction regressions, 11 additional momentum checks, 7 engine/API checks, 8 UI lifecycle/input checks, and 7 local-server checks.

UI tests execute the real application scripts with a mocked DOM and canvas. A browser executable was unavailable in the export environment, so real-browser layout, direct-file loading, and touch-device behavior were not verified here. Use the manual checklist below for those checks.

Use Node.js 20 or newer. From the project root:

```sh
npm run check
npm test
```

The project checks validate the package and source. Tests use Node's built-in test runner and exercise the simulation through its exported API. No browser, npm installation, or external test service is required.

The terminal test summary is the authoritative result for your working copy. A passing run applies to the code and tests that were actually executed; it is not a guarantee about every possible scene or browser.

## What to protect

The following behaviors are especially sensitive to regressions:

- A blank initial grid and accurate material counts after changes and reset.
- Particle metadata moving with the particle rather than remaining at the old location.
- Falling liquids contacting each other without an artificial upward bounce.
- Splashes only after an impact against supported material or the floor.
- No movement through a thin wall or sealed diagonal corner.
- Oil/water separation and the distinction between snow and sinking powders.
- Finite gunpowder chain reactions and bounded explosion queues.
- Water extinguishing flames and quenching wood or charcoal.
- Melting, metal heat propagation, and reset clearing their stored state.
- Wood becoming charcoal, then ash, without invalid material IDs or stale combustion state.

Use seeded randomness and narrowly arranged scenes when testing probabilistic reactions. Prefer checking observable outcomes and invariants over asserting an exact random texture or an arbitrary full-frame snapshot. Compare counts only when a scene contains no reactions that create, consume, or transform material.

## Manual browser checks

Automated engine tests do not exercise every browser, input device, or accessibility behavior. Before shipping UI changes, open `index.html` directly and through the local server, then check:

1. The initial canvas is blank and all controls load without console errors.
2. Mouse/touch painting works at different canvas sizes, including dragging near the edges.
3. Selecting each material changes the action button and status text.
4. Pause stops physics while allowing painting; Resume continues the scene.
5. Reset clears particles and active effects while preserving selection and pause state.
6. Explosion creates one blast per click and the center action works from the keyboard.
7. Tab focus is visible; buttons work with keyboard activation and have meaningful names.
8. Light and dark themes remain readable. Reduced-motion preference starts the page paused.
9. Oil floats on water, wood burns through charcoal into ash, ice/snow melt, and heated metal affects nearby materials.
10. Sustained painting and a large gunpowder pile remain usable without an uncontrolled event backlog.

Record the browser, platform, and actual outcome when reporting manual validation. Do not describe a mocked canvas or Node engine test as real-browser verification.

## Adding regression tests

Place tests in `tests/` using the `.test.cjs` suffix. Arrange the smallest scene that demonstrates the behavior, run a bounded number of ticks, and assert the relevant result. Test both an expected interaction and a nearby case where it should not occur when that distinction caused a bug, such as a falling liquid pair versus a grounded pool.

If a test fails, first inspect the changed rule and the setup's physical assumptions. Do not remove collision, accounting, or reset checks merely to make a new material pass.
