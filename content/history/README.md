# Historical content drafts — for editorial review

These are **drafts**, not published pages. Nothing in this folder is wired into the
site yet. They exist because the SEO audit found that the site's topical authority
rests almost entirely on two pages (`/story`, 1,031 words and `/book`, 1,217 words),
while eleven of the twenty-one indexable URLs are shop listings. To Google the site
currently looks like a small print shop attached to an event listing, not a
historical resource about the SS Georgette.

## How these were written

Every factual claim below is drawn from material **already published on this site**
(`/story`, `/book`, `/visit`, `/installations`, `/about-the-photographer`) or from
the product descriptions in the database. Nothing has been invented.

Where a claim needs a citation, a date, or a decision that only the author can make,
it is marked inline:

- `[VERIFY]` — the site asserts this but no source is given here; confirm before publishing.
- `[SOURCE NEEDED]` — should carry a footnote to a primary record (SROWA, Battye, Lloyd's Register, Trove).
- `[EXPAND]` — a genuine gap where the author has material the drafts do not.

Do not publish a page with markers still in it. On a history site, an unsourced
confident assertion is worse than an acknowledged gap.

## Two contradictions in the current live copy

Both should be resolved before any of this is published, because they currently
appear on pages Google has already crawled.

1. **Seven or eight drowned?**
   - `/story` says *"Eight people drowned"* (`app/story/page.tsx`).
   - The homepage fallback copy says *"Seven people drowned when the lifeboat capsized"* (`app/page.tsx`).
   - `seo_story_description` also says *"Seven drowned"* (`lib/seo-content.ts`, and the
     `site_content` row that overrides it).

2. **The title of Marcia van Zeller's novel.**
   - `/story` calls it *The Capes*.
   - `/visit` and `/installations` call it *Cruel Capes* (Curtin University, 2014).

## Suggested publication shape

A `/history/` hub with these as child pages, linked from `/story` and the footer:

| Path | Draft | Why it earns its place |
| --- | --- | --- |
| `/history` | `index.md` | Hub; gives the topic a root other than the shop |
| `/history/ss-georgette` | `ss-georgette.md` | The ship as an entity — the highest-volume query on this topic |
| `/history/captain-john-godfrey` | `captain-john-godfrey.md` | Named person, currently only a character in an installation |
| `/history/sam-isaacs` | `sam-isaacs.md` | The exhibition's central argument; deserves its own URL |
| `/history/grace-bussell` | `grace-bussell.md` | High search volume; the site has a genuinely differentiated view |
| `/history/court-of-inquiry-1876` | `court-of-inquiry-1876.md` | Primary-record material nobody else has online in this form |
| `/history/calgardup-bay` | `calgardup-bay.md` | Place entity tying the photographs to the history |
| `/history/method` | `reconstruction-methodology.md` | E-E-A-T: shows the work behind the claims |

Publish in that order of value, not all at once. Two well-sourced pages beat eight
thin ones — thin pages are what caused the indexing problem in the first place.
