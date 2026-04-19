import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
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
import {
  DEVICE_OPTIONS,
  DEVICE_USAGE_ACTION_OPTIONS,
  DEVICE_USAGE_BUCKET_OPTIONS,
  DEVICE_USAGE_STATUS_OPTIONS,
} from '../constants/app';
import styles from './DeviceUsagePage.module.css';

const DEVICE_USAGE_POLL_INTERVAL_MS = 5000;
const DISPLAY_TIME_OFFSET_MS = 7 * 60 * 60 * 1000;
const DEFAULT_RANGE_MS = 24 * 60 * 60 * 1000;

function pad(value) {
  return String(value).padStart(2, '0');
}

function formatDateTimeInput(value) {
  const parsed = new Date(value);
  const shifted = new Date(parsed.getTime() + DISPLAY_TIME_OFFSET_MS);

  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}T${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`;
}

function createDefaultRange() {
  const to = new Date();
  const from = new Date(to.getTime() - DEFAULT_RANGE_MS);

  return {
    from: formatDateTimeInput(from),
    to: formatDateTimeInput(to),
  };
}

function toQueryDateTime(value) {
  return value ? `${value.replace('T', ' ')}:00` : '';
}

function UsageTooltip({ active, payload, label }) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipLabel}>{label}</div>
      <div className={styles.tooltipValue}>Count: {payload[0].value}</div>
    </div>
  );
}

function DeviceUsagePage() {
  const defaultRange = useRef(createDefaultRange()).current;
  const [deviceCode, setDeviceCode] = useState(DEVICE_OPTIONS[0]?.value || 'LED1');
  const [action, setAction] = useState('all');
  const [status, setStatus] = useState('all');
  const [from, setFrom] = useState(defaultRange.from);
  const [to, setTo] = useState(defaultRange.to);
  const [bucket, setBucket] = useState('2h');
  const [usageData, setUsageData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const requestInFlightRef = useRef(false);
  const queuedRefreshRef = useRef(false);
  const mountedRef = useRef(true);
  const useLiveDefaultRangeRef = useRef(true);
  const latestParamsRef = useRef({
    deviceCode: DEVICE_OPTIONS[0]?.value || 'LED1',
    action: 'all',
    status: 'all',
    from: defaultRange.from,
    to: defaultRange.to,
    bucket: '2h',
  });

  useEffect(() => {
    latestParamsRef.current = {
      deviceCode,
      action,
      status,
      from,
      to,
      bucket,
    };
  }, [deviceCode, action, status, from, to, bucket]);

  const getRequestParams = useCallback(() => {
    const currentParams = latestParamsRef.current;

    if (!useLiveDefaultRangeRef.current) {
      return currentParams;
    }

    // Keep the untouched default range behaving like "last 24 hours"
    // so background refreshes can pick up newly-created actions.
    return {
      ...currentParams,
      ...createDefaultRange(),
    };
  }, []);

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

    const currentParams = getRequestParams();

    try {
      const response = await fetchDeviceUsage({
        device_code: currentParams.deviceCode,
        action: currentParams.action,
        status: currentParams.status,
        from: toQueryDateTime(currentParams.from),
        to: toQueryDateTime(currentParams.to),
        bucket: currentParams.bucket,
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
  }, [getRequestParams]);

  useEffect(() => {
    document.title = 'IoT Dashboard | Device Usage';
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    void loadUsage();
  }, [loadUsage, deviceCode, action, status, from, to, bucket]);

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

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Device Usage</h1>
        <p className={styles.subtitle}>Count device actions by time bucket for one selected device.</p>
      </div>

      <section className={styles.filtersCard}>
        <div className={styles.filtersGrid}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Device</span>
            <SelectField
              ariaLabel="Select device"
              value={deviceCode}
              options={DEVICE_OPTIONS}
              onChange={setDeviceCode}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Action</span>
            <SelectField
              ariaLabel="Select action filter"
              value={action}
              options={DEVICE_USAGE_ACTION_OPTIONS}
              onChange={setAction}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Status</span>
            <SelectField
              ariaLabel="Select status filter"
              value={status}
              options={DEVICE_USAGE_STATUS_OPTIONS}
              onChange={setStatus}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Bucket</span>
            <SelectField
              ariaLabel="Select time bucket"
              value={bucket}
              options={DEVICE_USAGE_BUCKET_OPTIONS}
              onChange={setBucket}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>From</span>
            <input
              className={styles.dateInput}
              type="datetime-local"
              value={from}
              onChange={(event) => {
                useLiveDefaultRangeRef.current = false;
                setFrom(event.target.value);
              }}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>To</span>
            <input
              className={styles.dateInput}
              type="datetime-local"
              value={to}
              onChange={(event) => {
                useLiveDefaultRangeRef.current = false;
                setTo(event.target.value);
              }}
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
            <h2 className={styles.chartTitle}>Usage Count</h2>
            <p className={styles.chartCaption}>
              {usageData?.device_code || deviceCode} | {usageData?.action || action} | {usageData?.status || status}
            </p>
          </div>
        </div>

        {usageData?.items?.length ? (
          <div className={styles.chartWrap}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={usageData.items}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="label"
                  angle={-20}
                  textAnchor="end"
                  height={78}
                  tick={{ fontSize: 12, fill: '#667085' }}
                  interval={0}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#667085' }} />
                <Tooltip content={<UsageTooltip />} />
                <Bar dataKey="count" fill="#6268ef" radius={[8, 8, 0, 0]} maxBarSize={38} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState
            title="No usage buckets available"
            message="Adjust the filters or wait for device actions to populate this view."
          />
        )}
      </section>
    </div>
  );
}

export default DeviceUsagePage;
