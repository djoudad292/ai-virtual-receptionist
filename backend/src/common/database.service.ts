import { Injectable, Logger } from '@nestjs/common';
import { Pool } from 'pg';

const SCHEMA_STATEMENTS: string[] = [
  `CREATE EXTENSION IF NOT EXISTS vector`,
  `CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE,
    plan TEXT DEFAULT 'free',
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT,
    role TEXT NOT NULL DEFAULT 'AGENT',
    company_id TEXT REFERENCES companies(id) ON DELETE CASCADE,
    token_version INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  )`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INT DEFAULT 0`,
  `CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    is_online BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    title TEXT DEFAULT 'New Conversation',
    status TEXT DEFAULT 'active',
    department TEXT,
    assigned_agent_id TEXT,
    lead_id TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id TEXT,
    sender_type TEXT NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS knowledge_documents (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    chunks TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  )`,
  `ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS filename TEXT`,
  `ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS mime TEXT`,
  `ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS size_bytes INT DEFAULT 0`,
  `ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS file BYTEA`,
  `ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS page_count INT DEFAULT 0`,
  `ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ready'`,
  `ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS summary TEXT`,
  `ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS published BOOLEAN DEFAULT true`,
  `ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS error TEXT`,
  `CREATE TABLE IF NOT EXISTS knowledge_chunks (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
    company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    chunk_index INT NOT NULL,
    chunk_text TEXT NOT NULL,
    embedding vector(1536),
    created_at TIMESTAMPTZ DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_company ON knowledge_chunks(company_id)`,
  `CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_document ON knowledge_chunks(document_id)`,
  `CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id)`,
  `CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    conversation_id TEXT,
    name TEXT,
    email TEXT,
    phone TEXT,
    message TEXT,
    source TEXT DEFAULT 'chat',
    status TEXT DEFAULT 'new',
    department TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS appointments (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    conversation_id TEXT,
    lead_id TEXT,
    customer_name TEXT,
    customer_email TEXT,
    title TEXT,
    notes TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'requested',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS departments (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    keywords TEXT[] DEFAULT '{}',
    email TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS password_resets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token_hash)`,
];

const HNSW_INDEX_STATEMENT = `CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_idx ON knowledge_chunks USING hnsw (embedding vector_cosine_ops)`;

@Injectable()
export class DatabaseService {
  private readonly logger = new Logger(DatabaseService.name);
  private pool: Pool;
  private initialized = false;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30000,
    });
    this.pool.on('error', (err) => {
      this.logger.error('Unexpected pg pool error', err.message);
    });
  }

  async initialize() {
    if (this.initialized) return;
    await this.pool.query('SELECT 1');
    for (const stmt of SCHEMA_STATEMENTS) {
      try {
        await this.pool.query(stmt);
      } catch (err) {
        this.logger.warn(`Schema statement failed (continuing): ${(err as Error).message}`);
      }
    }
    try {
      await this.pool.query(HNSW_INDEX_STATEMENT);
    } catch (err) {
      this.logger.warn(`HNSW index skipped (falling back to exact search): ${(err as Error).message}`);
    }
    this.initialized = true;
    this.logger.log('Database schema ready');
  }

  getPool(): Pool {
    return this.pool;
  }

  async query<T extends Record<string, any> = any>(text: string, params?: any[]): Promise<T[]> {
    const result = await this.pool.query(text, params);
    return result.rows as T[];
  }

  async queryOne<T extends Record<string, any> = any>(text: string, params?: any[]): Promise<T | null> {
    const rows = await this.query<T>(text, params);
    return rows[0] ?? null;
  }

  async execute(text: string, params?: any[]): Promise<void> {
    await this.pool.query(text, params);
  }
}
