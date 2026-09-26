// Demo conversation eval runner — zero dependencies, Node 25 native TypeScript.
// Run: node scripts/eval-demo.ts   (npm run eval:demo)
//
// Loads the golden dataset, replays each case through the pure `reply()` state
// machine exactly like the component's send() does, and reports per-turn
// failures plus a per-category table. Exit codes:
//   0 = all critical cases pass AND overall pass rate >= 95%
//   2 = baseline gate not met (expected for this baseline run)
//   1 = harness error (dataset load failure, import failure, etc.)

import { readFileSync } from 'node:fs'
import { reply, FALLBACK } from '../lib/demo-conversation.ts'
import type { Reply, Step } from '../lib/demo-conversation.ts'

const DATASET_URL = new URL('../evals/demo-conversation.dataset.json', import.meta.url)

type Expect = {
  contains?: string[]
  not_contains?: string[]
  fallback?: boolean
  not_fallback?: boolean
  step?: Step
  replies_include?: string[]
}

type Turn = { input: string; expect: Expect }
type Case = {
  id: string
  category: string
  severity: 'critical' | 'normal'
  turns: Turn[]
}

type Dataset = {
  version: number
  categories: Record<string, string>
  cases: Case[]
}

function loadDataset(): Dataset {
  try {
    const raw = readFileSync(DATASET_URL, 'utf8')
    return JSON.parse(raw) as Dataset
  } catch (e) {
    console.error('Failed to load dataset:', e)
    process.exit(1)
  }
}

function assertContains(text: string, needles: string[]): string[] {
  const lower = text.toLowerCase()
  return needles.filter((n) => !lower.includes(n.toLowerCase()))
}

function assertRepliesInclude(replies: string[] | undefined, needles: string[]): string[] {
  const list = replies ?? []
  return needles.filter((n) => !list.includes(n))
}

type FailDetail = {
  caseId: string
  turn: number
  input: string
  actualText: string
  actualStep: Step
  actualReplies: string[]
  failed: string[]
}

function run(): { dataset: Dataset; failures: FailDetail[]; passed: number; failed: number; criticalPassed: number; criticalTotal: number } {
  const dataset = loadDataset()
  const failures: FailDetail[] = []
  let passed = 0
  let failed = 0
  let criticalPassed = 0
  const criticalTotal = dataset.cases.filter((c) => c.severity === 'critical').length

  for (const c of dataset.cases) {
    let step: Step = 'none'
    let name = ''
    let slot = ''
    let caseFailed = false

    for (let i = 0; i < c.turns.length; i++) {
      const turn = c.turns[i]
      const r: Reply = reply(turn.input, step, name, slot)

      // Carry state exactly like demo-chat.tsx send():
      //   step = answer.step ?? prev.step; name = answer.name ?? prev.name; slot = answer.slot ?? prev.slot
      step = r.step ?? step
      name = r.name ?? name
      slot = r.slot ?? slot

      const e = turn.expect
      const failed: string[] = []

      const missingContains = e.contains ? assertContains(r.text, e.contains) : []
      if (missingContains.length) failed.push(`contains[] missing: ${JSON.stringify(missingContains)}`)

      const leakedNotContains = e.not_contains
        ? e.not_contains.filter((n) => r.text.toLowerCase().includes(n.toLowerCase()))
        : []
      if (leakedNotContains.length) failed.push(`not_contains[] present: ${JSON.stringify(leakedNotContains)}`)

      if (e.fallback === true && r.text !== FALLBACK) failed.push('fallback: true but r.text !== FALLBACK')
      if (e.not_fallback === true && r.text === FALLBACK) failed.push('not_fallback: true but r.text === FALLBACK')

      if (e.step !== undefined && step !== e.step) failed.push(`step: expected ${e.step} but carried step is ${step}`)

      const missingReplies = e.replies_include ? assertRepliesInclude(r.replies, e.replies_include) : []
      if (missingReplies.length) failed.push(`replies_include[] missing: ${JSON.stringify(missingReplies)}`)

      if (failed.length) {
        caseFailed = true
        failures.push({
          caseId: c.id,
          turn: i + 1,
          input: turn.input,
          actualText: r.text,
          actualStep: step,
          actualReplies: r.replies ?? [],
          failed,
        })
      }
    }

    if (caseFailed) {
      failed += 1
    } else {
      passed += 1
      if (c.severity === 'critical') criticalPassed += 1
    }
  }

  return { dataset, failures, passed, failed, criticalPassed, criticalTotal }
}

function main() {
  const { dataset, failures, passed, failed, criticalPassed, criticalTotal } = run()

  const cats = dataset.categories
  const catStats: Record<string, { cases: number; pass: number; fail: number }> = {}
  for (const key of Object.keys(cats)) catStats[key] = { cases: 0, pass: 0, fail: 0 }

  const caseFailIds = new Set(failures.map((f) => f.caseId))
  for (const c of dataset.cases) {
    const s = catStats[c.category]
    s.cases += 1
    if (caseFailIds.has(c.id)) s.fail += 1
    else s.pass += 1
  }

  // Per-turn failure lines.
  for (const f of failures) {
    console.log(`[FAIL] ${f.caseId} turn ${f.turn} input=${JSON.stringify(f.input)}`)
    for (const detail of f.failed) console.log(`        assertion: ${detail}`)
    console.log(`        actual text: ${JSON.stringify(f.actualText)}`)
    console.log(`        actual step: ${f.actualStep}`)
    console.log(`        actual replies: ${JSON.stringify(f.actualReplies)}`)
  }

  // Per-category table.
  console.log('')
  console.log('category | cases | pass | fail')
  for (const key of Object.keys(catStats)) {
    const s = catStats[key]
    console.log(`${cats[key]} | ${s.cases} | ${s.pass} | ${s.fail}`)
  }

  const total = passed + failed
  const overallPct = total ? Math.round((passed / total) * 1000) / 10 : 0
  console.log('')
  console.log(`total cases: ${total}`)
  console.log(`passed: ${passed}`)
  console.log(`failed: ${failed}`)
  console.log(`critical passed: ${criticalPassed}/${criticalTotal}`)
  console.log(`overall: ${overallPct}%`)

  const gatePass = criticalPassed === criticalTotal && overallPct >= 95
  console.log(`BASELINE GATE: ${gatePass ? 'PASS' : 'FAIL'}`)
  process.exit(gatePass ? 0 : 2)
}

main()