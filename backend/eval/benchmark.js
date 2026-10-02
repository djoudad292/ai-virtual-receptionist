'use strict';
/**
 * Offline retrieval goldset benchmark.
 *
 * Ports the goldset/eval pattern from tools/client-hunter/eval: a hand-labelled
 * goldset, a threshold sweep, precision/recall/F1/FPR/FNR, a best-threshold
 * report, and a non-zero exit when quality drops below a floor.
 *
 * Fully hermetic: no network, no database, no API key. The production
 * embedding call is stubbed with a deterministic offline embedder
 * (concept lens + hashed lexical residual) so the run is reproducible in CI.
 *
 * What this measures: the retrieval POLICY — the similarity floor, the top-k
 * cut, and the vector-vs-keyword choice. Production uses text-embedding-3-small
 * (or degrades to keyword matching), so absolute numbers here are a regression
 * guard for the harness and the threshold, not a benchmark of the embedder.
 *
 * Usage:  npm run eval            # floor: F1 >= 0.70
 *         EVAL_MIN_F1=0.8 npm run eval
 *         EVAL_TOP_K=3 npm run eval
 */

const fs = require('fs');
const path = require('path');

const GOLDSET_PATH = path.join(__dirname, 'goldset.json');
const THRESHOLDS = [0.2, 0.3, 0.35, 0.4, 0.5, 0.6];
const TOP_K = Number(process.env.EVAL_TOP_K) || 5;
const MIN_F1 = process.env.EVAL_MIN_F1 === undefined ? 0.7 : Number(process.env.EVAL_MIN_F1);

// ---------------------------------------------------------------------------
// Deterministic offline embedder (stands in for text-embedding-3-small).
// Dimensions: one per concept in the lexicon below, plus hashed lexical dims.
// ---------------------------------------------------------------------------

const CONCEPT_LEXICON = {
  hours: ['hour', 'open', 'opening', 'close', 'closed', 'sunday', 'saturday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'weekend', 'holiday', 'early', 'late', 'morning', 'evening', '9am', '5pm', '2pm', '8:30am', 'last'],
  scheduling: ['appointment', 'appointments', 'booking', 'book', 'schedule', 'slot', 'slots', 'visit', 'confirm', 'confirmed', 'request', 'requested', 'arrive', 'paperwork'],
  reschedule: ['reschedule', 'cancel', 'cancellation', 'cancelled', 'move', 'change', 'different', 'another', 'fee', 'charge', 'penalty', 'no-show', 'noshow', 'late', '24'],
  location: ['clinic', 'office', 'street', 'address', 'map', 'directions', 'location', 'visit', 'building', 'entrance', 'bell', 'avenue'],
  parking: ['parking', 'park', 'garage', 'metered', 'meter', 'car', 'drive', 'street'],
  accessibility: ['accessible', 'accessibility', 'wheelchair', 'ramp', 'elevator', 'disabled', 'handicap'],
  insurance: ['insurance', 'insured', 'network', 'delta', 'cigna', 'metlife', 'coverage', 'covered', 'provider', 'estimate'],
  payment: ['pay', 'payment', 'copay', 'copays', 'card', 'visa', 'mastercard', 'american', 'express', 'cash', 'hsa', 'fsa', 'cost', 'costs', 'price', 'prices', 'billing', 'out', 'front'],
  services: ['cleaning', 'cleaning', 'fillings', 'filling', 'crown', 'crowns', 'root', 'canal', 'extraction', 'extractions', 'implant', 'implants', 'whitening', 'services', 'service', 'x-rays', 'xray', 'xrays'],
  emergency: ['emergency', 'pain', 'ache', 'hurting', 'killing', 'severe', 'swelling', 'broken', 'injury', 'urgent', 'urgently', 'on-call', '911', 'breathing', 'swallowing', 'same-day'],
  whitening: ['whitening', 'whiter', 'white', 'teeth', 'shades', 'trays', 'gel', 'bleach', '90', 'minutes', 'weeks'],
  child: ['child', 'children', 'son', 'daughter', 'kid', 'kids', 'parent', 'guardian', 'consent', 'sticker', 'age', 'three', '18', 'orientation', 'counting', 'calm'],
  technology: ['digital', 'film', 'radiation', 'screen', 'seconds', 'camera', 'cameras', 'monitor', 'encrypted', 'records', 'secure', 'image', 'images'],
  privacy: ['privacy', 'hipaa', 'records', 'record', 'released', 'release', 'authorized', 'authorised', 'identification', 'copies', 'history', 'histories', 'archived', 'data', 'confidential'],
  transfer: ['transfer', 'transferring', 'new', 'dentist', 'written', 'signed', 'release', 'receiving', 'practice', 'drive', 'portable'],
  contact: ['phone', 'telephone', 'call', 'number', 'email', 'voicemail', 'message', 'messages', 'fax', 'reply', 'reach', 'front', 'desk', 'reception'],
  morning: ['morning', 'first', 'earliest', 'earlier', 'arrive', 'fit', 'come', '8:30am'],
  cosmetic: ['cosmetic', 'veneers', 'veneer', 'consultation', 'consultations', 'quote', 'quotes', 'photographs', 'plan', 'treatment'],
};

const LEXICAL_DIMS = 512;
const LEXICAL_WEIGHT = 0.35;
const STOPWORDS = new Set([
  'this', 'that', 'with', 'from', 'have', 'what', 'when', 'where', 'which', 'who', 'whom',
  'your', 'yours', 'ours', 'their', 'there', 'here', 'about', 'would', 'could', 'should',
  'will', 'can', 'does', 'did', 'was', 'were', 'been', 'being', 'into', 'over', 'under',
  'then', 'than', 'them', 'they', 'some', 'such', 'only', 'also', 'just', 'like', 'make',
  'want', 'need', 'please', 'tell', 'give', 'know', 'much', 'many', 'more', 'very',
]);

function tokenize(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9:.-]+/g, ' ')
    .split(' ')
    .filter(Boolean);
}

