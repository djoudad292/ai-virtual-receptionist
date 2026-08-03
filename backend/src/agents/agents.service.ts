import { Injectable, NotFoundException, ForbiddenException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { StoreService } from '../common/store.service';
import { MailService } from '../common/mail.service';

@Injectable()
export class AgentsService {
  private readonly logger = new Logger(AgentsService.name);

  constructor(
    private store: StoreService,
    private mailService: MailService,
  ) {}

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

  async inviteAgent(companyId: string, email: string, name: string) {
    if (!email || typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email)) {
      throw new BadRequestException('A valid email is required');
    }
    const existing = await this.store.findUserByEmail(email.trim().toLowerCase());
    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }

    const tempPassword = crypto.randomBytes(9).toString('base64url').slice(0, 12);
    const hashed = await bcrypt.hash(tempPassword, 10);

    const user = await this.store.createUser({
      id: crypto.randomUUID(),
      email: email.trim().toLowerCase(),
      password: hashed,
      name: name?.trim() || email.split('@')[0],
      role: 'AGENT',
      companyId,
    });

    await this.store.createAgent({
      id: crypto.randomUUID(),
      userId: user.id,
      companyId,
      isOnline: false,
    });

    const frontendUrl = process.env.FRONTEND_URL || 'https://chat.djaouad.tech';
    const loginUrl = `${frontendUrl}/login`;
    const mail = this.mailService.buildInviteEmail(loginUrl, user.name, email.trim().toLowerCase(), tempPassword);
    await this.mailService.send({ to: email.trim().toLowerCase(), ...mail });

    this.logger.log(`Invited agent ${email} to company ${companyId}`);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      companyId: user.companyId,
      tempPassword,
    };
  }

  async removeAgent(agentId: string, companyId: string) {
    const agent = await this.store.findAgentById(agentId);
    if (!agent) {
      throw new NotFoundException('Agent not found');
    }
    if (agent.companyId !== companyId) {
      throw new ForbiddenException('You do not have access to this agent');
    }
    await this.store.deleteAgentByUserId(agent.userId);
    await this.store.deleteUser(agent.userId);
    return { success: true };
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
