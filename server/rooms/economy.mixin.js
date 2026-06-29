// Economy & storage: inventory, crafting, shops, chests (records + slots) and
// furnaces. Lifted verbatim out of GameRoom.js and mixed into its prototype.
const {
  ARMOR_INFO, BIOME_COLLECTIBLE, CHEST_REWARD_BY_RANK, DRAGON_DROP_POOL, DRAGON_EGG_CHEST_CHANCE,
  DRAGON_EGG_OF, FUEL, GUARDIAN_POS, GUILD_DECOR_BUY, I, KEY_LOOT, LEGENDARY_CRAFTS, RECIPES, REWARD_ITEMS,
  ROAD_MERCHANT_BUY, SHOP_BUY, SHOP_SELL, SMELT, SMELT_MS, TAVERN_BUY, TAVERN_SELL, TEAM_KEYS, TOOL_INFO,
  dangerRingAt, jobPerkChance, jobPerkTier, keyForRank,
} = require('./constants');
const { State, Player, Mob, Team, Gate } = require('../schema');
const { TeamManager } = require('../teams');
const W = require('../world');
const D = require('../dungeon');
const AI = require('../ai');
const { createStore, sanitizeProfile, mergeClientSave, defaultProfile, cleanToken, sanitizeUtilityLoadout } = require('../store');

