import 'dotenv/config';
import http from 'http';
import app from './app';
import { initSocket } from './realtime/socket';
import { startReminderScheduler, stopReminderScheduler } from './modules/vaccination/reminder.scheduler';

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);
initSocket(server);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startReminderScheduler();
});

const shutdown = () => {
  stopReminderScheduler();
  server.close(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
