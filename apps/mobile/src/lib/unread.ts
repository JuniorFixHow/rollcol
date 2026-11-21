/**
 * The unread notification count, shared by the tab badge and the
 * Notifications screen, so reading them clears the badge straight away.
 */
type Listener = () => void;
const listeners = new Set<Listener>();

/** Ask the badge to count again (after notifications were read or removed). */
export function refreshUnreadBadge(): void {
  for (const listener of listeners) listener();
}

export function onUnreadChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
