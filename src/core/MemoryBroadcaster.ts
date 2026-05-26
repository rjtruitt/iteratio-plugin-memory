/**
 * MemoryBroadcaster
 *
 * Broadcasts new memory events to subscribed agents.
 * Supports filtering by memory type.
 */

/** A memory entry to be broadcast to subscribed agents. */
export interface BroadcastMemoryEntry {
  key: string;
  content: string;
  agent: string;
  type?: string;
  timestamp?: number;
}

/** Configuration for the MemoryBroadcaster, including transport and event bus. */
export interface MemoryBroadcasterConfig {
  transport: any;
  eventBus: any;
}

type MemoryListener = (memory: BroadcastMemoryEntry) => void;

interface ListenerEntry {
  handler: MemoryListener;
  filter?: { type?: string };
}

export class MemoryBroadcaster {
  private config: MemoryBroadcasterConfig;
  private listeners: ListenerEntry[] = [];

  constructor(config: MemoryBroadcasterConfig) {
    this.config = config;
  }

  /**
   * Subscribe to new memory events
   */
  onNewMemory(handler: MemoryListener, filter?: { type?: string }): void {
    this.listeners.push({ handler, filter });
  }

  /**
   * Store a memory and broadcast to listeners
   */
  async store(entry: BroadcastMemoryEntry): Promise<void> {
    // Add timestamp if not present
    const enriched: BroadcastMemoryEntry = {
      ...entry,
      timestamp: entry.timestamp ?? Date.now(),
    };

    // Notify all matching listeners
    for (const listener of this.listeners) {
      if (listener.filter?.type) {
        // Only notify if type matches
        if (enriched.type === listener.filter.type) {
          listener.handler(enriched);
        }
      } else {
        // No filter - notify all
        listener.handler(enriched);
      }
    }
  }
}
