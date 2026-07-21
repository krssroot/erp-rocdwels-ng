import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Building2 } from "lucide-react";

const searchSchema = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: searchSchema,
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const search = useSearch({ from: "/auth" });
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) nav({ to: search.redirect ?? "/dashboard" });
    });
  }, [nav, search.redirect]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back");
    nav({ to: search.redirect ?? "/dashboard" });
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-sidebar text-sidebar-foreground p-12">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-sidebar-primary text-sidebar-primary-foreground grid place-items-center font-bold">
            R
          </div>
          <div className="text-xl font-semibold tracking-tight">Rocdwels</div>
        </div>
        <div className="space-y-4">
          <h1 className="text-4xl font-bold leading-tight">
            Construction ERP for<br />Rocdwels Nigeria Ltd
          </h1>
          <p className="text-sidebar-foreground/80 max-w-md">
            Manage projects, cost sheets, requisitions and procurement — end to end,
            in real time.
          </p>
        </div>
        <div className="text-sm text-sidebar-foreground/60">
          © {new Date().getFullYear()} Rocdwels Nigeria Ltd
        </div>
      </div>

      <div className="flex items-center justify-center p-6 lg:p-12">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-2">
            <div className="lg:hidden mx-auto h-12 w-12 rounded-lg bg-primary text-primary-foreground grid place-items-center">
              <Building2 className="h-6 w-6" />
            </div>
            <CardTitle className="text-2xl">Rocdwels Nigeria Ltd</CardTitle>
            <CardDescription>Sign in to your account</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={signIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="you@rocdwels.ng"
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input 
                  id="password" 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)} 
                  required 
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in…" : "Sign in"}
              </Button>
            </form>

            <div className="mt-6 text-center text-xs text-muted-foreground">
              Users are created by Admin only through Lovable Cloud Users panel.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
