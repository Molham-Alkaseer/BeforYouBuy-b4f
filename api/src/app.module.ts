import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { CategoriesModule } from './categories/categories.module';
import { PantryModule } from './pantry/pantry.module';
import { ShoppingListModule } from './shopping-list/shopping-list.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { SeedModule } from './database/seed.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('MONGODB_URI'),
        serverSelectionTimeoutMS: 5000,
      }),
    }),
    CategoriesModule,
    PantryModule,
    ShoppingListModule,
    DashboardModule,
    SeedModule,
  ],
})
export class AppModule {}
