import { ClockService } from '../../src/common/clock/clock.service';
import { PositiveIdPipe } from '../../src/common/pipes/positive-id.pipe';
import { createValidationPipe } from '../../src/common/validation';
import { IsString } from 'class-validator';
class ExampleDto { @IsString() name: string; }

describe('Shared foundation', () => {
  it('uses the Damascus calendar across UTC midnight boundaries', () => {
    const clock = new ClockService();
    jest.spyOn(clock, 'now').mockReturnValue(new Date('2026-10-16T22:00:00Z'));
    expect(clock.today()).toBe('2026-10-17');
  });
  it.each(['0', '-1', '1.5', '1e2', ' 1', '9007199254740992', 'abc'])('rejects invalid ID %s', (id) => {
    expect(() => new PositiveIdPipe().transform(id)).toThrow();
  });
  it('accepts a numeric application ID', () => {
    expect(new PositiveIdPipe().transform('12')).toBe(12);
  });
  it.each(['body', 'query'] as const)('rejects unknown %s fields with field errors', async (type) => {
    await expect(createValidationPipe().transform({ name: 'Dairy', extra: true }, {
      type, metatype: ExampleDto,
    })).rejects.toMatchObject({ response: {
      code: 'VALIDATION_ERROR', fieldErrors: { extra: expect.any(Array) },
    } });
  });
});
