import { Controller, Get, Post, Param, ParseUUIDPipe } from '@nestjs/common';
import { ReportService } from './report.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';

interface AuthenticatedUser {
  id: string;
  email: string;
  isAdmin: boolean;
}

@Controller('assessments/:id/report')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Get()
  getReport(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reportService.getReport(id, user.id);
  }

  @Post('pdf')
  generatePdf(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reportService.generatePdf(id, user.id);
  }
}
