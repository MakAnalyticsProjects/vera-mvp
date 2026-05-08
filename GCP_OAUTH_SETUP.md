# GCP OAuth setup — handoff guide

This is a self-contained guide for whoever provisions the Google OAuth credentials on the GCP side. Forward it to them. Total work: **~10 minutes** if the GCP project already exists, **~15 minutes** if it doesn't.

What you'll produce at the end:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

Send those two strings back to Aditya. He'll wire them into Vercel and the app will start accepting Google sign-ins.

---

## 1. Pick or create the GCP project

You can either:

- **Reuse an existing GCP project** that the team already manages (preferred — keeps OAuth clients consolidated). Pick whichever one is the natural home for `vera-mvp` / Priority Roofs Dallas.
- **Create a new project** if you want this isolated. Naming suggestion: `vera-mvp` or `priority-roofs-vera`. Either works.

To create a new project:
1. Open https://console.cloud.google.com/projectcreate
2. Project name: `vera-mvp` (or your preference)
3. Org/folder: pick your team's
4. Click **Create**, wait ~10 seconds for it to become available
5. Make sure the project is selected in the top dropdown of the GCP console

You **don't need to enable billing**. OAuth sign-in is free.

You **don't need to enable any APIs** (no Google+ API, no People API). OAuth client credentials work standalone for sign-in.

---

## 2. Configure the OAuth consent screen

This is the page Google shows users when they click "Sign in with Google" — the dialog that says "Vera wants to access your Google account."

1. Go to **APIs & Services → OAuth consent screen**
   - Direct link: https://console.cloud.google.com/apis/credentials/consent
2. **User Type**: select **External** (lets anyone with a Google account sign in — internal would limit to your Google Workspace org). Click **Create**.
3. Fill in the **App information** section:
   - **App name**: `Vera Calloway` (or `Vera AR Studio` — whatever you want shown to users)
   - **User support email**: your email
   - **App logo** (optional): can skip for now
4. **App domain** section (all optional, can leave blank):
   - Application home page: `https://vera-mvp.vercel.app`
   - Developer contact email: your email
5. Click **Save and continue**
6. **Scopes** screen: don't add any scopes. Click **Save and continue**.
7. **Test users** screen: this only matters if you keep the app in "Testing" mode. You can:
   - Add a few specific Gmail addresses here for testing (Israel's, Aditya's, etc.) — these accounts can sign in even while the app is in Testing
   - OR skip and click **Publish app** later (Section 5 below) so any Google account can sign in
8. Click **Save and continue**, then **Back to dashboard**

---

## 3. Create the OAuth client ID

This produces the actual `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` strings.

1. Go to **APIs & Services → Credentials**
   - Direct link: https://console.cloud.google.com/apis/credentials
2. Click **+ CREATE CREDENTIALS → OAuth client ID**
3. **Application type**: **Web application**
4. **Name**: `vera-mvp-web` (internal label, not user-visible)
5. **Authorized JavaScript origins** — click **+ ADD URI** twice and add:
   - `https://vera-mvp.vercel.app`
   - `http://localhost:3000`
6. **Authorized redirect URIs** — click **+ ADD URI** twice and add:
   - `https://vera-mvp.vercel.app/api/auth/callback/google`
   - `http://localhost:3000/api/auth/callback/google`
7. Click **Create**
8. A modal pops up with **Your Client ID** and **Your Client Secret**. **Copy both values.**

That's `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

---

## 4. Send the credentials back

Drop the two values to Aditya however is most secure for your team:
- 1Password vault share (preferred)
- Encrypted message (Signal, encrypted Slack DM)
- Last resort: paste in chat with him

Format:
```
GOOGLE_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
```

---

## 5. Optional — publish the app (lets anyone sign in)

While the OAuth consent screen is in **Testing** mode, only the explicit test users you listed can sign in. To open it up to any Google account:

1. Go back to **APIs & Services → OAuth consent screen**
2. Click **Publish app**
3. The first 100 sign-ins are free; after that, Google requires verification (which is a separate process — but you won't need it at MVP scale)

If you keep it in Testing mode, that's also fine — just make sure the people who'll use the app are listed under **Test users**.

---

## 6. Common issues

- **"Error 400: redirect_uri_mismatch"** during sign-in: the redirect URI Auth.js sends doesn't exactly match what you registered. Re-check Section 3 step 6 — the trailing path is `/api/auth/callback/google`, not `/auth/callback/google`.
- **Localhost not working**: confirm `http://localhost:3000` (no trailing slash) is in both the JS origins AND redirect URIs lists.
- **App stuck in "verification required"**: only happens for sensitive/restricted scopes. We don't request any, so this shouldn't apply. If it does, click "Submit for verification" or stay in Testing mode.

---

## What happens after you send the credentials

Aditya runs:

```
vercel env add GOOGLE_CLIENT_ID production       # paste the client ID
vercel env add GOOGLE_CLIENT_SECRET production   # paste the secret
vercel env add NEXTAUTH_SECRET production        # auto-generated random hex
```

Then redeploys. Google sign-in goes live on https://vera-mvp.vercel.app/login.
