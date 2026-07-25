import { AsyncLocalStorage } from "async_hooks";
import { type Request, type Response, type NextFunction } from "express";
import { logger } from "../lib/logger";

export const queryCounterStorage = new AsyncLocalStorage<{ count: number }>();

// Expose query store dynamically to drizzle logger at runtime via globalThis
(globalThis as any).__drizzleQueryCounterStore = {
  get count() {
    return queryCounterStorage.getStore()?.count ?? 0;
  },
  set count(val: number) {
    const store = queryCounterStorage.getStore();
    if (store) {
      store.count = val;
    }
  }
};

export function telemetryMiddleware(req: Request, res: Response, next: NextFunction) {
  const startTime = process.hrtime();
  const store = { count: 0 };

  queryCounterStorage.run(store, () => {
    const originalWrite = res.write;
    const originalEnd = res.end;
    let responseSize = 0;

    res.write = function (chunk: any, ...args: any[]) {
      if (chunk) {
        responseSize += Buffer.isBuffer(chunk) ? chunk.length : Buffer.from(chunk).length;
      }
      return originalWrite.apply(res, [chunk, ...args]);
    } as any;

    res.end = function (chunk: any, ...args: any[]) {
      if (chunk) {
        responseSize += Buffer.isBuffer(chunk) ? chunk.length : Buffer.from(chunk).length;
      }

      const diff = process.hrtime(startTime);
      const executionTimeMs = (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(2);
      const queryCount = store.count;

      res.setHeader("X-Query-Count", String(queryCount));
      res.setHeader("X-Execution-Time", `${executionTimeMs}ms`);
      res.setHeader("X-Response-Size", `${responseSize} bytes`);

      if (queryCount > 10) {
        logger.warn(
          {
            method: req.method,
            url: req.url,
            queryCount,
            executionTimeMs,
            responseSize,
          },
          "Request exceeded query count threshold of 10"
        );
      }

      return originalEnd.apply(res, [chunk, ...args]);
    } as any;

    next();
  });
}
