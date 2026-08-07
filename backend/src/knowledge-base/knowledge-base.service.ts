import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { StoreService } from '../common/store.service';
import { AIService } from '../ai/ai.service';

@Injectable()
export class KnowledgeBaseService {
  constructor(
    private store: StoreService,
    private aiService: AIService,
  ) {}

  async createDocument(
    companyId: string,
    title: string,
    content: string,
    file?: {
      filename?: string | null;
      mime?: string | null;
      sizeBytes?: number;
      data?: Buffer | null;
      pageCount?: number;
    },
  ) {
    const chunks = this.chunkContent(content);

    const document = await this.store.createDocument({
      id: crypto.randomUUID(),
      companyId,
      title,
      content,
      chunks,
      filename: file?.filename || null,
      mime: file?.mime || null,
      sizeBytes: file?.sizeBytes || 0,
      file: file?.data || null,
      pageCount: file?.pageCount || 0,
      status: 'ready',
      published: true,
      error: null,
    });

    await this.generateAndStoreEmbeddings(document.id, companyId, chunks);

    return this.store.findDocumentById(document.id);
  }

  getDocuments(companyId: string, page = 1, limit = 50) {
    return this.store.findDocumentsByCompanyPaged(companyId, page, limit);
  }

  async assertDocumentInCompany(id: string, companyId: string) {
    const doc = await this.store.findDocumentById(id);
    if (!doc) {
      throw new NotFoundException('Document not found');
    }
    if (doc.companyId !== companyId) {
      throw new ForbiddenException('You do not have access to this document');
    }
    return doc;
  }

  async deleteDocument(id: string, companyId: string) {
    await this.assertDocumentInCompany(id, companyId);
    await this.store.deleteDocument(id);
    return { success: true };
  }

  async reindexDocument(id: string, companyId: string) {
    const doc = await this.assertDocumentInCompany(id, companyId);

    await this.store.deleteChunksByDocument(id);
    const chunks = this.chunkContent(doc.content);
    if (chunks.length === 0) {
      return this.store.updateDocument(id, { status: 'failed', error: 'No readable text to index.' });
    }

    await this.generateAndStoreEmbeddings(id, companyId, chunks);
    return this.store.updateDocument(id, { status: 'ready', error: null });
  }

  async ask(companyId: string, documentId: string, question: string) {
    if (!question || typeof question !== 'string' || !question.trim()) {
      throw new BadRequestException('A question is required');
    }
    const doc = await this.assertDocumentInCompany(documentId, companyId);
    if (doc.status !== 'ready') {
      throw new BadRequestException('This document is not ready yet. It may still be processing or have failed.');
    }
    return this.aiService.askKnowledgeDocument(companyId, documentId, question.trim());
  }

  async summarize(companyId: string, documentId: string, force = false) {
    const doc = await this.assertDocumentInCompany(documentId, companyId);
    if (doc.status !== 'ready') {
      throw new BadRequestException('This document is not ready yet. It may still be processing or have failed.');
    }
    if (doc.summary && !force) {
      return { summary: doc.summary, cached: true };
    }
    const summary = await this.aiService.summarizeKnowledgeDocument(companyId, documentId);
    await this.store.updateDocument(documentId, { summary });
    return { summary, cached: false };
  }

  async setPublished(id: string, companyId: string, published: boolean) {
    await this.assertDocumentInCompany(id, companyId);
    return this.store.updateDocument(id, { published });
  }

  private chunkContent(content: string): string[] {
    const paragraphs = content.split(/\n\s*\n/);
    const chunks: string[] = [];
    let currentChunk = '';

    for (const paragraph of paragraphs) {
      const trimmed = paragraph.trim();
      if (!trimmed) continue;

      if (currentChunk.length + trimmed.length > 500 && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }

      if (trimmed.length > 500) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }
        for (let i = 0; i < trimmed.length; i += 400) {
          chunks.push(trimmed.slice(i, i + 500));
        }
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + trimmed;
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks.length > 0 ? chunks : [content];
  }

  private async generateAndStoreEmbeddings(documentId: string, companyId: string, chunks: string[]) {
    for (let i = 0; i < chunks.length; i++) {
      const embedding = await this.aiService.generateEmbedding(chunks[i]);
      await this.store.insertChunk({
        id: crypto.randomUUID(),
        documentId,
        companyId,
        chunkIndex: i,
        chunkText: chunks[i],
        embedding,
      });
    }
  }
}
