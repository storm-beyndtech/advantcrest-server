import jwt from "jsonwebtoken";
import { User } from "../models/user.js";

const getTokenFromRequest = (req) => {
	const authHeader = req.headers.authorization || req.headers.Authorization;
	const headerToken =
		typeof authHeader === "string" && authHeader.toLowerCase().startsWith("bearer ")
			? authHeader.slice(7).trim()
			: typeof authHeader === "string"
				? authHeader.trim()
				: null;

	return headerToken || req.headers["x-auth-token"];
};

export const authenticate = async (req, res, next) => {
	try {
		const token = getTokenFromRequest(req);
		if (!token) return res.status(401).json({ message: "Access denied. No token provided." });

		const secret = process.env.JWT_SECRET || process.env.JWT_PRIVATE_KEY;
		if (!secret) return res.status(500).json({ message: "JWT secret not configured." });

		const decoded = jwt.verify(token, secret);
		const user = await User.findById(decoded._id);
		if (!user) return res.status(401).json({ message: "Invalid token." });

		req.user = user;
		next();
	} catch (error) {
		console.error("Auth error:", error);
		return res.status(401).json({ message: "Invalid token." });
	}
};

export const requireAdmin = (req, res, next) => {
	if (!req.user?.isAdmin) {
		return res.status(403).json({ message: "Access denied. Admins only." });
	}
	next();
};

export const requireSelfOrAdmin = (userIdFromRequest) => {
	return (req, res, next) => {
		const targetId = userIdFromRequest(req);
		if (!req.user) return res.status(401).json({ message: "Unauthorized" });

		if (req.user.isAdmin || (targetId && req.user._id.toString() === targetId.toString())) {
			return next();
		}

		return res.status(403).json({ message: "Forbidden" });
	};
};
