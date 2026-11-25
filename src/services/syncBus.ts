/**
 * Tiny event bus: every local change to a shared record (stamped via newSyncFields/touch)
 * announces itself here, so the sync provider can schedule a background upload.
 * Records written by a sync merge do not go through it.
 */
type Listener = () => void;
const listeners = new Set<Listener>();

export function emitLocalChange(): void {
  for (const l of listeners) l();
}

export function onLocalChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
