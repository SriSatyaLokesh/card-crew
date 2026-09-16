import type { NextFunction, Request, Response } from "express";

import { HttpError } from "../errors/http-error.js";

type RateLimitMiddlewareOptions = {
  windowMs: number;
  maxRequests: number;
  errorMessage?: string;
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

function createRateLimitMiddleware({
  windowMs,
  maxRequests,
  errorMessage = "Too many requests, please try again later",
}: RateLimitMiddlewareOptions) {
  const requestsByIp = new Map<string, RateLimitEntry>();

  return (request: Request, _response: Response, next: NextFunction) => {
    const key = request.ip || "unknown";
    const now = Date.now();
    pruneExpiredEntries(requestsByIp, now);
    const existingEntry = requestsByIp.get(key);

    if (!existingEntry || existingEntry.resetAt <= now) {
      requestsByIp.set(key, {
        count: 1,
        resetAt: now + windowMs,
      });
      next();
      return;
    }

    if (existingEntry.count >= maxRequests) {
      next(new HttpError(429, errorMessage));
      return;
    }

    existingEntry.count += 1;
    next();
  };
}

function pruneExpiredEntries(requestsByIp: Map<string, RateLimitEntry>, now: number) {
  for (const [ip, entry] of requestsByIp.entries()) {
    if (entry.resetAt <= now) {
      requestsByIp.delete(ip);
    }
  }
}

export { createRateLimitMiddleware };
