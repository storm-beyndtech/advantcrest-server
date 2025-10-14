import nodemailer from "nodemailer";
import dotenv from 'dotenv';
dotenv.config();

export const transporter = nodemailer.createTransport({
	pool: true,
	host: "smtp.hostinger.com",
	port: 465,
	auth: {
		user: process.env.SMTP_USER,
		pass: process.env.SMTP_PASSWORD,
	},
	secure: true,
	tls: {
		rejectUnauthorized: false,
	},
});

export const verifyTransporter = async (retries = 3, delay = 5000) => {
	// Skip email verification if credentials not provided
	if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
		console.warn("SMTP credentials not provided. Email features disabled.");
		return;
	}

	for (let attempt = 1; attempt <= retries; attempt++) {
		try {
			await transporter.verify();
			console.log("✅ Email transporter verified");
			return;
		} catch (error) {
			console.error(`⚠️ Email verification attempt ${attempt} failed:`, error.message);
			
			if (attempt < retries) {
				console.log(`Retrying in ${delay / 1000} seconds...`);
				await new Promise((resolve) => setTimeout(resolve, delay));
			} else {
				console.error("❌ Email verification failed. Email features disabled.");
				// DON'T EXIT - just continue without email
				return;
			}
		}
	}
};
