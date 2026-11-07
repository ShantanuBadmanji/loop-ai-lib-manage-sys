import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { SeedModule } from './seed.module';
import { SeedService } from './seed.service';

async function run() {
  const logger = new Logger('Seed');
  const app = await NestFactory.createApplicationContext(SeedModule, {
    logger: ['log', 'warn', 'error'],
  });
  try {
    await app.get(SeedService).run();
  } catch (error) {
    logger.error('Seeding failed', error as Error);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void run();
