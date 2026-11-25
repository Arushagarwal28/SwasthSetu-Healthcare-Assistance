/**
 * SMS provider abstraction. The reminder engine only knows the SmsProvider
 * interface, so a real provider can be added later without touching it.
 *
 * Today only the MOCK provider exists: it sends nothing, it logs a masked
 * number. For testing failure handling, the mock fails for any number ending in 0000.
 *
 * Real Indian SMS also needs DLT registration of every message template; that
 * work is for the final SMS step and is not done here.
 */
import { randomUUID } from 'crypto';

export interface SmsMessage {
  to: string; // +91XXXXXXXXXX
  text: string;
  templateKey: string;
}

export interface SmsSendResult {
  providerMessageId: string;
  raw: Record<string, string | number | boolean>;
}

export interface SmsProvider {
  readonly name: string;
  send(message: SmsMessage): Promise<SmsSendResult>;
}

/** 9876543210 or +919876543210 -> ******3210 (never log the full number) */
export const maskPhone = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  return digits.length <= 4 ? '****' : `******${digits.slice(-4)}`;
};

export const toE164India = (tenDigitMobile: string): string => `+91${tenDigitMobile}`;

export class MockSmsProvider implements SmsProvider {
  readonly name = 'mock';

  constructor(private readonly logText: boolean = process.env.SMS_MOCK_LOG_TEXT !== 'false') {}

  async send(message: SmsMessage): Promise<SmsSendResult> {
    if (message.to.endsWith('0000')) {
      throw new Error('Mock provider: simulated delivery failure (number ends with 0000)');
    }
    const id = `mock-${randomUUID()}`;
    console.log(
      `[mock-sms] to ${maskPhone(message.to)} template=${message.templateKey} id=${id}` +
        (this.logText ? `\n           ${message.text}` : '')
    );
    return { providerMessageId: id, raw: { provider: 'mock', accepted: true } };
  }
}

let cached: SmsProvider | null = null;

/** Chosen by SMS_PROVIDER (default "mock"). An unknown name is an error, never a silent fallback. */
export const getSmsProvider = (): SmsProvider => {
  if (cached) return cached;
  const name = (process.env.SMS_PROVIDER ?? 'mock').toLowerCase();
  if (name === 'mock') {
    cached = new MockSmsProvider();
    return cached;
  }
  throw new Error(`Unknown SMS_PROVIDER "${name}". Only "mock" is implemented so far.`);
};
