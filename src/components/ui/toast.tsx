import { useEffect } from 'react'
import { twMerge } from 'tailwind-merge'
import { CheckCircle, XCircle, X } from 'lucide-react'

export type ToastType = 'success' | 'error'

interface ToastProps {
  message: string
  type: ToastType
  onClose: () => void
  duration?: number
}

export function Toast({ message, type, onClose, duration = 4000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration)
    return () => clearTimeout(timer)
  }, [onClose, duration])

  return (
    <div
      className={twMerge(
        'flex items-start gap-3 rounded-lg px-4 py-3 text-sm shadow-lg',
        'border transition-all duration-300',
        type === 'success'
          ? 'bg-zinc-900 border-green-800 text-green-300'
          : 'bg-zinc-900 border-red-800 text-red-300'
      )}
    >
      {type === 'success' ? (
        <CheckCircle size={16} className="mt-0.5 shrink-0 text-green-400" />
      ) : (
        <XCircle size={16} className="mt-0.5 shrink-0 text-red-400" />
      )}
      <span className="flex-1 leading-relaxed">{message}</span>
      <button
        onClick={onClose}
        className="shrink-0 text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  )
}
