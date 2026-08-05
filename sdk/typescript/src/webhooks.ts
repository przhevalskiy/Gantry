import { createHmac, timingSafeEqual } from 'crypto';

/** Verify X-Gantry-Signature header against the webhook secret. */
export function verifyWebhookSignature(
  body: Buffer | string,
  header: string,
  secret: string,
): boolean {
  const payload = typeof body === 'string' ? Buffer.from(body) : body;
  const expected =
    'sha256=' + createHmac('sha256', secret).update(payload).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(header));
  } catch {
    return false;
  }
}
