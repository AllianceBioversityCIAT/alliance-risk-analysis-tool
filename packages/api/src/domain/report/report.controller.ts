import { Controller, Get, Post, Body, Param, ParseUUIDPipe } from '@nestjs/common';
import { ReportService } from './report.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { UserClaims } from '../../common/guards/jwt-auth.guard';
import { ReportConfigDto } from './dto/report-config.dto';

@Controller('assessments/:id/report')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Get()
  getReport(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UserClaims,
  ) {
    return this.reportService.getReport(id, user.userId);
  }

  @Post('pdf')
  generatePdf(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UserClaims,
    @Body() config?: ReportConfigDto,
  ) {
    return this.reportService.generatePdf(id, user.userId, config);
  }
}
