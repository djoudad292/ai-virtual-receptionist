import { getHandler } from "../src/main.js";

// Vercel serverless entrypoint — all routes rewrite here (see vercel.json).
// NestJS wraps Express, so we hand Vercel the raw Express instance.
export default async function handler(req: any, res: any) {
  const app = await getHandler();
  const express = app.getHttpAdapter().getInstance();
  express(req, res);
}
