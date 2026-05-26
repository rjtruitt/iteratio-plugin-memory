/**
 * Memory Index
 *
 * Manages MEMORY.md index file.
 * This file is ALWAYS loaded into context for fast lookup.
 *
 * Format (based on Claude Code):
 * - [memory-name](filename.md) — Short description (150-200 chars)
 *
 * Example:
 * - [llm-flight-controller library](project_llm_flight_controller.md) — Building modular LLM communication library
 * - [TypeScript errors in library](project_library_ts_fixes.md) — Fixed 117→22 errors, ready for integration
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { MemoryIndexEntry } from './types/MemoryTypes';

export interface ILogger {
  debug(msg: string): void;
  info(msg: string): void;
}

export class MemoryIndex {
  private directory: string;
  private indexFile: string;
  private maxEntryLength = 200;  // Max chars per index entry

  /** Create a MemoryIndex for the given directory. */
  constructor(
    directory: string,
    private logger?: ILogger
  ) {
    this.directory = directory;
    this.indexFile = path.join(directory, 'MEMORY.md');
  }

  /**
   * Load index from file
   */
  async load(): Promise<MemoryIndexEntry[]> {
    try {
      const content = await fs.readFile(this.indexFile, 'utf8');
      return this.parse(content);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return [];  // Index doesn't exist yet
      }
      throw error;
    }
  }

  /**
   * Save index to file
   */
  async save(entries: MemoryIndexEntry[]): Promise<void> {
    const content = this.serialize(entries);
    await fs.writeFile(this.indexFile, content, 'utf8');
    this.logger?.debug('Memory index updated');
  }

  /**
   * Add entry to index
   */
  async add(entry: MemoryIndexEntry): Promise<void> {
    const entries = await this.load();

    // Remove existing entry with same name (update)
    const filtered = entries.filter(e => e.name !== entry.name);

    // Add new entry
    filtered.push(entry);

    // Sort by type, then name
    filtered.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type.localeCompare(b.type);
      }
      return a.name.localeCompare(b.name);
    });

    await this.save(filtered);
  }

  /**
   * Remove entry from index
   */
  async remove(name: string): Promise<void> {
    const entries = await this.load();
    const filtered = entries.filter(e => e.name !== name);
    await this.save(filtered);
  }

  /**
   * Rebuild entire index from memory files
   */
  async rebuild(memoryManager: any): Promise<void> {
    const memories = await memoryManager.loadAll();
    const entries: MemoryIndexEntry[] = memories.map((memory: any) => ({
      name: memory.frontmatter.name,
      filename: memory.filename,
      description: this.truncateDescription(memory.frontmatter.description),
      type: memory.frontmatter.type
    }));

    await this.save(entries);
    this.logger?.info(`Index rebuilt with ${entries.length} entries`);
  }

  /**
   * Get index content as string (for injecting into context)
   */
  async getContent(): Promise<string> {
    try {
      return await fs.readFile(this.indexFile, 'utf8');
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return '';  // Empty index
      }
      throw error;
    }
  }

  /**
   * Search index by keyword (ranked by relevance)
   */
  async search(query: string): Promise<MemoryIndexEntry[]> {
    const scored = await this.searchWithScoring(query);
    return scored.map(s => s.entry);
  }

  /**
   * Search with scoring - name matches score higher than description matches
   */
  async searchWithScoring(query: string): Promise<{ entry: MemoryIndexEntry; score: number }[]> {
    const entries = await this.load();
    const lowerQuery = query.toLowerCase();
    const results: { entry: MemoryIndexEntry; score: number }[] = [];

    for (const entry of entries) {
      let score = 0;
      const nameMatch = entry.name.toLowerCase().includes(lowerQuery);
      const descMatch = entry.description.toLowerCase().includes(lowerQuery);

      if (nameMatch) {
        score += 2;
        // Exact match bonus
        if (entry.name.toLowerCase() === lowerQuery) {
          score += 1;
        }
      }
      if (descMatch) {
        score += 1;
      }

      if (score > 0) {
        results.push({ entry, score });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results;
  }

  /**
   * Parse index content
   * Format: - [name](filename.md) — description
   */
  private parse(content: string): MemoryIndexEntry[] {
    const lines = content.split('\n').filter(line => line.trim().startsWith('-'));
    const entries: MemoryIndexEntry[] = [];

    for (const line of lines) {
      const match = line.match(/^-\s*\[([^\]]+)\]\(([^\)]+)\)\s*—\s*(.+)$/);
      if (match) {
        const [, name, filename, description] = match;

        // Infer type from filename prefix
        let type: MemoryIndexEntry['type'] = 'project';
        if (filename.startsWith('user_')) type = 'user';
        else if (filename.startsWith('feedback_')) type = 'feedback';
        else if (filename.startsWith('reference_')) type = 'reference';

        entries.push({
          name,
          filename,
          description: description.trim(),
          type
        });
      }
    }

    return entries;
  }

  /**
   * Serialize index entries to markdown
   */
  private serialize(entries: MemoryIndexEntry[]): string {
    return entries
      .map(entry => {
        const desc = this.truncateDescription(entry.description);
        return `- [${entry.name}](${entry.filename}) — ${desc}`;
      })
      .join('\n');
  }

  /**
   * Truncate description to max length
   */
  private truncateDescription(description: string): string {
    if (description.length <= this.maxEntryLength) {
      return description;
    }

    return description.substring(0, this.maxEntryLength - 3) + '...';
  }
}

// TODO: Add index statistics (count by type, total size, etc.)
// TODO: Add index validation (check all files exist)
// TODO: Add index diffing (what changed since last index)
// TODO: Support multiple indexes (by type, by tag, etc.)
// TODO: Add index compression (for large indexes)
// TODO: Support index pagination (if index gets too large)
// TODO: Add index caching (in-memory cache)
