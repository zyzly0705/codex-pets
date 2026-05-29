# Feed Object Room Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a vertical slice where Yoyo's `feed` action uses a real scene object instead of only switching sprites and effects.

**Architecture:** Keep the current home background and care model. Add a small scene manifest, layered food bowl assets, DOM rendering for scene objects, and timed object state changes tied to the existing `care('feed')` flow.

**Tech Stack:** Electron renderer, plain JavaScript, CSS, Sharp-based asset generation, Node test runner.

---

### Task 1: Scene Contract

**Files:**
- Create: `src/shared/home-scene.js`
- Modify: `src/home.html`

- [ ] Add a global scene manifest with a single `foodBowl` object, layer asset paths, and state names.
- [ ] Load the manifest before `src/home.js`.

### Task 2: Layered Food Assets

**Files:**
- Modify: `scripts/build-home-assets.js`
- Generate: `assets-src/yoyo/home/prop-food-back.png`
- Generate: `assets-src/yoyo/home/prop-food-meal-full.png`
- Generate: `assets-src/yoyo/home/prop-food-meal-low.png`
- Generate: `assets-src/yoyo/home/prop-food-front.png`
- Generate: `assets/yoyo/home/prop-food-back.webp`
- Generate: `assets/yoyo/home/prop-food-meal-full.webp`
- Generate: `assets/yoyo/home/prop-food-meal-low.webp`
- Generate: `assets/yoyo/home/prop-food-front.webp`

- [ ] Adopt the accepted human meal tray candidate for the food back layer and keep the other food layers as transparent compatibility PNGs.
- [ ] Build the new WebP assets from the accepted PNG source.

### Task 3: Home DOM Layers

**Files:**
- Modify: `src/home.html`
- Modify: `src/home.css`
- Modify: `src/home.js`

- [ ] Insert `home-scene-objects` into the room stage.
- [ ] Render `foodBowl` from `window.YOYO_HOME_SCENE`.
- [ ] Add CSS for object positioning, state visibility, and bowl foreground layering.

### Task 4: Feed Interaction Timing

**Files:**
- Modify: `src/home.js`
- Modify: `src/home.css`

- [ ] Tie `startHomeAnimation('eating', 'feed', ...)` to object state changes.
- [ ] Move `pet-zone` toward the bowl during `data-scene="feed"`.
- [ ] Add approach, eating, and satisfied feed phases on the room stage.
- [ ] Reset object state when the feed interaction ends.

### Task 5: Validation

**Files:**
- Modify or create only if needed: `tests/*.test.mjs`

- [ ] Run `npm run build:home-assets`.
- [ ] Run `npm test`.
- [ ] Run `npm run check`.
- [ ] Start the app or a local browser view and verify the feed slice visually.
