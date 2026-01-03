import mongoose from "mongoose";

const ActivityLogSchema = new mongoose.Schema({
	actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
	actorEmail: { type: String },
	actorRole: { type: String },
	action: { type: String, required: true },
	targetCollection: { type: String },
	targetId: { type: String },
	metadata: { type: Object, default: {} },
	ipAddress: { type: String },
	userAgent: { type: String },
	location: {
		city: String,
		region: String,
		country: String,
		lat: Number,
		lng: Number,
	},
	createdAt: {
		type: Date,
		default: Date.now,
	},
});

ActivityLogSchema.index({ createdAt: -1 });

export const ActivityLog = mongoose.model("ActivityLog", ActivityLogSchema);
