'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  Car,
  Check,
  ChevronDown,
  ChevronRight,
  KeyRound,
  Lock,
  RefreshCw,
  Shield,
  Sparkles,
  User,
  UserCheck,
} from 'lucide-react';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { useUserStore } from '@/store/useUserStore';
import type { UserRole } from '@/types';

export interface RememberedUser {
  id: string;
  fullName: string;
  email?: string;
  phone?: string;
  role: UserRole;
  avatarUrl?: string;
  authProvider: 'google' | 'phone' | 'demo';
  savedAt: string;
}

const COUNTRY_CODES = [
  { code: '+91', country: 'IN', flag: '🇮🇳', name: 'India' },
  { code: '+1', country: 'US', flag: '🇺🇸', name: 'United States' },
  { code: '+44', country: 'GB', flag: '🇬🇧', name: 'United Kingdom' },
  { code: '+971', country: 'AE', flag: '🇦🇪', name: 'United Arab Emirates' },
  { code: '+61', country: 'AU', flag: '🇦🇺', name: 'Australia' },
  { code: '+65', country: 'SG', flag: '🇸🇬', name: 'Singapore' },
  { code: '+49', country: 'DE', flag: '🇩🇪', name: 'Germany' },
  { code: '+1', country: 'CA', flag: '🇨🇦', name: 'Canada' },
];

const PRESET_GOOGLE_ACCOUNTS = [
  {
    name: 'Rohit Singh',
    email: 'rohit.singh@gmail.com',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80',
    role: 'rider' as UserRole,
  },
  {
    name: 'Priya Sharma',
    email: 'priya.sharma@example.com',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80',
    role: 'rider' as UserRole,
  },
  {
    name: 'Ravi Kumar',
    email: 'ravi.kumar@example.com',
    avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=120&q=80',
    role: 'driver' as UserRole,
  },
];

interface SignInCardProps {
  mode?: 'sign-in' | 'sign-up';
}

