import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * Project typography utilities (text-display|title|body|label|meta) must NOT
 * conflict with Tailwind text-* color utilities — otherwise cn() strips
 * text-white from primary buttons and leaves dark gray on blue.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        'text-display',
        'text-title',
        'text-body',
        'text-label',
        'text-meta',
      ],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
