'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Car,
  ChevronRight,
  KeyRound,
  Shield,
  Sparkles,
  User,
} from 'lucide-react';

import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { useUserStore } from '@/store/useUserStore';
import type { UserRole } from '@/types';

interface DemoPersona {
  role: UserRole;
  name: string;
  email: string;
  title: string;
  description: string;
  path: string;
  icon: typeof User;
  badge: string;
  accentClass: string;
}

const PERSONAS: DemoPersona[] = [
  {
    role: 'rider',
    name: 'Priya Sharma',
    email: 'priya.sharma@example.com',
    title: 'Rider Portal',
    description: 'Book rides, view fare breakdowns, track simulated drivers, manage saved places.',
    path: '/rider',
    icon: User,
    badge: 'Popular',
    accentClass: 'hover:border-emerald-500/50 hover:bg-emerald-500/[0.04] dark:hover:bg-emerald-500/[0.08]',
  },
  {
    role: 'driver',
    name: 'Ravi Kumar',
    email: 'ravi.kumar@example.com',
    title: 'Driver Portal',
    description: 'Go online, accept ride dispatches, simulate GPS breadcrumbs, track weekly earnings.',
    path: '/driver',
    icon: Car,
    badge: 'Online',
    accentClass: 'hover:border-blue-500/50 hover:bg-blue-500/[0.04] dark:hover:bg-blue-500/[0.08]',
  },
  {
    role: 'admin',
    name: 'Aarav Mehta',
    email: 'admin@cabgo.app',
    title: 'Admin Console',
    description: 'Platform revenue charts, fleet monitoring, driver document verification, SOS alerts.',
    path: '/admin',
    icon: Shield,
    badge: 'Full Access',
    accentClass: 'hover:border-purple-500/50 hover:bg-purple-500/[0.04] dark:hover:bg-purple-500/[0.08]',
  },
];

interface DemoAuthCardProps {
  mode?: 'sign-in' | 'sign-up';
}

export function DemoAuthCard({ mode = 'sign-in' }: DemoAuthCardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const fetchUser = useUserStore((s) => s.fetchUser);
  const [loadingRole, setLoadingRole] = useState<UserRole | null>(null);

  const handleSelectRole = async (persona: DemoPersona) => {
    setLoadingRole(persona.role);
    // Write cookie for server-side auth
    document.cookie = `cabgo_demo_role=${persona.role}; path=/; max-age=86400; SameSite=Lax`;

    try {
      await fetchUser({ force: true });
      toast({
        title: `Signed in as ${persona.name}`,
        description: `Entering ${persona.title} in zero-config demo mode.`,
      });
      router.push(persona.path);
      router.refresh();
    } catch {
      router.push(persona.path);
    }
  };

  return (
    <Card className="overflow-hidden border-border/80 bg-card/90 shadow-2xl backdrop-blur-xl">
      {/* Header */}
      <div className="relative border-b border-border/60 bg-muted/30 p-6 sm:p-7">
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Interactive Demo Sandbox</span>
          </div>
          <span className="text-xs text-muted-foreground">
            {mode === 'sign-in' ? 'Sign In' : 'Sign Up'}
          </span>
        </div>
        <h2 className="mt-3 font-display text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
          Choose a role to test
        </h2>
        <p className="mt-1.5 text-xs text-muted-foreground sm:text-sm">
          Select any seeded persona to test full end-to-end functionality without needing an SMS verification code.
        </p>
      </div>

      {/* Persona Selection */}
      <div className="space-y-3 p-5 sm:p-6">
        {PERSONAS.map((persona) => {
          const Icon = persona.icon;
          const isLoading = loadingRole === persona.role;

          return (
            <button
              key={persona.role}
              onClick={() => handleSelectRole(persona)}
              disabled={loadingRole !== null}
              className={`group flex w-full items-start gap-4 rounded-xl border border-border/70 bg-background/60 p-4 text-left transition-all ${persona.accentClass} hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary`}
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <Icon className="h-5 w-5" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                    {persona.title}
                    <span className="text-xs text-muted-foreground font-normal">
                      ({persona.name})
                    </span>
                  </span>
                  <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground group-hover:text-foreground">
                    {persona.badge}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                  {persona.description}
                </p>
              </div>

              <div className="flex self-center pl-1 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all">
                {isLoading ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                ) : (
                  <ChevronRight className="h-5 w-5" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Production Guide Note */}
      <div className="border-t border-border/60 bg-muted/20 px-6 py-4">
        <div className="flex items-start gap-2.5 text-xs text-muted-foreground">
          <KeyRound className="h-4 w-4 shrink-0 text-primary mt-0.5" />
          <div className="space-y-1">
            <p className="font-medium text-foreground">
              Production Deployment Notice
            </p>
            <p className="text-[11px] leading-relaxed">
              To enable real user phone/SMS and social auth, set your live Clerk keys in <code className="rounded bg-muted px-1 py-0.5 text-[10px]">cabgo/.env.local</code>. Real Clerk sign-in forms will take over automatically.
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between pt-2 border-t border-border/40 text-xs">
          <Link
            href="/"
            className="text-muted-foreground hover:text-foreground transition-colors font-medium"
          >
            ← Back to Home
          </Link>
          <span className="text-[11px] text-muted-foreground">
            CabGo v1.0.0
          </span>
        </div>
      </div>
    </Card>
  );
}
