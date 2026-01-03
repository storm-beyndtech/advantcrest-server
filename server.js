import dotenv from "dotenv";
dotenv.config();
import express from "express";
import mongoose from "mongoose";
import http from "http";
import cors from "cors";
import { verifyTransporter } from "./utils/emailConfig.js";
import usersRoutes from "./routes/users.js";
import transactionsRoutes from "./routes/transactions.js";
import depositsRoutes from "./routes/deposits.js";
import withdrawalsRoutes from "./routes/withdrawals.js";
import tradesRoutes from "./routes/trades.js";
import traderRoutes from "./routes/traders.js";
import utilsRoutes from "./routes/utils.js";
import kycsRoutes from "./routes/kycs.js";
import activityLogsRoutes from "./routes/activityLogs.js";
import rateLimit from "express-rate-limit";

const app = express();

// Trust proxy for accurate IP detection
app.set("trust proxy", true);

// Prevent crashes from unhandled errors
process.on('uncaughtException', (error) => {
	console.error('❌ Uncaught Exception:', error);
	// Log but don't exit in production
});

process.on('unhandledRejection', (reason, promise) => {
	console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
	// Log but don't exit in production
});
const server = http.createServer(app);

// Verify email transporter (non-blocking)
(async function verifyTP() {
	try {
		await verifyTransporter();
	} catch (error) {
		console.error('Email setup failed, continuing without email features');
	}
})();

// Required environment variables check
const requiredEnvVars = [
	'MONGODB_URL'
];

const optionalEnvVars = {
	'SMTP_USER': 'Email features will be disabled',
	'SMTP_PASSWORD': 'Email features will be disabled', 
	'GOOGLE_CLIENT_ID': 'Google OAuth will be disabled',
	'CLOUD_NAME': 'File uploads will be disabled',
	'CLOUD_API_KEY': 'File uploads will be disabled',
	'CLOUD_API_SECRET': 'File uploads will be disabled'
};

// Check required vars
for (const envVar of requiredEnvVars) {
	if (!process.env[envVar]) {
		console.error(`❌ FATAL: ${envVar} is required`);
		process.exit(1);
	}
}

if (!process.env.JWT_SECRET && !process.env.JWT_PRIVATE_KEY) {
	console.error("❌ FATAL: JWT_SECRET or JWT_PRIVATE_KEY is required");
	process.exit(1);
}

// Check optional vars
for (const [envVar, warning] of Object.entries(optionalEnvVars)) {
	if (!process.env[envVar]) {
		console.warn(`⚠️ ${envVar} not set: ${warning}`);
	}
}

// Connecting to MongoDB
mongoose.set("strictQuery", false);
mongoose
	.connect(process.env.MONGODB_URL)
	.then(() => console.log("Connected to MongoDB..."))
	.catch((e) => console.error("Error connecting to MongoDB:", e));

const corsOptions = {
	origin: true,
	methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
	allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "x-auth-token"],
	credentials: true,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // Preflight

// Create a rate limiter for POST requests only
const postLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 10, // Limit each IP to 10 POST requests per 15 minutes
	handler: (req, res) => {
		res.status(429).json({
			message: "Too many requests, please try again later.",
		});
	},
});

// Middlewares
app.post("*", postLimiter);
app.use(express.json());
app.use("/api/users", usersRoutes);
app.use("/api/transactions", transactionsRoutes);
app.use("/api/deposits", depositsRoutes);
app.use("/api/withdrawals", withdrawalsRoutes);
app.use("/api/trades", tradesRoutes);
app.use("/api/trader", traderRoutes);
app.use("/api/utils", utilsRoutes);
app.use("/api/kycs", kycsRoutes);
app.use("/api/activity-logs", activityLogsRoutes);

// Listening to port
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Listening on port ${PORT}`));

app.get("/", (req, res) => {
	res.header("Access-Control-Allow-Origin", "*").send("API running 🥳");
});
