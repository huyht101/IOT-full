const { publishJson } = require('../config/mqtt');
const { withTransaction } = require('../config/db');
const { ACTIONS, ACTION_STATUSES } = require('../constants');
const AppError = require('../utils/appError');
const { toIsoString } = require('../utils/time');
const actionRepo = require('../repositories/action.repo');
const deviceRepo = require('../repositories/device.repo');
const ackService = require('./ack.service');

function buildResponseData(detail) {
  const base = {
    action_id: detail.action_id,
    device_id: detail.device_id,
    device_code: detail.device_code,
    action: detail.action,
    status: detail.status,
    requested_at: toIsoString(detail.requested_at),
    acked_at: toIsoString(detail.acked_at),
  };

  if (detail.status === ACTION_STATUSES.SUCCESS) {
    base.device_state = {
      state: Number(detail.device_state_state),
      updated_at: toIsoString(detail.device_state_updated_at),
      last_action_id: detail.device_state_last_action_id,
    };
  }

  return base;
}

function mapFailureMessage(reason) {
  switch (reason) {
    case 'PUBLISH_FAILED':
      return 'MQTT publish failed';
    case 'ACK_TIMEOUT':
      return 'ACK timeout';
    case 'ACK_REJECTED':
      return 'ACK reported failure';
    default:
      return 'Action failed';
  }
}

async function createPendingAction(deviceId, action) {
  let device = null;
  let actionId = null;

  await withTransaction(async (connection) => {
    device = await deviceRepo.getActiveDeviceById(connection, deviceId, { forUpdate: true });
    if (!device) {
      throw new AppError(404, 'DEVICE_NOT_FOUND', 'Active device not found');
    }

    const pending = await actionRepo.findPendingActionByDeviceId(connection, deviceId);
    if (pending) {
      throw new AppError(409, 'DEVICE_BUSY', 'Device already has a pending action');
    }

    actionId = await actionRepo.insertAction(connection, {
      deviceId,
      action,
      status: ACTION_STATUSES.PENDING,
      requestedAt: new Date(),
    });
  });

  return { device, actionId };
}

async function executeDeviceCommand(payload) {
  const { deviceId, action } = payload;

  if (action !== ACTIONS.ON && action !== ACTIONS.OFF) {
    throw new AppError(400, 'VALIDATION_ERROR', 'action must be exactly "on" or "off"');
  }

  const { device, actionId } = await createPendingAction(deviceId, action);
  const targetState = action === ACTIONS.ON ? 1 : 0;
  const pendingOutcome = ackService.registerPendingAction({
    actionId,
    deviceId,
    targetState,
  });

  try {
    await publishJson(process.env.MQTT_TOPIC_CMD, {
      action_id: actionId,
      device_code: device.device_code,
      action,
    });
  } catch (error) {
    console.error(`MQTT publish failed for action ${actionId}:`, error.message);
    await ackService.failPendingAction(actionId, 'PUBLISH_FAILED');
  }

  const outcome = await pendingOutcome;
  const detail = await actionRepo.getActionDetailById(actionId);

  if (!detail) {
    throw new AppError(500, 'ACTION_LOOKUP_FAILED', 'Unable to load action result');
  }

  const data = buildResponseData(detail);

  if (detail.status === ACTION_STATUSES.SUCCESS) {
    return {
      success: true,
      data,
    };
  }

  return {
    success: false,
    reason: outcome.reason,
    errorCode: 'ACTION_FAILED',
    message: mapFailureMessage(outcome.reason),
    data,
  };
}

module.exports = {
  executeDeviceCommand,
};
