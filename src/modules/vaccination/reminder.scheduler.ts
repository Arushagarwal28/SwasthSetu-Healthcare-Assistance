/**
 * Runs the reminder engine inside the Node.js process on a timer (no Redis or
 * queue needed for this project's size). Every tick: make sure reminders exist,
 * then send the ones that are due.
 *
 * .env options (all optional):
 *   REMINDER_SCHEDULER_ENABLED=false   turn the timer off
 *   REMINDER_TICK_SECONDS=60           how often to run (minimum 10)
 *   SMS_PROVIDER=mock                  the only provider implemented so far
 */
import { emptyStats, processDueReminders, reconcileReminders } from './reminder.service';
import type { CycleStats } from './reminder.service';
import { getSmsProvider } from './sms.provider';
import type { SmsProvider } from './sms.provider';

let timer: NodeJS.Timeout | null = null;
let firstRun: NodeJS.Timeout | null = null;
let running = false;

export const runReminderCycle = async (
  now: Date = new Date(),
  provider: SmsProvider = getSmsProvider()
): Promise<CycleStats> => {
  const stats = emptyStats();
  await reconcileReminders(now, stats);
  await processDueReminders(now, provider, stats);
  return stats;
};

const quiet = (s: CycleStats): boolean => Object.values(s).every((n) => n === 0);

const tick = async (): Promise<void> => {
  if (running) return; // the previous tick is still busy
  running = true;
  try {
    const stats = await runReminderCycle();
    if (!quiet(stats)) console.log('[reminders]', JSON.stringify(stats));
  } catch (err) {
    console.error('[reminders] cycle failed:', err instanceof Error ? err.message : err);
  } finally {
    running = false;
  }
};

export const startReminderScheduler = (): void => {
  if (process.env.REMINDER_SCHEDULER_ENABLED === 'false') {
    console.log('[reminders] scheduler disabled (REMINDER_SCHEDULER_ENABLED=false)');
    return;
  }
  if (timer) return;

  const provider = getSmsProvider(); // fail at startup, not at 9 a.m., if SMS_PROVIDER is wrong
  const seconds = Math.max(10, Number(process.env.REMINDER_TICK_SECONDS ?? 60) || 60);

  firstRun = setTimeout(() => void tick(), 10_000);
  timer = setInterval(() => void tick(), seconds * 1000);
  console.log(`[reminders] scheduler started: every ${seconds}s, SMS provider "${provider.name}"`);
};

export const stopReminderScheduler = (): void => {
  if (firstRun) clearTimeout(firstRun);
  if (timer) clearInterval(timer);
  firstRun = null;
  timer = null;
};
