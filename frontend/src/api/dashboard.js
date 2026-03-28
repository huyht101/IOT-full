import { apiRequest } from './client';

export function fetchDashboard() {
  return apiRequest('/api/v1/dashboard');
}

export function fetchDashboardRealtime(since) {
  return apiRequest('/api/v1/dashboard/realtime', {
    params: { since },
  });
}
