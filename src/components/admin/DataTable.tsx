import Link from 'next/link';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Right-align numbers / amounts. */
  align?: 'left' | 'right';
  /** Hide from the stacked mobile card (secondary detail). */
  hideOnMobile?: boolean;
  className?: string;
}

interface DataTableProps<T> {
  caption: string;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** When set, the first column links here and the whole mobile card becomes tappable. */
  rowHref?: (row: T) => string;
}

/**
 * Admin list: a real `<table>` from `md` up, stacked cards below.
 * The first column is the row's title on mobile; the other visible columns become label/value pairs.
 * It is a Server Component — `cell` render functions never cross the client boundary.
 */
export function DataTable<T>({ caption, columns, rows, rowKey, rowHref }: DataTableProps<T>) {
  const [first, ...rest] = columns;
  if (!first) return null;

  return (
    <>
      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-2xl border border-border bg-card md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{caption}</caption>
            <thead className="border-b border-border bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                {columns.map((column) => (
                  <th key={column.key} scope="col" className={cn('whitespace-nowrap px-4 py-3 font-semibold', column.align === 'right' && 'text-right')}>
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={rowKey(row)} className="transition-colors hover:bg-muted/40">
                  {columns.map((column, index) => (
                    <td key={column.key} className={cn('px-4 py-3 align-middle', column.align === 'right' && 'text-right tabular-nums', column.className)}>
                      {index === 0 && rowHref ? (
                        <Link href={rowHref(row)} className="block rounded-md font-semibold hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                          {column.cell(row)}
                        </Link>
                      ) : (
                        column.cell(row)
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards */}
      <ul className="space-y-3 md:hidden" aria-label={caption}>
        {rows.map((row) => {
          const body = (
            <>
              <div className="font-semibold">{first.cell(row)}</div>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
                {rest
                  .filter((column) => !column.hideOnMobile)
                  .map((column) => (
                    <div key={column.key} className="min-w-0">
                      <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{column.header}</dt>
                      <dd className="mt-0.5 min-w-0 break-words">{column.cell(row)}</dd>
                    </div>
                  ))}
              </dl>
            </>
          );
          return (
            <li key={rowKey(row)}>
              {rowHref ? (
                <Link href={rowHref(row)} className="block rounded-2xl border border-border bg-card p-4 transition-colors hover:border-brand/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {body}
                </Link>
              ) : (
                <div className="rounded-2xl border border-border bg-card p-4">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
