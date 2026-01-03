import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import { formatCurrency } from "../lib/utils";
import { TrendingUp, Users, AlertCircle, ShoppingBag, DollarSign, Package, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";

export default function Dashboard() {
  const [showDailyReport, setShowDailyReport] = useState(false);
  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const salesSnap = await getDocs(collection(db, "sales"));
      const productsSnap = await getDocs(collection(db, "products"));
      const customerSnap = await getDocs(collection(db, "customers"));

      const sales = salesSnap.docs.map(d => d.data());
      const products = productsSnap.docs.map(d => d.data()).filter(p => !p.deleted);
      const customers = customerSnap.docs.map(d => d.data());

      // Calculate today's sales
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todaySales = sales.filter(sale => {
        const saleDate = sale.date?.seconds ? new Date(sale.date.seconds * 1000) : new Date(0);
        return saleDate >= today;
      });

      // Calculate growth (compare last 7 days vs previous 7 days)
      const now = new Date();
      const last7Days = new Date(now);
      last7Days.setDate(last7Days.getDate() - 7);
      const previous7Days = new Date(last7Days);
      previous7Days.setDate(previous7Days.getDate() - 7);

      const recentSales = sales.filter(sale => {
        const saleDate = sale.date?.seconds ? new Date(sale.date.seconds * 1000) : new Date(0);
        return saleDate >= last7Days;
      }).reduce((acc, curr) => acc + curr.total, 0);

      const previousSales = sales.filter(sale => {
        const saleDate = sale.date?.seconds ? new Date(sale.date.seconds * 1000) : new Date(0);
        return saleDate >= previous7Days && saleDate < last7Days;
      }).reduce((acc, curr) => acc + curr.total, 0);

      const growth = previousSales > 0 ? ((recentSales - previousSales) / previousSales) * 100 : 0;

      return {
        totalSales: sales.reduce((acc, curr) => acc + curr.total, 0),
        totalDebt: customers.reduce((acc, curr) => acc + (curr.debt || 0), 0),
        lowStockCount: products.filter(p => p.stock < 10).length,
        totalCustomers: customers.length,
        totalProducts: products.length,
        salesToday: todaySales.length,
        revenueGrowth: growth,
        todayRevenue: todaySales.reduce((acc, curr) => acc + curr.total, 0),
        todayDetails: todaySales,
        allProducts: products
      };
    }
  });

  const exportInventoryCSV = () => {
    if (!stats?.allProducts) return;

    const headers = ["Product Name", "Category", "Price", "Stock", "Status"];
    const rows = stats.allProducts.map(p => [
      p.name,
      p.category || "N/A",
      p.price,
      p.stock,
      p.stock < 10 ? "Low Stock" : "In Stock"
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventory_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const cards = [
    { 
      title: "Total Revenue", 
      value: formatCurrency(stats?.totalSales || 0), 
      icon: DollarSign,
      gradient: "from-green-500 to-emerald-600",
      iconBg: "bg-green-100",
      iconColor: "text-green-600",
      description: "Total sales generated"
    },
    { 
      title: "Customer Debts", 
      value: formatCurrency(stats?.totalDebt || 0), 
      icon: AlertCircle,
      gradient: "from-red-500 to-rose-600",
      iconBg: "bg-red-100",
      iconColor: "text-red-600",
      description: "Outstanding payments"
    },
    { 
      title: "Total Customers", 
      value: stats?.totalCustomers || 0, 
      icon: Users,
      gradient: "from-blue-500 to-indigo-600",
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      description: "Active customer base"
    },
    { 
      title: "Low Stock Items", 
      value: stats?.lowStockCount || 0, 
      icon: Package,
      gradient: "from-orange-500 to-amber-600",
      iconBg: "bg-orange-100",
      iconColor: "text-orange-600",
      description: "Needs restocking soon"
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading Business Insights...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <img src="/src/assets/logo.png" alt="Al-Mukhamis" className="w-16 h-16 object-contain" />
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Admin Overview</h1>
          <p className="text-muted-foreground">Welcome back! Here&apos;s what&apos;s happening with your business today.</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, i) => (
          <Card key={i} className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${card.iconBg}`}>
                <card.icon className={`h-5 w-5 ${card.iconColor}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{card.value}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {card.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              Quick Actions
            </CardTitle>
            <CardDescription>Frequently used features and reports</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full justify-start" variant="outline" size="lg" onClick={() => setShowDailyReport(true)}>
              <ShoppingBag className="mr-2 h-4 w-4" />
              View Daily Report
            </Button>
            <Button className="w-full justify-start" variant="outline" size="lg" onClick={exportInventoryCSV}>
              <Package className="mr-2 h-4 w-4" />
              Export Inventory CSV
            </Button>
          </CardContent>
        </Card>

        <Card className="border-2 bg-gradient-to-br from-slate-900 to-slate-800 text-white">
          <CardHeader>
            <CardTitle>Business Performance</CardTitle>
            <CardDescription className="text-slate-300">
              Key metrics at a glance
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-slate-300">Total Products</span>
              <span className="text-2xl font-bold">{stats?.totalProducts || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-300">Sales Today</span>
              <span className="text-2xl font-bold text-green-400">{stats?.salesToday || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-300">Revenue Growth</span>
              <span className={`text-2xl font-bold ${(stats?.revenueGrowth || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {(stats?.revenueGrowth || 0) >= 0 ? '+' : ''}{(stats?.revenueGrowth || 0).toFixed(1)}%
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {showDailyReport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Daily Sales Report</CardTitle>
                <CardDescription>
                  {new Date().toLocaleDateString()} - Total Revenue: ${stats?.todayRevenue?.toFixed(2) || '0.00'}
                </CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowDailyReport(false)}>
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="overflow-auto">
              {stats?.todayDetails?.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.todayDetails.map((sale) => (
                      <TableRow key={sale.id}>
                        <TableCell>
                          {new Date(sale.date.seconds * 1000).toLocaleTimeString()}
                        </TableCell>
                        <TableCell>{sale.customerName}</TableCell>
                        <TableCell>{sale.items.length} items</TableCell>
                        <TableCell>
                          <span className={sale.paymentStatus === 'paid' ? 'text-green-600' : 'text-orange-600'}>
                            {sale.paymentStatus === 'paid' ? 'Paid' : 'Credit'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          ${sale.total.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground py-8">No sales recorded today</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}