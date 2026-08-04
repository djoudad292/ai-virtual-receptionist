# AI Virtual Receptionist — Mobile App

Expo (SDK 54) app that mirrors the web dashboard: chat inbox, leads, appointments, analytics, knowledge base, team, and settings.

## Run it

```bash
cd mobile
npm install
npx expo start
```

Scan the QR code with **Expo Go** on your phone (SDK 54) or press `w` to open the web version.

## Android APK

Prebuilt installable APKs are available from the [EAS builds page](https://expo.dev/accounts/djaouadfrihs-team/projects/ai-virtual-receptionist/builds) — pick the latest Android **preview** build and install the `.apk` directly on any Android phone.

## Structure

- `src/app/` — file-based routes: `(auth)` screens and `(dashboard)` tabs/stacks
- `src/components/` — shared UI (`ui.tsx`) and the dashboard stack header
- `src/lib/` — API client (`api.ts`), auth context, theme tokens

The API base URL defaults to the Render backend and can be overridden with `EXPO_PUBLIC_API_URL`.
