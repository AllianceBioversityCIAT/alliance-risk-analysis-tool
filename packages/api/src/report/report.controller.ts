import { Controller, Get, Post, Param, ParseUUIDPipe } from '@nestjs/common';
import { ReportService } from './report.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UserClaims } from '../common/guards/jwt-auth.guard';

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
  ) {
    return this.reportService.generatePdf(id, user.userId);
  }
}
