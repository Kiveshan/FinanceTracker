/**
 * Shared formatting utilities for the FinanceTracker app.
 * Single source of truth — avoids duplicate formatCurrency / formatDate
 * definitions across 10+ component files.
 */

const currencyFormatter = new Intl.NumberFormat('en-ZA', {
  style: 'currency',
  currency: 'ZAR',
  minimumFractionDigits: 2,
})

const currencyFormatterShort = new Intl.NumberFormat('en-ZA', {
  style: 'currency',
  currency: 'ZAR',
  minimumFractionDigits: 0,
})

export function formatCurrency(amount: number, short = false): string {
  return short
    ? currencyFormatterShort.format(amount)
    : currencyFormatter.format(amount)
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function formatDateShort(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'short',
  })
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

export function formatMonth(yyyyMM: string): string {
  const [year, month] = yyyyMM.split('-')
  const date = new Date(Number(year), Number(month) - 1)
  return date.toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })
}
