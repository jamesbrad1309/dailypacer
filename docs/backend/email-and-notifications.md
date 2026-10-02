# Email & notifications (planned, not built yet)

The app will need to send a lot of email and notifications: habit reminders,
overdue to-dos, weekly finance summaries, digests, and account email (sign-in
links, password resets). This note picks a provider and the shape of the
sending code before any of it exists.

**Decision:** **Resend** for email, sent from a **pg-boss** job queue in
`apps/api`, behind a small `EmailSender` interface. Add **Novu** only if
push or in-app notifications are needed as well as email.

## Email providers

| Service | Best for | Pros | Cons |
|---|---|---|---|
| **Resend** (pick) | Transactional email from a TypeScript app | Clean Node SDK. Native **React Email** support, so templates are TSX components that can share code with `apps/web`. Generous free tier, webhooks, batch sending. | Younger company. More per email than SES at very high volume. |
| **Postmark** | Email that must reach the inbox (sign-in links, resets) | Best-in-class deliverability. Separate "message streams" for transactional and bulk email. Good bounce and spam handling. | No real free tier. Pricier. |
| **Amazon SES** | Very high volume at the lowest cost | About $0.10 per 1,000 emails. Scales to anything. | Templates, bounce handling (SNS webhooks) and reputation monitoring are yours to build. Starts in a sandbox until AWS approves the account. |
| SendGrid / Mailgun | — | Mature, many features | Heavier, dated developer experience. SendGrid's free tier and support have gotten worse. No reason to pick them here. |

Prices and free tiers change; check them before signing up.

Why Resend: it's the fastest to integrate with NestJS + React, and React
Email keeps templates in the same language as the rest of the codebase. If
volume grows a lot, move bulk email (digests, weekly summaries) to SES and
keep account email on Resend or Postmark. The `EmailSender` interface makes
that a one-file change:

```ts
// apps/api/src/notifications/email-sender.ts (sketch)
export interface EmailSender {
  send(message: {
    to: string;
    subject: string;
    html: string;
    text: string;
    category: "account" | "reminder" | "digest";
  }): Promise<{ providerId: string }>;
}
```

## Notifications are more than email

Reminders like "habit due" or "task overdue" will probably want push or
in-app delivery too, plus per-user preferences and quiet hours. Two options
when that happens:

- **Novu** (open source, can run in `docker-compose.yml`): one API for
  email, push, in-app and SMS. It handles user preferences and digests (for
  example, ten reminders bundled into one email). It sends email through
  Resend or SES underneath.
- **Knock**: the same idea, hosted only. More polished, but paid.

For email alone, Resend plus a queue is enough. Don't add either until a
second channel is actually needed.

## Architecture, whatever the provider

1. **Send from a queue, not in the request.** Postgres is already running,
   so **pg-boss** gives scheduled, retryable jobs with no new
   infrastructure. Switch to BullMQ only if Redis gets added for other
   reasons. Scheduled reminders fit naturally: "send at 08:00 in the user's
   timezone" is a job with a start time.
2. **Respect user preferences.** A notification-preferences table per user
   and category. Non-essential email carries an unsubscribe link; Gmail and
   Yahoo require one-click unsubscribe (`List-Unsubscribe` headers) for bulk
   senders.
3. **Set up deliverability from day one.** SPF, DKIM and DMARC on the
   domain. Send from a subdomain such as `mail.<domain>`, and keep account
   and bulk email on separate addresses or streams so a digest spam
   complaint can't hurt sign-in emails.
4. **Handle provider webhooks.** Stop emailing addresses that hard-bounce
   or report spam, or the sender reputation drops for everyone.
5. **Log every send.** Use the shared pino logger (see [Logging](logging.md))
   with the provider's message id, so a "never got the email" report can be
   traced.

## Related

- [API structure](nestjs-structure.md) — where a `notifications` module would live
- [Prisma & data access](prisma-and-data-access.md) — preferences table and migrations
- [Use cases](../domain/use-cases.md) — reminders and summaries that would trigger sends
