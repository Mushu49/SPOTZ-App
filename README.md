# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

## Firebase and Cloudinary setup

SPOTZ uses the Expo-compatible Firebase JS SDK for Firestore sync. The app connects to the `spotz-373c3` Firebase project from `src/services/firebase.ts`.

Firebase web app config reference:

```bash
projectId=spotz-373c3
```

Enable Firestore Database in the Firebase console before running the app.

## Legal pages and app review URLs

SPOTZ legal text lives in two places:

- In-app legal screens: `src/data/legalPages.ts`
- Hosted review pages: `public/*.html`

When legal text changes, update both the in-app source and the matching hosted HTML page, then deploy Firebase Hosting.

Public review URLs:

```text
Home: https://spotzapp.app
Privacy Policy: https://spotzapp.app/privacy
Terms of Use: https://spotzapp.app/terms
Community Guidelines: https://spotzapp.app/community-guidelines
Account Deletion: https://spotzapp.app/account-deletion
FAQ: https://spotzapp.app/faq
Support: https://spotzapp.app/support
```

Deploy hosting pages:

```bash
npx firebase-tools deploy --only hosting
```

Use these URLs in store review:

- App Store Connect Privacy Policy URL: `https://spotzapp.app/privacy`
- App Store Connect Support URL: `https://spotzapp.app/support`
- Google Play Console Privacy Policy URL: `https://spotzapp.app/privacy`
- Google Play Console developer/support website URL: `https://spotzapp.app/support`
- Account deletion/data deletion URL: `https://spotzapp.app/account-deletion`
- Terms of Use or EULA/reference URL, when requested: `https://spotzapp.app/terms`
- Community Guidelines URL, when requested: `https://spotzapp.app/community-guidelines`
- FAQ/help URL, when requested: `https://spotzapp.app/faq`

Review checklist:

- Privacy Policy is publicly reachable without login on mobile and desktop.
- Terms of Use is publicly reachable without login on mobile and desktop.
- Account Deletion page explains Profile > Settings > Legal > Delete Account.
- Account Deletion page says what is deleted, anonymized, and what may remain for moderation/legal reasons.
- In-app signup and terms acceptance links open hosted legal URLs.
- Settings > Legal includes Privacy Policy, Terms of Use, and Account Deletion.
- Run `npx.cmd tsc --noEmit` and `npm.cmd run lint` before submitting.

## Screenshot demo spots

Curated screenshot/demo spots live in `src/data/demoSpots.json`. The matching app-owned generated image assets live in `public/assets/demo-spots/`.

Use local screenshot mode when you want demo spots in the app without writing fake content to Firestore:

```powershell
$env:EXPO_PUBLIC_SPOTZ_DEMO_MODE='1'
npx.cmd expo start -c
```

Unset `EXPO_PUBLIC_SPOTZ_DEMO_MODE` or set it to `0` to disable local demo mode.

If you need seeded Firebase demo documents for production-like screenshots, run the seed script. It writes stable `spots/spotz-demo-*` documents only, marks every spot with `isDemo: true`, uses `isRemoved: false`, `isPrivate: false`, and creates a `spotz-demo-creator` public profile.

```powershell
npm.cmd run demo:spots:seed
npm.cmd run demo:spots:seed -- --yes-seed-demo-spots
```

Remove seeded demo data later with:

```powershell
npm.cmd run demo:spots:remove
npm.cmd run demo:spots:remove -- --yes-remove-demo-spots
```

The remove script deletes only Firestore spots where `isDemo == true`, plus the demo creator profile.

## Firebase password reset emails

SPOTZ sends password reset emails through Firebase Authentication with `sendPasswordResetEmail`.

Customize the reset email in Firebase Console:

1. Open Firebase Console.
2. Select project `spotz-373c3`.
3. Go to Build > Authentication.
4. Open the Templates tab.
5. Select Password reset.
6. Click the pencil/edit icon.
7. Review sender name, sender address, reply-to address, subject, and message.
8. Keep the Firebase reset link placeholder in the message so users can complete the reset.

The app uses `https://spotzapp.app/` as the Firebase password reset continue URL. If Firebase rejects reset emails with an unauthorized continue URL, add `spotzapp.app` in Authentication > Settings > Authorized domains.

## Manual moderation

SPOTZ does not include an admin dashboard yet. To ban a user manually:

1. Open Firebase Console.
2. Go to Firestore Database.
3. Open `users/{uid}` for the account.
4. Set `isBanned` to `true`.
5. Optionally add `banReason`, `bannedAt`, and `bannedBy`.

To unban the user, set `isBanned` to `false` or remove the ban fields.

The app checks `users/{uid}.isBanned` on startup/login and blocks banned accounts before the main app loads. Firestore rules in `firestore.rules` prevent normal clients from writing protected moderation fields: `isBanned`, `banReason`, `bannedAt`, `bannedBy`, `role`, and `isAdmin`.

To review reports manually:

1. Open Firebase Console.
2. Go to Firestore Database.
3. Open the top-level `reports` collection.
4. Filter reports where `status == "open"`.
5. Inspect the report details, including target ids, owner ids, text, titles, image URLs, reason, and details.
6. If there is no issue, set `status` to `"dismissed"`.
7. If you handled the report, set `status` to `"action_taken"`.
8. If you reviewed it but still need a neutral holding state, set `status` to `"reviewed"`.
9. Optionally add `reviewedAt`, `reviewedBy`, `reviewNote`, and `actionTaken`.

Valid report statuses are `open`, `reviewed`, `action_taken`, and `dismissed`. Do not delete reports automatically; they are moderation history.

Spot images are uploaded to Cloudinary so every device can render the same image URLs. Create an unsigned Cloudinary upload preset, then add:

```bash
EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME=dc8tl4fo9
EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET=spotz_uploads
EXPO_PUBLIC_CLOUDINARY_FOLDER=
```

The SPOTZ Cloudinary cloud name and unsigned upload preset are also built into `src/services/cloudinary.ts`. `EXPO_PUBLIC_CLOUDINARY_FOLDER` is optional; you can also set the folder directly on the unsigned upload preset.

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
