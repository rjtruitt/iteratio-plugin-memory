import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MockTransport, MockEventBus } from 'iteratio/src/__test__';
import { SharedMemoryManager } from '../core/SharedMemoryManager';
import { MemoryBroadcaster } from '../core/MemoryBroadcaster';
import { ConflictResolver } from '../core/ConflictResolver';

/**
 * Memory Sharing Tests
 *
 * Tests for cross-agent memory sharing, isolation, discovery,
 * and conflict resolution.
 */

describe('MemorySharing', () => {
  let transport: MockTransport;
  let eventBus: MockEventBus;

  beforeEach(() => {
    transport = new MockTransport();
    eventBus = new MockEventBus();
  });

  describe('cross-agent memory (agent A stores, agent B retrieves)', () => {
    it('should allow agent B to read memory stored by agent A', async () => {
      const shared = new SharedMemoryManager({ transport, eventBus });
      await shared.store('agent-a', { key: 'discovery', content: 'Found a bug' });
      const result = await shared.retrieve('agent-b', 'discovery');
      expect(result).not.toBeNull();
      expect(result!.content).toBe('Found a bug');
    });

    it('should include source agent info in retrieved memory', async () => {
      const shared = new SharedMemoryManager({ transport, eventBus });
      await shared.store('agent-a', { key: 'info', content: 'Data' });
      const result = await shared.retrieve('agent-b', 'info');
      expect(result).not.toBeNull();
      expect(result!.storedBy).toBe('agent-a');
    });

    it('should support querying all shared memories', async () => {
      const shared = new SharedMemoryManager({ transport, eventBus });
      await shared.store('agent-a', { key: 'mem1', content: 'A data' });
      await shared.store('agent-b', { key: 'mem2', content: 'B data' });
      const all = await shared.getAll();
      expect(all).toHaveLength(2);
    });
  });

  describe('isolation mode (each agent memories private)', () => {
    it('should not expose private memories to other agents', async () => {
      const shared = new SharedMemoryManager({ transport, eventBus });
      await shared.storePrivate('agent-a', { key: 'secret', content: 'Private data' });
      const result = await shared.retrieve('agent-b', 'secret');
      expect(result).toBeNull();
    });

    it('should allow agent to access its own private memories', async () => {
      const shared = new SharedMemoryManager({ transport, eventBus });
      await shared.storePrivate('agent-a', { key: 'my-secret', content: 'My data' });
      const result = await shared.retrieve('agent-a', 'my-secret');
      expect(result).not.toBeNull();
      expect(result!.content).toBe('My data');
    });

    it('should support per-agent namespace isolation', async () => {
      const shared = new SharedMemoryManager({ transport, eventBus });
      await shared.store('agent-a', { key: 'config', content: 'A config' });
      await shared.store('agent-b', { key: 'config', content: 'B config' });
      // Both 'config' keys coexist in different namespaces
      const aConfig = await shared.retrieveFromNamespace('agent-a', 'config');
      const bConfig = await shared.retrieveFromNamespace('agent-b', 'config');
      expect(aConfig!.content).toBe('A config');
      expect(bConfig!.content).toBe('B config');
    });
  });

  describe('discovery broadcasting (new memory -> notify other agents)', () => {
    it('should broadcast new memory event to all agents', async () => {
      const broadcaster = new MemoryBroadcaster({ transport, eventBus });
      const listener = vi.fn();
      broadcaster.onNewMemory(listener);
      await broadcaster.store({ key: 'discovery', content: 'New finding', agent: 'agent-a' });
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({ key: 'discovery' }));
    });

    it('should include memory metadata in broadcast', async () => {
      const broadcaster = new MemoryBroadcaster({ transport, eventBus });
      const received: any[] = [];
      broadcaster.onNewMemory((mem) => received.push(mem));
      await broadcaster.store({ key: 'typed', content: 'Info', type: 'fact', agent: 'a' });
      expect(received[0].type).toBe('fact');
      expect(received[0].agent).toBe('a');
      expect(received[0].timestamp).toBeDefined();
    });

    it('should allow agents to subscribe to specific memory types', async () => {
      const broadcaster = new MemoryBroadcaster({ transport, eventBus });
      const factListener = vi.fn();
      broadcaster.onNewMemory(factListener, { type: 'fact' });
      await broadcaster.store({ key: 'fact1', content: 'A fact', type: 'fact', agent: 'a' });
      await broadcaster.store({ key: 'pref1', content: 'A pref', type: 'preference', agent: 'a' });
      expect(factListener).toHaveBeenCalledTimes(1);
    });
  });

  describe('source tracking (which agent stored this memory)', () => {
    it('should record source agent on storage', async () => {
      const shared = new SharedMemoryManager({ transport, eventBus });
      await shared.store('agent-a', { key: 'tracked', content: 'data' });
      const mem = await shared.retrieve('agent-b', 'tracked');
      expect(mem!.storedBy).toBe('agent-a');
    });

    it('should record timestamp of storage', async () => {
      const shared = new SharedMemoryManager({ transport, eventBus });
      const before = Date.now();
      await shared.store('agent-a', { key: 'timed', content: 'data' });
      const mem = await shared.retrieve('agent-a', 'timed');
      expect(mem!.storedAt).toBeGreaterThanOrEqual(before);
    });

    it('should track modification history', async () => {
      const shared = new SharedMemoryManager({ transport, eventBus });
      await shared.store('agent-a', { key: 'history', content: 'v1' });
      await shared.update('agent-b', 'history', { content: 'v2' });
      const mem = await shared.retrieve('agent-a', 'history');
      expect(mem!.history).toHaveLength(2);
      expect(mem!.history![0].agent).toBe('agent-a');
      expect(mem!.history![1].agent).toBe('agent-b');
    });
  });

  describe('deduplication across agents', () => {
    it('should detect duplicate content stored by different agents', async () => {
      const shared = new SharedMemoryManager({ transport, eventBus });
      await shared.store('agent-a', { key: 'dup-a', content: 'The sky is blue' });
      await shared.store('agent-b', { key: 'dup-b', content: 'The sky is blue' });
      const all = await shared.getAll();
      // Only one entry should exist (deduplicated)
      expect(all).toHaveLength(1);
    });

    it('should merge sources when deduplicating', async () => {
      const shared = new SharedMemoryManager({ transport, eventBus });
      await shared.store('agent-a', { key: 'shared-fact', content: 'TypeScript is typed' });
      await shared.store('agent-b', { key: 'same-fact', content: 'TypeScript is typed' });
      const mem = shared.getByContent('TypeScript is typed');
      expect(mem!.sources).toContain('agent-a');
      expect(mem!.sources).toContain('agent-b');
    });

    it('should not deduplicate similar but different content', async () => {
      const shared = new SharedMemoryManager({ transport, eventBus });
      await shared.store('agent-a', { key: 'fact-a', content: 'TypeScript is great' });
      await shared.store('agent-b', { key: 'fact-b', content: 'TypeScript is good' });
      const all = await shared.getAll();
      expect(all).toHaveLength(2);
    });
  });

  describe('memory conflict resolution', () => {
    it('should detect conflicting facts from different agents', async () => {
      const resolver = new ConflictResolver();
      const memA = { key: 'status', content: 'Service is UP', agent: 'agent-a', timestamp: 100 };
      const memB = { key: 'status', content: 'Service is DOWN', agent: 'agent-b', timestamp: 200 };
      const conflict = resolver.detect(memA, memB);
      expect(conflict.isConflict).toBe(true);
    });

    it('should resolve by latest-wins strategy', async () => {
      const resolver = new ConflictResolver({ strategy: 'latest-wins' });
      const result = resolver.resolve(
        { content: 'Old fact', timestamp: 100 },
        { content: 'New fact', timestamp: 200 }
      );
      expect(result.content).toBe('New fact');
    });

    it('should resolve by source-priority strategy', async () => {
      const resolver = new ConflictResolver({
        strategy: 'source-priority',
        priorities: { 'agent-a': 10, 'agent-b': 5 }
      });
      const result = resolver.resolve(
        { content: 'A says', agent: 'agent-a' },
        { content: 'B says', agent: 'agent-b' }
      );
      expect(result.content).toBe('A says');
    });

    it('should flag unresolvable conflicts for human review', async () => {
      const resolver = new ConflictResolver({ strategy: 'manual' });
      const result = resolver.resolve(
        { content: 'Fact A' },
        { content: 'Fact B' }
      );
      expect(result.status).toBe('needs-review');
    });

    it('should emit conflict event for monitoring', async () => {
      const resolver = new ConflictResolver({ eventBus });
      resolver.resolve(
        { content: 'Version 1' },
        { content: 'Version 2' }
      );
      expect(eventBus.emitted('memory.conflict')).toBe(true);
    });

    it('should keep both versions when merge strategy is used', async () => {
      const resolver = new ConflictResolver({ strategy: 'merge' });
      const result = resolver.resolve(
        { content: 'Agent A perspective' },
        { content: 'Agent B perspective' }
      );
      expect(result.versions).toHaveLength(2);
    });
  });
});
