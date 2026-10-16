import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PantryService } from './pantry.service';
// TODO: Implement the routes listed in docs/api-plan.md with validated DTOs.
@ApiTags('pantry')
@Controller('pantry')
export class PantryController {
 constructor(private readonly service: PantryService) {}
}
