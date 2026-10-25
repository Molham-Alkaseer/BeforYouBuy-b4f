import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JsonObjectGuard } from '../common/guards/json-object.guard';
import { NoFieldsPipe } from '../common/pipes/no-fields.pipe';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RequestUser } from './request-user.interface';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto, SafeUserDto } from './dto/auth-response.dto';

@ApiTags('auth')
@Controller('auth')
@UseGuards(JsonObjectGuard)
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Post('register')
  @ApiOperation({
    summary: 'Create an admin account with a separate, empty household',
  })
  @ApiCreatedResponse({ type: SafeUserDto })
  @ApiResponse({ status: 409, description: 'Email already registered.' })
  register(
    @Body() body: RegisterDto,
    @Query(new NoFieldsPipe('query')) _query: object,
  ) {
    return this.auth.register(body);
  }
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Sign in and receive a two-hour bearer token' })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid email or password.' })
  login(
    @Body() body: LoginDto,
    @Query(new NoFieldsPipe('query')) _query: object,
  ) {
    return this.auth.login(body);
  }
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Read the current account and household role' })
  @ApiOkResponse({ type: SafeUserDto })
  @ApiResponse({
    status: 401,
    description: 'Missing/invalid token or deleted account.',
  })
  @ApiResponse({ status: 403, description: 'Household membership is missing.' })
  me(
    @CurrentUser() user: RequestUser,
    @Body(new NoFieldsPipe('body')) _body: object,
    @Query(new NoFieldsPipe('query')) _query: object,
  ) {
    return this.auth.me(user.sub);
  }
}
