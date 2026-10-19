export interface AppConfig {
  appEnv: string;
  port: number;
  allowedOrigins: string[];
  databaseUrl: string | null;
  liveAiEnabled: boolean;
  modelProvider: string;
  modelId: string | null;
  geminiApiKey: string | null;
  buildSha: string;
  sessionTtlMs: number;
  sessionsPerHourGlobal: number;
  agentRunsPerSessionPerHour: number;
  providerCallsPerDayGlobal: number;
  maxRoundTrips: number;
  maxToolCalls: number;
  providerTimeoutMs: number;
}

function int(v: string | undefined, def: number, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  const n = v === undefined || v === '' ? def : Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw new Error(`Invalid integer config value: ${v}`);
  return n;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const origins = (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const o of origins) {
    const u = new URL(o);
    if (u.origin !== o) throw new Error(`ALLOWED_ORIGINS entries must be exact origins without paths: ${o}`);
  }
  return {
    appEnv: env.APP_ENV ?? 'development',
    port: int(env.PORT, 8080, 1, 65535),
    allowedOrigins: origins,
    databaseUrl: env.DATABASE_URL?.trim() || null,
    liveAiEnabled: env.LIVE_AI_ENABLED === 'true',
    modelProvider: env.MODEL_PROVIDER?.trim() || 'gemini',
    modelId: env.MODEL_ID?.trim() || null,
    geminiApiKey: env.GEMINI_API_KEY?.trim() || null,
    buildSha: (env.RENDER_GIT_COMMIT || env.BUILD_SHA || 'local').slice(0, 40),
    sessionTtlMs: int(env.SESSION_TTL_MINUTES, 120, 5, 24 * 60) * 60_000,
    sessionsPerHourGlobal: int(env.SESSIONS_PER_HOUR_GLOBAL, 200, 1),
    agentRunsPerSessionPerHour: int(env.AGENT_RUNS_PER_SESSION_PER_HOUR, 10, 0),
    providerCallsPerDayGlobal: int(env.PROVIDER_CALLS_PER_DAY_GLOBAL, 300, 0),
    maxRoundTrips: int(env.MAX_ROUND_TRIPS, 3, 1, 6),
    maxToolCalls: int(env.MAX_TOOL_CALLS, 6, 1, 12),
    providerTimeoutMs: int(env.PROVIDER_TIMEOUT_MS, 25_000, 1000, 120_000),
  };
}
