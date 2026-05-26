import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryManager } from '../MemoryManager';
import { Memory, MemoryFrontmatter } from '../types/MemoryTypes';

// Mock fs for testing without actual file system
vi.mock('fs', () => ({
  promises: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue(''),
    unlink: vi.fn().mockResolvedValue(undefined),
    readdir: vi.fn().mockResolvedValue([]),
  },
}));

describe('MemoryManager', () => {
  let manager: MemoryManager;

  function createMemory(overrides: Partial<Memory> = {}): Memory {
    return {
      frontmatter: {
        name: 'test-memory',
        description: 'A test memory',
        type: 'project',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        tags: ['test'],
        ...overrides.frontmatter,
      } as MemoryFrontmatter,
      content: 'Test content here',
      filename: 'project_test-memory.md',
      filepath: '/tmp/memory/project_test-memory.md',
      ...overrides,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new MemoryManager('/tmp/test-memory');
  });

  describe('store memory with type and content', () => {
    it('should save memory to file', async () => {
      const { promises: fs } = await import('fs');
      const memory = createMemory();
      await manager.save(memory);
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should serialize with frontmatter and content', async () => {
      const { promises: fs } = await import('fs');
      const memory = createMemory({ content: 'Important fact' });
      await manager.save(memory);

      const writeCall = (fs.writeFile as any).mock.calls[0];
      const content = writeCall[1];
      expect(content).toContain('---');
      expect(content).toContain('Important fact');
    });

    it('should update timestamps on save', async () => {
      const memory = createMemory();
      memory.frontmatter.updatedAt = undefined;
      await manager.save(memory);
      expect(memory.frontmatter.updatedAt).toBeDefined();
    });

    it('should set createdAt if not already set', async () => {
      const memory = createMemory();
      memory.frontmatter.createdAt = undefined;
      await manager.save(memory);
      expect(memory.frontmatter.createdAt).toBeDefined();
    });
  });

  describe('retrieve by ID (filename)', () => {
    it('should load memory from file', async () => {
      const { promises: fs } = await import('fs');
      const mockContent = '---\nname: loaded\ndescription: test\ntype: project\n---\n\nLoaded content';
      (fs.readFile as any).mockResolvedValueOnce(mockContent);

      const memory = await manager.load('project_loaded.md');
      expect(memory).toBeDefined();
      expect(memory?.frontmatter.name).toBe('loaded');
      expect(memory?.content).toBe('Loaded content');
    });

    it('should return null for non-existent file', async () => {
      const { promises: fs } = await import('fs');
      (fs.readFile as any).mockRejectedValueOnce({ code: 'ENOENT' });

      const result = await manager.load('nonexistent.md');
      expect(result).toBeNull();
    });

    it('should throw for non-ENOENT errors', async () => {
      const { promises: fs } = await import('fs');
      (fs.readFile as any).mockRejectedValueOnce(new Error('Permission denied'));

      await expect(manager.load('forbidden.md')).rejects.toThrow();
    });
  });

  describe('search by keyword', () => {
    it('should list all memory files', async () => {
      const { promises: fs } = await import('fs');
      (fs.readdir as any).mockResolvedValueOnce([
        'project_a.md',
        'user_b.md',
        'MEMORY.md',
        'other.txt',
      ]);

      const files = await manager.list();
      expect(files).toContain('project_a.md');
      expect(files).toContain('user_b.md');
      expect(files).not.toContain('MEMORY.md');
      expect(files).not.toContain('other.txt');
    });
  });

  describe('search by type', () => {
    it('should load all memories for filtering by type', async () => {
      const { promises: fs } = await import('fs');
      (fs.readdir as any).mockResolvedValueOnce(['user_prefs.md', 'project_info.md']);
      (fs.readFile as any)
        .mockResolvedValueOnce('---\nname: prefs\ndescription: d\ntype: user\n---\n\nContent')
        .mockResolvedValueOnce('---\nname: info\ndescription: d\ntype: project\n---\n\nContent');

      const all = await manager.loadAll();
      const userMemories = all.filter(m => m.frontmatter.type === 'user');
      expect(userMemories).toHaveLength(1);
      expect(userMemories[0].frontmatter.name).toBe('prefs');
    });
  });

  describe('delete memory', () => {
    it('should delete file from disk', async () => {
      const { promises: fs } = await import('fs');
      await manager.delete('deleteme.md');
      expect(fs.unlink).toHaveBeenCalled();
    });

    it('should not throw when deleting non-existent file', async () => {
      const { promises: fs } = await import('fs');
      (fs.unlink as any).mockRejectedValueOnce({ code: 'ENOENT' });
      await expect(manager.delete('ghost.md')).resolves.not.toThrow();
    });
  });

  describe('update existing memory', () => {
    it('should overwrite file with updated content', async () => {
      const { promises: fs } = await import('fs');
      const memory = createMemory({ content: 'Updated content' });
      await manager.save(memory);
      expect(fs.writeFile).toHaveBeenCalled();
    });
  });

  describe('memory expiration (TTL)', () => {
    it('should identify expired memories', async () => {
      const { promises: fs } = await import('fs');
      // Memory with TTL of 1 day, updated 10 days ago
      const expiredContent = '---\nname: old\ndescription: d\ntype: project\nttl: 1\nupdatedAt: "2020-01-01T00:00:00Z"\n---\n\nOld content';
      (fs.readdir as any).mockResolvedValueOnce(['old.md']);
      (fs.readFile as any).mockResolvedValueOnce(expiredContent);
      (fs.unlink as any).mockResolvedValue(undefined);

      const deleted = await manager.cleanup();
      expect(deleted).toBe(1);
    });

    it('should not delete memories without TTL', async () => {
      const { promises: fs } = await import('fs');
      const noTTLContent = '---\nname: forever\ndescription: d\ntype: project\n---\n\nForever content';
      (fs.readdir as any).mockResolvedValueOnce(['forever.md']);
      (fs.readFile as any).mockResolvedValueOnce(noTTLContent);

      const deleted = await manager.cleanup();
      expect(deleted).toBe(0);
    });
  });

  describe('deduplication', () => {
    it('should detect duplicate content and prevent double storage', async () => {
      // Expected: manager.save with same content twice should deduplicate
      // This is NOT implemented yet - RED phase
      expect((manager as any).deduplicate).toBeDefined();
    });

    it('should allow same name with different content (update)', async () => {
      // Saving with same filename overwrites
      const { promises: fs } = await import('fs');
      const mem1 = createMemory({ content: 'Version 1' });
      const mem2 = createMemory({ content: 'Version 2' });
      await manager.save(mem1);
      await manager.save(mem2);
      expect(fs.writeFile).toHaveBeenCalledTimes(2);
    });
  });

  describe('memory count', () => {
    it('should count all memory files', async () => {
      const { promises: fs } = await import('fs');
      (fs.readdir as any).mockResolvedValueOnce(['a.md', 'b.md', 'c.md']);
      const files = await manager.list();
      expect(files).toHaveLength(3);
    });
  });

  describe('bulk operations', () => {
    it('should load all memories at once', async () => {
      const { promises: fs } = await import('fs');
      (fs.readdir as any).mockResolvedValueOnce(['a.md', 'b.md']);
      (fs.readFile as any)
        .mockResolvedValueOnce('---\nname: a\ndescription: d\ntype: project\n---\n\nA')
        .mockResolvedValueOnce('---\nname: b\ndescription: d\ntype: user\n---\n\nB');

      const all = await manager.loadAll();
      expect(all).toHaveLength(2);
    });

    it('should support bulk delete (cleanup)', async () => {
      const { promises: fs } = await import('fs');
      const expired = '---\nname: exp\ndescription: d\ntype: project\nttl: 1\nupdatedAt: "2020-01-01T00:00:00Z"\n---\n\nX';
      (fs.readdir as any).mockResolvedValueOnce(['exp1.md', 'exp2.md']);
      (fs.readFile as any)
        .mockResolvedValueOnce(expired)
        .mockResolvedValueOnce(expired);
      (fs.unlink as any).mockResolvedValue(undefined);

      const deleted = await manager.cleanup();
      expect(deleted).toBe(2);
    });
  });

  describe('extract links', () => {
    it('should extract [[linked-memory]] references from content', () => {
      const content = 'See [[user-preferences]] and [[project-setup]] for details.';
      const links = manager.extractLinks(content);
      expect(links).toContain('user-preferences');
      expect(links).toContain('project-setup');
    });

    it('should return empty array when no links', () => {
      const links = manager.extractLinks('No links here.');
      expect(links).toHaveLength(0);
    });
  });

  describe('initialize', () => {
    it('should create memory directory', async () => {
      const { promises: fs } = await import('fs');
      await manager.initialize();
      expect(fs.mkdir).toHaveBeenCalledWith('/tmp/test-memory', { recursive: true });
    });
  });
});
