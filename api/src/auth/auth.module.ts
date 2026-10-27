import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from '../database/database.module';
import { UsersModule } from '../users/users.module';
import { HouseholdMembersModule } from '../household-members/household-members.module';
import { AuthController } from './auth.controller';
import { HouseholdController } from './household.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { HouseholdRolesGuard } from './guards/household-roles.guard';

export function requireJwtSecret(config: ConfigService): string {
  const secret = config.get<string>('JWT_SECRET');
  if (!secret || secret.trim().length < 32 || secret.startsWith('replace-')) {
    throw new Error(
      'JWT_SECRET must be a private random value of at least 32 characters.',
    );
  }
  return secret;
}

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    UsersModule,
    HouseholdMembersModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: requireJwtSecret(config),
        signOptions: { expiresIn: '2h', algorithm: 'HS256' },
      }),
    }),
  ],
  controllers: [AuthController, HouseholdController],
  providers: [AuthService, JwtAuthGuard, HouseholdRolesGuard],
  exports: [
    JwtAuthGuard,
    HouseholdRolesGuard,
    JwtModule,
    UsersModule,
    HouseholdMembersModule,
  ],
})
export class AuthModule {}
