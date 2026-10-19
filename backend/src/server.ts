import { loadConfig } from './config';
import { createApp } from './api/app';
import { MemoryStore } from './storage/memory';
import { PgStore } from './storage/pg';
import { GeminiProvider } from './agent/gemini';
import type { ModelProvider } from './agent/provider';

async function main() {
  const config = loadConfig();
  const store = config.databaseUrl ? new PgStore(config.databaseUrl) : new MemoryStore();
  if (!config.databaseUrl) console.warn('DATABASE_URL not set: using NON-DURABLE in-memory storage (development only).');
  await store.init();

  let provider: ModelProvider | null = null;
  if (config.modelProvider === 'gemini' && config.geminiApiKey && config.modelId) {
    provider = new GeminiProvider(config.geminiApiKey, config.modelId);
  } else if (config.liveAiEnabled) {
    console.warn('LIVE_AI_ENABLED=true but provider key or MODEL_ID is missing: live model calls stay disabled.');
  }

  const app = createApp({ config, store, provider });
  const server = app.listen(config.port, '0.0.0.0', () => {
    console.log(
      `FarmLink API listening on ${config.port} (env=${config.appEnv}, storage=${store.kind}, liveAI=${config.liveAiEnabled && !!provider}, origins=${config.allowedOrigins.join(' ') || 'none'})`,
    );
  });
  server.requestTimeout = 120_000;
  const shutdown = () => {
    server.close(() => void store.close().finally(() => process.exit(0)));
    setTimeout(() => process.exit(0), 10_000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((e) => {
  console.error('Fatal startup error:', e instanceof Error ? e.message : e);
  process.exit(1);
});
