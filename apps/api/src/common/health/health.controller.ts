import { Controller, Get } from "@nestjs/common";
import { Public } from "#auth/decorators";
import { PrismaService } from "#common/database/prisma.service";

/** Liveness + DB reachability, used by the Docker Compose healthcheck. */
@Public()
@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: "ok" };
  }
}
