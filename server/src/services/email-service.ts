import { Resend } from "resend";

export interface EmailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
}

export class EmailService {
  private client: Resend | null = null;

  constructor(apiKey?: string) {
    if (apiKey) {
      try {
        this.client = new Resend(apiKey);
        console.debug("✓ Resend email client initialized");
      } catch (e) {
        console.error("Failed to initialize Resend client:", e);
      }
    } else {
      console.warn("RESEND_API_KEY not set. Email notifications disabled.");
    }
  }

  get isConfigured(): boolean {
    return this.client !== null;
  }

  async send(opts: EmailOptions): Promise<void> {
    if (!this.client) return;

    const payload = {
      from: "Prompt Manager <notifications@prompts.rodeo>",
      to: Array.isArray(opts.to) ? opts.to : [opts.to],
      subject: opts.subject,
      html: opts.html ?? opts.text ?? "",
      ...(opts.text ? { text: opts.text } : {}),
    };

    const { error } = await this.client.emails.send(payload);

    if (error) {
      console.error("Failed to send email:", error);
    }
  }
}
