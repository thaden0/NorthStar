import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Health')
@Controller()
export class HealthController {
  @Get('health')
  @ApiOperation({ summary: 'Health check' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  health() {
    return {
      status: 'ok',
      service: 'google-service',
      timestamp: new Date().toISOString(),
    };
  }

  @Get()
  @ApiOperation({ summary: 'Service info' })
  root() {
    return {
      name: 'Google Service',
      description: 'Google Integration Microservice for North Star',
      version: '1.0.0',
      endpoints: {
        health: '/health',
        docs: '/api',
        oauth: '/oauth/*',
        gmail: '/gmail/*',
        calendar: '/calendar/*',
        contacts: '/contacts/*',
      },
    };
  }
}
