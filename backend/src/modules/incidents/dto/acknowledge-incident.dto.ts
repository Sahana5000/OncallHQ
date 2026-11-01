import { IsUUID, IsOptional } from 'class-validator';

export class AcknowledgeIncidentDto {
  @IsUUID()
  @IsOptional()
  userId?: string;
}
