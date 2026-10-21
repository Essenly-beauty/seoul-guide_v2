# Customer web app: languages, images and login

Implemented in the existing customer app at http://127.0.0.1:3113. This work remains local in `service-quality-20261018`; no production deployment, GitHub push, database migration or customer booking submission was performed.

## Review links

- Login: http://127.0.0.1:3113/login?next=/menu
- Language: http://127.0.0.1:3113/settings/language
- Map: http://127.0.0.1:3113/map
- General search: http://127.0.0.1:3113/search
- Booking demo: http://127.0.0.1:3112/?lang=en#start

## What changed

- **Login:** compact centered brand header, language action, persistent visible field labels, 54px controls, black main action, a quiet Google sign-in button, and fewer dividers. Return destination, account switching, real authentication and resend-confirmation flows remain connected. Connection errors are readable and receive focus. No account was created or signed in during QA.
- **Five customer languages:** English, Japanese, Simplified Chinese, Spanish and French. Selection is available from My, settings and login, persists in browser storage with a cookie fallback, synchronizes across tabs, and sets document language. English SSR/hydration baseline avoids text mismatches. Partner screens retain their existing copy. Localization covers shared navigation/settings/auth/profile, discovery/search/filter/station selection, place information/actions/menu states, ranking/saved/story UI. Verified place names, Korean addresses, reviews and editorial article bodies retain their source language.
- **Language selection basis:** the user requested EN/JA/ES/FR; Chinese Simplified is the fifth language given the scale of inbound Chinese travel. This is a product language choice, not a claim that these are Korea’s five largest visitor language groups. Reference: [KTO January 2026 inbound statistics](https://touraz.kr/statistics?bbsSeq=310314_1127&boardMode=V&pageCD=index).
- **Map preview:** the half sheet measures its natural contents plus the handle and fixed action bar, rather than always consuming 48% of the viewport. A 32px no-photo note replaces the large empty media block. Long summaries can scroll, while real photos retain their aspect ratio. Drag snap offsets use the same measured height. Locate/saved map controls follow the new edge and sit side by side.
- **Search:** three defined groups with 12px heading-to-content spacing and 28px between groups; compact result rows; a two-column category grid; short placeholder and neutral focus treatment. The sorted discovery list is labelled “Places to explore” rather than implying live trending data.
- **Station route fields:** consistent row heights, all three via actions grouped together, and Swap beside Add via instead of consuming an isolated right column. Station selection remains a full-page dialog, with English/Korean station matching, keyboard selection and committed values separate from queries.
- **Icons:** Head Spa uses a shower, Nail & Lash a hand, Shopping/Mall a store, Hair a lighter small scissors fallback. Map markers, category chips and list fallbacks use the same category mapping.
- **Retailer identity:** actual previously supplied Olive Young and Daiso artwork replaces the approximate SVG marks in map pins, category chips and ranking. Artwork is contained rather than cropped. See [asset provenance](../../docs/assets/retailer-logo-sources.md).

## Image coverage and remaining source work

The old Nearby, saved and product list renderers displayed an empty placeholder regardless of available photo data. Shared thumbnail components now use the existing verified source data. A failed thumbnail tries the full photo and other verified images before falling back to a retailer mark or a small category icon. No random stock photo is represented as an actual branch or product.

| Coverage across 1,008 places | Count |
|---|---:|
| Places with verified photos | 383 |
| Brand mark only | 425 |
| Category icon only | 200 |

There are 837 full place photographs in the existing dataset. All referenced local files exist. The photographed JUNO Gangnam Square example has no verified image in this dataset; the new fallback cannot supply a missing photograph. The 14 curated product records and 38 Daiso ranking products also lack product photos. Article image placeholders need approved editorial artwork. These are source-content tasks still outstanding, not rendering failures.

The [image coverage manifest](2026-10-20-image-coverage.json) lists missing place and product records. Regenerate it with `npx vite-node scripts/report-customer-image-coverage.ts`. Official source reconnaissance found [ONYAD’s salon listing](https://onyad.kr/Salon) (fetch blocked with403) and [JUNO’s official branch selector](https://www.junohair.com/junohair/reservation/process01_branch) (client-rendered branch data). No unverified branch photos were imported.

## Booking demo

The standalone demo now opens on a mobile-friendly guide with Start demo and five steps. Language selection stays visible on every screen and persists independently of the app origin. Service, specialist, date/time, review/consent, confirmation, saved/booking, expiry recovery and cancellation screens are translated. Switching language retains a completed appointment; reset clears choices but retains language.

Select Start demo, a service and specialist, then an available slot on22/23 October2026. Review, consent and Preview confirmation. Open My appointments to test cancellation. This sample performs no reservation, payment or message request. The actual app’s service catalog continues to distinguish loading/error/unpublished data and does not redirect visitors to a competitor booking site.

## Validation

- Actual HTTP requests: login, language, map, search, place detail, both retailer rankings, stories, saved, My and partner all returned200. The language page renders five native-name radio choices; the login has visible input labels.
- CSS parsed successfully for customer theme, auth and station-search modules.
- Fresh code review found and resolved two regressions: floating map controls needed the measured sheet height; dynamic Via labels needed template interpolation.
- Browser runtime returned no available browsers. These results are code/HTTP/automated behavior checks, not screenshot or physical-device verification. Mobile light/dark visual checks and real auth interaction remain pending.
- Production build was not rerun; the previous Google Fonts network restriction remains an environment limitation.

Final automated result: **150 test files / 1,975 app tests passed; 17 standalone demo tests passed.** TypeScript, ESLint and `git diff --check` passed. Verification logs are in `/private/tmp/customer-final-{tests,typecheck,lint}.log` and `/private/tmp/booking-demo-final-tests.log` on the local machine.
