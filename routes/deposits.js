import express from "express";
import { Transaction } from "../models/transaction.js";
import { User } from "../models/user.js";
import { alertAdmin, depositMail, pendingDepositMail } from "../utils/mailer.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import { logActivity } from "../utils/activityLogger.js";

const router = express.Router();

// getting all deposits
router.get("/", authenticate, requireAdmin, async (req, res) => {
	try {
		const deposits = await Transaction.find({ type: "deposit" });
		res.send(deposits);
	} catch (e) {
		for (i in e.errors) res.status(500).send({ message: e.errors[i].message });
	}
});

// get all deposits by user
router.get("/user/:email", authenticate, async (req, res) => {
	const { email } = req.params;

	if (!req.user.isAdmin && req.user.email !== email) {
		return res.status(403).send({ message: "Forbidden" });
	}

	try {
		const deposits = await Transaction.find({ "user.email": email });
		if (!deposits || deposits.length === 0) return res.status(400).send({ message: "Deposits not found..." });
		res.send(deposits);
	} catch (e) {
		for (i in e.errors) res.status(500).send({ message: e.errors[i].message });
	}
});

// making a deposit
router.post("/", authenticate, async (req, res) => {
	const { id, amount, convertedAmount, coinName, depositMethod, wireTransferData } = req.body;

	const userId = id || req.user._id;
	if (!req.user.isAdmin && req.user._id.toString() !== userId.toString()) {
		return res.status(403).send({ message: "Forbidden" });
	}

	const user = await User.findById(userId);
	if (!user) return res.status(400).send({ message: "Something went wrong" });

	// Check if there's any pending deposit for the user
	const pendingDeposit = await Transaction.findOne({
		"user.id": userId,
		status: "pending",
		type: "deposit",
	});

	if (pendingDeposit) {
		return res.status(400).send({ message: "You have a pending deposit. Please wait for approval." });
	}

	try {
		const userData = {
			id: user._id,
			email: user.email,
			name: user.fullName,
		};

		const walletData = depositMethod === 'crypto' ? {
			convertedAmount,
			coinName,
			network: "",
			address: "",
		} : {};

		const wireData = depositMethod === 'wire' ? wireTransferData : {};

		// Create a new deposit instance
		const transaction = new Transaction({ 
			type: "deposit", 
			user: userData, 
			amount, 
			walletData,
			wireTransferData: wireData,
			depositMethod: depositMethod || 'crypto'
		});
		await transaction.save();

		const date = transaction.date;
		const type = transaction.type;
		const email = transaction.user.email;

		const emailDataForAdmin = await alertAdmin(email, amount, date, type);
		if (emailDataForAdmin.error) return res.status(400).send({ message: emailDataForAdmin.error });

		const emailData = await pendingDepositMail(user.fullName, amount, date, email);
		if (emailData.error) return res.status(400).send({ message: emailData.error });

		res.send({ message: "Deposit successful and pending approval..." });
	} catch (e) {
		for (i in e.errors) res.status(500).send({ message: e.errors[i].message });
	}
});

// POST /users/reset-demo-balance
router.post("/reset-demo-balance", authenticate, async (req, res) => {
	const { email } = req.body;

	if (!req.user.isAdmin && req.user.email !== email) {
		return res.status(403).send({ message: "Forbidden" });
	}
	// Update demo balance in DB
	await User.updateOne({ email }, { demo: 10000 });
	res.status(200).json({ message: "Demo balance topped up" });
});

// updating a deposit
router.put("/:id", authenticate, requireAdmin, async (req, res) => {
	const { id } = req.params;
	const { email, amount, status } = req.body;

	let deposit = await Transaction.findById(id);
	if (!deposit) return res.status(404).send({ message: "Deposit not found" });

	let user = await User.findOne({ email });
	if (!user) return res.status(400).send({ message: "Something went wrong" });

	try {
		deposit.status = status;

		if (status === "success") {
			user.deposit += amount;
		}

		user = await user.save();
		deposit = await deposit.save();

		const { fullName, email } = user;
		const { date } = deposit;

		const isRejected = status === "success" ? false : true;

		const emailData = await depositMail(fullName, amount, date, email, isRejected);
		if (emailData.error) return res.status(400).send({ message: emailData.error });

		await logActivity(req, {
			actor: req.user,
			action: "update_deposit_status",
			target: { collection: "transactions", id: id },
			metadata: { status, email },
		});

		res.send({ message: "Deposit successfully updated" });
	} catch (e) {
		for (i in e.errors) res.status(500).send({ message: e.errors[i].message });
	}
});

// deleting a deposit (cancel)
router.delete("/:id", authenticate, async (req, res) => {
	const { id } = req.params;

	try {
		const deposit = await Transaction.findById(id);
		if (!deposit) return res.status(404).send({ message: "Deposit not found" });

		if (!req.user.isAdmin && deposit.user?.id?.toString() !== req.user._id.toString()) {
			return res.status(403).send({ message: "Forbidden" });
		}
		
		if (deposit.status !== "pending") {
			return res.status(400).send({ message: "Only pending deposits can be cancelled" });
		}

		await Transaction.findByIdAndDelete(id);
		res.send({ message: "Deposit cancelled successfully" });
	} catch (e) {
		for (i in e.errors) res.status(500).send({ message: e.errors[i].message });
	}
});

export default router;
