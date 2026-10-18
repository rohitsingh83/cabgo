'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  Key,
  Layers,
  MapPin,
  Route,
  Search,
  X,
} from 'lucide-react';

import { useGoogleMaps } from '@/hooks/use-google-maps';
import { looksLikeGoogleKey, resetGoogleMapsLoader } from '@/lib/google-maps/loader';

interface GoogleMapsSetupDialogProps {
  open: boolean;
  onClose: () => void;
}

export function GoogleMapsSetupDialog({ open, onClose }: GoogleMapsSetupDialogProps) {
  const { status, error, apiKey, retry } = useGoogleMaps();
  const [inputKey, setInputKey] = useState(apiKey || '');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (!open) return null;

  const handleSave = async () => {
    const trimmed = inputKey.trim();
    if (!looksLikeGoogleKey(trimmed)) {
      setSaveError('Invalid key format. A valid Google API key starts with "AIza" and has at least 35 characters.');
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);

    try {
      // 1. Store in localStorage for immediate client-side session use
      localStorage.setItem('cabgo_google_maps_api_key', trimmed);

      // 2. Persist to server (.env.local) so it stays across dev server restarts
      const res = await fetch('/api/config/maps-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: trimmed }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save key on server');
      }

      setSaveMessage('Google Maps API key saved! Connecting to Google Maps...');
      resetGoogleMapsLoader();
      window.dispatchEvent(new CustomEvent('cabgo:maps-key-changed'));
      retry();

      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save key');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    localStorage.removeItem('cabgo_google_maps_api_key');
    setInputKey('');
    resetGoogleMapsLoader();
    window.dispatchEvent(new CustomEvent('cabgo:maps-key-changed'));
    retry();
    setSaveMessage('Custom key cleared. Returned to street map fallback.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="maps-setup-title"
        className="relative w-full max-w-lg rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 border-b border-border pb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <h2 id="maps-setup-title" className="text-lg font-bold">
              Google Maps Platform Setup
            </h2>
            <p className="text-xs text-muted-foreground">
              Configure your Google Maps API Key to enable official Google maps, search, & routes
            </p>
          </div>
        </div>

        {/* Current Status Pill */}
        <div className="my-4 rounded-xl border border-border bg-muted/40 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Current Status:</span>
            {status === 'ready' && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Google Maps JS Active
              </span>
            )}
            {status === 'unconfigured' && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5" />
                No Key (Street Fallback Active)
              </span>
            )}
            {status === 'error' && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-semibold text-destructive">
                <AlertTriangle className="h-3.5 w-3.5" />
                Connection Error
              </span>
            )}
            {status === 'loading' && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                Connecting...
              </span>
            )}
          </div>
          {error && (
            <p className="mt-2 text-xs text-destructive bg-destructive/10 p-2 rounded-lg">
              {error}
            </p>
          )}
        </div>

        {/* Two Options */}
        <div className="space-y-3">
          {/* Quickstart Option: Maps Demo Key */}
          <div className="rounded-xl border border-brand/20 bg-brand/5 p-3.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="rounded bg-brand px-1.5 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                    Fastest
                  </span>
                  <h4 className="text-sm font-semibold text-foreground">
                    Free Google Maps Demo Key (No Card Needed)
                  </h4>
                </div>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  Google provides a free Demo Key for testing and prototyping with <strong>no billing setup</strong> and no credit card required.
                </p>
              </div>
              <a
                href="https://mapsplatform.google.com/maps-demo-key?utm_campaign=gmp_git_agentskills_v1"
                target="_blank"
                rel="noreferrer"
                className="flex shrink-0 items-center gap-1 rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:opacity-90 transition-opacity"
              >
                Get Demo Key
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>

          {/* Key Input Section */}
          <div>
            <label htmlFor="maps-key-input" className="block text-xs font-medium text-foreground mb-1.5">
              Enter your Google Maps API Key:
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                <Key className="h-4 w-4" />
              </div>
              <input
                id="maps-key-input"
                type={showKey ? 'text' : 'password'}
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full rounded-xl border border-input bg-background py-2.5 pl-9 pr-10 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                aria-label={showKey ? 'Hide key' : 'Show key'}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {saveError && (
            <p className="text-xs text-destructive">{saveError}</p>
          )}
          {saveMessage && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400">{saveMessage}</p>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !inputKey.trim()}
              className="flex-1 rounded-xl bg-brand py-2.5 text-xs font-semibold text-white shadow-lift hover:opacity-95 disabled:opacity-50 transition-all"
            >
              {saving ? 'Validating & Saving...' : 'Save & Activate Google Maps'}
            </button>
            {apiKey && (
              <button
                type="button"
                onClick={handleClear}
                className="rounded-xl border border-border px-3 py-2.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                Clear Key
              </button>
            )}
          </div>

          {/* Required APIs guide */}
          <div className="rounded-xl border border-border bg-muted/20 p-3 text-[11px] text-muted-foreground">
            <p className="font-semibold text-foreground mb-1">
              Required Google Cloud APIs to enable on your project:
            </p>
            <ul className="grid grid-cols-2 gap-1.5 mt-1.5">
              <li className="flex items-center gap-1.5">
                <Layers className="h-3 w-3 text-brand" />
                <span>Maps JavaScript API</span>
              </li>
              <li className="flex items-center gap-1.5">
                <Search className="h-3 w-3 text-brand" />
                <span>Places API (New)</span>
              </li>
              <li className="flex items-center gap-1.5">
                <Route className="h-3 w-3 text-brand" />
                <span>Routes API</span>
              </li>
              <li className="flex items-center gap-1.5">
                <MapPin className="h-3 w-3 text-brand" />
                <span>Geocoding API</span>
              </li>
            </ul>
            <div className="mt-2.5 border-t border-border pt-2 flex items-center justify-between text-[10px]">
              <span>Or set in <code className="font-mono bg-muted px-1 py-0.5 rounded">.env.local</code>:</span>
              <a
                href="https://console.cloud.google.com/google/maps-apis/credentials?utm_campaign=gmp_git_agentskills_v1"
                target="_blank"
                rel="noreferrer"
                className="text-brand hover:underline flex items-center gap-1"
              >
                Google Cloud Console
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground/80 italic">
              * Note: Usage of Google Maps Platform products and services may incur costs against your Google Cloud project billing account.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
