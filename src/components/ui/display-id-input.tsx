import { forwardRef, InputHTMLAttributes } from 'react'

export interface DisplayIdInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  value: string
  onChange: (value: string) => void
}

/**
 * Specialized input for Display IDs that automatically:
 * - Converts to lowercase
 * - Replaces spaces with dashes
 */
export const DisplayIdInput = forwardRef<HTMLInputElement, DisplayIdInputProps>(
  ({ value, onChange, className = '', ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const normalized = e.target.value
        .toLowerCase()
        .replace(/\s+/g, '-')
      onChange(normalized)
    }

    return (
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={handleChange}
        className={`px-3 py-2 rounded-md border border-cyan-medium bg-background ${className}`}
        {...props}
      />
    )
  }
)

DisplayIdInput.displayName = 'DisplayIdInput'
