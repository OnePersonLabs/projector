import { hydrateInventory, type InventoryEntry, type InventoryResult } from "@projector/analyzers";
import { SqliteObservationSourceCapture } from "@projector/runtime";

/** Worker readers resolve sealed source versions by capture identity. */
export function hydrateCapturedInventory(inventory: InventoryResult): { inventory: InventoryResult; close(): void } {
  const descriptor = inventory.contentStore;
  if (descriptor?.schemaVersion !== "projector.source-content/v2") return hydrateInventory(inventory);
  const capture = SqliteObservationSourceCapture.open(descriptor);
  try {
    const entries = capture.entries(descriptor.paths) as InventoryEntry[];
    return { inventory: { ...inventory, entries }, close: () => capture.close() };
  } catch (error) {
    capture.close();
    throw error;
  }
}
