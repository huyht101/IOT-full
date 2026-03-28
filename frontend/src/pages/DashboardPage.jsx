import {
  Droplets,
  SunMedium,
  Thermometer,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchDashboard, fetchDashboardRealtime } from '../api/dashboard';
import { toggleDevice } from '../api/devices';
import { getAutomationCommands } from '../automation/engine';
import DeviceAutomationCard from '../components/dashboard/DeviceAutomationCard';
import EnvironmentChartCard from '../components/dashboard/EnvironmentChartCard';
import SensorMetricCard from '../components/dashboard/SensorMetricCard';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import LoadingState from '../components/common/LoadingState';
import { DASHBOARD_POLL_INTERVAL_MS } from '../constants/app';
import { mergeChartPoints, normalizeChartPoints, trimChartPoints } from '../utils/chart';
import {
  formatDateTime,
  formatMetricValue,
  getSensorCardLabel,
} from '../utils/format';
import { loadRuleSelections, saveRuleSelections } from '../utils/storage';
import styles from './DashboardPage.module.css';

const sensorDisplayConfig = [
  { code: 'TEMP', accent: 'indigo', icon: Thermometer },
  { code: 'HUM', accent: 'green', icon: Droplets },
  { code: 'LIGHT', accent: 'amber', icon: SunMedium },
];

function updateDeviceStateList(devices, deviceId, patch) {
  return devices.map((device) => {
    if (device.device_id !== deviceId) {
      return device;
    }

    return { ...device, ...patch };
  });
}

