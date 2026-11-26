import type { EmailMessage, EmailSendResult } from "./email-provider.js";

export type EmailDelivery = { id: string; notificationId: string; ownerId: string; attemptCount: number; subject: string; text: string; html: string; recipient: string };
export interface EmailDeliveryRepository {
  claim(workerId: string, now: Date, leaseMs: number): Promise<EmailDelivery | null>;
  accepted(id: string, workerId: string, providerMessageId: string, now: Date): Promise<void>;
  retry(id: string, workerId: string, attemptCount: number, nextAttemptAt: Date, category: string, now: Date): Promise<void>;
  failed(id: string, workerId: string, category: string, now: Date): Promise<void>;
}
export type EmailProvider = { send(message: EmailMessage): Promise<EmailSendResult> };
export type ProviderFailureLogger = (category: Exclude<EmailSendResult, { accepted: true }> ["category"]) => void;

export class EmailDispatcher {
  constructor(private readonly repository: EmailDeliveryRepository, private readonly provider: EmailProvider, private readonly workerId: string, private readonly maxAttempts = 5, private readonly leaseMs = 60_000, private readonly onProviderFailure?: ProviderFailureLogger) {}
  async processOne(now = new Date()) {
    const job = await this.repository.claim(this.workerId, now, this.leaseMs);
    if (!job) return false;
    const result = await this.provider.send({ to: job.recipient, subject: job.subject, text: job.text, html: job.html });
    if (result.accepted) { await this.repository.accepted(job.id, this.workerId, result.providerMessageId, now); return true; }
    this.onProviderFailure?.(result.category);
    if (result.category === "permanent" || result.category === "configuration" || job.attemptCount + 1 >= this.maxAttempts) {
      await this.repository.failed(job.id, this.workerId, result.category, now); return true;
    }
    const delay = result.category === "rate-limit" ? 60_000 : Math.min(3_600_000, 1_000 * 2 ** job.attemptCount);
    await this.repository.retry(job.id, this.workerId, job.attemptCount + 1, new Date(now.getTime() + delay), result.category, now);
    return true;
  }
}
