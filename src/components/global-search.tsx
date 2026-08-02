import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Search } from "lucide-react";
import { fmtNGN } from "@/lib/roles";

type Hit = { id: string; label: string; sub?: string; to: string; params?: any };

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const nav = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const { data } = useQuery({
    queryKey: ["global_search"],
    enabled: open,
    queryFn: async () => {
      const [projects, sheets, reqs, pos, suppliers] = await Promise.all([
        supabase.from("projects").select("id,name,client,status").is("deleted_at", null).limit(100),
        supabase.from("cost_sheets").select("id,number,title,status").is("deleted_at", null).limit(100),
        supabase.from("requisitions").select("id,number,status,total_amount").is("deleted_at", null).limit(100),
        supabase.from("purchase_orders").select("id,number,status,total_amount").is("deleted_at", null).limit(100),
        supabase.from("suppliers").select("id,name,category").is("deleted_at", null).limit(100),
      ]);
      return {
        projects: projects.data ?? [],
        sheets: sheets.data ?? [],
        reqs: reqs.data ?? [],
        pos: pos.data ?? [],
        suppliers: suppliers.data ?? [],
      };
    },
  });

  const groups = useMemo(() => {
    const d = data;
    return [
      {
        heading: "Projects",
        items: (d?.projects ?? []).map((p: any): Hit => ({ id: p.id, label: p.name, sub: [p.client, p.status].filter(Boolean).join(" · "), to: "/projects/$id", params: { id: p.id } })),
      },
      {
        heading: "Job Cost Sheets",
        items: (d?.sheets ?? []).map((s: any): Hit => ({ id: s.id, label: `${s.number}${s.title ? " · " + s.title : ""}`, sub: s.status, to: "/cost-sheets/$id", params: { id: s.id } })),
      },
      {
        heading: "Requisitions",
        items: (d?.reqs ?? []).map((r: any): Hit => ({ id: r.id, label: r.number, sub: `${r.status} · ${fmtNGN(r.total_amount)}`, to: "/requisitions" })),
      },
      {
        heading: "Purchase Orders",
        items: (d?.pos ?? []).map((p: any): Hit => ({ id: p.id, label: p.number, sub: `${p.status} · ${fmtNGN(p.total_amount)}`, to: "/purchase-orders" })),
      },
      {
        heading: "Suppliers",
        items: (d?.suppliers ?? []).map((s: any): Hit => ({ id: s.id, label: s.name, sub: s.category ?? undefined, to: "/suppliers" })),
      },
    ].filter((g) => g.items.length > 0);
  }, [data]);

  function go(hit: Hit) {
    setOpen(false);
    nav(hit.params ? ({ to: hit.to, params: hit.params } as any) : ({ to: hit.to } as any));
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-2 text-muted-foreground font-normal"
        onClick={() => setOpen(true)}
      >
        <Search className="h-4 w-4" />
        <span className="hidden md:inline">Search…</span>
        <kbd className="hidden lg:inline pointer-events-none rounded border bg-muted px-1.5 text-[10px]">⌘K</kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search projects, cost sheets, requisitions, POs, suppliers…" />
        <CommandList>
          <CommandEmpty>No records found.</CommandEmpty>
          {groups.map((g) => (
            <CommandGroup key={g.heading} heading={g.heading}>
              {g.items.map((hit) => (
                <CommandItem key={g.heading + hit.id} value={`${g.heading} ${hit.label} ${hit.sub ?? ""}`} onSelect={() => go(hit)}>
                  <span className="truncate">{hit.label}</span>
                  {hit.sub && <span className="ml-auto text-xs text-muted-foreground truncate">{hit.sub}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}
