/**
 * Typed pub/sub bus for server→browser events, keyed by userId.
 *
 * Any server code can import `userEventBus` and call `sendToUser(userId, event)`.
 * The WebSocket route subscribes per-connection on authenticated upgrade and
 * unsubscribes on close. One user may have multiple subscribers (multi-tab).
 *
 * In-process only. If the app ever runs multi-instance, front this with Redis
 * pub/sub without changing the sendToUser/subscribe API.
 */

export type UserEvent = {
  type: "cui-pair-request";
  requestId: string;
  fingerprint: string;
};

type Handler = (event: UserEvent) => void;

class UserEventBus {
  private subs = new Map<number, Set<Handler>>();

  sendToUser(userId: number, event: UserEvent): void {
    const handlers = this.subs.get(userId);
    if (!handlers) return;
    for (const h of handlers) {
      try {
        h(event);
      } catch (err) {
        console.error("UserEventBus handler threw:", err);
      }
    }
  }

  subscribe(userId: number, handler: Handler): () => void {
    let set = this.subs.get(userId);
    if (!set) {
      set = new Set();
      this.subs.set(userId, set);
    }
    set.add(handler);
    return () => {
      const s = this.subs.get(userId);
      if (!s) return;
      s.delete(handler);
      if (s.size === 0) this.subs.delete(userId);
    };
  }

  hasSubscribers(userId: number): boolean {
    const s = this.subs.get(userId);
    return !!s && s.size > 0;
  }
}

export const userEventBus = new UserEventBus();
