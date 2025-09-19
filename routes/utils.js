import express from "express";
import { Util } from "../models/util.js";
import { multiMails, sendContactUsMail } from "../utils/mailer.js";
import { updateCoinPricesFromAPI, fetchCryptoPrices } from "../utils/cryptoPrices.js";

const router = express.Router();

// getting all utils
router.get("/", async (req, res) => {
	try {
		const utils = await Util.find();
		res.send(utils[0]);
	} catch (x) {
		return res.status(500).send("Something Went Wrong...");
	}
});

// updating a util
router.put("/update/:id", async (req, res) => {
	const { id } = req.params;

	try {
		const util = await Util.findByIdAndUpdate(
			id,
			{
				$set: req.body,
			},
			{
				new: true,
				runValidators: true,
			},
		);

		if (!util) return res.status(404).send("Util not found");

		res.status(200).send(util);
	} catch (error) {
		for (i in error.errors) res.status(500).send(error.errors[i].message);
	}
});

// deleting a util
router.delete("/:id", async (req, res) => {
	const { id } = req.params;

	try {
		const util = await Util.findByIdAndRemove(id);
		if (!util) return res.status(404).send("Util not found");

		res.status(200).send(util);
	} catch (error) {
		for (i in error.errors) res.status(500).send(error.errors[i].message);
	}
});

// POST route to send mail
router.post("/send-mail", async (req, res) => {
	const { emails, subject, message } = req.body;

	if (!emails || !Array.isArray(emails) || emails.length === 0) {
		return res.status(400).json({ message: "A valid array of emails is required" });
	}

	if (!subject || !message) {
		return res.status(400).json({ message: "Subject and message are required" });
	}

	try {
		const emailData = await multiMails(emails, subject, message);
		if (emailData.error) return res.status(400).send({ message: emailData.error });

		res.status(200).json({
			message: "Emails sent successfully",
		});
	} catch (error) {
		console.error("Error sending emails:", error);
		res.status(500).json({ message: "Failed to send emails", error });
	}
});

// POST route for "Contact Us"
router.post("/contact-us", async (req, res) => {
	const { name, email, subject, message } = req.body;
	console.log(name, email, subject, message);

	// Basic validation
	if (!name || !email || !subject || !message) {
		return res.status(400).json({ message: "All fields (name, email, subject, message) are required" });
	}

	try {
		const emailData = await sendContactUsMail({
			name,
			email,
			subject,
			message,
		});

		if (emailData.error) return res.status(400).send({ message: emailData.error });

		res.status(200).json({
			message: "Contact Us message received successfully",
			data: { name, email, subject, message },
		});
	} catch (error) {
		console.error("Error in contact-us route:", error);
		res.status(500).json({ message: "Failed to process contact-us request", error });
	}
});

// Toggle maintenance mode - Admin only
router.put("/maintenance-mode", async (req, res) => {
	const { enabled, message } = req.body;

	try {
		const util = await Util.findOne();
		if (!util) return res.status(404).send({ message: "Utils not found" });

		util.maintenanceMode = {
			enabled: enabled !== undefined ? enabled : util.maintenanceMode.enabled,
			message: message || util.maintenanceMode.message,
			updatedAt: new Date()
		};

		await util.save();
		res.status(200).json({
			message: `Maintenance mode ${enabled ? 'enabled' : 'disabled'}`,
			maintenanceMode: util.maintenanceMode
		});
	} catch (error) {
		console.error("Error updating maintenance mode:", error);
		res.status(500).json({ message: "Failed to update maintenance mode" });
	}
});

// Get maintenance status - Public endpoint
router.get("/maintenance-status", async (req, res) => {
	try {
		const util = await Util.findOne();
		if (!util) {
			return res.status(200).json({ 
				enabled: false, 
				message: "System is operational" 
			});
		}

		res.status(200).json({
			enabled: util.maintenanceMode?.enabled || false,
			message: util.maintenanceMode?.message || "System is operational"
		});
	} catch (error) {
		console.error("Error checking maintenance status:", error);
		res.status(200).json({ enabled: false, message: "System is operational" });
	}
});

// Get coins with live prices
router.get("/coins-with-prices", async (req, res) => {
	try {
		const util = await Util.findOne();
		if (!util || !util.coins || util.coins.length === 0) {
			return res.status(200).json({ coins: [] });
		}

		// Update coins with live API prices
		const coinsWithPrices = await updateCoinPricesFromAPI(util.coins);
		
		res.status(200).json({ 
			coins: coinsWithPrices,
			lastUpdated: new Date().toISOString()
		});
	} catch (error) {
		console.error("Error fetching coins with prices:", error);
		res.status(500).json({ message: "Failed to fetch coin prices" });
	}
});

// Get live crypto prices for specific coins
router.post("/crypto-prices", async (req, res) => {
	try {
		const { coinSymbols } = req.body;
		
		if (!coinSymbols || !Array.isArray(coinSymbols)) {
			return res.status(400).json({ message: "coinSymbols array is required" });
		}

		const prices = await fetchCryptoPrices(coinSymbols);
		
		res.status(200).json({ 
			prices,
			timestamp: new Date().toISOString()
		});
	} catch (error) {
		console.error("Error fetching crypto prices:", error);
		res.status(500).json({ message: "Failed to fetch crypto prices" });
	}
});

export default router;
