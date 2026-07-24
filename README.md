# مخطط السفر — trip planner

A single-file web app. No build step, no dependencies to install.

## 1. Put it on GitHub Pages

1. Create a new repository (public — Pages needs a paid plan for private repos).
2. Upload `index.html` to the root of the repo.
3. **Settings → Pages → Source: Deploy from a branch → `main` / `(root)` → Save.**
4. Wait about a minute. Your app is at `https://YOUR-USERNAME.github.io/YOUR-REPO/`

It works right now, but each phone keeps its own copy. For shared editing, do step 2.

## 2. Turn on syncing (Firebase, free)

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → **Add project**. Skip Analytics.
2. **Build → Firestore Database → Create database** → pick a region → start in **production mode**.
3. Open the **Rules** tab, replace everything with this, and publish:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /honeymoon/{code} {
         allow read, write: if true;
       }
     }
   }
   ```

4. **Project settings → Your apps → Web (`</>`)** → register the app → copy the `firebaseConfig` object.
5. Open `index.html`, find `FIREBASE_CONFIG` near the top of the `<script>`, paste your values in, and uncomment the lines. It should end up like:

   ```js
   const FIREBASE_CONFIG = {
     apiKey: "AIza...",
     authDomain: "your-project.firebaseapp.com",
     projectId: "your-project",
     storageBucket: "your-project.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123:web:abc"
   };
   ```

6. Commit the change. Pages redeploys on its own.

## 3. Pair your two phones

1. Open the site, tap **إنشاء رمز جديد**. You get a 6-character code.
2. Send her the code. She opens the same URL and enters it under **أو أدخلا رمزاً موجوداً**.
3. You're now on the same plan. Edits show up on the other phone within about a second.

The gear icon (⚙) shows your code again, or lets you switch to a different one.

On iPhone: open the URL in Safari → Share → **Add to Home Screen**. It then opens full-screen like a normal app.

## About those rules

The rules above let anyone read or write any code they can guess. There are about a billion possible codes, so in practice nobody will stumble onto yours — but don't post the code publicly. If you want it properly locked down later, add Firebase Anonymous Auth and change the rule to `if request.auth != null`.

Your Firebase API key sitting in the HTML is normal and expected — it identifies the project, it isn't a password. Access is controlled by the rules, not the key.

## Free tier limits

Firestore's free tier allows 50,000 reads and 20,000 writes a day. Two people planning a honeymoon will use a rounding error of that.
