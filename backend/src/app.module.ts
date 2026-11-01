import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { HealthController } from './health/health.controller';
import { IngestionModule } from './modules/ingestion/ingestion.module';
import { IncidentsModule } from './modules/incidents/incidents.module';
import { SchedulesModule } from './modules/schedules/schedules.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { MaintenanceModule } from './modules/maintenance/maintenance.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import {
  User,
  Service,
  Schedule,
  ScheduleLayer,
  Override,
  Incident,
  Notification,
  AuditLog,
  MaintenanceWindow,
} from './entities';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../.env', '.env'],
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [
        {
          ttl: Number(configService.get<number>('THROTTLE_TTL', 60000)),
          limit: Number(configService.get<number>('THROTTLE_LIMIT', 100)),
        },
      ],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('POSTGRES_HOST', 'localhost'),
        port: Number(configService.get<string | number>('POSTGRES_PORT', 5432)),
        username: configService.get<string>('POSTGRES_USER', 'postgres'),
        password: configService.get<string>('POSTGRES_PASSWORD', 'postgres'),
        database: configService.get<string>('POSTGRES_DB', 'oncallhq'),
        entities: [
          User,
          Service,
          Schedule,
          ScheduleLayer,
          Override,
          Incident,
          Notification,
          AuditLog,
          MaintenanceWindow,
        ],
        synchronize: false,
      }),
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: Number(configService.get<string | number>('REDIS_PORT', 6379)),
        },
      }),
    }),
    AuthModule,
    IngestionModule,
    IncidentsModule,
    SchedulesModule,
    NotificationsModule,
    AuditModule,
    MaintenanceModule,
    AnalyticsModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
