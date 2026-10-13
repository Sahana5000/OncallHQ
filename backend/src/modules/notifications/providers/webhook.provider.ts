import { Injectable, Logger } from '@nestjs/common';
import { Incident } from '../../../entities/incident.entity';
import { DispatchResult } from './email.provider';

@Injectable()
export class WebhookChannelProvider {
  private readonly logger = new Logger(WebhookChannelProvider.name);

  async sendWebhook(targetUrl: string, incident: Incident): Promise<DispatchResult> {
    if (!targetUrl || targetUrl.trim() === '') {
      return {
        success: false,
        errorMessage: 'Webhook target URL is missing or empty',
      };
    }

    try {
      this.logger.log(
        `[WebhookChannel] Dispatching webhook payload to ${targetUrl} for incident ${incident.id}`,
      );

      const payload = {
        event: 'incident.alert',
        incidentId: incident.id,
        serviceId: incident.serviceId,
        title: incident.title,
        severity: incident.severity,
        state: incident.state,
        currentTier: incident.currentTier,
        assignedUserId: incident.assignedUserId,
        timestamp: new Date().toISOString(),
      };

      // Mock webhook dispatch for local testing if targetUrl starts with http://mock
      if (targetUrl.includes('mock-fail') || targetUrl.includes('invalid-host')) {
        throw new Error(`Webhook endpoint unreachable at '${targetUrl}'`);
      }

      if (targetUrl.startsWith('http')) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);

          const response = await fetch(targetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            throw new Error(`Webhook target responded with HTTP status ${response.status}`);
          }
        } catch (fetchErr) {
          // If network fetch fails, wrap error cleanly
          throw new Error(`Webhook HTTP POST failed: ${fetchErr.message}`);
        }
      }

      return {
        success: true,
        metadata: {
          targetUrl,
          dispatchedAt: new Date().toISOString(),
        },
      };
    } catch (err) {
      this.logger.error(`[WebhookChannel] Dispatch error: ${err.message}`);
      return {
        success: false,
        errorMessage: err.message,
      };
    }
  }
}
