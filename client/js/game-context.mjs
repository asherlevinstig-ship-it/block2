const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

function assertName(name, label) {
  if (typeof name !== 'string' || !name.trim()) throw new TypeError(`${label} name must be a non-empty string`);
  return name.trim();
}

export function createGameContext({ services = {}, state = {} } = {}) {
  const serviceRegistry = Object.create(null);
  const stateRegistry = Object.create(null);
  const moduleRegistry = Object.create(null);
  const loadedModules = [];
  let phase = 'booting';

  const register = (registry, label, name, value, { replace = false } = {}) => {
    const key = assertName(name, label);
    if (!replace && own(registry, key)) throw new Error(`${label} "${key}" is already registered`);
    registry[key] = value;
    return value;
  };

  const context = {
    services: serviceRegistry,
    state: stateRegistry,
    modules: moduleRegistry,

    provide(name, service, options) {
      if (service == null) throw new TypeError(`Service "${name}" cannot be null`);
      return register(serviceRegistry, 'Service', name, service, options);
    },

    requireService(name) {
      const key = assertName(name, 'Service');
      if (!own(serviceRegistry, key)) throw new Error(`Unknown service "${key}"`);
      return serviceRegistry[key];
    },

    registerState(name, value, options) {
      if (value == null || typeof value !== 'object') throw new TypeError(`State "${name}" must be an object`);
      return register(stateRegistry, 'State', name, value, options);
    },

    requireState(name) {
      const key = assertName(name, 'State');
      if (!own(stateRegistry, key)) throw new Error(`Unknown state "${key}"`);
      return stateRegistry[key];
    },

    registerModule(name, api = {}, options) {
      if (api == null || typeof api !== 'object') throw new TypeError(`Module "${name}" API must be an object`);
      return register(moduleRegistry, 'Module', name, api, options);
    },

    requireModule(name) {
      const key = assertName(name, 'Module');
      if (!own(moduleRegistry, key)) throw new Error(`Unknown module "${key}"`);
      return moduleRegistry[key];
    },

    markModuleLoaded(name) {
      const key = assertName(name, 'Module');
      if (!loadedModules.includes(key)) loadedModules.push(key);
      return key;
    },

    setPhase(nextPhase) {
      phase = assertName(nextPhase, 'Phase');
      return phase;
    },

    snapshot() {
      return {
        phase,
        services: Object.keys(serviceRegistry),
        state: Object.keys(stateRegistry),
        modules: Object.keys(moduleRegistry),
        loadedModules: [...loadedModules],
      };
    },
  };

  for (const [name, service] of Object.entries(services)) context.provide(name, service);
  for (const [name, value] of Object.entries(state)) context.registerState(name, value);
  return Object.freeze(context);
}
