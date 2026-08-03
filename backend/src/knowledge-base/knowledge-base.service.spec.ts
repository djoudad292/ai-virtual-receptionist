import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { KnowledgeBaseService } from './knowledge-base.service';
import { StoreService } from '../common/store.service';
import { AIService } from '../ai/ai.service';

describe('KnowledgeBaseService tenant isolation', () => {
  let kbService: KnowledgeBaseService;
  let store: { [key: string]: jest.Mock };

  beforeEach(async () => {
    store = {
      findDocumentById: jest.fn(),
      findDocumentsByCompanyPaged: jest.fn(),
      findDocumentsByCompany: jest.fn(),
      createDocument: jest.fn(),
      deleteDocument: jest.fn(),
      deleteChunksByDocument: jest.fn(),
      insertChunk: jest.fn(),
    };
    const ai = {
      generateEmbedding: jest.fn().mockResolvedValue(new Array(1536).fill(0.1)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        KnowledgeBaseService,
        { provide: StoreService, useValue: store },
        { provide: AIService, useValue: ai },
      ],
    }).compile();

    kbService = moduleRef.get(KnowledgeBaseService);
  });

  it('allows access to a document owned by the company', async () => {
    store.findDocumentById.mockResolvedValue({ id: 'doc-1', companyId: 'company-1' });
    const doc = await kbService.assertDocumentInCompany('doc-1', 'company-1');
    expect(doc.companyId).toBe('company-1');
  });

  it('throws ForbiddenException for a document owned by another company', async () => {
    store.findDocumentById.mockResolvedValue({ id: 'doc-1', companyId: 'company-2' });
    await expect(kbService.assertDocumentInCompany('doc-1', 'company-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('throws NotFoundException for a missing document', async () => {
    store.findDocumentById.mockResolvedValue(null);
    await expect(kbService.assertDocumentInCompany('nope', 'company-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('refuses to delete a document from another company', async () => {
    store.findDocumentById.mockResolvedValue({ id: 'doc-1', companyId: 'company-2' });
    await expect(kbService.deleteDocument('doc-1', 'company-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(store.deleteDocument).not.toHaveBeenCalled();
  });
});
