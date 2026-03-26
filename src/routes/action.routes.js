const express = require('express');
const actionController = require('../controllers/action.controller');

const router = express.Router();

router.get('/', actionController.listActions);

module.exports = router;
