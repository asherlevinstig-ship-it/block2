export const PROGRESSION_ERRORS = Object.freeze({
  points: 'No stat points available',
  unowned: 'You do not own that armor',
  incomplete: 'That contract is not complete',
  active: 'You already have an active contract',
  range: 'Meditate inside the Town Shrine',
});

export function bindProgressionMessages(room, api) {
  room.onMessage('jobProgress', message => {
    if (!message) return;
    const before = api.jobLevel(api.getJobXp());
    const wasReady = api.contractReady();
    if (typeof message.jobXp === 'number') api.setJobXp(Math.max(0, message.jobXp | 0));
    api.setContract(api.clampContract(message.contract));
    const after = api.jobLevel(api.getJobXp());
    if (after > before) api.onJobLevel(after);
    if (!wasReady && api.contractReady()) api.onContractReady();
    api.refresh();
  });

  room.onMessage('progressionResult', message => {
    if (!message) return;
    if (message.type === 'armor') api.reconcileArmor();
    if (!message.ok) {
      api.reject(PROGRESSION_ERRORS[message.reason] || 'Progression action rejected');
      return;
    }
    api.accept(message);
    api.refresh();
  });
}
