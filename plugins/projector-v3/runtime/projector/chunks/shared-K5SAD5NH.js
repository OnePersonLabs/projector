import {
  SqliteObservationSourceCapture
} from "./shared-QSFRBEBN.js";
import {
  hydrateInventory
} from "./shared-XAKKJSHO.js";

// node_modules/@projector/control-plane/dist/observation/source-inventory.js
function hydrateCapturedInventory(inventory) {
  const descriptor = inventory.contentStore;
  if (descriptor?.schemaVersion !== "projector.source-content/v2")
    return hydrateInventory(inventory);
  const capture = SqliteObservationSourceCapture.open(descriptor);
  try {
    const entries = capture.entries(descriptor.paths);
    return { inventory: { ...inventory, entries }, close: () => capture.close() };
  } catch (error) {
    capture.close();
    throw error;
  }
}

export {
  hydrateCapturedInventory
};
