import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  serverTimestamp,
  increment,
  orderBy,
  query as fsQuery,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { formatCurrency, parseMultiplier, toFraction } from "../lib/utils";
import { LoadingState } from "../components/LoadingState";
import toast from "react-hot-toast";
import { Plus, Edit, Package, History, Trash2 } from "lucide-react";
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

export default function Inventory() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [formValues, setFormValues] = useState({ name: "", category: "", stock: 0 });
  const [saleModes, setSaleModes] = useState([
    { id: 1, name: "Carton", multiplier: "1", price: 0 },
  ]);
  const [stockRows, setStockRows] = useState([{ id: 1, productId: "", qty: 1 }]);
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch Products
  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const snapshot = await getDocs(collection(db, "products"));
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => !p.deleted);
    }
  });

  // Stock addition history
  const { data: stockHistory, isLoading: historyLoading } = useQuery({
    queryKey: ["stock-entries"],
    queryFn: async () => {
      const snapshot = await getDocs(fsQuery(collection(db, "stock_entries"), orderBy("addedAt", "desc")));
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    },
  });

  const openNewProduct = () => {
    setFormValues({ name: "", category: "", stock: 0 });
    setSaleModes([{ id: Date.now(), name: "Carton", multiplier: "1", price: 0 }]);
    setEditingItem(null);
    setIsModalOpen(true);
  };

  const openEditProduct = (product) => {
    setFormValues({
      name: product.name || "",
      category: product.category || "",
      stock: product.stock || 0,
    });

    if (product.saleModes?.length) {
      setSaleModes(product.saleModes.map((m, idx) => ({ id: idx + 1, ...m, multiplier: (m.multiplier ?? 1).toString() })));
    } else {
      setSaleModes([{ id: Date.now(), name: "Carton", multiplier: "1", price: product.price || 0 }]);
    }

    setEditingItem(product);
    setIsModalOpen(true);
  };

  const updateSaleMode = (id, key, value) => {
    setSaleModes((prev) =>
      prev.map((mode) => {
        if (mode.id !== id) return mode;
        
        const updated = { ...mode, [key]: value };
        
        // Auto-update multiplier when name changes to carton-based modes
        if (key === "name") {
          switch (value) {
            case "Carton":
              updated.multiplier = "1";
              break;
            case "1/2 Carton":
              updated.multiplier = "1/2";
              break;
            case "1/3 Carton":
              updated.multiplier = "1/3";
              break;
            case "1/4 Carton":
              updated.multiplier = "1/4";
              break;
            default:
              // Keep existing multiplier for other modes
              break;
          }
        }
        
        return updated;
      })
    );
  };

  const addSaleMode = () => {
    setSaleModes((prev) => [...prev, { id: Date.now(), name: "Carton", multiplier: "1", price: 0 }]);
  };

  const removeSaleMode = (id) => {
    setSaleModes((prev) => (prev.length > 1 ? prev.filter((m) => m.id !== id) : prev));
  };

  const updateStockRow = (id, key, value) => {
    setStockRows((prev) => prev.map((row) => (row.id === id ? { ...row, [key]: value } : row)));
  };

  const addStockRow = () => {
    setStockRows((prev) => [...prev, { id: Date.now(), productId: "", qty: 1 }]);
  };

  const removeStockRow = (id) => {
    setStockRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
  };

  // Mutation to Add/Edit
  const mutation = useMutation({
    mutationFn: async () => {
      if (!saleModes.length) throw new Error("Add at least one sale mode");

      const cleanedModes = saleModes.map((m) => ({
        name: m.name || "",
        multiplier: parseMultiplier(m.multiplier),
        price: Number(m.price) || 0,
      }));

      const data = {
        ...formValues,
        name: formValues.name.trim(),
        category: formValues.category.trim(),
        price: cleanedModes[0]?.price || 0,
        stock: Number(formValues.stock) || 0,
        saleModes: cleanedModes,
        updatedAt: serverTimestamp(),
        deleted: false,
      };
      
      if (editingItem) {
        await updateDoc(doc(db, "products", editingItem.id), data);
      } else {
        await addDoc(collection(db, "products"), data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["products"]);
      setIsModalOpen(false);
      setEditingItem(null);
      toast.success(editingItem ? "Product Updated" : "Product Added");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    mutation.mutate();
  };

  const addStockMutation = useMutation({
    mutationFn: async () => {
      const operations = stockRows.filter((r) => r.productId && Number(r.qty) > 0);
      if (!operations.length) throw new Error("Add at least one product row with quantity");

      for (const row of operations) {
        const product = products?.find((p) => p.id === row.productId);
        if (!product) continue;

        await updateDoc(doc(db, "products", row.productId), {
          stock: increment(Number(row.qty)),
          updatedAt: serverTimestamp(),
        });

        await addDoc(collection(db, "stock_entries"), {
          productId: row.productId,
          productName: product.name,
          quantity: Number(row.qty),
          addedAt: serverTimestamp(),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["products"]);
      queryClient.invalidateQueries(["stock-entries"]);
      setStockRows([{ id: Date.now(), productId: "", qty: 1 }]);
      setIsStockModalOpen(false);
      toast.success("Stock added successfully");
    },
    onError: (err) => toast.error(err.message),
  });

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    if (!searchTerm.trim()) return products;
    const term = searchTerm.toLowerCase();
    return products.filter(
      (p) =>
        p.name?.toLowerCase().includes(term) ||
        p.category?.toLowerCase().includes(term) ||
        p.saleModes?.some((m) => m.name?.toLowerCase().includes(term))
    );
  }, [products, searchTerm]);

  const isLoadingData = productsLoading || historyLoading;

  if (isLoadingData) {
    return <LoadingState message="Loading inventory data..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between gap-4 md:items-center">
        <div>
          <h1 className="text-3xl font-bold">Inventory Management</h1>
          <p className="text-muted-foreground mt-1">Manage your product catalog and stock levels</p>
        </div>
        <div className="flex gap-2 mt-4 md:mt-0">
          <Button onClick={() => setIsStockModalOpen(true)} variant="outline" size="lg" className="gap-2">
            <History className="w-4 h-4" /> Add Stock
          </Button>
          <Button onClick={openNewProduct} size="lg" className="gap-2">
            <Plus className="w-4 h-4" /> Add New Product
          </Button>
        </div>
      </div>

      <Card className="border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Product List
          </CardTitle>
          <CardDescription>View and manage all products in your inventory</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <p className="text-sm text-muted-foreground">Search by name, category, or sale mode</p>
            <Input
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="md:w-64"
            />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Sale Modes</TableHead>
                <TableHead>Primary Price</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts?.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{product.category}</Badge>
                  </TableCell>
                  <TableCell className='min-w-[125px]'>
                    {product.stock < 10 ? (
                      <Badge variant="warning"  className="text-[10px] min-w-[40px]">{toFraction(product.stock)} (Low Stock)</Badge>
                    ) : (
                      <span className="text-muted-foreground">{toFraction(product.stock)}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground space-y-1">
                    {(product.saleModes || [{ name: "Unit", multiplier: 1, price: product.price }]).map((mode, idx) => (
                      <div key={idx} className="flex justify-between gap-2">
                        <span>{mode.name} ({toFraction(mode.multiplier)}x)</span>
                        <span className="font-medium">{formatCurrency(mode.price)}</span>
                      </div>
                    ))}
                  </TableCell>
                  <TableCell className="font-semibold">{formatCurrency(product.saleModes?.[0]?.price || product.price)}</TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => openEditProduct(product)}
                      className="gap-1"
                    >
                      <Edit className="w-4 h-4" /> Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {products?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    No products found. Add your first product to get started.
                  </TableCell>
                </TableRow>
              )}
              {products?.length > 0 && filteredProducts?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    No matches for <span className="font-semibold">{searchTerm || "your search"}</span>.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Stock Additions History
          </CardTitle>
          <CardDescription>Recent stock additions across products</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Quantity Added</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stockHistory?.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-medium">{entry.productName || entry.productId}</TableCell>
                  <TableCell>{entry.quantity}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {entry.addedAt?.seconds
                      ? new Date(entry.addedAt.seconds * 1000).toLocaleString()
                      : ""}
                  </TableCell>
                </TableRow>
              ))}
              {stockHistory?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                    No stock additions logged yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>{editingItem ? "Edit Product" : "Add New Product"}</CardTitle>
              <CardDescription>
                {editingItem ? "Update product details" : "Enter the details for the new product"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Product Name</Label>
                  <Input 
                    id="name"
                    value={formValues.name}
                    onChange={(e) => setFormValues((p) => ({ ...p, name: e.target.value }))}
                    placeholder="e.g., Sunlight Soap" 
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Input 
                    id="category"
                    value={formValues.category}
                    onChange={(e) => setFormValues((p) => ({ ...p, category: e.target.value }))}
                    placeholder="e.g., Detergents" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stock">Stock Quantity</Label>
                  <Input 
                    id="stock"
                    type="number" 
                    value={formValues.stock}
                    onChange={(e) => setFormValues((p) => ({ ...p, stock: e.target.value }))}
                    placeholder="0" 
                    required 
                  />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Sale Modes & Prices</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addSaleMode}>
                      <Plus className="w-4 h-4 mr-1" /> Add Mode
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {saleModes.map((mode) => (
                      <div key={mode.id} className="grid grid-cols-12 gap-2 items-center border p-3 rounded-lg">
                        <div className="col-span-4">
                          <Label className="text-xs">Mode</Label>
                          <select
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={mode.name}
                            onChange={(e) => updateSaleMode(mode.id, "name", e.target.value)}
                          >
                            <option value="Carton">Carton</option>
                            <option value="1/2 Carton">1/2 Carton</option>
                            <option value="1/3 Carton">1/3 Carton</option>
                            <option value="1/4 Carton">1/4 Carton</option>
                            <option value="1/2 Pack">1/2 Pack</option>
                            <option value="1 Pack">1 Pack</option>
                            <option value="3 Packs">3 Packs</option>
                            <option value="4 Packs">4 Packs</option>
                            <option value="5 Packs">5 Packs</option>
                            <option value="1 Roll">1 Roll</option>
                            <option value="3 Rolls">3 Rolls</option>
                          </select>
                        </div>
                        <div className="col-span-3">
                          <Label className="text-xs">Multiplier</Label>
                          <Input
                            type="text"
                            value={mode.multiplier}
                            onChange={(e) => updateSaleMode(mode.id, "multiplier", e.target.value)}
                            placeholder="e.g., 1/2"
                          />
                        </div>
                        <div className="col-span-4">
                          <Label className="text-xs">Price (₦)</Label>
                          <Input
                            type="number"
                            value={mode.price}
                            onChange={(e) => updateSaleMode(mode.id, "price", e.target.value)}
                            placeholder="0.00"
                          />
                        </div>
                        <div className="col-span-1 flex justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeSaleMode(mode.id)}
                            disabled={saleModes.length === 1}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => { setIsModalOpen(false); setEditingItem(null); }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={mutation.isPending}>
                    {mutation.isPending ? "Saving..." : "Save Product"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {isStockModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <CardTitle>Add Stock</CardTitle>
              <CardDescription>Add quantities to existing products (single or bulk)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {stockRows.map((row) => (
                  <div key={row.id} className="grid grid-cols-12 gap-3 items-center border rounded-lg p-3">
                    <div className="col-span-7">
                      <Label className="text-xs">Product</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={row.productId}
                        onChange={(e) => updateStockRow(row.id, "productId", e.target.value)}
                      >
                        <option value="">Select product...</option>
                        {products?.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} (Stock: {p.stock})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-4">
                      <Label className="text-xs">Quantity</Label>
                      <Input
                        type="number"
                        value={row.qty}
                        onChange={(e) => updateStockRow(row.id, "qty", e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeStockRow(row.id)}
                        disabled={stockRows.length === 1}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between">
                <Button type="button" variant="outline" onClick={addStockRow}>
                  <Plus className="w-4 h-4 mr-1" /> Add Another Product
                </Button>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setIsStockModalOpen(false); setStockRows([{ id: Date.now(), productId: "", qty: 1 }]); }}
                >
                  Cancel
                </Button>
                <Button onClick={() => addStockMutation.mutate()} disabled={addStockMutation.isPending}>
                  {addStockMutation.isPending ? "Saving..." : "Save Stock"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}