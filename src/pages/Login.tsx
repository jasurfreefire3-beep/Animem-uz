import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogIn, Mail, Lock, Phone, User, X, Loader2, Send, ArrowLeft, KeyRound, CheckCircle2, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import ReCAPTCHA from 'react-google-recaptcha';
import { signInWithPopup, signInWithRedirect, getRedirectResult, RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth';
import { auth, googleProvider, facebookAuth, facebookProvider } from '../lib/firebase';
import TelegramAuthModal from '../components/TelegramAuthModal';

declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier;
    confirmationResult?: ConfirmationResult;
  }
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string>('');
  const [captchaError, setCaptchaError] = useState<string>('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const [loginMethod, setLoginMethod] = useState<'email' | 'phone'>('email');
  const [phone, setPhone] = useState('');
  const [forgotMethod, setForgotMethod] = useState<'email' | 'phone'>('email');
  const [resetPhone, setResetPhone] = useState('');
  const [firebaseUid, setFirebaseUid] = useState('');

  // Forgot password flow states
  const [viewMode, setViewMode] = useState<'login' | 'forgot_email' | 'forgot_code' | 'forgot_password'>('login');
  
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [resetSuccessMsg, setResetSuccessMsg] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  // Check for Google Auth redirect result
  useEffect(() => {
    let isMounted = true;
    getRedirectResult(auth)
      .then(async (result) => {
        if (!result || !isMounted) return;
        const user = result.user;
        const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
        const res = await fetch(`${API_BASE}/api/auth/google`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            email: user.email, 
            name: user.displayName || 'Google User', 
            uid: user.uid,
            avatar_url: user.photoURL
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Google login failed');
        }

        login(data.token, data.user);
        navigate('/');
      })
      .catch((err: any) => {
        if (!isMounted) return;
        console.error("Redirect auth error:", err);
        if (err.code === 'auth/unauthorized-domain') {
          setError(
            `Google tizimiga kirish xatosi (unauthorized domain): Ushbu domen Firebase ruxsat etilgan domenlar ro'yxatida yo'q.`
          );
        } else if (err.code !== 'auth/popup-closed-by-user') {
          setError(err.message || 'Google orqali kirishda xatolik');
        }
      });

    return () => { isMounted = false; };
  }, [login, navigate]);

  // Telegram Login State
  const [showTelegramModal, setShowTelegramModal] = useState(false);

  // Listen for OAuth popup callbacks & handle Telegram OpenID redirect query params
  useEffect(() => {
    // Check if redirected from Telegram OpenID Connect
    const urlParams = new URLSearchParams(window.location.search);
    const tgCode = urlParams.get('code');
    if (tgCode && window.location.pathname === '/login') {
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
      
      setLoading(true);
      fetch('/api/auth/telegram/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: tgCode,
          redirect_uri: window.location.origin + '/login'
        })
      })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.token && data.user) {
          login(data.token, data.user);
          navigate('/');
        } else {
          setError(data.error || "Telegram orqali kirishda xatolik yuz berdi");
        }
      })
      .catch(err => {
        setError(err.message || "Telegram orqali kirishda xatolik");
      })
      .finally(() => setLoading(false));
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      if (event.data?.type === 'YANDEX_AUTH_SUCCESS' || event.data?.type === 'DISCORD_AUTH_SUCCESS' || event.data?.type === 'TELEGRAM_AUTH_SUCCESS') {
        const { token: userToken, user: authUser } = event.data;
        if (userToken && authUser) {
          login(userToken, authUser);
          navigate('/');
        }
      } else if (event.data?.type === 'YANDEX_AUTH_ERROR') {
        setError(event.data.error || 'Yandex avtorizatsiyasida xatolik yuz berdi');
      } else if (event.data?.type === 'DISCORD_AUTH_ERROR') {
        setError(event.data.error || 'Discord avtorizatsiyasida xatolik yuz berdi');
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [login, navigate]);

  const handleYandexLoginStart = async () => {
    try {
      setError('');
      const res = await fetch('/api/auth/yandex/url');
      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('Yandex avtorizatsiya havolasini olib bo\'lmadi');
      }
    } catch (err: any) {
      setError(err.message || 'Yandex orqali kirishda xatolik');
    }
  };

  const handleDiscordLoginStart = async () => {
    try {
      setError('');
      const res = await fetch('/api/auth/discord/url');
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || 'Discord avtorizatsiya havolasi olinmadi');

      window.location.href = data.url;
    } catch (err: any) {
      setError(err.message || 'Discord orqali kirishda xatolik');
    }
  };

  const handleTelegramLoginStart = () => {
    setError('');
    setShowTelegramModal(true);
  };

  const formatPhone = (input: string) => {
    let digits = input.replace(/\D/g, '');
    if (!digits.startsWith('998') && digits.length <= 9) {
      digits = '998' + digits;
    }
    return '+' + digits;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!captchaToken) {
      setError('Iltimos, robot emasligingizni tasdiqlang!');
      return;
    }
    setLoading(true);

    try {
      if (loginMethod === 'email') {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, captchaToken }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Email yoki parol xato!');
        }

        login(data.token, data.user);
        navigate('/');
      } else {
        // Phone login
        const formatted = formatPhone(phone);
        const res = await fetch('/api/auth/phone-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: formatted, password, captchaToken }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Telefon raqam yoki parol xato!');
        }

        login(data.token, data.user);
        navigate('/');
      }
    } catch (err: any) {
      setError(err.message || 'Kirishda xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setError('');
      googleProvider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, googleProvider);

      if (!result || !result.user) {
        throw new Error('Google foydalanuvchi ma\'lumotlari olinmadi');
      }

      const user = result.user;
      const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
      const res = await fetch(`${API_BASE}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          name: user.displayName || 'Google User',
          uid: user.uid,
          avatar_url: user.photoURL,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Google login failed');
      }

      login(data.token, data.user);
      navigate('/');
    } catch (err: any) {
      console.error('Google login popup error:', err);
      setError(err.message || 'Google orqali kirishda xatolik');
    }
  };

  const handleFacebookLogin = async () => {
    try {
      setError('');
      const result = await signInWithPopup(facebookAuth, facebookProvider);

      if (!result || !result.user) {
        throw new Error('Facebook foydalanuvchi ma\'lumotlari olinmadi');
      }

      const user = result.user;
      const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
      const res = await fetch(`${API_BASE}/api/auth/facebook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          name: user.displayName || 'Facebook User',
          uid: user.uid,
          avatar_url: user.photoURL,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Facebook login failed');
      }

      login(data.token, data.user);
      navigate('/');
    } catch (err: any) {
      console.error('Facebook login popup error:', err);
      if (err.code === 'auth/account-exists-with-different-credential') {
        setError('Bu email bilan boshqa usulda ro\'yxatdan o\'tilgan. Google yoki email orqali kiring.');
      } else if (err.code !== 'auth/popup-closed-by-user') {
        setError(err.message || 'Facebook orqali kirishda xatolik');
      }
    }
  };

  // --- FORGOT PASSWORD HANDLERS ---
  const handleForgotSendEmailCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResetSuccessMsg('');

    if (!resetEmail || !resetEmail.includes('@')) {
      setError('Iltimos, yaroqli email manzilini kiriting!');
      return;
    }

    setForgotLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password-send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail, captchaToken }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Kodni yuborishda xatolik');
      }

      if (data.devCode) {
        setResetCode(data.devCode);
      }

      setResetSuccessMsg(data.message || 'Parolni tiklash kodi emailga yuborildi!');
      setViewMode('forgot_code');
    } catch (err: any) {
      setError(err.message || 'Kodni yuborishda xatolik');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleForgotSendPhoneCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResetSuccessMsg('');

    const formatted = formatPhone(resetPhone);
    if (formatted.length < 12) {
      setError('Iltimos, to\'g\'ri telefon raqamini kiriting! (masalan: 901234567)');
      return;
    }

    setForgotLoading(true);
    try {
      // Try Firebase Recaptcha & Phone Auth
      try {
        if (!window.recaptchaVerifier) {
          window.recaptchaVerifier = new RecaptchaVerifier(auth, 'login-recaptcha-container', {
            size: 'invisible',
            callback: () => {},
          });
        }
        const appVerifier = window.recaptchaVerifier;
        const confirmationResult = await signInWithPhoneNumber(auth, formatted, appVerifier);
        window.confirmationResult = confirmationResult;
      } catch (fbErr: any) {
        console.warn("Firebase Phone Auth attempt:", fbErr?.message || fbErr);
      }

      const res = await fetch('/api/auth/phone-send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: formatted, type: 'forgot' }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'SMS kod yuborishda xatolik');
      }

      if (data.devCode) {
        setResetCode(data.devCode);
      }

      setResetSuccessMsg(data.message || `SMS tasdiqlash kodi ${formatted} raqamiga yuborildi!`);
      setViewMode('forgot_code');
    } catch (err: any) {
      setError(err.message || 'SMS kod yuborishda xatolik');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleForgotVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!resetCode || resetCode.trim().length !== 6) {
      setError('Iltimos, 6 xonali tasdiqlash kodini kiriting!');
      return;
    }

    setForgotLoading(true);
    try {
      if (forgotMethod === 'phone') {
        const formatted = formatPhone(resetPhone);

        if (window.confirmationResult) {
          try {
            const result = await window.confirmationResult.confirm(resetCode);
            if (result && result.user) {
              setFirebaseUid(result.user.uid);
            }
          } catch (fbErr: any) {
            console.warn("Firebase confirm error:", fbErr?.message);
          }
        }

        const res = await fetch('/api/auth/phone-verify-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: formatted, code: resetCode, type: 'forgot' }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Kodni tekshirishda xatolik');
        }
      } else {
        const res = await fetch('/api/auth/forgot-password-verify-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: resetEmail, code: resetCode }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Kodni tekshirishda xatolik');
        }
      }

      setResetSuccessMsg("Tasdiqlash kodi to'g'ri! Endi yangi parolingizni kiriting.");
      setViewMode('forgot_password');
    } catch (err: any) {
      setError(err.message || 'Tasdiqlash kodi xato');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleForgotResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!newPassword || newPassword.length < 6) {
      setError("Yangi parol kamida 6 ta belgidan iborat bo'lishi kerak!");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError("Kiritilgan parollar bir-biriga mos kelmadi!");
      return;
    }

    setForgotLoading(true);
    try {
      if (forgotMethod === 'phone') {
        const formatted = formatPhone(resetPhone);
        const res = await fetch('/api/auth/phone-reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: formatted,
            code: resetCode,
            newPassword,
            firebaseUid
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Parolni tiklashda xatolik');
        }

        login(data.token, data.user);
        navigate('/');
      } else {
        const res = await fetch('/api/auth/forgot-password-reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: resetEmail, code: resetCode, newPassword }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Parolni tiklashda xatolik');
        }

        login(data.token, data.user);
        navigate('/');
      }
    } catch (err: any) {
      setError(err.message || 'Parolni tiklashda xatolik');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div id="login-recaptcha-container"></div>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-[#111] border border-[#222] rounded-md p-6 sm:p-8 shadow-2xl relative"
      >
        {/* Header Logo */}
        <div className="text-center mb-6">
          <div className="relative w-16 h-16 mx-auto mb-3">
            <img 
              src="https://s3.devspace.uz/tirikchilik/local/avatar/14265509_206448_avatar.jpeg" 
              alt="Animem.uz Logo" 
              className="w-16 h-16 rounded-full object-cover border-2 border-[#ff006a] shadow-[0_0_20px_rgba(255,0,106,0.5)]"
            />
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">
            {viewMode === 'login' && 'Tizimga kirish'}
            {viewMode === 'forgot_email' && 'Email orqali tiklash'}
            {viewMode === 'forgot_code' && 'Tasdiqlash kodi'}
            {viewMode === 'forgot_password' && 'Yangi parol'}
          </h1>
          <p className="text-white/50 text-xs sm:text-sm mt-1">
            {viewMode === 'login' && 'Animem.uz akkauntingizga kiring'}
            {viewMode === 'forgot_email' && 'Akkuntingizga ulangan emailni kiriting'}
            {viewMode === 'forgot_code' && 'Yuborilgan 6 xonali tasdiqlash kodini kiriting'}
            {viewMode === 'forgot_password' && "Akkauntingiz uchun yangi xavfsiz parol o'rnating"}
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold p-3 rounded-sm mb-5 text-center leading-relaxed">
            {error}
          </div>
        )}

        {resetSuccessMsg && (
          <div className="bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold p-3 rounded-sm mb-5 text-center leading-relaxed">
            {resetSuccessMsg}
          </div>
        )}

        {/* ------------------- NORMAL LOGIN FORM ------------------- */}
        {viewMode === 'login' && (
          <>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-white/50 mb-1.5 uppercase">Email</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-white/30" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#000] border border-[#222] rounded-sm pl-10 pr-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-[#ff006a]/50 transition-colors text-sm"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-bold text-white/50 uppercase">Parol</label>
                  <button
                    type="button"
                    onClick={() => {
                      setViewMode('forgot_email');
                      setError('');
                      setResetSuccessMsg('');
                    }}
                    className="text-xs font-bold text-[#ff006a] hover:text-[#d40058] transition-colors cursor-pointer"
                  >
                    Parolni unutdingizmi?
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-white/30" />
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[#000] border border-[#222] rounded-sm pl-10 pr-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-[#ff006a]/50 transition-colors text-sm"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="flex justify-center mb-4">
                    {captchaError && (
          <div className="p-3 mb-4 text-sm text-red-900 bg-red-100 border border-red-300 rounded-lg">
            <b>{captchaError}</b>
          </div>
        )}
        <ReCAPTCHA
  sitekey="6LdADY8tAAAAAJeHBsf1HLV-ArmkHgRNvQgZfClP"
  onChange={(token) => setCaptchaToken(token || '')}
  onExpired={() => setCaptchaToken('')}
  onErrored={() => setCaptchaError('ReCAPTCHA xatosi')}
  theme="dark"
/>
                  </div>
                  <button
                    type="submit"
                    disabled={loading || !captchaToken}
                    className="w-full bg-[#ff006a] hover:bg-[#d40058] disabled:bg-[#ff006a]/50 text-white font-bold py-3 px-4 rounded-sm transition-colors mt-6 uppercase text-xs tracking-wider cursor-pointer flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Kirilmoqda...
                  </>
                ) : (
                  'Kirish'
                )}
              </button>
            </form>

            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#222]"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase tracking-widest font-bold">
                  <span className="bg-[#111] px-2 text-white/40">yoki</span>
                </div>
              </div>
              
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="w-full bg-white text-black hover:bg-gray-100 font-bold py-3 px-4 rounded-sm transition-colors mt-6 flex items-center justify-center gap-3 cursor-pointer"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Google bilan kirish
              </button>

              <button
                type="button"
                onClick={handleFacebookLogin}
                className="w-full bg-[#1877F2] hover:bg-[#145fc4] text-white font-bold py-3 px-4 rounded-sm transition-colors mt-3 flex items-center justify-center gap-3 cursor-pointer"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                  <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047v-2.66c0-3.026 1.792-4.697 4.533-4.697 1.313 0 2.686.235 2.686.235v2.971H15.83c-1.491 0-1.956.93-1.956 1.886v2.265h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
                </svg>
                Facebook bilan kirish
              </button>

              <button
                type="button"
                onClick={handleDiscordLoginStart}
                className="w-full bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold py-3 px-4 rounded-sm transition-colors mt-3 flex items-center justify-center gap-3 cursor-pointer"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden="true">
                  <path d="M20.32 4.37A19.8 19.8 0 0015.55 3l-.6 1.22a18.27 18.27 0 00-5.9 0L8.45 3a19.7 19.7 0 00-4.77 1.37C.66 8.9-.16 13.3.25 17.63A19.9 19.9 0 006.1 20.6l1.42-1.95a12.2 12.2 0 01-2.24-1.08l.54-.42c4.32 2 9 2 13.27 0l.54.42c-.72.43-1.47.79-2.24 1.08l1.42 1.95a19.8 19.8 0 005.85-2.97c.48-5.02-.82-9.38-3.34-13.26zM8.4 15.02c-1.15 0-2.1-1.05-2.1-2.34s.92-2.34 2.1-2.34c1.19 0 2.12 1.06 2.1 2.34.01 1.29-.91 2.34-2.1 2.34zm7.2 0c-1.15 0-2.1-1.05-2.1-2.34s.92-2.34 2.1-2.34c1.19 0 2.12 1.06 2.1 2.34.01 1.29-.91 2.34-2.1 2.34z" />
                </svg>
                Discord bilan kirish
              </button>

              <button
                type="button"
                onClick={handleTelegramLoginStart}
                className="w-full bg-[#0088cc] hover:bg-[#0077b5] text-white font-bold py-3 px-4 rounded-sm transition-colors mt-3 flex items-center justify-center gap-3 cursor-pointer relative shadow-lg shadow-[#0088cc]/20"
              >
                <div className="absolute top-2 right-2">
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                    Tavsiya
                  </span>
                </div>
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.121l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.197 1.006.128.832.946z" />
                </svg>
                Telegram bilan kirish
              </button>

              <button
                type="button"
                onClick={handleYandexLoginStart}
                className="w-full bg-[#FC3F1D] hover:bg-[#e03415] text-white font-bold py-3 px-4 rounded-sm transition-colors mt-3 flex items-center justify-center gap-3 cursor-pointer shadow-md"
              >
                <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center shrink-0 overflow-hidden">
                  <img
                    src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTrvMGpJrPT4DJ5TfWDgVIIdqcYH3dJpqWJ_HBpvpHw8Q&s=10"
                    alt="Yandex"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                Yandex bilan kirish
              </button>
            </div>

            <div className="mt-8 text-center text-xs font-bold text-white/50">
              Akkuntingiz yo'qmi?{' '}
              <Link to="/register" className="text-[#ff006a] hover:text-[#d40058] transition-colors uppercase tracking-wide">
                Ro'yxatdan o'ting
              </Link>
            </div>
          </>
        )}

        {/* ---------------- FORGOT PASSWORD EMAIL STEP ---------------- */}
        {viewMode === 'forgot_email' && (
          <div>
            <button
              onClick={() => {
                setViewMode('login');
                setError('');
              }}
              className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white mb-4 transition-colors cursor-pointer"
            >
              <ArrowLeft size={14} /> Kirish sahifasiga qaytish
            </button>

            <form onSubmit={handleForgotSendEmailCode} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-white/70 mb-1.5 uppercase">
                  Email manzilingiz
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-white/30" />
                  </div>
                  <input
                    type="email"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="w-full bg-[#000] border border-[#333] rounded-sm pl-10 pr-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#ff006a] transition-colors text-sm"
                    placeholder="email@example.com"
                  />
                </div>
                <p className="text-[11px] text-white/40 mt-1.5">
                  Ushbu emailga 6 xonali parolni tiklash kodi yuboriladi.
                </p>
              </div>

              <div className="flex justify-center mb-4">
                    {captchaError && (
          <div className="p-3 mb-4 text-sm text-red-900 bg-red-100 border border-red-300 rounded-lg">
            <b>{captchaError}</b>
          </div>
        )}
        <ReCAPTCHA
  sitekey="6LdADY8tAAAAAJeHBsf1HLV-ArmkHgRNvQgZfClP"
  onChange={(token) => setCaptchaToken(token || '')}
  onExpired={() => setCaptchaToken('')}
  onErrored={() => setCaptchaError('ReCAPTCHA xatosi')}
  theme="dark"
/>
                  </div>
                  <button
                    type="submit"
                    disabled={forgotLoading || !captchaToken}
                    className="w-full bg-[#ff006a] hover:bg-[#d40058] disabled:bg-[#ff006a]/50 text-white font-bold py-3 px-4 rounded-sm transition-colors mt-2 flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#ff006a]/20 text-xs uppercase tracking-wider"
              >
                {forgotLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Kod yuborilmoqda...
                  </>
                ) : (
                  <>
                    <Send size={14} />
                    Kod yuborish
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* ---------------- FORGOT PASSWORD STEP 2: ENTER CODE ---------------- */}
        {viewMode === 'forgot_code' && (
          <div>
            <button
              onClick={() => {
                setViewMode('forgot_email');
                setError('');
                setResetSuccessMsg('');
              }}
              className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white mb-4 transition-colors cursor-pointer"
            >
              <ArrowLeft size={14} /> Qaytash ({resetEmail})
            </button>

            <form onSubmit={handleForgotVerifyCode} className="space-y-4">
              <div>
                <div className="text-center mb-4 p-3 bg-white/5 border border-white/10 rounded-sm">
                  <p className="text-xs text-white/70">
                    <strong className="text-white">{resetEmail}</strong> manziliga 6 xonali tiklash kodi yuborildi.
                  </p>
                  <p className="text-[11px] text-white/40 mt-1">
                    Pochtani (va Spam papkasini) tekshiring
                  </p>
                </div>

                <label className="block text-xs font-bold text-white/70 mb-1.5 uppercase text-center">
                  6 xonali tiklash kodi
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <KeyRound className="h-4 w-4 text-[#ff006a]" />
                  </div>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-[#000] border border-[#333] rounded-sm pl-10 pr-4 py-3 text-center text-xl font-black text-[#ff006a] tracking-[10px] placeholder-white/20 focus:outline-none focus:border-[#ff006a] transition-colors"
                    placeholder="123456"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={forgotLoading}
                className="w-full bg-[#ff006a] hover:bg-[#d40058] text-white font-bold py-3 px-4 rounded-sm transition-colors mt-2 flex items-center justify-center gap-2 cursor-pointer text-xs uppercase tracking-wider"
              >
                {forgotLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Kodni tekshirish...
                  </>
                ) : (
                  'Kodni tasdiqlash'
                )}
              </button>
            </form>
          </div>
        )}

        {/* ---------------- FORGOT PASSWORD STEP 3: NEW PASSWORD ---------------- */}
        {viewMode === 'forgot_password' && (
          <div>
            <form onSubmit={handleForgotResetPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-white/70 mb-1.5 uppercase">
                  Yangi parol
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-white/30" />
                  </div>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-[#000] border border-[#333] rounded-sm pl-10 pr-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-[#ff006a] transition-colors text-sm"
                    placeholder="Kamida 6 ta belgi"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-white/70 mb-1.5 uppercase">
                  Yangi parolni takrorlang
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-white/30" />
                  </div>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    className="w-full bg-[#000] border border-[#333] rounded-sm pl-10 pr-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-[#ff006a] transition-colors text-sm"
                    placeholder="Parolni qayta kiriting"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={forgotLoading}
                className="w-full bg-[#ff006a] hover:bg-[#d40058] text-white font-bold py-3 px-4 rounded-sm transition-colors mt-4 flex items-center justify-center gap-2 cursor-pointer text-xs uppercase tracking-wider"
              >
                {forgotLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Parol yangilanmoqda...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    Parolni saqlash va kirish
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </motion.div>

      {/* Telegram Auth Modal */}
      <TelegramAuthModal
        isOpen={showTelegramModal}
        onClose={() => setShowTelegramModal(false)}
        onSuccess={(token, user) => {
          login(token, user);
          navigate('/');
        }}
      />
    </div>
  );
}
