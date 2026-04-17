import React from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

type ButtonVariant = 'default' | 'destructive' | 'outline' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

const variantClasses: Record<ButtonVariant, string> = {
  default: 'bg-zinc-100 text-zinc-900 hover:bg-zinc-200 active:bg-zinc-300',
  destructive: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800',
  outline: 'border border-zinc-600 text-zinc-300 hover:bg-zinc-800 active:bg-zinc-700',
  ghost: 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
}

export function Button({
  variant = 'default',
  size = 'md',
  className,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={twMerge(
        clsx(
          'inline-flex items-center justify-center gap-2 rounded-lg font-medium',
          'transition-colors duration-150 cursor-pointer',
          'disabled:opacity-40 disabled:cursor-not-allowed',
          variantClasses[variant],
          sizeClasses[size],
          className
        )
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}
