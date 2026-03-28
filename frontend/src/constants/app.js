export const APP_NAME = 'IoT Dashboard';
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:4000';
export const DASHBOARD_POLL_INTERVAL_MS = 2000;
export const CHART_WINDOW_HOURS = 3;
export const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];

export const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', key: 'dashboard' },
  { to: '/actions', label: 'Action History', key: 'actions' },
  { to: '/sensors', label: 'Sensor History', key: 'sensors' },
  { to: '/profile', label: 'Profile', key: 'profile' },
];

export const DEVICE_FILTER_OPTIONS = [
  { label: 'All Devices', value: '' },
  { label: 'LED 1', value: 'LED1' },
  { label: 'LED 2', value: 'LED2' },
  { label: 'LED 3', value: 'LED3' },
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
  name: 'Huy Tran',
  role: 'IoT Demo Developer',
  email: 'demo@iotdashboard.local',
  bio: 'Building a clean demo UI for real-time IoT monitoring, device control, and automation experiments.',
};

export const RESOURCE_LINKS = [
  {
    id: 'pdf',
    label: 'Download PDF Report',
    href: '#',
    variant: 'primary',
  },
  {
    id: 'api',
    label: 'API Doc (Swagger/Postman)',
    href: '#',
    variant: 'default',
  },
  {
    id: 'github',
    label: 'GitHub Repository',
    href: '#',
    variant: 'default',
  },
  {
    id: 'figma',
    label: 'Figma Design Files',
    href: '#',
    variant: 'default',
  },
];
