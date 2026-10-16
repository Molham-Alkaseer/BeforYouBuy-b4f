import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ShoppingListService } from './shopping-list.service';
// TODO: Implement the routes listed in docs/api-plan.md with validated DTOs.
@ApiTags('shopping-list')
@Controller('shopping-list')
export class ShoppingListController {
 constructor(private readonly service: ShoppingListService) {}
}
