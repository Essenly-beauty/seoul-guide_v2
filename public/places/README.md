# Place photos

Drop real photos here, one folder per place id, then run:

```bash
node scripts/build-place-photos.mjs
```

```
public/places/
  glow-skin-clinic/     ← the place id, exactly as it appears in the data
    1.jpg               ← order follows the filename; 1 shows first
    2.jpg
    3.jpg
```

- **Formats**: jpg / png / webp / avif. Keep each file under ~600KB — the
  sheet rail renders tiles about 175px wide, so anything larger is wasted
  download on a phone.
- **Ids**: a folder whose name is not a real place id is reported as an
  error rather than skipped, because a typo'd id is the likeliest mistake.
- **Rights**: only use photos we are allowed to publish — our own shots, or
  ones the venue has given us permission for. Do not copy images from
  Creatrip, Naver, Instagram, or Google listings; the copyright sits with
  the photographer or the platform.
- **No filler**: a place with no photo renders an honest empty state. Never
  add a stock or generic image to make a card look fuller.

Photos are served same-origin, so no Content-Security-Policy change is
needed. A third-party photo source (e.g. Google Places) would need its host
added to `img-src` in `next.config.mjs`.
