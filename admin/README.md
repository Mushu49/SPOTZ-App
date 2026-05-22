# SPOTZ Admin Dashboard

Standalone local-only MVP admin dashboard for manual moderation.

## Install

```bash
cd admin
npm install
```

## Run locally

```bash
npm run dev
```

Open the local Vite URL shown in the terminal.

## Make yourself admin

Admin roles are set manually only.

1. Open Firebase Console.
2. Go to Firestore Database.
3. Open `users/{yourUid}`.
4. Set `role` to `"admin"`.
5. Sign into the dashboard with the same Firebase Auth email/password account.

The dashboard cannot grant or remove admin roles.

## Review reports

1. Open the dashboard.
2. Choose a report status tab: `open`, `reviewed`, `action_taken`, or `dismissed`.
3. Select a report.
4. Review the target type, reason, details, reporter, target owner, spot title/images, and comment/reply text.
5. Add a review note if needed.
6. Choose:
   - `Mark reviewed`
   - `Dismiss`
   - `Mark action taken`

Reports are never deleted automatically.

## Ban or unban a user

1. Open a report with a target owner or reported user.
2. Add a review note or reason if needed.
3. Click `Ban user` or `Unban user`.

This writes:

- `users/{uid}.isBanned`
- `users/{uid}.banReason`
- `users/{uid}.bannedAt`
- `users/{uid}.bannedBy`

## Remove or restore a spot

1. Open a report with a `spotId`.
2. Add a review note or reason if needed.
3. Click `Remove spot` or `Restore spot`.

This writes:

- `spots/{spotId}.isRemoved`
- `spots/{spotId}.removedReason`
- `spots/{spotId}.removedAt`
- `spots/{spotId}.removedBy`

The mobile app hides spots where `isRemoved == true`.
