const normalizeIp = (ipAddress) => {
	if (!ipAddress) return "";
	if (ipAddress === "::1") return "127.0.0.1";
	return ipAddress.replace(/^::ffff:/, "").trim();
};

const shouldSkipGeoLookup = (ipAddress) => {
	return (
		!ipAddress ||
		ipAddress.startsWith("127.") ||
		ipAddress.startsWith("10.") ||
		ipAddress.startsWith("192.168.") ||
		ipAddress === "localhost"
	);
};

export const getRequestContext = async (req) => {
	const forwarded = req.headers["x-forwarded-for"];
	const rawIp = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0];
	const ipAddress = normalizeIp(rawIp || req.ip || req.socket?.remoteAddress);
	const userAgent = req.headers["user-agent"] || "";

	let location = null;
	if (!shouldSkipGeoLookup(ipAddress)) {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 1500);

		try {
			const response = await fetch(`https://ipapi.co/${ipAddress}/json/`, {
				signal: controller.signal,
			});
			if (response.ok) {
				const data = await response.json();
				if (!data.error) {
					location = {
						city: data.city || "",
						region: data.region || data.region_code || "",
						country: data.country_name || data.country || "",
						lat: data.latitude,
						lng: data.longitude,
					};
				}
			}
		} catch (error) {
			// Ignore geo failures silently
		} finally {
			clearTimeout(timeout);
		}
	}

	return { ipAddress, userAgent, location };
};

export { normalizeIp };
