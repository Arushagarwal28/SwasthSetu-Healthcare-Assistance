import 'dotenv/config';
import http from 'http';
import app from './app';
import { initSocket } from './realtime/socket';
import { startReminderScheduler, stopReminderScheduler } from './modules/vaccination/reminder.scheduler';
import { closePdfRenderer } from './modules/reports/report.export.service';

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);
initSocket(server);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startReminderScheduler();
});

/**
 * Graceful shutdown.
 *
 * The PDF renderer keeps a Chromium child process alive; it must be closed
 * explicitly or it outlives the API and keeps its profile locks and memory.
 * A hard timeout guarantees the process still exits if a browser hangs.
 */
let shuttingDown = false;
const shutdown = async () => {
  if (shuttingDown) return;
  shuttingDown = true;
  stopReminderScheduler();
  await closePdfRenderer();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 10_000).unref();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
