import type { FastifyInstance } from 'fastify';

/** How long to let in-flight work finish before giving up and exiting. */
const DEFAULT_TIMEOUT_MS = 10_000;

export interface GracefulShutdownOptions {
  /** Force-exit deadline in ms. Default 10s. */
  timeoutMs?: number;
}

/**
 * Close the server cleanly on `SIGTERM`/`SIGINT`.
 *
 * `app.close()` stops accepting new connections, lets in-flight requests finish,
 * and runs the registered `onClose` hooks — which is what actually quits the
 * Redis connection. Without this, a deploy or `docker stop` kills requests
 * mid-flight and drops the socket.
 *
 * Registered explicitly from each `main.ts` rather than inside `createBffServer`:
 * a library that silently attaches process-level signal handlers is unpleasant
 * to debug and awkward in tests.
 */
export function registerGracefulShutdown(
  app: FastifyInstance,
  opts: GracefulShutdownOptions = {},
): void {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let shuttingDown = false;

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    // A second Ctrl-C shouldn't start a second close — just note it.
    if (shuttingDown) {
      app.log.warn({ signal }, 'Shutdown already in progress');
      return;
    }
    shuttingDown = true;
    app.log.info({ signal }, 'Shutting down gracefully');

    // Backstop: one wedged request must not hold the process open forever.
    // `unref` so this timer alone never keeps the loop alive.
    const force = setTimeout(() => {
      app.log.error({ timeoutMs }, 'Graceful shutdown timed out — forcing exit');
      process.exit(1);
    }, timeoutMs);
    force.unref();

    try {
      await app.close();
      clearTimeout(force);
      app.log.info('Shutdown complete');
      process.exit(0);
    } catch (err) {
      app.log.error({ err }, 'Error during shutdown');
      process.exit(1);
    }
  };

  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.once(signal, () => {
      void shutdown(signal);
    });
  }
}
