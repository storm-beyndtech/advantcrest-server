import bcrypt from "bcrypt";
import express from "express";
import { User, validateUser, validateLogin } from "../models/user.js";
import { passwordReset, welcomeMail, otpMail } from "../utils/mailer.js";
import { Otp } from "../models/otp.js";
import speakeasy from "speakeasy";
import qrcode from "qrcode";

import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import { googleLogin } from "../utils/googleLoginController.js";
import { verifyOtp } from "../utils/verifyOtp.js";
import { authenticate, requireAdmin, requireSelfOrAdmin } from "../middleware/auth.js";
import { logActivity } from "../utils/activityLogger.js";

// Configure Cloudinary
cloudinary.config({
	cloud_name: process.env.CLOUD_NAME,
	api_key: process.env.CLOUD_API_KEY,
	api_secret: process.env.CLOUD_API_SECRET,
});

// Configure Multer with Cloudinary storage
const storage = new CloudinaryStorage({
	cloudinary: cloudinary,
	params: {
		folder: "profile",
		allowed_formats: ["jpg", "jpeg", "png", "gif"],
		transformation: [{ width: 500, height: 500, crop: "limit" }],
	},
});

export const upload = multer({ storage: storage });

const router = express.Router();

//Get QR Code For 2FA
router.get("/getQrcode", authenticate, async (req, res) => {
	const secret = speakeasy.generateSecret({ name: "ameritrades" });

	qrcode.toDataURL(secret.otpauth_url, (err, data) => {
		res.send({ imgSrc: data, secret });
	});
});

// GET /referrals/:username
router.get("/referrals/:username", authenticate, async (req, res) => {
	const { username } = req.params;

	if (!req.user.isAdmin && req.user.username !== username) {
		return res.status(403).json({ message: "Forbidden" });
	}

	try {
		// Find all users referred by the given username
		const referrals = await User.find({ referredBy: username }).select("username createdAt");

		res.status(200).json(
			referrals.map((ref) => ({
				username: ref.username,
				date: ref.createdAt,
			})),
		);
	} catch (error) {
		console.error("Error fetching referrals:", error);
		res.status(500).json({ message: "Server error while fetching referrals." });
	}
});

router.get("/:id", authenticate, async (req, res) => {
	try {
		let user = await User.findById(req.params.id);
		if (!user) return res.status(400).send({ message: "user not found" });

		if (!req.user.isAdmin && req.user._id.toString() !== user._id.toString()) {
			return res.status(403).send({ message: "Forbidden" });
		}
		res.send({ user });
	} catch (x) {
		return res.status(500).send({ message: "Something Went Wrong..." });
	}
});

// Getting all users sorted by creation date (newest first)
router.get("/", authenticate, requireAdmin, async (req, res) => {
	try {
		const users = await User.find().sort({ createdAt: -1 });
		res.send(users);
	} catch (error) {
		return res.status(500).send({ message: "Something Went Wrong..." });
	}
});

// reset password
router.get("/reset-password/:email", async (req, res) => {
	const { email } = req.params;
	if (!email) return res.status(400).send({ message: "Email is required" });

	try {
		const emailData = await passwordReset(email);
		if (emailData.error) return res.status(400).send({ message: emailData.error });

		res.send({ message: "Password reset link sent successfully" });
	} catch (error) {
		return res.status(500).send({ message: "Something Went Wrong..." });
	}
});

router.post("/login", async (req, res) => {
	const { email, username, password } = req.body;
	const { error } = validateLogin(req.body);
	if (error) return res.status(400).send({ message: error.details[0].message });

	try {
		const user = await User.findOne({
			$or: [{ email }, { username }],
		});
		if (!user) return res.status(400).send({ message: "User not found" });

		// Check if the user has a password set (i.e., not a Google account)
		if (!user.password) {
			return res.status(400).send({ message: "This user signed up via Google. Use Google login." });
		}

		const isMatch = await bcrypt.compare(password, user.password);
		if (!isMatch) return res.status(400).send({ message: "Invalid password" });

		const token = user.genAuthToken();

		if (user.isAdmin) {
			await logActivity(req, {
				actor: user,
				action: "admin_login",
				metadata: { via: "password", requires2FA: !!user.mfa },
				notifyAdmin: true,
			});
		}

		res.send({ message: "success", user, token });
	} catch (e) {
		console.error(e);
		res.status(500).send({ message: "Internal server error" });
	}
});

//google sign up
router.post("/google", googleLogin);

