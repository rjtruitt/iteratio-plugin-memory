import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryBuilder } from '../MemoryBuilder';

describe('MemoryBuilder', () => {
  let builder: MemoryBuilder;

  beforeEach(() => {
    builder = new MemoryBuilder();
  });

  describe('fluent construction', () => {
    it('should return this from each method for chaining', () => {
      const result = builder
        .name('test')
        .type('user')
        .description('desc')
        .content('body');
      expect(result).toBe(builder);
    });

    it('should build complete memory with all properties', () => {
      const memory = builder
        .name('user-prefs')
        .type('user')
        .description('User preferences')
        .content('Prefers TypeScript')
        .tags(['typescript', 'preferences'])
        .ttl(90)
        .build();

      expect(memory.frontmatter.name).toBe('user-prefs');
      expect(memory.frontmatter.type).toBe('user');
      expect(memory.frontmatter.description).toBe('User preferences');
      expect(memory.content).toBe('Prefers TypeScript');
      expect(memory.frontmatter.tags).toEqual(['typescript', 'preferences']);
      expect(memory.frontmatter.ttl).toBe(90);
    });
  });

  describe('select backend (in-memory, IndexedDB, Redis)', () => {
    it('should support in-memory backend selection', () => {
      // Expected: builder.backend('in-memory') sets the storage backend
      // This is not yet implemented on MemoryBuilder - RED phase
      expect((builder as any).backend).toBeDefined();
    });

    it('should support IndexedDB backend selection', () => {
      expect((builder as any).backend).toBeDefined();
    });

    it('should support Redis backend selection', () => {
      expect((builder as any).backend).toBeDefined();
    });
  });

  describe('configure search strategy', () => {
    it('should support keyword search strategy', () => {
      // Expected: builder.searchStrategy('keyword')
      expect((builder as any).searchStrategy).toBeDefined();
    });

    it('should support vector search strategy', () => {
      expect((builder as any).searchStrategy).toBeDefined();
    });

    it('should support hybrid search strategy', () => {
      expect((builder as any).searchStrategy).toBeDefined();
    });
  });

  describe('set max memories', () => {
    it('should accept max memories limit', () => {
      // Expected: builder.maxMemories(1000)
      expect((builder as any).maxMemories).toBeDefined();
    });
  });

  describe('build returns configured MemoryManager', () => {
    it('should throw when name is missing', () => {
      builder.type('user').description('d').content('c');
      expect(() => builder.build()).toThrow(/name/i);
    });

    it('should throw when type is missing', () => {
      builder.name('test').description('d').content('c');
      expect(() => builder.build()).toThrow(/type/i);
    });

    it('should throw when description is missing', () => {
      builder.name('test').type('user').content('c');
      expect(() => builder.build()).toThrow(/description/i);
    });

    it('should generate filename from name and type', () => {
      const memory = builder
        .name('My Preferences')
        .type('user')
        .description('prefs')
        .build();
      expect(memory.filename).toMatch(/^user_.*\.md$/);
    });

    it('should use custom filename when specified', () => {
      const memory = builder
        .name('Custom')
        .type('project')
        .description('d')
        .filename('custom_name.md')
        .build();
      expect(memory.filename).toBe('custom_name.md');
    });

    it('should throw on save without manager context', async () => {
      builder.name('orphan').type('user').description('d').content('c');
      await expect(builder.save()).rejects.toThrow(/manager/i);
    });
  });

  describe('type shortcuts', () => {
    it('should support .user() shortcut', () => {
      const memory = builder.name('x').user().description('d').build();
      expect(memory.frontmatter.type).toBe('user');
    });

    it('should support .feedback() shortcut', () => {
      const memory = builder.name('x').feedback().description('d').build();
      expect(memory.frontmatter.type).toBe('feedback');
    });

    it('should support .project() shortcut', () => {
      const memory = builder.name('x').project().description('d').build();
      expect(memory.frontmatter.type).toBe('project');
    });

    it('should support .reference() shortcut', () => {
      const memory = builder.name('x').reference().description('d').build();
      expect(memory.frontmatter.type).toBe('reference');
    });
  });

  describe('linked memories', () => {
    it('should set linked memories', () => {
      const memory = builder
        .name('linked')
        .type('project')
        .description('d')
        .linkedMemories(['other-memory', 'another-one'])
        .build();
      expect(memory.frontmatter.linkedMemories).toEqual(['other-memory', 'another-one']);
    });

    it('should support linkTo for single link', () => {
      const memory = builder
        .name('linked')
        .type('project')
        .description('d')
        .linkTo('target-memory')
        .build();
      expect(memory.frontmatter.linkedMemories).toContain('target-memory');
    });
  });
});
