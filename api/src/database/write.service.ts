import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { ClientSession, Connection } from 'mongoose';

@Injectable()
export class WriteService implements OnModuleInit {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  async onModuleInit(): Promise<void> {
    const fences = this.connection.collection<{ _id: string; revision: number }>('write_fences');
    try {
      await fences.updateOne({ _id: 'household' }, { $setOnInsert: { revision: 0 } }, { upsert: true });
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
    }
  }

  async run<T>(operation: (session: ClientSession) => Promise<T>): Promise<T> {
    const session = await this.connection.startSession();
    try {
      return await session.withTransaction(async () => {
        // Every domain write MUST touch this same document first. Concurrent writes
        // conflict and retry, including deletes versus newly created references.
        await this.connection.collection<{ _id: string; revision: number }>('write_fences').updateOne(
          { _id: 'household' }, { $inc: { revision: 1 } }, { session },
        );
        return operation(session);
      }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
    } finally {
      await session.endSession();
    }
  }
}
