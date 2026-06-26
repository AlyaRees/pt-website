// lib/ratelimit.ts
import { Ratelimit } from "@upstash/ratelimit";
import redis from "./redis";

export const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1 h"), // 10 requests per hour
  analytics: true, // lets you see usage in the Upstash dashboard
});