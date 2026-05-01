# Soundprint for Spotify

A Spotify listening analytics web app inspired by stats.fm. It shows top tracks, artists, genres, listening heatmaps, mood analysis, genre diversity, and a shareable music personality card.

## Live Site

https://reference-app-stats-fm-for-spotify.vercel.app

## Features

- Spotify OAuth with PKCE
- Top tracks, artists, and genres across 4-week, 6-month, and all-time ranges
- Listening heatmap by day and hour
- Mood and genre diversity scoring
- Shareable PNG music personality card export
- Demo data fallback when Spotify API credentials are not configured

## Setup

Create a `.env.local` file:

```env
VITE_SPOTIFY_CLIENT_ID=your_spotify_client_id
```

Add this redirect URI in your Spotify Developer app:

```text
https://reference-app-stats-fm-for-spotify.vercel.app/
```

Install and run:

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
```
