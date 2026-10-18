'use client';

import { useRef, useState, type ChangeEvent } from 'react';
import { CheckCircle2, ExternalLink, FileText, Loader2, UploadCloud } from 'lucide-react';

import { toast } from '@/components/ui/use-toast';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface DocumentUploadProps {
  label: string;
  description: string;
  /** Storage path currently saved on the profile. */
  savedPath: string | null;
  /** Short-lived signed link to the saved file (documents bucket is private). */
  savedUrl: string | null;
  /** Path of a file uploaded in this session (not saved until the form is submitted). */
  value: string | null;
  onChange: (path: string) => void;
  error?: string;
}

const ACCEPT = [...ALLOWED_IMAGE_TYPES, 'application/pdf'];

/** Uploads a licence / registration document to the private driver-documents bucket. */
export function DocumentUpload({ label, description, savedPath, savedUrl, value, onChange, error }: DocumentUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!ACCEPT.includes(file.type)) {
      toast({ variant: 'destructive', title: 'Unsupported file', description: 'Upload a JPG, PNG, WebP or PDF.' });
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast({ variant: 'destructive', title: 'File too large', description: `Max size is ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.` });
      return;
    }

    setBusy(true);
    try {
      const body = new FormData();
      body.set('bucket', 'driver-documents');
      body.set('file', file);
      const result = await apiFetch<{ path: string }>('/api/upload', { method: 'POST', body });
      setFileName(file.name);
      onChange(result.path);
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Upload failed',
        description: err instanceof ApiClientError ? err.message : 'Please try again.',
      });
    } finally {
      setBusy(false);
    }
  };

  const hasFile = Boolean(value ?? savedPath);

  return (
    <div>
      <div
        className={cn(
          'flex flex-col gap-3 rounded-2xl border border-dashed p-4 sm:flex-row sm:items-center sm:justify-between',
          error ? 'border-destructive' : hasFile ? 'border-success/50 bg-success/5' : 'border-border',
        )}
      >
        <div className="flex min-w-0 items-start gap-3">
          <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', hasFile ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground')}>
            {hasFile ? <CheckCircle2 className="h-5 w-5" aria-hidden /> : <FileText className="h-5 w-5" aria-hidden />}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">{label}</p>
            <p className="text-xs text-muted-foreground">
              {value ? `${fileName ?? 'New file'} — will be saved with your profile` : savedPath ? 'Uploaded' : description}
            </p>
            {!value && savedUrl && (
              <a href={savedUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline">
                View file <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-xl border border-input bg-background px-4 text-sm font-semibold transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <UploadCloud className="h-4 w-4" aria-hidden />}
          {busy ? 'Uploading…' : hasFile ? 'Replace' : 'Upload'}
        </button>
        <input ref={inputRef} type="file" accept={ACCEPT.join(',')} className="sr-only" tabIndex={-1} aria-label={`Upload ${label}`} onChange={handleFile} />
      </div>
      {error && (
        <p role="alert" className="mt-1.5 text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
