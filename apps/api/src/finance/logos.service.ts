import { Injectable } from "@nestjs/common";
import { PrismaService } from "#common/database/prisma.service";
import { scopedLogger } from "#common/logger/logger";
import { normaliseDomain } from "#finance/dto/subscription.dto";

const log = scopedLogger("LogosService");

const FETCH_TIMEOUT_MS = 5_000;
const MAX_BYTES = 256 * 1024;
/** How long "no icon found" is believed before asking the providers again. */
const RETRY_MISSING_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
/** Google answers unknown sites with a 16 px globe; anything this small is that. */
const MIN_BYTES = 200;
const RASTER = /^image\/(png|jpeg|gif|webp|x-icon|vnd\.microsoft\.icon)$/;

export interface Logo {
  data: Uint8Array<ArrayBuffer>;
  contentType: string;
}

/**
 * Favicon services, best first. Only the domain goes into a fixed provider
 * URL, so a crafted domain can't point the server at anything else.
 */
const PROVIDERS = [
  (domain: string) => `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
  (domain: string) => `https://icons.duckduckgo.com/ip3/${domain}.ico`,
];

/**
 * A subscription's logo, from its website's icon. Each domain is fetched
 * once and kept in `service_logos`, so a page of subscriptions costs no
 * outside requests after the first view, and the browser only ever talks
 * to our own origin.
 */
@Injectable()
export class LogosService {
  /** Concurrent requests for a domain nobody has fetched yet share one fetch. */
  private readonly inFlight = new Map<string, Promise<Logo | null>>();

  constructor(private readonly prisma: PrismaService) {}

  /** Null when the domain is invalid or no provider has an icon for it. */
  async get(rawDomain: string): Promise<Logo | null> {
    const domain = normaliseDomain(rawDomain);
    if (!domain) return null;

    const cached = await this.prisma.serviceLogo.findUnique({ where: { domain } });
    if (cached?.data && cached.contentType) {
      return { data: new Uint8Array(cached.data), contentType: cached.contentType };
    }
    if (cached && Date.now() - cached.fetchedAt.getTime() < RETRY_MISSING_AFTER_MS) return null;

    let pending = this.inFlight.get(domain);
    if (!pending) {
      pending = this.fetchAndStore(domain).finally(() => this.inFlight.delete(domain));
      this.inFlight.set(domain, pending);
    }
    return pending;
  }

  private async fetchAndStore(domain: string): Promise<Logo | null> {
    const logo = await this.fetchFirst(domain);
    const row = {
      data: logo ? Buffer.from(logo.data) : null,
      contentType: logo?.contentType ?? null,
      fetchedAt: new Date(),
    };
    await this.prisma.serviceLogo.upsert({
      where: { domain },
      create: { domain, ...row },
      update: row,
    });
    log.info({ domain, found: Boolean(logo), bytes: logo?.data.byteLength }, "logo fetched");
    return logo;
  }

  private async fetchFirst(domain: string): Promise<Logo | null> {
    for (const provider of PROVIDERS) {
      const url = provider(domain);
      try {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
          redirect: "follow",
        });
        const contentType = response.headers.get("content-type")?.split(";")[0].trim() ?? "";
        // No SVG: served from our own origin, one opened directly could run script.
        if (!response.ok || !RASTER.test(contentType)) continue;
        if (Number(response.headers.get("content-length") ?? 0) > MAX_BYTES) continue;
        const data = new Uint8Array(await response.arrayBuffer());
        if (data.byteLength < MIN_BYTES || data.byteLength > MAX_BYTES) continue;
        return { data, contentType };
      } catch (err) {
        log.warn({ domain, url, err: String(err) }, "logo provider failed");
      }
    }
    return null;
  }
}
