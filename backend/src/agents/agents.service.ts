import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { StoreService } from '../common/store.service';

@Injectable()
export class AgentsService {
  constructor(private store: StoreService) {}

  async createAgent(userId: string, companyId: string) {
    const existing = await this.store.findAgentByUserId(userId);
    if (existing) return existing;

    await this.store.updateUser(userId, { role: 'AGENT' });

    return this.store.createAgent({
      id: crypto.randomUUID(),
      userId,
      companyId,
      isOnline: true,
    });
  }

  async getAgents(companyId: string) {
    const agents = await this.store.findAgentsByCompany(companyId);
    const withUsers = await Promise.all(
      agents.map(async (a) => {
        const user = await this.store.findUserById(a.userId);
        return { ...a, user };
      }),
    );
    return withUsers;
  }

  async setOnlineStatus(agentId: string, isOnline: boolean, companyId: string) {
    const agent = await this.store.findAgentById(agentId);
    if (!agent) {
      throw new NotFoundException('Agent not found');
    }
    if (agent.companyId !== companyId) {
      throw new ForbiddenException('You do not have access to this agent');
    }
    return this.store.updateAgent(agentId, { isOnline });
  }
}
