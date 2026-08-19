import type { Gallery } from "../../lib/galleries";

type GalleryPickerProps = {
  galleries: Gallery[];
  value: string | null;
  onChange: (galleryId: string | null) => void;
  id?: string;
};

export function GalleryPicker({ galleries, value, onChange, id }: GalleryPickerProps) {
  return (
    <label>
      Gallery
      <select
        id={id}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value || null)}
      >
        <option value="">Public gallery</option>
        {galleries.map((gallery) => (
          <option key={gallery.id} value={gallery.id}>
            {gallery.name}
          </option>
        ))}
      </select>
    </label>
  );
}
