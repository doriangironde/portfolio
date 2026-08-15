# Portfolio

My personal portfolio :rocket:

Built with [Astro](https://astro.build) and Tailwind CSS.

## Development

```sh
npm install
npm run dev       # start dev server
npm run build     # build to ./dist/
npm run preview   # preview the build
```

## Environment variables

See `.env.example`:

- `GITHUB_TOKEN` / `GITHUB_USERNAME` — used at build time to render the contribution chart
- `LASTFM_API_KEY` / `LASTFM_USERNAME` — Last.fm now-playing data

## API routes

- `/api/cron-rebuild` — Vercel cron job that redeploys the site daily so build-time data stays fresh
- `/api/messages` — message board backed by `doriangironde/message-board` (`data/messages.json`)

## Pi main menu

This repo includes a project-local pi extension that replaces the startup header with a configurable greeting and ASCII-art welcome screen. See [`.pi/README.md`](.pi/README.md) for the available commands and configuration fields.
