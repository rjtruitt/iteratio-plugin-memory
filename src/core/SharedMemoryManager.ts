/**
 * SharedMemoryManager
 *
 * Manages cross-agent memory sharing with isolation,
 * namespace support, and source tracking.
 */

export interface SharedMemoryEntry {
  key: string;
  content: string;
  storedBy: string;
  storedAt: number;
  private?: boolean;
  type?: string;
  sources?: string[];
  history?: Array<{ agent: string; content: string; timestamp: number }>;
}

export interface SharedMemoryConfig {
  transport: any;
  eventBus: any;
}

export class SharedMemoryManager {
  private _store = new Map<string, SharedMemoryEntry>();
  private namespaces = new Map<string, Map<string, SharedMemoryEntry>>();
  private config: SharedMemoryConfig;

  constructor(config: SharedMemoryConfig) {
    this.config = config;
  }

  /**
   * Store a shared memory accessible by all agents
   */
  async store(agent: string, entry: { key: string; content: string; type?: string }): Promise<void> {
    const now = Date.now();

    // Check for deduplication by content
    const existingByContent = this.findByContent(entry.content);
    if (existingByContent) {
      // Deduplicate: merge sources
      if (!existingByContent.sources) {
        existingByContent.sources = [existingByContent.storedBy];
      }
      if (!existingByContent.sources.includes(agent)) {
        existingByContent.sources.push(agent);
      }
      return;
    }

    const memoryEntry: SharedMemoryEntry = {
      key: entry.key,
      content: entry.content,
      storedBy: agent,
      storedAt: now,
      type: entry.type,
      sources: [agent],
      history: [{ agent, content: entry.content, timestamp: now }],
    };

    this._store.set(entry.key, memoryEntry);

    // Also store in agent namespace
    if (!this.namespaces.has(agent)) {
      this.namespaces.set(agent, new Map());
    }
    this.namespaces.get(agent)!.set(entry.key, memoryEntry);
  }

  /**
   * Store a private memory only accessible by the storing agent
   */
  async storePrivate(agent: string, entry: { key: string; content: string }): Promise<void> {
    const now = Date.now();
    const memoryEntry: SharedMemoryEntry = {
      key: entry.key,
      content: entry.content,
      storedBy: agent,
      storedAt: now,
      private: true,
      sources: [agent],
      history: [{ agent, content: entry.content, timestamp: now }],
    };

    // Store only in the agent's private namespace
    const privateKey = `${agent}::${entry.key}`;
    this._store.set(privateKey, memoryEntry);

    if (!this.namespaces.has(agent)) {
      this.namespaces.set(agent, new Map());
    }
    this.namespaces.get(agent)!.set(entry.key, memoryEntry);
  }

  /**
   * Retrieve a memory by key for a given agent
   */
  async retrieve(agent: string, key: string): Promise<SharedMemoryEntry | null> {
    // First check if this is a private memory of the requesting agent
    const privateKey = `${agent}::${key}`;
    const privateMem = this._store.get(privateKey);
    if (privateMem) {
      return privateMem;
    }

    // Check shared memories
    const sharedMem = this._store.get(key);
    if (sharedMem) {
      // If it's private and not owned by this agent, deny access
      if (sharedMem.private && sharedMem.storedBy !== agent) {
        return null;
      }
      return sharedMem;
    }

    // Check other agents' private stores - should not be accessible
    for (const [ownerAgent, namespace] of this.namespaces) {
      if (ownerAgent === agent) continue;
      const mem = namespace.get(key);
      if (mem && mem.private) {
        return null; // Private memory of another agent
      }
    }

    return null;
  }

  /**
   * Retrieve memory from a specific agent's namespace
   */
  async retrieveFromNamespace(agent: string, key: string): Promise<SharedMemoryEntry | null> {
    const namespace = this.namespaces.get(agent);
    if (!namespace) return null;
    return namespace.get(key) || null;
  }

  /**
   * Update an existing memory
   */
  async update(agent: string, key: string, update: { content: string }): Promise<void> {
    const existing = this._store.get(key);
    if (!existing) return;

    existing.content = update.content;
    existing.history = existing.history || [];
    existing.history.push({ agent, content: update.content, timestamp: Date.now() });
  }

  /**
   * Get all shared (non-private) memories
   */
  async getAll(): Promise<SharedMemoryEntry[]> {
    const results: SharedMemoryEntry[] = [];
    for (const entry of this._store.values()) {
      if (!entry.private) {
        results.push(entry);
      }
    }
    return results;
  }

  /**
   * Find a memory by its content (for deduplication)
   */
  getByContent(content: string): SharedMemoryEntry | null {
    return this.findByContent(content);
  }

  private findByContent(content: string): SharedMemoryEntry | null {
    for (const entry of this._store.values()) {
      if (entry.content === content && !entry.private) {
        return entry;
      }
    }
    return null;
  }
}
