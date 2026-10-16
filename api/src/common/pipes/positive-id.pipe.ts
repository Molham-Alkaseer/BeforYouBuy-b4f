import { Injectable, PipeTransform } from '@nestjs/common';
import { apiError } from '../errors/api-error';

@Injectable()
export class PositiveIdPipe implements PipeTransform<string, number> {
  transform(value: string): number {
    const id = Number(value);
    if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(id)) {
      throw apiError(400, 'VALIDATION_ERROR', 'ID must be a positive safe integer.', { id: ['Use a positive integer ID.'] });
    }
    return id;
  }
}
