import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import foodtechLogo from "@/assets/foodtech-logo.png";
export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getSession().then(({
      data: {
        session
      }
    }) => {
      if (session) {
        navigate("/");
      }
    });
  }, [navigate]);
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const {
        data,
        error
      } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (error) {
        if (error.message.includes("fetch") || error.message.includes("Failed to fetch")) {
          throw new Error("Не вдається підключитися до сервера. Перевірте інтернет-з'єднання.");
        }
        throw error;
      }
      if (data.session) {
        toast({
          title: "Успіх",
          description: "Ви успішно увійшли в систему"
        });
        navigate("/");
      }
    } catch (error: any) {
      toast({
        title: "Помилка входу",
        description: error.message || "Невірний email або пароль",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  return <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-100 to-slate-200 p-4">
      <Card className="w-full max-w-md shadow-lg border-0">
        <CardHeader className="text-center space-y-4 pb-2">
          <div className="flex justify-center">
            <img src={foodtechLogo} alt="FoodTech Logo" className="h-16" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">FOODTECH Automation</h1>
            <p className="text-primary mt-1">Увійдіть в систему</p>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Електронна пошта</Label>
              <Input id="email" type="email" placeholder="Ваша пошта" value={email} onChange={e => setEmail(e.target.value)} required className="border-slate-300" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Пароль</Label>
              <Input id="password" type="password" placeholder="Введіть ваш пароль" value={password} onChange={e => setPassword(e.target.value)} required className="border-slate-300" />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Вхід...
                </> : "Увійти"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>;
}