class EconomyMixin {
  parseChestKey(key) {
    if (typeof key !== 'string') return null;
    const m = key.match(/^(overworld|g\d+):(\d+),(\d+),(\d+)$/);
    if (!m) return null;
    return { space: m[1], x: +m[2], y: +m[3], z: +m[4] };
  }
  normalizeChestRecord(key, raw, client) {
    const info = this.parseChestKey(key);
    const isObj = raw && typeof raw === 'object' && !Array.isArray(raw);
    const slots = (Array.isArray(raw) ? raw : (isObj && Array.isArray(raw.slots) ? raw.slots : [])).slice(0, 18).map(s => {
      if (!s || typeof s !== 'object') return null;
      return { id: Math.max(0, Math.min(999, s.id | 0)), count: Math.max(1, Math.min(64, s.count | 0)) };
    });
    while (slots.length < 18) slots.push(null);
    let scope = isObj && typeof raw.scope === 'string' ? raw.scope : '';
    if (!['personal', 'team', 'town', 'dungeon', 'public'].includes(scope)) {
      scope = info && info.space !== 'overworld' ? 'dungeon' : (info && this.isTownProtected(info.x, info.z) ? 'town' : 'personal');
    }
    const owner = isObj && typeof raw.owner === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(raw.owner) ? raw.owner : '';
    const team = this.cleanTeamId(isObj ? raw.team : '');
    const rec = { scope, owner, team, slots };
    if (scope === 'dungeon') rec.owner = '';
    if (scope === 'town') { rec.owner = ''; rec.team = ''; }
    return rec;
  }
  dungeonLootChestRecord(key) {
    const info = this.parseChestKey(key);
    if (!info || info.space === 'overworld') return null;
    const inst = this.instances[info.space];
    if (!inst || inst.getB(info.x, info.y, info.z) !== W.B.CHEST) return null;
    const chestId = info.x + ',' + info.y + ',' + info.z;
    const looted = this.gateLootedChests.get(info.space) || new Set();
    if (looted.has(chestId)) return { scope: 'dungeon', owner: '', team: '', slots: new Array(18).fill(null) };
    const rank = Math.max(0, Math.min(4, inst.rank | 0));
    const a = W.hash2(info.x * 92821 + inst.seed, info.z * 68917 + info.y * 37);
    const b = W.hash2(info.z * 8191 + inst.seed, info.x * 31337 + rank);
    const c = W.hash2(info.x * 7001 + info.z * 313 + inst.seed, rank * 997);
    const cfg = CHEST_REWARD_BY_RANK[rank];
    const rollCount = (range, r) => range[0] + Math.floor(r * (range[1] - range[0] + 1));
    const slots = new Array(18).fill(null);
    let i = 0;
    slots[i++] = { id: REWARD_ITEMS.coal, count: rollCount(cfg.coal, a) };
    const iron = rollCount(cfg.iron, b);
    if (iron > 0) slots[i++] = { id: REWARD_ITEMS.iron, count: iron };
    const dia = rollCount(cfg.dia, c);
    if (dia > 0) slots[i++] = { id: REWARD_ITEMS.dia, count: dia };
    if (a < KEY_LOOT.chestSoloByRank[rank]) slots[i++] = { id: keyForRank('solo', rank), count: 1 };
    if (b < KEY_LOOT.chestTeamByRank[rank]) slots[i++] = { id: keyForRank('team', rank), count: 1 };
    const eggRoll = W.hash2(info.x * 50923 + inst.seed, info.z * 19349 + info.y * 71 + rank);
    if (eggRoll < DRAGON_EGG_CHEST_CHANCE[rank]) {
      const pool = DRAGON_DROP_POOL[rank] || [];
      if (pool.length) {
        const pick = W.hash2(info.z * 33391 + inst.seed, info.x * 60149 + rank * 7);
        slots[i++] = { id: DRAGON_EGG_OF(pool[Math.min(pool.length - 1, Math.floor(pick * pool.length))]), count: 1 };
      }
    }
    looted.add(chestId);
    this.gateLootedChests.set(info.space, looted);
    this.dirtyGates = true;
    return { scope: 'dungeon', owner: '', team: '', slots };
  }
  overworldTreasureChestRecord(key) {
    const info = this.parseChestKey(key);
    if (!info || info.space !== 'overworld') return null;
    if (!this.landmarkCampChests) {
      this.landmarkCampChests = new Map();
      for (const s of W.regionalLandmarkSpecs()) if (s.type === 'hunter_camp')
        this.landmarkCampChests.set(s.x + ',' + (s.y + 1) + ',' + (s.z + 3), s);
    }
    let site = this.landmarkCampChests.get(info.x + ',' + info.y + ',' + info.z), discovery = false;
    if (!site) {
      for (const s of W.smallDiscoverySpecs()) {
        const chest = s.type === 'buried_chest' ? [s.x, s.y - 1, s.z] : s.type === 'traveling_merchant' ? [s.x, s.y + 1, s.z - 2] : null;
        if (chest && chest[0] === info.x && chest[1] === info.y && chest[2] === info.z) { site = s; discovery = true; break; }
      }
    }
    if (!site || this.world.getB(info.x, info.y, info.z) !== W.B.CHEST) return null;
    const ring = dangerRingAt(site.x, site.z), regional = BIOME_COLLECTIBLE[W.biomeAt(site.x, site.z)];
    const roll = W.hash2(site.x * 7717, site.z * 3571), slots = new Array(18).fill(null);
    let i = 0;
    slots[i++] = { id: I.COAL, count: (discovery ? 1 : 2) + ring * 3 };
    if (ring >= 1) slots[i++] = { id: I.IRON_INGOT, count: ring + 1 };
    if (ring >= 2) slots[i++] = { id: I.DIAMOND, count: ring - 1 + (roll > .55 ? 1 : 0) };
    if (regional) slots[i++] = { id: regional.item, count: 1 + ring };
    if (ring >= 3) slots[i++] = { id: I.LEGEND_TOKEN, count: 1 };
    return { scope: 'public', owner: '', team: '', slots };
  }
  getChestRecord(key, client) {
    const raw = this.chests.get(key);
    if (!raw) {
      const generated = this.dungeonLootChestRecord(key) || this.overworldTreasureChestRecord(key);
      if (generated) {
        this.chests.set(key, generated);
        return generated;
      }
    }
    const rec = this.normalizeChestRecord(key, raw, client);
    if (raw !== rec) this.chests.set(key, rec);
    return rec;
  }
  createPlacedChest(client, key, scope) {
    const p = this.state.players.get(client.sessionId);
    const rec = {
      scope: scope === 'dungeon' ? 'dungeon' : 'personal',
      owner: scope === 'dungeon' ? '' : this.clientToken(client),
      team: p ? this.cleanTeamId(p.team) : '',
      slots: new Array(18).fill(null),
    };
    this.chests.set(key, rec);
    if (key.startsWith('overworld:')) this.dirtyChests = true;
  }
  deleteChest(key) {
    if (this.chests.delete(key) && key.startsWith('overworld:')) this.dirtyChests = true;
  }
  isChestEmpty(key) {
    return !this.getChestRecord(key).slots.some(Boolean);
  }
  canAccessChest(client, key) {
    const p = this.state.players.get(client.sessionId);
    if (!p) return false;
    const info = this.parseChestKey(key);
    if (!info) return false;
    const rec = this.getChestRecord(key);
    if (rec.scope === 'town') return false;
    if (rec.scope === 'public') return info.space === 'overworld';
    if (rec.scope === 'dungeon') return info.space !== 'overworld' && (p.dgn || '') === info.space;
    if (rec.scope === 'team') return !!rec.team && rec.team === this.cleanTeamId(p.team);
    return (!!rec.owner && rec.owner === this.clientToken(client)) || (!!rec.team && rec.team === this.cleanTeamId(p.team));
  }
  canBreakChest(client, key) {
    const rec = this.getChestRecord(key);
    if (rec.scope === 'dungeon') return this.canAccessChest(client, key) && this.isChestEmpty(key);
    return !!rec.owner && rec.owner === this.clientToken(client) && this.isChestEmpty(key);
  }
  // Adds up to `count` of `id` to the inventory. Returns the number it could NOT place
  // (0 = all placed) so callers that paid for the items can refund on a full bag.
  addRewardItem(prof, id, count) {
    let left = Math.max(0, Math.min(999, count | 0));
    if (!left) return 0;
    if (ARMOR_INFO[id] && prof && prof.armor && prof.armor.id === id) return 0;   // already equipped: intentional no-op
    prof.inv = Array.isArray(prof.inv) ? prof.inv : [];
    for (const slot of prof.inv) {
      if (!slot || slot.id !== id || slot.dur != null) continue;
      const add = Math.min(left, 64 - slot.count);
      if (add > 0) { slot.count += add; left -= add; }
      if (!left) return 0;
    }
    // reuse null holes left by consumed stacks before growing the array (mirrors addChestItem)
    for (let i = 0; i < prof.inv.length && left > 0; i++) {
      if (prof.inv[i]) continue;
      const add = Math.min(left, 64);
      prof.inv[i] = { id, count: add };
      left -= add;
    }
    while (left > 0 && prof.inv.length < 36) {
      const add = Math.min(left, 64);
      prof.inv.push({ id, count: add });
      left -= add;
    }
    return left;
  }
  // How many of `id` would fit right now (without mutating) — used to make purchases atomic.
  inventorySpaceFor(prof, id, count) {
    const inv = prof && Array.isArray(prof.inv) ? prof.inv : [];
    let room = 0;
    for (const slot of inv) {
      if (slot && slot.id === id && slot.dur == null) room += Math.max(0, 64 - slot.count);
      else if (!slot) room += 64;
    }
    room += Math.max(0, 36 - inv.length) * 64;
    return Math.min(Math.max(0, count | 0), room);
  }
  craftedOutputCount(prof, id, count) {
    let out = Math.max(1, count | 0);
    if ((id === I.BREAD || id === I.HEARTY_SANDWICH || id === I.COOKED_MEAT || id === I.DRAGON_TREAT) && Math.random() < jobPerkChance(prof, 'cook', 0.08)) {
      out += Math.max(1, Math.floor(out * 0.25));
    }
    return out;
  }
  // Returns the count that could NOT be placed (0 = all placed). durOverride, when
  // given, pins the durability instead of the default/blacksmith-perk value.
  addCraftedRewardItem(prof, id, count, durOverride) {
    const info = TOOL_INFO[id];
    if (!info) return this.addRewardItem(prof, id, count);
    let left = Math.max(0, Math.min(64, count | 0));
    prof.inv = Array.isArray(prof.inv) ? prof.inv : [];
    const tier = jobPerkTier(prof, 'blacksmith');
    const dur = durOverride != null
      ? Math.max(1, Math.min(99999, durOverride | 0))
      : (tier ? Math.min(99999, info.dur + Math.max(1, Math.round(info.dur * (0.08 + tier * 0.04)))) : info.dur);
    for (let i = 0; i < prof.inv.length && left > 0; i++) {   // reuse freed holes before growing
      if (prof.inv[i]) continue;
      prof.inv[i] = { id, count: 1, dur };
      left--;
    }
    while (left > 0 && prof.inv.length < 36) {
      prof.inv.push({ id, count: 1, dur });
      left--;
    }
    return left;
  }
  handleCraftLegendary(client, m) {
    const rec = this.profileFor(client);
    const id = m && (m.id | 0);
    const craft = LEGENDARY_CRAFTS[id];
    if (!rec || !craft) return client.send('craftLegendaryReject', { reason: 'item' });
    const p = this.state.players.get(client.sessionId);
    const gx = GUARDIAN_POS.x, gz = GUARDIAN_POS.z;
    if (!p || p.dgn || Math.hypot((p.x || 0) - gx, (p.z || 0) - gz) > 10) {
      return client.send('craftLegendaryReject', { reason: 'range' });
    }
    if (id === I.LEGEND_ARMOR && rec.prof.armor && rec.prof.armor.id === I.LEGEND_ARMOR) {
      return client.send('craftLegendaryReject', { reason: 'owned', id });
    }
    if (this.inventorySpaceFor(rec.prof, id, 1) < 1) return client.send('craftLegendaryReject', { reason: 'full', id });
    if (!this.consumeItem(rec.prof, I.LEGEND_TOKEN, craft.cost)) {
      return client.send('craftLegendaryReject', { reason: 'tokens', id, cost: craft.cost });
    }
    this.addRewardItem(rec.prof, id, 1);
    this.syncPlayerProfile(client, rec.prof);
    this.dirtyPlayers.add(rec.token);
    client.send('craftLegendaryResult', { id, count: 1, cost: craft.cost, name: craft.name });
  }
  consumeItem(prof, id, count) {
    let left = Math.max(0, count | 0);
    if (!left) return true;
    if (!prof || !Array.isArray(prof.inv)) return false;
    for (const slot of prof.inv) {
      if (!slot || slot.id !== id || slot.dur != null) continue;
      left -= Math.max(0, slot.count | 0);
      if (left <= 0) break;
    }
    if (left > 0) return false;
    left = count;
    for (let i = 0; i < prof.inv.length && left > 0; i++) {
      const slot = prof.inv[i];
      if (!slot || slot.id !== id || slot.dur != null) continue;
      const take = Math.min(left, slot.count);
      slot.count -= take;
      left -= take;
      if (slot.count <= 0) prof.inv[i] = null;
    }
    return true;
  }
  consumeForPlacement(client, id) {
    const rec = this.profileFor(client);
    if (!rec) return false;
    const ok = this.consumeItem(rec.prof, id, 1);
    if (ok) this.dirtyPlayers.add(rec.token);
    return ok;
  }
  consumeSlotItem(prof, slot, id, count) {
    const i = Math.max(0, Math.min(35, slot | 0));
    const s = prof && Array.isArray(prof.inv) ? prof.inv[i] : null;
    if (!s || s.id !== id || s.dur != null || (s.count | 0) < count) return false;
    s.count -= count;
    if (s.count <= 0) prof.inv[i] = null;
    return true;
  }
  findInventoryItemSlot(prof, predicate) {
    const inv = prof && Array.isArray(prof.inv) ? prof.inv : [];
    for (let i = 0; i < inv.length; i++) {
      const s = inv[i];
      if (s && predicate(s, i)) return i;
    }
    return -1;
  }
  rejectEdit(client, x, y, z, actual, requested) {
    client.send('editReject', { x, y, z, id: actual | 0, requested: requested == null ? null : requested | 0 });
  }
  trimGrid(cells, w) {
    let minX = w, minY = w, maxX = -1, maxY = -1;
    for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) {
      if (cells[y * w + x]) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    }
    if (maxX < 0) return null;
    const rows = [];
    for (let y = minY; y <= maxY; y++) {
      const row = [];
      for (let x = minX; x <= maxX; x++) row.push(cells[y * w + x]);
      rows.push(row);
    }
    return rows;
  }
  shapeRows(recipe, flip) {
    return recipe.shape.map(s => {
      const arr = [...s].map(ch => ch === '.' ? 0 : recipe.keys[ch]);
      return flip ? arr.slice().reverse() : arr;
    });
  }
  matchRecipe(cells, w) {
    const grid = this.trimGrid(cells, w);
    if (!grid) return null;
    const flat = cells.filter(c => c);
    for (const r of RECIPES) {
      if (r.shapeless) {
        if (flat.length !== r.shapeless.length) continue;
        const need = [...r.shapeless], have = [...flat];
        let ok = true;
        for (const n of need) { const i = have.indexOf(n); if (i < 0) { ok = false; break; } have.splice(i, 1); }
        if (ok) return r;
      } else {
        for (const flip of (r.mirror ? [false, true] : [false])) {
          const rs = this.shapeRows(r, flip);
          if (rs.length !== grid.length || rs[0].length !== grid[0].length) continue;
          let ok = true;
          for (let y = 0; y < rs.length && ok; y++) for (let x = 0; x < rs[0].length; x++) if (rs[y][x] !== grid[y][x]) { ok = false; break; }
          if (ok) return r;
        }
      }
    }
    return null;
  }
  countItem(prof, id) {
    if (!prof || !Array.isArray(prof.inv)) return 0;
    let n = 0;
    for (const slot of prof.inv) if (slot && slot.id === id && slot.dur == null) n += Math.max(0, slot.count | 0);
    return n;
  }
  recipeNeeds(cells) {
    const needs = {};
    for (const id of cells) if (id) needs[id] = (needs[id] || 0) + 1;
    return needs;
  }
  handleCraft(client, m) {
    const rec = this.profileFor(client);
    if (!rec || !m) return;
    if (this.rateLimited(client, 'craft', 8, 16)) return client.send('craftReject', {});
    const w = m.w === 3 ? 3 : 2;
    if (!Array.isArray(m.cells) || m.cells.length !== w * w) return client.send('craftReject', {});
    const stackCounts = [];
    const cells = m.cells.map(v => {
      const raw = v && typeof v === 'object' ? v.id : v;
      const id = raw | 0;
      const count = v && typeof v === 'object' ? Math.max(0, Math.min(64, v.count | 0)) : (id ? 1 : 0);
      stackCounts.push(id ? count : 0);
      return id >= 0 && id <= 999 ? id : 0;
    });
    const recipe = this.matchRecipe(cells, w);
    if (!recipe) return client.send('craftReject', {});
    const needs = this.recipeNeeds(cells);
    let times = m.shift ? 64 : 1;
    for (let i = 0; i < cells.length; i++) if (cells[i]) times = Math.min(times, stackCounts[i]);
    for (const id in needs) times = Math.min(times, Math.floor(this.countItem(rec.prof, id | 0) / needs[id]));
    times = Math.max(0, Math.min(64, times));
    if (!times) return client.send('craftReject', {});
    for (const id in needs) this.consumeItem(rec.prof, id | 0, needs[id] * times);
    const [outId, outCount] = recipe.out;
    const finalCount = this.craftedOutputCount(rec.prof, outId, outCount * times);
    this.addCraftedRewardItem(rec.prof, outId, finalCount);
    this.dirtyPlayers.add(rec.token);
    this.recordCraftProgress(client, outId, finalCount);
    const msg = { out: { id: outId, count: outCount }, times };
    if (finalCount !== outCount * times) msg.finalCount = finalCount;
    client.send('craftResult', msg);
  }
  findCatalogEntry(list, id) {
    return list.find(e => e[0] === id) || null;
  }
  handleShop(client, m) {
    const rec = this.profileFor(client);
    if (!rec || !m) return;
    if (this.rateLimited(client, 'shop', 8, 16)) return client.send('shopReject', { reason: 'rate' });
    const action = m.action === 'sell' ? 'sell' : 'buy';
    const isTavern = m.vendor === 'tavern';
    const isRoad = m.vendor === 'road';
    const isGuild = m.vendor === 'guild';
    const p=this.state.players.get(client.sessionId);
    if(isTavern&&(!p||p.dgn||Math.hypot(p.x-(W.TOWN.TC+19.5),p.z-(W.TOWN.TC+13.5))>8))return client.send('shopReject',{reason:'range'});
    if(isRoad&&(!p||p.dgn||!W.smallDiscoverySpecs().some(s=>s.type==='traveling_merchant'&&Math.hypot(p.x-s.x,p.z-s.z)<6)))return client.send('shopReject',{reason:'range'});
    if (isGuild) {
      const guild = this.guildForToken && this.guildForToken(rec.token);
      if (!this.nearGuildReception || !this.nearGuildReception(client)) return client.send('shopReject', { reason: 'range' });
      if (!guild || !(guild.floor > 0)) return client.send('shopReject', { reason: 'guild_floor' });
      if (action !== 'buy') return client.send('shopReject', { reason: 'invalid' });
    }
    const catalog = isGuild ? GUILD_DECOR_BUY : isTavern ? (action === 'sell' ? TAVERN_SELL : TAVERN_BUY) : isRoad ? (action === 'sell' ? SHOP_SELL : ROAD_MERCHANT_BUY) : (action === 'sell' ? SHOP_SELL : SHOP_BUY);
    const id = m.id | 0;
    const entry = this.findCatalogEntry(catalog, id);
    if (!entry) return client.send('shopReject', { reason: 'invalid' });
    const [, count, price] = entry;
    if (action === 'buy') {
      const kr = this.keyRank(id);
      if (kr >= 0 && kr > this.maxUnlockedGateRankForKey(client, TEAM_KEYS.includes(id) ? 'team' : 'solo')) return client.send('shopReject', { reason: 'rank' });
      if ((rec.prof.gold | 0) < price) return client.send('shopReject', { reason: 'gold' });
      if (this.inventorySpaceFor(rec.prof, id, count) < count) return client.send('shopReject', { reason: 'full' });
      rec.prof.gold -= price;
      this.addRewardItem(rec.prof, id, count);
      this.dirtyPlayers.add(rec.token);
      return client.send('shopResult', { action, vendor: m.vendor || 'market', id, count, gold: -price });
    }
    if (!this.consumeItem(rec.prof, id, count)) return client.send('shopReject', { reason: 'item' });
    rec.prof.gold = Math.max(0, Math.min(1e9, (rec.prof.gold | 0) + price));
    this.dirtyPlayers.add(rec.token);
    if (isTavern) this.recordTavernSaleProgress(client, id, count);
    client.send('shopResult', { action, vendor: isTavern ? 'tavern' : 'market', id, count, gold: price });
  }
  chestKeyForPlayer(client, m) {
    const p = this.state.players.get(client.sessionId);
    if (!p || !m) return null;
    const x = m.x | 0, y = m.y | 0, z = m.z | 0;
    if (!W.inWorld(x, y, z)) return null;
    const block = p.dgn ? (this.instances[p.dgn] && this.instances[p.dgn].getB(x, y, z)) : this.world.getB(x, y, z);
    if (block !== W.B.CHEST) return null;
    if (Math.hypot(x + .5 - p.x, z + .5 - p.z) > 6) return null;
    return (p.dgn || 'overworld') + ':' + x + ',' + y + ',' + z;
  }
  getChestState(key) {
    return this.getChestRecord(key).slots;
  }
  sendChest(client, key) {
    const rec = this.getChestRecord(key);
    const slots = rec.slots.map(s => s ? { ...s } : null);
    client.send('chestState', { key, slots, scope: rec.scope });
    const info = this.parseChestKey(key);
    if (info && info.space !== 'overworld') this.sendDungeonStatus(info.space);
  }
  // Adds up to `count` of `id` to a chest. Returns the number actually placed (0..count),
  // so the caller consumes from inventory only what the chest accepted (no dupe on a full chest).
  addChestItem(slots, id, count) {
    const want = Math.max(0, Math.min(999, count | 0));
    let left = want;
    for (const slot of slots) {
      if (!slot || slot.id !== id || slot.dur != null) continue;
      const add = Math.min(left, 64 - slot.count);
      if (add > 0) { slot.count += add; left -= add; }
      if (!left) return want;
    }
    for (let i = 0; i < slots.length && left > 0; i++) {
      if (!slots[i]) {
        const add = Math.min(left, 64);
        slots[i] = { id, count: add };
        left -= add;
      }
    }
    return want - left;
  }
  removeChestItem(slots, slotIndex, count) {
    const i = Math.max(0, Math.min(slots.length - 1, slotIndex | 0));
    const slot = slots[i];
    if (!slot) return null;
    const take = Math.max(1, Math.min(slot.count, count | 0 || slot.count));
    const out = { id: slot.id, count: take };
    slot.count -= take;
    if (slot.count <= 0) slots[i] = null;
    return out;
  }
  handleChestOpen(client, m) {
    const key = this.chestKeyForPlayer(client, m);
    if (!key || !this.canAccessChest(client, key)) return client.send('chestReject', { reason: 'locked' });
    this.sendChest(client, key);
  }
  handleChestDeposit(client, m) {
    const key = this.chestKeyForPlayer(client, m);
    const rec = this.profileFor(client);
    if (!key || !rec || !m || !this.canAccessChest(client, key)) return client.send('chestReject', { reason: 'locked' });
    if (this.rateLimited(client, 'chest', 10, 20)) return client.send('chestReject', {});
    const id = m.id | 0, count = Math.max(1, Math.min(64, m.count | 0 || 1));
    const slots = this.getChestState(key);
    // place into the chest first, then consume exactly what it accepted — never refund a
    // full count after a partial deposit (which would duplicate the overflow).
    const want = Math.min(count, this.countItem(rec.prof, id));
    const placed = want > 0 ? this.addChestItem(slots, id, want) : 0;
    if (placed <= 0) return client.send('chestReject', {});
    this.consumeItem(rec.prof, id, placed);
    this.dirtyPlayers.add(rec.token);
    if (key.startsWith('overworld:')) this.dirtyChests = true;
    this.sendChest(client, key);
    client.send('chestTx', { action: 'deposit', id, count: placed });
  }
  handleChestWithdraw(client, m) {
    const key = this.chestKeyForPlayer(client, m);
    const rec = this.profileFor(client);
    if (!key || !rec || !m || !this.canAccessChest(client, key)) return client.send('chestReject', { reason: 'locked' });
    if (this.rateLimited(client, 'chest', 10, 20)) return client.send('chestReject', {});
    const slots = this.getChestState(key);
    const item = this.removeChestItem(slots, m.slot, m.count);
    if (!item) return client.send('chestReject', {});
    this.addRewardItem(rec.prof, item.id, item.count);
    this.dirtyPlayers.add(rec.token);
    if (key.startsWith('overworld:')) this.dirtyChests = true;
    this.sendChest(client, key);
    client.send('chestTx', { action: 'withdraw', id: item.id, count: item.count });
  }
  furnaceOkForPlayer(client, m) {
    const p = this.state.players.get(client.sessionId);
    if (!p || !m) return false;
    const x = m.x | 0, y = m.y | 0, z = m.z | 0;
    if (!W.inWorld(x, y, z)) return false;
    const block = p.dgn ? (this.instances[p.dgn] && this.instances[p.dgn].getB(x, y, z)) : this.world.getB(x, y, z);
    return block === W.B.FURNACE && Math.hypot(x + .5 - p.x, z + .5 - p.z) <= 6;
  }
  furnaceKeyForPlayer(client, m) {
    if (!this.furnaceOkForPlayer(client, m)) return null;
    const p = this.state.players.get(client.sessionId);
    return (p.dgn || 'overworld') + ':' + (m.x | 0) + ',' + (m.y | 0) + ',' + (m.z | 0);
  }
  getFurnaceState(key) {
    if (!this.furnaces.has(key)) this.furnaces.set(key, { input: null, fuel: null, output: null, startedAt: 0, finishAt: 0 });
    return this.furnaces.get(key);
  }
  furnacePayload(key) {
    const f = this.getFurnaceState(key);
    return {
      key,
      input: f.input ? { ...f.input } : null,
      fuel: f.fuel ? { ...f.fuel } : null,
      output: f.output ? { ...f.output } : null,
      startedAt: f.startedAt || 0,
      finishAt: f.finishAt || 0,
      now: Date.now(),
    };
  }
  notifyFurnace(key) {
    const [space, pos] = key.split(':');
    const [x, , z] = pos.split(',').map(Number);
    const dgn = space === 'overworld' ? '' : space;
    const payload = this.furnacePayload(key);
    for (const c of this.clients) {
      const p = this.state.players.get(c.sessionId);
      if (!p || (p.dgn || '') !== dgn) continue;
      if (Math.hypot(x + .5 - p.x, z + .5 - p.z) <= 8) c.send('furnaceState', payload);
    }
  }
  completeFurnaces(notify) {
    const now = Date.now();
    for (const [key, f] of this.furnaces) {
      if (!f.finishAt || f.finishAt > now || !f.input) continue;
      const recipe = SMELT[f.input.id];
      if (!recipe) { f.input = null; f.fuel = null; f.startedAt = 0; f.finishAt = 0; this.dirtyFurnaces = true; continue; }
      const [outId, outCount] = recipe;
      if (!f.output) f.output = { id: outId, count: outCount };
      else if (f.output.id === outId) f.output.count = Math.min(64, f.output.count + outCount);
      f.input = null; f.fuel = null; f.startedAt = 0; f.finishAt = 0;
      this.dirtyFurnaces = true;
      if (notify) this.notifyFurnace(key);
    }
  }
  sendFurnace(client, key) {
    this.completeFurnaces();
    client.send('furnaceState', this.furnacePayload(key));
  }
  handleFurnaceOpen(client, m) {
    const key = this.furnaceKeyForPlayer(client, m);
    if (!key) return client.send('furnaceReject', {});
    this.sendFurnace(client, key);
  }
  handleFurnaceSmelt(client, m) {
    const rec = this.profileFor(client);
    const key = this.furnaceKeyForPlayer(client, m);
    if (!rec || !key) return client.send('furnaceReject', {});
    if (this.rateLimited(client, 'furnace', 10, 20)) return client.send('furnaceReject', { reason: 'rate' });
    this.completeFurnaces();
    const f = this.getFurnaceState(key);
    if (f.finishAt || f.output) return client.send('furnaceReject', { reason: 'busy' });
    const input = m.input | 0, fuel = m.fuel | 0;
    const recipe = SMELT[input];
    if (!recipe || !FUEL.has(fuel)) return client.send('furnaceReject', {});
    if (!this.consumeItem(rec.prof, input, 1)) return client.send('furnaceReject', { reason: 'input' });
    if (!this.consumeItem(rec.prof, fuel, 1)) {
      this.addRewardItem(rec.prof, input, 1);
      return client.send('furnaceReject', { reason: 'fuel' });
    }
    f.input = { id: input, count: 1 };
    f.fuel = { id: fuel, count: 1 };
    f.output = null;
    f.startedAt = Date.now();
    f.finishAt = f.startedAt + SMELT_MS;
    this.dirtyPlayers.add(rec.token);
    this.dirtyFurnaces = true;
    client.send('furnaceStarted', { input, fuel });
    this.sendFurnace(client, key);
  }
  handleFurnaceTake(client, m) {
    const rec = this.profileFor(client);
    const key = this.furnaceKeyForPlayer(client, m);
    if (!rec || !key) return client.send('furnaceReject', {});
    if (this.rateLimited(client, 'furnace', 10, 20)) return client.send('furnaceReject', { reason: 'rate' });
    this.completeFurnaces();
    const f = this.getFurnaceState(key);
    if (!f.output) return client.send('furnaceReject', { reason: 'empty' });
    const out = f.output;
    const finalCount = this.craftedOutputCount(rec.prof, out.id, out.count);
    // leave the output in the furnace if it can't all fit — don't null it then lose it
    if (this.inventorySpaceFor(rec.prof, out.id, finalCount) < finalCount) {
      return client.send('furnaceReject', { reason: 'full' });
    }
    f.output = null;
    this.addRewardItem(rec.prof, out.id, finalCount);
    this.dirtyPlayers.add(rec.token);
    this.dirtyFurnaces = true;
    const msg = { out: { id: out.id, count: out.count } };
    if (finalCount !== out.count) msg.finalCount = finalCount;
    client.send('furnaceResult', msg);
    this.sendFurnace(client, key);
  }
}

module.exports = EconomyMixin.prototype;
