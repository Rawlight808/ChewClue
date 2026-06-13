import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { cloudGetFoodEntries, cloudGetCheckins } from '../cloudStore'
import { detectTriggers } from '../insights'
import type { TriggerInsight } from '../types'

function confidenceLabel(score: number): { text: string; color: string } {
  if (score >= 0.7) return { text: 'Strong pattern', color: 'var(--clr-red)' }
  if (score >= 0.4) return { text: 'Possible link', color: 'var(--clr-orange)' }
  return { text: 'Early signal', color: 'var(--clr-text-muted)' }
}

export function InsightsPage() {
  const navigate = useNavigate()
  const [insights, setInsights] = useState<TriggerInsight[]>([])
  const [loading, setLoading] = useState(true)
  const [dataStats, setDataStats] = useState({ foodDays: 0, checkinDays: 0 })

  useEffect(() => {
    Promise.all([cloudGetFoodEntries(), cloudGetCheckins()]).then(([foods, checkins]) => {
      setInsights(detectTriggers(foods, checkins))
      const foodDays = new Set(foods.map((f) => f.date)).size
      const checkinDays = new Set(checkins.map((c) => c.date)).size
      setDataStats({ foodDays, checkinDays })
      setLoading(false)
    })
  }, [])

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Insights</h1>
        <p className="page-subtitle">Patterns between what you eat and how you feel</p>
      </div>

      {loading ? (
        <div style={{ padding: '1rem 0' }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="card" style={{ marginBottom: '0.6rem' }}>
              <div className="skeleton skeleton-line" style={{ width: '70%' }} />
              <div className="skeleton skeleton-line" style={{ width: '100%', height: '6px', marginTop: '0.5rem' }} />
              <div className="skeleton skeleton-line" style={{ width: '50%', marginTop: '0.5rem' }} />
            </div>
          ))}
        </div>
      ) : insights.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">🔬</div>
          <p className="empty-state__text" style={{ marginBottom: '0.75rem' }}>
            {dataStats.foodDays === 0 && dataStats.checkinDays === 0
              ? 'Start logging meals and check-ins to discover patterns.'
              : dataStats.foodDays < 3 || dataStats.checkinDays < 3
                ? `You have ${dataStats.foodDays} day${dataStats.foodDays === 1 ? '' : 's'} of meals and ${dataStats.checkinDays} day${dataStats.checkinDays === 1 ? '' : 's'} of check-ins. A few more days and patterns will start to emerge.`
                : 'Keep logging — patterns will appear soon.'}
          </p>
          {dataStats.foodDays === 0 ? (
            <button className="btn btn--primary" onClick={() => navigate('/log')}>
              Log Your First Meal
            </button>
          ) : dataStats.checkinDays === 0 ? (
            <button className="btn btn--primary" onClick={() => navigate('/checkin')}>
              Do Your First Check-In
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <p style={{ fontSize: '0.82rem', color: 'var(--clr-text-muted)', marginBottom: '0.5rem' }}>
            Based on {dataStats.foodDays} days of food logs and {dataStats.checkinDays} days of check-ins.
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--clr-text-muted)', marginBottom: '1rem', lineHeight: 1.4 }}>
            These are patterns, not diagnoses. Discuss strong patterns with your doctor.
          </p>
          {insights.slice(0, 12).map((ins, i) => {
            const conf = confidenceLabel(ins.score)
            return (
              <div key={`${ins.tag}-${ins.symptom}-${i}`} className="insight-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.15rem' }}>
                  <p style={{ fontSize: '0.92rem' }}>
                    <span className="insight-tag">{ins.label}</span> may be linked to{' '}
                    <span className="insight-symptom">{ins.symptom}</span>
                  </p>
                  <span style={{ fontSize: '0.68rem', fontWeight: 600, color: conf.color, whiteSpace: 'nowrap' }}>
                    {conf.text}
                  </span>
                </div>
                <div className="insight-bar">
                  <div
                    className="insight-bar__fill"
                    style={{ width: `${Math.round(ins.score * 100)}%` }}
                  />
                </div>
                <p className="insight-detail">
                  {ins.occurrences} day{ins.occurrences === 1 ? '' : 's'} with this food &middot;
                  felt {ins.lag === 'same_day' ? 'same evening' : 'next morning'} &middot;
                  Avg {ins.symptom.toLowerCase()}: {ins.avgSymptomAfter} (with) vs {ins.avgSymptomWithout} (without)
                </p>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
