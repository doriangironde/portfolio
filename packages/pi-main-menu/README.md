# pi-main-menu

A small Pi package that replaces the startup header with a configurable welcome screen.
It gives Pi a personal front door: greetings, a block-art logo, project/model context,
and a lightweight customization menu.

## Install

```bash
pi install npm:pi-main-menu
```

Pi discovers the package through its `pi` manifest and loads the extension automatically.
The package is also tagged with `pi-package` so it can appear in the [Pi package gallery](https://pi.dev/packages).

## Commands

- `/welcome` or `/main-menu` — open the customization menu
- `Ctrl+Shift+M` — open the same menu
- `/welcome reload` — reload the configuration
- `/welcome builtin` — restore Pi's built-in header for the current session
- `/welcome reset` — remove a selected config file

## Configuration

The extension reads these files, with project values taking precedence:

- `~/.pi/agent/main-menu.json`
- `.pi/main-menu.json`

Example:

```json
{
  "greetings": [
    "Welcome back.",
    "What are we making today?"
  ],
  "art": [
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
    "████████             ███████"
  ],
  "showArt": true,
  "subtitle": "a small coding cockpit",
  "prompt": "Type a prompt or /welcome to customize",
  "hints": [
    "/welcome customize  ·  Ctrl+Shift+M menu"
  ],
  "showHints": true,
  "showContext": true,
  "showModel": true,
  "showClock": false
}
```

`art` may also be a single multiline string or an `artFile` path relative to the config file.
Set `showArt` to `false` to hide the art block. Clearing art in the interactive editor sets it
to `false` automatically.

Greeting, subtitle, prompt, and hint strings support `{project}`, `{model}`, and `{time}`
placeholders.

## Hide Pi's loaded resource list

Pi's native `quietStartup` setting hides the `[Context]`, `[Skills]`, and `[Extensions]`
sections while keeping this custom header visible:

```json
{
  "quietStartup": true
}
```

Put that in `.pi/settings.json` for one project or `~/.pi/agent/settings.json` globally.
The `/welcome` menu can toggle this setting.

## License

MIT
