import { Injectable } from '@nestjs/common';
import { DatabaseService } from './database.service';

export type StoredUser = {
  id: string;
  email: string;
  password: string;
  name: string;
  role: string;
  companyId?: string;
  tokenVersion: number;
  createdAt: Date;
  updatedAt: Date;
};

export type StoredCompany = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  settings: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
};

export type StoredConversation = {
  id: string;
  companyId: string;
  title: string;
  status: string;
  department?: string | null;
  assignedAgentId?: string | null;
  leadId?: string | null;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  lastMessage?: string | null;
  handledBy?: string | null;
};

export type StoredMessage = {
  id: string;
  conversationId: string;
  senderId?: string | null;
  senderType: string;
  content: string;
  createdAt: Date;
};

export type StoredAgent = {
  id: string;
  userId: string;
  companyId: string;
  isOnline: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type StoredDocument = {
  id: string;
  companyId: string;
  title: string;
  content: string;
  chunks: string[];
  filename?: string | null;
  mime?: string | null;
  sizeBytes: number;
  file?: Buffer | null;
  pageCount: number;
  status: string;
  summary?: string | null;
  published: boolean;
  error?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type StoredChunk = {
  id: string;
  documentId: string;
  companyId: string;
  chunkIndex: number;
  chunkText: string;
  embedding: number[];
  createdAt: Date;
};

export type StoredLead = {
  id: string;
  companyId: string;
  conversationId?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  message?: string | null;
  source?: string;
  status: string;
  department?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type StoredAppointment = {
  id: string;
  companyId: string;
  conversationId?: string | null;
  leadId?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  title?: string | null;
  notes?: string | null;
  startTime: string;
  endTime: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

export type StoredDepartment = {
  id: string;
  companyId: string;
  name: string;
  description?: string | null;
  keywords: string[];
  email?: string | null;
  createdAt: Date;
};

@Injectable()
export class StoreService {
  constructor(private db: DatabaseService) {}

  // Raw queries (analytics / reports)
  async getRaw<T extends Record<string, any> = any>(text: string, params?: any[]): Promise<T[]> {
    return this.db.query<T>(text, params);
  }

  // Users
  async createUser(data: Omit<StoredUser, 'createdAt' | 'updatedAt' | 'tokenVersion'>): Promise<StoredUser> {
    const rows = await this.db.query<StoredUser>(
      `INSERT INTO users (id, email, password_hash, name, role, company_id, token_version, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 0, now(), now())
       RETURNING id, email, password_hash AS password, name, role, company_id AS "companyId", token_version AS "tokenVersion", created_at AS "createdAt", updated_at AS "updatedAt"`,
      [data.id, data.email, data.password, data.name, data.role, data.companyId || null],
    );
    return rows[0];
  }

  async findUserByEmail(email: string): Promise<StoredUser | null> {
    return this.db.queryOne<StoredUser>(
      `SELECT id, email, password_hash AS password, name, role, company_id AS "companyId", token_version AS "tokenVersion", created_at AS "createdAt", updated_at AS "updatedAt"
       FROM users WHERE email = $1`,
      [email],
    );
  }

  async findUserById(id: string): Promise<StoredUser | null> {
    return this.db.queryOne<StoredUser>(
      `SELECT id, email, password_hash AS password, name, role, company_id AS "companyId", token_version AS "tokenVersion", created_at AS "createdAt", updated_at AS "updatedAt"
       FROM users WHERE id = $1`,
      [id],
    );
  }

  async findAllUsers(): Promise<StoredUser[]> {
    return this.db.query<StoredUser>(
      `SELECT id, email, password_hash AS password, name, role, company_id AS "companyId", token_version AS "tokenVersion", created_at AS "createdAt", updated_at AS "updatedAt"
       FROM users ORDER BY created_at DESC`,
    );
  }

  // Revoke all refresh tokens for a user by bumping the version counter.
  async revokeUserTokens(id: string): Promise<void> {
    await this.db.execute(
      `UPDATE users SET token_version = token_version + 1, updated_at = now() WHERE id = $1`,
      [id],
    );
  }

  async deleteUser(id: string): Promise<void> {
    await this.db.execute(`DELETE FROM users WHERE id = $1`, [id]);
  }

  async deleteAgentByUserId(userId: string): Promise<void> {
    await this.db.execute(`DELETE FROM agents WHERE user_id = $1`, [userId]);
  }

  async updatePassword(id: string, hashed: string): Promise<void> {
    await this.db.execute(
      `UPDATE users SET password_hash = $2, token_version = token_version + 1, updated_at = now() WHERE id = $1`,
      [id, hashed],
    );
  }

  // Password resets
  async createPasswordReset(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.db.execute(
      `INSERT INTO password_resets (id, user_id, token_hash, expires_at, used)
       VALUES ($1, $2, $3, $4, false)`,
      [crypto.randomUUID(), userId, tokenHash, expiresAt],
    );
  }

  async consumePasswordReset(tokenHash: string): Promise<StoredUser | null> {
    const row = await this.db.queryOne<{ userId: string }>(
      `SELECT user_id AS "userId" FROM password_resets
       WHERE token_hash = $1 AND used = false AND expires_at > now()
       ORDER BY created_at DESC LIMIT 1`,
      [tokenHash],
    );
    if (!row) return null;
    await this.db.execute(`UPDATE password_resets SET used = true WHERE token_hash = $1`, [tokenHash]);
    return this.findUserById(row.userId);
  }

  async updateUser(id: string, data: Partial<Pick<StoredUser, 'name' | 'email' | 'role' | 'password'>>): Promise<StoredUser | null> {    const sets: string[] = [];
    const params: any[] = [id];
    let i = 2;
    if (data.name !== undefined) { sets.push(`name = $${i++}`); params.push(data.name); }
    if (data.email !== undefined) { sets.push(`email = $${i++}`); params.push(data.email); }
    if (data.role !== undefined) { sets.push(`role = $${i++}`); params.push(data.role); }
    if (data.password !== undefined) { sets.push(`password_hash = $${i++}`); params.push(data.password); }
    if (sets.length === 0) return this.findUserById(id);
    sets.push('updated_at = now()');
    return this.db.queryOne<StoredUser>(
      `UPDATE users SET ${sets.join(', ')} WHERE id = $1
       RETURNING id, email, password_hash AS password, name, role, company_id AS "companyId", token_version AS "tokenVersion", created_at AS "createdAt", updated_at AS "updatedAt"`,
      params,
    );
  }

  // Companies
  async createCompany(data: Omit<StoredCompany, 'createdAt' | 'updatedAt'>): Promise<StoredCompany> {
    const rows = await this.db.query<StoredCompany>(
      `INSERT INTO companies (id, name, slug, plan, settings, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, now(), now())
       RETURNING id, name, slug, plan, settings, created_at AS "createdAt", updated_at AS "updatedAt"`,
      [data.id, data.name, data.slug, data.plan, JSON.stringify(data.settings || {})],
    );
    return rows[0];
  }

  async findCompanyById(id: string): Promise<StoredCompany | null> {
    return this.db.queryOne<StoredCompany>(
      `SELECT id, name, slug, plan, settings, created_at AS "createdAt", updated_at AS "updatedAt" FROM companies WHERE id = $1`,
      [id],
    );
  }

  async findCompanyBySlug(slug: string): Promise<StoredCompany | null> {
    return this.db.queryOne<StoredCompany>(
      `SELECT id, name, slug, plan, settings, created_at AS "createdAt", updated_at AS "updatedAt" FROM companies WHERE slug = $1`,
      [slug],
    );
  }

  async updateCompanySettings(id: string, settings: Record<string, any>): Promise<StoredCompany | null> {
    return this.db.queryOne<StoredCompany>(
      `UPDATE companies SET settings = settings || $2::jsonb, updated_at = now()
       WHERE id = $1
       RETURNING id, name, slug, plan, settings, created_at AS "createdAt", updated_at AS "updatedAt"`,
      [id, JSON.stringify(settings)],
    );
  }

  // Conversations
  async createConversation(data: Omit<StoredConversation, 'createdAt' | 'updatedAt' | 'lastMessage' | 'handledBy'>): Promise<StoredConversation> {
    const rows = await this.db.query<StoredConversation>(
      `INSERT INTO conversations (id, company_id, title, status, department, assigned_agent_id, lead_id, metadata, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, now(), now())
       RETURNING id, company_id AS "companyId", title, status, department, assigned_agent_id AS "assignedAgentId", lead_id AS "leadId", metadata, created_at AS "createdAt", updated_at AS "updatedAt"`,
      [
        data.id,
        data.companyId,
        data.title || 'New Conversation',
        data.status || 'active',
        data.department || null,
        data.assignedAgentId || null,
        data.leadId || null,
        JSON.stringify(data.metadata || {}),
      ],
    );
    return rows[0];
  }

  async findConversationById(id: string): Promise<StoredConversation | null> {
    return this.db.queryOne<StoredConversation>(
      `SELECT id, company_id AS "companyId", title, status, department, assigned_agent_id AS "assignedAgentId", lead_id AS "leadId", metadata, created_at AS "createdAt", updated_at AS "updatedAt"
       FROM conversations WHERE id = $1`,
      [id],
    );
  }

  async findConversationsByCompany(companyId: string, status?: string, page = 1, limit = 50) {
    const offset = (page - 1) * limit;
    const where: string[] = [`c.company_id = $1`];
    const params: any[] = [companyId];
    if (status) {
      params.push(status);
      where.push(`c.status = $${params.length}`);
    }
    const countRow = await this.db.queryOne<{ count: number }>(
      `SELECT count(*)::int AS count FROM conversations c WHERE ${where.join(' AND ')}`,
      params,
    );
    const limitIdx = params.length + 1;
    const offsetIdx = params.length + 2;
    const rows = await this.db.query<StoredConversation>(
      `SELECT c.id, c.company_id AS "companyId", c.title, c.status, c.department, c.assigned_agent_id AS "assignedAgentId",
              c.lead_id AS "leadId", c.metadata, c.created_at AS "createdAt", c.updated_at AS "updatedAt",
              lm.content AS "lastMessage",
              (SELECT string_agg(DISTINCT m.sender_type, ',') FROM messages m WHERE m.conversation_id = c.id) AS sender_types
       FROM conversations c
       LEFT JOIN LATERAL (SELECT content FROM messages m WHERE m.conversation_id = c.id ORDER BY created_at DESC LIMIT 1) lm ON true
       WHERE ${where.join(' AND ')}
       ORDER BY c.updated_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      [...params, limit, offset],
    );
    const items = rows.map((r: any) => ({
      ...r,
      handledBy: r.sender_types
        ? r.sender_types.split(',').includes('agent')
          ? 'agent'
          : r.sender_types.split(',').includes('ai')
            ? 'ai'
            : 'none'
        : 'none',
    }));
    return { items, total: countRow?.count ?? 0, page, perPage: limit };
  }

  async updateConversation(id: string, data: Partial<StoredConversation>): Promise<StoredConversation | null> {
    const sets: string[] = ['updated_at = now()'];
    const params: any[] = [id];
    let i = 2;
    if (data.title !== undefined) { sets.push(`title = $${i++}`); params.push(data.title); }
    if (data.status !== undefined) { sets.push(`status = $${i++}`); params.push(data.status); }
    if (data.department !== undefined) { sets.push(`department = $${i++}`); params.push(data.department); }
    if (data.assignedAgentId !== undefined) { sets.push(`assigned_agent_id = $${i++}`); params.push(data.assignedAgentId); }
    if (data.leadId !== undefined) { sets.push(`lead_id = $${i++}`); params.push(data.leadId); }
    if (data.metadata !== undefined) { sets.push(`metadata = $${i++}::jsonb`); params.push(JSON.stringify(data.metadata)); }
    return this.db.queryOne<StoredConversation>(
      `UPDATE conversations SET ${sets.join(', ')} WHERE id = $1
       RETURNING id, company_id AS "companyId", title, status, department, assigned_agent_id AS "assignedAgentId", lead_id AS "leadId", metadata, created_at AS "createdAt", updated_at AS "updatedAt"`,
      params,
    );
  }

  // Messages
  async createMessage(data: Omit<StoredMessage, 'createdAt'>): Promise<StoredMessage> {
    const rows = await this.db.query<StoredMessage>(
      `INSERT INTO messages (id, conversation_id, sender_id, sender_type, content, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, now())
       RETURNING id, conversation_id AS "conversationId", sender_id AS "senderId", sender_type AS "senderType", content, metadata, created_at AS "createdAt"`,
      [data.id, data.conversationId, data.senderId || null, data.senderType, data.content, JSON.stringify((data as any).metadata || {})],
    );
    await this.db.execute(`UPDATE conversations SET updated_at = now() WHERE id = $1`, [data.conversationId]);
    return rows[0];
  }

  async findMessagesByConversation(conversationId: string): Promise<StoredMessage[]> {
    return this.db.query<StoredMessage>(
      `SELECT id, conversation_id AS "conversationId", sender_id AS "senderId", sender_type AS "senderType", content, metadata, created_at AS "createdAt"
       FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC`,
      [conversationId],
    );
  }

  // Agents
  async createAgent(data: Omit<StoredAgent, 'createdAt' | 'updatedAt'>): Promise<StoredAgent> {
    const rows = await this.db.query<StoredAgent>(
      `INSERT INTO agents (id, user_id, company_id, is_online, created_at, updated_at)
       VALUES ($1, $2, $3, $4, now(), now())
       RETURNING id, user_id AS "userId", company_id AS "companyId", is_online AS "isOnline", created_at AS "createdAt", updated_at AS "updatedAt"`,
      [data.id, data.userId, data.companyId, data.isOnline],
    );
    return rows[0];
  }

  async findAgentByUserId(userId: string): Promise<StoredAgent | null> {
    return this.db.queryOne<StoredAgent>(
      `SELECT id, user_id AS "userId", company_id AS "companyId", is_online AS "isOnline", created_at AS "createdAt", updated_at AS "updatedAt"
       FROM agents WHERE user_id = $1`,
      [userId],
    );
  }

  async findAgentsByCompany(companyId: string): Promise<StoredAgent[]> {
    return this.db.query<StoredAgent>(
      `SELECT id, user_id AS "userId", company_id AS "companyId", is_online AS "isOnline", created_at AS "createdAt", updated_at AS "updatedAt"
       FROM agents WHERE company_id = $1`,
      [companyId],
    );
  }

  async updateAgent(id: string, data: Partial<StoredAgent>): Promise<StoredAgent | null> {
    const sets: string[] = ['updated_at = now()'];
    const params: any[] = [id];
    let i = 2;
    if (data.isOnline !== undefined) { sets.push(`is_online = $${i++}`); params.push(data.isOnline); }
    return this.db.queryOne<StoredAgent>(
      `UPDATE agents SET ${sets.join(', ')} WHERE id = $1
       RETURNING id, user_id AS "userId", company_id AS "companyId", is_online AS "isOnline", created_at AS "createdAt", updated_at AS "updatedAt"`,
      params,
    );
  }

  // Knowledge Base
  async createDocument(data: Omit<StoredDocument, 'createdAt' | 'updatedAt'>): Promise<StoredDocument> {
    const rows = await this.db.query<StoredDocument>(
      `INSERT INTO knowledge_documents (id, company_id, title, content, chunks, filename, mime, size_bytes, file, page_count, status, summary, published, error, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5::text[], $6, $7, $8, $9, $10, $11, $12, $13, $14, now(), now())
       RETURNING id, company_id AS "companyId", title, content, chunks, filename, mime, size_bytes AS "sizeBytes", page_count AS "pageCount", status, summary, published, error, created_at AS "createdAt", updated_at AS "updatedAt"`,
      [
        data.id,
        data.companyId,
        data.title,
        data.content,
        data.chunks,
        data.filename || null,
        data.mime || null,
        data.sizeBytes,
        data.file || null,
        data.pageCount,
        data.status,
        data.summary || null,
        data.published,
        data.error || null,
      ],
    );
    return rows[0];
  }

  async findDocumentById(id: string): Promise<StoredDocument | null> {
    return this.db.queryOne<StoredDocument>(
      `SELECT id, company_id AS "companyId", title, content, chunks, filename, mime, size_bytes AS "sizeBytes", file, page_count AS "pageCount", status, summary, published, error, created_at AS "createdAt", updated_at AS "updatedAt"
       FROM knowledge_documents WHERE id = $1`,
      [id],
    );
  }

  async findDocumentsByCompany(companyId: string): Promise<StoredDocument[]> {
    return this.db.query<StoredDocument>(
      `SELECT id, company_id AS "companyId", title, content, chunks, filename, mime, size_bytes AS "sizeBytes", page_count AS "pageCount", status, summary, published, error, created_at AS "createdAt", updated_at AS "updatedAt"
       FROM knowledge_documents WHERE company_id = $1 ORDER BY created_at DESC`,
      [companyId],
    );
  }

  async findDocumentsByCompanyPaged(companyId: string, page = 1, limit = 50) {
    const offset = (page - 1) * limit;
    const countRow = await this.db.queryOne<{ count: number }>(
      `SELECT count(*)::int AS count FROM knowledge_documents WHERE company_id = $1`,
      [companyId],
    );
    const rows = await this.db.query<StoredDocument>(
      `SELECT id, company_id AS "companyId", title, content, chunks, filename, mime, size_bytes AS "sizeBytes", page_count AS "pageCount", status, summary, published, error, created_at AS "createdAt", updated_at AS "updatedAt"
       FROM knowledge_documents WHERE company_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [companyId, limit, offset],
    );
    return { items: rows, total: countRow?.count ?? 0, page, perPage: limit };
  }

  async findPublishedDocuments(companyId: string): Promise<StoredDocument[]> {
    return this.db.query<StoredDocument>(
      `SELECT id, company_id AS "companyId", title, content, chunks, filename, mime, size_bytes AS "sizeBytes", page_count AS "pageCount", status, summary, published, error, created_at AS "createdAt", updated_at AS "updatedAt"
       FROM knowledge_documents WHERE company_id = $1 AND published = true ORDER BY created_at DESC`,
      [companyId],
    );
  }

  async updateDocument(id: string, data: Partial<StoredDocument>): Promise<StoredDocument | null> {
    const sets: string[] = ['updated_at = now()'];
    const params: any[] = [id];
    let i = 2;
    const fields: Record<string, string> = {
      title: 'title',
      content: 'content',
      pageCount: 'page_count',
      status: 'status',
      summary: 'summary',
      published: 'published',
      error: 'error',
    };
    const dataAny = data as Record<string, any>;
    for (const [key, col] of Object.entries(fields)) {
      if (dataAny[key] !== undefined) {
        sets.push(`${col} = $${i++}`);
        params.push(dataAny[key]);
      }
    }
    return this.db.queryOne<StoredDocument>(
      `UPDATE knowledge_documents SET ${sets.join(', ')} WHERE id = $1
       RETURNING id, company_id AS "companyId", title, content, chunks, filename, mime, size_bytes AS "sizeBytes", page_count AS "pageCount", status, summary, published, error, created_at AS "createdAt", updated_at AS "updatedAt"`,
      params,
    );
  }

  async countDocumentsByCompany(companyId: string): Promise<number> {
    const row = await this.db.queryOne<{ count: number }>(
      `SELECT count(*)::int AS count FROM knowledge_documents WHERE company_id = $1`,
      [companyId],
    );
    return row?.count ?? 0;
  }

  async deleteDocument(id: string): Promise<void> {
    await this.db.execute(`DELETE FROM knowledge_documents WHERE id = $1`, [id]);
  }

  async insertChunk(data: { id: string; documentId: string; companyId: string; chunkIndex: number; chunkText: string; embedding: number[] }): Promise<void> {
    await this.db.execute(
      `INSERT INTO knowledge_chunks (id, document_id, company_id, chunk_index, chunk_text, embedding, created_at)
       VALUES ($1, $2, $3, $4, $5, $6::vector, now())`,
      [data.id, data.documentId, data.companyId, data.chunkIndex, data.chunkText, JSON.stringify(data.embedding)],
    );
  }

  async deleteChunksByDocument(documentId: string): Promise<void> {
    await this.db.execute(`DELETE FROM knowledge_chunks WHERE document_id = $1`, [documentId]);
  }

  async countChunks(companyId: string): Promise<number> {
    const row = await this.db.queryOne(
      `SELECT count(*)::int AS count FROM knowledge_chunks WHERE company_id = $1`,
      [companyId],
    );
    return row?.count ?? 0;
  }

  async searchChunks(companyId: string, embedding: number[], limit = 5, threshold = 0.35) {
    return this.db.query<{ id: string; chunkText: string; documentId: string; similarity: number }>(
      `SELECT kc.id, kc.chunk_text AS "chunkText", kc.document_id AS "documentId",
              ROUND((1 - (kc.embedding <=> $2::vector))::numeric, 4) AS similarity
       FROM knowledge_chunks kc
       JOIN knowledge_documents kd ON kd.id = kc.document_id
       WHERE kc.company_id = $1 AND kc.embedding IS NOT NULL AND kd.published = true
         AND (1 - (kc.embedding <=> $2::vector)) >= $3
       ORDER BY kc.embedding <=> $2::vector
       LIMIT $4`,
      [companyId, JSON.stringify(embedding), threshold, limit],
    );
  }

  async searchChunksByDocument(documentId: string, embedding: number[], limit = 5, threshold = 0.25) {
    return this.db.query<{ id: string; chunkText: string; documentId: string; similarity: number }>(
      `SELECT id, chunk_text AS "chunkText", document_id AS "documentId",
              ROUND((1 - (embedding <=> $2::vector))::numeric, 4) AS similarity
       FROM knowledge_chunks
       WHERE document_id = $1 AND embedding IS NOT NULL
         AND (1 - (embedding <=> $2::vector)) >= $3
       ORDER BY embedding <=> $2::vector
       LIMIT $4`,
      [documentId, JSON.stringify(embedding), threshold, limit],
    );
  }

  async searchChunksByDocumentKeyword(documentId: string, terms: string[], limit = 5) {
    if (!terms.length) return [];
    const params: any[] = [documentId];
    const conds = terms.map((_, i) => {
      params.push(`%${terms[i]}%`);
      return `kc.chunk_text ILIKE $${i + 2}`;
    });
    const rank = terms.map((_, i) => `(kc.chunk_text ILIKE $${i + 2})::int`);
    return this.db.query<{ id: string; chunkText: string; documentId: string; similarity: number }>(
      `SELECT kc.id, kc.chunk_text AS "chunkText", kc.document_id AS "documentId", 1 AS similarity
       FROM knowledge_chunks kc
       WHERE kc.document_id = $1 AND (${conds.join(' OR ')})
       ORDER BY (${rank.join(' + ')}) DESC, kc.chunk_index ASC
       LIMIT $${params.length + 1}`,
      [...params, limit],
    );
  }

  async searchChunksPublished(companyId: string, embedding: number[], limit = 6, threshold = 0.25) {
    return this.db.query<{ id: string; chunkText: string; documentId: string; documentTitle: string; similarity: number }>(
      `SELECT kc.id, kc.chunk_text AS "chunkText", kc.document_id AS "documentId", kd.title AS "documentTitle",
              ROUND((1 - (kc.embedding <=> $2::vector))::numeric, 4) AS similarity
       FROM knowledge_chunks kc
       JOIN knowledge_documents kd ON kd.id = kc.document_id
       WHERE kc.company_id = $1 AND kc.embedding IS NOT NULL AND kd.published = true
         AND (1 - (kc.embedding <=> $2::vector)) >= $3
       ORDER BY kc.embedding <=> $2::vector
       LIMIT $4`,
      [companyId, JSON.stringify(embedding), threshold, limit],
    );
  }

  async searchChunksPublishedKeyword(companyId: string, terms: string[], limit = 6) {
    if (!terms.length) return [];
    const params: any[] = [companyId];
    const conds = terms.map((_, i) => {
      params.push(`%${terms[i]}%`);
      return `kc.chunk_text ILIKE $${i + 2}`;
    });
    const rank = terms.map((_, i) => `(kc.chunk_text ILIKE $${i + 2})::int`);
    return this.db.query<{ id: string; chunkText: string; documentId: string; documentTitle: string; similarity: number }>(
      `SELECT kc.id, kc.chunk_text AS "chunkText", kc.document_id AS "documentId", kd.title AS "documentTitle", 1 AS similarity
       FROM knowledge_chunks kc
       JOIN knowledge_documents kd ON kd.id = kc.document_id
       WHERE kc.company_id = $1 AND kd.published = true AND (${conds.join(' OR ')})
       ORDER BY (${rank.join(' + ')}) DESC, kc.chunk_index ASC
       LIMIT $${params.length + 1}`,
      [...params, limit],
    );
  }

  async searchChunksFull(companyId: string, embedding: number[], limit = 10) {
    return this.db.query<{ id: string; chunkText: string; documentTitle: string; similarity: number }>(
      `SELECT kc.id, kc.chunk_text AS "chunkText", kd.title AS "documentTitle",
               ROUND((1 - (kc.embedding <=> $2::vector))::numeric, 4) AS similarity
       FROM knowledge_chunks kc
       JOIN knowledge_documents kd ON kd.id = kc.document_id
       WHERE kc.company_id = $1 AND kc.embedding IS NOT NULL AND kd.published = true
       ORDER BY kc.embedding <=> $2::vector
       LIMIT $3`,
      [companyId, JSON.stringify(embedding), limit],
    );
  }

  // Leads
  async createLead(data: Omit<StoredLead, 'createdAt' | 'updatedAt'>): Promise<StoredLead> {
    const rows = await this.db.query<StoredLead>(
      `INSERT INTO leads (id, company_id, conversation_id, name, email, phone, message, source, status, department, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now(), now())
       RETURNING id, company_id AS "companyId", conversation_id AS "conversationId", name, email, phone, message, source, status, department, created_at AS "createdAt", updated_at AS "updatedAt"`,
      [data.id, data.companyId, data.conversationId || null, data.name || null, data.email || null, data.phone || null, data.message || null, data.source || 'chat', data.status || 'new', data.department || null],
    );
    return rows[0];
  }

  async findLeadByConversation(conversationId: string): Promise<StoredLead | null> {
    return this.db.queryOne<StoredLead>(
      `SELECT id, company_id AS "companyId", conversation_id AS "conversationId", name, email, phone, message, source, status, department, created_at AS "createdAt", updated_at AS "updatedAt"
       FROM leads WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [conversationId],
    );
  }

  async findLeadById(id: string): Promise<StoredLead | null> {
    return this.db.queryOne<StoredLead>(
      `SELECT id, company_id AS "companyId", conversation_id AS "conversationId", name, email, phone, message, source, status, department, created_at AS "createdAt", updated_at AS "updatedAt"
       FROM leads WHERE id = $1`,
      [id],
    );
  }

  async findLeadsByCompany(companyId: string, page = 1, limit = 50) {
    const offset = (page - 1) * limit;
    const countRow = await this.db.queryOne<{ count: number }>(
      `SELECT count(*)::int AS count FROM leads WHERE company_id = $1`,
      [companyId],
    );
    const rows = await this.db.query<StoredLead>(
      `SELECT id, company_id AS "companyId", conversation_id AS "conversationId", name, email, phone, message, source, status, department, created_at AS "createdAt", updated_at AS "updatedAt"
       FROM leads WHERE company_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [companyId, limit, offset],
    );
    return { items: rows, total: countRow?.count ?? 0, page, perPage: limit };
  }

  async updateLead(id: string, data: Partial<StoredLead>): Promise<StoredLead | null> {
    const sets: string[] = ['updated_at = now()'];
    const params: any[] = [id];
    let i = 2;
    const fields: Record<string, any> = {
      name: 'name',
      email: 'email',
      phone: 'phone',
      message: 'message',
      source: 'source',
      status: 'status',
      department: 'department',
      conversationId: 'conversation_id',
    };
    const dataAny = data as Record<string, any>;
    for (const [key, col] of Object.entries(fields)) {
      if (dataAny[key] !== undefined) { sets.push(`${col} = $${i++}`); params.push(dataAny[key]); }
    }
    return this.db.queryOne<StoredLead>(
      `UPDATE leads SET ${sets.join(', ')} WHERE id = $1
       RETURNING id, company_id AS "companyId", conversation_id AS "conversationId", name, email, phone, message, source, status, department, created_at AS "createdAt", updated_at AS "updatedAt"`,
      params,
    );
  }

  async countLeads(companyId: string): Promise<number> {
    const row = await this.db.queryOne(`SELECT count(*)::int AS count FROM leads WHERE company_id = $1`, [companyId]);
    return row?.count ?? 0;
  }

  // Appointments
  async createAppointment(data: Omit<StoredAppointment, 'createdAt' | 'updatedAt'>): Promise<StoredAppointment> {
    const rows = await this.db.query<StoredAppointment>(
      `INSERT INTO appointments (id, company_id, conversation_id, lead_id, customer_name, customer_email, title, notes, start_time, end_time, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now(), now())
       RETURNING id, company_id AS "companyId", conversation_id AS "conversationId", lead_id AS "leadId", customer_name AS "customerName", customer_email AS "customerEmail", title, notes, start_time AS "startTime", end_time AS "endTime", status, created_at AS "createdAt", updated_at AS "updatedAt"`,
      [data.id, data.companyId, data.conversationId || null, data.leadId || null, data.customerName || null, data.customerEmail || null, data.title || null, data.notes || null, data.startTime, data.endTime, data.status || 'requested'],
    );
    return rows[0];
  }

  async findAppointmentsByCompany(companyId: string, page = 1, limit = 50) {
    const offset = (page - 1) * limit;
    const countRow = await this.db.queryOne<{ count: number }>(
      `SELECT count(*)::int AS count FROM appointments WHERE company_id = $1`,
      [companyId],
    );
    const rows = await this.db.query<StoredAppointment>(
      `SELECT id, company_id AS "companyId", conversation_id AS "conversationId", lead_id AS "leadId", customer_name AS "customerName", customer_email AS "customerEmail", title, notes, start_time AS "startTime", end_time AS "endTime", status, created_at AS "createdAt", updated_at AS "updatedAt"
       FROM appointments WHERE company_id = $1 ORDER BY start_time ASC LIMIT $2 OFFSET $3`,
      [companyId, limit, offset],
    );
    return { items: rows, total: countRow?.count ?? 0, page, perPage: limit };
  }

  async findAppointmentById(id: string): Promise<StoredAppointment | null> {
    return this.db.queryOne<StoredAppointment>(
      `SELECT id, company_id AS "companyId", conversation_id AS "conversationId", lead_id AS "leadId", customer_name AS "customerName", customer_email AS "customerEmail", title, notes, start_time AS "startTime", end_time AS "endTime", status, created_at AS "createdAt", updated_at AS "updatedAt"
       FROM appointments WHERE id = $1`,
      [id],
    );
  }

  async updateAppointment(id: string, data: Partial<StoredAppointment>): Promise<StoredAppointment | null> {
    const sets: string[] = ['updated_at = now()'];
    const params: any[] = [id];
    let i = 2;
    const fields: Record<string, any> = {
      customerName: 'customer_name',
      customerEmail: 'customer_email',
      title: 'title',
      notes: 'notes',
      startTime: 'start_time',
      endTime: 'end_time',
      status: 'status',
      leadId: 'lead_id',
    };
    const dataAny = data as Record<string, any>;
    for (const [key, col] of Object.entries(fields)) {
      if (dataAny[key] !== undefined) { sets.push(`${col} = $${i++}`); params.push(dataAny[key]); }
    }
    return this.db.queryOne<StoredAppointment>(
      `UPDATE appointments SET ${sets.join(', ')} WHERE id = $1
       RETURNING id, company_id AS "companyId", conversation_id AS "conversationId", lead_id AS "leadId", customer_name AS "customerName", customer_email AS "customerEmail", title, notes, start_time AS "startTime", end_time AS "endTime", status, created_at AS "createdAt", updated_at AS "updatedAt"`,
      params,
    );
  }

  async countAppointments(companyId: string): Promise<number> {
    const row = await this.db.queryOne(`SELECT count(*)::int AS count FROM appointments WHERE company_id = $1`, [companyId]);
    return row?.count ?? 0;
  }

  // Departments
  async listDepartments(companyId: string): Promise<StoredDepartment[]> {
    return this.db.query<StoredDepartment>(
      `SELECT id, company_id AS "companyId", name, description, keywords, email, created_at AS "createdAt"
       FROM departments WHERE company_id = $1 ORDER BY created_at ASC`,
      [companyId],
    );
  }

  async createDepartment(data: Omit<StoredDepartment, 'id' | 'createdAt'>): Promise<StoredDepartment> {
    const rows = await this.db.query<StoredDepartment>(
      `INSERT INTO departments (id, company_id, name, description, keywords, email, created_at)
       VALUES ($1, $2, $3, $4, $5::text[], $6, now())
       RETURNING id, company_id AS "companyId", name, description, keywords, email, created_at AS "createdAt"`,
      [crypto.randomUUID(), data.companyId, data.name, data.description || null, data.keywords || [], data.email || null],
    );
    return rows[0];
  }

  async updateDepartment(id: string, data: Partial<StoredDepartment>): Promise<StoredDepartment | null> {
    const sets: string[] = [];
    const params: any[] = [id];
    let i = 2;
    if (data.name !== undefined) { sets.push(`name = $${i++}`); params.push(data.name); }
    if (data.description !== undefined) { sets.push(`description = $${i++}`); params.push(data.description); }
    if (data.keywords !== undefined) { sets.push(`keywords = $${i++}::text[]`); params.push(data.keywords); }
    if (data.email !== undefined) { sets.push(`email = $${i++}`); params.push(data.email); }
    if (sets.length === 0) return null;
    return this.db.queryOne<StoredDepartment>(
      `UPDATE departments SET ${sets.join(', ')} WHERE id = $1
       RETURNING id, company_id AS "companyId", name, description, keywords, email, created_at AS "createdAt"`,
      params,
    );
  }

  async deleteDepartment(id: string): Promise<void> {
    await this.db.execute(`DELETE FROM departments WHERE id = $1`, [id]);
  }

  async findDepartmentById(id: string): Promise<StoredDepartment | null> {
    return this.db.queryOne<StoredDepartment>(
      `SELECT id, company_id AS "companyId", name, description, keywords, email, created_at AS "createdAt"
       FROM departments WHERE id = $1`,
      [id],
    );
  }

  async findAgentById(id: string): Promise<StoredAgent | null> {
    return this.db.queryOne<StoredAgent>(
      `SELECT id, user_id AS "userId", company_id AS "companyId", is_online AS "isOnline", created_at AS "createdAt", updated_at AS "updatedAt"
       FROM agents WHERE id = $1`,
      [id],
    );
  }
}
