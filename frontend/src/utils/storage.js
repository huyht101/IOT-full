import { DEFAULT_RULE_SELECTIONS, RULE_OPTIONS_BY_DEVICE } from '../automation/rules';

const STORAGE_KEY = 'iot-dashboard-automation-rules';

function isStorageAvailable() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function sanitizeSelections(rawValue) {
  const nextSelections = { ...DEFAULT_RULE_SELECTIONS };

  if (!rawValue || typeof rawValue !== 'object') {
    return nextSelections;
  }

  Object.entries(RULE_OPTIONS_BY_DEVICE).forEach(([deviceCode, options]) => {
    const allowedValues = options.map((option) => option.value);
    const value = rawValue[deviceCode];

    nextSelections[deviceCode] = allowedValues.includes(value) ? value : DEFAULT_RULE_SELECTIONS[deviceCode];
  });

  return nextSelections;
}

export function loadRuleSelections() {
  if (!isStorageAvailable()) {
    return { ...DEFAULT_RULE_SELECTIONS };
  }

  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY);
    if (!rawValue) {
      return { ...DEFAULT_RULE_SELECTIONS };
    }

    return sanitizeSelections(JSON.parse(rawValue));
  } catch (error) {
    return { ...DEFAULT_RULE_SELECTIONS };
  }
}

export function saveRuleSelections(selections) {
  if (!isStorageAvailable()) {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizeSelections(selections)));
}
