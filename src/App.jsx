import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./context/AuthContext";
import { Toaster } from "react-hot-toast";

// Pages
import Home from "./pages/Home";
import Login from "./pages/Login";
import PriceList from "./pages/PriceList";
import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import Sales from "./pages/Sales";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import Customers from "./pages/Customers";
import Debtors from "./pages/Debtors";
import Creditors from "./pages/Creditors";
import Invoicing from "./pages/Invoicing";

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Toaster position="top-right" />
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Home />} />
            <Route path="/prices" element={<PriceList />} />
            <Route path="/login" element={<Login />} />

            {/* Admin Routes */}
            <Route path="/admin/*" element={
              <ProtectedRoute>
                <Layout>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="inventory" element={<Inventory />} />
                    <Route path="sales" element={<Sales />} />
                    <Route path="invoicing" element={<Invoicing />} />
                    <Route path="customers" element={<Customers />} />
                    <Route path="creditors" element={<Creditors />} />
                    <Route path="debtors" element={<Debtors />} />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            } />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}