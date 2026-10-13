import { Injectable, Logger } from '@nestjs/common';
import { Incident } from '../../../entities/incident.entity';
import { User } from '../../../entities/user.entity';

export interface DispatchResult {
  success: boolean;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class EmailChannelProvider {
  private readonly logger = new Logger(EmailChannelProvider.name);

  async sendEmail(user: User, incident: Incident): Promise<DispatchResult> {
    if (!user || !user.email) {
      return {
        success: false,
        errorMessage: 'User email address is missing or invalid',
      };
    }

    try {
      // Simulated Email Dispatcher (e.g. Nodemailer / SendGrid / SES)
      this.logger.log(
        `[EmailChannel] Sending alert email to ${user.email} for Incident '${incident.title}' [Severity: ${incident.severity}]`,
      );

      // Simulate validation failure for invalid test email addresses
      if (user.email.includes('invalid') || user.email.includes('fail')) {
        throw new Error(`Email delivery failed to address '${user.email}'`);
      }

      return {
        success: true,
        metadata: {
          recipientEmail: user.email,
          subject: `[OnCallHQ Alert] ${incident.severity}: ${incident.title}`,
        },
      };
    } catch (err) {
      this.logger.error(`[EmailChannel] Dispatch error: ${err.message}`);
      return {
        success: false,
        errorMessage: err.message,
      };
    }
  }
}
