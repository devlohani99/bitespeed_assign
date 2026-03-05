const express = require('express');
const router = express.Router();
const IdentifyController = require('../controllers/IdentifyController');

router.post('/identify', IdentifyController.handleIdentify);

module.exports = router;
