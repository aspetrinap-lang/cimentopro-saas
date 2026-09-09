import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Factory, Mail, Lock, Loader2, ArrowLeft, KeyRound, User } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("menu");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGoogle = () => {
    base44.auth.loginWithProvider("google", "/");
  };

  const handleEmail = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await base44.auth.loginViaEmailPassword(email, password);
      window.location.href = "/";
    } catch (err) {
      setError(err.message || "E-mail ou senha inválidos");
      setLoading(false);
    }
  };

  const handlePin = async () => {
    setError("");
    try {
      const authed = await base44.auth.isAuthenticated();
      if (authed) {
        navigate("/pin-login");
      } else {
        setError("Faça o primeiro acesso com Google ou E-mail neste dispositivo para liberar o login por PIN dos operadores.");
      }
    } catch {
      setError("Faça o primeiro acesso com Google ou E-mail neste dispositivo para liberar o login por PIN dos operadores.");
    }
  };

  return (
    <AuthLayout
      icon={Factory}
      title="CimentoPro"
      subtitle="Monitoramento inteligente de produção"
    >
      {mode === "menu" && (
        <div className="space-y-3">
          <Button variant="outline" className="w-full h-12 text-sm font-medium" onClick={handleGoogle}>
            <GoogleIcon className="w-5 h-5 mr-2" /> Entrar com Google
          </Button>
          <Button variant="outline" className="w-full h-12 text-sm font-medium" onClick={() => { setMode("email"); setError(""); }}>
            <Mail className="w-4 h-4 mr-2" /> Entrar com E-mail
          </Button>
          <Button variant="outline" className="w-full h-12 text-sm font-medium" onClick={() => { setMode("pin"); setError(""); }}>
            <KeyRound className="w-4 h-4 mr-2" /> Entrar com PIN
          </Button>
          {error && (
            <div className="mt-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs leading-relaxed">{error}</div>
          )}
          <p className="text-center text-xs text-muted-foreground pt-2">
            Não tem conta?{" "}
            <Link to="/register" className="text-primary font-medium hover:underline">Criar conta</Link>
          </p>
        </div>
      )}

      {mode === "email" && (
        <div className="space-y-4">
          <button onClick={() => { setMode("menu"); setError(""); }} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar
          </button>
          {error && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}
          <form onSubmit={handleEmail} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="email" type="email" autoFocus placeholder="voce@empresa.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 h-12" required />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Senha</Label>
                <Link to="/forgot-password" className="text-xs text-primary hover:underline">Esqueceu a senha?</Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 h-12" required />
              </div>
            </div>
            <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
              {loading ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Entrando...</>) : "Entrar"}
            </Button>
          </form>
        </div>
      )}

      {mode === "pin" && (
        <div className="space-y-4">
          <button onClick={() => { setMode("menu"); setError(""); }} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar
          </button>
          <div className="text-center py-4">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-3">
              <KeyRound className="w-7 h-7 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              O login por PIN é usado por operadores em dispositivos já configurados por um administrador. O administrador cadastra os operadores em <strong>Configurações → Operadores</strong>.
            </p>
          </div>
          {error && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}
          <Button className="w-full h-12 font-medium" onClick={handlePin}>
            <User className="w-4 h-4 mr-2" /> Selecionar Operador
          </Button>
        </div>
      )}
    </AuthLayout>
  );
}