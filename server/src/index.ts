import app from './app';
import prisma from './lib/prisma';
import { initializeCronJobs } from './jobs/weeklyReport';
const PORT = parseInt(process.env.PORT ?? '3000', 10);

const server = app.listen(PORT, () => {
  console.log(`🚀 Hotel POS API running on port ${PORT} [${process.env.NODE_ENV ?? 'development'}]`);
  initializeCronJobs();
});

// Graceful shutdown
const shutdown = async (signal: string) => {
  console.log(`\n${signal} received — shutting down gracefully...`);
  server.close(async () => {
    await prisma.$disconnect();
    console.log('✅ Server closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
