-- Optional spoken "Hear the story" audio on individual photographs.
-- Additive: all columns nullable. Photographs without audio are unchanged.

begin;

alter table exhibition.products
  add column if not exists audio_url text,
  add column if not exists audio_duration text,
  add column if not exists audio_transcript text;

comment on column exhibition.products.audio_url is
  'Optional public path to a spoken story, e.g. /audio/hiding-in-plain-sight.mp3';
comment on column exhibition.products.audio_duration is
  'Optional display duration such as 0:47. The player also reads duration from the file.';
comment on column exhibition.products.audio_transcript is
  'Optional indexable transcript of the spoken story. Not embedded in the audio file.';

-- Placeholder example on the existing Redgate panorama.
-- Clearly labelled as example data — replace the file and copy before production.
update exhibition.products
set
  audio_url = '/audio/hiding-in-plain-sight.mp3',
  audio_duration = '0:08',
  audio_transcript = '[Placeholder example — not John''s spoken words. Replace this with the transcript of the recording for this photograph.]'
where slug = 'redgate-beach-panorama-1-1'
  and audio_url is null;

commit;

notify pgrst, 'reload schema';
