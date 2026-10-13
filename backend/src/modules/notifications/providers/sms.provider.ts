import { Injectable, Logger } from '@nestjs/common';
import { Incident } from '../../../entities/incident.entity';
import { User } from '../../../entities/user.entity';
import { DispatchResult } from './email.provider';

@Injectable()
export class SmsMockChannelProvider {
  private readonly logger = new Logger(SmsMockChannelProvider.name);

  async sendSms(user: User, incident: Incident): Promise<DispatchResult> {
    if (!user || !user.phoneNumber) {
      return {
        success: false,
        errorMessage: 'User phone number is missing',
      };
    }

    try {
      this.logger.log(
        `[SmsMockChannel] Sending SMS to ${user.phoneNumber}: [OnCallHQ ${incident.severity}] ${incident.title}`,
      );

      if (user.phoneNumber.includes('0000') || user.phoneNumber.includes('fail')) {
        throw new Error(`SMS gateway rejected phone number '${user.phoneNumber}'`);
      }

      return {
        success: true,
        metadata: {
          recipientPhone: user.phoneNumber,
          messageSnippet: `[OnCallHQ ${incident.severity}] ${incident.title}`,
        },
      };
    } catch (err) {
      this.logger.error(`[SmsMockChannel] Dispatch error: ${err.message}`);
      return {
        success: false,
        errorMessage: err.message,
      };
    }
  }
}
