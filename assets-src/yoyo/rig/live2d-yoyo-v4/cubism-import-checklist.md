# Yoyo Cubism Import Checklist

1. Import PSD and preserve draw order.
2. Hide all expression variant layers and keep only default-state art visible.
3. Create the initial face parameter set from live2d-binding-profile.json.
4. Build head, torso, arm, and skirt deformers in the order described by cubism-setup-plan.json.
5. Verify mouth and eye opacity swaps before attempting mesh-heavy deformations.
6. Build starter motions: idle, blink, happy_idle, talk_loop.

Use cubism-setup-plan.json for phase sequencing and live2d-binding-profile.json for the parameter/value mapping.
