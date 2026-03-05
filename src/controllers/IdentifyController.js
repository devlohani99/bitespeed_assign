const IdentifyService = require('../services/IdentifyService');

class IdentifyController {
    async handleIdentify(req, res) {
        try {
            const { email, phoneNumber } = req.body;
            const result = await IdentifyService.identifyContact(email, phoneNumber);
            return res.status(200).json(result);
        } catch (error) {
            if (error.message === "Email or phoneNumber is required") {
                return res.status(400).json({ error: error.message });
            }
            console.error("Error identifying contact:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    }
}

module.exports = new IdentifyController();
