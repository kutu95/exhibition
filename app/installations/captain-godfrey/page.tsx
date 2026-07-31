import type { Metadata } from "next";

import { InstallationDetail } from "../../../components/InstallationDetail";
import { JsonLd } from "../../../components/JsonLd";
import { installationPages } from "../../../lib/installation-pages";
import { awaitPageMetadata, buildPageMetadata } from "../../../lib/seo-content";
import { buildBreadcrumb } from "../../../lib/structured-data";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { getInstallationBody } from "../../../lib/utils/installation-content";
import {
  resolveContentImage,
  type SiteContentImageRow,
} from "../../../lib/utils/site-content-image";

const content = installationPages["captain-godfrey"];

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata("captain-godfrey");
}

export default async function CaptainGodfreyPage() {
  const [, contentResult] = await Promise.all([
    awaitPageMetadata("captain-godfrey"),
    (async () => {
      const supabase = await createSupabaseServerClient();
      return supabase
        .from("site_content")
        .select("content_key, content_value, media_files(alt_text, url_path)")
        .in("content_key", [content.bodyKey, content.imageKey]);
    })(),
  ]);
  const { data, error } = contentResult;

  if (error) {
    throw new Error(`Failed to load Captain Godfrey content: ${error.message}`);
  }

  const rowByKey = new Map((data ?? []).map((row) => [row.content_key, row]));
  const bodyRow = rowByKey.get(content.bodyKey) as { content_value: string | null } | undefined;
  const body = getInstallationBody(bodyRow?.content_value, content.bodyFallbackKey);
  const image = resolveContentImage(
    rowByKey.get(content.imageKey) as SiteContentImageRow | undefined,
    content.imageKey,
  );

  return (
    <>
      <JsonLd
        data={buildBreadcrumb([
          { name: "Home", path: "/" },
          { name: "Installations", path: "/installations" },
          { name: content.title, path: content.path },
        ])}
      />
      <InstallationDetail
        content={content}
        image={image}
        visitorParagraphs={body.paragraphs}
        noteParagraphIndex={body.noteParagraphIndex}
      />
    </>
  );
}
