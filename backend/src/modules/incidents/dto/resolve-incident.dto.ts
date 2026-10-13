import { IsUUID, IsOptional } from 'class-validator';

export class ResolveIncidentDto {
  @IsOptional()
  @IsUUID()
  userId?: string;
}
