import { AUTOMATION_NONE, evaluateRuleForDevice } from './rules';

export function getAutomationCommands({
  devices = [],
  sensors = [],
  selections = {},
  loadingDeviceIds = new Set(),
  lastAttemptedDesiredStates = {},
}) {
  return devices.flatMap((device) => {
    const selectedRule = selections[device.device_code] || AUTOMATION_NONE;
    const desiredState = evaluateRuleForDevice(device.device_code, selectedRule, sensors);

    if (desiredState === null || device.state === null || device.state === undefined) {
      return [];
    }

    if (desiredState === device.state) {
      return [];
    }

    if (loadingDeviceIds.has(device.device_id)) {
      return [];
    }

    if (lastAttemptedDesiredStates[device.device_code] === desiredState) {
      return [];
    }

    return [{
      device,
      desiredState,
      action: desiredState === 1 ? 'on' : 'off',
      selectedRule,
    }];
  });
}
