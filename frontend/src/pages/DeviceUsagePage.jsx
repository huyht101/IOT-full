import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { fetchDeviceUsage } from '../api/deviceUsage';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import LoadingState from '../components/common/LoadingState';
import SelectField from '../components/common/SelectField';
import { DEVICE_USAGE_STATUS_OPTIONS } from '../constants/app';
import styles from './DeviceUsagePage.module.css';

const DEVICE_USAGE_POLL_INTERVAL_MS = 5000;
const DISPLAY_TIME_OFFSET_MS = 7 * 60 * 60 * 1000;

function pad(value) {
  return String(value).padStart(2, '0');
}

function formatDisplayDate(value) {
  const shifted = new Date(value.getTime() + DISPLAY_TIME_OFFSET_MS);

  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

function UsageTooltip({ active, payload, label }) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipLabel}>{label}</div>
      {payload.map((entry) => (
        <div key={entry.dataKey} className={styles.tooltipValue}>
          {entry.name}: {entry.value}
        </div>
      ))}
    </div>
  );
}

function DeviceUsagePage() {
  const [selectedDate, setSelectedDate] = useState(() => formatDisplayDate(new Date()));
  const [status, setStatus] = useState('success');
  const [usageData, setUsageData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const requestInFlightRef = useRef(false);
  const queuedRefreshRef = useRef(false);
  const mountedRef = useRef(true);
  const latestParamsRef = useRef({
    date: formatDisplayDate(new Date()),
    status: 'success',
  });

  useEffect(() => {
    latestParamsRef.current = {
      date: selectedDate,
      status,
    };
  }, [selectedDate, status]);

  const loadUsage = useCallback(async (options = {}) => {
    const background = Boolean(options.background);

    if (requestInFlightRef.current) {
      queuedRefreshRef.current = true;
      return;
    }

    requestInFlightRef.current = true;

    if (!background) {
      setLoading(true);
      setError('');
    }

    const currentParams = latestParamsRef.current;

    try {
      const response = await fetchDeviceUsage({
        date: currentParams.date,
        status: currentParams.status,
      });

      if (!mountedRef.current) {
        return;
      }

      setUsageData(response.data);
      setError('');
    } catch (requestError) {
      if (!mountedRef.current) {
        return;
      }

      setError(requestError.message);
    } finally {
      if (mountedRef.current && !background) {
        setLoading(false);
      }

      requestInFlightRef.current = false;

      if (queuedRefreshRef.current && mountedRef.current) {
        queuedRefreshRef.current = false;
        void loadUsage({ background: true });
      }
    }
  }, []);

  useEffect(() => {
    document.title = 'IoT Dashboard | Device Usage';
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    void loadUsage();
  }, [loadUsage, selectedDate, status]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (document.hidden) {
        return;
      }

      void loadUsage({ background: true });
    }, DEVICE_USAGE_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadUsage]);

  if (loading && !usageData) {
    return <LoadingState label="Loading device usage..." />;
  }

  if (error && !usageData) {
    return (
      <ErrorState
        title="Unable to load device usage"
        message={error}
        onAction={() => {
          void loadUsage();
        }}
      />
    );
  }

  const chartItems = usageData?.items || [];

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Device Usage</h1>
        <p className={styles.subtitle}>Daily on/off counts for all five devices on the selected UTC+07 date.</p>
      </div>

      <section className={styles.filtersCard}>
        <div className={styles.filtersGrid}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Date</span>
            <input
              className={styles.dateInput}
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Status</span>
            <SelectField
              ariaLabel="Select usage status"
              value={status}
              options={DEVICE_USAGE_STATUS_OPTIONS}
              onChange={setStatus}
            />
          </label>
        </div>

        {error && usageData ? (
          <div className={styles.inlineError}>{error}</div>
        ) : null}
      </section>

      <section className={styles.chartCard}>
        <div className={styles.chartHeader}>
          <div>
            <h2 className={styles.chartTitle}>Daily Usage Count</h2>
            <p className={styles.chartCaption}>
              {usageData?.date || selectedDate} | {usageData?.status || status} | {usageData?.timezone || 'UTC+07'}
            </p>
          </div>
        </div>

        {chartItems.length ? (
          <div className={styles.chartWrap}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartItems} barGap={10} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="device_name"
                  tick={{ fontSize: 12, fill: '#667085' }}
                  interval={0}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#667085' }} />
                <Tooltip content={<UsageTooltip />} />
                <Legend />
                <Bar
                  dataKey="on_count"
                  name="On"
                  fill="#6268ef"
                  radius={[8, 8, 0, 0]}
                  maxBarSize={34}
                />
                <Bar
                  dataKey="off_count"
                  name="Off"
                  fill="#f59e0b"
                  radius={[8, 8, 0, 0]}
                  maxBarSize={34}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState
            title="No device usage available"
            message="Wait for device actions or select another date."
          />
        )}
      </section>
    </div>
  );
}

export default DeviceUsagePage;
