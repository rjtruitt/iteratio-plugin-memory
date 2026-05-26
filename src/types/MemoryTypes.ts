/**
 * Memory Types
 *
 * Based on Claude Code's memory system.
 * Four memory types: user, feedback, project, reference
 */

/**
 * Memory type
 */
export type MemoryType = 'user' | 'feedback' | 'project' | 'reference';

/**
 * Memory frontmatter (YAML)
 */
export interface MemoryFrontmatter {
  name: string;
  description: string;
  type: MemoryType;
  originSessionId?: string;
  createdAt?: string;
  updatedAt?: string;
  ttl?: number;  // TTL in days (optional)
  tags?: string[];  // Optional tags for organization
  linkedMemories?: string[];  // [[name]] references
  trusted?: boolean;  // Whether content is trusted (false for user-provided)
}

/**
 * Memory record (frontmatter + content)
 */
export interface Memory {
  frontmatter: MemoryFrontmatter;
  content: string;
  filename: string;  // e.g., 'user_preferences.md'
  filepath: string;  // Full path
}

/**
 * Memory index entry (for MEMORY.md)
 */
export interface MemoryIndexEntry {
  name: string;
  filename: string;
  description: string;
  type: MemoryType;
}

/**
 * Memory search options
 */
export interface MemorySearchOptions {
  query?: string;  // Keyword search in description/content
  type?: MemoryType;  // Filter by type
  tags?: string[];  // Filter by tags
  limit?: number;  // Max results
}

/**
 * Memory plugin configuration
 */
export interface MemoryPluginConfig {
  directory: string;  // Memory directory path
  autoIndex?: boolean;  // Auto-update index on save
  autoCleanup?: boolean;  // Auto-delete expired memories (TTL)
  cleanupInterval?: number;  // Cleanup interval (ms)
}
