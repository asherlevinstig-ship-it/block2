(function exposeCommsRules(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BlockcraftCommsRules = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function commsRulesFactory() {
  'use strict';
  const PHRASES = Object.freeze({
    hello:'Hello!', follow:'Follow me.', wait:'Wait a moment.', thanks:'Thanks!', good_job:'Good job!', yes:'Yes.', no:'No.',
    gate_ready:'Ready for the Gate?', gate_need_one:'We need one more hunter.', gate_enter:'Enter now.',
    dungeon_group:'Group up.', dungeon_boss:'Focus the boss!', dungeon_loot:'Loot here.', dungeon_retreat:'Retreat!',
    town_trade:'Trading at the market.', town_repairs:'I need repairs.', town_work:'Looking for work.',
    danger_help:'Help me!', danger_run:'Run!', danger_safe:'It is safe now.',
  });
  const CONTEXTS = Object.freeze({
    universal:Object.freeze(['hello','follow','wait','thanks','good_job','yes','no']),
    gate:Object.freeze(['gate_ready','gate_need_one','gate_enter']),
    dungeon:Object.freeze(['dungeon_group','dungeon_boss','dungeon_loot','dungeon_retreat']),
    town:Object.freeze(['town_trade','town_repairs','town_work']),
    danger:Object.freeze(['danger_help','danger_run','danger_safe']),
  });
  const CHANNELS = Object.freeze({
    local:Object.freeze({label:'Local',icon:'◉',color:'#9fd8ff'}),
    party:Object.freeze({label:'Party',icon:'◆',color:'#82e6a7'}),
    whisper:Object.freeze({label:'Whisper',icon:'✦',color:'#d49cff'}),
  });
  const RULES = Object.freeze({localRange:48,rapidCooldownMs:250,duplicateCooldownMs:2000,reportHistoryMs:300000,reportCooldownMs:3600000,maxWheelPhrases:8});
  function phrase(id) { return PHRASES[id] || ''; }
  function phraseIdsFor(context) { return [...(CONTEXTS[context] || []), ...CONTEXTS.universal]; }
  return Object.freeze({PHRASES,CONTEXTS,CHANNELS,RULES,phrase,phraseIdsFor});
});
