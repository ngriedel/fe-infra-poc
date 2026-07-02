export class AppError extends Error {
  override readonly name = 'AppError';
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export const unauthenticated = (message = 'Not signed in') =>
  new AppError('UNAUTHENTICATED', message, 401);

export const badRequest = (code: string, message: string, details?: Record<string, unknown>) =>
  new AppError(code, message, 400, details);

export const notFound = (message = 'Not found') => new AppError('NOT_FOUND', message, 404);
