import {
  Droplets,
  SunMedium,
  Thermometer,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import DeviceAutomationCard from '../components/dashboard/DeviceAutomationCard';
import EnvironmentChartCard from '../components/dashboard/EnvironmentChartCard';
import SensorMetricCard from '../components/dashboard/SensorMetricCard';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import LoadingState from '../components/common/LoadingState';
import { useDashboardRuntime } from '../context/DashboardRuntimeContext';
import {
  formatDateTime,
  formatMetricValue,
  getSensorCardLabel,
} from '../utils/format';
import styles from './DashboardPage.module.css';

const sensorDisplayConfig = [
  { code: 'TEMP', accent: 'indigo', icon: Thermometer },
  { code: 'HUM', accent: 'green', icon: Droplets },
  { code: 'LIGHT', accent: 'amber', icon: SunMedium },
];

function DashboardPage() {
  const [notice, setNotice] = useState(null);
  const {
    loading,
    error,
    pollingError,
    devices,
    sensors,
    chartPoints,
    loadingById,
    selectedRules,
    refreshDashboard,
    setRuleSelection,
    toggleDeviceAction,
  } = useDashboardRuntime();

  const sensorMap = useMemo(() => {
    return sensors.reduce((map, sensor) => {
      map[sensor.sensor_code] = sensor;
      return map;
    }, {});
  }, [sensors]);

  useEffect(() => {
    document.title = 'IoT Dashboard';
  }, []);

  const handleManualToggle = useCallback(async (device) => {
    setNotice(null);
    const action = device.state === 1 ? 'off' : 'on';

    try {
      await toggleDeviceAction(device, action, { resetAutomationAttempt: true });
      setNotice({
        tone: 'success',
        text: `${device.device_name} turned ${action === 'on' ? 'on' : 'off'} successfully.`,
      });
    } catch (requestError) {
      setNotice({
        tone: 'error',
        text: requestError.message,
      });
    }
  }, [toggleDeviceAction]);

  const handleRuleChange = useCallback((deviceCode, nextRule) => {
    setRuleSelection(deviceCode, nextRule);
  }, [setRuleSelection]);

  if (loading) {
    return <LoadingState label="Loading dashboard..." />;
  }

  if (error && !devices.length && !sensors.length) {
    return (
      <ErrorState
        title="Unable to load dashboard"
        message={error}
        onAction={refreshDashboard}
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