function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pollingError, setPollingError] = useState('');
  const [notice, setNotice] = useState(null);
  const [devices, setDevices] = useState([]);
  const [sensors, setSensors] = useState([]);
  const [chartPoints, setChartPoints] = useState([]);
  const [lastTs, setLastTs] = useState(null);
  const [loadingById, setLoadingById] = useState({});
  const [selectedRules, setSelectedRules] = useState(() => loadRuleSelections());

  const realtimeInFlightRef = useRef(false);
  const lastTsRef = useRef(null);
  const automationAttemptsRef = useRef({});
  const previousDeviceStatesRef = useRef({});

  const sensorMap = useMemo(() => {
    return sensors.reduce((map, sensor) => {
      map[sensor.sensor_code] = sensor;
      return map;
    }, {});
  }, [sensors]);

  const setDeviceLoading = useCallback((deviceId, isLoading) => {
    setLoadingById((current) => {
      const next = { ...current };

      if (isLoading) {
        next[deviceId] = true;
      } else {
        delete next[deviceId];
      }

      return next;
    });
  }, []);

  const applyDashboardPayload = useCallback((payload) => {
    const nextChartPoints = normalizeChartPoints(payload.chart_pts || [], payload.last_ts);

    setDevices(payload.devices || []);
    setSensors(payload.sensors || []);
    setChartPoints(nextChartPoints);
    setLastTs(payload.last_ts || null);
    lastTsRef.current = payload.last_ts || null;
  }, []);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetchDashboard();
      applyDashboardPayload(response.data || {});
      setPollingError('');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [applyDashboardPayload]);

  const executeToggle = useCallback(async (device, action, options = {}) => {
    setDeviceLoading(device.device_id, true);

    try {
      const response = await toggleDevice(device.device_id, action);
      const nextDeviceState = response.data?.device_state;

      if (nextDeviceState) {
        setDevices((currentDevices) => updateDeviceStateList(currentDevices, device.device_id, {
          state: nextDeviceState.state,
          updated_at: nextDeviceState.updated_at,
          last_action_id: nextDeviceState.last_action_id,
        }));
      }

      if (!options.silent) {
        setNotice({
          tone: 'success',
          text: `${device.device_name} turned ${action === 'on' ? 'on' : 'off'} successfully.`,
        });
      }
    } catch (requestError) {
      if (!options.silent) {
        setNotice({
          tone: 'error',
          text: requestError.message,
        });
      }
    } finally {
      setDeviceLoading(device.device_id, false);
    }
  }, [setDeviceLoading]);

  const pollDashboard = useCallback(async () => {
    if (realtimeInFlightRef.current || !lastTsRef.current) {
      return;
    }

    realtimeInFlightRef.current = true;

    try {
      const response = await fetchDashboardRealtime(lastTsRef.current);

      setDevices(response.data?.devices || []);
      setSensors(response.data?.sensors || []);
      setChartPoints((currentPoints) => {
        const mergedPoints = mergeChartPoints(currentPoints, response.data?.new_pts || []);
        return trimChartPoints(mergedPoints, response.data?.new_last_ts || lastTsRef.current);
      });

      const nextLastTs = response.data?.new_last_ts || lastTsRef.current;
      setLastTs(nextLastTs);
      lastTsRef.current = nextLastTs;
      setPollingError('');
    } catch (requestError) {
      setPollingError(requestError.message);
    } finally {
      realtimeInFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    document.title = 'IoT Dashboard';
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    saveRuleSelections(selectedRules);
  }, [selectedRules]);

  useEffect(() => {
    const nextDeviceStateSnapshot = {};

    devices.forEach((device) => {
      nextDeviceStateSnapshot[device.device_code] = device.state;

      if (
        previousDeviceStatesRef.current[device.device_code] !== undefined &&
        previousDeviceStatesRef.current[device.device_code] !== device.state
      ) {
        delete automationAttemptsRef.current[device.device_code];
      }

      if (automationAttemptsRef.current[device.device_code] === device.state) {
        delete automationAttemptsRef.current[device.device_code];
      }
    });

    previousDeviceStatesRef.current = nextDeviceStateSnapshot;
  }, [devices]);

  useEffect(() => {
    if (loading || !lastTs) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      void pollDashboard();
    }, DASHBOARD_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [lastTs, loading, pollDashboard]);

  useEffect(() => {
    if (!devices.length || !sensors.length) {
      return;
    }

    const loadingDeviceIds = new Set(
      Object.entries(loadingById)
        .filter(([, value]) => value)
        .map(([deviceId]) => Number(deviceId))
    );

    const commands = getAutomationCommands({
      devices,
      sensors,
      selections: selectedRules,
      loadingDeviceIds,
      lastAttemptedDesiredStates: automationAttemptsRef.current,
    });

    commands.forEach((command) => {
      automationAttemptsRef.current[command.device.device_code] = command.desiredState;
      void executeToggle(command.device, command.action, { silent: true });
    });
  }, [devices, sensors, selectedRules, loadingById, executeToggle]);

  const handleManualToggle = useCallback((device) => {
    delete automationAttemptsRef.current[device.device_code];
    setNotice(null);
    const action = device.state === 1 ? 'off' : 'on';
    void executeToggle(device, action, { silent: false });
  }, [executeToggle]);

  const handleRuleChange = useCallback((deviceCode, nextRule) => {
    delete automationAttemptsRef.current[deviceCode];
    setSelectedRules((current) => ({
      ...current,
      [deviceCode]: nextRule,
    }));
  }, []);

  if (loading) {
    return <LoadingState label="Loading dashboard..." />;
  }

  if (error && !devices.length && !sensors.length) {
    return (
      <ErrorState
        title="Unable to load dashboard"
        message={error}
        onAction={loadDashboard}
      />
    );
  }

  if (!devices.length && !sensors.length) {
    return (
      <EmptyState
        title="No dashboard data available"
        message="Start telemetry or device activity to populate the dashboard."
      />
    );
  }

  return (
    <div className={styles.page}>
      {notice ? (
        <div className={`${styles.notice} ${styles[notice.tone]}`}>
          {notice.text}
        </div>
      ) : null}

      {pollingError ? (
        <div className={`${styles.notice} ${styles.warning}`}>
          Realtime polling issue: {pollingError}
        </div>
      ) : null}

      <section className={styles.metricsGrid}>
        {sensorDisplayConfig.map((sensorConfig) => {
          const sensor = sensorMap[sensorConfig.code];

          return (
            <SensorMetricCard
              key={sensorConfig.code}
              accent={sensorConfig.accent}
              icon={sensorConfig.icon}
              title={getSensorCardLabel(sensor || { sensor_code: sensorConfig.code })}
              value={formatMetricValue(sensor?.value_num, sensorConfig.code)}
              unit={sensor?.unit || ''}
              subtitle={sensor?.ts ? `Updated ${formatDateTime(sensor.ts)}` : 'Waiting for telemetry'}
            />
          );
        })}
      </section>

      <section className={styles.grid}>
        <DeviceAutomationCard
          devices={devices}
          selectedRules={selectedRules}
          loadingById={loadingById}
          onToggle={handleManualToggle}
          onRuleChange={handleRuleChange}
        />
        <EnvironmentChartCard points={chartPoints} />
      </section>
    </div>
  );
}

export default DashboardPage;
