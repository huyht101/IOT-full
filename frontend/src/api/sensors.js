import { apiRequest } from './client';

export function fetchSensorHistory(params) {
  return apiRequest('/api/v1/sensor-readings', { params });
}
