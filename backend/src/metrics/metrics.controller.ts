import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { StoreService } from '../common/store.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

type ModelPrice = { prompt: number; completion: number };

/**
 * Optional price table in USD per 1M tokens:
 *   LLM_PRICE_TABLE='{"google/gemini-2.5-flash":{"prompt":0.3,"completion":2.5}}'
 * Fallbacks for a single model:
 *   LLM_PRICE_PROMPT_PER_1M=0.3, LLM_PRICE_COMPLETION_PER_1M=2.5
 */
function priceFor(model: string): ModelPrice | null {
  const raw = process.env.LLM_PRICE_TABLE;
  if (raw) {
    try {
      const table = JSON.parse(raw) as Record<string, Partial<ModelPrice>>;
      const hit = table[model];
      if (hit && typeof hit.prompt === 'number' && typeof hit.completion === 'number') {
        return { prompt: hit.prompt, completion: hit.completion };
      }
    } catch {
      /* malformed price table -> fall through to the scalar env vars */
    }
  }
  const prompt = Number(process.env.LLM_PRICE_PROMPT_PER_1M);
  const completion = Number(process.env.LLM_PRICE_COMPLETION_PER_1M);
  if (Number.isFinite(prompt) && Number.isFinite(completion)) {
    return { prompt, completion };
  }
  return null;
}

function costUsd(model: string, promptTokens: number, completionTokens: number): number | null {
  const price = priceFor(model);
  if (!price) return null;
  return (promptTokens / 1_000_000) * price.prompt + (completionTokens / 1_000_000) * price.completion;
}

@Controller('metrics')
@UseGuards(JwtAuthGuard)
export class MetricsController {
  constructor(private store: StoreService) {}

  /** LLM usage, latency, cost and retrieval-mode mix. */
  @Get('ai')
  async ai(@Req() req: any, @Query('hours') hours?: string) {
    const windowHours = Math.min(Math.max(Number(hours) || 24, 1), 24 * 30);
    const companyId = req.user?.companyId || null;
    const { totals, byModel, byFeature, retrieval } = await this.store.aiUsageMetrics(companyId, windowHours);

    const models = (byModel || []).map((m) => ({
      ...m,
      estimatedCostUsd: costUsd(m.model, Number(m.promptTokens), Number(m.completionTokens)),
    }));
    const pricedModels = models.filter((m) => m.estimatedCostUsd !== null);
    const estimatedCostUsd = pricedModels.length
      ? pricedModels.reduce((sum, m) => sum + (m.estimatedCostUsd || 0), 0)
      : null;

    const retrievalRows = retrieval || [];
    const retrievalCalls = retrievalRows.reduce((sum, r) => sum + Number(r.calls), 0);
    const degradedCalls = retrievalRows
      .filter((r) => r.mode !== 'vector')
      .reduce((sum, r) => sum + Number(r.calls), 0);

    return {
      windowHours,
      companyId,
      totals: {
        requests: Number(totals?.requests || 0),
        errors: Number(totals?.failures || 0),
        promptTokens: Number(totals?.promptTokens || 0),
        completionTokens: Number(totals?.completionTokens || 0),
        totalTokens: Number(totals?.totalTokens || 0),
        avgLatencyMs: Number(totals?.avgLatencyMs || 0),
        p95LatencyMs: Number(totals?.p95LatencyMs || 0),
        estimatedCostUsd,
      },
      byModel: models,
      byFeature: byFeature || [],
      retrieval: {
        calls: retrievalCalls,
        degradedCalls,
        degradedShare: retrievalCalls ? Math.round((degradedCalls / retrievalCalls) * 1000) / 1000 : 0,
        byMode: retrievalRows,
      },
    };
  }
}
