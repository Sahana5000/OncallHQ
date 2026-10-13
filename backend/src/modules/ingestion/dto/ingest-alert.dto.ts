import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsObject,
} from 'class-validator';
import { IncidentSeverity } from '../../../entities/incident.entity';

export class IngestAlertDto {
  @IsOptional()
  @IsString()
  alertName?: string;

  @IsOptional()
  @IsString()
  alert_name?: string;

  @IsOptional()
  @IsString()
  targetResource?: string;

  @IsOptional()
  @IsString()
  target_resource?: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(IncidentSeverity)
  severity?: IncidentSeverity = IncidentSeverity.HIGH;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  /**
   * Helper to retrieve resolved alert_name (supporting camelCase & snake_case)
   */
  getResolvedAlertName(): string {
    const name = this.alertName || this.alert_name || this.title;
    if (!name || name.trim() === '') {
      throw new Error('Alert payload must contain alertName, alert_name, or title');
    }
    return name.trim();
  }

  /**
   * Helper to retrieve resolved target_resource (supporting camelCase & snake_case)
   */
  getResolvedTargetResource(): string {
    const resource = this.targetResource || this.target_resource || 'default_resource';
    return resource.trim();
  }
}
