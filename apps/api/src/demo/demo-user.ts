import type { PrismaClient } from "@prisma/client";

/**
 * Whose data `demo:import` and `demo:export` work on: `--user=email`, else
 * the owner (an active one first, then the unclaimed owner of data from
 * before accounts). Data is per user, so the scripts run as that user.
 */
export async function demoUser(
  prisma: PrismaClient,
  args: string[],
): Promise<{ id: string; email: string }> {
  const email = args
    .find((a) => a.startsWith("--user="))
    ?.slice(7)
    .trim()
    .toLowerCase();
  const user = email
    ? await prisma.user.findUnique({ where: { email } })
    : await prisma.user.findFirst({
        where: { role: "OWNER" },
        orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      });
  if (!user) {
    throw new Error(
      email
        ? `No user ${email}. Sign up first, or leave out --user to use the owner.`
        : "No owner yet. Run the migrations, or sign up, then try again.",
    );
  }
  return { id: user.id, email: user.email };
}
