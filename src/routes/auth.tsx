import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  const [fullName, setFullName] = useState("");

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

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    if (!email.toLowerCase().endsWith("@rocdwels.ng")) {
      return toast.error("Only @rocdwels.ng emails are permitted");
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Account created. You can now sign in.");
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
            <Tabs defaultValue="signin">
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Sign up</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={signIn} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="e1">Email</Label>
                    <Input id="e1" type="email" placeholder="you@rocdwels.ng"
                      value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="p1">Password</Label>
                    <Input id="p1" type="password" value={password}
                      onChange={(e) => setPassword(e.target.value)} required />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Signing in…" : "Sign in"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={signUp} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="n2">Full name</Label>
                    <Input id="n2" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="e2">Work email</Label>
                    <Input id="e2" type="email" placeholder="admin@rocdwels.ng"
                      value={email} onChange={(e) => setEmail(e.target.value)} required />
                    <p className="text-xs text-muted-foreground">
                      Use prefixes <code>admin</code>, <code>pm</code>, <code>site</code>,
                      <code> accountant</code>, or <code>procurement</code> to auto-assign your role.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="p2">Password</Label>
                    <Input id="p2" type="password" value={password}
                      onChange={(e) => setPassword(e.target.value)} minLength={6} required />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Creating…" : "Create account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              <Link to="/" className="hover:text-primary">Back to home</Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
