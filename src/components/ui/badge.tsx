import React from 'react'
import { twMerge } from 'tailwind-merge'

type BadgeVariant = 'default' | 'recording' | 'success' | 'error'

interface BadgeProps {
  variant?: BadgeVariant
  className?: string
  children: React.ReactNode
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-zinc-700 text-zinc-300',
  recording: 'bg-red-900/50 text-red-400 border border-red-800',
  success: 'bg-green-900/50 text-green-400 border border-green-800',
  error: 'bg-red-900/50 text-red-400 border border-red-800',
}

export function Badge({ variant = 'default', className, children }: BadgeProps) {
  return (
    <span
      className={twMerge(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  )
}
