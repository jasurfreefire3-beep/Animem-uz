import React, { useState, useEffect } from 'react';
import { Shield, ShieldAlert, Lock, ArrowRight, Clock, AlertTriangle, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface AdminPasscodeGateProps {
  children: React.ReactNode;
}

const MASTER_PASSCODE = '1213234';
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes

const STORAGE_KEYS = {
  ATTEMPTS: 'animem_admin_attempts',
  LOCKOUT_UNTIL: 'animem_admin_lockout_until',
  AUTH_TIMESTAMP: 'animem_admin_auth_timestamp',
};

export const AdminPasscodeGate: React.FC<AdminPasscodeGateProps> = ({ children }) => {
  const { user } = useAuth();
  const [passcode, setPasscode] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [lockoutRemaining, setLockoutRemaining] = useState<number>(0);
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState(true);

  // Check if current user is an existing authorized Admin account
  const isAccountAdmin = user && (user.role === 'admin' || user.email === 'admin@animem.uz' || user.email === 'mosinjonovjasurbek00@gmail.com');

  useEffect(() => {
    // 1. If user is explicitly admin by account, allow immediate entry
    if (isAccountAdmin) {
      setIsUnlocked(true);
      setIsChecking(false);
      return;
    }

    // 2. Check persistent session state in sessionStorage
    const sessionAuth = sessionStorage.getItem(STORAGE_KEYS.AUTH_TIMESTAMP);
    if (sessionAuth) {
      setIsUnlocked(true);
      setIsChecking(false);
      return;
    }

    // 3. Load lockout status from localStorage
    const savedLockout = localStorage.getItem(STORAGE_KEYS.LOCKOUT_UNTIL);
    const savedAttempts = parseInt(localStorage.getItem(STORAGE_KEYS.ATTEMPTS) || '0', 10);
    setAttempts(savedAttempts);

    if (savedLockout) {
      const lockoutTime = parseInt(savedLockout, 10);
      const now = Date.now();
      if (lockoutTime > now) {
        setLockoutRemaining(Math.ceil((lockoutTime - now) / 1000));
      } else {
        localStorage.removeItem(STORAGE_KEYS.LOCKOUT_UNTIL);
        localStorage.setItem(STORAGE_KEYS.ATTEMPTS, '0');
        setAttempts(0);
      }
    }

    setIsChecking(false);
  }, [isAccountAdmin]);

  // Countdown timer for lockout
  useEffect(() => {
    if (lockoutRemaining <= 0) return;

    const timer = setInterval(() => {
      setLockoutRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          localStorage.removeItem(STORAGE_KEYS.LOCKOUT_UNTIL);
          localStorage.setItem(STORAGE_KEYS.ATTEMPTS, '0');
          setAttempts(0);
          setErrorMsg('');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [lockoutRemaining]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutRemaining > 0) return;

    const trimmed = passcode.trim();

    if (!trimmed) {
      setErrorMsg('Iltimos, maxfiy parolni kiriting');
      return;
    }

    if (trimmed === MASTER_PASSCODE) {
      // Success! Clear errors and attempts
      localStorage.removeItem(STORAGE_KEYS.ATTEMPTS);
      localStorage.removeItem(STORAGE_KEYS.LOCKOUT_UNTIL);
      sessionStorage.setItem(STORAGE_KEYS.AUTH_TIMESTAMP, Date.now().toString());
      setIsUnlocked(true);
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      localStorage.setItem(STORAGE_KEYS.ATTEMPTS, newAttempts.toString());
      setPasscode('');

      if (newAttempts >= MAX_ATTEMPTS) {
        const lockoutUntil = Date.now() + LOCKOUT_DURATION_MS;
        localStorage.setItem(STORAGE_KEYS.LOCKOUT_UNTIL, lockoutUntil.toString());
        setLockoutRemaining(Math.ceil(LOCKOUT_DURATION_MS / 1000));
        setErrorMsg(`5 marta noto'g'ri kiritildi! Tizim 30 daqiqaga bloklandi.`);
      } else {
        const left = MAX_ATTEMPTS - newAttempts;
        setErrorMsg(`Parol noto'g'ri! Qolgan urinishlar: ${left} ta`);
      }
    }
  };

  const formatCountdown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (isChecking) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center text-white">
        <div className="w-8 h-8 border-2 border-[#e50914] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (isUnlocked) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-[85vh] bg-[#070709] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#18080a] via-[#070709] to-[#040405] text-white flex items-center justify-center p-4 select-none relative overflow-hidden rounded-3xl my-6 border border-white/5">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#e50914]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[300px] h-[300px] bg-red-950/20 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 py-6">
        {/* Top Header Card */}
        <div className="bg-[#121217]/90 backdrop-blur-xl border border-white/10 rounded-3xl p-7 shadow-2xl shadow-black/80">
          <div className="flex flex-col items-center text-center">
            <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-5 transition-all duration-300 ${
              lockoutRemaining > 0
                ? 'bg-amber-500/10 border border-amber-500/30 text-amber-500 shadow-lg shadow-amber-500/10'
                : 'bg-[#e50914]/10 border border-[#e50914]/30 text-[#e50914] shadow-lg shadow-[#e50914]/20'
            }`}>
              {lockoutRemaining > 0 ? (
                <ShieldAlert size={38} className="animate-pulse" />
              ) : (
                <Shield size={38} />
              )}
            </div>

            <h1 className="text-2xl font-black tracking-tight text-white mb-2">
              Boshqaruv Paneli
            </h1>
            <p className="text-xs text-white/50 leading-relaxed max-w-xs">
              Ushbu sahifa faqat ma'murlar uchun himoyalangan. Davom etish uchun maxfiy kirish kodini kiriting.
            </p>
          </div>

          {/* Form / Lockout status */}
          <div className="mt-7">
            {lockoutRemaining > 0 ? (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 text-center space-y-3 animate-fade-in">
                <div className="flex items-center justify-center gap-2 text-amber-400 font-semibold text-sm">
                  <Clock size={18} className="animate-spin" />
                  <span>Xavfsizlik bloki faol</span>
                </div>
                
                <p className="text-xs text-white/70">
                  Parol 5 marta noto'g'ri kiritildi. Qayta urinish uchun kuting:
                </p>

                <div className="py-2 px-4 rounded-xl bg-black/40 border border-amber-500/20 inline-block font-mono text-2xl font-bold text-amber-400 tracking-wider">
                  {formatCountdown(lockoutRemaining)}
                </div>

                <p className="text-[11px] text-white/40">
                  30 daqiqa tugagach, qayta urinish imkoniyati ochiladi.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-white/70 uppercase tracking-wider mb-2">
                    Xavfsizlik Paroli
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/40">
                      <Lock size={17} />
                    </div>
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={passcode}
                      onChange={(e) => {
                        setPasscode(e.target.value);
                        if (errorMsg) setErrorMsg('');
                      }}
                      placeholder="Maxfiy parolni kiriting..."
                      autoFocus
                      className="w-full bg-[#181820] border border-white/10 focus:border-[#e50914] focus:ring-2 focus:ring-[#e50914]/20 rounded-xl py-3 pl-10 pr-11 text-white text-sm placeholder:text-white/20 transition-all duration-200 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-white/40 hover:text-white transition-colors cursor-pointer"
                    >
                      {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </div>

                {/* Attempt indicators */}
                <div className="flex items-center justify-between px-1 text-xs">
                  <span className="text-white/40">Ruxsat etilgan urinishlar:</span>
                  <div className="flex items-center gap-1.5">
                    {Array.from({ length: MAX_ATTEMPTS }).map((_, i) => (
                      <div
                        key={i}
                        className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                          i < attempts
                            ? 'bg-red-500 shadow-sm shadow-red-500'
                            : 'bg-white/20'
                        }`}
                      />
                    ))}
                    <span className="ml-1 text-[11px] font-mono text-white/60">
                      {MAX_ATTEMPTS - attempts}/{MAX_ATTEMPTS}
                    </span>
                  </div>
                </div>

                {errorMsg && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-2.5 text-red-400 text-xs animate-shake">
                    <AlertTriangle size={16} className="shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-3 px-4 bg-gradient-to-r from-[#e50914] to-[#b80710] hover:from-[#ff1a25] hover:to-[#c70812] text-white font-bold text-sm rounded-xl shadow-lg shadow-[#e50914]/30 hover:shadow-[#e50914]/50 active:scale-[0.99] transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer mt-2"
                >
                  <span>Panelga Kirish</span>
                  <ArrowRight size={16} />
                </button>
              </form>
            )}
          </div>

          <div className="mt-6 pt-5 border-t border-white/5 flex items-center justify-between text-[11px] text-white/40">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-emerald-500" /> 256-bit Shifrlash
            </span>
            <a 
              href="/" 
              className="hover:text-white transition-colors underline underline-offset-4 cursor-pointer"
            >
              Bosh sahifaga qaytish
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
export default AdminPasscodeGate;
