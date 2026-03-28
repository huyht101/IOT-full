import { apiRequest } from './client';

export function fetchActionHistory(params) {
  return apiRequest('/api/v1/actions', { params });
}
