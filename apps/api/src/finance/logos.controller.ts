import { Controller, Get, Header, NotFoundException, Param, StreamableFile } from "@nestjs/common";
import { LogosService } from "#finance/logos.service";

@Controller("logos")
export class LogosController {
  constructor(private readonly logos: LogosService) {}

  /** `GET /logos/netflix.com`: the site's icon, fetched once and cached (see LogosService). */
  @Get(":domain")
  // Logos barely change; a week in the browser's cache saves re-asking.
  @Header("Cache-Control", "public, max-age=604800")
  @Header("Content-Security-Policy", "default-src 'none'; sandbox")
  async get(@Param("domain") domain: string): Promise<StreamableFile> {
    const logo = await this.logos.get(domain);
    if (!logo) throw new NotFoundException(`No logo for ${domain}`);
    return new StreamableFile(logo.data, { type: logo.contentType });
  }
}
