import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
// TODO: Implement the routes listed in docs/api-plan.md with validated DTOs.
@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
 constructor(private readonly service: CategoriesService) {}
}
