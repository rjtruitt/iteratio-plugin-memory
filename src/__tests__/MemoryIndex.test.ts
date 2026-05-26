import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryIndex } from '../MemoryIndex';

// Mock fs for testing
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn().mockResolvedValue(''),
    writeFile: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('MemoryIndex', () => {
  let index: MemoryIndex;

  beforeEach(() => {
    vi.clearAllMocks();
    index = new MemoryIndex('/tmp/test-memory');
  });

  describe('index memory for search', () => {
    it('should add entry to index', async () => {
      const { promises: fs } = await import('fs');
      (fs.readFile as any).mockResolvedValueOnce('');

      await index.add({
        name: 'test-memory',
        filename: 'project_test-memory.md',
        description: 'A test memory for indexing',
        type: 'project',
      });

      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should update existing entry with same name', async () => {
      const { promises: fs } = await import('fs');
      const existingIndex = '- [test-memory](project_test-memory.md) — Old description';
      (fs.readFile as any).mockResolvedValue(existingIndex);

      await index.add({
        name: 'test-memory',
        filename: 'project_test-memory.md',
        description: 'New description',
        type: 'project',
      });

      const writeCall = (fs.writeFile as any).mock.calls[0];
      expect(writeCall[1]).toContain('New description');
      expect(writeCall[1]).not.toContain('Old description');
    });

    it('should sort entries by type then name', async () => {
      const { promises: fs } = await import('fs');
      (fs.readFile as any).mockResolvedValue('');

      await index.add({ name: 'z-project', filename: 'project_z.md', description: 'd', type: 'project' });

      // On subsequent add, entries should be sorted
      const existingIndex = '- [z-project](project_z.md) — d';
      (fs.readFile as any).mockResolvedValue(existingIndex);

      await index.add({ name: 'a-user', filename: 'user_a.md', description: 'd', type: 'user' });

      const writeCall = (fs.writeFile as any).mock.calls[1];
      const content = writeCall[1];
      const lines = content.split('\n');
      // project should come before user alphabetically
      expect(lines[0]).toContain('project');
    });
  });

  describe('keyword search finds matches', () => {
    it('should find entries matching name', async () => {
      const { promises: fs } = await import('fs');
      const indexContent = [
        '- [typescript-config](project_ts.md) — TypeScript project configuration',
        '- [python-setup](project_py.md) — Python environment setup',
      ].join('\n');
      (fs.readFile as any).mockResolvedValueOnce(indexContent);

      const results = await index.search('typescript');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toContain('typescript');
    });

    it('should find entries matching description', async () => {
      const { promises: fs } = await import('fs');
      const indexContent = '- [config](project_config.md) — Database connection settings';
      (fs.readFile as any).mockResolvedValueOnce(indexContent);

      const results = await index.search('database');
      expect(results).toHaveLength(1);
    });

    it('should be case-insensitive', async () => {
      const { promises: fs } = await import('fs');
      const indexContent = '- [React App](project_react.md) — React application setup';
      (fs.readFile as any).mockResolvedValueOnce(indexContent);

      const results = await index.search('REACT');
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('relevance scoring', () => {
    it('should rank name matches higher than description matches', async () => {
      // Expected: searching "typescript" should rank entry named "typescript-config"
      // higher than entry described as "includes typescript support"
      // Current implementation doesn't score - just filters. This will FAIL.
      const { promises: fs } = await import('fs');
      const indexContent = [
        '- [python-with-ts](project_py.md) — Python project with TypeScript bindings',
        '- [typescript-config](project_ts.md) — Configuration file',
      ].join('\n');
      (fs.readFile as any).mockResolvedValueOnce(indexContent);

      const results = await index.search('typescript');
      // Expected: typescript-config first due to name match
      expect(results[0].name).toBe('typescript-config');
    });

    it('should return higher score for exact match vs partial match', async () => {
      // Expected: ranked results with scoring
      // Not yet implemented - RED phase
      expect((index as any).searchWithScoring).toBeDefined();
    });
  });

  describe('no matches returns empty array', () => {
    it('should return empty array when nothing matches', async () => {
      const { promises: fs } = await import('fs');
      const indexContent = '- [unrelated](project_x.md) — Something else entirely';
      (fs.readFile as any).mockResolvedValueOnce(indexContent);

      const results = await index.search('xyznonexistent');
      expect(results).toHaveLength(0);
    });

    it('should return empty array for empty index', async () => {
      const { promises: fs } = await import('fs');
      (fs.readFile as any).mockRejectedValueOnce({ code: 'ENOENT' });

      const results = await index.search('anything');
      // Should handle missing index gracefully
      expect(results).toHaveLength(0);
    });
  });

  describe('re-index after update', () => {
    it('should rebuild index from all memory files', async () => {
      const { promises: fs } = await import('fs');
      const mockManager = {
        loadAll: vi.fn().mockResolvedValue([
          { frontmatter: { name: 'a', description: 'First', type: 'user' }, filename: 'user_a.md' },
          { frontmatter: { name: 'b', description: 'Second', type: 'project' }, filename: 'project_b.md' },
        ]),
      };

      await index.rebuild(mockManager);

      expect(fs.writeFile).toHaveBeenCalled();
      const writeCall = (fs.writeFile as any).mock.calls[0];
      expect(writeCall[1]).toContain('a');
      expect(writeCall[1]).toContain('b');
    });
  });

  describe('remove from index on delete', () => {
    it('should remove entry by name', async () => {
      const { promises: fs } = await import('fs');
      const indexContent = [
        '- [keep-me](project_keep.md) — Keep this',
        '- [remove-me](project_remove.md) — Remove this',
      ].join('\n');
      (fs.readFile as any).mockResolvedValueOnce(indexContent);

      await index.remove('remove-me');

      const writeCall = (fs.writeFile as any).mock.calls[0];
      expect(writeCall[1]).toContain('keep-me');
      expect(writeCall[1]).not.toContain('remove-me');
    });
  });

  describe('get content', () => {
    it('should return raw index content as string', async () => {
      const { promises: fs } = await import('fs');
      const content = '- [test](test.md) — description';
      (fs.readFile as any).mockResolvedValueOnce(content);

      const result = await index.getContent();
      expect(result).toBe(content);
    });

    it('should return empty string when index does not exist', async () => {
      const { promises: fs } = await import('fs');
      (fs.readFile as any).mockRejectedValueOnce({ code: 'ENOENT' });

      const result = await index.getContent();
      expect(result).toBe('');
    });
  });
});
