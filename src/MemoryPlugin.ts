/**
 * Memory Plugin
 *
 * File-based memory system inspired by Claude Code.
 * No vector store required - just markdown files with frontmatter.
 *
 * Usage:
 * const plugin = MemoryPlugin.builder()
 *   .directory('./memory')
 *   .autoIndex()
 *   .autoCleanup()
 *   .build();
 *
 * agent.addPlugin(plugin);
 *
 * // Create memory
 * await plugin.memory()
 *   .name('user-preferences')
 *   .type('user')
 *   .description('User prefers TypeScript')
 *   .content('...')
 *   .save();
 */

import { MemoryManager } from './MemoryManager';
import { MemoryIndex } from './MemoryIndex';
import { MemoryBuilder } from './MemoryBuilder';
import { Memory, MemoryPluginConfig, MemorySearchOptions } from './types/MemoryTypes';

interface TurnContext {
  turnNumber: number;
  turnCount: number;
  messages: Array<{ role: string; content: string }>;
  state: Record<string, any>;
}

export class MemoryPlugin {
  readonly name = 'memory';
  readonly version = '0.1.0';

  private config: MemoryPluginConfig;
  private manager: MemoryManager;
  private index: MemoryIndex;
  private cleanupTimer?: NodeJS.Timeout;

  /** Create a MemoryPlugin with the given configuration. */
  constructor(config: MemoryPluginConfig) {
    this.config = {
      autoIndex: true,
      autoCleanup: true,
      cleanupInterval: 3600000,  // 1 hour
      ...config
    };

    this.manager = new MemoryManager(config.directory);
    this.index = new MemoryIndex(config.directory);
  }

  /**
   * Initialize plugin
   */
  async initialize(container: any): Promise<void> {
    // Initialize memory directory
    await this.manager.initialize();

    // Start auto-cleanup if enabled
    if (this.config.autoCleanup) {
      this.startAutoCleanup();
    }
  }

  /**
   * Before turn hook - inject memory index into context
   */
  async beforeTurn(context: TurnContext): Promise<void> {
    // TODO: Inject memory index into system message
    // This makes all memories discoverable via index
    const indexContent = await this.index.getContent();

    if (indexContent) {
      // TODO: Add to context
      // context.systemMessage += `\n\nMemory Index:\n${indexContent}`;
    }
  }

  /**
   * After turn hook - extract and store memories from conversation
   */
  async afterTurn(context: TurnContext): Promise<void> {
    // Extract memories from assistant response
    // For now, a no-op
  }

  /**
   * Create new memory (fluent API)
   */
  memory(): MemoryBuilder {
    return new MemoryBuilder()._setManager(this.manager);
  }

  /**
   * Save memory
   */
  async save(memory: Memory): Promise<void> {
    await this.manager.save(memory);

    // Update index
    if (this.config.autoIndex) {
      await this.index.add({
        name: memory.frontmatter.name,
        filename: memory.filename,
        description: memory.frontmatter.description,
        type: memory.frontmatter.type
      });
    }
  }

  /**
   * Load memory by filename
   */
  async load(filename: string): Promise<Memory | null> {
    return await this.manager.load(filename);
  }

  /**
   * Delete memory
   */
  async delete(filename: string): Promise<void> {
    const memory = await this.manager.load(filename);

    await this.manager.delete(filename);

    // Update index
    if (this.config.autoIndex && memory) {
      await this.index.remove(memory.frontmatter.name);
    }
  }

  /**
   * Search memories
   */
  async search(options: MemorySearchOptions | string): Promise<Memory[]> {
    // If string, convert to options
    const searchOptions: MemorySearchOptions =
      typeof options === 'string' ? { query: options } : options;

    // Search index first
    const indexResults = searchOptions.query
      ? await this.index.search(searchOptions.query)
      : await this.index.load();

    // Filter by type if specified
    const filtered = searchOptions.type
      ? indexResults.filter(entry => entry.type === searchOptions.type)
      : indexResults;

    // Limit results
    const limited = searchOptions.limit
      ? filtered.slice(0, searchOptions.limit)
      : filtered;

    // Load full memories
    const memories: Memory[] = [];
    for (const entry of limited) {
      const memory = await this.manager.load(entry.filename);
      if (memory) {
        memories.push(memory);
      }
    }

    return memories;
  }

  /**
   * Get memory index content
   */
  async getIndex(): Promise<string> {
    return await this.index.getContent();
  }

  /**
   * Rebuild memory index
   */
  async rebuildIndex(): Promise<void> {
    await this.index.rebuild(this.manager);
  }

  /**
   * Cleanup expired memories
   */
  async cleanup(): Promise<number> {
    const deleted = await this.manager.cleanup();

    // Rebuild index after cleanup
    if (deleted > 0 && this.config.autoIndex) {
      await this.rebuildIndex();
    }

    return deleted;
  }

  /**
   * Start auto-cleanup timer
   */
  private startAutoCleanup(): void {
    this.cleanupTimer = setInterval(async () => {
      try {
        const deleted = await this.cleanup();
        if (deleted > 0) {
          console.log(`[MemoryPlugin] Auto-cleanup: ${deleted} memories deleted`);
        }
      } catch (error) {
        console.error('[MemoryPlugin] Auto-cleanup failed:', error);
      }
    }, this.config.cleanupInterval);
  }

  /**
   * Shutdown plugin
   */
  async shutdown(): Promise<void> {
    // Stop auto-cleanup
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
  }

  /**
   * Create plugin builder
   */
  static builder(): MemoryPluginBuilder {
    return new MemoryPluginBuilder();
  }
}

/**
 * Memory Plugin Builder
 */
export class MemoryPluginBuilder {
  private config: Partial<MemoryPluginConfig> = {};

  /**
   * Set memory directory
   */
  directory(path: string): this {
    this.config.directory = path;
    return this;
  }

  /**
   * Enable auto-indexing
   */
  autoIndex(enabled = true): this {
    this.config.autoIndex = enabled;
    return this;
  }

  /**
   * Enable auto-cleanup
   */
  autoCleanup(enabled = true): this {
    this.config.autoCleanup = enabled;
    return this;
  }

  /**
   * Set cleanup interval (ms)
   */
  cleanupInterval(ms: number): this {
    this.config.cleanupInterval = ms;
    return this;
  }

  /**
   * Build plugin
   */
  build(): MemoryPlugin {
    if (!this.config.directory) {
      throw new Error('Memory directory is required');
    }

    return new MemoryPlugin(this.config as MemoryPluginConfig);
  }
}

// TODO: Add memory statistics (total, by type, size, etc.)
// TODO: Add memory export/import (backup/restore)
// TODO: Add memory sync (sync between agents)
// TODO: Add memory merge (merge memories from different agents)
// TODO: Add memory conflict resolution (when same memory updated)
// TODO: Add memory notifications (when memory changes)
// TODO: Add memory permissions (read/write access control)
// TODO: Add memory encryption (encrypt sensitive memories)
// TODO: Add memory compression (compress large memories)
// TODO: Add memory versioning (track history)
