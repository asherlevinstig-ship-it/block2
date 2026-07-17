// Economy & storage: inventory, crafting, shops, chests (records + slots) and
// furnaces. Lifted verbatim out of GameRoom.js and mixed into its prototype.
const {
  ARMOR_INFO, BIOME_COLLECTIBLE, CHEST_REWARD_BY_RANK, DUNGEON_BOSS_BONUS_LOOT, DUNGEON_CHEST_BONUS_LOOT, DRAGON_DROP_POOL, DRAGON_EGG_CHEST_CHANCE,
  DRAGON_EGG_OF, FUEL, GUARDIAN_POS, GUILD_DECOR_BUY, I, KEY_LOOT, LEGENDARY_CRAFTS, RECIPES, REWARD_ITEMS,
  ROAD_MERCHANT_BUY, SHARD_ITEM_IDS, SHOP_BUY, SHOP_SELL, SMELT, SMELT_MS, SOLO_KEYS, TAVERN_BUY, TAVERN_SELL, TEAM_KEYS, TOOL_INFO,
  dangerRingAt, jobLevelFor, jobPerkChance, jobPerkTier, keyForRank,
} = require('./constants');
const { State, Player, Mob, Team, Gate } = require('../schema');
const { TeamManager } = require('../teams');
const W = require('../world');
const D = require('../dungeon');
const AI = require('../ai');
const GEAR_SYSTEM = require('../../shared/gear-system');
const LOOT_ECONOMY = require('../../shared/loot-economy');
const JOB_SYSTEM = require('../../shared/job-system');
const { createStore, sanitizeProfile, mergeClientSave, defaultProfile, cleanToken, sanitizeUtilityLoadout } = require('../store');

