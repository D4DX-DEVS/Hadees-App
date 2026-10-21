# ഹദീസ് വിജ്ഞാനകോശം — app

Expo (React Native) app for iOS, Android and web. Reads the Supabase DB (vols 1–3) directly with the public anon key; AI features go through the Cloudflare worker in `../worker`.

## Run

```bash
cp .env.example .env   # fill EXPO_PUBLIC_SUPABASE_ANON_KEY (+ EXPO_PUBLIC_AI_URL once the worker is deployed)
npm install
npx expo start         # w = web, i = iOS simulator, a = Android
```

## Structure

| Path | What |
|---|---|
| `src/app/(tabs)/index.tsx` | "Ask anything" home: chat-style thread, search / AI mode, hadith of the day, recent searches |
| `src/app/(tabs)/library.tsx` | Volumes → books (+ articles) |
| `src/app/book/[id].tsx` | Chapters (bab) of a book, filter, search-in-book |
| `src/app/chapter/[id].tsx` | Continuous reader for one bab, prev/next bab |
| `src/app/hadith/[id].tsx` | Single hadith: Arabic + Malayalam, variants, cross references, prev/next |
| `src/app/article/[id].tsx` | Prose sections (intro, biographies …) |
| `src/app/search.tsx` | Full results: volume + source filters, paging, AI "meaning" search |
| `src/app/(tabs)/saved.tsx` | Bookmarks, reading history, search history (device only) |
| `src/app/(tabs)/settings.tsx` | Theme (system/light/sepia/dark), Malayalam + Arabic fonts, sizes, line height, harakat, layout |
| `src/lib/api.ts` | Supabase + AI worker calls |
| `src/state/*` | Settings and personal library (AsyncStorage / localStorage) |

DB API used by the app: `supabase/app_api.sql` (views `book_stats`, `chapter_stats`, RPCs `app_search`, `app_search_titles`, `hadith_of_day`, `match_hadiths`).

## Deploy (all free tiers)

**Web → Cloudflare Pages**

```bash
npx expo export -p web           # -> dist/
npx wrangler pages deploy dist --project-name hadees
```

**AI worker** (`../worker`)

```bash
cd ../worker
npx wrangler login
npx wrangler secret put SUPABASE_ANON_KEY
npx wrangler secret put SUPABASE_SERVICE_KEY   # only for the embedding backfill
npx wrangler secret put ADMIN_TOKEN
# optional: npx wrangler secret put ANTHROPIC_API_KEY  (Claude answers; otherwise free Workers AI model)
npx wrangler deploy
# backfill embeddings (~8.5k hadith, repeat until remaining = 0)
curl -X POST https://<worker>/admin/embed -H "x-admin-token: <ADMIN_TOKEN>" -H "content-type: application/json" -d '{"limit":300}'
```

Then set `EXPO_PUBLIC_AI_URL=https://<worker>` in `.env` and rebuild.

**Mobile** — `npx eas-cli@latest build -p android|ios`.
