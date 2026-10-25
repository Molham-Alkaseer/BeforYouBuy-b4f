import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsString,
  MaxLength,
  MinLength,
  ValidateBy,
} from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'member@example.com', maxLength: 254 })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({
    minLength: 8,
    description:
      'At least 8 characters; at most 72 UTF-8 bytes. Never trimmed.',
  })
  @IsString()
  @MinLength(8)
  @ValidateBy({
    name: 'maxPasswordBytes',
    validator: {
      validate: (value: unknown) =>
        typeof value === 'string' && Buffer.byteLength(value, 'utf8') <= 72,
      defaultMessage: () => 'password must be at most 72 UTF-8 bytes',
    },
  })
  password: string;
}
