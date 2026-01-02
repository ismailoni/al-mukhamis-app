import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { collection, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { formatCurrency } from "../lib/utils";
import toast from "react-hot-toast";
import { Wallet, Plus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Badge } from "../components/ui/badge";

export default function Debtors() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: debtors } = useQuery({
    queryKey: ["debtors"],
    queryFn: async () => {
      const s = await getDocs(collection(db, "debtors"));
      return s.docs.map(d => ({ id: d.id, ...d.data() }));
    }
  });

  const addDebtorMutation = useMutation({
    mutationFn: async (data) => {
      await addDoc(collection(db, "debtors"), {
        ...data,
        amountOwed: Number(data.amountOwed),
        createdAt: serverTimestamp(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["debtors"]);
      setIsModalOpen(false);
      toast.success("Lender Record Added");
    }
  });

  const handleAddDebtor = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    addDebtorMutation.mutate(Object.fromEntries(formData));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Lenders (Borrowed Goods)</h1>
          <p className="text-muted-foreground mt-1">Manage people the business owes money/goods to</p>
        </div>
        <Button 
          onClick={() => setIsModalOpen(true)}
          size="lg"
          className="gap-2"
        >
          <Plus className="w-4 h-4" /> Record Borrowed Goods
        </Button>
      </div>

      <Card className="border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            Borrowing History
          </CardTitle>
          <CardDescription>Track outstanding debts to suppliers and lenders</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lender Name</TableHead>
                <TableHead>Items Borrowed</TableHead>
                <TableHead>Value Owed</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {debtors?.map((debtor) => (
                <TableRow key={debtor.id}>
                  <TableCell className="font-medium">{debtor.name}</TableCell>
                  <TableCell className="text-muted-foreground">{debtor.items}</TableCell>
                  <TableCell>
                    <Badge variant="warning" className="text-base px-3 py-1">
                      {formatCurrency(debtor.amountOwed)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={debtor.amountOwed > 0 ? "warning" : "success"}>
                      {debtor.amountOwed > 0 ? "Pending Repayment" : "Cleared"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {debtors?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                    No borrowing history recorded.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Debtor Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Record Borrowed Items</CardTitle>
              <CardDescription>Add details of goods borrowed from suppliers</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddDebtor} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Lender/Supplier Name</Label>
                  <Input 
                    id="name"
                    name="name" 
                    required 
                    placeholder="e.g. Alhaji Musa" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="items">Items Borrowed</Label>
                  <Textarea 
                    id="items"
                    name="items" 
                    required 
                    placeholder="e.g. 10 Cartons of Sunlight Soap" 
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amountOwed">Total Value (₦)</Label>
                  <Input 
                    id="amountOwed"
                    name="amountOwed" 
                    type="number" 
                    required 
                    placeholder="0.00" 
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => setIsModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={addDebtorMutation.isPending}
                  >
                    {addDebtorMutation.isPending ? "Saving..." : "Save Record"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}