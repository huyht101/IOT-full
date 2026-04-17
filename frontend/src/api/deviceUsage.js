import { apiRequest } from './client';

export function fetchDeviceUsage(params) {
  return apiRequest('/api/v1/device-usage', {
    params,
  });
}
