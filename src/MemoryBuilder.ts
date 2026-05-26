/**
 * Memory Builder
 *
 * Fluent API for creating memories.
 *
 * Example:
 * await memory.memory()
 *   .name('user-preferences')
 *   .type('user')
 *   .description('User prefers TypeScript')
 *   .content('User is a senior TypeScript developer...')
 *   .tags(['typescript', 'preferences'])
 *   .ttl(90)
 *   .save();
 */

import { Memory, MemoryFrontmatter, MemoryType } from './types/MemoryTypes';
import { MemoryManager } from './MemoryManager';

export class MemoryBuilder {
  private frontmatter: Partial<MemoryFrontmatter> = {};
  private _content: string = '';
  private _filename?: string;
  private manager?: MemoryManager;

  /** Create a MemoryBuilder, optionally bound to a MemoryManager for saving. */
  constructor(manager?: MemoryManager) {
    this.manager = manager;
  }

  /**
   * Set memory name
   */
  withName(name: string): this {
    this.frontmatter.name = name;
    return this;
  }

  /**
   * Set memory name (alias)
   */
  name(name: string): this {
    return this.withName(name);
  }

  /**
   * Set memory type
   */
  ofType(type: MemoryType): this {
    this.frontmatter.type = type;
    return this;
  }

  /**
   * Set memory type (alias)
   */
  type(type: MemoryType): this {
    return this.ofType(type);
  }

  /**
   * Set as user memory
   */
  user(): this {
    return this.type('user');
  }

  /**
   * Set as feedback memory
   */
  feedback(): this {
    return this.type('feedback');
  }

  /**
   * Set as project memory
   */
  project(): this {
    return this.type('project');
  }

  /**
   * Set as reference memory
   */
  reference(): this {
    return this.type('reference');
  }

  /**
   * Set description
   */
  withDescription(description: string): this {
    this.frontmatter.description = description;
    return this;
  }

  /**
   * Set description (alias)
   */
  description(description: string): this {
    return this.withDescription(description);
  }

  /**
   * Set content
   */
  withContent(content: string): this {
    this._content = content;
    return this;
  }

  /**
   * Set content (alias)
   */
  content(content: string): this {
    return this.withContent(content);
  }

  /**
   * Set backend type
   */
  backend(type: string): this {
    // Stub for backend selection
    return this;
  }

  /**
   * Set search strategy
   */
  searchStrategy(strategy: string): this {
    // Stub for search strategy selection
    return this;
  }

  /**
   * Set max memories limit
   */
  maxMemories(limit: number): this {
    // Stub for max memories
    return this;
  }

  /**
   * Set origin session ID
   */
  originSession(sessionId: string): this {
    this.frontmatter.originSessionId = sessionId;
    return this;
  }

  /**
   * Set TTL (days)
   */
  ttl(days: number): this {
    this.frontmatter.ttl = days;
    return this;
  }

  /**
   * Set tags
   */
  withTags(tags: string[]): this {
    this.frontmatter.tags = tags;
    return this;
  }

  /**
   * Set tags (alias)
   */
  tags(tags: string[]): this {
    return this.withTags(tags);
  }

  /**
   * Add single tag
   */
  tag(tag: string): this {
    if (!this.frontmatter.tags) {
      this.frontmatter.tags = [];
    }
    this.frontmatter.tags.push(tag);
    return this;
  }

  /**
   * Set linked memories
   */
  linkedMemories(names: string[]): this {
    this.frontmatter.linkedMemories = names;
    return this;
  }

  /**
   * Add single linked memory
   */
  linkTo(name: string): this {
    if (!this.frontmatter.linkedMemories) {
      this.frontmatter.linkedMemories = [];
    }
    this.frontmatter.linkedMemories.push(name);
    return this;
  }

  /**
   * Set custom filename
   */
  filename(filename: string): this {
    this._filename = filename;
    return this;
  }

  /**
   * Internal: Set manager context
   */
  _setManager(manager: MemoryManager): this {
    this.manager = manager;
    return this;
  }

  /**
   * Maximum allowed key (name) length in bytes
   */
  private static readonly MAX_KEY_LENGTH = 1024;

  /**
   * Maximum allowed content size in bytes
   */
  private static readonly MAX_CONTENT_SIZE = 100 * 1024; // 100KB

  /**
   * Build memory (without saving)
   */
  build(): Memory {
    // Validate required fields
    if (!this.frontmatter.name) {
      throw new Error('Memory name is required');
    }
    if (!this.frontmatter.type) {
      throw new Error('Memory type is required');
    }
    if (!this.frontmatter.description) {
      throw new Error('Memory description is required');
    }

    // Validate key length
    if (this.frontmatter.name.length > MemoryBuilder.MAX_KEY_LENGTH) {
      throw new Error(`Memory key exceeds maximum length of ${MemoryBuilder.MAX_KEY_LENGTH} characters`);
    }

    // Sanitize name - replace dangerous characters and prevent prototype pollution
    const dangerousNames = ['__proto__', 'constructor', 'prototype'];
    let sanitizedName = this.frontmatter.name;
    if (dangerousNames.includes(sanitizedName)) {
      sanitizedName = `_safe_${sanitizedName}`;
    }
    // Sanitize special characters in name for filesystem safety
    sanitizedName = sanitizedName.replace(/[<>&"'\\\/]/g, '_');
    this.frontmatter.name = sanitizedName;

    // Coerce content to string to neutralize getter traps and object tricks
    let finalContent: string;
    if (this._content === null || this._content === undefined) {
      finalContent = '';
    } else if (typeof this._content === 'string') {
      finalContent = this._content;
    } else {
      // Safely serialize non-string content, stripping dangerous patterns
      try {
        finalContent = JSON.stringify(this._content);
      } catch {
        finalContent = String(this._content);
      }
    }

    // Validate content size
    if (finalContent.length > MemoryBuilder.MAX_CONTENT_SIZE) {
      throw new Error(`Memory content exceeds maximum size of ${MemoryBuilder.MAX_CONTENT_SIZE} bytes`);
    }

    // Sanitize content - remove dangerous serialization patterns
    finalContent = finalContent.replace(/process\.exit\([^)]*\)/g, '[BLOCKED]');
    finalContent = finalContent.replace(/require\s*\(\s*["']child_process["']\s*\)/g, '[BLOCKED]');
    finalContent = finalContent.replace(/execSync\s*\(/g, '[BLOCKED](');

    // Mark all memory as untrusted (user-provided content)
    this.frontmatter.trusted = false;

    // Generate filename if not provided
    const filename = this._filename || this.generateFilename();

    return {
      frontmatter: this.frontmatter as MemoryFrontmatter,
      content: finalContent,
      filename,
      filepath: ''  // Will be set by manager
    };
  }

  /**
   * Build and save memory
   */
  async save(): Promise<Memory> {
    if (!this.manager) {
      throw new Error('Cannot save memory without manager context. Use plugin.memory() instead of new MemoryBuilder()');
    }

    const memory = this.build();
    await this.manager.save(memory);
    return memory;
  }

  /**
   * Generate filename from name and type
   * Format: {type}_{slug}.md
   */
  private generateFilename(): string {
    const type = this.frontmatter.type || 'project';
    const name = this.frontmatter.name || 'unnamed';
    const slug = name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');

    return `${type}_${slug}.md`;
  }
}

// TODO: Add validation helpers (requireName(), requireType())
// TODO: Add memory templates (fromTemplate())
// TODO: Add memory cloning (clone existing memory)
// TODO: Add memory importing (from JSON/YAML)
// TODO: Add memory exporting (to JSON/YAML)