/** Very small stemmer: enough to unify plural / -ing / -ed variants. */
function stem(word) {
  return word
    .replace(/[.:-]+$/, '')
    .replace(/(ing|ed|es|s)$/, '')
    .replace(/(sses|shes|ches|xes)$/, 's');
}

function hashString(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return h;
}

/** Deterministic embedder: concept activation + hashed lexical residual. */
function embed(text) {
  const tokens = tokenize(text);
  const stems = tokens.map(stem);
  const vector = new Array(Object.keys(CONCEPT_LEXICON).length + LEXICAL_DIMS).fill(0);

  Object.entries(CONCEPT_LEXICON).forEach(([concept, triggers], index) => {
    let activation = 0;
    for (const trigger of triggers) {
      const triggerStem = stem(trigger);
      for (const tokenStem of stems) {
        if (tokenStem === triggerStem) activation += 1;
        else if (tokenStem.length > 3 && triggerStem.length > 3 && tokenStem.startsWith(triggerStem)) activation += 0.5;
      }
    }
    vector[index] = Math.sqrt(activation);
  });

  const lexicalOffset = Object.keys(CONCEPT_LEXICON).length;
  for (const tokenStem of stems) {
    if (!tokenStem || STOPWORDS.has(tokenStem)) continue;
    const slot = Math.abs(hashString(tokenStem)) % LEXICAL_DIMS;
    vector[lexicalOffset + slot] += LEXICAL_WEIGHT;
  }

  const mag = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
  return vector.map((v) => v / mag);
}

