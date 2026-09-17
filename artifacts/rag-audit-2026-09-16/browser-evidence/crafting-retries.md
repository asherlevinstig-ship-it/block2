# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: crafting-responsiveness.spec.js >> delayed craft retries once and duplicate results cannot consume a new grid
- Location: e2e\crafting-responsiveness.spec.js:4:1

# Error details

```
Error: page.evaluate: TypeError: Cannot read properties of undefined (reading 'x')
    at nearestCraftingTableKey (http://127.0.0.1:2607/js/menus.mjs:2042:39)
    at openCraftingFromNpc (http://127.0.0.1:2607/js/menus.mjs:6639:15)
    at Object.activateObjectiveCraftShortcut [as activateCraftShortcut] (http://127.0.0.1:2607/js/menus.mjs:630:3)
    at eval (eval at evaluate (:303:30), <anonymous>:16:50)
    at UtilityScript.evaluate (<anonymous>:305:16)
    at UtilityScript.<anonymous> (<anonymous>:1:44)
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic: "Quest accepted: leave through the north gate"
  - generic [ref=e4]:
    - button "Select hotbar slot 1" [pressed] [ref=e5]:
      - generic [ref=e6]: "1"
    - button "Select hotbar slot 2" [ref=e8]:
      - generic [ref=e9]: "2"
      - generic [ref=e10]: C
      - generic "Vanguard" [ref=e11]: V
    - button "Select hotbar slot 3" [ref=e13]:
      - generic [ref=e14]: "3"
    - button "Select hotbar slot 4" [ref=e16]:
      - generic [ref=e17]: "4"
      - generic [ref=e19]: "6"
    - button "Select hotbar slot 5" [ref=e20]:
      - generic [ref=e21]: "5"
    - button "Select hotbar slot 6" [ref=e22]:
      - generic [ref=e23]: "6"
    - button "Select hotbar slot 7" [ref=e24]:
      - generic [ref=e25]: "7"
    - button "Select hotbar slot 8" [ref=e26]:
      - generic [ref=e27]: "8"
    - button "Select hotbar slot 9" [ref=e28]:
      - generic [ref=e29]: "9"
  - generic:
    - generic: E1
    - generic:
      - generic:
        - text: HP
        - generic: HP 20/20
      - generic:
        - text: MP
        - generic: MP 20/20
      - generic:
        - text: SP
        - generic: SP 100/100
      - generic:
        - text: FD
        - generic: FOOD 100/100
      - generic "D-Rank in 1,281 Hunter XP":
        - generic: 0 / 12 XP
  - generic "Shadow Monarch ability hotbar" [ref=e30]:
    - text: SHADOW MONARCH ABILITIES
    - button "Shadow Dash - Q — unlocks at Level 2" [ref=e31]:
      - generic [ref=e32]: Q
      - text: »
      - generic [ref=e33]: Lv2
    - button "Umbral Edge - R — unlocks at Level 4" [ref=e34]:
      - generic [ref=e35]: R
      - text: ◈
      - generic [ref=e36]: Lv4
    - button "Shadow Soldier - H — unlocks at Level 8" [ref=e37]:
      - generic [ref=e38]: H
      - text: ♞
      - generic [ref=e39]: Lv8
  - generic "Rewards earned"
  - text: SEC
  - generic [ref=e40]:
    - generic [ref=e41]: "!"
    - generic [ref=e42]:
      - generic [ref=e43]: PARKOUR SERVER EVENT
      - generic [ref=e44]: Not signed up - starts in 12:40 - queued 0/8 - reward 2 legendary tokens + 70 Hunter XP
      - generic [ref=e45]:
        - generic [ref=e46]: QUEUE 0/8
        - generic [ref=e47]: 2 LEGENDARY TOKENS + 70 HUNTER XP
        - generic [ref=e48]: 12:40
    - button "JOIN QUEUE" [ref=e50] [cursor=pointer]
  - generic "Player shortcuts" [ref=e51]:
    - button "Social menu. Press and hold for quick chat" [ref=e52] [cursor=pointer]:
      - img [ref=e53]
    - button "! REPORT" [ref=e58] [cursor=pointer]:
      - generic [ref=e59]: "!"
      - text: REPORT
    - button "↟ UNSTUCK" [ref=e60] [cursor=pointer]:
      - generic [ref=e61]: ↟
      - text: UNSTUCK
  - generic:
    - generic: WORLD MAP 0
  - log "Chat and event history" [ref=e62]:
    - generic [ref=e63]: "[Town] Entered Town of Beginnings - Safe town - quests, market, tavern, shards"
    - generic [ref=e64]: "[Event] Connected as CraftDelay"
    - generic [ref=e65]: "[Notice] Event Alert: Parkour queue is open. Join from the event banner before the countdown ends. Reward: 2 Legendary Tokens + 70 Hunter XP."
    - generic [ref=e66]: "[System] CraftDelay has returned"
    - generic [ref=e67]: "[Notice] Path chosen: Shadow Monarch ."
    - generic [ref=e68]: "[Notice] Training complete. Welcome to the Town of Beginnings."
    - generic [ref=e69]: "[Event] CraftDelay returned — progress restored"
    - generic [ref=e70]: "[Notice] New system ready: Mara’s Story. Open the Quest Log with O or follow the new trail."
    - generic [ref=e71]: "[Notice] Quest accepted: First Hands. Leave through the north gate and gather 6 logs."
    - generic [ref=e72]: "[Quest] Accepted First Hands from Mara Vale."
    - generic [ref=e73]: "[Event] CraftDelay returned — progress restored"
  - generic:
    - generic: Esc / click — skip
  - generic:
    - text: ✥
    - generic:
      - generic: Town of Beginnings
      - generic: Safe town - quests, market, tavern, shards
  - generic:
    - generic:
      - generic: T
      - generic: Time
      - generic: 15:01 Night
    - generic:
      - generic: G
      - generic: Gold
      - generic: "100"
    - generic:
      - generic: R
      - generic: Next Rank
      - generic: D in 1,281 XP
  - generic [ref=e75]:
    - generic [ref=e76]:
      - generic [ref=e77]: Active Quest
      - button "View all quests" [ref=e78] [cursor=pointer]:
        - text: ✦
        - generic [ref=e79]: O
    - heading "First Hands" [level=3] [ref=e80]
    - paragraph [ref=e81]: Turn in First Hands to Mara Vale
    - generic [ref=e82]:
      - generic [ref=e83]: 6 / 6
      - emphasis [ref=e85]
  - text: ED ⤾
  - region "Social invitations"
  - text: MOVE
  - generic:
    - generic: REGION
    - generic: TOWN OF BEGINNINGS
    - generic: Welcome to the hunter hub
```