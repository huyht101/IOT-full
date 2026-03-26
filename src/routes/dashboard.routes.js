const express = require('express');
const dashboardController = require('../controllers/dashboard.controller');

const router = express.Router();

router.get('/', dashboardController.getDashboard);
router.get('/realtime', dashboardController.getRealtimeDashboard);

module.exports = router;
