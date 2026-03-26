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

function getPendingEntry(actionId) {
  return pendingAckMap.get(actionId) || null;
}

function settlePendingEntry(actionId, entry, outcome, options = {}) {
  entry.finalizing = false;

  if (!entry.settled) {
    entry.settled = true;
    entry.resolve(outcome);
  }

  if (options.keepEntry) {
    return outcome;
  }

  pendingAckMap.delete(actionId);
  return outcome;
}

function markEntryUnrecoverable(actionId, entry, outcome, errors) {
  entry.finalizing = false;
  entry.unrecoverable = true;

  console.error(
    `UNRECOVERABLE action finalization failure for action ${actionId}. Action may still be PENDING.`
  );

  if (errors.primaryError) {
    console.error('Primary finalization error:', errors.primaryError);
  }

  if (errors.fallbackError) {
    console.error('Fallback finalization error:', errors.fallbackError);
  }

  return settlePendingEntry(actionId, entry, outcome, { keepEntry: true });
}

function startFinalization(actionId) {
  const entry = getPendingEntry(actionId);
  if (!entry) {
    return null;
  }

  if (entry.unrecoverable) {
    console.error(`Ignoring finalization for action ${actionId}: action is in unrecoverable state`);
    return null;
  }

  if (entry.finalizing) {
    console.warn(`Ignoring duplicate finalization for action ${actionId}: already finalizing`);
    return null;
  }

  entry.finalizing = true;
  clearTimeout(entry.timeoutHandle);
  return entry;
}

async function finalizeAsFail(actionId, ackedAt) {
  return actionRepo.updateActionStatusIfPending(null, {
    actionId,
    status: ACTION_STATUSES.FAIL,
    ackedAt,
  });
}

async function finalizeAsSuccess(actionId, entry, ackedAt) {
  return withTransaction(async (connection) => {
    const affectedRows = await actionRepo.updateActionStatusIfPending(connection, {
      actionId,
      status: ACTION_STATUSES.SUCCESS,
      ackedAt,
    });

    if (!affectedRows) {
      return 0;
    }

    await deviceRepo.updateDeviceStateFromAck(connection, {
      deviceId: entry.deviceId,
      state: entry.targetState,
      updatedAt: ackedAt,
      lastActionId: actionId,
    });

    return affectedRows;
  });
}

async function finalizePendingAction(actionId, options) {
  const entry = startFinalization(actionId);
  if (!entry) {
    return null;
  }

  const outcome = {
    finalStatus: options.targetStatus,
    reason: options.reason,
    ackedAt: options.ackedAt,
  };

  try {
    const affectedRows = options.targetStatus === ACTION_STATUSES.SUCCESS
      ? await finalizeAsSuccess(actionId, entry, options.ackedAt)
      : await finalizeAsFail(actionId, options.ackedAt);

    if (!affectedRows) {
      return settlePendingEntry(actionId, entry, {
        finalStatus: ACTION_STATUSES.FAIL,
        reason: options.targetStatus === ACTION_STATUSES.SUCCESS ? 'IGNORED_ACK' : options.reason,
        ackedAt: options.ackedAt,
      });
    }

    return settlePendingEntry(actionId, entry, outcome);
  } catch (error) {
    if (options.targetStatus === ACTION_STATUSES.SUCCESS) {
      console.error(
        `ACK success finalization failed for action ${actionId}. Trying FAIL fallback.`,
        error
      );

      try {
        await finalizeAsFail(actionId, options.ackedAt);

        return settlePendingEntry(actionId, entry, {
          finalStatus: ACTION_STATUSES.FAIL,
          reason: 'ACK_PROCESSING_ERROR',
          ackedAt: options.ackedAt,
        });
      } catch (fallbackError) {
        return markEntryUnrecoverable(
          actionId,
          entry,
          {
            finalStatus: ACTION_STATUSES.FAIL,
            reason: 'ACK_PROCESSING_ERROR',
            ackedAt: options.ackedAt,
          },
          {
            primaryError: error,
            fallbackError,
          }
        );
      }
    }

    return markEntryUnrecoverable(
      actionId,
      entry,
      {
        finalStatus: ACTION_STATUSES.FAIL,
        reason: options.reason,
        ackedAt: options.ackedAt,
      },
      {
        primaryError: error,
      }
    );
  }
}

async function failPendingAction(actionId, reason) {
  const outcome = await finalizePendingAction(actionId, {
    targetStatus: ACTION_STATUSES.FAIL,
    reason,
    ackedAt: new Date(),
  });

  return outcome || {
    finalStatus: ACTION_STATUSES.FAIL,
    reason,
    ackedAt: null,
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
      finalizing: false,
      settled: false,
      unrecoverable: false,
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

  const entry = getPendingEntry(normalized.actionId);
  if (!entry) {
    console.warn(`Ignoring ACK for action ${normalized.actionId}: no pending entry`);
    return false;
  }

  if (entry.unrecoverable) {
    console.error(`Ignoring ACK for action ${normalized.actionId}: action is in unrecoverable state`);
    return false;
  }

  const outcome = await finalizePendingAction(normalized.actionId, {
    targetStatus: normalized.success ? ACTION_STATUSES.SUCCESS : ACTION_STATUSES.FAIL,
    reason: normalized.success ? 'ACK_SUCCESS' : 'ACK_REJECTED',
    ackedAt: new Date(),
  });

  return Boolean(outcome);
}

module.exports = {
  registerPendingAction,
  failPendingAction,
  handleAckPayload,
};
