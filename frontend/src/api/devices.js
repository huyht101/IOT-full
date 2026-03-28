import { apiRequest } from './client';

export function toggleDevice(deviceId, action) {
  return apiRequest(`/api/v1/devices/${deviceId}/toggle`, {
    method: 'POST',
    body: { action },
  });
}
