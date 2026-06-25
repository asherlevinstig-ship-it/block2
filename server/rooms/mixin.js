// Copy a source prototype's (non-enumerable) methods onto a target class.
// Lets cohesive method groups live in their own files yet stay on GameRoom.prototype,
// so call sites and the test harness (Object.create(GameRoom.prototype)) are unchanged.
module.exports = function applyMixin(targetClass, sourceProto) {
  for (const name of Object.getOwnPropertyNames(sourceProto)) {
    if (name === 'constructor') continue;
    Object.defineProperty(targetClass.prototype, name, Object.getOwnPropertyDescriptor(sourceProto, name));
  }
};
