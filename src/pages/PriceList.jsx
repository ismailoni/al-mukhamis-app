import { useQuery } from "@tanstack/react-query";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import { formatCurrency } from "../lib/utils";
import { useState } from "react";
import { Search, Package, CheckCircle, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";

export default function PriceList() {
  const [search, setSearch] = useState("");
  
  const { data: products, isLoading } = useQuery({
    queryKey: ["public-products"],
    queryFn: async () => {
      const s = await getDocs(collection(db, "products"));
      return s.docs.map(d => d.data()).filter(p => !p.deleted);
    }
  });

  const filtered = products?.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      <div className="max-w-4xl mx-auto p-6">
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
            {filtered?.map((p, i) => (
              <Card key={i} className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-2">
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
                        {formatCurrency(p.price)}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    {p.stock > 0 ? (
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
                </CardContent>
              </Card>
            ))}
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
    </div>
  );
}