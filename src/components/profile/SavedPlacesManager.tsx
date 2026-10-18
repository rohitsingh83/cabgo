'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Briefcase, Home, Loader2, MapPin, Plus, Star, Trash2 } from 'lucide-react';

import { PlaceSearchInput } from '@/components/maps/PlaceSearchInput';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { savedPlaceSchema } from '@/lib/validations';
import type { Place, SavedPlace } from '@/types';

type PlaceLabel = SavedPlace['label'];

const META: Record<PlaceLabel, { title: string; icon: typeof Home }> = {
  home: { title: 'Home', icon: Home },
  work: { title: 'Work', icon: Briefcase },
  custom: { title: 'Favourite', icon: Star },
};

const rank: Record<PlaceLabel, number> = { home: 0, work: 1, custom: 2 };
const sortPlaces = (places: SavedPlace[]) => [...places].sort((a, b) => rank[a.label] - rank[b.label]);

/** Home / Work slots plus up to 20 custom favourites. Everything persists through /api/saved-places. */
export function SavedPlacesManager({ initialPlaces }: { initialPlaces: SavedPlace[] }) {
  const [places, setPlaces] = useState<SavedPlace[]>(sortPlaces(initialPlaces));
  const [editing, setEditing] = useState<PlaceLabel | null>(null);
  const [toDelete, setToDelete] = useState<SavedPlace | null>(null);
  const [deleting, setDeleting] = useState(false);

  const home = places.find((place) => place.label === 'home');
  const work = places.find((place) => place.label === 'work');
  const customs = places.filter((place) => place.label === 'custom');

  const handleSaved = (saved: SavedPlace) => {
    setPlaces((prev) => sortPlaces([...prev.filter((place) => saved.label === 'custom' || place.label !== saved.label), saved]));
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await apiFetch<{ id: string }>(`/api/saved-places/${toDelete.id}`, { method: 'DELETE' });
      setPlaces((prev) => prev.filter((place) => place.id !== toDelete.id));
      toast({ title: 'Place removed' });
      setToDelete(null);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Could not remove place',
        description: error instanceof ApiClientError ? error.message : 'Please try again.',
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <Slot label="home" place={home} onEdit={() => setEditing('home')} onDelete={setToDelete} />
        <Slot label="work" place={work} onEdit={() => setEditing('work')} onDelete={setToDelete} />
      </div>

      <section aria-labelledby="favourites-heading">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="favourites-heading" className="font-display text-lg font-extrabold">
            Favourites
          </h2>
          <Button variant="outline" size="sm" className="h-10" onClick={() => setEditing('custom')}>
            <Plus aria-hidden /> Add place
          </Button>
        </div>

        {customs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-center">
            <Star className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden />
            <p className="mt-2 text-sm font-semibold">No favourites yet</p>
            <p className="text-xs text-muted-foreground">Save the gym, a friend&apos;s place or the airport for one-tap booking.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            <AnimatePresence initial={false}>
              {customs.map((place) => (
                <motion.li
                  key={place.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                    <Star className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{place.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{place.address}</p>
                  </div>
                  <Button variant="ghost" size="icon" aria-label={`Remove ${place.name ?? 'place'}`} onClick={() => setToDelete(place)}>
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </section>

      <PlaceDialog label={editing} onClose={() => setEditing(null)} onSaved={handleSaved} />

      <AlertDialog open={toDelete !== null} onOpenChange={(open) => !open && !deleting && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this place?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete ? `"${toDelete.label === 'custom' ? toDelete.name : META[toDelete.label].title}" will be removed from your saved places.` : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel disabled={deleting} className="mt-0 h-11">
              Keep it
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-11 bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault();
                void confirmDelete();
              }}
            >
              {deleting && <Loader2 className="animate-spin" aria-hidden />} Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ---------------------------------------------------------------------- */

function Slot({
  label,
  place,
  onEdit,
  onDelete,
}: {
  label: 'home' | 'work';
  place: SavedPlace | undefined;
  onEdit: () => void;
  onDelete: (place: SavedPlace) => void;
}) {
  const { icon: Icon, title } = META[label];
  return (
    <div className={cn('flex items-center gap-3 rounded-2xl border p-4', place ? 'border-border bg-card' : 'border-dashed border-border')}>
      <span className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl', place ? 'bg-brand-gradient text-white' : 'bg-muted text-muted-foreground')}>
        <Icon className="h-6 w-6" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-base font-extrabold">{title}</p>
        <p className="truncate text-xs text-muted-foreground">{place ? place.address : `Add your ${title.toLowerCase()} address`}</p>
      </div>
      {place ? (
        <div className="flex">
          <Button variant="ghost" size="sm" className="h-11" onClick={onEdit}>
            Edit
          </Button>
          <Button variant="ghost" size="icon" aria-label={`Remove ${title}`} onClick={() => onDelete(place)}>
            <Trash2 className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      ) : (
        <Button variant="outline" size="sm" className="h-11" onClick={onEdit}>
          <Plus aria-hidden /> Add
        </Button>
      )}
    </div>
  );
}

function PlaceDialog({
  label,
  onClose,
  onSaved,
}: {
  label: PlaceLabel | null;
  onClose: () => void;
  onSaved: (place: SavedPlace) => void;
}) {
  const [place, setPlace] = useState<Place | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const close = () => {
    if (saving) return;
    setPlace(null);
    setName('');
    setError(null);
    onClose();
  };

  const save = async () => {
    if (!label || !place) {
      setError('Search for an address and pick one from the list.');
      return;
    }
    const payload = {
      label,
      ...(label === 'custom' ? { name } : {}),
      address: place.address,
      lat: place.lat,
      lng: place.lng,
    };
    const parsed = savedPlaceSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the details and try again.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const saved = await apiFetch<SavedPlace>('/api/saved-places', { method: 'POST', body: parsed.data });
      onSaved(saved);
      toast({ variant: 'success', title: 'Place saved' });
      setSaving(false);
      setPlace(null);
      setName('');
      onClose();
    } catch (err) {
      setSaving(false);
      setError(err instanceof ApiClientError ? err.message : 'Could not save this place. Please try again.');
    }
  };

  return (
    <Dialog open={label !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{label === 'custom' ? 'Add a favourite place' : `Set your ${label ? META[label].title.toLowerCase() : ''} address`}</DialogTitle>
          <DialogDescription>Search for an address, then save it for one-tap booking.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {label === 'custom' && (
            <div className="space-y-2">
              <Label htmlFor="place-name">Name</Label>
              <Input id="place-name" value={name} maxLength={60} placeholder="e.g. Gym, Mom's house" onChange={(event) => setName(event.target.value)} />
            </div>
          )}
          <div className="space-y-2">
            <span className="text-sm font-medium">Address</span>
            <PlaceSearchInput
              label="Address"
              hideLabel
              placeholder="Search an address"
              value={place}
              onChange={(next) => {
                setPlace(next);
                setError(null);
              }}
              leading={<MapPin className="h-4 w-4 text-brand" aria-hidden />}
              allowCurrentLocation
              onError={setError}
            />
          </div>
          {error && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={close} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || !place}>
            {saving && <Loader2 className="animate-spin" aria-hidden />} Save place
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
