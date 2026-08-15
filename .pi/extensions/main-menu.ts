import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import type {
	ExtensionAPI,
	ExtensionCommandContext,
	ExtensionContext,
	Theme,
} from "@earendil-works/pi-coding-agent";
import { CONFIG_DIR_NAME, getAgentDir } from "@earendil-works/pi-coding-agent";
import { Key, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

/**
 * Main Menu
 *
 * Replaces pi's startup header with a small, configurable welcome screen.
 * The screen is intentionally driven by JSON so the art and copy can be
 * changed without touching this extension.
 *
 * Project config: <cwd>/.pi/main-menu.json
 * Global config:  ~/.pi/agent/main-menu.json
 *
 * Project config wins over global config field-by-field. Run `/welcome` (or
 * press Ctrl+Shift+M) to edit it from inside pi.
 */

const CONFIG_FILE_NAME = "main-menu.json";
const SETTINGS_FILE_NAME = "settings.json";

// Rasterized from the supplied logo.svg at 28 × 14 cells.
// Keep every row the same width so the stepped logo stays aligned when centered.
const DEFAULT_ART = [
	"█████████████████████       ",
	"█████████████████████       ",
	"█████████████████████       ",
	"█████████████████████       ",
	"████████      ███████       ",
	"████████      ███████       ",
	"████████      ███████       ",
	"██████████████       ███████",
	"██████████████       ███████",
	"██████████████       ███████",
	"██████████████       ███████",
	"████████             ███████",
	"████████             ███████",
	"████████             ███████",
];

const DEFAULT_GREETINGS = [
	"Welcome back.",
	"Good to see you.",
	"Let's make something useful.",
];

const DEFAULT_HINTS = ["/welcome customize  ·  Ctrl+Shift+M menu"];

interface RawConfig {
	[key: string]: unknown;
}

interface MenuConfig {
	greetings: string[];
	art: string[];
	showArt: boolean;
	subtitle: string;
	prompt: string;
	hints: string[];
	showHints: boolean;
	showContext: boolean;
	showModel: boolean;
	showClock: boolean;
}

interface ConfigDocument {
	path: string;
	data: RawConfig;
	exists: boolean;
}

interface LoadedMenu {
	config: MenuConfig;
	global: ConfigDocument;
	project: ConfigDocument | undefined;
	settingsPath: string;
	quietStartup: boolean;
	warnings: string[];
}

type ConfigPatch = Record<string, unknown>;

const isRecord = (value: unknown): value is RawConfig =>
	typeof value === "object" && value !== null && !Array.isArray(value);

function oneLine(value: string): string {
	return value.replace(/\r?\n|\r/g, " ");
}

function nonEmptyStrings(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value
		.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
		.map(oneLine);
}

function linesFrom(value: unknown): string[] | undefined {
	if (typeof value === "string") {
		return value.length === 0 ? [] : value.replace(/\r\n/g, "\n").split("\n");
	}

	if (Array.isArray(value)) {
		return value.flatMap((item) =>
			typeof item === "string" ? item.replace(/\r\n/g, "\n").split("\n") : [],
		);
	}

	return undefined;
}

function booleanOr(value: unknown, fallback: boolean): boolean {
	return typeof value === "boolean" ? value : fallback;
}

function textOr(value: unknown, fallback: string): string {
	return typeof value === "string" ? oneLine(value) : fallback;
}

function readDocument(path: string, warnings: string[]): ConfigDocument {
	if (!existsSync(path)) {
		return { path, data: {}, exists: false };
	}

	try {
		const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
		if (!isRecord(parsed)) {
			warnings.push(`${path} must contain a JSON object`);
			return { path, data: {}, exists: true };
		}
		return { path, data: parsed, exists: true };
	} catch (error) {
		const reason = error instanceof Error ? error.message : String(error);
		warnings.push(`Could not read ${path}: ${reason}`);
		return { path, data: {}, exists: true };
	}
}

function resolveArtFile(
	raw: RawConfig,
	baseDir: string,
	fallback: string[] | undefined,
	warnings: string[],
): string[] | undefined {
	if (typeof raw.artFile !== "string" || raw.artFile.trim().length === 0) {
		return fallback;
	}

	const artPath = isAbsolute(raw.artFile) ? raw.artFile : resolve(baseDir, raw.artFile);
	try {
		const contents = readFileSync(artPath, "utf8");
		return contents.length === 0 ? [] : contents.replace(/\r\n/g, "\n").split("\n");
	} catch (error) {
		const reason = error instanceof Error ? error.message : String(error);
		warnings.push(`Could not read artFile ${artPath}: ${reason}`);
		return fallback;
	}
}

function normalizeConfig(
	global: ConfigDocument,
	project: ConfigDocument | undefined,
	warnings: string[],
): MenuConfig {
	const raw: RawConfig = {
		...global.data,
		...(project?.data ?? {}),
	};

	const projectGreetings = nonEmptyStrings(project?.data.greetings);
	const projectGreetingValue = project?.data.greeting;
	const projectGreeting = typeof projectGreetingValue === "string" && projectGreetingValue.trim().length > 0
		? [oneLine(projectGreetingValue)]
		: [];
	const globalGreetings = nonEmptyStrings(global.data.greetings);
	const globalGreeting = typeof global.data.greeting === "string" && global.data.greeting.trim().length > 0
		? [oneLine(global.data.greeting)]
		: [];
	const greetingList = projectGreetings.length > 0
		? projectGreetings
		: projectGreeting.length > 0
			? projectGreeting
			: globalGreetings.length > 0
				? globalGreetings
				: globalGreeting.length > 0
					? globalGreeting
					: [...DEFAULT_GREETINGS];

	const globalInlineArt = linesFrom(global.data.art);
	const globalArt = resolveArtFile(global.data, dirname(global.path), globalInlineArt, warnings);
	const projectHasArt = Boolean(
		project && (Object.prototype.hasOwnProperty.call(project.data, "art") || Object.prototype.hasOwnProperty.call(project.data, "artFile")),
	);
	const projectInlineArt = linesFrom(project?.data.art);
	const art = projectHasArt
		? resolveArtFile(
			project!.data,
			dirname(project!.path),
			projectInlineArt ?? globalArt,
			warnings,
		  ) ?? []
		: globalArt ?? [...DEFAULT_ART];

	const hints = linesFrom(raw.hints);

	return {
		greetings: greetingList,
		art,
		showArt: booleanOr(raw.showArt, art.length > 0),
		subtitle: textOr(raw.subtitle, "a small coding cockpit"),
		prompt: textOr(raw.prompt, "Type a prompt or /welcome to customize"),
		hints: hints ?? [...DEFAULT_HINTS],
		showHints: booleanOr(raw.showHints, true),
		showContext: booleanOr(raw.showContext, true),
		showModel: booleanOr(raw.showModel, true),
		showClock: booleanOr(raw.showClock, false),
	};
}

function loadMenu(ctx: ExtensionContext): LoadedMenu {
	const warnings: string[] = [];
	const global = readDocument(join(getAgentDir(), CONFIG_FILE_NAME), warnings);
	const projectDir = join(ctx.cwd, CONFIG_DIR_NAME);
	const project = ctx.isProjectTrusted()
		? readDocument(join(projectDir, CONFIG_FILE_NAME), warnings)
		: undefined;
	const globalSettings = readDocument(join(getAgentDir(), SETTINGS_FILE_NAME), warnings);
	const projectSettings = ctx.isProjectTrusted()
		? readDocument(join(projectDir, SETTINGS_FILE_NAME), warnings)
		: undefined;
	const config = normalizeConfig(global, project, warnings);
	const quietStartup = booleanOr(
		projectSettings?.data.quietStartup,
		booleanOr(globalSettings.data.quietStartup, false),
	);
	const settingsPath = projectSettings?.path ?? globalSettings.path;

	return { config, global, project, settingsPath, quietStartup, warnings };
}

function pickGreeting(greetings: string[]): string {
	return greetings[Math.floor(Math.random() * greetings.length)] ?? DEFAULT_GREETINGS[0]!;
}

function templateValue(value: string, ctx: ExtensionContext): string {
	const project = basename(ctx.cwd);
	const model = ctx.model ? `${ctx.model.provider}/${ctx.model.id}` : "no model";
	const now = new Date();
	const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

	return value
		.replaceAll("{project}", project)
		.replaceAll("{model}", model)
		.replaceAll("{time}", time);
}

function center(text: string, width: number): string {
	const fitted = truncateToWidth(text, width, "");
	const left = Math.max(0, Math.floor((width - visibleWidth(fitted)) / 2));
	return truncateToWidth(`${" ".repeat(left)}${fitted}`, width, "");
}

function divider(theme: Theme, width: number): string {
	const length = Math.min(32, Math.max(8, width - 4));
	return center(theme.fg("borderMuted", "─".repeat(length)), width);
}

function createHeader(
	config: MenuConfig,
	greeting: string,
	ctx: ExtensionContext,
): Parameters<NonNullable<ExtensionContext["ui"]["setHeader"]>>[0] {
	return (_tui, theme) => ({
		render(width: number): string[] {
			const safeWidth = Math.max(1, width);
			const lines: string[] = [];

			if (config.showArt && config.art.length > 0) {
				lines.push("");
				for (const artLine of config.art) {
					lines.push(center(theme.fg("text", artLine), safeWidth));
				}
			}

			lines.push("");
			lines.push(center(theme.bold(theme.fg("text", templateValue(greeting, ctx))), safeWidth));

			if (config.subtitle.length > 0) {
				lines.push(center(theme.fg("muted", templateValue(config.subtitle, ctx)), safeWidth));
			}

			const contextParts: string[] = [];
			if (config.showContext) contextParts.push(templateValue("{project}", ctx));
			if (config.showModel && ctx.model) contextParts.push(`${ctx.model.provider}/${ctx.model.id}`);
			if (config.showClock) contextParts.push(templateValue("{time}", ctx));
			if (contextParts.length > 0) {
				lines.push("");
				lines.push(center(theme.fg("dim", contextParts.join("  ·  ")), safeWidth));
			}

			if (config.prompt.length > 0) {
				lines.push("");
				lines.push(center(theme.fg("muted", templateValue(config.prompt, ctx)), safeWidth));
			}

			if (config.showHints && config.hints.length > 0) {
				lines.push("");
				lines.push(divider(theme, safeWidth));
				for (const hint of config.hints) {
					lines.push(center(theme.fg("dim", templateValue(hint, ctx)), safeWidth));
				}
			}

			lines.push("");
			return lines.map((line) => truncateToWidth(line, safeWidth, ""));
		},
		invalidate() {},
	});
}

function configForEditing(loaded: LoadedMenu, path: string): RawConfig {
	if (path === loaded.global.path) return { ...loaded.global.data };
	if (path === loaded.project?.path) return { ...(loaded.project?.data ?? {}) };
	return {};
}

function writeConfig(path: string, data: RawConfig): void {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function refreshMenu(
	ctx: ExtensionContext,
	state: { loaded: LoadedMenu; greeting: string; headerEnabled: boolean },
	rotateGreeting = true,
): void {
	state.loaded = loadMenu(ctx);
	if (rotateGreeting || !state.loaded.config.greetings.includes(state.greeting)) {
		state.greeting = pickGreeting(state.loaded.config.greetings);
	}

	if (state.headerEnabled && ctx.mode === "tui") {
		ctx.ui.setHeader(createHeader(state.loaded.config, state.greeting, ctx));
	}
}

function defaultConfigPath(ctx: ExtensionContext, loaded: LoadedMenu): string {
	if (ctx.isProjectTrusted() && existsSync(join(ctx.cwd, CONFIG_DIR_NAME))) {
		return loaded.project?.path ?? join(ctx.cwd, CONFIG_DIR_NAME, CONFIG_FILE_NAME);
	}
	return loaded.global.path;
}

async function chooseConfigPath(ctx: ExtensionContext, loaded: LoadedMenu): Promise<string | undefined> {
	const options: string[] = [];
	const optionPaths = new Map<string, string>();

	if (ctx.isProjectTrusted()) {
		const projectPath = loaded.project?.path ?? join(ctx.cwd, CONFIG_DIR_NAME, CONFIG_FILE_NAME);
		const projectLabel = `Project  ${projectPath}`;
		options.push(projectLabel);
		optionPaths.set(projectLabel, projectPath);
	}

	const globalLabel = `Global   ${loaded.global.path}`;
	options.push(globalLabel);
	optionPaths.set(globalLabel, loaded.global.path);

	if (options.length === 1) return optionPaths.get(options[0]);
	const selected = await ctx.ui.select("Save main menu changes to", options);
	return selected ? optionPaths.get(selected) : undefined;
}

async function savePatch(
	ctx: ExtensionContext,
	state: { loaded: LoadedMenu; greeting: string; headerEnabled: boolean },
	patch: ConfigPatch,
	removeKeys: string[] = [],
): Promise<boolean> {
	// Quick edits always target the active project config when one is available.
	// This prevents a global edit from being immediately masked by a project
	// override.
	const path = defaultConfigPath(ctx, state.loaded);
	const next = configForEditing(state.loaded, path);
	Object.assign(next, patch);
	for (const key of removeKeys) delete next[key];

	try {
		writeConfig(path, next);
		refreshMenu(ctx, state, false);
		ctx.ui.notify(`Saved ${path}`, "info");
		return true;
	} catch (error) {
		const reason = error instanceof Error ? error.message : String(error);
		ctx.ui.notify(`Could not save ${path}: ${reason}`, "error");
		return false;
	}
}

async function toggleQuietStartup(
	ctx: ExtensionContext,
	state: { loaded: LoadedMenu; greeting: string; headerEnabled: boolean },
	reload?: () => Promise<void>,
): Promise<void> {
	const next = !state.loaded.quietStartup;
	const settings = readDocument(state.loaded.settingsPath, []).data;

	try {
		writeConfig(state.loaded.settingsPath, { ...settings, quietStartup: next });
		if (reload) {
			ctx.ui.notify(`${next ? "Hiding" : "Showing"} loaded startup resources; reloading…`, "info");
			await reload();
			return;
		}

		state.loaded.quietStartup = next;
		ctx.ui.notify(
			`${next ? "Hiding" : "Showing"} loaded startup resources. Use /reload to apply it.`,
			"info",
		);
	} catch (error) {
		const reason = error instanceof Error ? error.message : String(error);
		ctx.ui.notify(`Could not update ${state.loaded.settingsPath}: ${reason}`, "error");
	}
}

async function editRawConfig(
	ctx: ExtensionContext,
	state: { loaded: LoadedMenu; greeting: string; headerEnabled: boolean },
): Promise<void> {
	const path = await chooseConfigPath(ctx, state.loaded);
	if (!path) return;

	const existing = configForEditing(state.loaded, path);
	const edited = await ctx.ui.editor("Edit main-menu.json", JSON.stringify(existing, null, 2));
	if (edited === undefined) return;

	let parsed: unknown;
	try {
		parsed = JSON.parse(edited);
	} catch (error) {
		const reason = error instanceof Error ? error.message : String(error);
		ctx.ui.notify(`Invalid JSON: ${reason}`, "error");
		return;
	}

	if (!isRecord(parsed)) {
		ctx.ui.notify("The config must be a JSON object", "error");
		return;
	}

	try {
		writeConfig(path, parsed);
		refreshMenu(ctx, state);
		ctx.ui.notify(`Saved ${path}`, "info");
	} catch (error) {
		const reason = error instanceof Error ? error.message : String(error);
		ctx.ui.notify(`Could not save ${path}: ${reason}`, "error");
	}
}

async function resetConfig(
	ctx: ExtensionContext,
	state: { loaded: LoadedMenu; greeting: string; headerEnabled: boolean },
): Promise<void> {
	const path = await chooseConfigPath(ctx, state.loaded);
	if (!path) return;

	const confirmed = await ctx.ui.confirm(
		"Reset main menu config?",
		`Remove ${path}? Values from the other config scope may still apply.`,
	);
	if (!confirmed) return;

	try {
		if (existsSync(path)) unlinkSync(path);
		refreshMenu(ctx, state);
		ctx.ui.notify(`Reset ${path}`, "info");
	} catch (error) {
		const reason = error instanceof Error ? error.message : String(error);
		ctx.ui.notify(`Could not reset ${path}: ${reason}`, "error");
	}
}

async function showMenu(
	ctx: ExtensionContext,
	state: { loaded: LoadedMenu; greeting: string; headerEnabled: boolean },
	reload?: () => Promise<void>,
): Promise<void> {
	if (!ctx.hasUI) return;

	const choices = [
		"Edit greeting",
		"Edit ASCII art",
		"Edit subtitle",
		"Edit prompt hint",
		"Edit raw config",
		state.loaded.config.showHints ? "Hide startup hints" : "Show startup hints",
		state.loaded.quietStartup ? "Show loaded startup resources" : "Hide loaded startup resources",
		"Reload config from disk",
		state.headerEnabled ? "Restore built-in pi header" : "Show custom main menu",
		"Reset config file",
		"Close",
	];

	const choice = await ctx.ui.select("Main menu", choices);
	if (!choice || choice === "Close") return;

	switch (choice) {
		case "Edit greeting": {
			const value = await ctx.ui.input("Greeting", state.greeting);
			if (value !== undefined) {
				await savePatch(ctx, state, { greetings: value.length > 0 ? [value] : [] }, ["greeting"]);
			}
			return;
		}
		case "Edit ASCII art": {
			const value = await ctx.ui.editor("ASCII art", state.loaded.config.art.join("\n"));
			if (value !== undefined) {
				await savePatch(
					ctx,
					state,
					{ art: value, showArt: value.trim().length > 0 },
					["artFile"],
				);
			}
			return;
		}
		case "Edit subtitle": {
			const value = await ctx.ui.input("Subtitle", state.loaded.config.subtitle);
			if (value !== undefined) await savePatch(ctx, state, { subtitle: value });
			return;
		}
		case "Edit prompt hint": {
			const value = await ctx.ui.input("Prompt hint", state.loaded.config.prompt);
			if (value !== undefined) await savePatch(ctx, state, { prompt: value });
			return;
		}
		case "Edit raw config":
			await editRawConfig(ctx, state);
			return;
		case "Hide startup hints":
		case "Show startup hints":
			await savePatch(ctx, state, { showHints: !state.loaded.config.showHints });
			return;
		case "Hide loaded startup resources":
		case "Show loaded startup resources":
			await toggleQuietStartup(ctx, state, reload);
			return;
		case "Reload config from disk":
			refreshMenu(ctx, state);
			ctx.ui.notify("Main menu reloaded", "info");
			return;
		case "Restore built-in pi header":
			state.headerEnabled = false;
			ctx.ui.setHeader(undefined);
			ctx.ui.notify("Built-in pi header restored", "info");
			return;
		case "Show custom main menu":
			state.headerEnabled = true;
			refreshMenu(ctx, state, false);
			ctx.ui.notify("Custom main menu enabled", "info");
			return;
		case "Reset config file":
			await resetConfig(ctx, state);
			return;
	}
}

export default function mainMenuExtension(pi: ExtensionAPI) {
	const state = {
		loaded: undefined as LoadedMenu | undefined,
		greeting: DEFAULT_GREETINGS[0]!,
		headerEnabled: true,
	};

	const command = async (args: string, ctx: ExtensionCommandContext): Promise<void> => {
		if (!state.loaded) {
			state.loaded = loadMenu(ctx);
			state.greeting = pickGreeting(state.loaded.config.greetings);
		}

		switch (args.trim().toLowerCase()) {
			case "reload":
				refreshMenu(ctx, state);
				ctx.ui.notify("Main menu reloaded", "info");
				return;
			case "builtin":
			case "default":
				state.headerEnabled = false;
				ctx.ui.setHeader(undefined);
				ctx.ui.notify("Built-in pi header restored", "info");
				return;
			case "reset":
				await resetConfig(ctx, state);
				return;
			default:
				await showMenu(ctx, state, () => ctx.reload());
		}
	};

	const getArgumentCompletions = (prefix: string) => {
		const commands = ["reload", "builtin", "reset"];
		const matches = commands.filter((value) => value.startsWith(prefix));
		return matches.length > 0 ? matches.map((value) => ({ value, label: value })) : null;
	};

	for (const name of ["welcome", "main-menu"]) {
		pi.registerCommand(name, {
			description: "Customize the pi startup greeting and ASCII art",
			getArgumentCompletions,
			handler: command,
		});
	}

	pi.registerShortcut(Key.ctrlShift("m"), {
		description: "Open the custom main menu",
		handler: async (ctx) => {
			if (!state.loaded) {
				state.loaded = loadMenu(ctx);
				state.greeting = pickGreeting(state.loaded.config.greetings);
			}
			await showMenu(ctx, state);
		},
	});

	pi.on("session_start", async (_event, ctx) => {
		state.loaded = loadMenu(ctx);
		state.greeting = pickGreeting(state.loaded.config.greetings);
		state.headerEnabled = true;

		if (state.loaded.warnings.length > 0 && ctx.hasUI) {
			ctx.ui.notify(state.loaded.warnings.join("\n"), "warning");
		}

		if (ctx.mode === "tui") {
			ctx.ui.setHeader(createHeader(state.loaded!.config, state.greeting, ctx));
		}
	});
}
