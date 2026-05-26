# iteratio-plugin-memory

Long-term memory plugin for iteratio.

## Install

```
npm install iteratio-plugin-memory
```

## What It Does

Persists facts across agent sessions using a file-based memory system. Memories are stored as markdown files with frontmatter metadata and indexed for fast lookup. No vector database required. Supports memory types (user, feedback, project, reference), keyword search, TTL, and export/import.

## Usage

```typescript
import { AgentLoop } from 'iteratio';
import { MemoryPlugin } from 'iteratio-plugin-memory';

const memoryPlugin = MemoryPlugin.builder()
  .directory('./memory')
  .autoIndex()
  .build();

const loop = AgentLoop.builder()
  .withLLM(llm)
  .withPlugin(memoryPlugin)
  .build();

await memoryPlugin.memory()
  .name('user-preferences')
  .type('user')
  .description('User prefers TypeScript')
  .content('Senior TypeScript developer...')
  .save();

const results = await memoryPlugin.search('TypeScript');
```

## License

MIT
