# Contributing

Keep this project easy to open, inspect, and modify with plain web technologies. Prefer small, focused changes that preserve direct-file execution and avoid runtime dependencies.

## Workflow

1. Reproduce the issue or identify the intended behavior.
2. Edit the smallest relevant module: material metadata, simulation, renderer, or application controls.
3. Add a focused regression test for a physics bug or meaningful new interaction.
4. Run `npm run check` and `npm test` with Node.js 20+.
5. Perform the relevant [manual browser checks](docs/TESTING.md) for UI or renderer changes.
6. Update documentation and the changelog for user-visible changes.

## Code conventions

- Use descriptive names, explicit material IDs, and small functions with one responsibility.
- Keep browser APIs out of the simulation engine.
- Use the injected random function in simulation rules so tests can be reproducible.
- Keep mutable particle state in the engine and transfer it consistently during swaps.
- Update counts through engine methods instead of changing `cells` directly.
- Preserve neighbor boundary checks, movement tracing, support logic, and bounded explosion processing.
- Comment on why a rule or ordering is necessary, especially where it prevents a known regression.
- Match the surrounding formatting and avoid unrelated reformatting.

Do not add a package, build step, external asset, or network dependency without explaining why it is needed. See the [material extension checklist](docs/DEVELOPMENT.md#adding-a-material) for engine additions.

## Reporting a bug

Describe what you expected, what happened, and the shortest sequence that reproduces it. Include browser and platform, the chosen materials, pause state, and relevant console errors. A screenshot or short recording can help explain a particle interaction.

## Scope and rights

This repository does not currently grant an open-source license. Confirm the intended licensing and contribution terms with the project owner before accepting external contributions or redistributing the code. See [NOTICE.md](NOTICE.md).
