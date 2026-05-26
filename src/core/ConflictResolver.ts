/**
 * ConflictResolver
 *
 * Detects and resolves conflicts between memories from different agents.
 * Supports multiple resolution strategies.
 */

/** Strategy for resolving memory conflicts between agents. */
export type ConflictStrategy = 'latest-wins' | 'source-priority' | 'manual' | 'merge';

/** Configuration for the ConflictResolver, including strategy and priorities. */
export interface ConflictResolverConfig {
  strategy?: ConflictStrategy;
  priorities?: Record<string, number>;
  eventBus?: any;
}

/** A memory record involved in a conflict detection. */
export interface ConflictMemory {
  key?: string;
  content: string;
  agent?: string;
  timestamp?: number;
}

/** Result of a conflict detection check between two memories. */
export interface ConflictDetectionResult {
  isConflict: boolean;
}

/** Outcome of attempting to resolve a conflict between two memories. */
export interface ConflictResolutionResult {
  content?: string;
  status?: 'resolved' | 'needs-review';
  versions?: ConflictMemory[];
  winner?: string;
}

export class ConflictResolver {
  private config: ConflictResolverConfig;

  /** Create a ConflictResolver with the given configuration and resolution strategy. */
  constructor(config: ConflictResolverConfig = {}) {
    this.config = {
      strategy: 'latest-wins',
      ...config,
    };
  }

  /**
   * Detect if two memories conflict (same key, different content)
   */
  detect(memA: ConflictMemory, memB: ConflictMemory): ConflictDetectionResult {
    const sameKey = memA.key !== undefined && memA.key === memB.key;
    const differentContent = memA.content !== memB.content;

    return {
      isConflict: sameKey && differentContent,
    };
  }

  /**
   * Resolve a conflict between two memories using the configured strategy
   */
  resolve(memA: ConflictMemory, memB: ConflictMemory): ConflictResolutionResult {
    // Emit conflict event if eventBus is available
    if (this.config.eventBus) {
      this.config.eventBus.emit('memory.conflict', { memA, memB });
    }

    switch (this.config.strategy) {
      case 'latest-wins':
        return this.resolveByLatest(memA, memB);
      case 'source-priority':
        return this.resolveByPriority(memA, memB);
      case 'manual':
        return this.resolveManual(memA, memB);
      case 'merge':
        return this.resolveMerge(memA, memB);
      default:
        return this.resolveByLatest(memA, memB);
    }
  }

  private resolveByLatest(memA: ConflictMemory, memB: ConflictMemory): ConflictResolutionResult {
    const tsA = memA.timestamp ?? 0;
    const tsB = memB.timestamp ?? 0;
    const winner = tsB >= tsA ? memB : memA;
    return {
      content: winner.content,
      status: 'resolved',
      winner: winner.agent,
    };
  }

  private resolveByPriority(memA: ConflictMemory, memB: ConflictMemory): ConflictResolutionResult {
    const priorities = this.config.priorities || {};
    const priorityA = priorities[memA.agent || ''] ?? 0;
    const priorityB = priorities[memB.agent || ''] ?? 0;
    const winner = priorityA >= priorityB ? memA : memB;
    return {
      content: winner.content,
      status: 'resolved',
      winner: winner.agent,
    };
  }

  private resolveManual(_memA: ConflictMemory, _memB: ConflictMemory): ConflictResolutionResult {
    return {
      status: 'needs-review',
    };
  }

  private resolveMerge(memA: ConflictMemory, memB: ConflictMemory): ConflictResolutionResult {
    return {
      status: 'resolved',
      versions: [memA, memB],
    };
  }
}
