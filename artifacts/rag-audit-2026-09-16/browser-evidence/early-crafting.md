# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: early-crafting-loop.spec.js >> Road Ready stages the starter recipe and awards an upgrade after combat
- Location: e2e\early-crafting-loop.spec.js:3:1

# Error details

```
Error: page.evaluate: TypeError: Cannot read properties of undefined (reading 'x')
    at nearestCraftingTableKey (http://127.0.0.1:2607/js/menus.mjs:2042:39)
    at openCraftingFromNpc (http://127.0.0.1:2607/js/menus.mjs:6639:15)
    at Object.activateObjectiveCraftShortcut [as activateCraftShortcut] (http://127.0.0.1:2607/js/menus.mjs:630:3)
    at eval (eval at evaluate (:303:30), <anonymous>:1:52)
    at UtilityScript.evaluate (<anonymous>:305:16)
    at UtilityScript.<anonymous> (<anonymous>:1:44)
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic: Craft your starter sword
  - text: HP MP SP FD SHADOW MONARCH ABILITIES SEC
  - generic [ref=e4]:
    - generic [ref=e5]: Hunter Awakening 1 / 4
    - generic "Hunter Awakening progress" [ref=e6]:
      - generic [ref=e7]:
        - generic [ref=e8]: "1"
        - text: Quest Complete
      - generic [ref=e9]:
        - generic [ref=e10]: "2"
        - text: Choose Path
      - generic [ref=e11]:
        - generic [ref=e12]: "3"
        - text: Train Ability
      - generic [ref=e13]:
        - generic [ref=e14]: "4"
        - text: Try A Job
    - heading "FIRST QUEST COMPLETE" [level=2] [ref=e15]
    - generic [ref=e16]: THE TOWN RECOGNISES YOUR PROGRESS
    - generic [ref=e18]:
      - generic [ref=e19]: G
      - generic [ref=e20]: Gold
      - generic [ref=e21]: "+100"
    - generic [ref=e22]: You reached Level 2. Next you will choose a combat path, learn your first ability, then optionally try a job room.
    - button "CHOOSE PATH" [ref=e23] [cursor=pointer]
    - button "Close" [ref=e24] [cursor=pointer]: ×
  - generic:
    - generic: Esc / click — skip
  - text: ✥ ED ⤾
  - generic [ref=e26]:
    - generic [ref=e27]: ◆
    - heading "LOADING WORLD" [level=2] [ref=e28]
    - generic [ref=e29]: Traveling to Town of Beginnings...
  - region "Social invitations"
  - text: MOVE
  - generic:
    - generic: REGION
    - generic: TOWN OF BEGINNINGS
    - generic: Welcome to the hunter hub
  - status:
    - generic: LEVEL UP
    - heading "E-Rank Lv 2" [level=3]
    - paragraph: Your hunter grew stronger. Press C to spend your stat points now.
    - generic:
      - generic:
        - generic: STAT POINTS
        - generic: "+3"
      - generic:
        - generic: NEXT TARGET
        - generic: D-Rank Lv 1 begins
      - generic:
        - generic: XP PROGRESS
        - generic: 0 / 31
      - generic:
        - generic: OPEN STATS
        - generic: Press C
```