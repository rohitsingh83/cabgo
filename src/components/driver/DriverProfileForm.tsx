'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, BadgeCheck, Clock, Loader2, ShieldX } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { DocumentUpload } from '@/components/driver/DocumentUpload';
import { VEHICLE_ICONS } from '@/components/ride/vehicle-icons';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { VEHICLES } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { driverProfileCreateSchema } from '@/lib/validations';
import type { DriverProfile, VehicleType } from '@/types';

/** Same rules as the API, but the year is a text field in the form. */
const formSchema = driverProfileCreateSchema
  .pick({ licenseNumber: true, vehicleType: true, vehicleModel: true, vehicleColor: true, vehiclePlate: true })
  .extend({
    vehicleYear: z
      .string()
      .trim()
      .refine((value) => value === '' || (/^\d{4}$/.test(value) && Number(value) >= 1990 && Number(value) <= new Date().getFullYear() + 1), {
        message: 'Enter a valid 4-digit year',
      }),
  });
type FormValues = z.input<typeof formSchema>;

interface DriverProfileFormProps {
  /** `setup` creates the profile (first login); `edit` updates it. */
  profile: DriverProfile | null;
  /** Signed links for already-uploaded documents. */
  documentUrls: { license: string | null; vehicle: string | null };
}

const VEHICLE_ORDER: VehicleType[] = ['bike', 'auto', 'sedan', 'suv'];

