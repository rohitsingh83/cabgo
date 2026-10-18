import type { VehicleType } from '@/types';

/**
 * DOM factories for Advanced Marker content. Built with plain DOM + inline styles (not React)
 * because Google Maps owns the element lifecycle. All markers anchor at their bottom-centre,
 * except circular ones which Google centres automatically.
 */

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  styles: Partial<CSSStyleDeclaration>,
  attrs: Record<string, string> = {},
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  Object.assign(node.style, styles);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
  return node;
}

/** Green pulsing dot — pickup. */
export function createPickupMarker(): HTMLElement {
  const wrap = el('div', { position: 'relative', width: '22px', height: '22px' }, { 'aria-label': 'Pickup' });
  const pulse = el('span', {
    position: 'absolute',
    inset: '0',
    borderRadius: '9999px',
    background: 'rgba(34,197,94,0.45)',
  });
  pulse.className = 'animate-pulse-ring';
  const dot = el('span', {
    position: 'absolute',
    inset: '3px',
    borderRadius: '9999px',
    background: '#22c55e',
    border: '3px solid #fff',
    boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
  });
  wrap.append(pulse, dot);
  return wrap;
}

/** Blue rounded square with a white core — drop-off. */
export function createDropoffMarker(): HTMLElement {
  const wrap = el('div', { padding: '0', transform: 'translateY(0)' }, { 'aria-label': 'Drop-off' });
  wrap.className = 'marker-drop';
  const box = el('div', {
    width: '26px',
    height: '26px',
    borderRadius: '8px',
    background: '#2563eb',
    border: '3px solid #fff',
    boxShadow: '0 4px 12px rgba(37,99,235,0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  });
  box.append(el('span', { width: '8px', height: '8px', borderRadius: '2px', background: '#fff' }));
  wrap.append(box);
  return wrap;
}

/** Numbered dot — intermediate stop. */
export function createStopMarker(index: number): HTMLElement {
  const node = el(
    'div',
    {
      width: '24px',
      height: '24px',
      borderRadius: '9999px',
      background: '#111827',
      color: '#fff',
      font: '700 12px/1 system-ui, sans-serif',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      border: '2px solid #fff',
      boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
    },
    { 'aria-label': `Stop ${index}` },
  );
  node.textContent = String(index);
  return node;
}

const VEHICLE_COLORS: Record<VehicleType, string> = {
  bike: '#10b981',
  auto: '#f59e0b',
  sedan: '#2563eb',
  suv: '#7c3aed',
};

/**
 * Top-down vehicle marker that rotates with the driver's heading. The returned element's
 * `style.transform` is updated via `setCarHeading` — `.car-marker` animates it smoothly.
 */
export function createCarMarker(type: VehicleType, heading = 0): HTMLElement {
  const color = VEHICLE_COLORS[type];
  const wrap = el('div', { width: '36px', height: '36px' }, { 'aria-label': `${type} nearby` });
  wrap.className = 'car-marker';
  wrap.style.transform = `rotate(${heading}deg)`;
  wrap.innerHTML = `
    <svg viewBox="0 0 36 36" width="36" height="36" aria-hidden="true">
      <circle cx="18" cy="18" r="16" fill="#fff" stroke="${color}" stroke-width="2" />
      <path d="M18 7.5c-2.6 0-4.3 1.7-4.6 4.2l-.5 5.1c-.1.5-.3.9-.7 1.3-.6.6-.9 1.4-.9 2.3v3.1c0 .8.6 1.4 1.4 1.4h.9c.4 1.1 1.4 1.9 2.7 1.9h4.6c1.3 0 2.3-.8 2.7-1.9h.9c.8 0 1.4-.6 1.4-1.4v-3.1c0-.9-.3-1.7-.9-2.3-.4-.4-.6-.8-.7-1.3l-.5-5.1c-.3-2.5-2-4.2-4.6-4.2Z" fill="${color}" />
      <path d="M15 12.5h6l.4 3.4h-6.8l.4-3.4Z" fill="#fff" fill-opacity=".85" />
    </svg>`;
  return wrap;
}

export function setCarHeading(node: HTMLElement, heading: number): void {
  node.style.transform = `rotate(${heading}deg)`;
}

/** Blue "you are here" dot with an accuracy halo. */
export function createUserDot(): HTMLElement {
  const wrap = el('div', { position: 'relative', width: '18px', height: '18px' }, { 'aria-label': 'Your location' });
  wrap.append(
    el('span', { position: 'absolute', inset: '-10px', borderRadius: '9999px', background: 'rgba(37,99,235,0.18)' }),
    el('span', {
      position: 'absolute',
      inset: '0',
      borderRadius: '9999px',
      background: '#2563eb',
      border: '3px solid #fff',
      boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
    }),
  );
  return wrap;
}
