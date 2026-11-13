/** Debounce fire-and-forget callbacks (Realtime refresh storms). */
export function debounce<T extends (...args: never[]) => void>(fn: T, waitMs: number) {
  let timer: ReturnType<typeof setTimeout> | null = null

  const debounced = (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      fn(...args)
    }, waitMs)
  }

  debounced.cancel = () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  return debounced
}
