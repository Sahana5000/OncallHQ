import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { User } from './user.entity';

@Entity({ name: 'services' })
export class Service {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @Column({ length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'ingestion_key', unique: true, length: 255 })
  ingestionKey: string;

  @Column({ name: 'fallback_user_id', type: 'uuid', nullable: true })
  fallbackUserId: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'fallback_user_id' })
  fallbackUser: User;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
