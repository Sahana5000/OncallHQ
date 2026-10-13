import { Controller, Get, Param } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('incident/:incidentId')
  async getNotificationsForIncident(@Param('incidentId') incidentId: string) {
    return this.notificationsService.getNotificationsForIncident(incidentId);
  }

  @Get('user/:userId')
  async getNotificationsForUser(@Param('userId') userId: string) {
    return this.notificationsService.getNotificationsForUser(userId);
  }
}
