import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Req } from '@nestjs/common';
import { DepartmentsService } from './departments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('departments')
@UseGuards(JwtAuthGuard)
export class DepartmentsController {
  constructor(private departmentsService: DepartmentsService) {}

  @Get()
  getDepartments(@Req() req: any) {
    return this.departmentsService.getDepartments(req.user.companyId);
  }

  @Post()
  createDepartment(@Req() req: any, @Body() body: any) {
    return this.departmentsService.createDepartment(req.user.companyId, body);
  }

  @Patch(':id')
  updateDepartment(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.departmentsService.updateDepartment(id, body, req.user.companyId);
  }

  @Delete(':id')
  deleteDepartment(@Req() req: any, @Param('id') id: string) {
    return this.departmentsService.deleteDepartment(id, req.user.companyId);
  }
}
