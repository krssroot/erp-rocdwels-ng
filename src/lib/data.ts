import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/activity";
import { toast } from "sonner";

function labelOf(row: any) {
  return row?.number ?? row?.name ?? row?.title ?? row?.code ?? row?.id ?? undefined;
}

export function useList<T = any>(table: string, opts?: { select?: string; order?: string }) {
  return useQuery({
    queryKey: [table, "list"],
    queryFn: async () => {
      let q = supabase.from(table as any).select(opts?.select ?? "*").is("deleted_at", null);
      if (opts?.order) q = q.order(opts.order, { ascending: false });
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as T[];
    },
  });
}

export function useUpsert(table: string, invalidate: string[] = []) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: any) => {
      const isUpdate = !!row?.id;
      const { data, error } = await supabase.from(table as any).upsert(row).select().single();
      if (error) throw error;
      await logActivity(isUpdate ? "updated" : "created", table, (data as any)?.id, labelOf(data));
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table] });
      qc.invalidateQueries({ queryKey: ["dash_activity"] });
      invalidate.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      toast.success("Saved");
    },
    onError: (e: any) => toast.error(e.message ?? "Save failed"),
  });
}

export function useSoftDelete(table: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase.from(table as any)
        .update({ deleted_at: new Date().toISOString(), deleted_by: u.user?.id })
        .eq("id", id)
        .select()
        .maybeSingle();
      if (error) throw error;
      await logActivity("deleted", table, id, labelOf(data));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table] });
      qc.invalidateQueries({ queryKey: ["dash_activity"] });
      toast.success("Moved to Recently Deleted");
    },
    onError: (e: any) => toast.error(e.message ?? "Delete failed"),
  });
}
