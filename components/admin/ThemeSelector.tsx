"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";

import type { Theme } from "../../lib/supabase/types";
import { adminClientFetch } from "../../lib/admin-client-fetch";
import styles from "./ThemeSelector.module.css";

type ThemeSelectorProps = {
  themes: Theme[];
  selectedThemeIds: string[];
  onChange: Dispatch<SetStateAction<string[]>>;
  onThemesChange?: Dispatch<SetStateAction<Theme[]>>;
};

export function ThemeSelector({
  themes: themesProp,
  selectedThemeIds,
  onChange,
  onThemesChange,
}: ThemeSelectorProps) {
  const [localThemes, setLocalThemes] = useState(themesProp);
  const [pendingThemeId, setPendingThemeId] = useState("");
  const [showNewTheme, setShowNewTheme] = useState(false);
  const [newThemeName, setNewThemeName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const themes = onThemesChange ? themesProp : localThemes;

  const updateThemes = (updater: SetStateAction<Theme[]>) => {
    if (onThemesChange) {
      onThemesChange(updater);
      return;
    }
    setLocalThemes(updater);
  };

  const activeThemes = useMemo(
    () => [...themes].filter((theme) => theme.is_active).sort((a, b) => a.name.localeCompare(b.name)),
    [themes],
  );

  const selectedThemes = useMemo(
    () => activeThemes.filter((theme) => selectedThemeIds.includes(theme.id)),
    [activeThemes, selectedThemeIds],
  );

  const availableThemes = useMemo(
    () => activeThemes.filter((theme) => !selectedThemeIds.includes(theme.id)),
    [activeThemes, selectedThemeIds],
  );

  const addThemeId = (themeId: string) => {
    if (!themeId) return;
    onChange((current) => (current.includes(themeId) ? current : [...current, themeId]));
  };

  const removeThemeId = (themeId: string) => {
    onChange((current) => current.filter((id) => id !== themeId));
  };

  const upsertTheme = (theme: Theme) => {
    updateThemes((current) => {
      const without = current.filter((item) => item.id !== theme.id);
      return [...without, theme].sort((a, b) => a.name.localeCompare(b.name));
    });
    addThemeId(theme.id);
  };

  const addSelectedFromDropdown = () => {
    if (!pendingThemeId) return;
    addThemeId(pendingThemeId);
    setPendingThemeId("");
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
      const body = (await response.json().catch(() => null)) as { error?: string; theme?: Theme } | null;
      if (response.status === 409 && body?.theme) {
        upsertTheme(body.theme);
        setNewThemeName("");
        setShowNewTheme(false);
        return;
      }
      setError(body?.error ?? "Failed to create theme.");
      return;
    }

    const theme = (await response.json()) as Theme;
    upsertTheme(theme);
    setNewThemeName("");
    setShowNewTheme(false);
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.pickerRow}>
        <select
          className={styles.select}
          value={pendingThemeId}
          onChange={(event) => setPendingThemeId(event.target.value)}
          aria-label="Choose a theme"
          disabled={availableThemes.length === 0}
        >
          <option value="">
            {availableThemes.length === 0 ? "All themes selected" : "Select a theme…"}
          </option>
          {availableThemes.map((theme) => (
            <option key={theme.id} value={theme.id}>
              {theme.name}
            </option>
          ))}
        </select>
        <button type="button" onClick={addSelectedFromDropdown} disabled={!pendingThemeId}>
          Add
        </button>
        <button
          type="button"
          className={styles.secondary}
          onClick={() => {
            setShowNewTheme((current) => !current);
            setError(null);
          }}
        >
          {showNewTheme ? "Cancel" : "Add new"}
        </button>
      </div>

      {showNewTheme ? (
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
            placeholder="New theme name, e.g. Oak"
            aria-label="New theme name"
            autoFocus
          />
          <button type="button" onClick={() => void createTheme()} disabled={creating || !newThemeName.trim()}>
            {creating ? "Creating…" : "Create"}
          </button>
        </div>
      ) : null}

      {selectedThemes.length > 0 ? (
        <ul className={styles.chips} aria-label="Selected themes">
          {selectedThemes.map((theme) => (
            <li className={styles.chip} key={theme.id}>
              <span>{theme.name}</span>
              <button type="button" aria-label={`Remove ${theme.name}`} onClick={() => removeThemeId(theme.id)}>
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.muted}>No themes selected.</p>
      )}

      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  );
}
