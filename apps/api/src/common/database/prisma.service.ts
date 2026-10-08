import { Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { withOwnership } from "#common/database/ownership";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    // Prisma 7 connects through a driver adapter; DATABASE_URL is validated in env.ts.
    super({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
    // Every query this service makes is scoped to the request's user (ownership.ts).
    // biome-ignore lint/correctness/noConstructorReturn: Nest injects what the constructor returns
    return withOwnership(this);
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
