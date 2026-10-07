import { defineConfig } from "prisma/config";

// The connection URL for the CLI (migrate, studio). `prisma generate` doesn't
// need it, so it may be unset during installs and image builds.
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});
