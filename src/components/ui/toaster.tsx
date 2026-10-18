'use client';

import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from '@/components/ui/toast';
import { useToast } from '@/components/ui/use-toast';

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider swipeDirection="right" duration={4500}>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        const Icon = variant === 'destructive' ? AlertCircle : variant === 'success' ? CheckCircle2 : Info;
        return (
          <Toast key={id} variant={variant} {...props}>
            <div className="flex items-start gap-3">
              <Icon
                className={
                  variant === 'success'
                    ? 'mt-0.5 h-5 w-5 shrink-0 text-success'
                    : variant === 'destructive'
                      ? 'mt-0.5 h-5 w-5 shrink-0'
                      : 'mt-0.5 h-5 w-5 shrink-0 text-brand'
                }
                aria-hidden
              />
              <div className="grid gap-1">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && <ToastDescription>{description}</ToastDescription>}
              </div>
            </div>
            {action}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
