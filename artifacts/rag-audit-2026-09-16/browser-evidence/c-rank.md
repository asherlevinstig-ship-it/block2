# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: c-rank-specialization.spec.js >> C-rank specialization flows through B, A, and the final S-rank Gate with persistent clears
- Location: e2e\c-rank-specialization.spec.js:45:1

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: "choose_spec"
Received: "continue_panel"

Call Log:
- Timeout 15000ms exceeded while waiting on the predicate
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic: BOSS SPIRIT · C-RANK
  - text: HP MP SP FD SHADOW MONARCH ABILITIES SEC
  - generic [ref=e5]:
    - generic:
      - generic: C
      - generic: GATE SEALED
    - heading "DUNGEON CLEARED" [level=2] [ref=e6]
    - generic [ref=e7]: Forgotten Keep · C-Rank Public Gate
    - generic [ref=e8]:
      - generic [ref=e9]:
        - generic [ref=e10]: Dungeon
        - text: Forgotten Keep
      - generic [ref=e11]:
        - generic [ref=e12]: Boss
        - text: The Hollow Castellan
      - generic [ref=e13]:
        - generic [ref=e14]: Time
        - text: 0:01
      - generic [ref=e15]:
        - generic [ref=e16]: Party
        - text: 1 hunter
      - generic [ref=e17]:
        - generic [ref=e18]: Deaths
        - text: "0"
      - generic [ref=e19]:
        - generic [ref=e20]: Spirits
        - text: "0"
      - generic [ref=e21]:
        - generic [ref=e22]: Returned
        - text: "0"
      - generic [ref=e23]:
        - generic [ref=e24]: Chests
        - text: 0/3
    - generic [ref=e25]:
      - generic [ref=e26]:
        - generic [ref=e27]: Progression
        - generic [ref=e28]:
          - generic [ref=e29]: XP
          - generic [ref=e30]: XP
          - generic [ref=e31]: "+563"
      - generic [ref=e32]:
        - generic [ref=e33]: Currency
        - generic [ref=e34]:
          - generic [ref=e35]: G
          - generic [ref=e36]: Gold
          - generic [ref=e37]: "+126"
      - generic [ref=e38]:
        - generic [ref=e39]: Gear
        - generic [ref=e40]:
          - generic [ref=e42]: B-Rank Common Diamond Axe
          - generic [ref=e43]: x1
      - generic [ref=e44]:
        - generic [ref=e45]: Keys
        - generic [ref=e46]:
          - generic [ref=e48]: B Solo Gate Key
          - generic [ref=e49]: x1
      - generic [ref=e50]:
        - generic [ref=e51]: Materials
        - generic [ref=e52]:
          - generic [ref=e54]: Coal
          - generic [ref=e55]: x7
        - generic [ref=e56]:
          - generic [ref=e58]: Iron Ingot
          - generic [ref=e59]: x8
        - generic [ref=e60]:
          - generic [ref=e62]: Diamond
          - generic [ref=e63]: x1
        - generic [ref=e64]:
          - generic [ref=e66]: Iron Ingot
          - generic [ref=e67]: x8
        - generic [ref=e68]:
          - generic [ref=e70]: Diamond
          - generic [ref=e71]: x3
      - generic [ref=e72]:
        - generic [ref=e73]: Items
        - generic [ref=e74]:
          - generic [ref=e76]: Glimmering Shard
          - generic [ref=e77]: x1
        - generic [ref=e78]:
          - generic [ref=e80]: Stormglass Shard
          - generic [ref=e81]: x1
        - generic [ref=e82]:
          - generic [ref=e84]: Prismatic Geode
          - generic [ref=e85]: x2
    - generic [ref=e86]: "Full clear reward awarded: XP, gold, materials, key/shard/gear chances, and progress credit. Exit through the portal when ready. Optional chests remain: 3. B key secured. Reach B-Rank Hunter through XP before you can use it."
    - generic [ref=e88]:
      - generic [ref=e89]:
        - generic [ref=e90]:
          - generic [ref=e91]: KEEP THE PARTY GOING
          - generic [ref=e92]: Adventure is better together
        - button "PLAY AGAIN" [ref=e93] [cursor=pointer]
      - article [ref=e95]:
        - generic [ref=e96]:
          - generic [ref=e97]: C
          - generic [ref=e98]: C Trial Tester
        - generic [ref=e99]:
          - button "ADD FRIEND" [ref=e100] [cursor=pointer]
          - button "INVITE TO TEAM" [ref=e101] [cursor=pointer]
          - button "COMMEND" [ref=e102] [cursor=pointer]
          - button "INVITE TO FELLOWSHIP" [ref=e103] [cursor=pointer]
    - button "CLOSE" [ref=e105] [cursor=pointer]
    - button "Close" [ref=e106] [cursor=pointer]: ×
  - generic:
    - generic: Esc / click — skip
  - text: ✥ ED ⤾
  - region "Social invitations"
  - generic:
    - generic: Entering Wilderness
    - generic: Unclaimed land - buildable, not protected
  - text: MOVE
  - generic:
    - generic: REGION
    - generic: TOWN OF BEGINNINGS
    - generic: Returned from the Gate
```