function cosine(a, b) {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

// ---------------------------------------------------------------------------
// Retrieval policies (mirrors of the production SQL in store.service.ts)
// ---------------------------------------------------------------------------

/** Cosine vector search with a similarity floor, ordered by distance. */
function searchVector(query, chunks, threshold) {
  const qv = embed(query);
  return chunks
    .map((c) => ({ ...c, similarity: cosine(qv, c.embedding) }))
    .filter((c) => c.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity || a.index - b.index)
    .slice(0, TOP_K);
}

/**
 * Keyword search: terms = question words longer than 3 chars minus stopwords
 * (AIService.extractTerms), match = case-insensitive substring (SQL ILIKE),
 * rank = number of matched terms, similarity = matched / terms.
 */
function keywordTerms(question) {
  return [...new Set(
    tokenize(question)
      .filter((w) => w.length > 3 && !STOPWORDS.has(w))
      .map(stem),
  )].slice(0, 6);
}

function searchKeyword(query, chunks, threshold) {
  const terms = keywordTerms(query);
  if (!terms.length) return [];
  return chunks
    .map((c) => {
      const lower = c.text.toLowerCase();
      const matched = terms.filter((t) => lower.includes(t)).length;
      return { ...c, matched, similarity: matched / terms.length };
    })
    .filter((c) => c.matched > 0 && c.similarity >= threshold)
    .sort((a, b) => b.matched - a.matched || a.index - b.index)
    .slice(0, TOP_K);
}

// ---------------------------------------------------------------------------
// Metrics (same shape as the client-hunter benchmark)
// ---------------------------------------------------------------------------

const RETRIVERS = {
  vector: searchVector,
  keyword: searchKeyword,
};

/**
 * A question counts as "answered" when the retriever surfaced at least one
 * gold chunk. A distractor question (no gold chunks) counts as a false positive
 * whenever the retriever returned anything at all — that is the failure mode we
 * care about: making something up instead of saying "not covered".
 */
function isAnswered(item, hits) {
  const retrievedIds = hits.map((h) => h.id);
  if (item.relevant.length === 0) return retrievedIds.length > 0;
  return item.relevant.some((id) => retrievedIds.includes(id));
}

function computeMetrics(goldset, retrieve) {
  const results = [];
  for (const threshold of THRESHOLDS) {
    let tp = 0, fp = 0, fn = 0, tn = 0;

    for (const item of goldset.questions) {
      const hits = retrieve(item.question, goldset.chunks, threshold);
      const predicted = isAnswered(item, hits);
      const actual = item.relevant.length > 0;

      if (actual && predicted) tp++;
      else if (!actual && predicted) fp++;
      else if (actual && !predicted) fn++;
      else tn++;
    }

    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
    const fpr = fp + tn > 0 ? fp / (fp + tn) : 0;
    const fnr = fn + tp > 0 ? fn / (fn + tp) : 0;

    results.push({ threshold, tp, fp, fn, tn, precision, recall, f1, fpr, fnr });
  }

  return results;
}

/** Only real problems: a gold chunk never surfaced, or a distractor got answered. */
function problemsAtBestThreshold(goldset, retrieve, threshold) {
  const problems = [];
  for (const item of goldset.questions) {
    const retrievedIds = retrieve(item.question, goldset.chunks, threshold).map((h) => h.id);
    if (item.relevant.length === 0) {
      if (retrievedIds.length > 0) {
        problems.push({ type: 'false-positive', id: item.id, question: item.question, retrievedIds });
      }
      continue;
    }
    if (!item.relevant.some((id) => retrievedIds.includes(id))) {
      problems.push({ type: 'false-negative', id: item.id, question: item.question, retrievedIds });
    }
  }
  return problems;
}

function validate(goldset) {
  const errors = [];
  if (!Array.isArray(goldset.chunks) || goldset.chunks.length < 15) {
    errors.push(`need at least 15 chunks, found ${(goldset.chunks || []).length}`);
  }
  if (!Array.isArray(goldset.questions) || goldset.questions.length < 12) {
    errors.push(`need at least 12 questions, found ${(goldset.questions || []).length}`);
  }
  const chunkIds = new Set((goldset.chunks || []).map((c) => c.id));
  if (chunkIds.size !== (goldset.chunks || []).length) errors.push('duplicate chunk ids');
  for (const q of goldset.questions || []) {
    for (const id of q.relevant || []) {
      if (!chunkIds.has(id)) errors.push(`question ${q.id} references unknown chunk ${id}`);
    }
  }
  const negatives = (goldset.questions || []).filter((q) => (q.relevant || []).length === 0).length;
  if (negatives < 3) errors.push(`need at least 3 distractor questions, found ${negatives}`);
  if (!Number.isFinite(MIN_F1)) errors.push(`EVAL_MIN_F1 is not a number: ${process.env.EVAL_MIN_F1}`);
  return errors;
}

function printTable(title, results) {
  console.log(`=== ${title} ===`);
  console.log('Thr | TP  FP  FN  TN  | Prec   Rec    F1     FPR    FNR');
  console.log('----|--------------|------------------------------');
  for (const r of results) {
    console.log(
      `${r.threshold}  | ${String(r.tp).padStart(2)} ${String(r.fp).padStart(2)} ${String(r.fn).padStart(2)} ${String(r.tn).padStart(2)} | ` +
        `${(r.precision * 100).toFixed(1).padStart(5)}% ${(r.recall * 100).toFixed(1).padStart(5)}% ` +
        `${(r.f1 * 100).toFixed(1).padStart(5)}% ${(r.fpr * 100).toFixed(1).padStart(5)}% ${(r.fnr * 100).toFixed(1).padStart(5)}%`,
    );
  }
  console.log();
}

function main() {
  const goldset = JSON.parse(fs.readFileSync(GOLDSET_PATH, 'utf8'));
  const errors = validate(goldset);
  if (errors.length) {
    console.error('GOLDSET INVALID:');
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  // Pre-embed the corpus once: the offline embedder is deterministic.
  const chunks = goldset.chunks.map((c, index) => ({ ...c, index, embedding: embed(c.text) }));

  const answerable = goldset.questions.filter((q) => q.relevant.length > 0);
  const negatives = goldset.questions.filter((q) => q.relevant.length === 0);

  console.log('=== GOLDSET SUMMARY ===');
  console.log(`Source: ${goldset.name} v${goldset.version}`);
  console.log(`Chunks: ${chunks.length}, Questions: ${goldset.questions.length} ` +
    `(${answerable.length} answerable, ${negatives.length} distractors)`);
  console.log(`Sweep: ${THRESHOLDS.join(', ')} | top-k: ${TOP_K} | embedder: offline concept-lens (hermetic)`);
  console.log();

  const report = { goldset: goldset.name, top_k: TOP_K, min_f1: MIN_F1, modes: {} };

  for (const [mode, retrieve] of Object.entries(RETRIVERS)) {
    const results = computeMetrics({ ...goldset, chunks }, (q, cs, t) => retrieve(q, cs, t));
    printTable(`THRESHOLD SWEEP — ${mode.toUpperCase()} RETRIEVAL`, results);

    const best = results.reduce((acc, r) => (r.f1 > acc.f1 ? r : acc), results[0]);
    console.log(`=== BEST THRESHOLD (max F1) — ${mode.toUpperCase()} ===`);
    console.log(
      `Threshold ${best.threshold}: F1=${(best.f1 * 100).toFixed(1)}%, ` +
        `Precision=${(best.precision * 100).toFixed(1)}%, Recall=${(best.recall * 100).toFixed(1)}%`,
    );
    console.log();

    const problems = problemsAtBestThreshold({ ...goldset, chunks }, (q, cs, t) => retrieve(q, cs, t), best.threshold);
    if (problems.length) {
      console.log(`=== PROBLEMS AT BEST THRESHOLD — ${mode.toUpperCase()} ===`);
      for (const p of problems) {
        console.log(`${p.type} ${p.id}: "${p.question}"`);
        console.log(`  retrieved: ${p.retrievedIds.join(', ') || '(nothing above threshold)'}`);
      }
      console.log();
    }

    report.modes[mode] = {
      best_threshold: best.threshold,
      best_f1: best.f1,
      best_precision: best.precision,
      best_recall: best.recall,
      all_results: results,
    };
  }

  const production = report.modes.vector;
  const passed = production.best_f1 >= MIN_F1;
  console.log('=== GATE ===');
  console.log(`Production path (vector) best F1 = ${(production.best_f1 * 100).toFixed(1)}% ` +
    `at threshold ${production.best_threshold} (floor ${(MIN_F1 * 100).toFixed(1)}%)`);
  console.log(passed ? 'PASS' : 'FAIL');

  fs.writeFileSync(path.join(__dirname, 'benchmark-results.json'), JSON.stringify(report, null, 2));

  process.exit(passed ? 0 : 1);
}

main();
