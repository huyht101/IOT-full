const express = require('express');
const deviceUsageController = require('../controllers/deviceUsage.controller');

const router = express.Router();

router.get('/', deviceUsageController.getDeviceUsage);

module.exports = router;