class EconomyMixin {
  rollWeaponDrop(rank=0,rarityBonus=0,archetype='sword'){
    const ri=Math.max(0,Math.min(5,rank|0));
    const swords=[I.WOOD_SWORD,I.STONE_SWORD,I.IRON_SWORD,I.DIA_SWORD,I.DIA_SWORD,I.DIA_SWORD];
    const axes=[I.WOOD_AXE,I.STONE_AXE,I.IRON_AXE,I.DIA_AXE,I.DIA_AXE,I.DIA_AXE];
    const kind=archetype==='axe'?'axe':'sword',ids=kind==='axe'?axes:swords;
    return {id:ids[ri],count:1,plus:ri<=3?0:ri-3,rarity:GEAR_SYSTEM.rollRarity(Math.random(),rarityBonus).id,archetype:kind,gear:true};
  }
  applyUniqueDungeonSkin(item,kind='weapon',source='',rank=0,roll=Math.random()){
    if(!item||source!=='gate')return item;
    const chance=Math.min(.24,.12+Math.max(0,rank|0)*.018+Math.max(0,item.plus|0)*.02);
    if(Math.max(0,Math.min(.999999,Number(roll)||0))>=chance)return item;
    const unique=GEAR_SYSTEM.rollUniqueId(kind,rank,(roll*9973)%1);
    if(!unique)return item;
    item.unique=unique;
    item.source='unique_gate';
    item.locked=true;
    if(GEAR_SYSTEM.rarityIndexFor(item)<2)item.rarity='rare';
    return item;
  }
  rollFantasyLootTable(table=[],rank=0,rand=Math.random){
    const rows=table[Math.max(0,Math.min(table.length-1,rank|0))]||[],merged=new Map();
    const r=n=>Math.max(0,Math.min(.999999,Number(rand(n))||0));
    let n=0;
    for(const row of rows){
      if(r(n++)>=Math.max(0,Math.min(1,Number(row.chance)||0)))continue;
      const ids=Array.isArray(row.id)?row.id:[row.id];
      const id=ids[Math.min(ids.length-1,Math.floor(r(n++)*ids.length))]|0;
      if(!id)continue;
      const range=Array.isArray(row.count)?row.count:[row.count||1,row.count||1];
      const lo=Math.max(1,range[0]|0),hi=Math.max(lo,range[1]|0);
      const count=lo+Math.floor(r(n++)*(hi-lo+1));
      merged.set(id,(merged.get(id)||0)+count);
    }
    return [...merged].map(([id,count])=>({id,count}));
  }
  rollDungeonBonusLoot(kind='chest',rank=0,rand=Math.random){
    return this.rollFantasyLootTable(kind==='boss'?DUNGEON_BOSS_BONUS_LOOT:DUNGEON_CHEST_BONUS_LOOT,rank,rand);
  }
  gateWeaponArchetype(prof,fallback='sword'){
    const best={sword:-1,axe:-1},stacks=[...(prof&&Array.isArray(prof.inv)?prof.inv:[]),...(prof&&Array.isArray(prof.lootRecovery)?prof.lootRecovery:[])];
    for(const stack of stacks){
      const info=stack&&TOOL_INFO[stack.id];if(!info||!(info.cls in best))continue;
      best[info.cls]=Math.max(best[info.cls],GEAR_SYSTEM.profile(info,stack).powerScore);
    }
    if(best.sword===best.axe)return fallback==='axe'?'axe':'sword';
    return best.axe<best.sword?'axe':'sword';
  }
  rollWeaponDropForSource(source,tier=0,plus=0,prof=null){
    const spec=LOOT_ECONOMY.weaponSpec(source,tier,plus,Math.random());
    if(!spec)return null;
    // Gates and captains are the guaranteed progression sources, so they gear the
    // player's lagging archetype; bandit trash keeps its thematic axe bias.
    const archetype=(source==='gate'||source==='captain')&&prof?this.gateWeaponArchetype(prof,spec.archetype):spec.archetype;
    return this.applyUniqueDungeonSkin({...this.rollWeaponDrop(spec.rank,spec.rarityBonus,archetype),source},'weapon',source,spec.rank);
  }
  rollArmorDrop(rank=0,rarityBonus=0,armorType='vanguard'){
    const ri=Math.max(0,Math.min(5,rank|0));
    const ids=[I.HIDE_ARMOR,I.CHAIN_ARMOR,I.IRON_ARMOR,I.DIA_ARMOR,I.STORMGLASS_ARMOR,I.STORMGLASS_ARMOR];
    return {
      id:ids[ri]||I.IRON_ARMOR,count:1,gearRank:GEAR_SYSTEM.RANKS[ri].id,
      rarity:GEAR_SYSTEM.rollRarity(Math.random(),rarityBonus).id,
      armorType:GEAR_SYSTEM.ARMOR_ARCHETYPES[armorType]?armorType:'vanguard',gear:true,
    };
  }
  rollArmorDropForSource(source,tier=0,plus=0){
    const spec=LOOT_ECONOMY.armorSpec(source,tier,plus,Math.random());
    return spec?this.applyUniqueDungeonSkin({...this.rollArmorDrop(spec.rank,spec.rarityBonus,spec.armorType),source},'armor',source,spec.rank):null;
  }
  gearRewardStack(item,info){
    if(!item||!info)return null;
    const stack={id:item.id,count:1,plus:Math.max(0,Math.min(3,item.plus|0))};
    if(GEAR_SYSTEM.RARITIES.some(r=>r.id===item.rarity))stack.rarity=item.rarity;
    if(GEAR_SYSTEM.RANKS.some((r,i)=>i<6&&r.id===item.gearRank))stack.gearRank=item.gearRank;
    if(ARMOR_INFO[item.id]&&GEAR_SYSTEM.ARMOR_ARCHETYPES[item.armorType])stack.armorType=item.armorType;
    else if(ARMOR_INFO[item.id])stack.armorType=info.armorType||'vanguard';
    if(JOB_SYSTEM.reforgeModifier(item.forge))stack.forge=item.forge;
    if(item.masterwork&&stack.forge)stack.masterwork=true;
    const unique=GEAR_SYSTEM.uniqueFor(item,ARMOR_INFO[item.id]?'armor':'weapon');
    if(unique)stack.unique=unique.id;
    if(item.locked||stack.rarity==='mythic'||(info.tier|0)>=5)stack.locked=true;
    if(typeof item.source==='string'&&item.source)stack.source=item.source.slice(0,32);
    stack.dur=Number.isFinite(item.dur)?Math.max(0,item.dur|0):(ARMOR_INFO[item.id]?GEAR_SYSTEM.armorProfile(info,stack).maxDur:this.toolMaxDur(stack,info));
    return stack;
  }
  addGearRewardItem(prof,item){
    const info=item&&(TOOL_INFO[item.id]||ARMOR_INFO[item.id]);if(!prof||!info)return 1;
    prof.inv=Array.isArray(prof.inv)?prof.inv:[];
    let index=prof.inv.findIndex(s=>!s);if(index<0&&prof.inv.length<36)index=prof.inv.length;
    if(index<0)return 1;
    prof.inv[index]=this.gearRewardStack(item,info);return 0;
  }
  pruneLootRecovery(prof,now=Date.now()){
    if(!prof)return [];
    prof.lootRecovery=(Array.isArray(prof.lootRecovery)?prof.lootRecovery:[])
      .filter(item=>item&&(!item.expiresAt||item.expiresAt>now)).slice(0,12);
    return prof.lootRecovery;
  }
  queueGearRecovery(prof,item,source='loot'){
    const info=item&&(TOOL_INFO[item.id]||ARMOR_INFO[item.id]),stack=this.gearRewardStack(item,info);if(!prof||!stack)return null;
    const queue=this.pruneLootRecovery(prof),now=Date.now(),protectedItem=stack.locked||stack.rarity==='mythic'||(info.tier|0)>=5;
    const entry={...stack,source:String(source||'loot').slice(0,32),acquiredAt:now,expiresAt:protectedItem?0:now+7*24*60*60*1000};
    if(queue.length<12){queue.push(entry);return entry;}
    const score=s=>GEAR_SYSTEM.profile(TOOL_INFO[s.id]||ARMOR_INFO[s.id]||{},s).powerScore;
    let weakest=-1;
    for(let i=0;i<queue.length;i++)if(!queue[i].locked&&(weakest<0||score(queue[i])<score(queue[weakest])))weakest=i;
    if(weakest>=0&&score(entry)>score(queue[weakest])){queue[weakest]=entry;return entry;}
    return null;
  }
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
    if (isObj && raw.supply === true && scope === 'personal') rec.supply = true;
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
    const bonus = this.rollDungeonBonusLoot('chest', rank, n => W.hash2(info.x * 6113 + inst.seed + n * 101, info.z * 3257 + info.y * 313 + rank * 911 + n * 17));
    for (const it of bonus) if (i < slots.length) slots[i++] = { ...it };
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
      for (const s of W.regionalLandmarkSpecs()) {
        if (s.type === 'hunter_camp') this.landmarkCampChests.set(s.x + ',' + (s.y + 1) + ',' + (s.z + 3), s);
        if (s.type === 'bandit_camp') this.landmarkCampChests.set(s.x + ',' + (s.y + 1) + ',' + (s.z + 2), s);
      }
    }
    let site = this.landmarkCampChests.get(info.x + ',' + info.y + ',' + info.z), discovery = false, cache = false;
    if (!site) {
      for (const s of W.smallDiscoverySpecs()) {
        const chest = s.type === 'buried_chest' ? [s.x, s.y - 1, s.z] : s.type === 'traveling_merchant' ? [s.x, s.y + 1, s.z - 2] : null;
        if (chest && chest[0] === info.x && chest[1] === info.y && chest[2] === info.z) { site = s; discovery = true; break; }
      }
    }
    if (!site) {
      for (const s of W.treasureCacheSpecs()) {
        if (s.x === info.x && s.y + 1 === info.y && s.z === info.z) { site = s; cache = true; break; }
      }
    }
    if (!site || this.world.getB(info.x, info.y, info.z) !== W.B.CHEST) return null;
    const ring = dangerRingAt(site.x, site.z), regional = BIOME_COLLECTIBLE[W.biomeAt(site.x, site.z)];
    const roll = W.hash2(site.x * 7717, site.z * 3571), slots = new Array(18).fill(null);
    let i = 0;
    slots[i++] = { id: I.COAL, count: (discovery ? 1 : 2) + ring * (cache ? 2 : 3) };
    if (site.type === 'bandit_camp') slots[i++] = { id: I.IRON_INGOT, count: 2 + ring * 2 };
    if (ring >= 1) slots[i++] = { id: I.IRON_INGOT, count: ring + 1 };
    if (ring >= 2) slots[i++] = { id: I.DIAMOND, count: ring - 1 + (roll > .55 ? 1 : 0) };
    if (regional) slots[i++] = { id: regional.item, count: 1 + ring };
    if (cache && roll > .20) slots[i++] = { id: ring >= 2 ? I.COOKED_MEAT : I.BREAD, count: 1 + (roll > .70 ? 1 : 0) };
    if (cache && roll > .35) slots[i++] = { id: I.REPAIR_KIT, count: 1 };
    if (cache && ring >= 2 && roll > .45) slots[i++] = { id: I.GEODE, count: 1 + (roll > .85 ? 1 : 0) };
    if (cache && ring >= 3 && roll > .55) slots[i++] = { id: I.STORMGLASS, count: 1 };
    if (cache && ring >= 3 && roll > .78) slots[i++] = { id: I.SOLAR_GLYPH, count: 1 };
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
    const camp = this.landmarkCampChests && this.landmarkCampChests.get(info.x + ',' + info.y + ',' + info.z);
    if (camp && camp.type === 'bandit_camp') {
      const state = this.banditCampStates && this.banditCampStates.get(camp.id);
      if (!state || state.phase !== 'cleared' || Date.now() >= state.respawnAt) return false;
    }
    if (rec.scope === 'town') return false;
    if (rec.scope === 'public') return info.space === 'overworld';
    if (rec.scope === 'dungeon') return info.space !== 'overworld' && (p.dgn || '') === info.space;
    if (rec.scope === 'team') return !!rec.team && rec.team === this.cleanTeamId(p.team);
    if (rec.scope === 'personal' && rec.supply === true && this.canUseHomesteadSupplyChest(client, key, rec)) return true;
    return (!!rec.owner && rec.owner === this.clientToken(client)) || (!!rec.team && rec.team === this.cleanTeamId(p.team));
  }
  homesteadSupplyContext(client, key, rec = null) {
    const p = client && this.state.players.get(client.sessionId);
    const info = this.parseChestKey(key);
    if (!p || !info || info.space !== 'overworld') return null;
    const record = rec || this.getChestRecord(key);
    if (!record || record.scope !== 'personal' || record.supply !== true || !record.owner) return null;
    if (!this.world || this.world.getB(info.x, info.y, info.z) !== W.B.CHEST) return null;
    const claim = this.landClaimFor && this.landClaimFor(info.x, info.z);
    if (!claim || claim.owner !== record.owner || this.isLandClaimAbandoned(claim)) return null;
    const group = this.connectedOwnedLandClaims ? this.connectedOwnedLandClaims(info.x, info.z, record.owner) : [];
    if (!group || group.length < 3) return null;
    return { info, rec: record, claim, group, own: record.owner === this.clientToken(client) };
  }
  canUseHomesteadSupplyChest(client, key, rec = null) {
    const ctx = this.homesteadSupplyContext(client, key, rec);
    return !!(ctx && (ctx.own || this.hasLandPermission(client, ctx.claim)));
  }
  canToggleChestSupply(client, key) {
    const ctx = this.homesteadSupplyContext(client, key, this.getChestRecord(key));
    if (ctx) return !!ctx.own;
    const info = this.parseChestKey(key);
    const rec = this.getChestRecord(key);
    const token = this.clientToken(client);
    if (!info || info.space !== 'overworld' || !rec || rec.scope !== 'personal' || rec.owner !== token) return false;
    const claim = this.landClaimFor && this.landClaimFor(info.x, info.z);
    if (!claim || claim.owner !== token || this.isLandClaimAbandoned(claim)) return false;
    const group = this.connectedOwnedLandClaims ? this.connectedOwnedLandClaims(info.x, info.z, token) : [];
    return !!(group && group.length >= 3);
  }
  chestSupplyModeReason(client, key) {
    const info = this.parseChestKey(key);
    if (!info || info.space !== 'overworld') return 'overworld';
    const rec = this.getChestRecord(key);
    const token = this.clientToken(client);
    if (!rec || rec.scope !== 'personal') return 'personal';
    if (!token || rec.owner !== token) return 'owner';
    const claim = this.landClaimFor && this.landClaimFor(info.x, info.z);
    if (!claim || claim.owner !== token) return 'claim';
    if (this.isLandClaimAbandoned(claim)) return 'active';
    const group = this.connectedOwnedLandClaims ? this.connectedOwnedLandClaims(info.x, info.z, token) : [];
    if (!group || group.length < 3) return 'homestead';
    return '';
  }
  chestAccessRejectReason(client, key) {
    if (!key) return 'near';
    const rec = this.getChestRecord(key);
    if (rec && rec.scope === 'personal' && rec.supply === true) {
      const ctx = this.homesteadSupplyContext(client, key, rec);
      if (ctx && !this.hasLandPermission(client, ctx.claim)) return 'supply_trust';
    }
    return 'locked';
  }
  canWithdrawChest(client, key) {
    const rec = this.getChestRecord(key);
    if (rec && rec.scope === 'personal' && rec.supply === true) return rec.owner === this.clientToken(client);
    return this.canAccessChest(client, key);
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
    const gearLike = !!(TOOL_INFO[id] || ARMOR_INFO[id]);
    if (gearLike) return this.addCraftedRewardItem(prof, id, left);
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
    const requested = Math.max(0, count | 0);
    if (TOOL_INFO[id] || ARMOR_INFO[id]) {
      const empty = inv.reduce((n, slot) => n + (slot ? 0 : 1), 0) + Math.max(0, 36 - inv.length);
      return Math.min(requested, empty);
    }
    let room = 0;
    for (const slot of inv) {
      if (slot && slot.id === id && slot.dur == null) room += Math.max(0, 64 - slot.count);
      else if (!slot) room += 64;
    }
    room += Math.max(0, 36 - inv.length) * 64;
    return Math.min(requested, room);
  }
  craftedOutputCount(prof, id, count) {
    let out = Math.max(1, count | 0);
    if ((id === I.BREAD || id === I.HEARTY_SANDWICH || id === I.COOKED_MEAT || id === I.DRAGON_TREAT || id === I.GOLDEN_BROTH || id === I.TRAIL_RATION) && prof.job === 'cook' && Math.random() < jobPerkChance(prof, 'cook', 0.08)) {
      out += Math.max(1, Math.floor(out * 0.25));
    }
    return out;
  }
  // Returns the count that could NOT be placed (0 = all placed). durOverride, when
  // given, pins the durability instead of the default/blacksmith-perk value.
  addCraftedRewardItem(prof, id, count, durOverride) {
    const info = TOOL_INFO[id]||ARMOR_INFO[id];
    if (!info) return this.addRewardItem(prof, id, count);
    let left = Math.max(0, Math.min(64, count | 0));
    prof.inv = Array.isArray(prof.inv) ? prof.inv : [];
    const tier = jobPerkTier(prof, 'blacksmith');
    const dur = durOverride != null
      ? Math.max(1, Math.min(99999, durOverride | 0))
      : (tier ? Math.min(99999, info.dur + Math.max(1, Math.round(info.dur * (0.08 + tier * 0.04)))) : info.dur);
    for (let i = 0; i < prof.inv.length && left > 0; i++) {   // reuse freed holes before growing
      if (prof.inv[i]) continue;
      prof.inv[i] = { id, count: 1, dur, source:'crafted', ...(ARMOR_INFO[id]?{armorType:info.armorType||'vanguard'}:{}) };
      left--;
    }
    while (left > 0 && prof.inv.length < 36) {
      prof.inv.push({ id, count: 1, dur, source:'crafted', ...(ARMOR_INFO[id]?{armorType:info.armorType||'vanguard'}:{}) });
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
    if(ARMOR_INFO[id])this.addGearRewardItem(rec.prof,{id,count:1,rarity:'mythic',locked:true,gear:true});
    else this.addRewardItem(rec.prof, id, 1);
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
    if (recipe.job && (rec.prof.job !== recipe.job || jobLevelFor(rec.prof, recipe.job) < (recipe.level | 0))) {
      return client.send('craftReject', { reason: 'profession', job: recipe.job, level: recipe.level | 0 });
    }
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
    if ((outId | 0) === W.B.TABLE || (outId | 0) === W.B.FURNACE) this.advanceProgressionDirector(client, 'crafted_station', { profile: false });
    const msg = { out: { id: outId, count: outCount }, times, inv: rec.prof.inv };
    if (finalCount !== outCount * times) msg.finalCount = finalCount;
    client.send('craftResult', msg);
  }
  findCatalogEntry(list, id) {
    return list.find(e => e[0] === id) || null;
  }
  townTavernAnchor(x, z) {
    return W.townPos(x, z, 'tavern');
  }
  handleShop(client, m) {
    const rec = this.profileFor(client);
    if (!rec || !m) return;
    const action = m.action === 'sell' ? 'sell' : 'buy';
    const isTavern = m.vendor === 'tavern';
    const isRoad = m.vendor === 'road';
    const isGuild = m.vendor === 'guild';
    const vendor = isTavern ? 'tavern' : isRoad ? 'road' : isGuild ? 'guild' : 'market';
    const reject = reason => client.send('shopReject', { reason, vendor });
    if (this.rateLimited(client, 'shop', 8, 16)) return reject('rate');
    const p=this.state.players.get(client.sessionId);
    const tavern=this.townTavernAnchor(83.5,77.5);
    if(isTavern&&(!p||p.dgn||Math.hypot(p.x-tavern.x,p.z-tavern.z)>9))return reject('range');
    if(isRoad&&(!p||p.dgn||!W.smallDiscoverySpecs().some(s=>s.type==='traveling_merchant'&&Math.hypot(p.x-s.x,p.z-s.z)<6)))return reject('range');
    if (isGuild) {
      const guild = this.guildForToken && this.guildForToken(rec.token);
      if (!this.nearGuildReception || !this.nearGuildReception(client)) return reject('range');
      if (!guild || !(guild.floor > 0)) return reject('guild_floor');
      if (action !== 'buy') return reject('invalid');
    }
    const roadSafety=this.roadSafetySnapshot?this.roadSafetySnapshot().score:50;
    const wardenStock=ROAD_MERCHANT_BUY.concat((rec.prof.roadWardenRep|0)>=3?[[I.IRON_INGOT,1,18]]:[],(rec.prof.roadWardenRep|0)>=6?[[I.COOKED_MEAT,2,16]]:[],roadSafety>=80?[[I.BREAD,2,12]]:[]);
    const catalog = isGuild ? GUILD_DECOR_BUY : isTavern ? (action === 'sell' ? TAVERN_SELL : TAVERN_BUY) : isRoad ? (action === 'sell' ? SHOP_SELL : wardenStock) : (action === 'sell' ? SHOP_SELL : SHOP_BUY);
    const id = m.id | 0;
    const entry = this.findCatalogEntry(catalog, id);
    if (!entry) return reject('invalid');
    let [, count, price] = entry;
    if(action==='buy'&&isRoad){
      const personal=Math.min(.15,Math.floor((rec.prof.roadWardenRep|0)/3)*.05),regional=roadSafety>=80?.10:roadSafety>=60?.05:0;
      price=Math.max(1,Math.ceil(price*(1-personal-regional)));
    }
    const discountUntil = this.caravanDiscounts && this.caravanDiscounts.get(rec.token);
    if (action === 'buy' && isRoad && discountUntil > Date.now()) price = Math.max(1, Math.ceil(price * .8));
    if (action === 'buy' && isTavern && id === I.COOKED_MEAT) {
      const bundles = Math.max(1, Math.min(3, m.count | 0 || 1));
      count *= bundles;
      price *= bundles;
    }
    if (action === 'buy') {
      const kr = this.keyRank(id);
      if (kr >= 0 && kr > this.maxUnlockedGateRankForKey(client, TEAM_KEYS.includes(id) ? 'team' : 'solo')) return reject('rank');
      if ((rec.prof.gold | 0) < price) return reject('gold');
      if (this.inventorySpaceFor(rec.prof, id, count) < count) return reject('full');
      rec.prof.gold -= price;
      this.addRewardItem(rec.prof, id, count);
      this.dirtyPlayers.add(rec.token);
      if (this.recordEconomyGold) this.recordEconomyGold(client, -price, 'shop_sink', vendor + '_buy', { id, count });
      return client.send('shopResult', { action, vendor: m.vendor || 'market', id, count, gold: -price });
    }
    if (!this.consumeItem(rec.prof, id, count)) return reject('item');
    rec.prof.gold = Math.max(0, Math.min(1e9, (rec.prof.gold | 0) + price));
    this.dirtyPlayers.add(rec.token);
    if (this.recordEconomyGold) this.recordEconomyGold(client, price, 'shop_faucet', vendor + '_sell', { id, count });
    if (isTavern) this.recordTavernSaleProgress(client, id, count);
    client.send('shopResult', { action, vendor: isTavern ? 'tavern' : 'market', id, count, gold: price });
  }
  handleTavernDice(client, m) {
    const rec = this.profileFor(client);
    const reject = reason => client.send('tavernDiceResult', { ok: false, reason, tokens: rec && rec.prof ? rec.prof.tavernTokens | 0 : 0 });
    if (!rec || !m) return;
    if (this.rateLimited(client, 'tavernDice', 4, 8)) return reject('rate');
    const p = this.state.players.get(client.sessionId);
    const { x: tableX, z: tableZ } = this.townTavernAnchor(74.5, 89.5);
    if (!p || p.dgn || Math.hypot(p.x - tableX, p.z - tableZ) > 4.2) return reject('range');
    const wager = ['low', 'seven', 'high'].includes(m.wager) ? m.wager : 'high';
    const bet = Math.max(1, Math.min(25, m.bet | 0 || 1));
    if ((rec.prof.tavernTokens | 0) < bet) return reject('tokens');
    const d1 = 1 + Math.floor(Math.random() * 6);
    const d2 = 1 + Math.floor(Math.random() * 6);
    const total = d1 + d2;
    const win = (wager === 'low' && total <= 6) || (wager === 'seven' && total === 7) || (wager === 'high' && total >= 8);
    const mult = wager === 'seven' ? 4 : 2;
    const payout = win ? bet * mult : 0;
    const delta = payout - bet;
    rec.prof.tavernTokens = Math.max(0, Math.min(1000000, (rec.prof.tavernTokens | 0) + delta));
    this.dirtyPlayers.add(rec.token);
    client.send('tavernDiceResult', { ok: true, wager, bet, dice: [d1, d2], total, win, payout, delta, tokens: rec.prof.tavernTokens | 0 });
  }
  rouletteColor(number) {
    const reds = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
    number |= 0;
    if (number === 0) return 'green';
    return reds.has(number) ? 'red' : 'black';
  }
  rouletteWins(wager, number) {
    const color = this.rouletteColor(number);
    if (wager === 'red' || wager === 'black') return color === wager;
    if (wager === 'odd') return number > 0 && number % 2 === 1;
    if (wager === 'even') return number > 0 && number % 2 === 0;
    if (wager === 'dozen1') return number >= 1 && number <= 12;
    if (wager === 'dozen2') return number >= 13 && number <= 24;
    if (wager === 'dozen3') return number >= 25 && number <= 36;
    if (wager === 'zero') return number === 0;
    return false;
  }
  handleTavernRoulette(client, m) {
    const rec = this.profileFor(client);
    const reject = reason => client.send('tavernRouletteResult', { ok: false, reason, tokens: rec && rec.prof ? rec.prof.tavernTokens | 0 : 0 });
    if (!rec || !m) return;
    if (this.rateLimited(client, 'tavernRoulette', 4, 8)) return reject('rate');
    const p = this.state.players.get(client.sessionId);
    const { x: tableX, z: tableZ } = this.townTavernAnchor(84.5, 89.5);
    if (!p || p.dgn || Math.hypot(p.x - tableX, p.z - tableZ) > 4.2) return reject('range');
    const valid = ['red', 'black', 'odd', 'even', 'dozen1', 'dozen2', 'dozen3', 'zero'];
    const wager = valid.includes(m.wager) ? m.wager : 'red';
    const bet = Math.max(1, Math.min(25, m.bet | 0 || 1));
    if ((rec.prof.tavernTokens | 0) < bet) return reject('tokens');
    const number = Math.floor(Math.random() * 37);
    const color = this.rouletteColor(number);
    const win = this.rouletteWins(wager, number);
    const mult = wager === 'zero' ? 20 : wager.startsWith('dozen') ? 3 : 2;
    const payout = win ? bet * mult : 0;
    const delta = payout - bet;
    rec.prof.tavernTokens = Math.max(0, Math.min(1000000, (rec.prof.tavernTokens | 0) + delta));
    this.dirtyPlayers.add(rec.token);
    client.send('tavernRouletteResult', { ok: true, wager, bet, number, color, win, payout, delta, tokens: rec.prof.tavernTokens | 0 });
  }
  blackjackCard() {
    const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const suits = ['♠', '♥', '♦', '♣'];
    return ranks[Math.floor(Math.random() * ranks.length)] + suits[Math.floor(Math.random() * suits.length)];
  }
  blackjackTotal(cards) {
    let total = 0, aces = 0;
    for (const card of Array.isArray(cards) ? cards : []) {
      const rank = String(card || '').slice(0, -1);
      if (rank === 'A') { total += 11; aces++; }
      else if (['K', 'Q', 'J'].includes(rank)) total += 10;
      else total += Math.max(0, Math.min(10, rank | 0));
    }
    while (total > 21 && aces > 0) { total -= 10; aces--; }
    return total;
  }
  blackjackHandFor(client) {
    if (!this.tavernBlackjackHands) this.tavernBlackjackHands = new Map();
    return this.tavernBlackjackHands.get(client.sessionId) || null;
  }
  blackjackSend(client, rec, hand, extra = {}) {
    const settled = hand && hand.phase === 'settled';
    const dealer = settled ? hand.dealer : (hand && hand.dealer ? [hand.dealer[0]] : []);
    client.send('tavernBlackjackState', {
      ok: true,
      phase: hand ? hand.phase : 'idle',
      bet: hand ? hand.bet | 0 : 0,
      player: hand ? hand.player.slice() : [],
      dealer,
      dealerHidden: !!(hand && !settled && hand.dealer && hand.dealer.length > 1),
      playerTotal: hand ? this.blackjackTotal(hand.player) : 0,
      dealerTotal: settled ? this.blackjackTotal(hand.dealer) : (hand && hand.dealer ? this.blackjackTotal([hand.dealer[0]]) : 0),
      tokens: rec && rec.prof ? rec.prof.tavernTokens | 0 : 0,
      ...extra,
    });
  }
  blackjackSettle(client, rec, hand, result) {
    const bet = hand.bet | 0;
    let payout = 0, label = result;
    if (result === 'blackjack') payout = bet * 3;
    else if (result === 'win') payout = bet * 2;
    else if (result === 'push') payout = bet;
    else label = 'lose';
    rec.prof.tavernTokens = Math.max(0, Math.min(1000000, (rec.prof.tavernTokens | 0) + payout));
    hand.phase = 'settled';
    const delta = payout - bet;
    this.dirtyPlayers.add(rec.token);
    this.blackjackSend(client, rec, hand, { result: label, payout, delta });
  }
  handleTavernBlackjack(client, m) {
    const rec = this.profileFor(client);
    const reject = reason => client.send('tavernBlackjackState', { ok: false, reason, tokens: rec && rec.prof ? rec.prof.tavernTokens | 0 : 0 });
    if (!rec || !m) return;
    if (this.rateLimited(client, 'tavernBlackjack', 6, 10)) return reject('rate');
    const p = this.state.players.get(client.sessionId);
    const { x: tableX, z: tableZ } = this.townTavernAnchor(79.5, 89.5);
    if (!p || p.dgn || Math.hypot(p.x - tableX, p.z - tableZ) > 4.2) return reject('range');
    if (!this.tavernBlackjackHands) this.tavernBlackjackHands = new Map();
    const action = m.action === 'hit' || m.action === 'stand' || m.action === 'clear' ? m.action : 'deal';
    let hand = this.blackjackHandFor(client);
    if (hand && hand.phase === 'playing' && Date.now() - (hand.createdAt || 0) > 120000) {
      this.refundTavernBlackjack(client, 'expired');
      hand = null;
    }
    if (action === 'clear') {
      if (hand && hand.phase === 'playing') this.refundTavernBlackjack(client, 'abandoned');
      else this.tavernBlackjackHands.delete(client.sessionId);
      return this.blackjackSend(client, rec, null);
    }
    if (action === 'deal') {
      if (hand && hand.phase === 'playing') return this.blackjackSend(client, rec, hand);
      const bet = Math.max(1, Math.min(25, m.bet | 0 || 1));
      if ((rec.prof.tavernTokens | 0) < bet) return reject('tokens');
      rec.prof.tavernTokens = Math.max(0, (rec.prof.tavernTokens | 0) - bet);
      hand = { phase: 'playing', bet, createdAt: Date.now(), player: [this.blackjackCard(), this.blackjackCard()], dealer: [this.blackjackCard(), this.blackjackCard()] };
      this.tavernBlackjackHands.set(client.sessionId, hand);
      this.dirtyPlayers.add(rec.token);
      const pt = this.blackjackTotal(hand.player), dt = this.blackjackTotal(hand.dealer);
      if (pt === 21 || dt === 21) return this.blackjackSettle(client, rec, hand, pt === 21 && dt === 21 ? 'push' : pt === 21 ? 'blackjack' : 'lose');
      return this.blackjackSend(client, rec, hand);
    }
    if (!hand || hand.phase !== 'playing') return reject('hand');
    if (action === 'hit') {
      hand.player.push(this.blackjackCard());
      const total = this.blackjackTotal(hand.player);
      if (total > 21) return this.blackjackSettle(client, rec, hand, 'lose');
      if (total === 21) m = { action: 'stand' };
      else return this.blackjackSend(client, rec, hand);
    }
    while (this.blackjackTotal(hand.dealer) < 17) hand.dealer.push(this.blackjackCard());
    const pt = this.blackjackTotal(hand.player), dt = this.blackjackTotal(hand.dealer);
    const result = dt > 21 || pt > dt ? 'win' : pt === dt ? 'push' : 'lose';
    return this.blackjackSettle(client, rec, hand, result);
  }
  refundTavernBlackjack(client, reason = 'abandoned') {
    if (!client || !this.tavernBlackjackHands) return 0;
    const hand = this.tavernBlackjackHands.get(client.sessionId);
    if (!hand || hand.phase !== 'playing') { this.tavernBlackjackHands.delete(client.sessionId); return 0; }
    const rec = this.profileFor(client), refund = Math.max(0, hand.bet | 0);
    if (rec && refund) {
      rec.prof.tavernTokens = Math.min(1000000, (rec.prof.tavernTokens | 0) + refund);
      this.dirtyPlayers.add(rec.token);
    }
    this.tavernBlackjackHands.delete(client.sessionId);
    return refund;
  }
  handleTavernTokenExchange(client, m) {
    const rec = this.profileFor(client);
    const reject = reason => client.send('tavernTokenResult', { ok: false, reason, gold: rec && rec.prof ? rec.prof.gold | 0 : 0, tokens: rec && rec.prof ? rec.prof.tavernTokens | 0 : 0, remaining: rec && rec.prof ? Math.max(0, 100-(rec.prof.tavernTokenBoughtToday|0)) : 0 });
    if (!rec || !m) return;
    if (this.rateLimited(client, 'tavernTokenExchange', 3, 6)) return reject('rate');
    const p = this.state.players.get(client.sessionId);
    const tavern=this.townTavernAnchor(83.5,77.5);
    if (!p || p.dgn || Math.hypot(p.x - tavern.x, p.z - tavern.z) > 9) return reject('range');
    const day = new Date().toISOString().slice(0, 10);
    if (rec.prof.tavernTokenDay !== day) { rec.prof.tavernTokenDay = day; rec.prof.tavernTokenBoughtToday = 0; }
    const amount = Math.max(1, Math.min(25, m.amount | 0 || 5));
    if ((rec.prof.tavernTokenBoughtToday | 0) + amount > 100) return reject('daily');
    if ((rec.prof.gold | 0) < amount) return reject('gold');
    rec.prof.gold -= amount;
    rec.prof.tavernTokens = Math.min(1000000, (rec.prof.tavernTokens | 0) + amount);
    rec.prof.tavernTokenBoughtToday = (rec.prof.tavernTokenBoughtToday | 0) + amount;
    this.dirtyPlayers.add(rec.token);
    if (this.recordEconomyGold) this.recordEconomyGold(client, -amount, 'gambling_sink', 'tavern_tokens', { tokens: amount });
    client.send('tavernTokenResult', { ok: true, amount, gold: rec.prof.gold | 0, tokens: rec.prof.tavernTokens | 0, remaining: 100 - rec.prof.tavernTokenBoughtToday });
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
    client.send('chestState', {
      key,
      slots,
      scope: rec.scope,
      supply: rec.supply === true,
      canToggleSupply: this.canToggleChestSupply(client, key),
      supplyModeReason: this.chestSupplyModeReason(client, key),
      canWithdraw: this.canWithdrawChest(client, key),
    });
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
  isSimpleChestBulkStack(stack) {
    if (!stack || !stack.id || stack.dur != null || stack.plus || stack.gearRank || stack.rarity || stack.armorType || stack.forge || stack.masterwork || stack.unique || stack.locked || stack.source) return false;
    return !TOOL_INFO[stack.id] && !ARMOR_INFO[stack.id];
  }
  isProtectedChestBulkItem(id) {
    return SOLO_KEYS.includes(id) || TEAM_KEYS.includes(id) || SHARD_ITEM_IDS.includes(id) || [
      I.LEGEND_TOKEN, I.LEGEND_SWORD, I.LEGEND_ARMOR, I.BLACKHOLE_STAFF,
      I.DRAGON_EGG, I.EGG_VERDANT, I.EGG_FROST, I.EGG_STORM, I.EGG_VOID, I.DRAGON_TREAT,
      I.SHADOW_SIGIL, I.FANG_TOTEM, I.MOTE_CHARM, I.FORAGE_CHARM,
    ].includes(id);
  }
  isChestBulkMaterial(id) {
    if (!id || this.isProtectedChestBulkItem(id) || TOOL_INFO[id] || ARMOR_INFO[id]) return false;
    if (id < 100) return true;
    return [
      I.STICK, I.COAL, I.CHARCOAL, I.IRON_INGOT, I.DIAMOND,
      I.WHEAT_SEEDS, I.WHEAT, I.WINDSEED, I.HEARTWOOD_RESIN, I.SUNSHARD,
      I.MESA_AMBER, I.FROST_CRYSTAL, I.MIRE_BLOOM, I.RIVER_FISH,
      I.COMPOST, I.GOLDEN_WHEAT, I.GEODE, I.RAINWAKE_PETAL,
      I.STORMGLASS, I.SOLAR_GLYPH,
    ].includes(id);
  }
  handleChestBatchDeposit(client, m) {
    const key = this.chestKeyForPlayer(client, m);
    const rec = this.profileFor(client);
    if (!key || !rec || !m || !this.canAccessChest(client, key)) return client.send('chestReject', { reason: this.chestAccessRejectReason(client, key) });
    if (this.rateLimited(client, 'chestBatch', 3, 6)) return client.send('chestReject', { reason: 'rate' });
    const mode = m.mode === 'materials' ? 'materials' : 'matching';
    const slots = this.getChestState(key);
    const chestIds = new Set(slots.filter(Boolean).map(s => s.id | 0));
    const prof = rec.prof;
    const moved = [];
    let placedTotal = 0, stackTotal = 0, eligible = 0, protectedSkipped = 0;
    for (let i = 9; i < 36; i++) {
      const stack = prof.inv[i];
      if (!stack) continue;
      const id = stack.id | 0;
      if (!this.isSimpleChestBulkStack(stack)) continue;
      if (this.isProtectedChestBulkItem(id)) { protectedSkipped++; continue; }
      const ok = mode === 'materials' ? this.isChestBulkMaterial(id) : chestIds.has(id);
      if (!ok) continue;
      eligible++;
      const count = Math.max(1, Math.min(64, stack.count | 0 || 1));
      const placed = this.addChestItem(slots, id, count);
      if (placed <= 0) continue;
      stack.count = count - placed;
      if (stack.count <= 0) prof.inv[i] = null;
      placedTotal += placed;
      stackTotal++;
      moved.push({ slot: i, id, count: placed });
      chestIds.add(id);
    }
    if (placedTotal <= 0) {
      return client.send('chestReject', { reason: eligible > 0 ? 'full' : (mode === 'materials' ? 'no_materials' : 'no_matching') });
    }
    this.dirtyPlayers.add(rec.token);
    if (key.startsWith('overworld:')) this.dirtyChests = true;
    this.sendChest(client, key);
    client.send('chestBatchResult', { ok: true, mode, count: placedTotal, stacks: stackTotal, protectedSkipped, items: moved });
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
    if (!key || !this.canAccessChest(client, key)) return client.send('chestReject', { reason: this.chestAccessRejectReason(client, key) });
    this.sendChest(client, key);
  }
  handleChestDeposit(client, m) {
    const key = this.chestKeyForPlayer(client, m);
    const rec = this.profileFor(client);
    if (!key || !rec || !m || !this.canAccessChest(client, key)) return client.send('chestReject', { reason: this.chestAccessRejectReason(client, key) });
    if (this.rateLimited(client, 'chest', 10, 20)) return client.send('chestReject', { reason: 'rate' });
    const id = m.id | 0, count = Math.max(1, Math.min(64, m.count | 0 || 1));
    const slots = this.getChestState(key);
    // place into the chest first, then consume exactly what it accepted — never refund a
    // full count after a partial deposit (which would duplicate the overflow).
    const want = Math.min(count, this.countItem(rec.prof, id));
    const placed = want > 0 ? this.addChestItem(slots, id, want) : 0;
    if (placed <= 0) return client.send('chestReject', { reason: 'full' });
    this.consumeItem(rec.prof, id, placed);
    this.dirtyPlayers.add(rec.token);
    if (key.startsWith('overworld:')) this.dirtyChests = true;
    this.sendChest(client, key);
    client.send('chestTx', { action: 'deposit', id, count: placed });
  }
  handleChestWithdraw(client, m) {
    const key = this.chestKeyForPlayer(client, m);
    const rec = this.profileFor(client);
    if (!key || !rec || !m || !this.canWithdrawChest(client, key)) {
      const chest = key && this.getChestRecord(key);
      return client.send('chestReject', { reason: chest && chest.supply === true ? 'supply_owner' : 'owner' });
    }
    if (this.rateLimited(client, 'chest', 10, 20)) return client.send('chestReject', { reason: 'rate' });
    const slots = this.getChestState(key);
    const item = this.removeChestItem(slots, m.slot, m.count);
    if (!item) return client.send('chestReject', { reason: 'empty' });
    this.addRewardItem(rec.prof, item.id, item.count);
    this.dirtyPlayers.add(rec.token);
    if (key.startsWith('overworld:')) this.dirtyChests = true;
    this.sendChest(client, key);
    client.send('chestTx', { action: 'withdraw', id: item.id, count: item.count });
  }
  handleChestMode(client, m) {
    const key = this.chestKeyForPlayer(client, m);
    if (!key || !m) return client.send('chestReject', { reason: 'near' });
    if (!this.canToggleChestSupply(client, key)) {
      const reason = this.chestSupplyModeReason(client, key) || 'owner';
      return client.send('chestReject', { reason: reason === 'owner' ? 'supply_toggle_owner' : 'supply_' + reason });
    }
    const rec = this.getChestRecord(key);
    if (!rec) return client.send('chestReject', { reason: 'supply_toggle_owner' });
    if (m.supply === true) rec.supply = true;
    else delete rec.supply;
    this.chests.set(key, rec);
    if (key.startsWith('overworld:')) this.dirtyChests = true;
    this.sendChest(client, key);
    client.send('chestModeResult', { key, supply: rec.supply === true });
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
