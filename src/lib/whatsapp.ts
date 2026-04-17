/**
 * WhatsApp Business API integration via 360dialog.
 * In MVP, this provides the structure for sending messages.
 * Replace with real API calls once 360dialog account is set up.
 */

interface WhatsAppMessage {
  to: string;
  type: 'text' | 'template';
  text?: { body: string };
  template?: {
    name: string;
    language: { code: string };
    components?: Array<{
      type: string;
      parameters: Array<{ type: string; text: string }>;
    }>;
  };
}

const API_URL = process.env.WHATSAPP_API_URL || 'https://waba.360dialog.io/v1';
const API_KEY = process.env.WHATSAPP_API_KEY || '';

async function sendWhatsAppMessage(message: WhatsAppMessage): Promise<boolean> {
  if (!API_KEY) {
    console.log('[WhatsApp Stub] Would send:', JSON.stringify(message, null, 2));
    return true;
  }

  try {
    const response = await fetch(`${API_URL}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'D360-API-KEY': API_KEY,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        ...message,
        to: message.to.replace(/[^0-9]/g, ''),
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[WhatsApp] Send failed:', err);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[WhatsApp] Network error:', error);
    return false;
  }
}

export async function sendBookingConfirmation(
  customerWhatsapp: string,
  details: {
    businessName: string;
    serviceName: string;
    date: string;
    time: string;
    address?: string;
  }
): Promise<boolean> {
  const body = [
    `✅ 預約確認 Booking Confirmed`,
    ``,
    `📍 ${details.businessName}`,
    `💇 ${details.serviceName}`,
    `📅 ${details.date}`,
    `🕐 ${details.time}`,
    details.address ? `📌 ${details.address}` : '',
    ``,
    `如需更改或取消預約，請聯繫商戶。`,
    `To reschedule or cancel, please contact the business.`,
  ].filter(Boolean).join('\n');

  return sendWhatsAppMessage({
    to: customerWhatsapp,
    type: 'text',
    text: { body },
  });
}

export async function sendBookingRequestReceived(
  customerWhatsapp: string,
  details: {
    businessName: string;
    serviceName: string;
    date: string;
    time: string;
    address?: string;
  }
): Promise<boolean> {
  const body = [
    `📝 預約申請已收到 Booking Request Received`,
    ``,
    `📍 ${details.businessName}`,
    `💇 ${details.serviceName}`,
    `📅 ${details.date}`,
    `🕐 ${details.time}`,
    details.address ? `📌 ${details.address}` : '',
    ``,
    `商戶確認後，我們會再通知你。`,
    `We will notify you once the owner confirms it.`,
  ].filter(Boolean).join('\n');

  return sendWhatsAppMessage({
    to: customerWhatsapp,
    type: 'text',
    text: { body },
  });
}

export async function sendOwnerBookingAlert(
  ownerWhatsapp: string,
  details: {
    customerName: string;
    serviceName: string;
    date: string;
    time: string;
    phone?: string;
  }
): Promise<boolean> {
  const body = [
    `📅 新預約申請 New Booking Request`,
    ``,
    `👤 ${details.customerName}`,
    `💇 ${details.serviceName}`,
    `📅 ${details.date}`,
    `🕐 ${details.time}`,
    details.phone ? `📞 ${details.phone}` : '',
    ``,
    `請到 BookEasy 後台確認此預約。`,
    `Please confirm this booking in BookEasy.`,
  ].filter(Boolean).join('\n');

  return sendWhatsAppMessage({
    to: ownerWhatsapp,
    type: 'text',
    text: { body },
  });
}

export async function sendReminder24h(
  customerWhatsapp: string,
  details: {
    businessName: string;
    serviceName: string;
    date: string;
    time: string;
    address?: string;
  }
): Promise<boolean> {
  const body = [
    `⏰ 預約提醒 Booking Reminder`,
    ``,
    `你的預約將於明天進行：`,
    `Your appointment is tomorrow:`,
    ``,
    `📍 ${details.businessName}`,
    `💇 ${details.serviceName}`,
    `📅 ${details.date}`,
    `🕐 ${details.time}`,
    details.address ? `📌 ${details.address}` : '',
  ].filter(Boolean).join('\n');

  return sendWhatsAppMessage({
    to: customerWhatsapp,
    type: 'text',
    text: { body },
  });
}

export async function sendReminder2h(
  customerWhatsapp: string,
  details: {
    businessName: string;
    time: string;
    address?: string;
  }
): Promise<boolean> {
  const body = [
    `⏰ 預約將於 2 小時後開始`,
    `Your appointment starts in 2 hours`,
    ``,
    `🕐 ${details.time}`,
    details.address ? `📌 ${details.address}` : '',
  ].filter(Boolean).join('\n');

  return sendWhatsAppMessage({
    to: customerWhatsapp,
    type: 'text',
    text: { body },
  });
}

// ── Waitlist notification ─────────────────────────────────────────────────────

/**
 * Notify a waitlisted customer that a slot has opened up.
 * Sent when a booking is cancelled and they are first in the queue.
 */
export async function sendWaitlistSlotOpened(
  customerWhatsapp: string,
  details: {
    businessName: string;
    serviceName: string;
    date: string;   // e.g. "2026-04-11"
    time: string;   // e.g. "14:00"
    bookingLink: string;
  }
): Promise<boolean> {
  // Format date for display
  const [year, month, day] = details.date.split('-');
  const displayDate = `${year}-${month}-${day}`;

  const body = [
    `🎉 有空位了！A slot has opened up!`,
    ``,
    `📍 ${details.businessName}`,
    `💇 ${details.serviceName}`,
    `📅 ${displayDate}`,
    `🕐 ${details.time}`,
    ``,
    `你在輪候名單上。立即點擊預約（30分鐘內有效）：`,
    `You're on the waitlist. Tap to book (expires in 30 minutes):`,
    `👉 ${details.bookingLink}`,
    ``,
    `⏰ 此連結將於30分鐘後失效。`,
    `This link expires in 30 minutes.`,
  ].join('\n');

  return sendWhatsAppMessage({
    to: customerWhatsapp,
    type: 'text',
    text: { body },
  });
}

export async function sendCancellationNotice(
  customerWhatsapp: string,
  details: {
    businessName: string;
    serviceName: string;
    date: string;
    time: string;
  }
): Promise<boolean> {
  const body = [
    `❌ 預約已取消 Booking Cancelled`,
    ``,
    `📍 ${details.businessName}`,
    `💇 ${details.serviceName}`,
    `📅 ${details.date}`,
    `🕐 ${details.time}`,
    ``,
    `如有疑問，請聯繫商戶。`,
    `For questions, please contact the business.`,
  ].filter(Boolean).join('\n');

  return sendWhatsAppMessage({
    to: customerWhatsapp,
    type: 'text',
    text: { body },
  });
}
