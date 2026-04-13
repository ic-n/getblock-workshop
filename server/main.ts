import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
    const app = await NestFactory.create(AppModule, {
        logger: ['log', 'verbose', 'error', 'warn'],
    });

    app.enableCors({ origin: '*' });

    const port = 3001;
    await app.listen(port);

    const logger = new Logger('Bootstrap');
    logger.log(`NFT Indexer API  →  http://localhost:${port}`);
    logger.log(`SSE stream       →  http://localhost:${port}/events`);
    logger.log(`Health check     →  http://localhost:${port}/health`);
}

bootstrap();
