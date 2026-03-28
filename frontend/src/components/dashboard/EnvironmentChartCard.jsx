import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatDateTime, formatNumber, formatTimeShort } from '../../utils/format';
import styles from './EnvironmentChartCard.module.css';

function TooltipContent({ active, payload, label }) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipTitle}>{formatDateTime(label)}</div>
      {payload.map((item) => (
        <div key={item.dataKey} className={styles.tooltipRow}>
          <span className={styles.tooltipDot} style={{ backgroundColor: item.color }} />
          <span>{item.name}</span>
          <strong>{formatNumber(item.value, { maximumFractionDigits: item.dataKey === 'light' ? 0 : 1 })}</strong>
        </div>
      ))}
    </div>
  );
}

function EnvironmentChartCard({ points }) {
  return (
    <section className={styles.card}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.heading}>Real-time Environmental Data</h2>
          <p className={styles.subheading}>Temperature, humidity, and light trends over time</p>
        </div>
      </div>

      <div className={styles.chartArea}>
        {points.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 8, right: 8, bottom: 6, left: -16 }}>
              <CartesianGrid stroke="#e8ecf7" vertical={false} />
              <XAxis
                dataKey="ts"
                tickLine={false}
                axisLine={false}
                minTickGap={30}
                tickFormatter={formatTimeShort}
                tick={{ fill: '#6b7387', fontSize: 12 }}
              />
              <YAxis
                yAxisId="climate"
                tickLine={false}
                axisLine={false}
                tick={{ fill: '#6b7387', fontSize: 12 }}
                width={36}
              />
              <YAxis
                yAxisId="light"
                orientation="right"
                tickLine={false}
                axisLine={false}
                tick={{ fill: '#6b7387', fontSize: 12 }}
                width={44}
              />
              <Tooltip content={<TooltipContent />} />
              <Legend
                verticalAlign="bottom"
                wrapperStyle={{ paddingTop: 18 }}
              />
              <Line
                yAxisId="climate"
                type="monotone"
                dataKey="temp"
                name="Temperature"
                stroke="#6268ef"
                strokeWidth={3}
                dot={false}
                connectNulls
              />
              <Line
                yAxisId="climate"
                type="monotone"
                dataKey="hum"
                name="Humidity"
                stroke="#ff4f87"
                strokeWidth={3}
                dot={false}
                connectNulls
              />
              <Line
                yAxisId="light"
                type="monotone"
                dataKey="light"
                name="Light"
                stroke="#f2ac2e"
                strokeWidth={3}
                dot={false}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className={styles.emptyChart}>No chart data yet. Waiting for telemetry.</div>
        )}
      </div>
    </section>
  );
}

export default EnvironmentChartCard;
