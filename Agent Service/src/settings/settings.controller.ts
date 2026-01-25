import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpException,
  HttpStatus,
  OnModuleInit,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiQuery, ApiBody } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth';
import {
  ServiceSettingSchema,
  UpdateServiceSettingSchema,
  CreateMcpServerSchema,
  UpdateMcpServerSchema,
  ServiceSettingInput,
  UpdateServiceSettingInput,
  CreateMcpServer,
  UpdateMcpServer,
} from '../agent/schemas';
import { ZodError } from 'zod';

@ApiTags('Settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('settings')
export class SettingsController implements OnModuleInit {
  constructor(
    private settingsService: SettingsService,
    private analyticsService: AnalyticsService,
  ) {}

  async onModuleInit() {
    await this.settingsService.initializeDefaults();
  }

  // ============ Service Settings ============

  @Get()
  @ApiOperation({ summary: 'List all settings' })
  @ApiQuery({ name: 'category', required: false, type: 'string' })
  async getAllSettings(@Query('category') category?: string) {
    const settings = category
      ? await this.settingsService.getSettingsByCategory(category)
      : await this.settingsService.getAllSettings();
    return { success: true, data: settings };
  }

  @Get('key/:key')
  @ApiOperation({ summary: 'Get a setting by key' })
  @ApiParam({ name: 'key', type: 'string' })
  async getSetting(@Param('key') key: string) {
    const setting = await this.settingsService.getSetting(key);
    return { success: true, data: setting };
  }

  @Post()
  @ApiOperation({ summary: 'Create a new setting' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['key', 'value'],
      properties: {
        key: { type: 'string' },
        value: {},
        description: { type: 'string' },
        category: { type: 'string' },
      },
    },
  })
  async createSetting(@Body() body: ServiceSettingInput) {
    try {
      const validated = ServiceSettingSchema.parse(body);
      const setting = await this.settingsService.createSetting(validated);
      return { success: true, data: setting };
    } catch (error) {
      if (error instanceof ZodError) {
        throw new HttpException(
          { success: false, message: 'Validation error', errors: error.errors },
          HttpStatus.BAD_REQUEST,
        );
      }
      throw error;
    }
  }

  @Put('key/:key')
  @ApiOperation({ summary: 'Update a setting' })
  @ApiParam({ name: 'key', type: 'string' })
  async updateSetting(@Param('key') key: string, @Body() body: UpdateServiceSettingInput) {
    try {
      const validated = UpdateServiceSettingSchema.parse(body);
      const setting = await this.settingsService.updateSetting(key, validated);
      return { success: true, data: setting };
    } catch (error) {
      if (error instanceof ZodError) {
        throw new HttpException(
          { success: false, message: 'Validation error', errors: error.errors },
          HttpStatus.BAD_REQUEST,
        );
      }
      throw error;
    }
  }

  @Delete('key/:key')
  @ApiOperation({ summary: 'Delete a setting' })
  @ApiParam({ name: 'key', type: 'string' })
  async deleteSetting(@Param('key') key: string) {
    await this.settingsService.deleteSetting(key);
    return { success: true, message: 'Setting deleted' };
  }

  // ============ Ollama Models ============

  @Get('ollama/models')
  @ApiOperation({ summary: 'List available Ollama models' })
  async listOllamaModels() {
    const models = await this.settingsService.listOllamaModels();
    return { success: true, data: models };
  }

  @Get('ollama/default-model')
  @ApiOperation({ summary: 'Get the default Ollama model' })
  async getDefaultModel() {
    const model = await this.settingsService.getDefaultModel();
    return { success: true, data: { model } };
  }

  @Put('ollama/default-model')
  @ApiOperation({ summary: 'Set the default Ollama model' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['model'],
      properties: {
        model: { type: 'string', description: 'Model name' },
      },
    },
  })
  async setDefaultModel(@Body('model') model: string) {
    const setting = await this.settingsService.setDefaultModel(model);
    return { success: true, data: setting };
  }

  @Post('ollama/pull')
  @ApiOperation({ summary: 'Pull an Ollama model (synchronous - waits for completion)' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['model'],
      properties: {
        model: { type: 'string', description: 'Model name to pull' },
      },
    },
  })
  async pullOllamaModel(@Body('model') model: string) {
    const result = await this.settingsService.pullOllamaModel(model);
    return { success: result.success, message: result.message };
  }

  @Post('ollama/pull-async')
  @ApiOperation({ summary: 'Pull an Ollama model (async - returns immediately with jobId)' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['model'],
      properties: {
        model: { type: 'string', description: 'Model name to pull' },
      },
    },
  })
  async pullOllamaModelAsync(@Body('model') model: string) {
    const result = await this.settingsService.pullOllamaModelAsync(model);
    return { success: true, jobId: result.jobId, message: 'Pull started' };
  }

  @Get('ollama/pull-status/:jobId')
  @ApiOperation({ summary: 'Get status of an async model pull' })
  @ApiParam({ name: 'jobId', type: 'string' })
  async getPullJobStatus(@Param('jobId') jobId: string) {
    const status = this.settingsService.getPullJobStatus(jobId);
    return { success: true, ...status };
  }

  @Get('ollama/pull-jobs')
  @ApiOperation({ summary: 'List all active pull jobs (debug endpoint)' })
  async getActivePullJobs() {
    const jobs = this.settingsService.getActivePullJobs();
    return { success: true, data: jobs };
  }

  @Get('debug/health')
  @ApiOperation({ summary: 'Debug endpoint - service health check' })
  async debugHealth() {
    try {
      const models = await this.settingsService.listOllamaModels();
      return {
        success: true,
        timestamp: new Date().toISOString(),
        ollamaConnection: 'ok',
        modelCount: models.length,
        activeJobs: this.settingsService.getActivePullJobs().length,
      };
    } catch (error) {
      return {
        success: false,
        timestamp: new Date().toISOString(),
        ollamaConnection: 'error',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }



  @Get('mcp-servers')
  @ApiOperation({ summary: 'List all MCP servers' })
  async getAllMcpServers() {
    const servers = await this.settingsService.getAllMcpServers();
    return { success: true, data: servers };
  }

  @Get('mcp-servers/:id')
  @ApiOperation({ summary: 'Get an MCP server by ID' })
  @ApiParam({ name: 'id', type: 'string' })
  async getMcpServer(@Param('id') id: string) {
    const server = await this.settingsService.getMcpServer(id);
    return { success: true, data: server };
  }

  @Post('mcp-servers')
  @ApiOperation({ summary: 'Create a new MCP server' })
  async createMcpServer(@Body() body: CreateMcpServer) {
    try {
      const validated = CreateMcpServerSchema.parse(body);
      const server = await this.settingsService.createMcpServer(validated);
      return { success: true, data: server };
    } catch (error) {
      if (error instanceof ZodError) {
        throw new HttpException(
          { success: false, message: 'Validation error', errors: error.errors },
          HttpStatus.BAD_REQUEST,
        );
      }
      throw error;
    }
  }

  @Put('mcp-servers/:id')
  @ApiOperation({ summary: 'Update an MCP server' })
  @ApiParam({ name: 'id', type: 'string' })
  async updateMcpServer(@Param('id') id: string, @Body() body: UpdateMcpServer) {
    try {
      const validated = UpdateMcpServerSchema.parse(body);
      const server = await this.settingsService.updateMcpServer(id, validated);
      return { success: true, data: server };
    } catch (error) {
      if (error instanceof ZodError) {
        throw new HttpException(
          { success: false, message: 'Validation error', errors: error.errors },
          HttpStatus.BAD_REQUEST,
        );
      }
      throw error;
    }
  }

  @Delete('mcp-servers/:id')
  @ApiOperation({ summary: 'Delete an MCP server' })
  @ApiParam({ name: 'id', type: 'string' })
  async deleteMcpServer(@Param('id') id: string) {
    await this.settingsService.deleteMcpServer(id);
    return { success: true, message: 'MCP server deleted' };
  }

  @Post('mcp-servers/:id/toggle')
  @ApiOperation({ summary: 'Toggle an MCP server enabled status' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['enabled'],
      properties: {
        enabled: { type: 'boolean' },
      },
    },
  })
  async toggleMcpServer(@Param('id') id: string, @Body('enabled') enabled: boolean) {
    const server = await this.settingsService.toggleMcpServer(id, enabled);
    return { success: true, data: server };
  }

  // ============ Model Analytics ============

  @Get('analytics/models')
  @ApiOperation({ summary: 'Get analytics for all models' })
  async getAllModelStats() {
    const stats = await this.analyticsService.getAllModelStats();
    return { success: true, data: stats };
  }

  @Get('analytics/models/:modelName')
  @ApiOperation({ summary: 'Get analytics for a specific model' })
  @ApiParam({ name: 'modelName', type: 'string' })
  async getModelStats(@Param('modelName') modelName: string) {
    const stats = await this.analyticsService.getModelStats(modelName);
    return { success: true, data: stats };
  }

  @Get('analytics/models/:modelName/recent')
  @ApiOperation({ summary: 'Get recent analytics entries for a model' })
  @ApiParam({ name: 'modelName', type: 'string' })
  @ApiQuery({ name: 'limit', required: false, type: 'number' })
  async getRecentAnalytics(
    @Param('modelName') modelName: string,
    @Query('limit') limit?: number,
  ) {
    const entries = await this.analyticsService.getRecentAnalytics(
      modelName,
      limit || 50,
    );
    return { success: true, data: entries };
  }

  @Get('analytics/models/:modelName/hourly')
  @ApiOperation({ summary: 'Get hourly stats for a model (last 24h)' })
  @ApiParam({ name: 'modelName', type: 'string' })
  async getHourlyStats(@Param('modelName') modelName: string) {
    const stats = await this.analyticsService.getHourlyStats(modelName);
    return { success: true, data: stats };
  }
}
