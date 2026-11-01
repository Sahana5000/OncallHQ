import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { MaintenanceService } from './maintenance.service';
import { CreateMaintenanceWindowDto } from './dto/create-maintenance-window.dto';
import { UpdateMaintenanceWindowDto } from './dto/update-maintenance-window.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User, UserRole } from '../../entities/user.entity';

@Controller('maintenance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Get()
  async getWindows(@Query('serviceId') serviceId?: string) {
    return this.maintenanceService.getWindows(serviceId);
  }

  @Get(':id')
  async getWindowById(@Param('id') id: string) {
    return this.maintenanceService.getWindowById(id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.LEAD)
  @HttpCode(HttpStatus.CREATED)
  async createWindow(
    @Body() dto: CreateMaintenanceWindowDto,
    @CurrentUser() user?: User,
  ) {
    return this.maintenanceService.createWindow(dto, user?.id);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.LEAD)
  async updateWindow(
    @Param('id') id: string,
    @Body() dto: UpdateMaintenanceWindowDto,
  ) {
    return this.maintenanceService.updateWindow(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.LEAD)
  async deleteWindow(@Param('id') id: string) {
    return this.maintenanceService.deleteWindow(id);
  }
}
