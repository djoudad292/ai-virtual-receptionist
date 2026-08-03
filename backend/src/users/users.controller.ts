import { Controller, Get, Param, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  findByCompany(@Req() req: any) {
    if (req.user.role !== 'COMPANY_ADMIN') {
      throw new ForbiddenException('Only company admins can list users');
    }
    return this.usersService.findByCompany(req.user.companyId);
  }

  @Get(':id')
  async findById(@Req() req: any, @Param('id') id: string) {
    const isSelf = req.user.id === id;
    const isAdmin = req.user.role === 'COMPANY_ADMIN';
    if (!isSelf && !isAdmin) {
      throw new ForbiddenException('You can only view your own profile');
    }
    const user = await this.usersService.findById(id);
    if (!user) return null;
    if (!isSelf && user.companyId !== req.user.companyId) {
      throw new ForbiddenException('Cannot view users in another company');
    }
    return user;
  }
}
