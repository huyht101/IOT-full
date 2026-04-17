export const APP_NAME = 'IoT Dashboard';
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:4000';
export const DASHBOARD_POLL_INTERVAL_MS = 2000;
export const CHART_WINDOW_HOURS = 3;
export const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];

export const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', key: 'dashboard' },
  { to: '/actions', label: 'Action History', key: 'actions' },
  { to: '/device-usage', label: 'Device Usage', key: 'deviceUsage' },
  { to: '/sensors', label: 'Sensor History', key: 'sensors' },
  { to: '/profile', label: 'Profile', key: 'profile' },
];

export const DEVICE_OPTIONS = [
  { label: 'LED 1', value: 'LED1' },
  { label: 'LED 2', value: 'LED2' },
  { label: 'LED 3', value: 'LED3' },
  { label: 'LED 4', value: 'LED4' },
  { label: 'LED 5', value: 'LED5' },
];

export const DEVICE_FILTER_OPTIONS = [
  { label: 'All Devices', value: '' },
  ...DEVICE_OPTIONS,
];

export const ACTION_FILTER_OPTIONS = [
  { label: 'All Actions', value: '' },
  { label: 'Turn On', value: 'on' },
  { label: 'Turn Off', value: 'off' },
];

export const STATUS_FILTER_OPTIONS = [
  { label: 'All Status', value: '' },
  { label: 'Waiting', value: 'PENDING' },
  { label: 'Success', value: 'SUCCESS' },
  { label: 'Fail', value: 'FAIL' },
];

export const DEVICE_USAGE_ACTION_OPTIONS = [
  { label: 'All Actions', value: 'all' },
  { label: 'Turn On', value: 'on' },
  { label: 'Turn Off', value: 'off' },
];

export const DEVICE_USAGE_STATUS_OPTIONS = [
  { label: 'All Status', value: 'all' },
  { label: 'Success', value: 'success' },
  { label: 'Fail', value: 'fail' },
];

export const DEVICE_USAGE_BUCKET_OPTIONS = [
  { label: '1 Hour', value: '1h' },
  { label: '2 Hours', value: '2h' },
  { label: '4 Hours', value: '4h' },
];

export const SENSOR_CARD_LABELS = {
  TEMP: 'Temperature',
  HUM: 'Humidity',
  LIGHT: 'Light Intensity',
};

export const SENSOR_TYPE_LABELS = {
  temperature: 'Temperature',
  humidity: 'Humidity',
  light: 'Light',
};

export const PROFILE_INFO = {
  name: 'Huy Thai',
  role: 'Developer',
  email: 'huyht101@gmail.com',
  bio: 'Building a clean demo UI for real-time IoT monitoring, device control, and automation experiments.',
};

export const RESOURCE_LINKS = [
  {
    id: 'pdf',
    label: 'Open Doc Report',
    href: 'https://docs.google.com/document/d/1-e_uKYXlWosN---Pz2-7s1-Fm0nuMzZSmhLp8hTmNh8/edit?usp=sharing',
    variant: 'primary',
  },
  {
    id: 'api',
    label: 'API Doc (Swagger)',
    href: '/api-docs',
    variant: 'default',
  },
  {
    id: 'github',
    label: 'GitHub Repository',
    href: 'https://github.com/huyht101/IOT-full',
    variant: 'default',
  },
  {
    id: 'figma',
    label: 'Visily Design Files',
    href: 'https://app.visily.ai/projects/522f2cce-cabb-4c27-908d-518346f08a5b/boards/2459518',
    variant: 'default',
  },
];
