export function createInventoryModel({ slots, items, size = 36, getEquippedArmor = () => null, onDiscover = () => {}, onChange = () => {} }) {
  if (!Array.isArray(slots)) throw new TypeError('inventory slots must be an array');

  const stackMax = id => items[id] ? items[id].stack : 64;
  const newStack = (id, count) => {
    const stack = { id, count };
    if (items[id] && items[id].tool) stack.dur = items[id].tool.dur;
    if (items[id] && items[id].armor) {
      stack.dur = items[id].armor.dur;
      stack.armorType=items[id].armor.armorType||'vanguard';
    }
    return stack;
  };
  const count = id => slots.reduce((total, stack) => total + (stack && stack.id === id ? stack.count : 0), 0);

  function remove(id, amount) {
    let remaining = Math.max(0, amount | 0);
    for (let i = 0; i < size && remaining > 0; i++) {
      const stack = slots[i];
      if (!stack || stack.id !== id) continue;
      const taken = Math.min(remaining, stack.count);
      stack.count -= taken;
      remaining -= taken;
      if (stack.count <= 0) slots[i] = null;
    }
    if (remaining !== amount) onChange();
    return remaining <= 0;
  }

  function add(id, amount) {
    let remaining = Math.max(0, amount | 0);
    if (!items[id] || !remaining) return remaining;
    onDiscover(id);
    const equipped = getEquippedArmor();
    if (equipped && equipped.id === id) return 0;
    for (let i = 0; i < size && remaining > 0; i++) {
      const stack = slots[i];
      if (stack && stack.id === id && !items[id].tool && !items[id].armor && stack.count < stackMax(id)) {
        const inserted = Math.min(remaining, stackMax(id) - stack.count);
        stack.count += inserted;
        remaining -= inserted;
      }
    }
    for (let i = 0; i < size && remaining > 0; i++) {
      if (slots[i]) continue;
      const inserted = Math.min(remaining, stackMax(id));
      slots[i] = newStack(id, inserted);
      remaining -= inserted;
    }
    onChange();
    return remaining;
  }

  return { slots, stackMax, newStack, count, remove, add };
}

export function createEquipmentModel({ items, getArmor, setArmor, inventory, onChange = () => {} }) {
  function restore(value) {
    const armor = value && items[value.id] && items[value.id].armor ? { ...value, id: value.id, count: 1 } : null;
    setArmor(armor);
    onChange(armor);
    return armor;
  }
  function owns(id) {
    const equipped = getArmor();
    return !!(equipped && equipped.id === id) || inventory.count(id) > 0;
  }
  return { restore, owns, current: getArmor };
}
