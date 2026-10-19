import { randomId, type AgentRun, type PendingAction, type ToolEvent } from '@farmlink/engine';
import type { AppConfig } from '../config';
import type { Quotas } from '../security/quota';
import { ApiError, toApiError } from '../security/errors';
import type { SandboxService } from '../services/sandbox';
import { ProviderError, type ChatTurn, type ModelProvider, type ToolResultMessage } from './provider';
import { getTool, isAllowlisted, TOOL_SPECS } from './tools';
import { SYSTEM_PROMPT } from './systemPrompt';

export interface AgentTurnResult {
  run: AgentRun;
  toolEvents: ToolEvent[];
  pendingAction: PendingAction | null;
}

/**
 * Bounded model/tool loop. The model proposes; server code validates every tool name and
 * argument against the allowlist, executes with session-scoped authorization, and stops as
 * soon as a pending action needs human confirmation.
 */
export async function runAgentTurn(deps: {
  sessionId: string;
  message: string;
  history: ChatTurn[];
  provider: ModelProvider | null;
  svc: SandboxService;
  quotas: Quotas;
  config: Pick<AppConfig, 'liveAiEnabled' | 'maxRoundTrips' | 'maxToolCalls' | 'providerTimeoutMs'>;
  now: () => Date;
}): Promise<AgentTurnResult> {
  const { sessionId, provider, svc, quotas, config, now } = deps;
  if (!config.liveAiEnabled || !provider) {
    throw new ApiError(503, 'PROVIDER_UNAVAILABLE', 'Live model calls are disabled on this server. Use the guided sandbox.', false);
  }
  if (!(await quotas.reserveAgentRun(sessionId, now()))) {
    throw new ApiError(429, 'QUOTA_EXHAUSTED', 'This session reached its hourly limit of AI requests. Guided tools still work.', false);
  }

  const run: AgentRun = {
    id: randomId('run'),
    mode: 'live_cloud',
    startedAt: now().toISOString(),
    finishedAt: null,
    status: 'running',
    provider: provider.name,
    modelId: provider.modelId,
    userMessage: deps.message.slice(0, 500),
    reply: '',
    roundTrips: 0,
    toolCalls: 0,
    pendingActionId: null,
    error: null,
  };
  await svc.saveRun(sessionId, run);
  const ctx = { sessionId, actor: 'model' as const, runId: run.id };
  const conversation = provider.start({ system: SYSTEM_PROMPT, history: deps.history, message: deps.message, tools: TOOL_SPECS });

  let pending: PendingAction | null = null;
  let results: ToolResultMessage[] | null = null;
  try {
    while (true) {
      if (run.roundTrips >= config.maxRoundTrips) {
        run.status = 'limit_reached';
        run.reply = `[System] Stopped after ${config.maxRoundTrips} model round trips. Completed tool results are recorded in the timeline; ask a narrower question to continue.`;
        break;
      }
      if (!(await quotas.reserveProviderCall(now()))) {
        run.status = 'limit_reached';
        run.reply = '[System] The global daily AI budget for this demo is used up. No further model request was sent. Guided tools still work.';
        break;
      }
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), config.providerTimeoutMs);
      let turn;
      try {
        turn = await conversation.next(results, controller.signal);
      } finally {
        clearTimeout(timer);
      }
      run.roundTrips += 1;
      if (!turn.calls.length) {
        run.status = 'completed';
        run.reply = turn.text || '[System] The model returned no text.';
        break;
      }
      results = [];
      for (const call of turn.calls) {
        if (pending) {
          // A pending action already exists: nothing more runs in this turn.
          await svc.logStandalone(ctx, call.name, call.args, 'rejected', 'Not executed: a pending action is awaiting human confirmation.');
          continue;
        }
        if (run.toolCalls >= config.maxToolCalls) {
          await svc.logStandalone(ctx, call.name, call.args, 'rejected', `Tool-call budget (${config.maxToolCalls}) exhausted for this turn.`);
          results.push({ id: call.id, name: call.name, output: { error: 'TOOL_BUDGET_EXHAUSTED' } });
          continue;
        }
        run.toolCalls += 1;
        if (!isAllowlisted(call.name)) {
          await svc.logStandalone(ctx, call.name.slice(0, 60), call.args, 'rejected', 'Unknown or non-allowlisted tool; rejected before execution.');
          results.push({ id: call.id, name: call.name, output: { error: 'UNKNOWN_TOOL', message: 'This tool does not exist. Only registered tools can be used.' } });
          continue;
        }
        const tool = getTool(call.name);
        const parsed = tool.args.safeParse(call.args ?? {});
        if (!parsed.success) {
          await svc.logStandalone(ctx, call.name, call.args, 'rejected', `Invalid arguments: ${parsed.error.issues[0]?.message ?? 'schema mismatch'}`);
          results.push({ id: call.id, name: call.name, output: { error: 'INVALID_ARGUMENTS', issues: parsed.error.issues.slice(0, 3).map((i) => i.message) } });
          continue;
        }
        try {
          const exec = await tool.run(svc, ctx, parsed.data);
          results.push({ id: call.id, name: call.name, output: exec.output });
          if (exec.pendingAction) pending = exec.pendingAction;
        } catch (e) {
          const err = toApiError(e);
          await svc.logStandalone(ctx, call.name, call.args, 'error', `${err.code}: ${err.message}`);
          // Never replace a failed tool output with fake success.
          results.push({ id: call.id, name: call.name, output: { error: err.code, message: err.message } });
        }
      }
      if (pending) {
        run.status = 'awaiting_confirmation';
        run.pendingActionId = pending.id;
        const lead = turn.text ? `${turn.text}\n\n` : '';
        run.reply = `${lead}[System] A sandbox submission is prepared and waiting for YOUR review. Nothing is submitted until you press Confirm in the review dialog. It expires at ${pending.expiresAt}.`;
        break;
      }
    }
  } catch (e) {
    run.status = 'failed';
    run.error = e instanceof ProviderError ? `Model provider error: ${e.message}` : e instanceof Error && e.name === 'AbortError' ? 'Model request timed out.' : toApiError(e).message;
    run.finishedAt = now().toISOString();
    await svc.saveRun(sessionId, run);
    await svc.logStandalone(ctx, 'model_round_trip', { roundTrips: run.roundTrips }, 'error', run.error);
    throw new ApiError(503, 'PROVIDER_ERROR', `${run.error} No response was invented; completed tool results remain recorded (run ${run.id}).`, true);
  }
  run.finishedAt = now().toISOString();
  await svc.saveRun(sessionId, run);
  const { toolEvents } = await svc.getRun(sessionId, run.id);
  return { run, toolEvents, pendingAction: pending };
}

