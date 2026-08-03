import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { AgentsService } from './agents.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('agents')
@UseGuards(JwtAuthGuard)
export class AgentsController {
  constructor(private agentsService: AgentsService) {}

  @Get()
  getAgents(@Req() req: any) {
    return this.agentsService.getAgents(req.user.companyId);
  }

  @Post()
  createAgent(@Req() req: any) {
    return this.agentsService.createAgent(req.user.id, req.user.companyId);
  }

  @Post('invite')
  inviteAgent(@Req() req: any, @Body('email') email: string, @Body('name') name: string) {
    if (req.user.role !== 'COMPANY_ADMIN') {
      throw new ForbiddenException('Only company admins can invite agents');
    }
    return this.agentsService.inviteAgent(req.user.companyId, email, name);
  }

  @Patch(':id/status')
  setOnlineStatus(
    @Req() req: any,
    @Param('id') id: string,
    @Body('isOnline') isOnline: boolean,
  ) {
    return this.agentsService.setOnlineStatus(id, isOnline, req.user.companyId);
  }

  @Delete(':id')
  removeAgent(@Req() req: any, @Param('id') id: string) {
    if (req.user.role !== 'COMPANY_ADMIN') {
      throw new ForbiddenException('Only company admins can remove agents');
    }
    return this.agentsService.removeAgent(id, req.user.companyId);
  }
}
