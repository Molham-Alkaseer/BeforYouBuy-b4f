import { PipeTransform } from '@nestjs/common';
import { apiError } from '../errors/api-error';

export class NoFieldsPipe implements PipeTransform {
  constructor(private readonly location: 'body' | 'query') {}
  transform(value: unknown) {
    if (value === undefined) return {};
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      throw apiError(400, 'VALIDATION_ERROR', `Unexpected ${this.location}.`);
    }
    const keys = Object.keys(value);
    if (keys.length) {
      throw apiError(400, 'VALIDATION_ERROR', `This endpoint accepts no ${this.location} fields.`,
        Object.fromEntries(keys.map((key) => [key, ['This field is not allowed.']])));
    }
    return value;
  }
}
