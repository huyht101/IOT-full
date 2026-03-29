import { ArrowDownUp, Droplets, Search, SunMedium, Thermometer } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchSensorHistory } from '../api/sensors';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import LoadingState from '../components/common/LoadingState';
import Pagination from '../components/common/Pagination';
import SearchField from '../components/common/SearchField';
import SelectField from '../components/common/SelectField';
import { PAGE_SIZE_OPTIONS } from '../constants/app';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import {
  formatDateTime,
  formatSensorValue,
  getSensorTypeLabel,
} from '../utils/format';
import styles from './SensorHistoryPage.module.css';

const iconMap = {
  TEMP: Thermometer,
  HUM: Droplets,
  LIGHT: SunMedium,
};

const SENSOR_HISTORY_POLL_INTERVAL_MS = 5000;

function SensorHistoryPage() {
  const [query, setQuery] = useState('');
  const [sortDir, setSortDir] = useState('desc');
  const [pageSize, setPageSize] = useState(5);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const debouncedQuery = useDebouncedValue(query, 400);
  const requestInFlightRef = useRef(false);
  const queuedRefreshRef = useRef(false);
  const mountedRef = useRef(true);
  const latestParamsRef = useRef({
    page: 1,
    pageSize: 5,
    q: '',
    sortDir: 'desc',
  });

  useEffect(() => {
    latestParamsRef.current = {
      page,
      pageSize,
      q: debouncedQuery,
      sortDir,
    };
  }, [page, pageSize, debouncedQuery, sortDir]);

  const loadSensors = useCallback(async (options = {}) => {
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
      const response = await fetchSensorHistory({
        page: currentParams.page,
        page_size: currentParams.pageSize,
        q: currentParams.q,
        sort_by: 'reading_id',
        sort_dir: currentParams.sortDir,
      });

      if (!mountedRef.current) {
        return;
      }

      setItems(response.data?.items || []);
      setMeta(response.meta);
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
        void loadSensors({ background: true });
      }
    }
  }, []);

  useEffect(() => {
    document.title = 'IoT Dashboard | Sensor History';
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    void loadSensors();
  }, [loadSensors, page, pageSize, debouncedQuery, sortDir]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (document.hidden) {
        return;
      }

      void loadSensors({ background: true });
    }, SENSOR_HISTORY_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadSensors]);

  const retryLoad = () => {
    void loadSensors();
  };

  if (loading && !items.length) {
    return <LoadingState label="Loading sensor history..." />;
  }

  if (error && !items.length) {
    return (
      <ErrorState
        title="Unable to load sensor history"
        message={error}
        onAction={retryLoad}
      />
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Sensor History</h1>
      </div>

      <section className={styles.toolbar}>
        <SearchField
          value={query}
          onChange={(value) => {
            setQuery(value);
            setPage(1);
          }}
          placeholder="Search sensor readings..."
        />
        <button
          type="button"
          className={styles.sortButton}
          onClick={() => {
            setSortDir((current) => (current === 'desc' ? 'asc' : 'desc'));
            setPage(1);
          }}
        >
          <ArrowDownUp size={16} />
          Sort {sortDir === 'asc' ? 'Ascending' : 'Descending'}
        </button>
      </section>

      <section className={styles.card}>
        {error && items.length ? (
          <div className={styles.inlineError}>{error}</div>
        ) : null}

        {items.length ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Sensor</th>
                  <th>Type</th>
                  <th>Value</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const Icon = iconMap[item.sensor_code] || Search;

                  return (
                    <tr key={item.reading_id}>
                      <td>{item.reading_id}</td>
                      <td>
                        <div className={styles.sensorCell}>
                          <span className={styles.sensorIcon}>
                            <Icon size={16} strokeWidth={1.9} />
                          </span>
                          <span>{item.sensor_name || item.sensor_code}</span>
                        </div>
                      </td>
                      <td>{getSensorTypeLabel(item.sensor_type)}</td>
                      <td>{formatSensorValue(item.value_num, item.unit)}</td>
                      <td>{formatDateTime(item.ts)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No sensor readings found"
            message="Try a different search term or wait for new telemetry readings."
          />
        )}

        <div className={styles.footerRow}>
          <div className={styles.pageSizeControl}>
            <span>Page Size:</span>
            <div className={styles.pageSizeSelect}>
              <SelectField
                ariaLabel="Sensor history page size"
                value={String(pageSize)}
                options={PAGE_SIZE_OPTIONS.map((size) => ({
                  label: String(size),
                  value: String(size),
                }))}
                onChange={(value) => {
                  setPageSize(Number(value));
                  setPage(1);
                }}
              />
            </div>
          </div>

          <Pagination
            page={meta?.page || page}
            totalPages={meta?.total_pages || 0}
            onPageChange={setPage}
            disabled={loading}
          />
        </div>
      </section>
    </div>
  );
}

export default SensorHistoryPage;
