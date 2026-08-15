# Portfolio

Personal portfolio of Dorian Gironde — founder of Nero, a web agency in Vichy, France, and future AI engineer.

Built with [Astro](https://astro.build) and Tailwind CSS. The site shows projects, a GitHub contribution chart, what's currently playing on Last.fm, a photo map, and a message board.

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
