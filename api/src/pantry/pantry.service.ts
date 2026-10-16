import { Injectable, Logger } from '@nestjs/common';
// TODO: Implement MongoDB-backed business operations. Do not return fake data.
@Injectable()
export class PantryService {
 private readonly logger = new Logger(PantryService.name);
}
