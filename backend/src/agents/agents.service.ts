import { Injectable } from '@nestjs/common';
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

  setOnlineStatus(agentId: string, isOnline: boolean) {
    return this.store.updateAgent(agentId, { isOnline });
  }
}