//Sign up
router.post("/signup", async (req, res) => {
	const { username, email } = req.body;

	const { error } = validateUser(req.body);
	if (error) return res.status(400).send({ message: error.details[0].message });

	let user = await User.findOne({ $or: [{ email }, { username }] });
	if (user) return res.status(400).send({ message: "username or email already exists, please login" });

	try {
		const otp = await new Otp({ email }).save();
		const emailData = await otpMail(email, otp.code);
		if (emailData.error) return res.status(400).send({ message: emailData.error });

		res.send({ message: "success" });
	} catch (e) {
		for (i in e.errors) res.status(500).send({ message: e.errors[i].message });
	}
});

// verify otp
router.post("/verify-otp", async (req, res) => {
	const { username, email, password, referredBy, type, otp } = req.body;

	try {
		// Validate required fields
		if (!otp) {
			return res.status(400).send({ message: "OTP is required" });
		}

		let user = await User.findOne({
			$or: [{ email }, { username }],
		});

		if (type === "register-verification") {
			if (user) return res.status(400).send({ message: "User already exists, please login" });

			const isOTPValid = await verifyOtp(email, otp);
			if (!isOTPValid) {
				return res.status(400).send({ message: "Invalid or expired OTP" });
			}

			const salt = await bcrypt.genSalt(10);
			const hashedPassword = await bcrypt.hash(password, salt);

			user = new User({ username, email, password: hashedPassword, referredBy, isAdmin: false });
			await user.save();

			await welcomeMail(user.email);
			const token = user.genAuthToken();
			return res.send({ user, token });
		}

		if (type === "login-verification") {
			if (!user) return res.status(400).send({ message: "User not found, please register" });

			// Verify OTP for login
			const isOTPValid = await verifyOtp(user.email, otp);
			if (!isOTPValid) {
				return res.status(400).send({ message: "Invalid or expired OTP" });
			}

			const validPassword = await bcrypt.compare(password, user.password);
			if (!validPassword) return res.status(400).send({ message: "Invalid password" });

			const token = user.genAuthToken();
			return res.send({ user, token });
		}

		if (type === "reset-password") {
			if (!user) return res.status(400).send({ message: "User not found, please register" });

			// Verify OTP for password reset
			const isOTPValid = await verifyOtp(user.email, otp);
			if (!isOTPValid) {
				return res.status(400).send({ message: "Invalid or expired OTP" });
			}

			// Hash the new password
			const salt = await bcrypt.genSalt(10);
			const hashedPassword = await bcrypt.hash(password, salt);

			// Update user's password
			user.password = hashedPassword;
			await user.save();

			const token = user.genAuthToken();
			return res.send({ message: "Password reset successfully", user, token });
		}

		return res.status(400).send({
			message: "Invalid type. Must be 'register-verification', 'login-verification' or 'reset-password'",
		});
	} catch (e) {
		console.error(e);
		return res.status(500).send({ message: "Server error" });
	}
});

//resend - otp
router.post("/resend-otp", async (req, res) => {
	const { email } = req.body;

	try {
		const otp = await new Otp({ email }).save();
		const emailData = await otpMail(email, otp.code);
		if (emailData.error) return res.status(400).send({ message: emailData.error });

		res.send({ message: "success" });
	} catch (e) {
		for (i in e.errors) res.status(500).send({ message: e.errors[i].message });
	}
});

//Change password
router.put("/change-password", authenticate, async (req, res) => {
	const { currentPassword, newPassword, id } = req.body;

	try {
		const targetUserId = id || req.user._id;
		if (!req.user.isAdmin && req.user._id.toString() !== targetUserId.toString()) {
			return res.status(403).send({ message: "Forbidden" });
		}

		const user = await User.findById(targetUserId);
		if (!user) return res.status(404).send({ message: "User not found" });

		if (!req.user.isAdmin || targetUserId.toString() === req.user._id.toString()) {
			const validPassword = await bcrypt.compare(currentPassword, user.password);
			if (!validPassword) return res.status(400).send({ message: "Current password is incorrect" });
		}

		const salt = await bcrypt.genSalt(10);
		user.password = await bcrypt.hash(newPassword, salt);
		await user.save();

		res.send({ message: "Password changed successfully" });
	} catch (err) {
		console.error(err);
		res.status(500).send({ message: "Server error" });
	}
});

// reset password
router.put("/reset-password", async (req, res) => {
	const { email, username } = req.body;
	if (!email && !username) return res.status(400).send({ message: "Email and username are required" });

	let user = await User.findOne({
		$or: [{ email }, { username }],
	});
	if (!user) return res.status(400).send({ message: "Invalid email or username" });

	try {
		const otp = await new Otp({ email: user.email }).save();
		const emailData = await otpMail(user.email, otp.code);
		if (emailData.error) return res.status(400).send({ message: emailData.error });

		res.send({ message: "success" });
	} catch (error) {
		return res.status(500).send({ message: "Something Went Wrong..." });
	}
});

