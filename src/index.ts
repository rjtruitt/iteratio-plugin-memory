/**
 * iteratio-plugin-memory
 * Memory integration plugin (uses prefrontal)
 *
 * TODO: Implement MemoryPlugin
 * TODO: Integrate with prefrontal library
 * TODO: Add auto-extraction from conversation
 * TODO: Add auto-injection into prompts
 * TODO: Add memory search/retrieval
 * TODO: Add memory types (fact, preference, decision, context)
 * TODO: Add memory filtering
 * TODO: Add memory expiration
 * TODO: Support SimpleMemory (keyword)
 * TODO: Support VectorMemory (semantic)
 */

import { IPlugin, PluginConfig, TurnContext } from 'iteratio';
import { Container } from 'inversify';

// TODO: CONSOLIDATE — MemoryPlugin, A2APlugin, and WorkflowPlugin all import { IPlugin, PluginConfig, TurnContext }
// from 'iteratio' and { Container } from 'inversify'. If an AbstractPlugin base class existed in iteratio core,
// these imports would be handled once in the base, and plugins would only import their own domain types.
// TODO: CLEANUP — MemoryPlugin.configure() accepts the generic PluginConfig type (Record<string, unknown>),
// while WorkflowPlugin.configure() accepts a strongly-typed WorkflowPluginConfig. All plugins should accept
// their own strongly-typed config for type safety. Define a MemoryPluginConfig interface like the other plugins.
// TODO: STREAMLINE — MemoryPlugin's beforeTurn (search + inject into system prompt) and afterTurn (extract + store)
// mirror the exact same hook pattern as WorkflowPlugin. Both could share a ContextInjectionMixin or hook utility
// that handles the "read from backend, inject into messages" and "extract from messages, write to backend" flows.
// TODO: SIMPLIFY — The plugin throws 'TODO: Implement initialize' at runtime. Consider using an abstract base
// that marks lifecycle methods as abstract (forcing implementation) rather than throwing at runtime, which shifts
// the error from runtime to compile-time.

/**
 * CONNECTION TO WORKER POOL:
 * TODO: When multiple workers share a memory backend, discoveries propagate:
 *   - Worker-1 documents "CHAMP Segmentation" and stores fact: "CHAMP uses 5 criteria"
 *   - Worker-2 is documenting "Territory Assignment" which references CHAMP
 *   - On Worker-2's next beforeTurn, memory search finds Worker-1's fact
 *   - Worker-2 gets injected context: "Related: CHAMP uses 5 criteria (from task-001)"
 * TODO: Add shared memory pool mode (all workers read/write same backend)
 * TODO: Add memory isolation mode (each worker has own namespace, no cross-pollination)
 * TODO: Add discovery broadcasting (on new memory stored, notify other workers via A2A channel)
 * TODO: Add memory deduplication (don't inject same fact twice)
 * TODO: Add source tracking (which worker/task produced this memory)
 *
 * MEMORY BACKENDS (from prefrontal library):
 * TODO: SimpleMemory — keyword-based (fast, good for exact matches)
 * TODO: VectorMemory — embedding-based (semantic similarity, better recall)
 * TODO: HybridMemory — keyword + vector combined
 * TODO: For worker pool: use shared Redis/PostgreSQL backend so workers share memories
 * TODO: For single agent: use in-memory or SQLite backend
 */
// TODO: ERROR-HANDLING — initialize() throws Error('TODO: Implement initialize') unconditionally. Any
// consumer that registers this plugin will crash on startup with no recourse. Either make initialize() a
// graceful no-op (log warning, set a 'stub' flag) or remove the export from package.json until implemented,
// so the plugin cannot be accidentally used in production.
// TODO: LIFECYCLE — MemoryPlugin has no 'initialized' flag or state tracking. If beforeTurn is called before
// initialize (which is possible if the loop starts before async init completes), there is no guard to prevent
// operations on an uninitialized backend. Add an initialized check at the top of every hook.
// TODO: CONCURRENCY — When used with WorkerPool (shared memory backend), multiple workers calling afterTurn
// concurrently will attempt to extract and store memories simultaneously. Without write coordination, duplicate
// memories or lost writes are possible. Document or enforce a locking strategy for the shared backend.
// TODO: OBSERVABILITY — No metrics or health check surface. Add getStatus() returning { initialized, backendType,
// memoryCount, lastQueryLatencyMs } so orchestrators can monitor whether the memory layer is functional.
// TODO: PLUGIN-COMPOSITION — If MemoryPlugin and WorkflowPlugin are both active, their beforeTurn hooks both
// inject content into the system message. Injection order depends on plugin registration order, which is
// undocumented. Add a priority field or document the expected registration order so the system prompt is
// deterministic (e.g., memories first, then TODOs, or vice versa).
export class MemoryPlugin implements IPlugin {
  readonly name = 'memory';
  readonly version = '0.1.0';

  async initialize(container: Container): Promise<void> {
    // TODO: Register memory backend (from prefrontal)
    // TODO: Register memory extractor
    // TODO: Register memory injector
    throw new Error('TODO: Implement initialize');
  }

  configure(config: PluginConfig): void {
    // TODO: Configure memory
    // - Backend (SimpleMemory or VectorMemory from prefrontal)
    // - Auto-extract enabled
    // - Auto-inject enabled
    // - Max memories per turn
    // - Relevance threshold
  }

  async beforeTurn(context: TurnContext): Promise<void> {
    // TODO: Search relevant memories
    // TODO: Inject into system prompt
  }

  async afterTurn(context: TurnContext): Promise<void> {
    // TODO: Extract memories from user message
    // TODO: Extract memories from assistant response
    // TODO: Store in prefrontal backend
  }

  async shutdown(): Promise<void> {
    // TODO: Persist memories
  }
}

// TODO: CONSOLIDATE — The shutdown pattern across all plugins is: cleanup internal state, disconnect transports,
// clear registries. An AbstractPlugin.shutdown() could call overridable hooks (onCleanup, onDisconnect) and
// handle common teardown (logging, clearing container bindings) automatically.

// TODO: Export memory interfaces
// TODO: Export memory extractor
// TODO: Export memory injector
