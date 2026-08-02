import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCheck } from "lucide-react";
import { useNotifications } from "@/hooks/use-notifications";

export const Route = createFileRoute("/_authenticated/notifications")({
  ssr: false,
  component: NotificationsPage,
});

function NotificationsPage() {
  const { items, unread, markRead, markAllRead } = useNotifications(200);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description={unread ? `${unread} unread` : "You're all caught up"}
        action={
          <Button variant="outline" onClick={() => markAllRead()} disabled={unread === 0}>
            <CheckCheck className="h-4 w-4 mr-2" /> Mark all read
          </Button>
        }
      />
      <Card>
        <CardContent className="divide-y pt-2">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No notifications yet.</p>
          ) : (
            items.map((n) => {
              const inner = (
                <div className="py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {!n.read && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                      <span className="text-sm font-medium truncate">{n.title}</span>
                      {n.kind && <Badge variant="secondary" className="text-[10px]">{n.kind}</Badge>}
                    </div>
                    {n.body && <p className="text-sm text-muted-foreground mt-0.5">{n.body}</p>}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {new Date(n.created_at).toLocaleString("en-NG")}
                  </span>
                </div>
              );
              return (
                <div key={n.id} onClick={() => !n.read && markRead(n.id)} className="cursor-pointer">
                  {n.link ? <Link to={n.link} className="block hover:text-primary">{inner}</Link> : inner}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
