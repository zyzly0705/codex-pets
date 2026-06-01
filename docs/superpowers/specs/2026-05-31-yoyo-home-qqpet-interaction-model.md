# Yoyo Home QQ Pet Interaction Model

## Research Notes

QQ Pet was not primarily an object-click animation toy. It was a virtual pet lifecycle system: feeding, cleaning, work, study, games, marriage, eggs, travel, and tasks were all part of the pet's growth loop. Source: https://www.jiemian.com/article/2300403.html

The core interaction loop was state-driven. Hunger and cleanliness decayed over time during growth, study, work, rest, play, and home activities. State thresholds produced labels such as hungry, clean, itchy, and messy. Source: https://baike.so.com/doc/5378087-5614259.html

Mood was not just a button action. Users could directly click body parts such as mouth, belly, eyes, feet, and head to raise mood, with diminishing returns depending on mood state. Feeding, cleaning, toys, desktop mini-games, and carnival play also affected mood. Source: https://baike.so.com/doc/5378087-5614259.html

Old QQ Pet helper tools reveal the implied product model: automatic feeding/cleaning triggered by thresholds, inventory checks before feeding, self-protection when resources were missing, automatic petting, shopping, treatment, work, study, travel, and logs. Source: https://www.cnblogs.com/javawebsoa/archive/2013/05/28/3105010.html

## What The User Is Asking For

The desired Yoyo home should feel like caring for a living companion, not clicking hotspots to spawn an animation. Interactions should be initiated by Yoyo's needs, visible behavior, and user choices:

- Yoyo gets hungry, bored, tired, dirty, lonely, or curious over time.
- Yoyo asks, hints, or behaves differently before the user acts.
- Clicking Yoyo should offer body/mood interactions, not only a generic care action.
- Clicking an existing room object should inspect or open choices tied to that object.
- Feeding should choose an existing food or menu item, then Yoyo moves to the existing table.
- Bathing should use the existing wash area; if the sink is baked into the room, do not spawn another sink.
- Long actions such as sleep, study, watching, playing, and concert should be activities with duration and exit states.

## Current Framework Assessment

The framework can support this, but the current interaction layer is shaped wrong.

What already works:

- `interactionSystem.tasks` can hold per-action modes, zones, phases, and timelines.
- `native-room-zone` can anchor actions to existing room art without duplicate props.
- `petPlacements` can move Yoyo to the right room zone.
- `homeCharacter` mode can animate Yoyo independently from props.
- Life state already stores hunger, cleanliness, mood, energy, affection, level, and intimacy.
- The current saved compact room now treats all actions as native room zones, so old prop layers are source/reference assets rather than active overlays.

What is missing:

- An affordance model that distinguishes native room objects from spawned overlay props.
- A user intent layer: inspect, choose item, confirm care, cancel, continue activity.
- Inventory/resources for feeding and care choices.
- Direct Yoyo body interactions for mood and affection.
- Need-driven prompts and proactive behavior.
- Activity state machines for sleep, study, watching, games, and long-running actions.

## Implementation Rule

Do not implement home interaction as "click hotspot -> spawn prop -> play animation".

Implement it as:

1. State changes over time.
2. Yoyo expresses a need.
3. User clicks Yoyo, a bubble, or an existing room object.
4. UI shows a small contextual choice if needed.
5. Runtime verifies state/resources.
6. Yoyo moves to an existing zone.
7. Existing room art stays native; only Yoyo, effects, overlays, and truly missing objects animate.
8. State changes and Yoyo gives a follow-up line.

## Immediate Refactor Direction

- Rename the current hotspot care flow mentally from "action trigger" to "affordance selection".
- Keep hotspots invisible by default; use them as room object hit areas.
- Keep utility tools out of the main room-object hit targets.
- Replace instant `care(action)` on hotspot click with an intent resolver:
  - `feed`: open food choice or use recommended food, then move to native table.
  - `bath`: ask/confirm wash if cleanliness is low, then move to native wash zone.
  - `sleep`: start rest activity, not a one-shot bed animation.
  - `play`: open play choices or direct toy interaction.
  - `pet`: body-part mood/affection interaction on Yoyo itself.
- Add tests for `native-room-zone` and "no duplicate prop for baked room objects".
