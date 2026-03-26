const deviceCommandService = require('./deviceCommand.service');

async function toggleDevice(payload) {
  return deviceCommandService.executeDeviceCommand(payload);
}

module.exports = {
  toggleDevice,
};
