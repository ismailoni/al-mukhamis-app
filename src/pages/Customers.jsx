import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  collection,
  getDocs,
  serverTimestamp,
  addDoc,
  query,
  where,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { formatCurrency } from "../lib/utils";
import { LoadingState } from "../components/LoadingState";
import toast from "react-hot-toast";
import { Users, History, Plus, X, Phone, ShoppingBag } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import autoTable from "jspdf-autotable";
import jsPDF from "jspdf";
import logo from "../assets/logo.png";

export default function Customers() {
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [historyCustomer, setHistoryCustomer] = useState(null);
  const [activeHistoryTab, setActiveHistoryTab] = useState("purchases");
    const [logoDataUrl, setLogoDataUrl] = useState(null);
  
    useEffect(() => {
      const loadLogo = async () => {
        try {
          const res = await fetch(logo);
          const blob = await res.blob();
          const reader = new FileReader();
          reader.onloadend = () => setLogoDataUrl(reader.result?.toString() || null);
          reader.readAsDataURL(blob);
        } catch (err) {
          console.error("Failed to load logo for PDF", err);
        }
      };
      loadLogo();
    }, []);

  const { data: customers, isLoading: customersLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const snap = await getDocs(collection(db, "customers"));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    },
  });

  const {
    data: history,
    isLoading: historyLoading,
    error: historyError,
  } = useQuery({
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
    },
  });

  const { data: paymentHistory, isLoading: paymentsLoading } = useQuery({
    queryKey: ["customer-payments", historyCustomer?.id],
    enabled: !!historyCustomer,
    queryFn: async () => {
      const q = query(
        collection(db, "payments"),
        where("customerId", "==", historyCustomer.id)
      );
      const snap = await getDocs(q);
      return snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.date?.seconds || 0) - (a.date?.seconds || 0));
    },
  });

  const totalSpent =
    history?.reduce((sum, sale) => sum + (sale.total || 0), 0) || 0;
  const totalItemsBought =
    history?.reduce(
      (sum, sale) =>
        sum + (sale.items?.reduce((s, item) => s + (item.qty || 0), 0) || 0),
      0
    ) || 0;
  const debtBalance = historyCustomer?.debt || 0;

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
    },
  });

  const generateHistoryPDF = async (customer, purchases, payments, stats) => {
    if (!customer) return;

    const safePurchases = Array.isArray(purchases) ? purchases : [];
    const safePayments = Array.isArray(payments) ? payments : [];

    const formatMsDate = (ms) => (ms ? new Date(ms).toLocaleDateString() : "-");

    const doc = new jsPDF({ unit: "pt", format: "a4" });
        const pageWidth = doc.internal.pageSize.getWidth();
    
        if (logoDataUrl) {
          doc.addImage(logoDataUrl, "PNG", 40, 32, 64, 64);
        }
    
        doc.setFontSize(18);
        doc.setTextColor(26, 47, 88);
        doc.text("Al-Mukhamis Ventures", 120, 50);
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text("Premium Wholesale Trading", 120, 64);
        doc.text("Soaps & Provisions | Lagos, Nigeria", 120, 78);
    
        doc.setDrawColor(28, 100, 242);
        doc.setLineWidth(1.2);
        doc.line(40, 110, pageWidth - 40, 110);
    
        const metaBoxY = 126;
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(234, 236, 240);
        doc.roundedRect(40, metaBoxY, pageWidth - 80, 60, 8, 8, "FD");
    
        doc.setTextColor(71, 85, 105);
        doc.setFontSize(10);
    // 1. Header & Branding
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(15, 23, 42);
    doc.text("Account Statement", 40, 50);


    // 2. Customer Profile Box
    doc.setTextColor(71, 85, 105);
    doc.setFontSize(10);
    doc.text("CUSTOMER", 56, metaBoxY + 16);
    doc.text("Invoice ID", 56, metaBoxY + 34);
    doc.text("Date", 56, metaBoxY + 52);

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(12);
    doc.text(customer.name, 140, metaBoxY + 16);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text("CUSTOMER:", 55, 105);
    doc.setFont("helvetica", "normal");
    doc.text(customer.name, 130, 105);

    doc.setFont("helvetica", "bold");
    doc.text("STATEMENT DATE:", 55, 120);
    doc.setFont("helvetica", "normal");
    doc.text(new Date().toLocaleDateString("en-GB"), 130, 120);

    doc.setFont("helvetica", "bold");
    doc.text("CURRENT BALANCE:", 55, 135);
    const debtBalanceValue = Number(stats?.debtBalance ?? 0);
    if (debtBalanceValue > 0) {
      doc.setTextColor(185, 28, 28);
    } else {
      doc.setTextColor(21, 128, 61);
    }
    doc.text(formatCurrency(debtBalanceValue), 130, 135);

    // 3. Prepare Chronological Ledger
    // Combine purchases and payments into one list, sorted by date
    const ledger = [
      ...safePurchases.map((p) => ({
        date: p?.date?.seconds ? p.date.seconds * 1000 : null,
        type: "PURCHASE",
        ref: p?.id ? `${p.invoiceId}` : "Purchase",
        amount: Number(p?.total || 0),
        isCredit: false,
      })),
      ...safePayments.map((py) => ({
        date: py?.date?.seconds ? py.date.seconds * 1000 : null,
        type: "PAYMENT",
        ref: "Debt Repayment",
        amount: Number(py?.amount || 0),
        isCredit: true,
      })),
    ].sort((a, b) => (b.date || 0) - (a.date || 0)); // Most recent first

    // 4. Ledger Table
    autoTable(doc, {
      startY: 170,
      head: [["Date", "Reference", "Type", "Debit", "Credit"]],
      body: ledger.map((entry) => [
        formatMsDate(entry.date),
        entry.ref,
        entry.type,
        entry.isCredit ? "-" : formatCurrency(entry.amount || 0),
        entry.isCredit ? formatCurrency(entry.amount || 0) : "-",
      ]),
      headStyles: { fillColor: [15, 23, 42], fontSize: 10 },
      columnStyles: {
        3: { halign: "right" },
        4: { halign: "right", textColor: [21, 128, 61] },
      },
      styles: { fontSize: 9, cellPadding: 8 },
      alternateRowStyles: { fillColor: [250, 250, 250] },
    });

    // 5. Summary Stats at bottom
    const finalY = doc.lastAutoTable.finalY + 30;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100);
    doc.setFontSize(10);
    doc.text("Total Spent:", 380, finalY);
    doc.setTextColor(15, 23, 42);
    doc.text(formatCurrency(stats.totalSpent), pageWidth - 40, finalY, {
      align: "right",
    });

    doc.setTextColor(100);
    doc.text("Total Paid:", 380, finalY + 18);
    doc.setTextColor(21, 128, 61);
    doc.text(
      formatCurrency(stats.totalSpent - stats.debtBalance),
      pageWidth - 40,
      finalY + 18,
      { align: "right" }
    );

    // 6. Footer
    doc.setFontSize(8);
    doc.setTextColor(160);
    doc.text(
      "This is a computer-generated statement of account.",
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 30,
      { align: "center" }
    );

    doc.save(`Statement_${customer.name.replace(/\s+/g, "_")}.pdf`);
  };
  if (customersLoading) {
    return <LoadingState message="Loading customers..." />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Customers</h1>
        <p className="text-muted-foreground mt-1">
          Manage your customer directory and purchase history
        </p>
        <div className="mt-3">
          <Button
            onClick={() => setIsAddOpen(true)}
            className="gap-2"
            size="sm"
          >
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
            <p className="text-red-500 text-sm mb-3">
              Error loading history. Check Firestore indexes.
            </p>
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
                  <TableCell
                    colSpan={3}
                    className="text-center py-12 text-muted-foreground"
                  >
                    No customers added yet. Start by adding your first customer.
                  </TableCell>
                </TableRow>
              )}

              {customers?.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">
                    {customer.name}
                    {customer.email && (
                      <div className="text-sm text-muted-foreground">
                        {customer.email}
                      </div>
                    )}
                  </TableCell>

                  <TableCell>
                    <div className="text-sm text-foreground">
                      {customer.phone || "-"}
                    </div>
                    {customer.debt ? (
                      <Badge variant="secondary" className="mt-1">
                        Has Credit Balance
                      </Badge>
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
              <CardDescription>
                Create a customer to track purchases and balances
              </CardDescription>
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
                  <Input
                    id="name"
                    name="name"
                    required
                    placeholder="Customer name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" name="phone" placeholder="080..." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="customer@email.com"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsAddOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={addCustomerMutation.isPending}
                  >
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <Card className="w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl border-none overflow-hidden">
            {/* Modal Header */}
            <CardHeader className="flex flex-row items-center justify-between border-b bg-white p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xl">
                  {historyCustomer.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <CardTitle className="text-xl font-bold text-slate-900">
                    Purchase History
                  </CardTitle>
                  <CardDescription className="text-sm font-medium text-slate-500">
                    {historyCustomer.name}
                  </CardDescription>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full hover:bg-slate-100"
                onClick={() => setHistoryCustomer(null)}
              >
                <X className="w-5 h-5" />
              </Button>
            </CardHeader>

            {/* Summary Stats Bar - Sticky */}
            <div className="bg-slate-50 border-b p-4 px-6 grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                  Total Spent
                </p>
                <p className="text-lg font-bold text-slate-900">
                  {formatCurrency(totalSpent)}
                </p>
              </div>
              <div className="space-y-1 border-x px-4 border-slate-200">
                <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                  Items Bought
                </p>
                <p className="text-lg font-bold text-slate-900">
                  {totalItemsBought}
                </p>
              </div>
              <div className="space-y-1 pl-2">
                <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                  Current Debt
                </p>
                <p
                  className={`text-lg font-bold ${
                    debtBalance > 0 ? "text-rose-600" : "text-emerald-600"
                  }`}
                >
                  {formatCurrency(debtBalance)}
                </p>
              </div>
            </div>

            <CardContent className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-slate-200">
              {/* Tab Navigation */}
              <div className="inline-flex p-1 bg-slate-100 rounded-xl w-full">
                <button
                  onClick={() => setActiveHistoryTab("purchases")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-lg transition-all ${
                    activeHistoryTab === "purchases"
                      ? "bg-white shadow-sm text-blue-600"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <ShoppingBag className="w-4 h-4" /> Purchases
                </button>
                <button
                  onClick={() => setActiveHistoryTab("payments")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-lg transition-all ${
                    activeHistoryTab === "payments"
                      ? "bg-white shadow-sm text-emerald-600"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <Phone className="w-4 h-4" /> Debt Payments
                </button>
              </div>

              {/* Content Area */}
              <div className="space-y-4">
                {activeHistoryTab === "purchases" ? (
                  historyLoading ? (
                    <div className="text-center py-10 text-slate-400">
                      Loading purchases...
                    </div>
                  ) : history?.length === 0 ? (
                    <div className="text-center py-10 space-y-2">
                      <ShoppingBag className="w-8 h-8 mx-auto text-slate-200" />
                      <p className="text-slate-400">
                        No purchase history available.
                      </p>
                    </div>
                  ) : (
                    history?.map((sale) => (
                      <div
                        key={sale.id}
                        className="group border rounded-xl overflow-hidden hover:border-blue-200 transition-colors"
                      >
                        <div className="bg-slate-50 px-4 py-2 border-b flex justify-between items-center">
                          <span className="text-xs font-bold text-slate-500">
                            {sale.date?.seconds
                              ? new Date(
                                  sale.date.seconds * 1000
                                ).toLocaleDateString()
                              : ""}
                          </span>
                          <span className="text-sm font-bold text-blue-600">
                            {formatCurrency(sale.total)}
                          </span>
                        </div>
                        <div className="p-4 space-y-2 bg-white">
                          {sale.items?.map((item, idx) => (
                            <div
                              key={idx}
                              className="flex justify-between text-sm group-hover:bg-slate-50/50 rounded px-1"
                            >
                              <span className="text-slate-600">
                                {item.name}{" "}
                                <span className="text-slate-400 mx-1">×</span>{" "}
                                {item.qty}
                              </span>
                              <span className="font-medium text-slate-900">
                                {formatCurrency(item.price * item.qty)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )
                ) : paymentsLoading ? (
                  <div className="text-center py-10 text-slate-400">
                    Loading payments...
                  </div>
                ) : paymentHistory?.length === 0 ? (
                  <div className="text-center py-10 space-y-2">
                    <Phone className="w-8 h-8 mx-auto text-slate-200" />
                    <p className="text-slate-400">No debt payments found.</p>
                  </div>
                ) : (
                  paymentHistory?.map((payment) => (
                    <div
                      key={payment.id}
                      className="border rounded-xl p-4 bg-emerald-50/30 border-emerald-100 flex items-center justify-between"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span className="text-sm font-bold text-slate-900">
                            {formatCurrency(payment.amount)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">
                          {payment.date?.seconds
                            ? new Date(
                                payment.date.seconds * 1000
                              ).toLocaleString()
                            : ""}
                        </p>
                      </div>
                      {typeof payment.balanceAfter === "number" && (
                        <div className="text-right">
                          <p className="text-[10px] uppercase font-bold text-slate-400">
                            New Balance
                          </p>
                          <p className="text-sm font-bold text-slate-700">
                            {formatCurrency(payment.balanceAfter)}
                          </p>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>

            <div className="p-6 border-t bg-white flex justify-end gap-3">
              <Button
                variant="outline"
                className="rounded-xl px-8"
                onClick={() => setHistoryCustomer(null)}
              >
                Close
              </Button>
              <Button
                className="rounded-xl px-8 bg-blue-600 hover:bg-blue-700"
                onClick={() =>
                  generateHistoryPDF(historyCustomer, history, paymentHistory, {
                    totalSpent,
                    totalItemsBought,
                    debtBalance,
                  })
                }
                disabled={historyLoading || paymentsLoading}
              >
                Export Statement
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
