const { Schema, MapSchema, defineTypes } = require('@colyseus/schema');

class Player extends Schema {
  constructor() {
    super();
    this.x = 64.5; this.y = 17; this.z = 71.5;
    this.yaw = 0;
    this.name = 'Hunter';
    this.lvl = 1;
    this.path = '';          // ability path id, e.g. 'shadow', 'mage', 'guardian', 'verdant'
    this.job = '';           // '', 'adventurer', 'miner', 'farmer', 'cook', 'blacksmith', 'monk', 'pet_tamer'
    this.jobLvl = 0;         // profession level for nameplates
    this.dim = 'overworld';  // overworld | dungeon | tutorial | event
    this.dgn = '';           // private-space id ('' = shared overworld)
    this.team = '';          // team id ('' = none)
    this.heldId = 0;         // cosmetic render id for currently selected item
    this.armorId = 0;        // cosmetic render id for equipped armor
    this.armorType = '';      // scout | vanguard | bulwark | aegis
    this.mount = '';         // active mount kind ('' = on foot); overworld only
    this.dragons = '';       // CSV of bonded dragon type ids for public roost displays
    this.dragonNames = '';   // JSON map type -> custom dragon name for public roost plates
    this.dragonGenders = ''; // JSON map type -> male/female dragon gender for public roost plates
    this.dragonPersonalities = ''; // JSON map type -> dragon personality for public roost plates
    this.dragonRoles = '';   // JSON map type -> follow/stay/guard/rest for public roost plates
    this.dragonStaySpots = ''; // JSON map type -> saved overworld stay position
    this.dragonHatchedAt = ''; // JSON map type -> hatch timestamp; 0 means legacy/adult dragon
    this.cosmetics = '';     // CSV of public cosmetic unlock ids
    this.appearance = '';    // JSON public hunter appearance palette
    this.familiar = '';      // active familiar ('' = none, 'shade' = Shade manifested)
    this.familiarTier = 0;   // public visual tier of the active familiar
    this.spirit = false;     // defeated inside a dungeon; fixed in place until the player quits
    this.invisible = false;  // Deity invisibility: clients fade the avatar/nameplate
  }
}
defineTypes(Player, {
  x: 'float32', y: 'float32', z: 'float32', yaw: 'float32',
  name: 'string', lvl: 'uint16', path: 'string', job: 'string', jobLvl: 'uint16', dim: 'string', dgn: 'string', team: 'string',
  heldId: 'uint16', armorId: 'uint16', armorType: 'string', mount: 'string', dragons: 'string', dragonNames: 'string', dragonGenders: 'string', dragonPersonalities: 'string', dragonRoles: 'string', dragonStaySpots: 'string', dragonHatchedAt: 'string', cosmetics: 'string', appearance: 'string', familiar: 'string', familiarTier:'uint8', spirit:'boolean', invisible:'boolean',
});

class Team extends Schema {
  constructor() {
    super();
    this.name = '';
    this.leader = '';
    this.memberCount = 0;
    this.private = false;
    this.lfg = false;
  }
}
defineTypes(Team, { name: 'string', leader: 'string', memberCount: 'uint8', private: 'boolean', lfg: 'boolean' });

class Mob extends Schema {
  constructor() {
    super();
    this.x = 0; this.y = 0; this.z = 0; this.yaw = 0;
    this.hp = 10; this.maxHp = 10;
    this.kind = 'zombie';
    this.dgn = '';           // dungeon instance this mob belongs to
    this.state = '';         // telegraph state for client animation
    this.variant = '';       // visual/combat variant (charger, graveguard, miner, drowned, ...)
    this.bossStyle = '';     // named dungeon boss visual style
    this.displayName = '';   // optional nameplate override
    this.elite = false;      // elite variant: client renders a larger, decorated, tinted model
    this.enraged = false;    // persistent boss phase tell
    this.shadowKind = '';    // captured creature identity for allied shadow rendering
    this.shadowRank = 0;
    this.shadowBoss = false;
  }
}
defineTypes(Mob, {
  x: 'float32', y: 'float32', z: 'float32', yaw: 'float32',
  hp: 'float32', maxHp: 'float32', kind: 'string', dgn: 'string', state: 'string', variant: 'string', bossStyle: 'string', displayName: 'string', elite: 'boolean', enraged: 'boolean',
  shadowKind:'string',shadowRank:'uint8',shadowBoss:'boolean',
});

class Gate extends Schema {
  constructor() {
    super();
    this.active = false;
    this.x = 0; this.y = 0; this.z = 0;
    this.rank = 0;
    this.id = '';            // instance key for party entry
    this.seed = 0;           // deterministic dungeon seed shared with clients
    this.dungeonId = '';     // canonical content identity selected from the rank pool
    this.kind = 'public';    // public | solo | team | shard
    this.owner = '';         // player token for solo/key/shard gates
    this.team = '';          // team id for team/shard gates
    this.shardPlus = 0;      // shard tier +N (0 = not a sharded gate)
    this.shardName = '';     // shard tier name (Minor..Radiant)
    this.shardMods = '';     // CSV of active affix names
    this.refundItem = 0;     // private entry currency returned if a live instance is lost on restart
    this.refundOwner = '';   // verified account that paid that currency
    this.expiresAt = 0;      // synced wall-clock expiry for client gate timers
  }
}
defineTypes(Gate, {
  active: 'boolean', x: 'number', y: 'number', z: 'number', rank: 'uint8',
  id: 'string', seed: 'uint32', dungeonId: 'string', kind: 'string', owner: 'string', team: 'string',
  shardPlus: 'uint8', shardName: 'string', shardMods: 'string',
  refundItem: 'uint16', refundOwner: 'string', expiresAt: 'number',
});

class State extends Schema {
  constructor() {
    super();
    this.teams = new MapSchema();
    this.players = new MapSchema();
    this.mobs = new MapSchema();
    this.edits = new MapSchema();   // "x,y,z" -> block id (delta over deterministic worldgen)
    this.gate = new Gate();         // legacy mirror of first public gate for old clients
    this.gates = new MapSchema();   // gate id -> Gate
    this.tod = 0.35;                // time of day: 0 midnight, .25 sunrise, .5 noon, .75 sunset
    this.weather = 'clear';         // server-owned weather: clear | rain | storm
  }
}
defineTypes(State, {
  teams: { map: Team },
  players: { map: Player, view: true },
  mobs: { map: Mob, view: true },
  edits: { map: 'uint8' },
  gate: Gate,
  gates: { map: Gate },
  tod: 'number',
  weather: 'string',
});

module.exports = { State, Player, Mob, Gate, Team };
