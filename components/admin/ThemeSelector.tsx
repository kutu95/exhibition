"use client";

import { useState } from "react";

import type { Theme } from "../../lib/supabase/types";
import { adminClientFetch } from "../../lib/admin-client-fetch";
import styles from "./ThemeSelector.module.css";

type ThemeSelectorProps = {
  themes: Theme[];
  selectedThemeIds: string[];
  onChange: (themeIds: string[]) => void;
};

export function ThemeSelector({ themes: initialThemes, selectedThemeIds, onChange }: ThemeSelectorProps) {
  const [themes, setThemes] = useState(initialThemes);
  const [newThemeName, setNewThemeName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleTheme = (themeId: string) => {
    onChange(
      selectedThemeIds.includes(themeId)
        ? selectedThemeIds.filter((id) => id !== themeId)
        : [...selectedThemeIds, themeId],
    );
  };

  const createTheme = async () => {
    const name = newThemeName.trim();
    if (!name) return;

    setCreating(true);
    setError(null);
    const response = await adminClientFetch("/api/admin/themes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setCreating(false);

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Failed to create theme.");
      return;
    }

    const theme = (await response.json()) as Theme;
    setThemes((current) => [...current, theme].sort((a, b) => a.name.localeCompare(b.name)));
    onChange([...selectedThemeIds, theme.id]);
    setNewThemeName("");
  };

  const activeThemes = themes.filter((theme) => theme.is_active);

  return (
    <div className={styles.wrap}>
      {activeThemes.length > 0 ? (
        <div className={styles.options}>
          {activeThemes.map((theme) => (
            <label className={styles.option} key={theme.id}>
              <input
                type="checkbox"
                checked={selectedThemeIds.includes(theme.id)}
                onChange={() => toggleTheme(theme.id)}
              />
              {theme.name}
            </label>
          ))}
        </div>
      ) : (
        <p className={styles.muted}>No themes have been created yet.</p>
      )}

      <div className={styles.create}>
        <input
          value={newThemeName}
          onChange={(event) => setNewThemeName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void createTheme();
            }
          }}
          placeholder="Add a theme, e.g. Oak"
          aria-label="New theme name"
        />
        <button type="button" onClick={() => void createTheme()} disabled={creating || !newThemeName.trim()}>
          {creating ? "Adding…" : "Add theme"}
        </button>
      </div>
      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  );
}
