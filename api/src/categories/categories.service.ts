import { Injectable, Logger } from '@nestjs/common';
// TODO: Implement MongoDB-backed business operations. Do not return fake data.
@Injectable()
export class CategoriesService {
 private readonly logger = new Logger(CategoriesService.name);
}
