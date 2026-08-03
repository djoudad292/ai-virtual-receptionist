import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { StoreService } from '../common/store.service';
import { AIService } from '../ai/ai.service';

@Injectable()
export class KnowledgeBaseService {
  constructor(
    private store: StoreService,
    private aiService: AIService,
  ) {}

  async createDocument(companyId: string, title: string, content: string) {
    const chunks = this.chunkContent(content);

    const document = await this.store.createDocument({
      id: crypto.randomUUID(),
      companyId,
      title,
      content,
      chunks,
    });

    await this.generateAndStoreEmbeddings(document.id, companyId, chunks);

    return this.store.findDocumentById(document.id);
  }

  getDocuments(companyId: string) {
    return this.store.findDocumentsByCompany(companyId);
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
    await this.store.deleteDocument(id);

    const newDoc = await this.store.createDocument({
      id: crypto.randomUUID(),
      companyId: doc.companyId,
      title: doc.title,
      content: doc.content,
      chunks,
    });

    await this.generateAndStoreEmbeddings(newDoc.id, doc.companyId, chunks);

    return this.store.findDocumentById(newDoc.id);
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