router.put("/update-profile", authenticate, upload.single("profileImage"), async (req, res) => {
	const { email, rank, ...rest } = req.body;

	let user = await User.findOne({ email });
	if (!user) return res.status(404).send({ message: "User not found" });

	if (!req.user.isAdmin && req.user.email !== email) {
		return res.status(403).send({ message: "Forbidden" });
	}

	try {
		// Prevent privilege escalation via profile updates
		if (!req.user.isAdmin && rest.isAdmin !== undefined) {
			delete rest.isAdmin;
		}

		if (req.file) {
			rest.profileImage = req.file.path;
		}

		// Handle rank changes - if rank is being changed, mark as manual
		if (rank !== undefined && rank !== user.rank) {
			rest.rank = rank;
			rest.manualRank = true;
		}

		// Auto-calculate rank based on deposit if it's just a deposit/interest update and not manually set
		if ((rest.deposit !== undefined || rest.interest !== undefined) && rank === undefined && !user.manualRank) {
			const newDeposit = rest.deposit !== undefined ? rest.deposit : user.deposit;
			const autoRank = await calculateAutoRank(newDeposit, email);
			rest.rank = autoRank;
		}

		user.set(rest);
		user = await user.save();

		const isAdminAction = req.user.isAdmin && req.user.email !== email;
		await logActivity(req, {
			actor: req.user,
			action: isAdminAction ? "admin_update_profile" : "update_profile",
			target: { collection: "users", id: user._id.toString() },
			metadata: { fieldsUpdated: Object.keys(rest || {}) },
			notifyAdmin: isAdminAction,
		});

		res.send({ user });
	} catch (e) {
		for (const i in e.errors) {
			return res.status(500).send({ message: e.errors[i].message });
		}
	}
});

// Helper function to calculate rank based on deposit using dynamic ranking data
async function calculateAutoRank(depositAmount, userEmail) {
	try {
		// Fetch user to get custom rankings
		const user = await User.findOne({ email: userEmail });
		let rankings = [];

		if (user && user.customRankings && user.customRankings.length > 0) {
			// Use user's custom rankings
			rankings = user.customRankings;
		} else {
			// Fallback to default rankings from utils or hardcoded
			const { Util } = await import("../models/util.js");
			const utils = await Util.findOne();
			rankings = utils?.defaultRankings || getHardcodedRankings();
		}

		// Sort rankings by level descending to check highest first
		const sortedRankings = [...rankings].sort((a, b) => b.level - a.level);
		
		for (const ranking of sortedRankings) {
			if (depositAmount >= ranking.minimumDeposit) {
				return ranking.name;
			}
		}
		
		// Return the lowest level rank if no match (should be welcome)
		return sortedRankings[sortedRankings.length - 1]?.name || 'welcome';
	} catch (error) {
		console.error('Error calculating auto rank:', error);
		// Fallback to hardcoded calculation
		if (depositAmount >= 1000000) return 'ambassador';
		if (depositAmount >= 500000) return 'diamond';
		if (depositAmount >= 100000) return 'goldPro';
		if (depositAmount >= 50000) return 'gold';
		if (depositAmount >= 25000) return 'silverPro';
		if (depositAmount >= 5000) return 'silver';
		return 'welcome';
	}
}

// Reset rank to auto-calculation
router.put("/reset-rank-to-auto", authenticate, async (req, res) => {
	const { email } = req.body;

	let user = await User.findOne({ email });
	if (!user) return res.status(404).send({ message: "User not found" });

	if (!req.user.isAdmin && req.user.email !== email) {
		return res.status(403).send({ message: "Forbidden" });
	}

	try {
		const autoRank = await calculateAutoRank(user.deposit, email);
		user.rank = autoRank;
		user.manualRank = false;
		user = await user.save();

		res.send({ user });
	} catch (e) {
		return res.status(500).send({ message: "Server error" });
	}
});

// Get user rankings (custom or default)
router.get("/rankings/:email", authenticate, async (req, res) => {
	const { email } = req.params;

	if (!req.user.isAdmin && req.user.email !== email) {
		return res.status(403).send({ message: "Forbidden" });
	}

	try {
		const user = await User.findOne({ email });
		if (!user) return res.status(404).send({ message: "User not found" });

		// If user has custom rankings, return them
		if (user.customRankings && user.customRankings.length > 0) {
			return res.send({ rankings: user.customRankings, isCustom: true });
		}

		// Otherwise, get default rankings from utils
		const { Util } = await import("../models/util.js");
		const utils = await Util.findOne();
		const defaultRankings = utils?.defaultRankings || getHardcodedRankings();

		res.send({ rankings: defaultRankings, isCustom: false });
	} catch (e) {
		return res.status(500).send({ message: "Server error" });
	}
});

