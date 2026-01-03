import { Link } from "react-router-dom";
import { Phone, MessageCircle, MapPin, List, Lock, Sparkles, ShoppingBag, ArrowRight, CheckCircle2, Truck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";

export default function Home() {
  const businessData = {
    name: "Al-Mukhamis Ventures",
    description: "Your trusted partner for bulk and retail trading of high-quality soaps, detergents, and general provisions.",
    phone: "+2347043278472",
    whatsapp: "2347043278472",
    address: "Main Market, Lagos, Nigeria"
  };

  return (
    <div className="min-h-screen bg-[#fafafa] text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Hero Section */}
      <header className="relative bg-[#0f172a] py-24 px-6 overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] rounded-full bg-blue-600/20 blur-[120px]" />
          <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] rounded-full bg-indigo-600/10 blur-[120px]" />
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 backdrop-blur-md rounded-full px-4 py-1.5 mb-8 animate-bounce-subtle">
            <Sparkles className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-medium text-blue-100 tracking-wide uppercase">Premium Wholesale Trading</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-black mb-6 tracking-tight text-white">
            {businessData.name}
          </h1>
          
          <p className="text-slate-400 max-w-2xl mx-auto text-lg md:text-xl leading-relaxed mb-10">
            {businessData.description}
          </p>

          <div className="flex flex-wrap justify-center gap-4">
            <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white px-8 rounded-full shadow-lg shadow-blue-500/20 transition-all hover:scale-105">
              Get Started
            </Button>
            <Link to="/prices">
                <Button size="lg" variant="outline" className="border-white/20 hover:bg-white/10 rounded-full backdrop-blur-sm">
                View Catalog
                </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto -mt-12 pb-20 px-6 relative z-20">
        
        {/* Primary CTA Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          <Link to="/prices" className="group">
            <Card className="h-full border-none bg-white shadow-xl shadow-slate-200/50 hover:shadow-blue-500/10 transition-all duration-500 overflow-hidden ring-1 ring-slate-200 hover:ring-blue-500">
              <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
                <List className="w-32 h-32 text-slate-900" />
              </div>
              <CardHeader className="p-8">
                <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-200 group-hover:rotate-6 transition-transform">
                  <List className="w-7 h-7 text-white" />
                </div>
                <CardTitle className="text-3xl font-bold text-slate-800">Live Price List</CardTitle>
                <CardDescription className="text-lg text-slate-500 mt-2">
                  Stay updated with our daily wholesale rates and stock availability.
                </CardDescription>
                <div className="pt-6 flex items-center text-blue-600 font-semibold gap-2 group-hover:gap-4 transition-all">
                  Browse Catalog <ArrowRight className="w-5 h-5" />
                </div>
              </CardHeader>
            </Card>
          </Link>

          <a href={`https://wa.me/${businessData.whatsapp}`} target="_blank" rel="noreferrer" className="group">
            <Card className="h-full border-none bg-emerald-600 shadow-xl shadow-emerald-200/50 hover:shadow-emerald-500/20 transition-all duration-500 overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                <MessageCircle className="w-32 h-32 text-white" />
              </div>
              <CardHeader className="p-8">
                <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-6 border border-white/30">
                  <MessageCircle className="w-7 h-7 text-white" />
                </div>
                <CardTitle className="text-3xl font-bold text-white">Instant Ordering</CardTitle>
                <CardDescription className="text-lg text-emerald-50 mt-2">
                  Send your list directly to our sales team via WhatsApp.
                </CardDescription>
                <div className="pt-6 flex items-center text-white font-semibold gap-2">
                  Chat Now <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
                </div>
              </CardHeader>
            </Card>
          </a>
        </div>

        {/* Value Propositions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
          {[
            { icon: CheckCircle2, title: "Certified Quality", desc: "Sourced from top manufacturers", color: "text-blue-500" },
            { icon: ShoppingBag, title: "Bulk & Retail", desc: "Flexible quantities for every buyer", color: "text-purple-500" },
            { icon: Truck, title: "Fast Logistics", desc: "Reliable delivery across Lagos", color: "text-orange-500" }
          ].map((feature, i) => (
            <div key={i} className="flex flex-col items-center text-center p-6 rounded-3xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
              <div className={`mb-4 p-3 rounded-2xl bg-slate-50 ${feature.color}`}>
                <feature.icon className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">{feature.title}</h3>
              <p className="text-slate-500">{feature.desc}</p>
            </div>
          ))}
        </div>

        {/* Contact Info Card */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
             <Card className="border-none shadow-xl bg-white overflow-hidden">
                <CardHeader className="bg-slate-50 border-b border-slate-100 p-8">
                  <CardTitle className="text-2xl font-bold">Visit Our Office</CardTitle>
                  <CardDescription> We&apos;re open Monday - Saturday, 8am to 6pm</CardDescription>
                </CardHeader>
                <CardContent className="p-8 grid md:grid-cols-2 gap-6">
                  <div className="flex items-start gap-5 group">
                    <div className="p-4 bg-blue-50 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300">
                      <Phone className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Phone Number</p>
                      <p className="text-xl font-bold text-slate-800">{businessData.phone}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-5 group">
                    <div className="p-4 bg-rose-50 rounded-2xl group-hover:bg-rose-600 group-hover:text-white transition-colors duration-300">
                      <MapPin className="w-6 h-6 text-rose-600 group-hover:text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Location</p>
                      <p className="text-xl font-bold text-slate-800">{businessData.address}</p>
                    </div>
                  </div>
                </CardContent>
             </Card>
          </div>
          
          <div className="bg-slate-900 rounded-3xl p-8 text-white flex flex-col justify-center items-center text-center">
            <h3 className="text-2xl font-bold mb-4">Need Help?</h3>
            <p className="text-slate-400 mb-8">Not sure what you need? Talk to our product experts.</p>
            <Button className="w-full bg-white text-slate-900 hover:bg-slate-200 font-bold py-6 rounded-2xl transition-all">
              Contact Support
            </Button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-12 text-center bg-white border-t border-slate-100">
        <div className="mb-6">
           <p className="text-slate-400 text-sm">© {new Date().getFullYear()} {businessData.name}. All rights reserved.</p>
        </div>
        <Link to="/login">
          <Button variant="ghost" size="sm" className="gap-2 text-slate-400 hover:text-slate-900">
            <Lock className="w-3 h-3" /> Staff Login
          </Button>
        </Link>
      </footer>

      {/* Tailwind Custom Animation (Add to tailwind.config.js if possible) */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes bounce-subtle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        .animate-bounce-subtle {
          animation: bounce-subtle 3s ease-in-out infinite;
        }
      `}} />
    </div>
  );
}