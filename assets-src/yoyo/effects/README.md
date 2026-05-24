# Yoyo Fullscreen Effect Sources

This folder is for fullscreen performance design sources.

V5 fullscreen effects are PixiJS realtime stages. Each effect folder should at
least contain:

```text
timeline.json
```

The runtime copy lives in:

```text
assets/yoyo/effects/<effect-name>/timeline.json
```

Do not add huge fullscreen `effect.json` layer sheets for `clone-heart` or
`dharma-manifest`; those were the V3 experiment and are intentionally retired.
If an effect needs authored art, add small reusable pieces such as sigils,
lightning, particles, shockwaves, or a spirit silhouette, then let
`src/pixi-effect-stage.js` place them with PixiJS, pixi-filters, and
`@pixi/particle-emitter`.
