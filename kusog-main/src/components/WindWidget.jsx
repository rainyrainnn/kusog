import { createClient } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'

const SUPABASE_URL = "https://gqkxingmxbjsmkwbnpko.supabase.co"
const SUPABASE_KEY = "sb_publishable_3apqnlNXbrvSyHwgewJ2kg_NL2y60xP"
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

export default function WindWidget() {
  const [readings, setReadings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchWindData() {
      const { data, error } = await supabase
        .from('wind_sensor_readings')
        .select('*')
        .order('id', { ascending: false })
        .limit(5)

      if (error) {
        console.error('Error fetching wind data:', error)
      } else {
        setReadings(data || [])
      }
      setLoading(false)
    }

    fetchWindData()

    // Real-time listener: instantly updates when your RPi pushes new wind readings
    const subscription = supabase
      .channel('public:wind_sensor_readings')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'wind_sensor_readings' }, payload => {
        setReadings(current => [payload.new, ...current.slice(0, 4)])
      })
      .subscribe()

    return () => {
      supabase.removeChannel(subscription)
    }
  }, [])

  if (loading) return <div style={cardStyle}>Loading wind sensor...</div>

  const latestSpeed = readings.length > 0 ? readings[0].wind_speed_kmh : 0

  return (
    <div style={cardStyle}>
      <h3 style={{ margin: '0 0 10px 0', color: '#1e293b' }}>🌪️ Cup Anemometer</h3>
      <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#0284c7', marginBottom: '12px' }}>
        {latestSpeed.toFixed(1)} <span style={{ fontSize: '16px', color: '#64748b' }}>km/h</span>
      </div>
      
      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        Recent Readings
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '13px' }}>
        {readings.map((row) => (
          <li key={row.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
            <span style={{ color: '#475569' }}>{new Date(row.timestamp).toLocaleTimeString()}</span>
            <b style={{ color: '#0f172a' }}>{row.wind_speed_kmh.toFixed(1)} km/h</b>
          </li>
        ))}
      </ul>
    </div>
  )
}

const cardStyle = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
  padding: '20px',
  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  maxWidth: '340px',
  fontFamily: 'system-ui, -apple-system, sans-serif'
}