import { ActivityLog } from "../models/activityLog.js";
import { emailTemplate } from "./emailTemplate.js";
import { getRequestContext } from "./requestContext.js";
import { sendMailWithRetry } from "./mailer.js";

const sendAdminActivityEmail = async ({ action, actorEmail, metadata, context }) => {
	if (!process.env.SMTP_USER) return;

	const bodyContent = `
    <td style="padding: 20px; line-height: 1.8;">
      <p>Admin activity detected: <strong>${action}</strong></p>
      <p><strong>Actor:</strong> ${actorEmail || "Unknown"}</p>
      <p><strong>IP:</strong> ${context.ipAddress || "n/a"}</p>
      <p><strong>User Agent:</strong> ${context.userAgent || "n/a"}</p>
      <p><strong>Metadata:</strong> ${JSON.stringify(metadata || {})}</p>
    </td>
  `;

	const mailOptions = {
		from: `AdvantCrest <${process.env.SMTP_USER}>`,
		to: process.env.SMTP_USER,
		subject: `Admin activity: ${action}`,
		html: emailTemplate(bodyContent),
	};

	try {
		await sendMailWithRetry(mailOptions);
	} catch (error) {
		console.error("Failed to send admin activity email:", error);
	}
};

export const logActivity = async (req, { actor, action, target, metadata, notifyAdmin = false }) => {
	try {
		const actorData = actor || req.user || {};
		const context = await getRequestContext(req);

		const logEntry = await ActivityLog.create({
			actorId: actorData._id || actorData.id || null,
			actorEmail: actorData.email,
			actorRole: actorData.isAdmin ? "admin" : "user",
			action,
			targetCollection: target?.collection,
			targetId: target?.id,
			metadata: metadata || {},
			ipAddress: context.ipAddress,
			userAgent: context.userAgent,
			location: context.location || undefined,
		});

		if (notifyAdmin) {
			await sendAdminActivityEmail({
				action,
				actorEmail: actorData.email,
				metadata,
				context,
			});
		}

		return logEntry;
	} catch (error) {
		console.error("Failed to log activity:", error);
		return null;
	}
};
