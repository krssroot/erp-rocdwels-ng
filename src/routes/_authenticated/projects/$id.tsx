import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/shared";
import { ProjectDialog } from "./index";
import { fmtNGN } from "@/lib/roles";
import { ArrowLeft, Pencil } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/projects/$id")({
  ssr: false,
  component: ProjectDetail,
});

function ProjectDetail() {
  const { id } = Route.useParams();
  const [editOpen, setEditOpen] = useState(false);

  const { data: project } = useQuery({
    queryKey: ["projects", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: codes } = useQuery({
    queryKey: ["cost_codes", id],
    queryFn: async () => {
      const { data } = await supabase.from("cost_codes").select("*").eq("project_id", id).is("deleted_at", null);
      return data ?? [];
    },
  });

  const { data: sheets } = useQuery({
    queryKey: ["cost_sheets", id],
    queryFn: async () => {
      const { data } = await supabase.from("cost_sheets").select("*").eq("project_id", id).is("deleted_at", null);
      return data ?? [];
    },
  });

  const { data: reqs } = useQuery({
    queryKey: ["requisitions", id],
    queryFn: async () => {
      const { data } = await supabase.from("requisitions").select("*").eq("project_id", id).is("deleted_at", null);
      return data ?? [];
    },
  });

  if (!project) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div>
      <Link to="/projects" className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:text-primary mb-2">
        <ArrowLeft className="h-3 w-3" /> Back to projects
      </Link>
      <PageHeader
        title={project.name}
        description={`${project.client ?? "No client"} · ${project.location ?? "No location"}`}
        action={
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogTrigger asChild><Button variant="outline"><Pencil className="h-4 w-4 mr-2" /> Edit</Button></DialogTrigger>
            <ProjectDialog onClose={() => setEditOpen(false)} initial={project} />
          </Dialog>
        }
      />

      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Contract value</p><p className="text-lg font-bold">{fmtNGN(project.contract_value)}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Status</p><Badge>{project.status}</Badge></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Progress</p><div className="flex items-center gap-2"><Progress value={Number(project.percent_complete ?? 0)} /> <span className="text-sm">{Number(project.percent_complete ?? 0).toFixed(0)}%</span></div></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Timeline</p><p className="text-sm">{project.start_date ?? "—"} → {project.end_date ?? "—"}</p></CardContent></Card>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="cost-sheets">Cost Sheets</TabsTrigger>
          <TabsTrigger value="requisitions">Requisitions</TabsTrigger>
          <TabsTrigger value="budget">Budget</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="activity">Activity Log</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <Card><CardHeader><CardTitle>Description</CardTitle></CardHeader><CardContent className="text-sm whitespace-pre-wrap">{project.description || "No description."}</CardContent></Card>
        </TabsContent>
        <TabsContent value="cost-sheets">
          <SimpleList items={sheets ?? []} render={(s) => `${s.number} — ${s.title ?? "Untitled"} · ${s.status}`} emptyLink="/cost-sheets" emptyLabel="Go to Cost Sheets" />
        </TabsContent>
        <TabsContent value="requisitions">
          <SimpleList items={reqs ?? []} render={(r) => `${r.number} — ${r.type} · ${r.status} · ${fmtNGN(r.total_amount)}`} emptyLink="/requisitions" emptyLabel="Go to Requisitions" />
        </TabsContent>
        <TabsContent value="budget">
          <SimpleList items={codes ?? []} render={(c) => `${c.code} · ${c.category} — ${fmtNGN(c.budgeted_amount)}`} emptyLink="/cost-codes" emptyLabel="Go to Cost Codes" />
        </TabsContent>
        <TabsContent value="documents"><p className="text-sm text-muted-foreground p-4">Documents module opens on the main sidebar.</p></TabsContent>
        <TabsContent value="team"><p className="text-sm text-muted-foreground p-4">Assign staff from the Staff module.</p></TabsContent>
        <TabsContent value="activity"><p className="text-sm text-muted-foreground p-4">Activity log will accumulate as records are created and updated.</p></TabsContent>
      </Tabs>
    </div>
  );
}

function SimpleList({ items, render, emptyLink, emptyLabel }: { items: any[]; render: (i: any) => string; emptyLink: string; emptyLabel: string }) {
  if (items.length === 0) return (
    <div className="border rounded-lg p-6 text-center">
      <p className="text-sm text-muted-foreground mb-3">Nothing yet.</p>
      <Button asChild variant="outline"><Link to={emptyLink}>{emptyLabel}</Link></Button>
    </div>
  );
  return (
    <div className="border rounded-lg bg-card divide-y">
      {items.map((i) => <div key={i.id} className="p-3 text-sm">{render(i)}</div>)}
    </div>
  );
}
