import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Increase body size limit for large payloads (e.g., resume data in job scoring)
  app.useBodyParser('json', { limit: '10mb' });

  // Enable CORS for cross-origin SSE connections
  app.enableCors({
    origin: true, // Allow the requesting origin
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
    }),
  );

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Agent Service API')
    .setDescription(
      'AI Agent Microservice with LangGraph, Vercel AI SDK, and Multi-Agent Support. ' +
      'This service provides intelligent agent capabilities including web browsing, news search, ' +
      'recursive sub-agent delegation, and real-time streaming responses.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .addTag('Agent', 'AI Agent chat and streaming endpoints')
    .addTag('Users', 'User management CRUD')
    .addTag('Conversations', 'Conversation management CRUD')
    .addTag('Settings', 'Service settings, Ollama models, and MCP servers')
    .addTag('Health', 'Health and status endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = process.env.PORT || 3001;
  await app.listen(port);

  logger.log(`🚀 Agent Service is running on: http://localhost:${port}`);
  logger.log(`📚 API Documentation available at: http://localhost:${port}/api`);
}

bootstrap();
