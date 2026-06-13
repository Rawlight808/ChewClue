// Sanity test for detectTriggers with synthetic data. Run: npx tsx scripts/test-insights.mts
const storage = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => storage.set(k, v),
  removeItem: (k: string) => storage.delete(k),
}

const { detectTriggers } = await import('../src/insights')
const { format, subDays } = await import('date-fns')

type AnyFood = any
type AnyCheckin = any

// Deterministic PRNG
let seed = 42
const rand = () => {
  seed = (seed * 1103515245 + 12345) % 2147483648
  return seed / 2147483648
}

const today = new Date('2026-06-09T12:00:00')
const foods: AnyFood[] = []
const checkins: AnyCheckin[] = []

for (let i = 0; i < 45; i++) {
  const date = format(subDays(today, i), 'yyyy-MM-dd')
  const ateDairy = rand() < 0.4
  const ateBreadGluten = rand() < 0.5 // always together -> should merge
  const ateNoise = rand() < 0.5

  const tags: string[][] = []
  if (ateDairy) {
    tags.push(['dairy'])
    if (rand() < 0.3) tags.push(['dairy']) // second serving some days (dose)
  }
  if (ateBreadGluten) tags.push(['bread', 'gluten'])
  if (ateNoise) tags.push(['vegetables'])
  tags.forEach((t, j) => foods.push({
    id: `${date}-${j}`, date, meal: 'lunch', description: 'x', tags: t, createdAt: date,
  }))

  // Next-morning effect: dairy yesterday -> pain this morning
  const dairyYesterday = i < 44 ? undefined : undefined // resolved below
  checkins.push({
    id: `m-${date}`, date, period: 'morning',
    sleepQuality: 3, energy: 3, mood: 3,
    pain: 0, // filled below once we know yesterday's foods
    bowel: 2, notes: '', createdAt: date,
    customDirections: { pain: 'higher_worse', bowel: 'higher_worse' },
    extraMetrics: [],
  })

  // Same-evening effect: bread/gluten today -> bloating tonight (custom metric)
  const noise = () => (rand() < 0.5 ? 0 : 1)
  checkins.push({
    id: `e-${date}`, date, period: 'evening',
    sleepQuality: 0, energy: 3, mood: 3, pain: 1 + noise(), bowel: 2, notes: '', createdAt: date,
    customDirections: { pain: 'higher_worse', bowel: 'higher_worse' },
    extraMetrics: [{
      id: 'custom_bloating', label: 'Bloating', direction: 'higher_worse',
      value: ateBreadGluten ? 4 + (rand() < 0.5 ? 1 : 0) : 1 + noise(),
    }],
  })
}

// Fill morning pain based on previous day's dairy (with dose-response)
const dairyCount = new Map<string, number>()
for (const f of foods) {
  if (f.tags.includes('dairy')) dairyCount.set(f.date, (dairyCount.get(f.date) ?? 0) + 1)
}
for (const c of checkins) {
  if (c.period !== 'morning') continue
  const prev = format(subDays(new Date(c.date + 'T12:00:00'), 1), 'yyyy-MM-dd')
  const dose = dairyCount.get(prev) ?? 0
  c.pain = dose === 0 ? 1 + (rand() < 0.4 ? 1 : 0) : dose === 1 ? 4 : 5
}

const insights = detectTriggers(foods, checkins)
console.log('Insights found:', insights.length)
for (const ins of insights) {
  console.log(
    `${ins.label} -> ${ins.symptom} [${ins.lag}] score=${ins.score.toFixed(2)} n=${ins.occurrences} ` +
    `avg ${ins.avgSymptomAfter} vs ${ins.avgSymptomWithout}`,
  )
}

// Assertions
const fail = (msg: string) => { console.error('FAIL:', msg); process.exitCode = 1 }
const dairyPain = insights.find((i) => i.tag === 'dairy' && i.symptom === 'Pain')
if (!dairyPain) fail('expected dairy -> Pain insight')
else {
  if (dairyPain.lag !== 'next_morning') fail(`dairy lag should be next_morning, got ${dairyPain.lag}`)
  if (dairyPain.score < 0.7) fail(`dairy score should be strong, got ${dairyPain.score}`)
}
const bloating = insights.find((i) => i.symptom === 'Bloating')
if (!bloating) fail('expected Bloating insight from custom metric')
else {
  if (bloating.lag !== 'same_day') fail(`bloating lag should be same_day, got ${bloating.lag}`)
  if (!bloating.label.includes('/')) fail(`bread+gluten should be merged into one label, got "${bloating.label}"`)
}
const breadAndGlutenSeparate =
  insights.filter((i) => ['bread', 'gluten'].includes(i.tag) && i.symptom === 'Bloating').length > 1
if (breadAndGlutenSeparate) fail('bread and gluten should not appear as separate Bloating insights')
const veg = insights.find((i) => i.tag === 'vegetables' && i.score >= 0.4)
if (veg) fail(`noise tag scored a possible link: ${JSON.stringify(veg)}`)
console.log(process.exitCode ? 'SANITY TEST FAILED' : 'All sanity checks passed.')
