import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Enable CORS
  app.enableCors({
    origin: true,
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
    .setTitle('Google Service API')
    .setDescription(
      'Google Integration Microservice for North Star. ' +
      'Provides OAuth2 binding, Gmail, Calendar, and Contacts integration.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .addTag('OAuth', 'Google OAuth2 authentication and token management')
    .addTag('Gmail', 'Email operations - search, read, send, reply')
    .addTag('Calendar', 'Calendar event operations - CRUD')
    .addTag('Contacts', 'Google Contacts operations - read, search')
    .addTag('Health', 'Health and status endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = process.env.PORT || 3003;
  await app.listen(port);

  logger.log(`🚀 Google Service is running on: http://localhost:${port}`);
  logger.log(`📚 API Documentation available at: http://localhost:${port}/api`);
}

bootstrap();
