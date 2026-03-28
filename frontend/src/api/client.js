import { API_BASE_URL } from '../constants/app';

export class ApiError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = options.status ?? 0;
    this.code = options.code ?? 'API_ERROR';
    this.data = options.data ?? null;
    this.payload = options.payload ?? null;
  }
}

function buildUrl(path, params) {
  const url = new URL(path, API_BASE_URL.endsWith('/') ? API_BASE_URL : `${API_BASE_URL}/`);

  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }

    url.searchParams.set(key, String(value));
  });

  return url.toString();
}

export async function apiRequest(path, options = {}) {
  const { params, body, headers, ...fetchOptions } = options;

  let response;

  try {
    response = await fetch(buildUrl(path, params), {
      ...fetchOptions,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    throw new ApiError('Unable to connect to the backend. Please check the API server.', {
      status: 0,
      code: 'NETWORK_ERROR',
    });
  }

  let payload = null;

  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }

  if (!response.ok || payload?.ok === false) {
    const message = payload?.error?.message || `Request failed with status ${response.status}`;
    throw new ApiError(message, {
      status: response.status,
      code: payload?.error?.code,
      data: payload?.data,
      payload,
    });
  }

  return {
    data: payload?.data ?? null,
    meta: payload?.meta ?? null,
  };
}
