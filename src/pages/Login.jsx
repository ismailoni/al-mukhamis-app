import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Lock, Mail, Loader2, ArrowLeft } from "lucide-react";
import toast from "react-hot-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import hero from "../assets/hero.png";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      await login(email, password);
      toast.success("Welcome back, Admin");
      navigate("/admin");
    } catch (error) {
      console.error(error);
      toast.error("Invalid credentials. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:20px_20px]"></div>
      
      <Card className="max-w-md w-full relative z-10 shadow-2xl border-slate-700">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto">
            <img src={hero} alt="Al-Mukhamis" className="w-20 h-20 mx-auto object-contain mb-2" />
          </div>
          <div>
            <CardTitle className="text-3xl">Admin Login</CardTitle>
            <CardDescription className="text-base mt-2">
              Al-Mukhamis Ventures Management System
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 text-muted-foreground w-5 h-5" />
                <Input
                  id="email"
                  type="email"
                  required
                  className="pl-10"
                  placeholder="admin@almukhamis.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 text-muted-foreground w-5 h-5" />
                <Input
                  id="password"
                  type="password"
                  required
                  className="pl-10"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full"
              size="lg"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin mr-2" size={20} /> Authenticating...
                </>
              ) : (
                "Login to Dashboard"
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Button 
              variant="ghost"
              onClick={() => navigate("/")}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Public Website
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}