import { useState, useMemo } from "react";
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
    onSuccess: (data) => {
      generatePDF(data);
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

  const generatePDF = (data) => {
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("Al-Mukhamis Ventures", 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text("Soaps & Provisions | Lagos, Nigeria", 14, 26);

    doc.line(14, 30, 196, 30);

    doc.setTextColor(0);
    doc.text(`Customer: ${data.customerName}`, 14, 40);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 46);

    autoTable(doc, {
      startY: 55,
      head: [["Item", "Qty", "Price", "Total"]],
      body: data.items.map((item) => [
        item.name,
        item.qty,
        formatCurrency(item.price),
        formatCurrency(item.qty * item.price),
      ]),
      headStyles: { fillColor: [15, 23, 42] },
    });

    const finalY = doc.lastAutoTable.finalY + 10;

    doc.setFontSize(12);
    doc.text(`Total Amount: ${formatCurrency(data.total)}`, 140, finalY);
    doc.text(`Amount Paid: ${formatCurrency(data.paid)}`, 140, finalY + 7);

    doc.setFontSize(14);
    doc.setTextColor(220, 38, 38);
    doc.text(`Balance: ${formatCurrency(data.balance)}`, 140, finalY + 16);

    doc.save(`Invoice_${data.customerName}_${Date.now()}.pdf`);
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
                      <div className="text-sm text-muted-foreground">
                        {item.saleModeName} ({toFraction(item.multiplier)}x) • {formatCurrency(item.price)} × {item.qty}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
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
              onChange={(e) => setAmountPaid(e.target.value)}
              placeholder="0.00"
            />
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
