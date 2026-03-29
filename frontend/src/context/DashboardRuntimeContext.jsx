import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { fetchDashboard, fetchDashboardRealtime } from '../api/dashboard';
import { toggleDevice } from '../api/devices';
import { getAutomationCommands } from '../automation/engine';
import { DASHBOARD_POLL_INTERVAL_MS } from '../constants/app';
import { mergeChartPoints, normalizeChartPoints, trimChartPoints } from '../utils/chart';
import { loadRuleSelections, saveRuleSelections } from '../utils/storage';

const DashboardRuntimeContext = createContext(null);

function updateDeviceStateList(devices, deviceId, patch) {
  return devices.map((device) => {
    if (device.device_id !== deviceId) {
      return device;
    }

    return { ...device, ...patch };
  });
}

export function DashboardRuntimeProvider({ children }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pollingError, setPollingError] = useState('');
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

  const refreshDashboard = useCallback(async () => {
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

  const toggleDeviceAction = useCallback(async (device, action, options = {}) => {
    if (options.resetAutomationAttempt) {
      delete automationAttemptsRef.current[device.device_code];
    }

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

      return response;
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

  const setRuleSelection = useCallback((deviceCode, nextRule) => {
    delete automationAttemptsRef.current[deviceCode];
    setSelectedRules((current) => ({
      ...current,
      [deviceCode]: nextRule,
    }));
  }, []);

  useEffect(() => {
    void refreshDashboard();
  }, [refreshDashboard]);

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
      void toggleDeviceAction(command.device, command.action);
    });
  }, [devices, sensors, selectedRules, loadingById, toggleDeviceAction]);

  const value = useMemo(() => ({
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
  }), [
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
  ]);

  return (
    <DashboardRuntimeContext.Provider value={value}>
      {children}
    </DashboardRuntimeContext.Provider>
  );
}

export function useDashboardRuntime() {
  const context = useContext(DashboardRuntimeContext);

  if (!context) {
    throw new Error('useDashboardRuntime must be used inside DashboardRuntimeProvider');
  }

  return context;
}
