# Mobile booking demo · 2026-10-20

Open **http://127.0.0.1:3112/?lang=en#start** on the machine running the local server. If needed, start it from this worktree:

```sh
python3 -m http.server 3112 --bind 127.0.0.1 --directory docs/designs/customer-booking-mobile-20261019
```

This is an interactive sample salon, not a live booking service. No reservation, payment, email or message is created. Booking choices stay in memory until refresh. Only the language preference is saved in browser local storage. The demo makes no API calls and is not linked in production navigation.

## Try the full booking flow

1. Select **Start demo** on the opening screen.
2. Choose a service, then **Choose a specialist**.
3. Select **Min** or **Jiyoon**, then **Choose a time**. Scalp reset is available with Min only.
4. Choose **22 or 23 October 2026** and an enabled time, then **Review appointment**.
5. Review service, specialist, end time, Seoul timezone, total, sample deposit and balance. Tick the demo consent box and select **Preview confirmation**.
6. Select **View my appointments**. You can open the appointment, keep it, or select **Cancel appointment → Cancel sample appointment** to inspect the cancellation state.

Use **↺** beside the language selector to reset choices and return to the instructions. The desktop sidebar also has **Start over**. Reset preserves your selected language. Refresh clears booking choices. The direct service entry is http://127.0.0.1:3112/?lang=en#services.

## Languages

The native selector above the phone stays visible on mobile and desktop: **English / 日本語 / 简体中文 / Español / Français**. English is the default. The selected language persists on this origin; `?lang=` overrides the saved preference and is updated when you change languages.

- English: http://127.0.0.1:3112/?lang=en#start
- Japanese: http://127.0.0.1:3112/?lang=ja#start
- Simplified Chinese: http://127.0.0.1:3112/?lang=zh-CN#start
- Spanish: http://127.0.0.1:3112/?lang=es#start
- French: http://127.0.0.1:3112/?lang=fr#start

All demo screens, sidebar instructions, accessible labels, sample service descriptions, staff roles, financial labels, consent and cancellation copy use the standalone `locales.js` catalog. Dates and KRW numbers use the selected locale. Salon/staff proper names remain unchanged. Language switching preserves the current screen and selections, including a completed sample appointment. Browser storage restrictions do not prevent the demo from working.

The production app uses its own locale implementation; no app imports or booking APIs are used by this static demo.

## Other states to test

- Change a service or specialist to clear downstream date/time and consent.
- Tuesday and Wednesday are closed. Saturday has no slots; **See Friday’s times** recovers.
- Disabled times cannot be selected or confirmed.
- Review’s **Preview an expired selection** demonstrates recovery. Select **Choose a new time**, choose another time, review and consent again. There is no real hold or timer.
- Save a place and use **Saved**. Empty **Bookings** and **Nails** results are implemented.
- Desktop screen shortcuts intentionally seed sample choices. Use **Start demo** for a complete manual walkthrough.

## Verification

```sh
node --check docs/designs/customer-booking-mobile-20261019/app.js
node --check docs/designs/customer-booking-mobile-20261019/locales.js
node --test docs/designs/customer-booking-mobile-20261019/demo.test.cjs
```

The 17 Node VM tests exercise the actual scripts with a minimal DOM mock: entry instructions, full booking/cancellation, route guards, unavailable slots, incompatible staff, consent, expiry/recovery, saved/empty states, focus/scroll preservation, every language, translation interpolation, locale persistence, and denied storage. These are behavioral checks, not browser screenshots or device layout validation. Browser-rendered verification remains pending.

## Design and sample data

Current direction: white/black, spacious mobile layouts, restrained orange selection accents, black primary actions and price pins. Staff use small 50px initials with separate name, role, speciality and language lines. The entry screen adds a concise five-step guide; language and reset controls remain available above every screen.

- Reference audit: `reports/design/references/beautynow-20261019/beautynow-booking-audit.html`.
- Uber Base sheets informed map-related hierarchy; no branded artwork copied.
- Photo copied from the existing project asset `public/places/ct-hosu-dosan-konkuk-seongsu-branch-k-pop-hair-ccl/1.webp`. It is illustrative, not a merchant connection.
- Prices, the ₩10,000 deposit, staff, dates and policies are design examples. Live identity, immutable quotes, availability/holds, payments, refunds and settlement remain separate work.
- The map is explicitly illustrative. The actual app retains its existing Leaflet/CARTO map.
- Target widths: 320, 390, 430, 768 and 1440px. CSS uses safe areas, dynamic viewport height, 44px controls and reduced motion.
- Static demo: port 3112. Existing customer app: http://127.0.0.1:3113/map. Both URLs are local previews, not production deployments. A separate phone cannot open a server bound to this machine’s `127.0.0.1`.
