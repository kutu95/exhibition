import Link from "next/link";

import styles from "./page.module.css";

export default function MasterTiffHelpPage() {
  return (
    <article className={styles.article}>
      <p className={styles.eyebrow}>
        <Link href="/admin/import-wizard">← Import Wizard</Link>
      </p>
      <h1>Preparing a master TIFF</h1>
      <p className={styles.lead}>
        Exhibition masters must be TIFF files with an <strong>embedded ICC colour profile</strong>. The fulfilment
        worker refuses files with no profile. Prefer Adobe RGB (1998) for masters destined for Pixel Perfect.
      </p>

      <section className={styles.section}>
        <h2>1. Lightroom → Edit in Photoshop</h2>
        <ol>
          <li>Select the finished photo in Lightroom Classic (or Lightroom).</li>
          <li>
            Choose <strong>Photo → Edit In → Edit in Adobe Photoshop</strong> (or right‑click → Edit in Photoshop).
          </li>
          <li>
            Use Lightroom’s usual <strong>Edit a Copy with Lightroom Adjustments</strong> (or equivalent) so you keep
            your original catalog file untouched.
          </li>
          <li>Photoshop opens with the image. Check the colour space in the status bar (bottom): click the panel menu
            (or the arrow) → <strong>Document Profile</strong>.</li>
        </ol>
        <p className={styles.note}>
          Working masters are often tagged <strong>ProPhoto RGB</strong>. That is fine for editing; convert before you
          save the exhibition TIFF (next step).
        </p>
      </section>

      <section className={styles.section}>
        <h2>2. Convert to Adobe RGB (1998)</h2>
        <p>
          Do <strong>not</strong> use Assign Profile to “switch” from ProPhoto to Adobe RGB — that only relabels the
          numbers and makes the image look darker and duller. Use <strong>Convert to Profile</strong> so appearance is
          preserved.
        </p>
        <ol>
          <li>
            <strong>Edit → Convert to Profile…</strong>
          </li>
          <li>
            Destination Space: <strong>Adobe RGB (1998)</strong>
          </li>
          <li>Engine: Adobe (ACE)</li>
          <li>
            Intent: <strong>Relative Colorimetric</strong>, with <strong>Black Point Compensation</strong> on
            (or <strong>Perceptual</strong> if you prefer softer handling of very vivid colours)
          </li>
          <li>Confirm. The document profile should now read Adobe RGB (1998).</li>
        </ol>
        <p className={styles.note}>
          A slight loss of extreme saturation can still happen because Adobe RGB is smaller than ProPhoto. A large
          overall darkening means you assigned instead of converted — undo and convert again.
        </p>
      </section>

      <section className={styles.section}>
        <h2>3. Save As TIFF (with profile embedded)</h2>
        <ol>
          <li>
            <strong>File → Save As…</strong> (prefer this over Export / Save for Web, which often strip profiles).
          </li>
          <li>
            Format: <strong>TIFF</strong>
          </li>
          <li>
            Enable <strong>Embed Color Profile</strong> (or <strong>ICC Profile</strong> — wording varies by Photoshop
            version). Leave this on.
          </li>
          <li>
            Save into the master share folder used by this app:
            <ul>
              <li>
                Mac: <code>/Volumes/AppData/Exhibition/Masters</code>
              </li>
              <li>
                Server: <code>/mnt/nas/AppData/Exhibition/Masters</code> (also shown on Import Wizard
                step 2 as <code>MASTER_FILES_DIR</code>)
              </li>
            </ul>
          </li>
          <li>
            Use a clear filename ending in <code>.tif</code> or <code>.tiff</code> (filename only — no folders in the
            product record). Example: <code>redgate-drift-01.tif</code>
          </li>
          <li>
            In the <strong>TIFF Options</strong> dialog that appears next:
            <ul>
              <li>
                <strong>Image Compression:</strong> <strong>ZIP</strong> or <strong>None</strong> (both are fine;
                avoid JPEG compression for masters)
              </li>
              <li>
                <strong>Pixel Order:</strong> <strong>Interleaved (RGBRGB)</strong>
              </li>
              <li>
                <strong>Byte Order:</strong> <strong>IBM PC</strong> (best cross‑platform default for the Linux
                fulfilment host; Macintosh also works with modern tools)
              </li>
              <li>
                <strong>Save Image Pyramid:</strong> off
              </li>
              <li>
                <strong>Use BigTIFF format:</strong> off (unless the file is over ~4GB)
              </li>
              <li>
                If layer options are available: save a <strong>flattened</strong> copy (discard layers) — the master
                for print should be a single flat image
              </li>
            </ul>
          </li>
        </ol>
        <p className={styles.note}>
          Embed Color Profile is on the previous Save As screen, not in TIFF Options. Confirm it is checked before you
          reach this dialog.
        </p>
      </section>

      <section className={styles.section}>
        <h2>4. Quick checks</h2>
        <ul>
          <li>
            Re-open the TIFF in Photoshop → Document Profile should show a named profile (e.g. Adobe RGB (1998)), not{" "}
            <strong>Untagged RGB</strong>.
          </li>
          <li>
            In the Import Wizard, refresh the master list — the new file should appear as unregistered, then continue.
          </li>
        </ul>
      </section>

      <p className={styles.footerLinks}>
        <Link href="/admin/import-wizard">Continue in Import Wizard</Link>
      </p>
    </article>
  );
}
