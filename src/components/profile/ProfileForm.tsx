'use client';

import { useRef, useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { Camera, Loader2, Mail, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { UserAvatar } from '@/components/shared/UserAvatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from '@/lib/constants';
import { roleLabel } from '@/lib/roles';
import { formatDate } from '@/lib/utils';
import { phoneSchema } from '@/lib/validations';
import { useUserStore } from '@/store/useUserStore';
import type { User } from '@/types';

/** Form-level schema: phone may be left empty (the API keeps the stored number in that case). */
const profileFormSchema = z.object({
  fullName: z.string().trim().min(2, 'Name must be at least 2 characters').max(80, 'Name is too long'),
  phone: z.union([phoneSchema, z.literal('')]),
});
type ProfileFormValues = z.input<typeof profileFormSchema>;

interface UploadResult {
  url: string | null;
}

/** Edit name, phone and avatar. Avatar goes to Supabase Storage via /api/upload, then PATCH /api/users/me. */
export function ProfileForm({ user }: { user: User }) {
  const router = useRouter();
  const patchUser = useUserStore((s) => s.patchUser);
  const fileRef = useRef<HTMLInputElement>(null);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(user.avatar_url);
  const [avatarBusy, setAvatarBusy] = useState(false);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: { fullName: user.full_name, phone: user.phone ?? '' },
  });
  const { isSubmitting, isDirty } = form.formState;

  const saveAvatar = async (url: string | null) => {
    const updated = await apiFetch<User>('/api/users/me', { method: 'PATCH', body: { avatarUrl: url } });
    setAvatarUrl(updated.avatar_url);
    patchUser({ avatar_url: updated.avatar_url });
    router.refresh();
  };

  const onFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // allow re-selecting the same file
    if (!file) return;

    if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
      toast({ variant: 'destructive', title: 'Unsupported file', description: 'Use a JPG, PNG or WebP image.' });
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast({ variant: 'destructive', title: 'Image too large', description: `Max size is ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.` });
      return;
    }

    setAvatarBusy(true);
    try {
      const body = new FormData();
      body.set('bucket', 'avatars');
      body.set('file', file);
      const uploaded = await apiFetch<UploadResult>('/api/upload', { method: 'POST', body });
      if (!uploaded.url) throw new Error('Upload returned no URL');
      await saveAvatar(uploaded.url);
      toast({ variant: 'success', title: 'Photo updated' });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Could not update photo',
        description: error instanceof ApiClientError ? error.message : 'Please try again.',
      });
    } finally {
      setAvatarBusy(false);
    }
  };

  const removeAvatar = async () => {
    setAvatarBusy(true);
    try {
      await saveAvatar(null);
      toast({ title: 'Photo removed' });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Could not remove photo',
        description: error instanceof ApiClientError ? error.message : 'Please try again.',
      });
    } finally {
      setAvatarBusy(false);
    }
  };

  const onSubmit = async (values: ProfileFormValues) => {
    try {
      const parsed = profileFormSchema.parse(values);
      const updated = await apiFetch<User>('/api/users/me', {
        method: 'PATCH',
        body: { fullName: parsed.fullName, ...(parsed.phone ? { phone: parsed.phone } : {}) },
      });
      patchUser({ full_name: updated.full_name, phone: updated.phone });
      form.reset({ fullName: updated.full_name, phone: updated.phone ?? '' });
      toast({ variant: 'success', title: 'Profile saved' });
      router.refresh();
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 409) {
        form.setError('phone', { message: error.message });
        return;
      }
      toast({
        variant: 'destructive',
        title: 'Could not save profile',
        description: error instanceof ApiClientError ? error.message : 'Please try again.',
      });
    }
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-col items-center gap-5 rounded-2xl border border-border bg-card p-6 text-center sm:flex-row sm:text-left">
        <div className="relative">
          <UserAvatar name={user.full_name} src={avatarUrl} className="h-24 w-24 text-3xl" />
          {avatarBusy && (
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-background/70">
              <Loader2 className="h-6 w-6 animate-spin" aria-label="Uploading" />
            </span>
          )}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={avatarBusy}
            aria-label="Change profile photo"
            className="absolute -bottom-1 -right-1 flex h-11 w-11 items-center justify-center rounded-full border-4 border-card bg-primary text-primary-foreground shadow-soft transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          >
            <Camera className="h-4 w-4" />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept={ALLOWED_IMAGE_TYPES.join(',')}
            className="sr-only"
            onChange={onFileChange}
            tabIndex={-1}
            aria-hidden
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <h2 className="truncate font-display text-xl font-extrabold">{user.full_name}</h2>
            <Badge variant="info">{roleLabel(user.role)}</Badge>
          </div>
          {user.email && (
            <p className="mt-1 flex items-center justify-center gap-1.5 truncate text-sm text-muted-foreground sm:justify-start">
              <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden /> {user.email}
            </p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">Member since {formatDate(user.created_at)}</p>
          {avatarUrl && (
            <Button type="button" variant="ghost" size="sm" className="mt-3 text-muted-foreground" onClick={removeAvatar} disabled={avatarBusy}>
              <Trash2 aria-hidden /> Remove photo
            </Button>
          )}
        </div>
      </section>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 rounded-2xl border border-border bg-card p-6" noValidate>
          <div>
            <h2 className="font-display text-lg font-extrabold">Personal details</h2>
            <p className="text-sm text-muted-foreground">Drivers see your name and phone number during a ride.</p>
          </div>

          <FormField
            control={form.control}
            name="fullName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full name</FormLabel>
                <FormControl>
                  <Input autoComplete="name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone number</FormLabel>
                <FormControl>
                  <Input type="tel" inputMode="tel" autoComplete="tel" placeholder="+919876543210" {...field} />
                </FormControl>
                <FormDescription>Include the country code. Used for ride updates and driver calls.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => form.reset()} disabled={!isDirty || isSubmitting}>
              Reset
            </Button>
            <Button type="submit" disabled={!isDirty || isSubmitting} className="min-w-[132px]">
              {isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
              Save changes
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
