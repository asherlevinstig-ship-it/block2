# Recall question authoring

Question files use `question-bank.schema.json`. Every production question needs:

- a permanent ID that must never be reused;
- a curriculum stage, topic and specification reference;
- four unique answers with one zero-based correct index;
- distractors based on identifiable misconceptions rather than jokes;
- an explanation that teaches why the answer is correct;
- `teacher-reviewed` or `approved` status before release.

Difficulty means:

1. direct recognition or one-step application;
2. application requiring discrimination between plausible alternatives;
3. multi-step reasoning, tracing or a subtle misconception.

Do not create near-duplicates by changing only names or numbers. Alternate the topic and representation instead. Run:

`node scripts/validate-question-bank.js path/to/reviewed-bank.json`

The validator rejects unstable IDs, duplicate prompts, repeated answer choices, missing curriculum metadata and explanations that are too short. A reviewed JSON bank can then be converted into the production objects in `shared/recall-system.js`; stable IDs preserve existing learner schedules.