export function SignInCard({ mode = 'sign-in' }: SignInCardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect_url');
  const fetchUser = useUserStore((s) => s.fetchUser);

  // Selected Portal Role
  const [role, setRole] = useState<UserRole>('rider');

  // Remembered User Details
  const [remembered, setRemembered] = useState<RememberedUser | null>(null);
  const [showFullForm, setShowFullForm] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Phone Login State
  const [selectedCountry, setSelectedCountry] = useState(COUNTRY_CODES[0]);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [userName, setUserName] = useState('');
  const [step, setStep] = useState<'input' | 'otp'>('input');
  const [generatedOtp, setGeneratedOtp] = useState<string>('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);

  // Google Modal State
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [customGoogleName, setCustomGoogleName] = useState('');
  const [customGoogleEmail, setCustomGoogleEmail] = useState('');
  const [isAddingGoogle, setIsAddingGoogle] = useState(false);

  // Quick Demo Testing Toggle
  const [showQuickTesting, setShowQuickTesting] = useState(false);

  // Load remembered user on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('cabgo_remembered_user');
      if (saved) {
        const parsed: RememberedUser = JSON.parse(saved);
        if (parsed && parsed.fullName) {
          setRemembered(parsed);
          setRole(parsed.role || 'rider');
          if (parsed.phone) setPhoneNumber(parsed.phone.replace(/^\+\d+/, ''));
          if (parsed.fullName) setUserName(parsed.fullName);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // OTP Timer countdown
  useEffect(() => {
    if (step !== 'otp' || resendTimer <= 0) return;
    const interval = setInterval(() => setResendTimer((t) => t - 1), 1000);
    return () => clearInterval(interval);
  }, [step, resendTimer]);

  // Destination path based on role and redirect_url
  const getDestinationPath = (userRole: UserRole) => {
    if (redirectUrl && redirectUrl.startsWith(`/${userRole}`)) {
      return redirectUrl;
    }
    return userRole === 'driver' ? '/driver' : userRole === 'admin' ? '/admin' : '/rider';
  };

  // Complete Login
  const finalizeLogin = async (userInfo: {
    id: string;
    fullName: string;
    email?: string;
    phone?: string;
    role: UserRole;
    avatarUrl?: string;
    authProvider: 'google' | 'phone' | 'demo';
  }) => {
    setIsSubmitting(true);
    const destPath = getDestinationPath(userInfo.role);

    // Save in cookies for server-side auth & middleware
    const maxAge = rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 24; // 30 days or 1 day
    document.cookie = `cabgo_demo_role=${userInfo.role}; path=/; max-age=${maxAge}; SameSite=Lax`;
    document.cookie = `cabgo_session=true; path=/; max-age=${maxAge}; SameSite=Lax`;
    document.cookie = `cabgo_user_data=${encodeURIComponent(
      JSON.stringify({
        id: userInfo.id,
        fullName: userInfo.fullName,
        email: userInfo.email,
        phone: userInfo.phone,
        avatarUrl: userInfo.avatarUrl,
        role: userInfo.role,
      })
    )}; path=/; max-age=${maxAge}; SameSite=Lax`;

    // Remember user details in localStorage
    if (rememberMe) {
      const toSave: RememberedUser = {
        id: userInfo.id,
        fullName: userInfo.fullName,
        email: userInfo.email,
        phone: userInfo.phone,
        role: userInfo.role,
        avatarUrl: userInfo.avatarUrl,
        authProvider: userInfo.authProvider,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem('cabgo_remembered_user', JSON.stringify(toSave));
    }

    try {
      await fetchUser({ force: true });
      toast({
        title: `Welcome back, ${userInfo.fullName.split(' ')[0]}! 👋`,
        description: `Successfully signed in as ${userInfo.role}. Redirecting...`,
      });
      router.push(destPath);
      router.refresh();
    } catch {
      router.push(destPath);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Send Phone OTP
  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    if (cleanPhone.length < 7) {
      toast({
        variant: 'destructive',
        title: 'Invalid phone number',
        description: 'Please enter a valid mobile number to receive your code.',
      });
      return;
    }

    const code = '123456'; // standard convenient verification code
    setGeneratedOtp(code);
    setStep('otp');
    setResendTimer(30);

    toast({
      title: 'Verification Code Sent',
      description: `Your CabGo verification code is ${code}.`,
    });
  };

  // Verify Phone OTP
  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    const entered = otpDigits.join('');
    if (entered.length !== 6) {
      toast({
        variant: 'destructive',
        title: 'Incomplete OTP',
        description: 'Please enter all 6 digits of your verification code.',
      });
      return;
    }

    if (entered !== generatedOtp && entered !== '123456') {
      toast({
        variant: 'destructive',
        title: 'Incorrect OTP',
        description: 'The code you entered is invalid. Try 123456.',
      });
      return;
    }

    const fullPhone = `${selectedCountry.code}${phoneNumber.replace(/\D/g, '')}`;
    const name = userName.trim() || (remembered?.fullName ?? 'CabGo User');
    const id = `user-phone-${phoneNumber.replace(/\D/g, '').slice(-8) || 'verified'}`;

    void finalizeLogin({
      id,
      fullName: name,
      phone: fullPhone,
      role,
      avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`,
      authProvider: 'phone',
    });
  };

  // Google Login Select
  const handleGoogleSelect = (acc: typeof PRESET_GOOGLE_ACCOUNTS[0]) => {
    setShowGoogleModal(false);
    void finalizeLogin({
      id: `google-${acc.email.replace(/[^a-zA-Z0-9]/g, '-')}`,
      fullName: acc.name,
      email: acc.email,
      avatarUrl: acc.avatar,
      role,
      authProvider: 'google',
    });
  };

  // Custom Google Login
  const handleCustomGoogleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customGoogleEmail.includes('@')) {
      toast({ variant: 'destructive', title: 'Invalid Email', description: 'Enter a valid Google email.' });
      return;
    }
    const name = customGoogleName.trim() || customGoogleEmail.split('@')[0];
    setShowGoogleModal(false);
    void finalizeLogin({
      id: `google-${customGoogleEmail.replace(/[^a-zA-Z0-9]/g, '-')}`,
      fullName: name,
      email: customGoogleEmail.trim().toLowerCase(),
      avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`,
      role,
      authProvider: 'google',
    });
  };

  return (
    <Card className="relative overflow-hidden border-border/80 bg-card/95 shadow-2xl backdrop-blur-xl">
      {/* Header */}
      <div className="relative border-b border-border/60 bg-muted/20 p-6 sm:p-7">
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Lock className="h-3 w-3" />
            <span>Secure Authentication</span>
          </div>
          <span className="text-xs font-medium text-muted-foreground">
            {mode === 'sign-in' ? 'Sign In' : 'Sign Up'}
          </span>
        </div>

        <h1 className="mt-3 font-display text-2xl font-black tracking-tight text-foreground sm:text-3xl">
          {step === 'otp' ? 'Enter verification code' : 'Welcome to CabGo'}
        </h1>
        <p className="mt-1.5 text-xs text-muted-foreground sm:text-sm">
          {step === 'otp'
            ? `We sent a 6-digit verification code to ${selectedCountry.code} ${phoneNumber}`
            : 'Sign in with your mobile number or Google account to continue.'}
        </p>

        {/* Role Segmented Selector */}
        {step === 'input' && (
          <div className="mt-4 grid grid-cols-3 gap-1.5 rounded-xl border border-border/80 bg-background/80 p-1">
            <button
              type="button"
              onClick={() => setRole('rider')}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition-all ${
                role === 'rider'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <User className="h-3.5 w-3.5" />
              <span>Rider</span>
            </button>
            <button
              type="button"
              onClick={() => setRole('driver')}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition-all ${
                role === 'driver'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Car className="h-3.5 w-3.5" />
              <span>Driver</span>
            </button>
            <button
              type="button"
              onClick={() => setRole('admin')}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition-all ${
                role === 'admin'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Shield className="h-3.5 w-3.5" />
              <span>Admin</span>
            </button>
          </div>
        )}
      </div>

      <div className="p-6 sm:p-7 space-y-5">
        {/* Remembered User Card (1-Click Welcome Back) */}
        {remembered && !showFullForm && step === 'input' && (
          <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-4 sm:p-5 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-primary flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5" /> Remembered on this device
              </span>
              <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {remembered.role}
              </span>
            </div>

            <div className="mt-3 flex items-center gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-bold text-lg shadow-sm">
                {remembered.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={remembered.avatarUrl} alt="" className="h-full w-full rounded-2xl object-cover" />
                ) : (
                  remembered.fullName.charAt(0)
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-display font-bold text-foreground text-base truncate">
                  {remembered.fullName}
                </h3>
                <p className="text-xs text-muted-foreground truncate">
                  {remembered.phone || remembered.email}
                </p>
              </div>
            </div>

            <Button
              type="button"
              onClick={() => finalizeLogin(remembered)}
              disabled={isSubmitting}
              className="mt-4 w-full h-11 text-sm font-bold gap-2 shadow-md"
            >
              {isSubmitting ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <UserCheck className="h-4 w-4" />
              )}
              Continue as {remembered.fullName.split(' ')[0]}
            </Button>

            <button
              type="button"
              onClick={() => setShowFullForm(true)}
              className="mt-3 block w-full text-center text-xs text-muted-foreground hover:text-foreground font-medium underline-offset-4 hover:underline"
            >
              Sign in with a different account
            </button>
          </div>
        )}

        {/* Regular Login Form */}
        {(!remembered || showFullForm) && step === 'input' && (
          <div className="space-y-4">
            {/* Google Login Button */}
            <button
              type="button"
              onClick={() => setShowGoogleModal(true)}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-border/80 bg-background/80 py-3 px-4 font-semibold text-foreground text-sm shadow-sm transition-all hover:bg-accent hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  fill="#EA4335"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            <div className="relative my-4 flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border/80" />
              </div>
              <div className="relative bg-card px-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                or sign in with phone
              </div>
            </div>

            {/* Phone Number Form */}
            <form onSubmit={handleSendOtp} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rohit Singh"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="w-full rounded-xl border border-border/80 bg-background/80 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Phone Number
                </label>
                <div className="flex gap-2">
                  {/* Country Selector */}
                  <div className="relative">
                    <select
                      value={selectedCountry.code}
                      onChange={(e) => {
                        const c = COUNTRY_CODES.find((x) => x.code === e.target.value);
                        if (c) setSelectedCountry(c);
                      }}
                      className="h-11 rounded-xl border border-border/80 bg-background/80 px-3 pr-7 text-xs font-bold text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer"
                    >
                      {COUNTRY_CODES.map((c) => (
                        <option key={c.name} value={c.code}>
                          {c.flag} {c.code}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2 top-3.5 h-3.5 w-3.5 text-muted-foreground" />
                  </div>

                  {/* Number Input */}
                  <div className="relative flex-1">
                    <input
                      type="tel"
                      required
                      placeholder="98765 43210"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="w-full h-11 rounded-xl border border-border/80 bg-background/80 px-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>
              </div>

              {/* Remember Me Checkbox */}
              <label className="flex items-center gap-2 pt-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                />
                <span className="text-xs text-muted-foreground hover:text-foreground">
                  Remember my details on this device
                </span>
              </label>

              <Button
                type="submit"
                disabled={phoneNumber.trim().length < 5}
                className="w-full h-11 text-sm font-bold gap-2 mt-2 shadow-md"
              >
                <span>Continue with Phone</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>

            {remembered && (
              <button
                type="button"
                onClick={() => setShowFullForm(false)}
                className="block w-full text-center text-xs text-muted-foreground hover:text-foreground pt-1"
              >
                ← Back to remembered profile
              </button>
            )}
          </div>
        )}

        {/* Step 2: OTP Verification Screen */}
        {step === 'otp' && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            {/* Demo Helper Banner */}
            <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/10 p-3">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-primary" />
                <span className="text-xs text-foreground">
                  Verification Code: <strong className="font-mono text-primary font-bold">{generatedOtp}</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOtpDigits(generatedOtp.split(''));
                  toast({ title: 'OTP auto-filled', description: 'Click Verify to complete sign in.' });
                }}
                className="rounded-lg bg-primary/20 px-2.5 py-1 text-[11px] font-bold text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
              >
                Auto-fill
              </button>
            </div>

            {/* 6-Digit Boxes */}
            <div className="flex justify-between gap-1.5 sm:gap-2 pt-2">
              {otpDigits.map((digit, index) => (
                <input
                  key={index}
                  id={`otp-${index}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  autoFocus={index === 0}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    const copy = [...otpDigits];
                    copy[index] = val;
                    setOtpDigits(copy);
                    if (val && index < 5) {
                      document.getElementById(`otp-${index + 1}`)?.focus();
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Backspace' && !digit && index > 0) {
                      document.getElementById(`otp-${index - 1}`)?.focus();
                    }
                  }}
                  className="h-12 w-11 sm:h-14 sm:w-13 rounded-xl border-2 border-border/80 bg-background text-center font-mono text-xl sm:text-2xl font-bold text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              ))}
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
              <span>Didn&apos;t receive code?</span>
              {resendTimer > 0 ? (
                <span>Resend in {resendTimer}s</span>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setResendTimer(30);
                    toast({ title: 'Code resent', description: `Your code is ${generatedOtp}` });
                  }}
                  className="font-semibold text-primary hover:underline"
                >
                  Resend code
                </button>
              )}
            </div>

            <Button
              type="submit"
              disabled={isSubmitting || otpDigits.join('').length !== 6}
              className="w-full h-11 text-sm font-bold gap-2 mt-2 shadow-md"
            >
              {isSubmitting ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              <span>Verify & Sign In</span>
            </Button>

            <button
              type="button"
              onClick={() => setStep('input')}
              className="block w-full text-center text-xs text-muted-foreground hover:text-foreground pt-1"
            >
              ← Change phone number
            </button>
          </form>
        )}

        {/* Quick Testing Personas Accordion */}
        <div className="border-t border-border/60 pt-4">
          <button
            type="button"
            onClick={() => setShowQuickTesting(!showQuickTesting)}
            className="flex w-full items-center justify-between text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span>Quick Test Personas (Rider / Driver / Admin)</span>
            </span>
            <ChevronRight
              className={`h-4 w-4 transition-transform ${showQuickTesting ? 'rotate-90' : ''}`}
            />
          </button>

          {showQuickTesting && (
            <div className="mt-3 space-y-2 animate-fade-in">
              <button
                type="button"
                onClick={() =>
                  finalizeLogin({
                    id: 'b0000000-0000-4000-8000-000000000001',
                    fullName: 'Priya Sharma',
                    email: 'priya.sharma@example.com',
                    phone: '+919811100001',
                    role: 'rider',
                    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80',
                    authProvider: 'demo',
                  })
                }
                className="flex w-full items-center justify-between rounded-xl border border-border/80 bg-background/50 p-2.5 text-left text-xs hover:border-emerald-500/50 hover:bg-emerald-500/5"
              >
                <div>
                  <p className="font-bold text-foreground">Priya Sharma (Rider)</p>
                  <p className="text-[11px] text-muted-foreground">Book rides & live tracking</p>
                </div>
                <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                  Rider
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  finalizeLogin({
                    id: 'c0000000-0000-4000-8000-000000000001',
                    fullName: 'Ravi Kumar',
                    email: 'ravi.kumar@example.com',
                    phone: '+919822200001',
                    role: 'driver',
                    avatarUrl: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=120&q=80',
                    authProvider: 'demo',
                  })
                }
                className="flex w-full items-center justify-between rounded-xl border border-border/80 bg-background/50 p-2.5 text-left text-xs hover:border-blue-500/50 hover:bg-blue-500/5"
              >
                <div>
                  <p className="font-bold text-foreground">Ravi Kumar (Driver)</p>
                  <p className="text-[11px] text-muted-foreground">Accept trips, verify PIN, earn</p>
                </div>
                <span className="rounded bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-600 dark:text-blue-400">
                  Driver
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  finalizeLogin({
                    id: 'a0000000-0000-4000-8000-000000000001',
                    fullName: 'Aarav Mehta',
                    email: 'admin@cabgo.app',
                    phone: '+919900000001',
                    role: 'admin',
                    avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80',
                    authProvider: 'demo',
                  })
                }
                className="flex w-full items-center justify-between rounded-xl border border-border/80 bg-background/50 p-2.5 text-left text-xs hover:border-purple-500/50 hover:bg-purple-500/5"
              >
                <div>
                  <p className="font-bold text-foreground">Aarav Mehta (Admin)</p>
                  <p className="text-[11px] text-muted-foreground">Fleet overview & revenue console</p>
                </div>
                <span className="rounded bg-purple-500/10 px-2 py-0.5 text-[10px] font-bold text-purple-600 dark:text-purple-400">
                  Admin
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Google Account Selector Modal */}
      {showGoogleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    fill="#EA4335"
                  />
                </svg>
                <h3 className="font-display font-bold text-foreground text-base">
                  Sign in with Google
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGoogleModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              Choose a Google account to continue to CabGo as <strong>{role}</strong>:
            </p>

            <div className="space-y-2">
              {PRESET_GOOGLE_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => handleGoogleSelect(acc)}
                  className="flex w-full items-center gap-3 rounded-xl border border-border/80 bg-background/80 p-3 text-left transition-all hover:border-primary/50 hover:bg-accent"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={acc.avatar} alt="" className="h-9 w-9 rounded-full object-cover border" />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-xs text-foreground truncate">{acc.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{acc.email}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Custom Google Account Option */}
            {!isAddingGoogle ? (
              <button
                type="button"
                onClick={() => setIsAddingGoogle(true)}
                className="block w-full text-center text-xs font-semibold text-primary hover:underline pt-1"
              >
                + Use another Google account
              </button>
            ) : (
              <form onSubmit={handleCustomGoogleSubmit} className="space-y-2 pt-2 border-t border-border">
                <input
                  type="text"
                  placeholder="Your Name (e.g. Rohit)"
                  value={customGoogleName}
                  onChange={(e) => setCustomGoogleName(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <input
                  type="email"
                  required
                  placeholder="name@gmail.com"
                  value={customGoogleEmail}
                  onChange={(e) => setCustomGoogleEmail(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <div className="flex gap-2">
                  <Button type="submit" size="sm" className="w-full h-8 text-xs font-bold">
                    Sign in with this account
                  </Button>
                </div>
              </form>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowGoogleModal(false)}
              className="w-full h-9 text-xs font-semibold"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
