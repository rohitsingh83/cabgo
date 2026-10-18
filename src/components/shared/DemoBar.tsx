'use client';

import { useState, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Car,
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  RotateCcw,
  Shield,
  Sparkles,
  User,
} from 'lucide-react';

import { useToast } from '@/components/ui/use-toast';
import { useUserStore } from '@/store/useUserStore';
import type { UserRole } from '@/types';

interface DemoPersona {
  role: UserRole;
  label: string;
  name: string;
  path: string;
  icon: typeof User;
  badgeColor: string;
}

const PERSONAS: DemoPersona[] = [
  {
    role: 'rider',
    label: 'Rider Portal',
    name: 'Priya Sharma',
    path: '/rider',
    icon: User,
    badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  },
  {
    role: 'driver',
    label: 'Driver Portal',
    name: 'Ravi Kumar',
    path: '/driver',
    icon: Car,
    badgeColor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  },
  {
    role: 'admin',
    label: 'Admin Console',
    name: 'Aarav Mehta',
    path: '/admin',
    icon: Shield,
    badgeColor: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
  },
];

export function DemoBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const fetchUser = useUserStore((s) => s.fetchUser);

  const [collapsed, setCollapsed] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isResetting, setIsResetting] = useState(false);

  // If demo mode is not enabled in this environment, don't render anything
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== 'true') {
    return null;
  }

  const currentRole: UserRole = pathname.startsWith('/admin')
    ? 'admin'
    : pathname.startsWith('/driver')
      ? 'driver'
      : 'rider';

  const switchRole = (persona: DemoPersona) => {
    // Write cookie for server-side auth resolution
    document.cookie = `cabgo_demo_role=${persona.role}; path=/; max-age=86400; SameSite=Lax`;

    startTransition(async () => {
      // Refresh local store and navigate to role dashboard
      await fetchUser({ force: true });
      router.push(persona.path);
      router.refresh();

      toast({
        title: `Switched to ${persona.label}`,
        description: `Signed in as ${persona.name} (${persona.role}) with full demo access.`,
      });
    });
  };

  const handleResetData = async () => {
    setIsResetting(true);
    try {
      const res = await fetch('/api/demo/reset', { method: 'POST' });
      if (!res.ok) throw new Error('Reset request failed');
      toast({
        title: 'Demo Database Reset',
        description: 'Trips, driver statuses, and statistics restored to seed state.',
      });
      router.refresh();
    } catch {
      toast({
        title: 'Reset failed',
        description: 'Could not reset demo data. Try refreshing the page.',
        variant: 'destructive',
      });
    } finally {
      setIsResetting(false);
    }
  };

  if (collapsed) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setCollapsed(false)}
          className="flex items-center gap-2 rounded-full border border-primary/30 bg-background/90 px-3.5 py-1.5 text-xs font-medium text-foreground shadow-lg backdrop-blur-md transition-all hover:bg-accent hover:border-primary/60 hover:scale-105"
          aria-label="Expand Demo Mode Bar"
        >
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span>Demo Controls</span>
          <ChevronUp className="h-3 w-3 text-muted-foreground" />
        </button>
      </div>
    );
  }

  return (
    <aside
      aria-label="Interactive Demo Switcher"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-3xl rounded-2xl border border-border/60 bg-background/95 p-2.5 shadow-2xl backdrop-blur-xl transition-all dark:bg-card/95 sm:p-3"
    >
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        {/* Left: Mode badge and explanation */}
        <div className="flex items-center gap-2.5 pl-1">
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" />
            <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
          </div>
          <div className="leading-tight">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold tracking-tight text-foreground">
                Market Demo Mode
              </span>
              <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                Live Backend Sim
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground hidden sm:block">
              Zero-config sandbox. Test any role without signing in.
            </p>
          </div>
        </div>

        {/* Center: Role Switcher Buttons */}
        <div className="flex items-center gap-1.5 rounded-xl bg-muted/60 p-1">
          {PERSONAS.map((persona) => {
            const Icon = persona.icon;
            const isActive = currentRole === persona.role;
            return (
              <button
                key={persona.role}
                onClick={() => switchRole(persona)}
                disabled={isPending}
                className={`relative flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-background/50 hover:text-foreground'
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-primary' : ''}`} />
                <span className="hidden xs:inline">{persona.name.split(' ')[0]}</span>
                <span className="xs:hidden">{persona.role}</span>
                {isActive && <Check className="h-3 w-3 text-primary ml-0.5" />}
              </button>
            );
          })}
        </div>

        {/* Right: Actions (Reset, Docs, Minimize) */}
        <div className="flex items-center gap-1 justify-end">
          <button
            onClick={handleResetData}
            disabled={isResetting}
            title="Reset demo data to default seed state"
            className="flex items-center gap-1 rounded-lg border border-border/50 px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
          >
            <RotateCcw className={`h-3 w-3 ${isResetting ? 'animate-spin' : ''}`} />
            <span className="hidden md:inline">Reset</span>
          </button>

          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            title="View Market Deployment Guide"
            className="hidden lg:flex items-center gap-1 rounded-lg border border-border/50 px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <FileText className="h-3 w-3" />
            <span>Guide</span>
          </a>

          <button
            onClick={() => setCollapsed(true)}
            title="Minimize demo bar"
            className="rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            aria-label="Collapse demo bar"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
