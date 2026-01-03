/* eslint-disable react/prop-types */
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LayoutDashboard, Package, Users, Wallet, LogOut, Menu, X, DollarSign, Receipt, TrendingUp } from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";

export default function Layout({ children }) {
  const { logout } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { name: "Dashboard", path: "/admin", icon: LayoutDashboard },
    { name: "Inventory", path: "/admin/inventory", icon: Package },
    { name: "Sales History", path: "/admin/sales", icon: TrendingUp },
    { name: "Invoicing", path: "/admin/invoicing", icon: Receipt },
    { name: "Customers", path: "/admin/customers", icon: Users },
    { name: "Creditors", path: "/admin/creditors", icon: DollarSign },
    { name: "Debtors (Lenders)", path: "/admin/debtors", icon: Wallet },
  ];

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-gradient-to-b from-slate-900 to-slate-800 text-white flex-col border-r border-slate-700">
        <div className="p-6 border-b border-slate-700 flex items-center gap-3">
          <img src="/src/assets/logo.png" alt="Al-Mukhamis" className="w-12 h-12 object-contain" />
          <div>
            <h1 className="text-lg font-bold bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">
              Al-Mukhamis
            </h1>
            <p className="text-xs text-slate-400">Ventures</p>
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-200 ${
                  isActive 
                    ? 'bg-blue-600 text-white shadow-lg scale-105' 
                    : 'hover:bg-slate-700/50 text-slate-300 hover:text-white'
                }`}
              >
                <Icon size={20} />
                <span className="font-medium">{item.name}</span>
              </Link>
            );
          })}
        </nav>
        
        <div className="p-4 border-t border-slate-700">
          <Button 
            onClick={logout} 
            variant="ghost"
            className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-950/30"
          >
            <LogOut size={20} className="mr-3" /> Logout
          </Button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 bg-slate-900 text-white p-4 flex items-center justify-between z-50 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <img src="/src/assets/logo.png" alt="Al-Mukhamis" className="w-10 h-10 object-contain" />
          <h1 className="text-lg font-bold">Al-Mukhamis</h1>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="text-white"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </Button>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 bg-slate-900 z-40 pt-16">
          <nav className="p-4 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 p-4 rounded-lg ${
                    isActive 
                      ? 'bg-blue-600 text-white' 
                      : 'text-slate-300 hover:bg-slate-700/50'
                  }`}
                >
                  <Icon size={20} />
                  <span className="font-medium">{item.name}</span>
                </Link>
              );
            })}
            <Button 
              onClick={() => { logout(); setIsMobileMenuOpen(false); }} 
              variant="ghost"
              className="w-full justify-start text-red-400 hover:text-red-300 mt-4"
            >
              <LogOut size={20} className="mr-3" /> Logout
            </Button>
          </nav>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-auto md:p-8 p-4 pt-20 md:pt-8">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}