import { IsUUID, IsNotEmpty } from 'class-validator';

export class AcknowledgeIncidentDto {
  @IsUUID()
  @IsNotEmpty()
  userId: string;
}
