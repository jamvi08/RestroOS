export interface WhatsAppSendResult {
  success: boolean;
  data?: any;
}

/**
 * Send a WhatsApp text via a self-hosted server (Whatsmeow or OpenWA).
 * Both expose the same REST API — just point WA_SERVER_URL at whichever you run.
 *
 * @param phone - 10-digit Indian mobile number (without country code)
 * @param text - Message body (WhatsApp *bold* formatting works)
 */
export async function sendWhatsAppText(phone: string, text: string): Promise<WhatsAppSendResult> {
  const serverUrl = process.env.WA_SERVER_URL;
  const apiKey = process.env.WA_API_KEY;

  // Sanitize phone number (strip whitespace, hyphens, and leading +91 or 0 if present)
  const cleanedPhone = phone.replace(/\D/g, "").slice(-10);

  if (cleanedPhone.length !== 10) {
    throw new Error("Invalid mobile number. Please provide a valid 10-digit Indian mobile number.");
  }

  // Fallback for development if WA server is not configured
  if (!serverUrl || !apiKey) {
    console.warn(
      `\n======================================================\n` +
      `⚠️  [WhatsApp Dev Mode] WA_SERVER_URL or WA_API_KEY not set.\n` +
      `📲  Message for +91 ${cleanedPhone}:\n${text}\n` +
      `======================================================\n`
    );
    return { success: true, data: { simulated: true } };
  }

  // chatId format for whatsmeow: 91XXXXXXXXXX@s.whatsapp.net
  const chatId = `91${cleanedPhone}@s.whatsapp.net`;

  try {
    const response = await fetch(`${serverUrl}/api/sendText`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        key: apiKey,
      },
      body: JSON.stringify({ chatId, text }),
      signal: AbortSignal.timeout(6000), // 6-second timeout to avoid long hangs
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("WhatsApp server error:", errorBody);
      throw new Error(`WhatsApp server returned HTTP ${response.status}: ${errorBody || response.statusText}`);
    }

    const data = await response.json();
    console.log(`WhatsApp message sent to ${cleanedPhone}:`, data);
    return { success: true, data };
  } catch (err: any) {
    console.error(`[WhatsApp Error] Could not reach WhatsApp server at ${serverUrl}:`, err.message || err);

    // In development mode, provide fallback so testing is not blocked
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `\n======================================================\n` +
        `⚠️  [WhatsApp Server Unreachable at ${serverUrl}]\n` +
        `📲  DEV FALLBACK message for +91 ${cleanedPhone}:\n${text}\n` +
        `💡  Note: Check that the WhatsApp server is running and WA_API_KEY is correct.\n` +
        `======================================================\n`
      );
      return {
        success: true,
        data: {
          simulated: true,
          reason: `WhatsApp server at ${serverUrl} timed out (connection failed).`,
        },
      };
    }

    throw new Error(
      `Could not reach WhatsApp server at ${serverUrl}. Please check the server and WA_API_KEY.`
    );
  }
}

/** Send a login code. In dev (no WhatsApp server) `data.simulated` is true so the screen can show the code. */
export async function sendWhatsAppOTP(phone: string, otp: string): Promise<WhatsAppSendResult> {
  return sendWhatsAppText(phone, `Your RestroOS OTP is: *${otp}*\nValid for 10 minutes. Do not share this with anyone.`);
}
