import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  increment,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { formatCurrency, parseMultiplier, toFraction } from "../lib/utils";
import { LoadingState } from "../components/LoadingState";
import logo from "../assets/hero.png";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import toast from "react-hot-toast";
import { Plus, ShoppingCart, Trash2, Receipt, UserPlus } from "lucide-react";
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
import { Badge } from "../components/ui/badge";

export default function Invoicing() {
  const queryClient = useQueryClient();
  const [cart, setCart] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedSaleMode, setSelectedSaleMode] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("cash");
  const [amountPaid, setAmountPaid] = useState(0);
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

  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const s = await getDocs(collection(db, "products"));
      return s.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((p) => !p.deleted && p.stock > 0);
    },
  });

  const normalizedProducts = useMemo(() => {
    if (!products) return [];
    return products.map((p) => ({
      ...p,
      saleModes: p.saleModes?.length
        ? p.saleModes.map((m) => ({ ...m, multiplier: parseMultiplier(m.multiplier) }))
        : [{ name: "Unit", multiplier: 1, price: p.price || 0 }],
    }));
  }, [products]);

  const { data: customers, isLoading: customersLoading } = useQuery({
    queryKey: ["customers-all"],
    queryFn: async () => {
      const s = await getDocs(collection(db, "customers"));
      return s.docs.map((d) => ({ id: d.id, ...d.data() }));
    },
  });

  const selectedCustomer = customers?.find((c) => c.id === selectedCustomerId);

  const addToCart = () => {
    const product = normalizedProducts.find((p) => p.id === selectedProduct);
    if (!product) return;

    const mode = product.saleModes.find((m) => m.name === selectedSaleMode) || product.saleModes[0];
    if (!mode) {
      toast.error("Select a sale mode for this product");
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id && item.saleModeName === mode.name);
      const desiredQty = (existing?.qty || 0) + 1;
      const requiredUnits = desiredQty * mode.multiplier;

      if (requiredUnits > product.stock) {
        toast.error(`Only ${product.stock} units available in stock`);
        return prev;
      }

      if (existing) {
        return prev.map((item) =>
          item.id === product.id && item.saleModeName === mode.name
            ? { ...item, qty: desiredQty }
            : item
        );
      }

      return [
        ...prev,
        {
          ...product,
          qty: 1,
          price: mode.price,
          saleModeName: mode.name,
          multiplier: mode.multiplier,
        },
      ];
    });
    setSelectedProduct("");
    setSelectedSaleMode("");
  };

  const removeFromCart = (productId) => {
    setCart((prev) => prev.filter((item) => item.id !== productId));
  };

  const updatePrice = (productId, modeName, newPrice) => {
    setCart((prev) =>
      prev.map((item) =>
        item.id === productId && item.saleModeName === modeName
          ? { ...item, price: Math.max(Number(newPrice) || 0, 0) }
          : item
      )
    );
  };

  const updateQuantity = (productId, modeName, newQty) => {
    if (newQty < 1) return;

    setCart((prev) => {
      const product = normalizedProducts.find((p) => p.id === productId);
      if (!product) return prev;

      const mode = product.saleModes.find((m) => m.name === modeName) || { multiplier: 1 };
      const otherUsage = prev
        .filter((item) => item.id === productId && item.saleModeName !== modeName)
        .reduce((sum, item) => sum + item.qty * (item.multiplier || 1), 0);
      const neededUnits = newQty * (mode.multiplier || 1) + otherUsage;

      if (neededUnits > product.stock) {
        toast.error(`Only ${product.stock} units available in stock`);
        return prev;
      }

      return prev.map((item) =>
        item.id === productId && item.saleModeName === modeName
          ? { ...item, qty: newQty }
          : item
      );
    });
  };

  const totalAmount = cart.reduce(
    (sum, item) => sum + item.price * item.qty,
    0
  );

  const processSale = useMutation({
    mutationFn: async () => {
      if (cart.length === 0) throw new Error("Cart is empty");

      const isCashSale = selectedCustomerId === "cash";
      const customerId = isCashSale ? null : selectedCustomerId;
      const customerName = isCashSale
        ? "Cash Customer"
        : selectedCustomer?.name;
      const balance = totalAmount - Number(amountPaid);

      if (balance > 0 && isCashSale) {
        throw new Error("Select a saved customer for credit sales.");
      }

      const saleData = {
        invoiceId: `INV-${Date.now()}`,
        customerName,
        customerId,
        items: cart.map((item) => ({
          id: item.id,
          name: item.name,
          qty: item.qty,
          price: item.price,
          saleModeName: item.saleModeName,
          multiplier: item.multiplier || 1,
        })),
        total: totalAmount,
        paid: Number(amountPaid),
        balance,
        date: serverTimestamp(),
      };

      try {
        const saleRef = await addDoc(collection(db, "sales"), saleData);

        for (const item of cart) {
          const productRef = doc(db, "products", item.id);
          const unitsToDeduct = (item.multiplier || 1) * item.qty;
          await updateDoc(productRef, { stock: increment(-unitsToDeduct) });
        }

        if (balance > 0 && customerId) {
          await updateDoc(doc(db, "customers", customerId), {
            debt: increment(balance),
            lastSaleId: saleRef.id,
            updatedAt: serverTimestamp(),
          });
        }

        return saleData;
      } catch (err) {
        console.error("Firestore Error:", err);
        throw new Error("Failed to save to database: " + err.message);
      }
    },
    onSuccess: async (data) => {
      await generatePDF(data);
      setCart([]);
      setAmountPaid(0);
      setSelectedCustomerId("cash");
      setSelectedProduct("");
      queryClient.invalidateQueries(["products"]);
      queryClient.invalidateQueries(["customers-all"]);
      queryClient.invalidateQueries(["sales"]);
      queryClient.invalidateQueries(["customer-history"]);
      toast.success("Sale Complete & Invoice Downloaded");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const isLoadingData = productsLoading || customersLoading;

  if (isLoadingData) {
    return <LoadingState message="Loading invoicing data..." />;
  }

  const generatePDF = async (data) => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

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
    doc.text("Customer", 56, metaBoxY + 16);
    doc.text("Invoice ID", 56, metaBoxY + 34);
    doc.text("Date", 56, metaBoxY + 52);

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(12);
    doc.text(data.customerName, 140, metaBoxY + 16);
    doc.text(data.invoiceId || "", 140, metaBoxY + 34);
    doc.text(new Date().toLocaleDateString(), 140, metaBoxY + 52);

    autoTable(doc, {
      startY: metaBoxY + 80,
      head: [["Item", "Qty", "Price", "Total"]],
      body: data.items.map((item) => [
        item.name,
        item.qty,
        formatCurrency(item.price),
        formatCurrency(item.qty * item.price),
      ]),
      headStyles: { fillColor: [15, 23, 42] },
      styles: { cellPadding: 6 },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      margin: { left: 40, right: 40 },
    });

    // Modern summary section
    const finalY = doc.lastAutoTable.finalY + 30;
    const leftCol = 380;
    const rightCol = pageWidth - 40;

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text("Subtotal:", leftCol, finalY);
    doc.setTextColor(15, 23, 42);
    doc.text(formatCurrency(data.total), rightCol, finalY, { align: "right" });

    doc.setTextColor(100);
    doc.text("Amount Paid:", leftCol, finalY + 18);
    doc.setTextColor(15, 23, 42);
    doc.text(formatCurrency(data.paid), rightCol, finalY + 18, { align: "right" });

    doc.setDrawColor(226, 232, 240);
    doc.line(leftCol, finalY + 28, rightCol, finalY + 28);

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Total Balance Due:", leftCol, finalY + 45);
    const [balR, balG, balB] = data.balance > 0 ? [185, 28, 28] : [21, 128, 61];
    doc.setTextColor(balR, balG, balB);
    doc.text(formatCurrency(data.balance), rightCol, finalY + 45, { align: "right" });

    // Bank account details if balance is due
    if (data.balance > 0) {
      const bankBoxY = finalY + 70;

      doc.setFillColor(240, 247, 255);
      doc.roundedRect(40, bankBoxY, 220, 95, 8, 8, "F");

      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 64, 175);
      doc.text("PAYMENT INFORMATION", 55, bankBoxY + 20);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);

      doc.text("Bank Name:", 55, bankBoxY + 40);
      doc.setFont("helvetica", "bold");
      doc.text("Palmpay", 130, bankBoxY + 40);

      doc.setFont("helvetica", "normal");
      doc.text("Account Name:", 55, bankBoxY + 55);
      doc.setFont("helvetica", "bold");
      doc.text("Oni Sherifat Omobolanle", 130, bankBoxY + 55);

      doc.setFont("helvetica", "normal");
      doc.text("Account Number:", 55, bankBoxY + 70);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(11);
      doc.text("7043278472", 130, bankBoxY + 70);

      doc.setFontSize(8);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(100);
      doc.text("Please use 'Invoice ID' as payment reference.", 55, bankBoxY + 85);
    }

    // Footer
    const footerY = pageHeight - 50;
    doc.setDrawColor(241, 245, 249);
    doc.line(40, footerY - 10, pageWidth - 40, footerY - 10);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text("Thank you for your business!", 40, footerY + 10);
    doc.text("Generated by Al-Mukhamis Ventures POS System", pageWidth - 40, footerY + 10, { align: "right" });

    doc.save(`Invoice_${data.customerName.replace(/\s+/g, "_")}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Invoicing</h1>
        <p className="text-muted-foreground mt-1">
          Create new sales and generate invoices
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Product Selection */}
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              New Sale
            </CardTitle>
            <CardDescription>Select products and add to cart</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Select Product</Label>
              <div className="flex gap-2">
                <select
                  className="flex-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedProduct(val);
                    const product = normalizedProducts.find((p) => p.id === val);
                    setSelectedSaleMode(product?.saleModes?.[0]?.name || "");
                  }}
                  value={selectedProduct}
                >
                  <option value="">Choose a product...</option>
                  {normalizedProducts?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} - {formatCurrency(p.price)}
                    </option>
                  ))}
                </select>
                <select
                  className="flex h-10 w-48 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  value={selectedSaleMode}
                  onChange={(e) => setSelectedSaleMode(e.target.value)}
                  disabled={!selectedProduct}
                >
                  {(normalizedProducts.find((p) => p.id === selectedProduct)?.saleModes || []).map((mode, idx) => (
                    <option key={idx} value={mode.name}>
                      {mode.name} ({toFraction(mode.multiplier)}x) - {formatCurrency(mode.price)}
                    </option>
                  ))}
                </select>
                <Button onClick={addToCart} disabled={!selectedProduct}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer">Customer</Label>
              <div className="flex gap-2">
                <select
                  id="customer"
                  className="flex-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                >
                  <option value="cash">Walk-in (no history)</option>
                  {customers?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => toast("Add new customers from Customers page")}
                >
                  <UserPlus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cart */}
        <Card className="border-2">
          <CardHeader>
            <CardTitle>Shopping Cart</CardTitle>
            <CardDescription>{cart.length} item(s) in cart</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 min-h-[200px]">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <ShoppingCart className="w-12 h-12 mb-2 opacity-20" />
                  <p>Cart is empty</p>
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="font-medium">{item.name}</div>
                      <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-2">
                        <span>
                          {item.saleModeName} ({toFraction(item.multiplier)}x)
                        </span>
                        <span className="text-slate-300">•</span>
                        <label className="text-xs uppercase tracking-wide text-slate-500">Price</label>
                        <Input
                          type="number"
                          value={item.price}
                          onChange={(e) => updatePrice(item.id, item.saleModeName, e.target.value)}
                          className="h-8 w-28"
                          min="0"
                          step="0.01"
                        />
                        <span className="text-slate-300">×</span>
                        <span>{item.qty}</span>
                      </div>
                    </div>
                    <div className="flex self-end items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateQuantity(item.id, item.saleModeName, item.qty - 1)}
                        >
                          -
                        </Button>
                        <span className="w-8 text-center font-medium">
                          {item.qty}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateQuantity(item.id, item.saleModeName, item.qty + 1)}
                        >
                          +
                        </Button>
                      </div>
                      <div className="font-bold min-w-[80px] text-right">
                        {formatCurrency(item.price * item.qty)}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeFromCart(item.id)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Section */}
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            Payment Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between text-2xl font-bold">
            <span>Total Amount:</span>
            <span>{formatCurrency(totalAmount)}</span>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amountPaid">Amount Paid (₦)</Label>
            <Input
              id="amountPaid"
              type="number"
              value={amountPaid}
              onChange={(e) => {
                const val = Number(e.target.value);
                const capped = Number.isFinite(val) ? Math.min(val, totalAmount) : 0;
                setAmountPaid(capped);
              }}
              max={totalAmount || undefined}
              min="0"
              step="0.01"
              placeholder="0.00"
            />
            {Number(amountPaid) > totalAmount && (
              <p className="text-sm text-destructive mt-1">Amount cannot exceed total.</p>
            )}
          </div>

          {totalAmount - Number(amountPaid) > 0 && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="font-medium text-amber-900">
                  Outstanding Balance:
                </span>
                <Badge variant="warning" className="text-lg px-3 py-1">
                  {formatCurrency(totalAmount - Number(amountPaid))}
                </Badge>
              </div>
            </div>
          )}

          <Button
            onClick={() => processSale.mutate()}
            disabled={cart.length === 0 || processSale.isPending}
            className="w-full"
            size="lg"
          >
            {processSale.isPending
              ? "Processing..."
              : "Complete Sale & Print Invoice"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
