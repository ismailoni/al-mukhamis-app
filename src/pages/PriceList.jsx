import { useQuery } from "@tanstack/react-query";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import { formatCurrency, parseMultiplier, toFraction } from "../lib/utils";
import { useMemo, useState } from "react";
import { Search, Package, CheckCircle, XCircle, ShoppingCart, Plus, Minus, Trash, X, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Link } from "react-router-dom";

export default function PriceList() {
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState([]);
  const [showCart, setShowCart] = useState(false);
  const [selectedModes, setSelectedModes] = useState({});
  const whatsappNumber = "2347043278472";
  
  const { data: products, isLoading } = useQuery({
    queryKey: ["public-products"],
    queryFn: async () => {
      const s = await getDocs(collection(db, "products"));
      return s.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => !p.deleted);
    }
  });

  const filtered = useMemo(() =>
    products?.filter(p => p.name.toLowerCase().includes(search.toLowerCase())),
    [products, search]
  );

  const getSaleModes = (product) => {
    const baseModes = product?.saleModes?.length ? product.saleModes : [{
      name: product?.saleModeName || "Unit",
      multiplier: product?.saleModeMultiplier ?? 1,
      price: product?.saleModePrice ?? product?.price ?? 0,
    }];

    return baseModes.map((mode, idx) => ({
      id: mode.id ?? idx,
      name: mode.name || `Mode ${idx + 1}`,
      multiplier: parseMultiplier(mode.multiplier ?? 1),
      price: Number(mode.price ?? product?.price ?? 0) || 0,
    }));
  };

  const getActiveMode = (product) => {
    const modes = getSaleModes(product);
    const index = selectedModes[product.id] ?? 0;
    const mode = modes[index] || modes[0];
    return { mode, modes, index };
  };

  const addToCart = (product) => {
    if (product.stock !== undefined && product.stock <= 0) return;

    const { mode } = getActiveMode(product);
    const multiplier = Math.max(mode?.multiplier || 1, 0.000001);
    const maxQty = typeof product.stock === "number" ? Math.floor(Math.max(product.stock, 0) / multiplier) : null;
    if (maxQty !== null && maxQty < 1) return;

    const key = `${product.id || product.name}-${mode?.name || "Mode"}`;

    setCart((prev) => {
      const existing = prev.find((item) => item.key === key);
      if (existing) {
        const nextQty = existing.qty + 1;
        const cappedQty = maxQty !== null ? Math.min(nextQty, maxQty) : nextQty;
        if (cappedQty === existing.qty) return prev;
        return prev.map((item) =>
          item.key === key ? { ...item, qty: cappedQty } : item
        );
      }

      const initialQty = maxQty !== null ? Math.min(1, maxQty) : 1;
      return [
        ...prev,
        {
          key,
          id: product.id,
          name: product.name,
          saleMode: mode?.name || "Unit",
          multiplier,
          price: mode?.price ?? product.price ?? 0,
          qty: initialQty,
          maxQty,
        },
      ];
    });
  };

  const updateQty = (key, delta) => {
    setCart((prev) => prev.flatMap((item) => {
      if (item.key !== key) return item;
      const tentative = item.qty + delta;
      const capped = item.maxQty !== null ? Math.min(tentative, item.maxQty) : tentative;
      if (capped <= 0) return [];
      return { ...item, qty: capped };
    }));
  };

  const removeItem = (key) => setCart((prev) => prev.filter((item) => item.key !== key));

  const totalAmount = cart.reduce((sum, item) => sum + item.price * item.qty, 0);

  const checkoutWhatsApp = () => {
    if (!cart.length) return;
    const lines = cart.map((item) => `- ${item.name} (${item.saleMode}, ${toFraction(item.multiplier)} unit${item.multiplier > 1 ? "s" : ""}) x${item.qty} = ${formatCurrency(item.price * item.qty)}`);
    const message = `Hello Al-Mukhamis Ventures, I'd like to place an order:\n\n${lines.join("\n")}\n\nTotal: ${formatCurrency(totalAmount)}\n\nPlease confirm availability.`;
    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/${whatsappNumber}?text=${encoded}`, "_blank");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-4 flex flex-row items-center">
            <Link to="/">
                <Button variant="ghost" className="gap-2 w-full" asChild>
                    <ArrowLeft className="w-4 h-4" /> Back Home
                </Button>
            </Link>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Al-Mukhamis Ventures</h1>
          <p className="text-lg text-muted-foreground">Official Price List</p>
          <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-full px-4 py-1.5 mt-4">
            <Package className="w-4 h-4 text-blue-600" />
            <span className="text-sm text-blue-700 font-medium">Updated Daily</span>
          </div>
        </div>

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 text-muted-foreground w-5 h-5" />
            <Input 
              type="text" 
              placeholder="Search products..." 
              className="pl-10 h-12 text-base"
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading prices...</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered?.map((p, i) => {
              const { mode: activeMode, modes, index: activeIndex } = getActiveMode(p);
              const requiredUnits = Math.max(activeMode?.multiplier || 1, 0.000001);
              const hasStock = typeof p.stock === "number" ? p.stock >= requiredUnits : true;

              return (
                <Card key={p.id || i} className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-2">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{p.name}</CardTitle>
                        {p.category && (
                          <Badge variant="secondary" className="mt-2">
                            {p.category}
                          </Badge>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-blue-700">
                          {formatCurrency(activeMode?.price ?? p.price)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {activeMode?.name} • {toFraction(activeMode?.multiplier || 1)} unit{(activeMode?.multiplier || 1) > 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {modes.length > 1 && (
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">Choose sale mode</label>
                        <select
                          className="w-full border rounded-lg text-sm px-3 py-2 bg-white"
                          value={activeIndex}
                          onChange={(e) => setSelectedModes((prev) => ({ ...prev, [p.id]: Number(e.target.value) }))}
                        >
                          {modes.map((mode, idx) => (
                            <option key={mode.id ?? idx} value={idx}>
                              {mode.name} • {toFraction(mode.multiplier)} unit{mode.multiplier > 1 ? "s" : ""} @ {formatCurrency(mode.price)}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {hasStock ? (
                          <>
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <span className="text-sm text-green-600 font-medium">In Stock</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-4 h-4 text-red-500" />
                            <span className="text-sm text-red-500 font-medium">Out of Stock</span>
                          </>
                        )}
                      </div>
                      <Button
                        size="sm"
                        disabled={!hasStock}
                        onClick={() => addToCart(p)}
                        className="gap-2"
                      >
                        <Plus className="w-4 h-4" /> Add
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {filtered?.length === 0 && (
              <div className="col-span-full text-center py-20">
                <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-20" />
                <p className="text-muted-foreground text-lg">No products found matching your search.</p>
              </div>
            )}
          </div>
        )}
        
        <div className="mt-12 text-center">
          <Card className="border-2 bg-slate-50">
            <CardContent className="py-6">
              <p className="text-sm text-muted-foreground">
                Prices subject to change. Contact us for bulk orders and special rates.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Floating Cart Button */}
      {cart.length > 0 && (
        <button
          onClick={() => setShowCart(true)}
          className="fixed bottom-6 right-6 bg-blue-600 text-white rounded-full shadow-xl px-5 py-3 flex items-center gap-2 hover:bg-blue-700 transition-all"
        >
          <ShoppingCart className="w-5 h-5" />
          <span>{cart.reduce((sum, item) => sum + item.qty, 0)} items</span>
        </button>
      )}

      {/* Cart Modal */}
      {showCart && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h3 className="text-xl font-bold">Your Cart</h3>
                <p className="text-sm text-muted-foreground">Review items and send to WhatsApp</p>
              </div>
              <button onClick={() => setShowCart(false)} className="text-slate-500 hover:text-slate-900">
                <X className="w-5 h-5" />
              </button>
            </div>

            {cart.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">Your cart is empty.</div>
            ) : (
              <div className="p-6 space-y-4">
                {cart.map((item) => (
                  <div key={item.key} className="flex items-center justify-between gap-4 border rounded-xl p-4">
                    <div>
                      <p className="font-semibold text-slate-900">{item.name}</p>
                      <p className="text-sm text-muted-foreground">{item.saleMode} • {toFraction(item.multiplier)} unit{item.multiplier > 1 ? "s" : ""} @ {formatCurrency(item.price)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQty(item.key, -1)}
                        className="w-8 h-8 rounded-full border flex items-center justify-center hover:bg-slate-100"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-8 text-center font-semibold">{item.qty}</span>
                      <button
                        onClick={() => updateQty(item.key, 1)}
                        className="w-8 h-8 rounded-full border flex items-center justify-center hover:bg-slate-100"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="font-bold">{formatCurrency(item.price * item.qty)}</div>
                    <button onClick={() => removeItem(item.key)} className="text-red-500 hover:text-red-700">
                      <Trash className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                <div className="flex items-center justify-between text-lg font-bold pt-2">
                  <span>Total</span>
                  <span>{formatCurrency(totalAmount)}</span>
                </div>

                <div className="flex items-center gap-3 pt-4">
                  <Button variant="outline" className="flex-1" onClick={() => setShowCart(false)}>
                    Close
                  </Button>
                  <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={checkoutWhatsApp}>
                    Send to WhatsApp
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}