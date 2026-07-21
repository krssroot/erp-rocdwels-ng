import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
      const { data, error } = await supabase.from(table as any).upsert(row).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table] });
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
      const { error } = await supabase.from(table as any)
        .update({ deleted_at: new Date().toISOString(), deleted_by: u.user?.id })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table] });
      toast.success("Moved to Recently Deleted");
    },
    onError: (e: any) => toast.error(e.message ?? "Delete failed"),
  });
}
