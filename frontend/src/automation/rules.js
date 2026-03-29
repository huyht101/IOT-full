export const AUTOMATION_NONE = 'none';

export const RULE_DEFINITIONS = {
  rule1: {
    id: 'rule1',
    label: 'Rule 1',
    description: 'If temperature is above 30 then the device turns on, otherwise it turns off.',
    evaluate(sensorLookup) {
      const temp = sensorLookup.TEMP?.value_num;
      if (temp === null || temp === undefined) {
        return null;
      }

      return temp > 30 ? 1 : 0;
    },
  },
  rule2: {
    id: 'rule2',
    label: 'Rule 2',
    description: 'If light is below 1000 then the device turns on, otherwise it turns off.',
    evaluate(sensorLookup) {
      const light = sensorLookup.LIGHT?.value_num;
      if (light === null || light === undefined) {
        return null;
      }

      return light < 1000 ? 1 : 0;
    },
  },
  rule3: {
    id: 'rule3',
    label: 'Rule 3',
    description: 'If humidity is above 80 then the device turns off, otherwise it turns on.',
    evaluate(sensorLookup) {
      const hum = sensorLookup.HUM?.value_num;
      if (hum === null || hum === undefined) {
        return null;
      }

      return hum > 80 ? 0 : 1;
    },
  },
};

export const RULE_OPTIONS = Object.freeze([
  { label: 'None', value: AUTOMATION_NONE },
  { label: 'Rule 1', value: 'rule1' },
  { label: 'Rule 2', value: 'rule2' },
  { label: 'Rule 3', value: 'rule3' },
]);

export const RULE_OPTIONS_BY_DEVICE = Object.freeze({
  LED1: RULE_OPTIONS,
  LED2: RULE_OPTIONS,
  LED3: RULE_OPTIONS,
});

export const DEFAULT_RULE_SELECTIONS = {
  LED1: AUTOMATION_NONE,
  LED2: AUTOMATION_NONE,
  LED3: AUTOMATION_NONE,
};

export function buildSensorLookup(sensors = []) {
  return sensors.reduce((lookup, sensor) => {
    if (sensor?.sensor_code) {
      lookup[sensor.sensor_code] = sensor;
    }

    return lookup;
  }, {});
}

export function evaluateRuleForDevice(deviceCode, selectedRule, sensors) {
  if (!selectedRule || selectedRule === AUTOMATION_NONE) {
    return null;
  }

  const definition = RULE_DEFINITIONS[selectedRule];
  if (!definition) {
    return null;
  }

  return definition.evaluate(buildSensorLookup(sensors));
}

export function getRuleDescription(ruleValue) {
  if (!ruleValue || ruleValue === AUTOMATION_NONE) {
    return 'Manual control only';
  }

  return RULE_DEFINITIONS[ruleValue]?.description || 'Manual control only';
}
