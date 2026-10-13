import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity({ name: 'audit_log' })
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @Column({ name: 'actor_id', length: 255 })
  actorId: string;

  @Column({ length: 100 })
  action: string;

  @Column({ name: 'entity_type', length: 100 })
  entityType: string;

  @Column({ name: 'entity_id', length: 255 })
  entityId: string;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
