const { withTransaction } = require('../config/db');
const { ACTION_STATUSES } = require('../constants');
const actionRepo = require('../repositories/action.repo');
const deviceRepo = require('../repositories/device.repo');

const pendingAckMap = new Map();

function normalizeAckPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    console.warn('Ignoring malformed ACK payload: expected object');
    return null;
  }

  const actionId = Number(payload.action_id);
  const success = payload.success;

  if (!Number.isInteger(actionId) || actionId < 1) {
    console.warn('Ignoring malformed ACK payload: invalid action_id');
    return null;
  }

  if (typeof success !== 'boolean') {
    console.warn('Ignoring malformed ACK payload: invalid success flag');
    return null;
  }

  return { actionId, success };
}

async function failPendingAction(actionId, reason) {
  const entry = pendingAckMap.get(actionId);
  if (!entry) {
    return {
      finalStatus: ACTION_STATUSES.FAIL,
      reason,
      ackedAt: null,
    };
  }

  const ackedAt = new Date();
  clearTimeout(entry.timeoutHandle);
  pendingAckMap.delete(actionId);

  try {
    await actionRepo.updateActionStatusIfPending(null, {
      actionId,
      status: ACTION_STATUSES.FAIL,
      ackedAt,
    });
  } catch (error) {
    console.error(`Failed to mark action ${actionId} as FAIL:`, error);
  }

  entry.resolve({
    finalStatus: ACTION_STATUSES.FAIL,
    reason,
    ackedAt,
  });

  return {
    finalStatus: ACTION_STATUSES.FAIL,
    reason,
    ackedAt,
  };
}

function registerPendingAction(payload) {
  const timeoutMs = Number(process.env.ACK_TIMEOUT_MS || 5000);
  const { actionId } = payload;

  return new Promise((resolve) => {
    const timeoutHandle = setTimeout(async () => {
      try {
        await failPendingAction(actionId, 'ACK_TIMEOUT');
      } catch (error) {
        console.error(`Failed to mark timeout for action ${actionId}:`, error);
        resolve({
          finalStatus: ACTION_STATUSES.FAIL,
          reason: 'ACK_TIMEOUT',
          ackedAt: new Date(),
        });
      }
    }, timeoutMs);

    pendingAckMap.set(actionId, {
      ...payload,
      timeoutHandle,
      resolve,
    });
  });
}

async function handleAckPayload(payload) {
  const normalized = normalizeAckPayload(payload);
  if (!normalized) {
    return false;
  }

  const entry = pendingAckMap.get(normalized.actionId);
  if (!entry) {
    console.warn(`Ignoring ACK for action ${normalized.actionId}: no pending entry`);
    return false;
  }

  clearTimeout(entry.timeoutHandle);
  pendingAckMap.delete(normalized.actionId);

  const ackedAt = new Date();

  try {
    if (normalized.success) {
      const updated = await withTransaction(async (connection) => {
        const affectedRows = await actionRepo.updateActionStatusIfPending(connection, {
          actionId: normalized.actionId,
          status: ACTION_STATUSES.SUCCESS,
          ackedAt,
        });

        if (!affectedRows) {
          return false;
        }

        await deviceRepo.updateDeviceStateFromAck(connection, {
          deviceId: entry.deviceId,
          state: entry.targetState,
          updatedAt: ackedAt,
          lastActionId: normalized.actionId,
        });

        return true;
      });

      entry.resolve({
        finalStatus: updated ? ACTION_STATUSES.SUCCESS : ACTION_STATUSES.FAIL,
        reason: updated ? 'ACK_SUCCESS' : 'IGNORED_ACK',
        ackedAt,
      });

      return updated;
    }

    await actionRepo.updateActionStatusIfPending(null, {
      actionId: normalized.actionId,
      status: ACTION_STATUSES.FAIL,
      ackedAt,
    });

    entry.resolve({
      finalStatus: ACTION_STATUSES.FAIL,
      reason: 'ACK_REJECTED',
      ackedAt,
    });

    return true;
  } catch (error) {
    console.error(`Failed to process ACK for action ${normalized.actionId}:`, error);
    entry.resolve({
      finalStatus: ACTION_STATUSES.FAIL,
      reason: 'ACK_PROCESSING_ERROR',
      ackedAt,
    });
    return false;
  }
}

module.exports = {
  registerPendingAction,
  failPendingAction,
  handleAckPayload,
};
