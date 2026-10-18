import { Bike, Car, CarFront, CarTaxiFront, type LucideIcon, Users } from 'lucide-react';

import { Reveal } from '@/components/shared/Reveal';
import { VEHICLE_TYPES, VEHICLES } from '@/lib/constants';
import { formatCurrency } from '@/lib/utils';
import type { VehicleType } from '@/types';

const ICONS: Record<VehicleType, LucideIcon> = {
  bike: Bike,
  auto: CarTaxiFront,
  sedan: Car,
  suv: CarFront,
};

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'center',
}: {
  eyebrow: string;
  title: string;
  description?: string;
  align?: 'center' | 'left';
}) {
  return (
    <Reveal className={align === 'center' ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'}>
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand">{eyebrow}</p>
      <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">{title}</h2>
      {description && <p className="mt-4 text-base text-muted-foreground sm:text-lg">{description}</p>}
    </Reveal>
  );
}

/** Four ride types with live fare-card data pulled from the same constants as the API. */
export function VehicleShowcase() {
  return (
    <section id="vehicles" className="scroll-mt-20 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Choose your ride"
          title="A ride for every budget and every trip"
          description="From a quick bike hop to a six-seat SUV — pick what suits the moment. Prices are shown upfront, always."
        />

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {VEHICLE_TYPES.map((type, index) => {
            const vehicle = VEHICLES[type];
            const Icon = ICONS[type];
            return (
              <Reveal key={type} delay={index * 0.07}>
                <article className="card-hover group relative h-full overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-soft">
                  <div
                    className={`absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-to-br ${vehicle.gradient} opacity-20 blur-2xl transition-opacity duration-500 group-hover:opacity-50`}
                    aria-hidden
                  />
                  <div
                    className={`relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${vehicle.gradient} text-white shadow-lift`}
                  >
                    <Icon className="h-7 w-7" aria-hidden />
                  </div>
                  <h3 className="relative mt-5 font-display text-xl font-extrabold">{vehicle.label}</h3>
                  <p className="relative mt-1 text-sm text-muted-foreground">{vehicle.description}</p>

                  <dl className="relative mt-6 space-y-2.5 text-sm">
                    <div className="flex items-center justify-between">
                      <dt className="flex items-center gap-1.5 text-muted-foreground">
                        <Users className="h-4 w-4" aria-hidden /> Seats
                      </dt>
                      <dd className="font-semibold">{vehicle.capacity}</dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-muted-foreground">Per km</dt>
                      <dd className="font-semibold">{formatCurrency(vehicle.perKm)}</dd>
                    </div>
                    <div className="flex items-center justify-between border-t border-border pt-2.5">
                      <dt className="text-muted-foreground">Minimum fare</dt>
                      <dd className="font-display text-lg font-extrabold">{formatCurrency(vehicle.minimumFare)}</dd>
                    </div>
                  </dl>
                </article>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
