import React, { useState } from 'react';
import { Lock, Mail, LogIn, ShieldCheck, RefreshCw } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

const API_BASE = import.meta.env.DEV ? 'http://localhost:8089' : '';

export const LoginView = ({ onLoginSuccess }) => {
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      showToast('Ingresa tu correo y contraseña', 'warning');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.token) {
        localStorage.setItem('docucraft_auth_token', data.token);
        showToast('Sesión iniciada correctamente', 'success');
        onLoginSuccess(data.token, data.email);
      } else {
        showToast(data.error || 'Credenciales incorrectas', 'error');
      }
    } catch (err) {
      showToast('No se pudo conectar con el servidor de autenticación', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-surface dark:bg-slate-950 p-4">
      <div className="w-full max-w-md rounded-3xl bg-surface-container-lowest dark:bg-slate-900 border border-outline-variant/30 dark:border-slate-800 shadow-2xl p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto text-primary">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-headline font-bold text-on-surface">DocuCraft Pro</h1>
          <p className="text-xs text-on-surface-variant">
            Inicia sesión con las credenciales configuradas en tu servidor
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">
              Correo Electrónico
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-outline absolute left-3.5 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@docucraft.com"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-outline-variant/30 bg-surface-container-low text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">
              Contraseña
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-outline absolute left-3.5 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-outline-variant/30 bg-surface-container-low text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-primary hover:bg-primary/90 text-on-primary text-sm font-bold shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <LogIn className="w-4 h-4" />
            )}
            <span>{loading ? 'Verificando...' : 'Ingresar al Panel'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
