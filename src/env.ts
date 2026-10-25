// The environment, read once at boot. Names and explanations: .env.example.

export interface Env {
  /** `production` only when set so explicitly. Anything else keeps the phone
   *  allowlist in force whatever the switch page says. */
  appEnv: 'production' | 'development' | 'test';
  databaseUrl: string;
  mondayApiToken: string;
  mondayBoardId: string;
  /** The `?token=` monday's webhooks carry; monday signs nothing. */
  mondayWebhookSecret: string;
  manychatApiToken: string;
  manychatApiBase: string;
  calcomWebhookSecret: string;
  /** The needs-mapping event type. */
  calcomEventTypeId: number;
  /** The demo event type; 0 until it exists. */
  calcomDemoEventTypeId: number;
  /** The cal.com page of each type, for the links V3 writes on the card. */
  bookingUrl: string;
  demoBookingUrl: string;
  /** The attendee email a link carries for a Lead with none on the card —
   *  cal.com will not book without one. */
  noEmailAddress: string;
  killSwitchToken: string;
  adminToken: string;
  cronSecret: string;
  phoneAllowlist: string[];
  maxMessagesPerDay: number;
  timezone: string;
}

const list = (v: string | undefined) =>
  (v ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

export function envFromProcess(p: NodeJS.ProcessEnv = process.env): Env {
  const appEnv = p.APP_ENV === 'production' ? 'production' : p.APP_ENV === 'test' ? 'test' : 'development';
  return {
    appEnv,
    databaseUrl: p.DATABASE_URL ?? '',
    mondayApiToken: p.MONDAY_API_TOKEN ?? '',
    mondayBoardId: p.MONDAY_BOARD_ID ?? '1753447162',
    mondayWebhookSecret: p.MONDAY_WEBHOOK_SECRET ?? '',
    manychatApiToken: p.MANYCHAT_API_TOKEN ?? '',
    manychatApiBase: p.MANYCHAT_API_BASE ?? 'https://api.manychat.com',
    calcomWebhookSecret: p.CALCOM_WEBHOOK_SECRET ?? '',
    calcomEventTypeId: Number(p.CALCOM_EVENT_TYPE_ID ?? 6812251) || 0,
    calcomDemoEventTypeId: Number(p.CALCOM_DEMO_EVENT_TYPE_ID ?? 0) || 0,
    bookingUrl: p.BOOKING_URL ?? '',
    demoBookingUrl: p.DEMO_BOOKING_URL ?? '',
    noEmailAddress: p.CALCOM_NO_EMAIL_ADDRESS ?? 'leads@bringup.io',
    killSwitchToken: p.KILL_SWITCH_TOKEN ?? '',
    adminToken: p.ADMIN_TOKEN ?? '',
    cronSecret: p.CRON_SECRET ?? '',
    phoneAllowlist: list(p.PHONE_ALLOWLIST),
    maxMessagesPerDay: Number(p.MAX_MESSAGES_PER_DAY ?? 100) || 0,
    timezone: p.TIMEZONE ?? 'Asia/Jerusalem',
  };
}
