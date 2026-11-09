# TuneBoxd: Full Feature List (15 features)

Live site: https://tuneboxd.onrender.com

The project has **15 features**: the **3 client requirements** (CR-01 to CR-03) and
**12 more features** (F-01 to F-12). **Two of those 12 are AI features** (F-11 and F-12),
built on Google Gemini. The "Where to see it" column says where to find each one during the
presentation.

---

## Part A: Client requirements (3)

| ID | Client Requirement | Related Features | Implementation | Where to see it |
| --- | --- | --- | --- | --- |
| CR-01 | Users control who can see their diaries and custom lists. | Listening Diary (F-07), Custom Lists (F-08) | Each list and each diary can be **Public** or **Private**. The backend shows private content only to its owner. A private list's URL shows "List not found" to anyone else, and a private diary (and the stats that come from it) shows "This diary is private" to visitors. | **My Diary** → visibility setting; **Lists** → New/Edit List → Public/Private; open the URL in a second account to show it is blocked |
| CR-02 | Users can report inappropriate reviews for an administrator to check. | Written Reviews (F-05), Admin Tools (F-09) | A **Report** button on reviews (not on your own) asks for a reason and details. Each user can report a review only once. Admins see a report queue where they can **dismiss** the report, **remove** the review (it disappears from album pages, the feed and profiles) or **restore** it. | Any review → **Report**; sidebar → **Admin → Reports** |
| CR-03 | Users can see their personal listening statistics. | Listening Diary (F-07), Artist/Album Pages (F-04) | The Stats page uses diary records to show totals (entries, **distinct albums logged**, artists, average rating), **diary entries per month** for the last 12 months as a bar chart with a table view, **most-logged artists** and listens by day of the week. | Sidebar → **Stats**; profile → **Stats** tab |

---

## Part B: Other features (12)

| ID | Feature | What it does | Where to see it |
| --- | --- | --- | --- |
| F-01 | **User accounts & authentication** | Sign up, log in and log out with hashed passwords (bcrypt) and cookie sessions. You stay logged in after a refresh, and protected pages (Diary, Lists, Stats, For You, Ask AI, Admin) send logged-out visitors to the login page. | **Sign Up** / **Log In**; open `/diary` while logged out |
| F-02 | **Profiles & social following** | Edit your profile (photo, display name, bio). Every member has a public profile page with Reviews, Diary, Lists and Stats tabs plus follower/following counts. You can follow or unfollow members and find people in the **Community** directory. | Sidebar → **Profile** → Edit; **Community**; `/u/<username>` → **Follow** |
| F-03 | **Music search** | Search albums, artists and songs from the MusicBrainz database (through our backend, which handles rate limiting). | Sidebar → **Search** |
| F-04 | **Artist, album & song pages** | Detail pages with cover art (Cover Art Archive), artist info and discography, album tracklists, the average rating and all reviews. | Click any search result |
| F-05 | **Written reviews with ratings** | Write a review of an album or song with a **half-star** rating (0.5–5). You can edit or delete your own reviews. Reviews show on the item's page, the home feed and your profile, and each review has its own page. | Album/song page → **Write a Review** |
| F-06 | **Comments on reviews** | Members can comment on reviews to start a discussion. Authors can edit or delete their own comments. | Open a review (`/reviews/<id>`) → comment section |
| F-07 | **Listening diary** | Log what you listened to (album or song) and the date you listened (past dates are allowed), with optional notes. You can edit or delete entries, and the diary is listed by date. | Album/song page → **Add to Diary**; sidebar → **My Diary** |
| F-08 | **Custom lists** | Create named lists that hold both albums **and** songs, add items from any album/song page, put them in order with ↑/↓, and remove items. | Sidebar → **Lists** → **New List**; album page → **Add to List** |
| F-09 | **Administrator account management** | Admins can search all accounts and see review and "flagged" counts, **suspend** or **reactivate** members (a suspended user is logged out and their content is hidden), and **make another member an admin**. It has safeguards: you can't suspend or demote yourself, the last admin can't be removed, and the server checks the admin role against the database on every request. | Sidebar → **Admin → Accounts** |
| F-10 | **Personalized recommendations & listening summaries** | The **For You** page recommends albums based on members with similar taste, people you follow, your top artists and the best-rated albums in the community, and gives a short "why" for each. It never suggests albums you've already rated, logged or listed. It also creates saved, private **listening/review summaries** for any date range. | Sidebar → **For You** → **Refresh** / **Generate Summary** |
| F-11 | **AI: "Ask TuneBoxd" music discovery** 🤖 | Describe what you want to hear in plain English (e.g. *"Moody indie albums for a rainy night, like Radiohead"*). **Google Gemini** suggests albums with a reason for each, and TuneBoxd **checks every suggestion on MusicBrainz**, so only real albums appear. Albums you already know are tagged "In your history". Each user can ask 15 times per hour to stay within the free quota. | Sidebar → **Ask AI** |
| F-12 | **AI: Moderation assistant for reported reviews** 🤖 | When a review is reported, **Gemini** reads it and gives the admin a **verdict** (e.g. *Likely spam*), a **severity score**, a **suggested action** and an explanation. Admins can sort the queue by *Most serious first (AI)*. The AI only advises: the admin still makes the decision. | Report a review → **Admin → Reports** |

---

### Bonus AI work (beyond the required two)

- **"What listeners are saying" review digest:** on any album with 2+ reviews, Gemini summarizes
  the general opinion, what listeners praised and what they criticized.
- **AI-written text for recommendations and summaries (F-10):** when the Gemini key is set, the
  explanations and summaries are written by Gemini. Without the key they use built-in rules.

### Technical foundation (supports every feature)

- React 19 + Vite frontend, Node.js + Express 5 backend, deployed on Render.
- All data is stored in **MySQL on Amazon RDS** (`music_review_app`), using prepared statements.
- Automated unit and API tests (`npm test`).
