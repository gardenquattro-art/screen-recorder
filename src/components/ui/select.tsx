import { twMerge } from 'tailwind-merge'
import { ChevronDown } from 'lucide-react'

interface SelectOption {
  value: string
  label: string
}

interface SelectProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  disabled?: boolean
  className?: string
}

export function Select({ value, onChange, options, disabled, className }: SelectProps) {
  return (
    <div className={twMerge('relative', className)}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={twMerge(
          'w-full appearance-none rounded-lg px-3 py-2 pr-8 text-sm',
          'bg-zinc-800 border border-zinc-700 text-zinc-200',
          'focus:outline-none focus:ring-1 focus:ring-zinc-500',
          'disabled:opacity-40 disabled:cursor-not-allowed',
          'cursor-pointer'
        )}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500"
      />
    </div>
  )
}
