import { Controller, Get, Patch, Body, UseGuards, Req } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('companies')
@UseGuards(JwtAuthGuard)
export class CompaniesController {
  constructor(private companiesService: CompaniesService) {}

  @Get('profile')
  getProfile(@Req() req: any) {
    return this.companiesService.getCompany(req.user.companyId);
  }

  @Patch('settings')
  updateSettings(@Req() req: any, @Body() body: Record<string, any>) {
    return this.companiesService.updateSettings(req.user.companyId, body);
  }
}
