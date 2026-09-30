import type { Request, Response } from "express";
import { env } from "#common/config/env";

/**
 * `GET /logos/netflix.com`: a subscription's logo. The API fetches each
 * site's icon once and caches it (finance/logos.service.ts); this passes the
 * image bytes through with its caching headers, so the browser only ever
 * loads logos from our own origin.
 */
export async function serviceLogo(req: Request, res: Response): Promise<void> {
  const domain = String(req.params.domain ?? "");
  try {
    const upstream = await fetch(`${env.API_URL}/logos/${encodeURIComponent(domain)}`, {
      headers: { "x-request-id": String(req.id ?? "") },
      signal: AbortSignal.timeout(env.API_TIMEOUT_MS),
    });
    if (!upstream.ok) {
      // A miss is normal (no icon for that site); the page shows a letter instead.
      res.status(upstream.status === 404 ? 404 : 502).end();
      return;
    }
    for (const header of ["content-type", "cache-control", "content-security-policy"]) {
      const value = upstream.headers.get(header);
      if (value) res.setHeader(header, value);
    }
    res.setHeader("x-content-type-options", "nosniff");
    res.send(Buffer.from(await upstream.arrayBuffer()));
  } catch (err) {
    req.log.error({ err, domain }, "logo request failed to reach the api");
    res.status(502).end();
  }
}
