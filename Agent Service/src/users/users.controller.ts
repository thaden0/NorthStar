import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiParam } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth';
import { CreateUserSchema, UpdateUserSchema, CreateUser, UpdateUser } from '../agent/schemas';
import { ZodError } from 'zod';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'List all users' })
  async findAll() {
    const users = await this.usersService.findAll();
    return { success: true, data: users };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a user by ID' })
  @ApiParam({ name: 'id', type: 'string' })
  async findOne(@Param('id') id: string) {
    const user = await this.usersService.findOne(id);
    return { success: true, data: user };
  }

  @Post()
  @ApiOperation({ summary: 'Create a new user' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['id', 'email'],
      properties: {
        id: { type: 'string' },
        email: { type: 'string', format: 'email' },
        name: { type: 'string' },
        metadata: { type: 'object' },
      },
    },
  })
  async create(@Body() body: CreateUser) {
    try {
      const validated = CreateUserSchema.parse(body);
      const user = await this.usersService.create(validated);
      return { success: true, data: user };
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

  @Put(':id')
  @ApiOperation({ summary: 'Update a user' })
  @ApiParam({ name: 'id', type: 'string' })
  async update(@Param('id') id: string, @Body() body: UpdateUser) {
    try {
      const validated = UpdateUserSchema.parse(body);
      const user = await this.usersService.update(id, validated);
      return { success: true, data: user };
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

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a user' })
  @ApiParam({ name: 'id', type: 'string' })
  async delete(@Param('id') id: string) {
    await this.usersService.delete(id);
    return { success: true, message: 'User deleted' };
  }

  @Post('sync')
  @ApiOperation({ summary: 'Sync/upsert a user from external service' })
  async sync(@Body() body: CreateUser) {
    try {
      const validated = CreateUserSchema.parse(body);
      const user = await this.usersService.upsert(validated);
      return { success: true, data: user };
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
}
