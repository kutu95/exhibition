-- Seed editable SEO titles/descriptions for public pages (WhatsApp / search previews).
-- Additive and safe to run once on the live exhibition schema.
-- App falls back to these same strings if a key is missing/blank so pages never 500.

begin;

insert into exhibition.site_content (content_key, content_value, content_type)
values
  (
    'seo_home_title',
    'The Georgette 150th Anniversary Photographic Exhibition | John Bowskill',
    'text'
  ),
  (
    'seo_home_description',
    'John Bowskill’s photographic exhibition for the 150th anniversary of the SS Georgette shipwreck at Redgate Beach, Margaret River, Western Australia.',
    'text'
  ),
  (
    'seo_story_title',
    'The Story | The Georgette 150th',
    'text'
  ),
  (
    'seo_story_description',
    'On 1 December 1876 the SS Georgette foundered off Western Australia. Seven drowned. This is the story the history books got wrong.',
    'text'
  ),
  (
    'seo_about_title',
    'About Photographer John Bowskill | The Georgette 150th',
    'text'
  ),
  (
    'seo_about_description',
    'Meet photographer John Bowskill — The Georgette 150th exhibition, coastal photography near Redgate Beach, and immersive installations in Margaret River.',
    'text'
  ),
  (
    'seo_book_title',
    'Author’s Preface — Book Sampler | The Georgette 150th',
    'text'
  ),
  (
    'seo_book_description',
    'Read John Bowskill’s author’s preface — from a drone revelation at Calgardup Bay to Scotland, the Clyde, and who gets remembered.',
    'text'
  ),
  (
    'seo_visit_title',
    'Visit | The Georgette 150th',
    'text'
  ),
  (
    'seo_visit_description',
    'The Georgette 150th at 20 Morris Rd, Forest Grove WA 6286 — open daily 10am–5pm, 12–27 September 2026. Margaret River Region Open Studios. Free admission.',
    'text'
  ),
  (
    'seo_shop_title',
    'Shop — Limited Edition Prints | The Georgette 150th',
    'text'
  ),
  (
    'seo_shop_description',
    'Limited edition archival photographic prints by John Bowskill. Calgardup Bay, Redgate Beach, Isaac Rock, and the wreck site of the SS Georgette.',
    'text'
  ),
  (
    'seo_installations_title',
    'Installations | The Georgette 150th',
    'text'
  ),
  (
    'seo_installations_description',
    'Three immersive installations — Cubarama, Captain Godfrey AI, and Drift — at The Georgette 150th exhibition, Margaret River Region Open Studios 2026.',
    'text'
  ),
  (
    'seo_cubarama_title',
    'Cubarama — Immersive Installation | The Georgette 150th',
    'text'
  ),
  (
    'seo_cubarama_description',
    'Cubarama: a four-wall 360° video installation of Georgette coastal footage. Available for galleries and museums to license, buy, or borrow.',
    'text'
  ),
  (
    'seo_captain_godfrey_title',
    'Captain Godfrey — Interactive Installation | The Georgette 150th',
    'text'
  ),
  (
    'seo_captain_godfrey_description',
    'Captain Godfrey: interactive MetaHuman visitors speak with, drawn from inquiry records. Available for galleries and museums to license, buy, or borrow.',
    'text'
  ),
  (
    'seo_drift_title',
    'Drift — Interactive Installation | The Georgette 150th',
    'text'
  ),
  (
    'seo_drift_description',
    'Drift is a Kinect-driven installation where visitors’ movement chooses which photographs appear. Available for galleries and museums to license, buy, or borrow.',
    'text'
  )
on conflict (content_key) do nothing;

commit;
