import { supabase } from "@/integrations/supabase/client";

export async function logActivity(action: string, entity_type: string, entity_id?: string, entity_label?: string, metadata?: Record<string, any>) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return;
  await supabase.from("activity_logs").insert({
    actor_id: u.user.id,
    actor_email: u.user.email ?? null,
    action,
    entity_type,
    entity_id: entity_id ?? null,
    entity_label: entity_label ?? null,
    metadata: metadata ?? null,
  });
}
