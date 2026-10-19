import type { Store } from '../storage/Store';

export function hourWindow(now: Date): Date {
  const d = new Date(now);
  d.setUTCMinutes(0, 0, 0);
  return d;
}

export function dayWindow(now: Date): Date {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Server-enforced counters reserved atomically before work that may cost money. */
export class Quotas {
  constructor(
    private readonly store: Store,
    private readonly limits: { sessionsPerHourGlobal: number; agentRunsPerSessionPerHour: number; providerCallsPerDayGlobal: number },
  ) {}

  reserveSessionIssue(now: Date) {
    const w = hourWindow(now);
    return this.store.reserveQuota(`sessions:${w.toISOString()}`, w, this.limits.sessionsPerHourGlobal);
  }

  reserveAgentRun(sessionId: string, now: Date) {
    const w = hourWindow(now);
    return this.store.reserveQuota(`runs:${sessionId}`, w, this.limits.agentRunsPerSessionPerHour);
  }

  /** Not refunded on ambiguous provider failures that might have been billed. */
  reserveProviderCall(now: Date) {
    const w = dayWindow(now);
    return this.store.reserveQuota('provider:global', w, this.limits.providerCallsPerDayGlobal);
  }
}
