import { DomainError } from '@farmlink/engine';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function toApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e;
  if (e instanceof DomainError) return new ApiError(e.status, e.code, e.message);
  if (e && typeof e === 'object' && 'name' in e && (e as { name: string }).name === 'ZodError') {
    const issues = (e as unknown as { issues: Array<{ path: PropertyKey[]; message: string }> }).issues;
    return new ApiError(422, 'VALIDATION_FAILED', issues.slice(0, 5).map((i) => `${i.path.map(String).join('.')}: ${i.message}`).join('; '));
  }
  return new ApiError(500, 'INTERNAL', 'Internal error.', true);
}
