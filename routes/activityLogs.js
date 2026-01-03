import express from "express";
import { ActivityLog } from "../models/activityLog.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";

const router = express.Router();

// List activity logs (admin only)
router.get("/", authenticate, requireAdmin, async (req, res) => {
	try {
		const { limit = 100, action } = req.query;
		const query = action ? { action } : {};

		const logs = await ActivityLog.find(query)
			.sort({ createdAt: -1 })
			.limit(Math.min(Number(limit) || 100, 500));

		res.json({ logs });
	} catch (error) {
		console.error("Failed to fetch activity logs:", error);
		res.status(500).json({ message: "Failed to fetch activity logs" });
	}
});

export default router;
