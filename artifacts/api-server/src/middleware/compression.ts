import { type Request, type Response, type NextFunction } from "express";
import zlib from "zlib";

export function compressionMiddleware(req: Request, res: Response, next: NextFunction): void {
  const acceptEncoding = req.headers["accept-encoding"] || "";
  if (!acceptEncoding.includes("gzip")) {
    return next();
  }

  const originalWrite = res.write;
  const originalEnd = res.end;
  const chunks: Buffer[] = [];

  res.write = function (this: any, chunk: any, ...args: any[]): boolean {
    if (chunk) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return true;
  } as any;

  res.end = function (this: any, chunk: any, encoding?: any, cb?: any): any {
    if (chunk) {
      const enc: BufferEncoding = typeof encoding === "string" ? (encoding as BufferEncoding) : "utf8";
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, enc));
    }

    const buffer = Buffer.concat(chunks);
    if (buffer.length < 1024) {
      if (encoding) {
        return originalEnd.call(this, buffer, encoding, cb);
      } else {
        return originalEnd.call(this, buffer, cb);
      }
    }

    zlib.gzip(buffer, (err, compressed) => {
      if (err) {
        return next(err);
      }
      res.setHeader("Content-Encoding", "gzip");
      res.setHeader("Content-Length", compressed.length);
      originalEnd.call(this, compressed, cb);
    });

    return this;
  } as any;

  next();
}
