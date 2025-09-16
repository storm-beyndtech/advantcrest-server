import mongoose from "mongoose";

// transaction schema
const transactionSchema = new mongoose.Schema({
	type: {
		type: String,
		required: true,
		minLength: 5,
		maxLength: 20,
	},
	user: {
		id: {
			type: mongoose.Schema.Types.ObjectId,
		},
		email: {
			type: String,
		},
		name: {
			type: String,
		},
	},
	status: {
		type: String,
		default: "pending",
		minLength: 4,
		maxLength: 20,
	},
	amount: {
		type: Number,
		required: true,
		minLength: 10,
		maxLength: 20000000,
	},
	date: {
		type: Date,
		default: Date.now,
	},
	walletData: {
		address: {
			type: String,
			default: "",
		},
		network: {
			type: String,
			default: "",
		},
		coinName: {
			type: String,
			default: "",
		},
		convertedAmount: {
			type: Number,
			default: "",
		},
	},
	wireTransferData: {
		bankName: {
			type: String,
			default: "",
		},
		accountName: {
			type: String,
			default: "",
		},
		accountNumber: {
			type: String,
			default: "",
		},
		routingNumber: {
			type: String,
			default: "",
		},
		swiftCode: {
			type: String,
			default: "",
		},
		instructions: {
			type: String,
			default: "",
		},
	},
	depositMethod: {
		type: String,
		enum: ['crypto', 'wire'],
		default: 'crypto',
	},
	tradeData: {
		package: {
			type: String,
			default: "",
		},
		interest: {
			type: Number,
			default: 0,
		},
		category: {
			type: String,
			default: "",
		},
	},
});

export const Transaction = mongoose.model("Transaction", transactionSchema);
