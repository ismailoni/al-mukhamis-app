import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../lib/firebase";
import { formatCurrency } from "../lib/utils";
import { Filter, Receipt, Eye } from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";

export default function Sales() {
  const [filterPeriod, setFilterPeriod] = useState("all");
  const [filterCustomer, setFilterCustomer] = useState("");
  const [filterMinAmount, setFilterMinAmount] = useState("");
  const [filterMaxAmount, setFilterMaxAmount] = useState("");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [selectedSale, setSelectedSale] = useState(null);

  const { data: sales, isLoading } = useQuery({
    queryKey: ["sales"],
    queryFn: async () => {
      const q = query(collection(db, "sales"), orderBy("date", "desc"));
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    },
  });

  const getDateRange = (period) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (period) {
      case "today":
        return { start: today, end: new Date() };
      case "week": {
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return { start: weekAgo, end: new Date() };
      }
      case "month": {
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        return { start: monthAgo, end: new Date() };
      }
      case "year": {
        const yearAgo = new Date(today);
        yearAgo.setFullYear(yearAgo.getFullYear() - 1);
        return { start: yearAgo, end: new Date() };
      }
      default:
        return null;
    }
  };

  const filteredSales = useMemo(() => {
    if (!sales) return [];

    const startDate = filterStartDate ? new Date(filterStartDate) : null;
    const endDate = filterEndDate ? new Date(filterEndDate) : null;
    if (endDate) {
      endDate.setHours(23, 59, 59, 999);
    }

    return sales.filter((sale) => {
      const saleDate = sale.date?.seconds
        ? new Date(sale.date.seconds * 1000)
        : new Date();

      if (filterPeriod !== "all") {
        const range = getDateRange(filterPeriod);
        if (range && (saleDate < range.start || saleDate > range.end)) {
          return false;
        }
      }

      if (startDate && saleDate < startDate) return false;
      if (endDate && saleDate > endDate) return false;

      if (
        filterCustomer &&
        !sale.customerName?.toLowerCase().includes(filterCustomer.toLowerCase())
      ) {
        return false;
      }

      if (filterMinAmount && sale.total < Number(filterMinAmount)) {
        return false;
      }
      if (filterMaxAmount && sale.total > Number(filterMaxAmount)) {
        return false;
      }

      return true;
    });
  }, [
    sales,
    filterPeriod,
    filterCustomer,
    filterMinAmount,
    filterMaxAmount,
    filterStartDate,
    filterEndDate,
  ]);

  const stats = useMemo(() => {
    if (!filteredSales.length) return { total: 0, count: 0, avgSale: 0 };

    const total = filteredSales.reduce((sum, sale) => sum + sale.total, 0);
    const count = filteredSales.length;
    const avgSale = total / count;

    return { total, count, avgSale };
  }, [filteredSales]);

  const groupedSales = useMemo(() => {
    const groups = {
      today: [],
      thisWeek: [],
      thisMonth: [],
      thisYear: [],
      older: [],
    };

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    const yearAgo = new Date(today);
    yearAgo.setFullYear(yearAgo.getFullYear() - 1);

    filteredSales.forEach((sale) => {
      const saleDate = sale.date?.seconds
        ? new Date(sale.date.seconds * 1000)
        : new Date();

      if (saleDate >= today) {
        groups.today.push(sale);
      } else if (saleDate >= weekAgo) {
        groups.thisWeek.push(sale);
      } else if (saleDate >= monthAgo) {
        groups.thisMonth.push(sale);
      } else if (saleDate >= yearAgo) {
        groups.thisYear.push(sale);
      } else {
        groups.older.push(sale);
      }
    });

    return groups;
  }, [filteredSales]);

  /* eslint-disable react/prop-types */
  const SaleRow = ({ sale }) => {
    const saleDate = sale.date?.seconds
      ? new Date(sale.date.seconds * 1000)
      : new Date();

    return (
      <TableRow>
        <TableCell className="font-medium">
          {saleDate.toLocaleDateString()}
          <div className="text-xs text-muted-foreground">
            {saleDate.toLocaleTimeString()}
          </div>
        </TableCell>
        <TableCell>{sale.customerName || "N/A"}</TableCell>
        <TableCell>
          <Badge variant="secondary">{sale.items?.length || 0} items</Badge>
        </TableCell>
        <TableCell className="font-semibold">
          {formatCurrency(sale.total)}
        </TableCell>
        <TableCell>
          {sale.balance > 0 ? (
            <Badge variant="warning">{formatCurrency(sale.balance)}</Badge>
          ) : (
            <Badge variant="success">Paid</Badge>
          )}
        </TableCell>
        <TableCell className="text-right">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSelectedSale(sale)}
          >
            <Eye className="w-4 h-4" />
          </Button>
        </TableCell>
      </TableRow>
    );
  };

  /* eslint-disable react/prop-types */
  const SaleGroup = ({ title, sales }) => {
    if (!sales.length) return null;

    return (
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-muted-foreground">{title}</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date & Time</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sales.map((sale) => (
              <SaleRow key={sale.id} sale={sale} />
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Sales History</h1>
        <p className="text-muted-foreground mt-1">
          View and filter all sales transactions
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Sales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.total)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Transaction Count
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.count}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Average Sale
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.avgSale)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Time Period</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={filterPeriod}
                onChange={(e) => setFilterPeriod(e.target.value)}
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
                <option value="year">Last Year</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Customer Name</Label>
              <Input
                placeholder="Search customer..."
                value={filterCustomer}
                onChange={(e) => setFilterCustomer(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Min Amount (₦)</Label>
              <Input
                type="number"
                placeholder="0"
                value={filterMinAmount}
                onChange={(e) => setFilterMinAmount(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Max Amount (₦)</Label>
              <Input
                type="number"
                placeholder="∞"
                value={filterMaxAmount}
                onChange={(e) => setFilterMaxAmount(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setFilterPeriod("all");
                setFilterCustomer("");
                setFilterMinAmount("");
                setFilterMaxAmount("");
                  setFilterStartDate("");
                  setFilterEndDate("");
              }}
            >
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sales List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            Transactions
          </CardTitle>
          <CardDescription>
            {filteredSales.length} sale(s) found
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {isLoading ? (
            <p className="text-muted-foreground text-center py-8">Loading sales...</p>
          ) : filteredSales.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No sales found matching filters
            </p>
          ) : (
            <>
              <SaleGroup title="Today" sales={groupedSales.today} />
              <SaleGroup title="This Week" sales={groupedSales.thisWeek} />
              <SaleGroup title="This Month" sales={groupedSales.thisMonth} />
              <SaleGroup title="This Year" sales={groupedSales.thisYear} />
              <SaleGroup title="Older" sales={groupedSales.older} />
            </>
          )}
        </CardContent>
      </Card>

      {/* Sale Details Modal */}
      {selectedSale && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <CardTitle>Sale Details</CardTitle>
              <CardDescription>
                {selectedSale.date?.seconds
                  ? new Date(selectedSale.date.seconds * 1000).toLocaleString()
                  : "N/A"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Customer</Label>
                  <p className="font-medium">{selectedSale.customerName}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Total Amount</Label>
                  <p className="font-medium">{formatCurrency(selectedSale.total)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Amount Paid</Label>
                  <p className="font-medium">{formatCurrency(selectedSale.paid)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Balance</Label>
                  <p className="font-medium">
                    {selectedSale.balance > 0 ? (
                      <span className="text-amber-600">{formatCurrency(selectedSale.balance)}</span>
                    ) : (
                      <span className="text-green-600">Fully Paid</span>
                    )}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground">Items Purchased</Label>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedSale.items?.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{item.name}</TableCell>
                        <TableCell>{item.qty}{item.saleModeName ? ` ${item.saleModeName}(s)` : ""}</TableCell>
                        <TableCell>{formatCurrency(item.price)}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(item.price * item.qty)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setSelectedSale(null)}>
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
