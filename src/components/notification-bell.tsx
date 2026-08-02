import { Link } from "@tanstack/react-router";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotifications } from "@/hooks/use-notifications";

export function NotificationBell() {
  const { items, unread, markRead, markAllRead } = useNotifications(25);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold grid place-items-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="text-sm font-medium">Notifications</span>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => markAllRead()} disabled={unread === 0}>
            <CheckCheck className="h-3.5 w-3.5 mr-1" /> Mark all read
          </Button>
        </div>
        <ScrollArea className="max-h-80">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4">You're all caught up.</p>
          ) : (
            <ul className="divide-y">
              {items.map((n) => {
                const body = (
                  <div className={`px-3 py-2 hover:bg-muted ${n.read ? "" : "bg-primary/5"}`}>
                    <div className="flex items-start gap-2">
                      {!n.read && <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{n.title}</p>
                        {n.body && <p className="text-xs text-muted-foreground line-clamp-2">{n.body}</p>}
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {new Date(n.created_at).toLocaleString("en-NG")}
                        </p>
                      </div>
                    </div>
                  </div>
                );
                return (
                  <li key={n.id} onClick={() => !n.read && markRead(n.id)}>
                    {n.link ? (
                      <Link to={n.link} className="block">{body}</Link>
                    ) : (
                      body
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
        <div className="border-t p-2">
          <Link to="/notifications" className="text-xs text-primary hover:underline px-1">
            View all notifications
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
