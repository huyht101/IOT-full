import { useEffect, useState } from 'react';
import { fetchActionHistory } from '../api/actions';
import Badge from '../components/common/Badge';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import LoadingState from '../components/common/LoadingState';
import Pagination from '../components/common/Pagination';
import SearchField from '../components/common/SearchField';
import SelectField from '../components/common/SelectField';
import {
  ACTION_FILTER_OPTIONS,
  DEVICE_FILTER_OPTIONS,
  PAGE_SIZE_OPTIONS,
  STATUS_FILTER_OPTIONS,
} from '../constants/app';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import {
  formatActionLabel,
  formatDateTime,
  formatStatusLabel,
} from '../utils/format';
import styles from './ActionHistoryPage.module.css';

function getActionTone(action) {
  return action === 'off' ? 'danger' : 'success';
}

function getStatusTone(status) {
  if (status === 'SUCCESS') {
    return 'accent';
  }

  if (status === 'FAIL') {
    return 'danger';
  }

  return 'warning';
}

function ActionHistoryPage() {
  const [query, setQuery] = useState('');
  const [deviceCode, setDeviceCode] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [pageSize, setPageSize] = useState(5);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const debouncedQuery = useDebouncedValue(query, 400);

  useEffect(() => {
    document.title = 'IoT Dashboard | Action History';
  }, []);

  useEffect(() => {
    let active = true;

    async function loadActions() {
      setLoading(true);
      setError('');

      try {
        const response = await fetchActionHistory({
          page,
          page_size: pageSize,
          q: debouncedQuery,
          device_code: deviceCode,
          action: actionFilter,
          status: statusFilter,
          sort_by: 'requested_at',
          sort_dir: 'desc',
        });

        if (!active) {
          return;
        }

        setItems(response.data?.items || []);
        setMeta(response.meta);
      } catch (requestError) {
        if (!active) {
          return;
        }

        setError(requestError.message);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadActions();

    return () => {
      active = false;
    };
  }, [page, pageSize, debouncedQuery, deviceCode, actionFilter, statusFilter, refreshKey]);

  const retryLoad = () => {
    setRefreshKey((value) => value + 1);
  };

  if (loading && !items.length) {
    return <LoadingState label="Loading action history..." />;
  }

  if (error && !items.length) {
    return (
      <ErrorState
        title="Unable to load action history"
        message={error}
        onAction={retryLoad}
      />
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Action History</h1>
      </div>

      <section className={styles.card}>
        <div className={styles.filters}>
          <SearchField
            value={query}
            onChange={(value) => {
              setQuery(value);
              setPage(1);
            }}
            placeholder="Search actions..."
          />
          <SelectField
            ariaLabel="Filter devices"
            value={deviceCode}
            options={DEVICE_FILTER_OPTIONS}
            onChange={(value) => {
              setDeviceCode(value);
              setPage(1);
            }}
          />
          <SelectField
            ariaLabel="Filter action"
            value={actionFilter}
            options={ACTION_FILTER_OPTIONS}
            onChange={(value) => {
              setActionFilter(value);
              setPage(1);
            }}
          />
          <SelectField
            ariaLabel="Filter status"
            value={statusFilter}
            options={STATUS_FILTER_OPTIONS}
            onChange={(value) => {
              setStatusFilter(value);
              setPage(1);
            }}
          />
        </div>

        {error && items.length ? (
          <div className={styles.inlineError}>{error}</div>
        ) : null}

        {items.length ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Device Name</th>
                  <th>Action</th>
                  <th>Time</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.action_id}>
                    <td>{item.action_id}</td>
                    <td>{item.device_name}</td>
                    <td>
                      <Badge tone={getActionTone(item.action)}>
                        {formatActionLabel(item.action)}
                      </Badge>
                    </td>
                    <td>{formatDateTime(item.requested_at)}</td>
                    <td>
                      <Badge tone={getStatusTone(item.status)}>
                        {formatStatusLabel(item.status)}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No actions found"
            message="Try adjusting the search or filters to see more action records."
          />
        )}

        <div className={styles.footerRow}>
          <div className={styles.pageSizeControl}>
            <span>Page Size:</span>
            <div className={styles.pageSizeSelect}>
              <SelectField
                ariaLabel="Action history page size"
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

          <div className={styles.paginationBlock}>
            <span className={styles.pageInfo}>
              Page {meta?.page || 1} of {meta?.total_pages || 0}
            </span>
            <Pagination
              page={meta?.page || page}
              totalPages={meta?.total_pages || 0}
              onPageChange={setPage}
              disabled={loading}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

export default ActionHistoryPage;
