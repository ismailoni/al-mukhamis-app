import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { collection, getDocs, addDoc, serverTimestamp, doc, updateDoc, increment } from "firebase/firestore";
import { db } from "../lib/firebase";
import { formatCurrency } from "../lib/utils";
import { LoadingState } from "../components/LoadingState";
import toast from "react-hot-toast";
import { Wallet, Plus, DollarSign, Package, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";

export default function Debtors() {
  const queryClient = useQueryClient();
  const [isAddLenderOpen, setIsAddLenderOpen] = useState(false);
  const [isBorrowModalOpen, setIsBorrowModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedLender, setSelectedLender] = useState(null);
  const [viewingLender, setViewingLender] = useState(null);
  const [selectedBorrowingInstance, setSelectedBorrowingInstance] = useState(null);
  const [paymentType, setPaymentType] = useState("cash");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [borrowedItems, setBorrowedItems] = useState([{ productId: "", quantity: 1 }]);
  const [returnedItems, setReturnedItems] = useState([{ productId: "", quantity: 1 }]);
  const [newLenderName, setNewLenderName] = useState("");
  const [newLenderPhone, setNewLenderPhone] = useState("");
  const [newLenderAddress, setNewLenderAddress] = useState("");

  const { data: lenders, isLoading: lendersLoading } = useQuery({
    queryKey: ["lenders"],
    queryFn: async () => {
      const s = await getDocs(collection(db, "lenders"));
      return s.docs.map(d => ({ id: d.id, ...d.data() }));
    }
  });

  const { isLoading: borrowingLoading } = useQuery({
    queryKey: ["borrowing-instances"],
    queryFn: async () => {
      const s = await getDocs(collection(db, "borrowing-instances"));
      return s.docs.map(d => ({ id: d.id, ...d.data() }));
    }
  });

  const { data: lenderHistory, isLoading: historyLoading } = useQuery({
    queryKey: ["lender-history", viewingLender?.id],
    enabled: !!viewingLender,
    queryFn: async () => {
      const borrowingsSnap = await getDocs(collection(db, "borrowing-instances"));
      const borrowings = borrowingsSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(b => b.lenderId === viewingLender.id)
        .sort((a, b) => (b.date?.seconds || 0) - (a.date?.seconds || 0));

      const paymentsSnap = await getDocs(collection(db, "debtor-payments"));
      const payments = paymentsSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(p => borrowings.some(b => b.id === p.borrowingInstanceId))
        .sort((a, b) => (b.date?.seconds || 0) - (a.date?.seconds || 0));

      return { borrowings, payments };
    },
  });

  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const s = await getDocs(collection(db, "products"));
      return s.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((p) => !p.deleted);
    },
  });

  const addLenderMutation = useMutation({
    mutationFn: async (data) => {
      const docRef = await addDoc(collection(db, "lenders"), {
        ...data,
        totalOwed: 0,
        createdAt: serverTimestamp(),
      });
      return { id: docRef.id, ...data };
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["lenders"]);
      setIsAddLenderOpen(false);
      setNewLenderName("");
      setNewLenderPhone("");
      setNewLenderAddress("");
      toast.success("Lender added successfully");
    },
  });

  const addBorrowingMutation = useMutation({
    mutationFn: async (data) => {
      const { lenderId, items, amountOwed, borrowedProducts } = data;
      
      const totalAmount = Number(amountOwed);
      
      // Add borrowing instance
      await addDoc(collection(db, "borrowing-instances"), {
        lenderId,
        items,
        amountOwed: totalAmount,
        amountPaid: 0,
        balance: totalAmount,
        borrowedProducts: borrowedProducts || [],
        date: serverTimestamp(),
      });
      
      // Update lender total
      const lenderRef = doc(db, "lenders", lenderId);
      await updateDoc(lenderRef, {
        totalOwed: increment(totalAmount),
      });
      
      // Update stock for borrowed products
      if (borrowedProducts && borrowedProducts.length > 0) {
        for (const item of borrowedProducts) {
          if (item.productId && item.quantity > 0) {
            const productRef = doc(db, "products", item.productId);
            await updateDoc(productRef, {
              stock: increment(item.quantity),
            });
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["lenders"]);
      queryClient.invalidateQueries(["borrowing-instances"]);
      queryClient.invalidateQueries(["products"]);
      setIsBorrowModalOpen(false);
      setSelectedLender(null);
      setBorrowedItems([{ productId: "", quantity: 1 }]);
      toast.success("Borrowing recorded & stock updated");
    }
  });

  const recordPaymentMutation = useMutation({
    mutationFn: async ({ borrowingInstanceId, lenderId, amount, type, notes, returnedProducts }) => {
      // Update borrowing instance
      const instanceRef = doc(db, "borrowing-instances", borrowingInstanceId);
      await updateDoc(instanceRef, {
        amountPaid: increment(amount),
        balance: increment(-amount),
      });
      
      // Update lender total
      const lenderRef = doc(db, "lenders", lenderId);
      await updateDoc(lenderRef, {
        totalOwed: increment(-amount),
      });
      
      // Record payment
      await addDoc(collection(db, "debtor-payments"), {
        borrowingInstanceId,
        lenderId,
        amount,
        paymentType: type,
        notes,
        returnedProducts: returnedProducts || [],
        date: serverTimestamp(),
      });
      
      // Deduct stock for returned products
      if (returnedProducts && returnedProducts.length > 0) {
        for (const item of returnedProducts) {
          if (item.productId && item.quantity > 0) {
            const productRef = doc(db, "products", item.productId);
            await updateDoc(productRef, {
              stock: increment(-item.quantity),
            });
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["lenders"]);
      queryClient.invalidateQueries(["borrowing-instances"]);
      queryClient.invalidateQueries(["lender-history"]);
      queryClient.invalidateQueries(["products"]);
      setIsPaymentModalOpen(false);
      setSelectedBorrowingInstance(null);
      setPaymentAmount("");
      setPaymentNotes("");
      setPaymentType("cash");
      setReturnedItems([{ productId: "", quantity: 1 }]);
      toast.success("Payment recorded successfully");
    },
    onError: (error) => {
      toast.error("Failed to record payment: " + error.message);
    },
  });

  const handleAddLender = () => {
    if (!newLenderName.trim()) {
      toast.error("Lender name is required");
      return;
    }
    addLenderMutation.mutate({
      name: newLenderName.trim(),
      phone: newLenderPhone.trim(),
      address: newLenderAddress.trim(),
    });
  };

  const handleRecordBorrowing = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    
    if (!selectedLender) {
      toast.error("Please select a lender");
      return;
    }
    
    // Filter valid borrowed items
    const validBorrowedItems = borrowedItems.filter(
      item => item.productId && item.quantity > 0
    );
    
    addBorrowingMutation.mutate({
      lenderId: selectedLender.id,
      ...data,
      borrowedProducts: validBorrowedItems,
    });
  };

  const handlePayment = () => {
    let amount = Number(paymentAmount);
    
    // Auto-calculate value for returned goods
    if (paymentType === "goods") {
      const validReturnedItems = returnedItems.filter(
        item => item.productId && item.quantity > 0
      );
      
      if (validReturnedItems.length === 0) {
        toast.error("Please select products to return");
        return;
      }
      
      amount = validReturnedItems.reduce((total, item) => {
        const product = products?.find(p => p.id === item.productId);
        return total + (product?.price || 0) * item.quantity;
      }, 0);
    } else {
      if (!amount || amount <= 0) {
        toast.error("Please enter a valid amount");
        return;
      }
    }
    
    if (amount > selectedBorrowingInstance?.balance) {
      toast.error("Payment amount cannot exceed debt amount");
      return;
    }
    
    recordPaymentMutation.mutate({
      borrowingInstanceId: selectedBorrowingInstance.id,
      lenderId: selectedBorrowingInstance.lenderId,
      amount,
      type: paymentType,
      notes: paymentNotes,
      returnedProducts: paymentType === "goods" ? returnedItems.filter(
        item => item.productId && item.quantity > 0
      ) : [],
    });
  };

  const openBorrowingModal = (lender) => {
    setSelectedLender(lender);
    setBorrowedItems([{ productId: "", quantity: 1 }]);
    setIsBorrowModalOpen(true);
  };

  const openPaymentModal = (instance) => {
    setSelectedBorrowingInstance(instance);
    setPaymentAmount(instance.balance.toString());
    setReturnedItems([{ productId: "", quantity: 1 }]);
    setIsPaymentModalOpen(true);
  };
  
  const addBorrowedItemRow = () => {
    setBorrowedItems([...borrowedItems, { productId: "", quantity: 1 }]);
  };
  
  const removeBorrowedItemRow = (index) => {
    if (borrowedItems.length > 1) {
      setBorrowedItems(borrowedItems.filter((_, i) => i !== index));
    }
  };
  
  const updateBorrowedItem = (index, field, value) => {
    const updated = [...borrowedItems];
    updated[index][field] = value;
    setBorrowedItems(updated);
  };
  
  const addReturnedItemRow = () => {
    setReturnedItems([...returnedItems, { productId: "", quantity: 1 }]);
  };
  
  const removeReturnedItemRow = (index) => {
    if (returnedItems.length > 1) {
      setReturnedItems(returnedItems.filter((_, i) => i !== index));
    }
  };
  
  const updateReturnedItem = (index, field, value) => {
    const updated = [...returnedItems];
    updated[index][field] = value;
    setReturnedItems(updated);
  };
  
  const calculateReturnedValue = () => {
    return returnedItems.reduce((total, item) => {
      const product = products?.find(p => p.id === item.productId);
      return total + (product?.price || 0) * (item.quantity || 0);
    }, 0);
  };

  if (lendersLoading || productsLoading || borrowingLoading) {
    return <LoadingState message="Loading lenders data..." />;
  }

  const totalOwed = lenders?.reduce((sum, lender) => sum + (lender.totalOwed || 0), 0) || 0;

  return (
    <div className="space-y-6">
      {!viewingLender ? (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Lenders & Suppliers</h1>
              <p className="mt-1 text-muted-foreground">
                Manage suppliers and track borrowed goods
              </p>
              {totalOwed > 0 && (
                <p className="mt-2 text-lg font-semibold text-amber-600">
                  Total Outstanding: {formatCurrency(totalOwed)}
                </p>
              )}
            </div>
            <Button 
              onClick={() => setIsAddLenderOpen(true)}
              size="lg"
              className="gap-2"
            >
              <Plus className="w-4 h-4" /> Add Lender
            </Button>
          </div>

          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="w-5 h-5" />
                Lenders List
              </CardTitle>
              <CardDescription>All suppliers and lenders</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lender Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Total Owed</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lenders?.map((lender) => (
                    <TableRow key={lender.id}>
                      <TableCell className="font-medium">{lender.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {lender.phone || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={lender.totalOwed > 0 ? "warning" : "secondary"}
                          className="px-3 py-1 text-base"
                        >
                          {formatCurrency(lender.totalOwed || 0)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={lender.totalOwed > 0 ? "warning" : "success"}>
                          {lender.totalOwed > 0 ? "Has Debt" : "Clear"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setViewingLender(lender)}
                          >
                            View History
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => openBorrowingModal(lender)}
                            className="gap-2"
                          >
                            <Package className="w-4 h-4" />
                            Borrow
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {lenders?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                        No lenders added yet. Click &quot;Add Lender&quot; to start.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div>
              <Button
                variant="ghost"
                onClick={() => setViewingLender(null)}
                className="mb-2"
              >
                ← Back to Lenders
              </Button>
              <h1 className="text-3xl font-bold">{viewingLender.name}</h1>
              <p className="mt-1 text-muted-foreground">
                {viewingLender.phone && `Phone: ${viewingLender.phone}`}
                {viewingLender.address && ` • ${viewingLender.address}`}
              </p>
              <p className="mt-2 text-lg font-semibold text-amber-600">
                Total Outstanding: {formatCurrency(viewingLender.totalOwed || 0)}
              </p>
            </div>
            <Button 
              onClick={() => openBorrowingModal(viewingLender)}
              size="lg"
              className="gap-2"
            >
              <Package className="w-4 h-4" /> Record New Borrowing
            </Button>
          </div>

          <Card className="border-2">
            <CardHeader>
              <CardTitle>Borrowing History</CardTitle>
              <CardDescription>All borrowing instances and payments</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {historyLoading ? (
                <div className="py-8 text-center text-muted-foreground">
                  Loading history...
                </div>
              ) : (
                <>
                  {lenderHistory?.borrowings?.map((borrowing) => {
                    const borrowingPayments = lenderHistory.payments.filter(
                      p => p.borrowingInstanceId === borrowing.id
                    );
                    const formattedDate = borrowing.date?.toDate
                      ? borrowing.date.toDate().toLocaleDateString()
                      : new Date(borrowing.date?.seconds * 1000).toLocaleDateString();

                    return (
                      <div key={borrowing.id} className="p-4 border rounded-lg">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="font-semibold">
                              {formattedDate}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              {borrowing.items}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">Total Borrowed</p>
                            <p className="text-lg font-bold">
                              {formatCurrency(borrowing.amountOwed)}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 p-3 mb-3 rounded bg-muted">
                          <div>
                            <p className="text-xs text-muted-foreground">Paid</p>
                            <p className="font-semibold text-green-600">
                              {formatCurrency(borrowing.amountPaid || 0)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Balance</p>
                            <p className="font-semibold text-amber-600">
                              {formatCurrency(borrowing.balance || borrowing.amountOwed)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Status</p>
                            <Badge variant={borrowing.balance > 0 ? "warning" : "success"}>
                              {borrowing.balance > 0 ? "Pending" : "Cleared"}
                            </Badge>
                          </div>
                        </div>

                        {borrowingPayments.length > 0 && (
                          <div className="mb-3 space-y-2">
                            <p className="text-sm font-medium">Payments:</p>
                            {borrowingPayments.map((payment) => {
                              const payDate = payment.date?.toDate
                                ? payment.date.toDate().toLocaleDateString()
                                : new Date(payment.date?.seconds * 1000).toLocaleDateString();
                              return (
                                <div key={payment.id} className="flex justify-between p-2 text-sm border-l-2 border-green-500 bg-green-50">
                                  <div>
                                    <span className="font-medium">{payDate}</span>
                                    {payment.notes && (
                                      <span className="ml-2 text-muted-foreground">
                                        - {payment.notes}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline">{payment.paymentType}</Badge>
                                    <span className="font-semibold text-green-600">
                                      {formatCurrency(payment.amount)}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {borrowing.balance > 0 && (
                          <Button
                            size="sm"
                            onClick={() => openPaymentModal(borrowing)}
                            className="w-full gap-2"
                          >
                            <DollarSign className="w-4 h-4" />
                            Make Payment/Return
                          </Button>
                        )}
                      </div>
                    );
                  })}
                  {lenderHistory?.borrowings?.length === 0 && (
                    <div className="py-8 text-center text-muted-foreground">
                      No borrowing history yet.
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Add Lender Dialog */}
      <Dialog open={isAddLenderOpen} onOpenChange={setIsAddLenderOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New Lender</DialogTitle>
            <DialogDescription>
              Create a new lender/supplier profile
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="lender-name">Name *</Label>
              <Input
                id="lender-name"
                value={newLenderName}
                onChange={(e) => setNewLenderName(e.target.value)}
                placeholder="Enter lender name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lender-phone">Phone Number</Label>
              <Input
                id="lender-phone"
                type="tel"
                value={newLenderPhone}
                onChange={(e) => setNewLenderPhone(e.target.value)}
                placeholder="Enter phone number"
                inputMode="tel"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lender-address">Address</Label>
              <Input
                id="lender-address"
                value={newLenderAddress}
                onChange={(e) => setNewLenderAddress(e.target.value)}
                placeholder="Enter address"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAddLenderOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleAddLender}
              disabled={addLenderMutation.isPending}
            >
              {addLenderMutation.isPending ? "Adding..." : "Add Lender"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Borrowing Modal */}
      {/* Record Borrowing Modal */}
      {isBorrowModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Record Borrowed Items</CardTitle>
              <CardDescription>
                Borrowing from: <strong>{selectedLender?.name}</strong>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleRecordBorrowing} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="items">Items Borrowed (Description)</Label>
                  <Textarea 
                    id="items"
                    name="items" 
                    required 
                    placeholder="e.g. 10 Cartons of Sunlight Soap" 
                    rows={2}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Select Products (Optional - for auto stock update)</Label>
                  {borrowedItems.map((item, index) => (
                    <div key={index} className="flex gap-2">
                      <Select 
                        value={item.productId} 
                        onValueChange={(value) => updateBorrowedItem(index, "productId", value)}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Select product..." />
                        </SelectTrigger>
                        <SelectContent>
                          {products?.map((product) => (
                            <SelectItem key={product.id} value={product.id}>
                              {product.name} - {formatCurrency(product.price)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateBorrowedItem(index, "quantity", Number(e.target.value))}
                        className="w-24"
                        min="1"
                        placeholder="Qty"
                      />
                      {borrowedItems.length > 1 && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => removeBorrowedItemRow(index)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={addBorrowedItemRow}
                    className="w-full mt-2"
                  >
                    <Plus className="w-4 h-4 mr-2" /> Add Product
                  </Button>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="amountOwed">Total Value (₦)</Label>
                  <Input 
                    id="amountOwed"
                    name="amountOwed" 
                    type="number" 
                    required 
                    placeholder="0.00" 
                    step="0.01"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => setIsBorrowModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={addBorrowingMutation.isPending}
                  >
                    {addBorrowingMutation.isPending ? "Saving..." : "Save Record"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Payment/Return Dialog */}
      <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Record Payment/Return</DialogTitle>
            <DialogDescription>
              {selectedBorrowingInstance && (
                <span>
                  Borrowing from: <strong>{lenders?.find(l => l.id === selectedBorrowingInstance.lenderId)?.name}</strong>
                  <br />
                  Outstanding: <strong>{formatCurrency(selectedBorrowingInstance.balance)}</strong>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="payment-type">Payment Method</Label>
              <Select value={paymentType} onValueChange={setPaymentType}>
                <SelectTrigger id="payment-type">
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      Cash Payment
                    </div>
                  </SelectItem>
                  <SelectItem value="transfer">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      Bank Transfer
                    </div>
                  </SelectItem>
                  <SelectItem value="goods">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      Returned Goods
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {paymentType === "goods" ? (
              <div className="space-y-2">
                <Label>Select Returned Products</Label>
                {returnedItems.map((item, index) => (
                  <div key={index} className="flex gap-2">
                    <Select 
                      value={item.productId} 
                      onValueChange={(value) => updateReturnedItem(index, "productId", value)}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select product..." />
                      </SelectTrigger>
                      <SelectContent>
                        {products?.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name} - {formatCurrency(product.price)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateReturnedItem(index, "quantity", Number(e.target.value))}
                      className="w-24"
                      min="1"
                      placeholder="Qty"
                    />
                    {returnedItems.length > 1 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => removeReturnedItemRow(index)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={addReturnedItemRow}
                  className="w-full"
                >
                  <Plus className="w-4 h-4 mr-2" /> Add Product
                </Button>
                <div className="p-3 rounded-md bg-muted">
                  <div className="flex justify-between text-sm">
                    <span>Calculated Value:</span>
                    <span className="font-bold">{formatCurrency(calculateReturnedValue())}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="payment-amount">Amount/Value (₦)</Label>
                <Input
                  id="payment-amount"
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  max={selectedBorrowingInstance?.balance || undefined}
                  inputMode="decimal"
                />
                {paymentAmount && Number(paymentAmount) > (selectedBorrowingInstance?.balance || 0) && (
                  <p className="text-sm text-destructive">Amount cannot exceed outstanding debt</p>
                )}
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="payment-notes">Notes (Optional)</Label>
              <Textarea
                id="payment-notes"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="e.g., Returned 5 cartons of soap"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsPaymentModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handlePayment}
              disabled={recordPaymentMutation.isPending}
            >
              {recordPaymentMutation.isPending ? "Recording..." : "Record Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}