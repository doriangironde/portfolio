export interface ContributionDay {
	date: string;
	contributionCount: number;
	weekday: number;
	level: number;
}

export interface ContributionWeek {
	contributionDays: ContributionDay[];
}

export interface ContributionCalendar {
	totalContributions: number;
	weeks: ContributionWeek[];
}

const QUERY = `
  query ($login: String!) {
    user(login: $login) {
      contributionsCollection {
        restrictedContributionsCount
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              date
              contributionCount
              weekday
            }
          }
        }
      }
    }
  }
`;

export async function fetchContributionCalendar(
	username: string,
	token: string,
): Promise<ContributionCalendar> {
	const response = await fetch("https://api.github.com/graphql", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
			"User-Agent": "doriangironde-site",
		},
		body: JSON.stringify({ query: QUERY, variables: { login: username } }),
	});

	if (!response.ok) {
		throw new Error(`GitHub API returned status ${response.status}`);
	}

	const payload: unknown = await response.json();

	if (
		typeof payload === "object" &&
		payload !== null &&
		"errors" in payload &&
		Array.isArray(payload.errors)
	) {
		const messages = (payload.errors as Array<{ message?: string }>)
			.map((error) => error.message)
			.join("; ");
		throw new Error(messages || "GitHub API returned an unknown error");
	}

	const calendar = (payload as {
		data: {
			user: {
				contributionsCollection: {
					contributionCalendar: ContributionCalendar;
				};
			};
		};
	}).data.user.contributionsCollection.contributionCalendar;

	return assignLevels(calendar);
}

function assignLevels(calendar: ContributionCalendar): ContributionCalendar {
	const counts = calendar.weeks
		.flatMap((week) =>
			week.contributionDays.map((day) => day.contributionCount),
		)
		.filter((count) => count > 0)
		.sort((a, b) => a - b);

	const size = counts.length;
	const q1 = size > 0 ? counts[Math.floor(size * 0.25)] : 0;
	const q2 = size > 0 ? counts[Math.floor(size * 0.5)] : 0;
	const q3 = size > 0 ? counts[Math.floor(size * 0.75)] : 0;

	for (const week of calendar.weeks) {
		for (const day of week.contributionDays) {
			if (day.contributionCount === 0) {
				day.level = 0;
			} else if (day.contributionCount >= q3) {
				day.level = 4;
			} else if (day.contributionCount >= q2) {
				day.level = 3;
			} else if (day.contributionCount >= q1) {
				day.level = 2;
			} else {
				day.level = 1;
			}
		}
	}

	return calendar;
}

export function emptyCalendar(weeksCount: number): ContributionCalendar {
	const today = new Date();
	const start = new Date(today);
	start.setDate(start.getDate() - (weeksCount - 1) * 7);

	const weeks: ContributionWeek[] = [];

	for (let weekIndex = 0; weekIndex < weeksCount; weekIndex++) {
		const days: ContributionDay[] = [];

		for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
			const date = new Date(start);
			date.setDate(start.getDate() + weekIndex * 7 + dayIndex);
			days.push({
				date: date.toISOString().slice(0, 10),
				contributionCount: 0,
				level: 0,
				weekday: dayIndex,
			});
		}

		weeks.push({ contributionDays: days });
	}

	return { totalContributions: 0, weeks };
}
