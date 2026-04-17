export const AUTOMATION_NONE = 'none';

export const RULE_DEFINITIONS = {
  rule1: {
    id: 'rule1',
    label: 'temp>30',
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
    label: 'Light<1500',
    description: 'If light is below 1500 then the device turns on, otherwise it turns off.',
    evaluate(sensorLookup) {
      const light = sensorLookup.LIGHT?.value_num;
      if (light === null || light === undefined) {
        return null;
      }

      return light < 1500 ? 1 : 0;
    },
  },
  rule3: {
    id: 'rule3',
    label: 'Humid>80',
    description: 'If humidity is above 80 then the device turns off, otherwise it turns on.',
    evaluate(sensorLookup) {
      const hum = sensorLookup.HUM?.value_num;
      if (hum === null || hum === undefined) {
        return null;
      }

      return hum > 80 ? 0 : 1;
    },
  },
  rule4: {
    id: 'rule4',
    label: 'ON',
    description: 'Always ON',
    evaluate(sensorLookup) {
      return 1;
    },
  },
  rule5: {
    id: 'rule5',
    label: 'OFF',
    description: 'Always OFF',
    evaluate(sensorLookup) {
      return 0;
    },
  },
};

export const RULE_OPTIONS = Object.freeze([
  { label: 'None', value: AUTOMATION_NONE },
  { label: 'TEMP>30', value: 'rule1' },
  { label: 'LIGHT<1500', value: 'rule2' },
  { label: 'HUMID>80', value: 'rule3' },
  { label: 'ON', value: 'rule4' },
  { label: 'OFF', value: 'rule5' },
]);

export const RULE_OPTIONS_BY_DEVICE = Object.freeze({
  LED1: RULE_OPTIONS,
  LED2: RULE_OPTIONS,
  LED3: RULE_OPTIONS,
  LED4: RULE_OPTIONS,
  LED5: RULE_OPTIONS,
});

export const DEFAULT_RULE_SELECTIONS = {
  LED1: AUTOMATION_NONE,
  LED2: AUTOMATION_NONE,
  LED3: AUTOMATION_NONE,
  LED4: AUTOMATION_NONE,
  LED5: AUTOMATION_NONE,
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
