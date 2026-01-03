import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { collection, getDocs, serverTimestamp, addDoc, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { formatCurrency } from "../lib/utils";
import { LoadingState } from "../components/LoadingState";
import toast from "react-hot-toast";
import { Users, History, Plus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Badge } from "../components/ui/badge";

export default function Customers() {
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [historyCustomer, setHistoryCustomer] = useState(null);

  const { data: customers, isLoading: customersLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const snap = await getDocs(collection(db, "customers"));
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
  });

  const { data: history, isLoading: historyLoading, error: historyError } = useQuery({
  queryKey: ["customer-history", historyCustomer?.id],
  enabled: !!historyCustomer,
  queryFn: async () => {
    // If you don't want to create an index yet, remove the orderBy line
    // and sort the results manually below.
    const q = query(
      collection(db, "sales"),
      where("customerId", "==", historyCustomer.id)
      // orderBy("date", "desc") // <--- Remove this if you haven't made the index yet
    );
    
    const snap = await getDocs(q);
    const results = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    
    // Sort manually in JS to avoid index requirement
    return results.sort((a, b) => b.date?.seconds - a.date?.seconds);
  }
});

  const addCustomerMutation = useMutation({
    mutationFn: async (data) => {
      await addDoc(collection(db, "customers"), {
        ...data,
        debt: 0,
        createdAt: serverTimestamp(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["customers"]);
      setIsAddOpen(false);
      toast.success("Customer added");
    }
  });

  if (customersLoading) {
    return <LoadingState message="Loading customers..." />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Customers</h1>
        <p className="text-muted-foreground mt-1">Manage your customer directory and purchase history</p>
        <div className="mt-3">
          <Button onClick={() => setIsAddOpen(true)} className="gap-2" size="sm">
            <Plus className="w-4 h-4" /> Add Customer
          </Button>
        </div>
      </div>
      
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Outstanding Debts
          </CardTitle>
          <CardDescription>All customers and their balances</CardDescription>
        </CardHeader>
        <CardContent>
          {historyError && (
            <p className="text-red-500 text-sm mb-3">Error loading history. Check Firestore indexes.</p>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-12 text-muted-foreground">
                    No customers added yet. Start by adding your first customer.
                  </TableCell>
                </TableRow>
              )}

              {customers?.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">
                    {customer.name}
                    {customer.email && (
                      <div className="text-sm text-muted-foreground">{customer.email}</div>
                    )}
                  </TableCell>

                  <TableCell>
                    <div className="text-sm text-foreground">{customer.phone || "-"}</div>
                    {customer.debt ? (
                      <Badge variant="secondary" className="mt-1">Has Credit Balance</Badge>
                    ) : null}
                  </TableCell>

                  <TableCell className="text-right space-x-2">
                    <Button
                      onClick={() => setHistoryCustomer(customer)}
                      variant="outline"
                      size="sm"
                      className="gap-2"
                    >
                      <History className="w-4 h-4" /> History
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Customer Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Add Customer</CardTitle>
              <CardDescription>Create a customer to track purchases and balances</CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = new FormData(e.target);
                  const payload = Object.fromEntries(form);
                  addCustomerMutation.mutate(payload);
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" name="name" required placeholder="Customer name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" name="phone" placeholder="080..." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" placeholder="customer@email.com" />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={addCustomerMutation.isPending}>
                    {addCustomerMutation.isPending ? "Saving..." : "Save"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* History Modal */}
      {historyCustomer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <CardHeader>
              <CardTitle>Purchase History</CardTitle>
              <CardDescription>{historyCustomer.name}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 overflow-y-auto">
              {historyLoading ? (
                <p className="text-muted-foreground">Loading history...</p>
              ) : history?.length === 0 ? (
                <p className="text-muted-foreground">No purchases found for this customer.</p>
              ) : (
                history?.map((sale) => (
                  <div key={sale.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>{sale.date?.seconds ? new Date(sale.date.seconds * 1000).toLocaleDateString() : ""}</span>
                      <span className="font-semibold text-foreground">{formatCurrency(sale.total)}</span>
                    </div>
                    <div className="space-y-1">
                      {sale.items?.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span>{item.name} × {item.qty}</span>
                          <span>{formatCurrency(item.price * item.qty)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setHistoryCustomer(null)}>Close</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}