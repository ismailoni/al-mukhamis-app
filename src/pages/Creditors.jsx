import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { collection, getDocs, doc, updateDoc, increment, serverTimestamp, addDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { formatCurrency } from "../lib/utils";
import toast from "react-hot-toast";
import { Users, DollarSign } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { LoadingState } from "../components/LoadingState";

export default function Creditors() {
  const queryClient = useQueryClient();
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [showHistory, setShowHistory] = useState(null);

  const { data: customers } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const snap = await getDocs(collection(db, "customers"));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    }
  });

  const { data: payments, isLoading: paymentsLoading } = useQuery({
    queryKey: ["payments"],
    queryFn: async () => {
      const snap = await getDocs(collection(db, "payments"));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    },
  });

  const creditors = customers?.filter((c) => (c.debt || 0) > 0) || [];
  const filteredPayments = payments?.filter((p) => p.customerId === showHistory?.id) || [];


  const payDebtMutation = useMutation({
    mutationFn: async () => {
      const amount = Number(paymentAmount);
      if (!selectedCustomer) throw new Error("Select a customer");
      if (amount <= 0 || amount > selectedCustomer.debt) {
        throw new Error("Invalid payment amount");
      }

      const balanceAfter = Number((selectedCustomer.debt - amount).toFixed(2));

      const customerRef = doc(db, "customers", selectedCustomer.id);

      await updateDoc(customerRef, {
        debt: increment(-amount),
        lastPaymentDate: serverTimestamp()
      });

      await addDoc(collection(db, "payments"), {
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.name,
        amount,
        balanceAfter,
        date: serverTimestamp(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["customers"]);
      setSelectedCustomer(null);
      setPaymentAmount("");
      toast.success("Payment recorded");
    },
    onError: (err) => toast.error(err.message)
  });


  if (!customers) {
    return <LoadingState message="Loading creditors..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Creditors</h1>
          <p className="text-muted-foreground mt-1">Customers with outstanding balances</p>
        </div>
      </div>

      <Card className="border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Outstanding Debts
          </CardTitle>
          <CardDescription>All creditors and their balances</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Total Debt</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {creditors.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                    No creditors with outstanding balances.
                  </TableCell>
                </TableRow>
              )}

              {creditors.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">
                    {customer.name}
                    {customer.email && (
                      <div className="text-sm text-muted-foreground">{customer.email}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-foreground">{customer.phone || "-"}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="destructive" className="text-base px-3 py-1">
                      {formatCurrency(customer.debt)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-2 space-y-2">
                    <Button
                      onClick={() => setSelectedCustomer(customer)}
                      size="sm"
                      className="gap-2"
                    >
                      <DollarSign className="w-4 h-4" /> Log Payment
                    </Button>
                    <Button
                      onClick={() => setShowHistory(customer)}
                      size="sm"
                      variant="outline"
                      className="gap-2"
                    >
                      History
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>


      {/* Payment Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Record Payment</CardTitle>
              <CardDescription>
                Customer: <span className="font-bold text-foreground">{selectedCustomer.name}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="text-sm text-red-900 mb-1">Remaining Debt</div>
                <div className="text-2xl font-bold text-red-600">{formatCurrency(selectedCustomer.debt)}</div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentAmount">Payment Amount (₦)</Label>
                <Input
                  id="paymentAmount"
                  type="number"
                  placeholder="Enter amount"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setSelectedCustomer(null)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => payDebtMutation.mutate()}
                  className="flex-1"
                  disabled={!paymentAmount || payDebtMutation.isPending}
                >
                  {payDebtMutation.isPending ? "Saving..." : "Save Payment"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Payment History Modal */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-xl max-h-[80vh] overflow-hidden">
            <CardHeader className="flex flex-row items-start justify-between gap-2">
              <div>
                <CardTitle>Payment History</CardTitle>
                <CardDescription>{showHistory.name}</CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowHistory(null)}>
                ×
              </Button>
            </CardHeader>
            <CardContent className="space-y-4 overflow-y-auto max-h-[65vh] pr-2">
              {paymentsLoading ? (
                <p className="text-muted-foreground">Loading payments...</p>
              ) : filteredPayments.length === 0 ? (
                <p className="text-muted-foreground">No payments recorded for this customer.</p>
              ) : (
                <div className="space-y-3">
                  {filteredPayments
                    .sort((a, b) => (b.date?.seconds || 0) - (a.date?.seconds || 0))
                    .map((payment) => (
                      <div key={payment.id} className="border rounded-lg p-3 space-y-1">
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>
                            {payment.date?.seconds
                              ? new Date(payment.date.seconds * 1000).toLocaleString()
                              : ""}
                          </span>
                          <span className="font-semibold text-foreground">{formatCurrency(payment.amount)}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">Payment recorded</div>
                        {typeof payment.balanceAfter === "number" && (
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Balance after payment</span>
                            <span className="font-semibold text-foreground">{formatCurrency(payment.balanceAfter)}</span>
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              )}
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setShowHistory(null)}>
                  Close
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}


    </div>
  );
}
