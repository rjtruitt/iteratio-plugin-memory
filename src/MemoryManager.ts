/**
 * Memory Manager
 *
 * Handles CRUD operations for memories.
 * Stores memories as markdown files with YAML frontmatter.
 *
 * Format (based on Claude Code):
 * ---
 * name: memory-name
 * description: Short description
 * type: user | feedback | project | reference
 * originSessionId: session-id
 * createdAt: 2026-05-15T12:00:00Z
 * updatedAt: 2026-05-15T13:00:00Z
 * ttl: 30
 * tags: [typescript, preferences]
 * ---
 *
 * Memory content here...
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { Memory, MemoryFrontmatter } from './types/MemoryTypes';

interface ILogger {
  debug(msg: string): void;
  info(msg: string): void;
  error(msg: string, error?: Error): void;
}

export class MemoryManager {
  private directory: string;

  /** Create a MemoryManager to manage memory files in the given directory. */
  constructor(
    directory: string,
    private logger?: ILogger
  ) {
    this.directory = directory;
  }

  /**
   * Initialize memory directory
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.directory, { recursive: true });
      this.logger?.info(`Memory directory initialized: ${this.directory}`);
    } catch (error) {
      this.logger?.error('Failed to initialize memory directory', error as Error);
      throw error;
    }
  }

  /**
   * Save memory to file
   */
  async save(memory: Memory): Promise<void> {
    const filepath = path.join(this.directory, memory.filename);

    // Update timestamps
    memory.frontmatter.updatedAt = new Date().toISOString();
    if (!memory.frontmatter.createdAt) {
      memory.frontmatter.createdAt = memory.frontmatter.updatedAt;
    }

    // Serialize to markdown with frontmatter
    const content = this.serialize(memory);

    // Write to file
    await fs.writeFile(filepath, content, 'utf8');

    this.logger?.debug(`Memory saved: ${memory.filename}`);
  }

  /**
   * Load memory from file
   */
  async load(filename: string): Promise<Memory | null> {
    const filepath = path.join(this.directory, filename);

    try {
      const content = await fs.readFile(filepath, 'utf8');
      return this.parse(content, filename);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return null;  // File not found
      }
      this.logger?.error(`Failed to load memory: ${filename}`, error);
      throw error;
    }
  }

  /**
   * Delete memory file
   */
  async delete(filename: string): Promise<void> {
    const filepath = path.join(this.directory, filename);

    try {
      await fs.unlink(filepath);
      this.logger?.debug(`Memory deleted: ${filename}`);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        this.logger?.error(`Failed to delete memory: ${filename}`, error);
        throw error;
      }
    }
  }

  /**
   * List all memory files
   */
  async list(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.directory);
      // Filter for .md files, exclude index
      return files.filter(f => f.endsWith('.md') && f !== 'MEMORY.md');
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Load all memories
   */
  async loadAll(): Promise<Memory[]> {
    const files = await this.list();
    const memories: Memory[] = [];

    for (const filename of files) {
      const memory = await this.load(filename);
      if (memory) {
        memories.push(memory);
      }
    }

    return memories;
  }

  /**
   * Serialize memory to markdown with frontmatter
   */
  private serialize(memory: Memory): string {
    const frontmatter = this.stringifyYaml(memory.frontmatter);
    return `---\n${frontmatter}---\n\n${memory.content}`;
  }

  /**
   * Parse markdown with frontmatter
   */
  private parse(content: string, filename: string): Memory {
    const match = content.match(/^---\n([\s\S]*?)\n---\n\n([\s\S]*)$/);

    if (!match) {
      throw new Error(`Invalid memory format: ${filename}`);
    }

    const [, frontmatterStr, bodyContent] = match;
    const frontmatter = this.parseYaml(frontmatterStr) as MemoryFrontmatter;

    return {
      frontmatter,
      content: bodyContent,
      filename,
      filepath: path.join(this.directory, filename)
    };
  }

  /**
   * Simple YAML serializer for frontmatter
   */
  private stringifyYaml(obj: Record<string, any>): string {
    const lines: string[] = [];
    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined || value === null) continue;
      if (Array.isArray(value)) {
        lines.push(`${key}: [${value.join(', ')}]`);
      } else if (typeof value === 'string' && value.includes(':')) {
        lines.push(`${key}: "${value}"`);
      } else {
        lines.push(`${key}: ${value}`);
      }
    }
    return lines.join('\n') + '\n';
  }

  /**
   * Simple YAML parser for frontmatter
   */
  private parseYaml(str: string): Record<string, any> {
    const result: Record<string, any> = {};
    const lines = str.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const colonIdx = trimmed.indexOf(':');
      if (colonIdx === -1) continue;
      const key = trimmed.substring(0, colonIdx).trim();
      let value: any = trimmed.substring(colonIdx + 1).trim();
      // Remove surrounding quotes
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      // Parse arrays [a, b, c]
      else if (value.startsWith('[') && value.endsWith(']')) {
        value = value.slice(1, -1).split(',').map((s: string) => s.trim()).filter((s: string) => s);
      }
      // Parse numbers
      else if (/^\d+$/.test(value)) {
        value = parseInt(value, 10);
      }
      // Parse booleans
      else if (value === 'true') value = true;
      else if (value === 'false') value = false;
      // Empty value
      else if (value === '') value = undefined;

      if (value !== undefined) {
        result[key] = value;
      }
    }
    return result;
  }

  /**
   * Clean up expired memories (TTL)
   */
  async cleanup(): Promise<number> {
    const memories = await this.loadAll();
    let deleted = 0;

    for (const memory of memories) {
      if (this.isExpired(memory)) {
        await this.delete(memory.filename);
        deleted++;
        this.logger?.info(`Deleted expired memory: ${memory.filename}`);
      }
    }

    return deleted;
  }

  /**
   * Check if memory is expired (based on TTL)
   */
  private isExpired(memory: Memory): boolean {
    const { ttl, updatedAt } = memory.frontmatter;

    if (!ttl || !updatedAt) {
      return false;
    }

    const updated = new Date(updatedAt);
    const now = new Date();
    const daysPassed = (now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24);

    return daysPassed > ttl;
  }

  /**
   * Deduplicate - check if content already exists
   */
  private deduplicate(content: string, existing: Memory[]): boolean {
    return existing.some(m => m.content === content);
  }

  /**
   * Extract linked memories from content
   * Finds [[memory-name]] references
   */
  extractLinks(content: string): string[] {
    const regex = /\[\[([^\]]+)\]\]/g;
    const links: string[] = [];
    let match;

    while ((match = regex.exec(content)) !== null) {
      links.push(match[1]);
    }

    return links;
  }
}

// TODO: Add memory versioning (keep history of changes)
// TODO: Add memory encryption (for sensitive data)
// TODO: Add memory compression (for large memories)
// TODO: Add memory locking (for concurrent access)
// TODO: Add memory backup/restore
// TODO: Add memory migration (upgrade frontmatter schema)
// TODO: Add memory validation (schema validation)
// TODO: Support different formats (JSON, TOML, etc.)
