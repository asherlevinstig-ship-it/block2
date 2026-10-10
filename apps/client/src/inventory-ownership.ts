export function inventoryItemVisible(quantity: number | undefined): boolean {
  return quantity !== undefined && Number.isFinite(quantity) && quantity > 0;
}
