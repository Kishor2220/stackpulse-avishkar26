export type EmailMessage = { to: string; subject: string; text: string; html: string };
export type EmailSendResult = { accepted: true; providerMessageId: string } | { accepted: false; category: "configuration" | "rate-limit" | "transient" | "permanent" };

export class ResendEmailProvider {
  constructor(private readonly apiKey: string | undefined, private readonly from: string | undefined, private readonly request: typeof fetch = fetch) {}

  async send(message: EmailMessage): Promise<EmailSendResult> {
    if (!this.apiKey || !this.from) return { accepted: false, category: "configuration" };
    try {
      const response = await this.request("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: this.from, to: [message.to], subject: message.subject, text: message.text, html: message.html }) });
      if (response.status === 429) return { accepted: false, category: "rate-limit" };
      if (response.status >= 500) return { accepted: false, category: "transient" };
      if (!response.ok) return { accepted: false, category: "permanent" };
      const body: unknown = await response.json();
      const id = body && typeof body === "object" && "id" in body && typeof body.id === "string" ? body.id : null;
      return id ? { accepted: true, providerMessageId: id } : { accepted: false, category: "transient" };
    } catch {
      return { accepted: false, category: "transient" };
    }
  }
}
