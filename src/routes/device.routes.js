const express = require('express');
const deviceController = require('../controllers/device.controller');

const router = express.Router();

router.post('/:device_id/toggle', deviceController.toggleDevice);

module.exports = router;
