import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { StoreService } from '../common/store.service';
import { MailService } from '../common/mail.service';

describe('AgentsService invite & removal', () => {
  let agentsService: AgentsService;
  let store: { [key: string]: jest.Mock };
  let mail: { [key: string]: jest.Mock };

  beforeEach(async () => {
    store = {
      findUserByEmail: jest.fn(),
      createUser: jest.fn(),
      createAgent: jest.fn(),
      findAgentById: jest.fn(),
      deleteAgentByUserId: jest.fn(),
      deleteUser: jest.fn(),
      findAgentsByCompany: jest.fn(),
      findUserById: jest.fn(),
      findAgentByUserId: jest.fn(),
      updateUser: jest.fn(),
    };
    mail = {
      send: jest.fn().mockResolvedValue(true),
      buildInviteEmail: jest.fn().mockReturnValue({ subject: 's', text: 't', html: 'h' }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AgentsService,
        { provide: StoreService, useValue: store },
        { provide: MailService, useValue: mail },
      ],
    }).compile();

    agentsService = moduleRef.get(AgentsService);
  });

  it('rejects an invalid email address', async () => {
    await expect(agentsService.inviteAgent('company-1', 'not-an-email', 'A')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects inviting an email that already exists', async () => {
    store.findUserByEmail.mockResolvedValue({ id: 'u', email: 'a@b.com' });
    await expect(agentsService.inviteAgent('company-1', 'a@b.com', 'A')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('creates the user, agent record and sends an invite email', async () => {
    store.findUserByEmail.mockResolvedValue(null);
    store.createUser.mockResolvedValue({ id: 'new-user', email: 'a@b.com', name: 'A', role: 'AGENT', companyId: 'company-1' });
    store.createAgent.mockResolvedValue({ id: 'agent-1' });

    const result = await agentsService.inviteAgent('company-1', 'a@b.com', 'Agent');

    expect(store.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'a@b.com', role: 'AGENT', companyId: 'company-1' }),
    );
    expect(store.createAgent).toHaveBeenCalled();
    expect(mail.send).toHaveBeenCalled();
    expect(result.tempPassword).toBeDefined();
    expect(result.tempPassword).toHaveLength(12);
  });

  it('refuses to remove an agent from another company', async () => {
    store.findAgentById.mockResolvedValue({ id: 'agent-1', userId: 'u', companyId: 'company-2' });
    await expect(agentsService.removeAgent('agent-1', 'company-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(store.deleteUser).not.toHaveBeenCalled();
  });
});
