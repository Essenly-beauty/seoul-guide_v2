-- Published Daiso place IDs include encoded names and addresses (up to 422
-- characters in the current catalog). The original 128-character checks make
-- guest-to-account merges fail as a batch and block individual Daiso saves.
-- Keep existing IDs unchanged so saved links and ratings remain associated.

alter table public.ratings
  drop constraint ratings_place_id_check,
  add constraint ratings_place_id_check
    check (char_length(place_id) between 1 and 1024);

alter table public.favorites
  drop constraint favorites_item_id_check,
  add constraint favorites_item_id_check
    check (char_length(item_id) between 1 and 1024);
