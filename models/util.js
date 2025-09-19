import mongoose from "mongoose";

// util schema
const utilSchema = new mongoose.Schema({
	coins: [
		{
			name: String,
			address: String,
			network: String,
			price: Number,
			apiSymbol: String, // For mapping to crypto API (e.g., 'bitcoin', 'ethereum')
			fallbackPrice: Number, // Admin-set fallback price
		},
	],
	defaultRankings: [{
		level: { type: Number, required: true },
		name: { type: String, required: true },
		minimumDeposit: { type: Number, default: 0 },
		directReferral: { type: Number, default: 0 },
		referralDeposits: { type: Number, default: 0 },
		bonus: { type: Number, default: 0 },
		isActive: { type: Boolean, default: true }
	}],
	wireTransfer: {
		bankName: String,
		accountName: String,
		accountNumber: String,
		routingNumber: String,
		swiftCode: String,
		instructions: String,
		isActive: { type: Boolean, default: true },
	},
	maintenanceMode: {
		enabled: { type: Boolean, default: false },
		message: { 
			type: String, 
			default: "We're currently performing maintenance. Please check back soon." 
		},
		updatedAt: { type: Date, default: Date.now }
	},
});

// util model
export const Util = mongoose.model("Util", utilSchema);
