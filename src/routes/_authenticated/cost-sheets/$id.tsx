@@
-const STATUSES = ["Draft", "Confirmed", "Budget Review", "Approved", "Done"] as const;
+const STATUSES = ["Draft", "Confirmed", "Budget Validated", "Approved", "Done"] as const;
@@
-function CostSheetDetail() {
+function CostSheetDetail() {
   const { id } = Route.useParams();
   const qc = useQueryClient();
+  const { user, roles } = useSession();
@@
-  async function updateStatus(v: string) {
-    const { error } = await supabase.from("cost_sheets").update({ status: v }).eq("id", id);
-    if (error) return toast.error(error.message);
-    qc.invalidateQueries({ queryKey: ["cost_sheets"] });
-  }
+  async function updateStatus(v: string) {
+    // Enforce workflow transitions
+    const from = sheet.status;
+    const to = v;
+    const uid = user?.id;
+    // Draft -> Confirmed: Creator
+    if (from === "Draft" && to === "Confirmed") {
+      if (sheet.created_by !== uid) return toast.error("Only the creator can confirm");
+    }
+    // Confirmed -> Budget Validated: Accountant
+    if (from === "Confirmed" && to === "Budget Validated") {
+      if (!roles.includes("accountant")) return toast.error("Only accountants can validate budget");
+    }
+    // Budget Validated -> Approved: Project Manager
+    if (from === "Budget Validated" && to === "Approved") {
+      if (!roles.includes("project_manager")) return toast.error("Only project managers can approve");
+    }
+    // Approved -> Done: Admin or Accountant
+    if (from === "Approved" && to === "Done") {
+      if (!roles.includes("admin") && !roles.includes("accountant")) return toast.error("Only admin or accountant can mark done");
+    }
+
+    const { error } = await supabase.from("cost_sheets").update({ status: v }).eq("id", id);
+    if (error) return toast.error(error.message);
+    qc.invalidateQueries({ queryKey: ["cost_sheets"] });
+
+    // If moved to Approved, recalculate and update cost_codes.actual_amount
+    if (to === "Approved" && sheet.cost_code_id) {
+      try {
+        // fetch materials linked to approved cost sheets for this cost code
+        const { data: mats } = await supabase.from("cost_sheet_materials").select("actual_purchased_cost,cost_sheets!inner(cost_code_id,status)").is("deleted_at", null);
+        const { data: labs } = await supabase.from("cost_sheet_labour").select("actual_cost,cost_sheets!inner(cost_code_id,status)").is("deleted_at", null);
+        const { data: ovhs } = await supabase.from("cost_sheet_overhead").select("actual_amount,cost_sheets!inner(cost_code_id,status)").is("deleted_at", null);
+        const matSum = (mats ?? []).filter((r: any) => r.cost_sheets?.cost_code_id === sheet.cost_code_id && r.cost_sheets?.status === "Approved").reduce((a, r: any) => a + Number(r.actual_purchased_cost ?? 0), 0);
+        const labSum = (labs ?? []).filter((r: any) => r.cost_sheets?.cost_code_id === sheet.cost_code_id && r.cost_sheets?.status === "Approved").reduce((a, r: any) => a + Number(r.actual_cost ?? 0), 0);
+        const ovhSum = (ovhs ?? []).filter((r: any) => r.cost_sheets?.cost_code_id === sheet.cost_code_id && r.cost_sheets?.status === "Approved").reduce((a, r: any) => a + Number(r.actual_amount ?? 0), 0);
+        const totalActual = matSum + labSum + ovhSum;
+        await supabase.from("cost_codes").update({ actual_amount: totalActual }).eq("id", sheet.cost_code_id);
+        qc.invalidateQueries({ queryKey: ["cost_codes"] });
+      } catch (e) {
+        // non-fatal
+        console.error(e);
+      }
+    }
+  }
