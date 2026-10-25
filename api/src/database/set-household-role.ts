import { NestFactory } from '@nestjs/core';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { AppModule } from '../app.module';
import {
  HOUSEHOLD_ROLES,
  HouseholdRole,
} from '../household-members/schemas/household-member.schema';
import { WriteService } from './write.service';

async function main() {
  const [email, role, ...extra] = process.argv.slice(2);
  if (
    !email ||
    !HOUSEHOLD_ROLES.includes(role as HouseholdRole) ||
    extra.length
  ) {
    throw new Error(
      'Usage: npm run auth:set-role -- registered-email owner|admin|member',
    );
  }
  process.env.SEED_ON_START = 'false';
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });
  try {
    const connection = app.get<Connection>(getConnectionToken());
    const userId = await app.get(WriteService).run(async (session) => {
      const user = await connection
        .collection('users')
        .findOne({ email: email.trim().toLowerCase() }, { session });
      if (!user) throw new Error('Register the account first.');
      const result = await connection
        .collection('household_members')
        .updateOne({ userId: user.id }, { $set: { role } }, { session });
      if (result.matchedCount !== 1)
        throw new Error('The account has no household membership.');
      return user.id;
    });
    console.log(`Updated household role: userId=${userId}, role=${role}`);
  } finally {
    await app.close();
  }
}
void main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
