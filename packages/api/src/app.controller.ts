import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service';
import { Public } from './common/decorators/public.decorator';

@ApiTags('Health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Health check', description: 'Returns the current status of the API. No authentication required.' })
  @ApiResponse({ status: 200, description: 'API is healthy', schema: { example: { status: 'ok' } } })
  getHealth(): { status: string } {
    return this.appService.getHealth();
  }
}
