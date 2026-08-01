import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  Req,
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

  @Patch(':id/status')
  setOnlineStatus(
    @Param('id') id: string,
    @Body('isOnline') isOnline: boolean,
  ) {
    return this.agentsService.setOnlineStatus(id, isOnline);
  }
}