export function DriverProfileForm({ profile, documentUrls }: DriverProfileFormProps) {
  const router = useRouter();
  const isSetup = profile === null;

  const [licenseDoc, setLicenseDoc] = useState<string | null>(null);
  const [vehicleDoc, setVehicleDoc] = useState<string | null>(null);
  const [docErrors, setDocErrors] = useState<{ license?: string; vehicle?: string }>({});

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      licenseNumber: profile?.license_number ?? '',
      vehicleType: profile?.vehicle_type ?? 'sedan',
      vehicleModel: profile?.vehicle_model ?? '',
      vehicleColor: profile?.vehicle_color ?? '',
      vehiclePlate: profile?.vehicle_plate ?? '',
      vehicleYear: profile?.vehicle_year ? String(profile.vehicle_year) : '',
    },
  });
  const { isSubmitting, isDirty } = form.formState;
  const watched = form.watch();

  // Mirror the server rule: identity changes on an approved account trigger re-verification.
  const needsReverification =
    profile?.verification_status === 'approved' &&
    (watched.vehicleType !== profile.vehicle_type ||
      watched.licenseNumber.trim().toUpperCase() !== profile.license_number ||
      watched.vehiclePlate.trim().toUpperCase().replace(/\s+/g, ' ') !== profile.vehicle_plate);

  const onSubmit = async (values: FormValues) => {
    // New drivers must provide both documents before an admin can review them.
    if (isSetup) {
      const errors = {
        license: licenseDoc ? undefined : 'Upload a photo or PDF of your driving licence',
        vehicle: vehicleDoc ? undefined : 'Upload your vehicle registration certificate (RC)',
      };
      setDocErrors(errors);
      if (errors.license || errors.vehicle) return;
    }

    const payload = {
      licenseNumber: values.licenseNumber,
      vehicleType: values.vehicleType,
      vehicleModel: values.vehicleModel,
      vehicleColor: values.vehicleColor,
      vehiclePlate: values.vehiclePlate,
      vehicleYear: values.vehicleYear ? Number(values.vehicleYear) : null,
      ...(licenseDoc ? { licenseDocumentPath: licenseDoc } : {}),
      ...(vehicleDoc ? { vehicleDocumentPath: vehicleDoc } : {}),
    };

    try {
      const saved = await apiFetch<DriverProfile>('/api/driver/profile', { method: isSetup ? 'POST' : 'PATCH', body: payload });
      toast({
        variant: 'success',
        title: isSetup ? 'Profile submitted' : 'Profile saved',
        description:
          saved.verification_status === 'pending'
            ? 'Our team will review your documents — usually within 24 hours.'
            : 'Your changes are live.',
      });
      setLicenseDoc(null);
      setVehicleDoc(null);
      form.reset(values);
      if (isSetup) router.push('/driver');
      router.refresh();
    } catch (error) {
      if (error instanceof ApiClientError && error.details) {
        // Surface per-field API errors inline.
        Object.entries(error.details).forEach(([field, messages]) => {
          const message = messages?.[0];
          if (message && field in values) form.setError(field as keyof FormValues, { message });
        });
      }
      toast({
        variant: 'destructive',
        title: 'Could not save profile',
        description: error instanceof ApiClientError ? error.message : 'Please try again.',
      });
    }
  };

  const status = profile?.verification_status;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" noValidate>
        {profile && (
          <div
            className={cn(
              'flex items-start gap-3 rounded-2xl border p-4',
              status === 'approved' && 'border-success/30 bg-success/10',
              status === 'pending' && 'border-amber-500/30 bg-amber-500/10',
              status === 'rejected' && 'border-destructive/30 bg-destructive/10',
            )}
          >
            {status === 'approved' ? (
              <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden />
            ) : status === 'rejected' ? (
              <ShieldX className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden />
            ) : (
              <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" aria-hidden />
            )}
            <div>
              <p className="text-sm font-bold">
                {status === 'approved' ? 'Verified driver' : status === 'rejected' ? 'Verification rejected' : 'Verification pending'}
              </p>
              <p className="text-sm text-muted-foreground">
                {status === 'approved'
                  ? 'You can go online and accept rides.'
                  : status === 'rejected'
                    ? profile.rejection_reason ?? 'Update your details and documents, then save to resubmit for review.'
                    : 'An admin is reviewing your documents.'}
              </p>
            </div>
          </div>
        )}

        <section className="space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-6" aria-labelledby="vehicle-heading">
          <div>
            <h2 id="vehicle-heading" className="font-display text-lg font-extrabold">
              Vehicle
            </h2>
            <p className="text-sm text-muted-foreground">Riders see these details when you accept their ride.</p>
          </div>

          <FormField
            control={form.control}
            name="vehicleType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Vehicle type</FormLabel>
                <div role="radiogroup" aria-label="Vehicle type" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {VEHICLE_ORDER.map((type) => {
                    const Icon = VEHICLE_ICONS[type];
                    const active = field.value === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => field.onChange(type)}
                        className={cn(
                          'flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-2xl border-2 p-3 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          active ? 'border-brand bg-brand/5' : 'border-border hover:border-foreground/20',
                        )}
                      >
                        <span className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${VEHICLES[type].gradient} text-white`}>
                          <Icon className="h-5 w-5" aria-hidden />
                        </span>
                        {VEHICLES[type].label}
                      </button>
                    );
                  })}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid gap-5 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="vehicleModel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Make &amp; model</FormLabel>
                  <FormControl>
                    <Input placeholder="Maruti Dzire" autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="vehicleColor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Colour</FormLabel>
                  <FormControl>
                    <Input placeholder="White" autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="vehiclePlate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Number plate</FormLabel>
                  <FormControl>
                    <Input placeholder="TS 09 AB 1234" autoComplete="off" className="font-mono uppercase" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="vehicleYear"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Year (optional)</FormLabel>
                  <FormControl>
                    <Input inputMode="numeric" maxLength={4} placeholder="2021" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>

        <section className="space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-6" aria-labelledby="docs-heading">
          <div>
            <h2 id="docs-heading" className="font-display text-lg font-extrabold">
              Licence &amp; documents
            </h2>
            <p className="text-sm text-muted-foreground">Stored privately — only you and our verification team can open them.</p>
          </div>

          <FormField
            control={form.control}
            name="licenseNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Driving licence number</FormLabel>
                <FormControl>
                  <Input placeholder="TS0920210012345" autoComplete="off" className="font-mono uppercase" {...field} />
                </FormControl>
                <FormDescription>As printed on your licence.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <DocumentUpload
            label="Driving licence"
            description="Photo or PDF, up to 5 MB"
            savedPath={profile?.license_document_url ?? null}
            savedUrl={documentUrls.license}
            value={licenseDoc}
            onChange={(path) => {
              setLicenseDoc(path);
              setDocErrors((prev) => ({ ...prev, license: undefined }));
            }}
            error={docErrors.license}
          />
          <DocumentUpload
            label="Vehicle registration (RC)"
            description="Photo or PDF, up to 5 MB"
            savedPath={profile?.vehicle_document_url ?? null}
            savedUrl={documentUrls.vehicle}
            value={vehicleDoc}
            onChange={(path) => {
              setVehicleDoc(path);
              setDocErrors((prev) => ({ ...prev, vehicle: undefined }));
            }}
            error={docErrors.vehicle}
          />
        </section>

        {needsReverification && (
          <p role="status" className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden />
            Changing your vehicle type, number plate or licence number sends your profile back for verification, and you will go offline until it is approved.
          </p>
        )}

        <div className="flex justify-end">
          <Button
            type="submit"
            size="lg"
            className="h-12 w-full min-w-[180px] sm:w-auto"
            disabled={isSubmitting || (!isSetup && !isDirty && !licenseDoc && !vehicleDoc)}
          >
            {isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
            {isSetup ? 'Submit for verification' : 'Save changes'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
