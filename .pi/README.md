# Pi main menu extension

`.pi/extensions/main-menu.ts` replaces pi's startup header with a configurable welcome screen.

## Use it

Start pi from this project and the custom header will load automatically. While pi is open:

- `/welcome` or `/main-menu` opens the customization menu
- `Ctrl+Shift+M` opens the same menu
- `/welcome reload` reloads the JSON from disk
- `/welcome builtin` restores pi's built-in header for the current session
- `/welcome reset` removes the selected config file

The project also sets Pi's built-in `quietStartup` setting in `.pi/settings.json`, which hides the loaded Context/Skills/Extensions list while keeping this custom header. The `/welcome` menu can toggle that setting and reload Pi.

The extension is project-local, so pi may ask you to trust this project before loading it. To use the same extension everywhere, copy `.pi/extensions/main-menu.ts` to `~/.pi/agent/extensions/`.

## Configure it

Project config lives at `.pi/main-menu.json`. A global config can be placed at
`~/.pi/agent/main-menu.json`; project values override global values.

Supported fields:

| Field | Type | Description |
| --- | --- | --- |
| `greetings` | `string[]` | One greeting is selected when the session starts |
| `greeting` | `string` | Single-greeting shorthand |
| `art` | `string` or `string[]` | Inline ASCII art; a string may contain newlines |
| `artFile` | `string` | A path to an art file, relative to the config file |
| `showArt` | `boolean` | Show or hide the art block; clearing art in the editor sets this to `false` |
| `subtitle` | `string` | Small line beneath the greeting |
| `prompt` | `string` | Prompt hint below the context line |
| `hints` | `string` or `string[]` | Extra hint lines, controlled by `showHints` |
| `showHints` | `boolean` | Show the divider and hint lines |
| `showContext` | `boolean` | Show the current project directory |
| `showModel` | `boolean` | Show the active provider/model |
| `showClock` | `boolean` | Show the current local time |

Greeting, subtitle, prompt, and hint strings support `{project}`, `{model}`, and `{time}`
placeholders. The header truncates long art and copy to the terminal width so custom art
remains safe on narrow terminals.

Pi's native setting can also be configured globally in `~/.pi/agent/settings.json`:

```json
{
  "quietStartup": true
}
```

That hides the startup resource listing in every project. A project `.pi/settings.json` override only affects this project.
