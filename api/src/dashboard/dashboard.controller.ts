import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
// TODO: Implement the routes listed in docs/api-plan.md with validated DTOs.
@ApiTags('dashboard')
@Controller('dashboard')
export class DashboardController {
 constructor(private readonly service: DashboardService) {}
}
