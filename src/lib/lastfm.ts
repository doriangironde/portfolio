export interface LastFmTrack {
	name: string;
	artist: string;
	image: string;
	playcount: number;
}

export interface LastFmUserStats {
	playcount: number;
	trackCount: number;
	artistCount: number;
}

export const PLACEHOLDER_ART =
	"2a96cbd8b46e442fc41c2b86b821562f";

export function isPlaceholderArt(image: string): boolean {
	return image.includes(PLACEHOLDER_ART) || image === "";
}

interface LastFmApiResponse {
	error?: number;
	message?: string;
	toptracks?: {
		track: Array<{
			name: string;
			artist?: { name?: string };
			image?: Array<{ size: string; "#text": string }>;
			playcount?: string;
		}>;
	};
	user?: {
		playcount?: string;
		track_count?: string;
		artist_count?: string;
	};
}

export async function getUserStats(
	username: string,
	apiKey: string,
): Promise<LastFmUserStats> {
	const params = new URLSearchParams({
		method: "user.getinfo",
		user: username,
		api_key: apiKey,
		format: "json",
	});

	const response = await fetch(`https://ws.audioscrobbler.com/2.0/?${params}`);

	if (!response.ok) {
		throw new Error(`LastFM API returned status ${response.status}`);
	}

	const payload = (await response.json()) as LastFmApiResponse;

	if (payload.error || !payload.user) {
		throw new Error(payload.message ?? "LastFM API returned an unknown error");
	}

	return {
		playcount: Number(payload.user.playcount) || 0,
		trackCount: Number(payload.user.track_count) || 0,
		artistCount: Number(payload.user.artist_count) || 0,
	};
}

async function fetchDeezerCover(
	trackName: string,
	artistName: string,
): Promise<string> {
	const artistQueries = [
		artistName,
		artistName.split(",")[0].trim(),
	].filter((value, index, values) => value && values.indexOf(value) === index);

	for (const artist of artistQueries) {
		const query = encodeURIComponent(
			`track:"${trackName}" artist:"${artist}"`,
		);
		const url = `https://api.deezer.com/search?q=${query}&limit=1`;

		try {
			const response = await fetch(url);

			if (!response.ok) {
				continue;
			}

			const payload = (await response.json()) as {
				data?: Array<{ album?: { cover_medium?: string } }>;
			};

			const cover = payload.data?.[0]?.album?.cover_medium;

			if (cover) {
				return cover;
			}
		} catch {
		}
	}

	return "";
}

export async function getTopTracks(
	username: string,
	apiKey: string,
	limit: number,
	period = "7day",
): Promise<LastFmTrack[]> {
	const params = new URLSearchParams({
		method: "user.gettoptracks",
		user: username,
		api_key: apiKey,
		period,
		limit: String(limit),
		format: "json",
	});

	const response = await fetch(`https://ws.audioscrobbler.com/2.0/?${params}`);

	if (!response.ok) {
		throw new Error(`LastFM API returned status ${response.status}`);
	}

	const payload = (await response.json()) as LastFmApiResponse;

	if (payload.error) {
		throw new Error(payload.message ?? "LastFM API returned an unknown error");
	}

	const tracks = payload.toptracks?.track ?? [];
	const result: LastFmTrack[] = [];

	for (const track of tracks) {
		const images = track.image ?? [];
		let image =
			images.find((entry) => entry.size === "extralarge")?.["#text"] ??
			images.find((entry) => entry.size === "large")?.["#text"] ??
			images[0]?.["#text"] ??
			"";

		if (isPlaceholderArt(image)) {
			const fallback = await fetchDeezerCover(
				track.name,
				track.artist?.name ?? "",
			);
			if (fallback) {
				image = fallback;
			}
		}

		result.push({
			name: track.name,
			artist: track.artist?.name ?? "Unknown",
			image,
			playcount: Number(track.playcount) || 0,
		});
	}

	return result;
}
