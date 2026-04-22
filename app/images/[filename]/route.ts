import { buildMediaResponse } from "../../../lib/media-response";

type RouteContext = {
  params: Promise<{ filename: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { filename } = await context.params;
  return buildMediaResponse("images", filename);
}
