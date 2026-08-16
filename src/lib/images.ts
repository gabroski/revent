import { getEnv } from "@/lib/env";

const BUCKET = "event-media";

export function publicImageUrl(path: string): string {
  const { supabaseUrl } = getEnv();
  return `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${path}`;
}
