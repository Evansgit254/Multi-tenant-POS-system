/**
 * SMS / WhatsApp service using Africa's Talking.
 *
 * Configuration (add to .env):
 *   AT_API_KEY   = your_africa_talking_api_key
 *   AT_USERNAME  = your_africa_talking_username (use 'sandbox' for testing)
 *   AT_SENDER_ID = optional short code or alphanumeric sender (e.g. 'SERVEPOINT')
 *
 * If AT_API_KEY is not set, messages are logged to the console (dev mode).
 */

let atClient: any = null;

const getATClient = () => {
  if (atClient) return atClient;
  if (!process.env.AT_API_KEY) return null;

  // Dynamically require to avoid breaking if africastalking is not installed
  try {
    const AfricasTalking = require('africastalking');
    const at = AfricasTalking({
      apiKey: process.env.AT_API_KEY,
      username: process.env.AT_USERNAME || 'sandbox',
    });
    atClient = at.SMS;
    return atClient;
  } catch {
    console.error('[SMS] africastalking package not found. Run: npm install africastalking');
    return null;
  }
};

/**
 * Sends an SMS to a phone number.
 * Phone must be in E.164 format: +254712345678
 */
export const sendSMS = async (phone: string, message: string): Promise<void> => {
  const sms = getATClient();

  if (!sms) {
    console.log(`[SMS] DEV MODE — Would send to ${phone}: ${message}`);
    return;
  }

  try {
    await sms.send({
      to: [phone],
      message,
      from: process.env.AT_SENDER_ID,
    });
    console.log(`[SMS] ✅ Sent to ${phone}`);
  } catch (err: any) {
    // Non-fatal: SMS failure should not block the order flow
    console.error(`[SMS] Failed to send to ${phone}:`, err?.message || err);
  }
};

/**
 * Formats a simple order receipt as an SMS-friendly string.
 */
export const formatReceiptSMS = (opts: {
  orderNumber: string;
  items: { name: string; quantity: number }[];
  total: number;
  currency: string;
  tenantName: string;
}): string => {
  const { orderNumber, items, total, currency, tenantName } = opts;
  const itemList = items.map(i => `${i.quantity}x ${i.name}`).join(', ');
  return (
    `${tenantName} Receipt\n` +
    `Order: ${orderNumber}\n` +
    `Items: ${itemList}\n` +
    `Total: ${currency} ${total.toFixed(2)}\n` +
    `Thank you!`
  );
};
