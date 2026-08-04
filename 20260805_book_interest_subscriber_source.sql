-- Allow email signups tagged as interest in the forthcoming Georgette book.
-- Additive and safe to run once on the live exhibition schema.

begin;

alter table exhibition.email_subscribers
  drop constraint if exists email_subscribers_source_check;

alter table exhibition.email_subscribers
  add constraint email_subscribers_source_check
  check (
    source is null
    or source in (
      'holding_page',
      'shop',
      'visit_page',
      'footer',
      'other',
      'book_interest'
    )
  );

commit;
