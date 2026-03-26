const actionRepo = require('../repositories/action.repo');
const { buildPaginationMeta } = require('../utils/validation');
const { toIsoString } = require('../utils/time');

function mapActionItem(row) {
  return {
    action_id: row.action_id,
    device_id: row.device_id,
    device_code: row.device_code,
    device_name: row.device_name,
    device_type: row.device_type,
    action: row.action,
    status: row.status,
    requested_at: toIsoString(row.requested_at),
    acked_at: toIsoString(row.acked_at),
  };
}

async function listActions(filters) {
  const [items, totalItems] = await Promise.all([
    actionRepo.listActions(filters),
    actionRepo.countActions(filters),
  ]);

  return {
    data: {
      items: items.map(mapActionItem),
    },
    meta: buildPaginationMeta(filters, totalItems),
  };
}

module.exports = {
  listActions,
};
