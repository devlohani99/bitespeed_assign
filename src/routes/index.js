const express = require('express');
const router = express.Router();
const identifyController = require('../controllers/IdentifyController');

// Friendly greeting for browsers visiting the root domain
router.get('/', (req, res) => {
    res.json({
        message: "Welcome to the Bitespeed Identity Reconciliation API!",
        instructions: {
            step1: "Open Postman or any HTTP client.",
            step2: "Set the method to POST.",
            step3: "Use the endpoint: /identify",
            step4: "Send a JSON body like: { \"email\": \"lorraine@hillvalley.edu\", \"phoneNumber\": \"123456\" }"
        }
    });
});
const IdentifyController = require('../controllers/IdentifyController');

router.post('/identify', IdentifyController.handleIdentify);

module.exports = router;
