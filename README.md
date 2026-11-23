# Song Starter

A phone-first, installable PWA for keeping choir songs and event starting pitches together. It works offline after the first visit and stores songs, events, and pitch adjustments in the browser on this device. No account is needed to use the app, and song data is not synced to a server.

## Run locally

```sh
npm install
npm run dev
```

Create a production build with `npm run build`, then preview it with `npm run preview`.

## Publish with GitHub Pages

The `Deploy to GitHub Pages` workflow builds the app with the repository's `/songstarter/` base path and publishes the `dist` directory. In the repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions**. The site will be available at `https://newspire.github.io/songstarter/`.

## Install on Android

The app must be served from an HTTPS URL for Chrome to install it as a standalone PWA. After opening the deployed site in Chrome, choose **Install app** from the browser menu, then launch it from the phone's home screen. The development server's local HTTP address is for testing only and cannot provide the full installable experience.

Song and event data is stored per device and site address. Moving to a different hosting address or custom domain starts with a separate local data store.

## Starter features

- Save and edit a song’s name, major/minor key, and optional starting notes for soprano, alto, tenor, and bass.
- Search the song library by title, key, or starting note, and open playback controls directly on a song.
- Share an individual song with a QR code or link; its data is encoded in the link, and recipients choose whether to add it to their local library.
- Pick keys from illustrated key signatures and starting notes from labeled staff pictures.
- Create named events and add saved songs to them.
- Adjust a song by semitones, set an overall leader adjustment, and hear the combined shift when playing the key, a voice part, or all four notes together.
- Download a JSON backup of songs, events, note spellings, and pitch adjustments from **About → Backup and restore**; import it later by replacing or merging with the current data.
- Install the app on a compatible phone and use its cached app shell offline.

Song and event data stays in this browser’s local storage and is not synced to a server. Clearing browser/site data can remove it, so keep downloaded backups somewhere safe.