// Update user custom rankings
router.put("/update-rankings", authenticate, async (req, res) => {
	const { email, rankings } = req.body;

	try {
		const user = await User.findOne({ email });
		if (!user) return res.status(404).send({ message: "User not found" });

		if (!req.user.isAdmin && req.user.email !== email) {
			return res.status(403).send({ message: "Forbidden" });
		}

		user.customRankings = rankings;
		await user.save();

		res.send({ message: "Rankings updated successfully", user });
	} catch (e) {
		return res.status(500).send({ message: "Server error" });
	}
});

// Hardcoded fallback rankings
function getHardcodedRankings() {
	return [
		{ level: 1, name: 'welcome', minimumDeposit: 0, directReferral: 0, referralDeposits: 0, bonus: 0 },
		{ level: 2, name: 'silver', minimumDeposit: 5000, directReferral: 0, referralDeposits: 0, bonus: 200 },
		{ level: 3, name: 'silverPro', minimumDeposit: 25000, directReferral: 0, referralDeposits: 0, bonus: 1000 },
		{ level: 4, name: 'gold', minimumDeposit: 50000, directReferral: 0, referralDeposits: 0, bonus: 2000 },
		{ level: 5, name: 'goldPro', minimumDeposit: 100000, directReferral: 0, referralDeposits: 0, bonus: 3000 },
		{ level: 6, name: 'diamond', minimumDeposit: 500000, directReferral: 12, referralDeposits: 2550000, bonus: 20000 },
		{ level: 7, name: 'ambassador', minimumDeposit: 1000000, directReferral: 12, referralDeposits: 2550000, bonus: 50000 }
	];
}

//Delete multi users
router.delete("/", authenticate, requireAdmin, async (req, res) => {
	const { userIds, usernamePrefix, emailPrefix } = req.body;

	// Build the filter dynamically
	const filter = {};

	// Filter by IDs if provided
	if (Array.isArray(userIds) && userIds.length > 0) {
		filter._id = { $in: userIds };
	}

	// Filter by username prefix if provided
	if (usernamePrefix) {
		filter.username = { $regex: `^${usernamePrefix}`, $options: "i" }; // Case-insensitive match
	}

	// Filter by email prefix if provided
	if (emailPrefix) {
		filter.email = { $regex: `^${emailPrefix}`, $options: "i" }; // Case-insensitive match
	}

	// Check if the filter is empty
	if (Object.keys(filter).length === 0) {
		return res.status(400).json({ error: "No valid filter criteria provided" });
	}

	try {
		const result = await User.deleteMany(filter);
		await logActivity(req, {
			actor: req.user,
			action: "admin_bulk_delete_users",
			target: { collection: "users" },
			metadata: { deletedCount: result.deletedCount, filterUsed: Object.keys(filter) },
			notifyAdmin: true,
		});
		res.json({ success: true, deletedCount: result.deletedCount });
	} catch (error) {
		console.error(error);
		res.status(500).json({ error: "Failed to delete users" });
	}
});

// PUT /api/user/
router.put("/update-user-trader", authenticate, async (req, res) => {
	try {
		const { traderId, action, userId } = req.body;

		if (!userId) return res.status(401).json({ message: "Unauthorized" });

		if (!req.user.isAdmin && req.user._id.toString() !== userId.toString()) {
			return res.status(403).json({ message: "Forbidden" });
		}

		const update = action === "copy" ? { traderId } : { $unset: { traderId: 1 } };

		const updatedUser = await User.findByIdAndUpdate(userId, update, { new: true });

		await logActivity(req, {
			actor: req.user,
			action: req.user.isAdmin ? "admin_update_user_trader" : "update_user_trader",
			target: { collection: "users", id: userId },
			metadata: { traderId, action },
			notifyAdmin: req.user.isAdmin,
		});

		return res.status(200).json({
			message: action === "copy" ? "Trader copied" : "Trader uncopied",
			user: updatedUser,
		});
	} catch (error) {
		console.error("Error updating traderId:", error);
		return res.status(500).json({ message: "Internal server error" });
	}
});

// Veryify 2FA for user
router.post("/verifyToken", authenticate, async (req, res) => {
	const { token, secret, email } = req.body;

	let user = await User.findOne({ email });
	if (!user) return res.status(400).send({ message: "Invalid email" });

	if (!req.user.isAdmin && req.user.email !== email) {
		return res.status(403).send({ message: "Forbidden" });
	}

	try {
		const verify = speakeasy.totp.verify({
			secret,
			encoding: "ascii",
			token,
		});

		if (!verify) throw new Error("Invalid token");
		else {
			user.mfa = true;
			user = await user.save();
			res.send({ message: "Your Account Multi Factor Authentication is Now on" });
		}
	} catch (error) {
		return res.status(500).send({ message: "Something Went Wrong..." });
	}
});

export default router;
