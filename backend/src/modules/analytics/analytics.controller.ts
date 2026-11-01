import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  async getOverview(
    @Query('serviceId') serviceId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.analyticsService.getOverview(serviceId, startDate, endDate);
  }

  @Get('services')
  async getServiceMetrics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.analyticsService.getServiceMetrics(startDate, endDate);
  }

  @Get('trends')
  async getTrends(
    @Query('serviceId') serviceId?: string,
    @Query('days') days?: string,
  ) {
    const daysNum = days ? parseInt(days, 10) : 7;
    return this.analyticsService.getTrends(serviceId, daysNum);
  }
}
