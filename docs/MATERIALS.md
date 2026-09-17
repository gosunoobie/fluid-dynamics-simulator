# Material reference

These are gameplay rules for this project, not real chemical or thermodynamic measurements. Reactions usually require contact with an orthogonally adjacent cell. Random choices affect exact patterns and timing.

## Selectable materials

| Material  |  ID | Motion and interactions                                                                                                                                                                                                                                                |
| --------- | --: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sand      |   1 | Falls, forms piles, and sinks through water, acid, and oil. Does not burn or melt.                                                                                                                                                                                     |
| Stone     |   2 | Fixed rock. Acid dissolves it slowly. Explosions remove it or create falling debris.                                                                                                                                                                                   |
| Water     |   3 | Falls, spreads, and splashes on supported impacts. Moves beneath oil. Extinguishes fire, quenches wood and charcoal, and cools metal. Contact with lava creates stone and steam.                                                                                       |
| Lava      |   4 | A slow, viscous liquid that ignites fuel. Water, ice, or snow turns contacting lava into stone and the cooling material into steam. Lava does not cool by itself.                                                                                                      |
| Smoke     |   5 | Rises, drifts, and disappears after its lifetime or at the top edge.                                                                                                                                                                                                   |
| Wood      |   6 | Fixed fuel. Burns, emits flame/smoke, then becomes burning charcoal. Water can quench it. Explosions create charcoal or ash.                                                                                                                                           |
| Fire      |   7 | Rising, short-lived particles that ignite fuel and gunpowder. Water and cold materials extinguish them. Expired fire usually becomes smoke.                                                                                                                            |
| Acid      |   8 | A flowing, splashing liquid that can dissolve stone, metal, wood, ice, and powders. Has six successful dissolution events before becoming water. Dissolving ice or snow produces water.                                                                                |
| Oil       |  10 | Flows more slowly than water and floats above it. Burns and emits flame/smoke. Water immediately above it quenches burning; adjacent water underneath does not.                                                                                                        |
| Gunpowder |  11 | Falling powder. Fire, lava, burning fuel, hot metal, or a blast can start a short fuse and a chain reaction. It remains inert without ignition.                                                                                                                        |
| Ice       |  13 | Fixed, brittle solid. Melts under sustained heat, slowly in contact with water, or more quickly in a blast. Blasts can produce snow, water, or steam depending on distance.                                                                                            |
| Snow      |  14 | Falls gently and piles up. Liquids can displace it upward. Melts faster than ice when touching water or heat. A blast can scatter, melt, or vaporize it.                                                                                                               |
| Metal     |  15 | Fixed and immune to blast destruction. Conducts relative heat between adjacent metal cells; fire, lava, burning fuel, and blasts heat it. Hot metal can ignite fuel, melt cold material, and boil water. Water cools it. Acid corrodes it slowly. Metal does not melt. |
| Ash       |  16 | Falls slowly, piles up, and does not burn. Sinks through water, acid, and oil under the powder displacement rule.                                                                                                                                                      |
| Charcoal  |  17 | Falls into piles. Burns slowly with an ember glow and becomes ash. Water quenches it; it can be ignited again afterward. Sinks through water, acid, and oil.                                                                                                           |

## Tools and internal materials

| Item                |  ID | Behavior                                                                                                                                                          |
| ------------------- | --: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Eraser / empty cell |   0 | Removes material. The empty-cell ID is also named `AIR` in the engine.                                                                                            |
| Steam               |   9 | Generated by cooling lava, boiling water, or sufficiently hot explosions. Rises and fades. Contact with ice/snow condenses it to water and adds melting progress. |
| Debris              |  12 | Falling stone-colored powder generated when a blast breaks rock. Uses powder movement and density rules.                                                          |
| Explosion tool      |  -1 | Creates a blast at the selected point. It is an action, never a stored cell type.                                                                                 |

Steam and debris are simulation products and have no painting buttons.

## Important rule details

- **Heat is local.** Metal heat is clamped between 0 and 240 relative units; ice and snow use separate melt counters. There is no ambient temperature slider, spontaneous freezing, or global heat conservation.
- **Ice lasts longer than snow.** Snow melts at 8 accumulated units; ice at 40. Water contributes much less heat to ice than to snow. Cold materials remain unchanged in empty air.
- **Cold material consumes flame.** A contacting flame disappears and contributes melt progress. It may take multiple flames to melt one ice cell.
- **Solids remain fixed.** Stone, wood, ice, and metal are immobile even if they have no support. Charcoal and ash are powders, so burning wood can collapse into a pile as it changes material.
- **Density is categorical.** Most powders sink through water, acid, and oil. Snow is the exception; liquids can move down through it. Water and acid move down through oil. This is not a full fluid density model.
- **Blasts act by radius.** They do not check line of sight. Metal is durable but does not shield neighboring cells from the blast's influence.
- **Acid is consumed by successful corrosion.** Failed attempts do not spend its strength; metal has a much lower corrosion probability than wood or powders.
- **World boundaries are closed for falling material.** Gases disappear at the top. No material wraps from one edge to the other.

## Try these interactions

1. Build a stone basin, add water, then add oil to watch the layers separate.
2. Paint wood, add fire, and follow its change through charcoal into ash.
3. Draw a metal strip, heat one end with lava, and place wood or ice against another section.
4. Add snow over water to see it stay near the surface while melting.
5. Make a gunpowder pile, ignite one edge, and watch the reaction spread.

Use Pause to place materials carefully. Manual explosions still apply their immediate changes while paused; particle motion resumes with the simulation.
