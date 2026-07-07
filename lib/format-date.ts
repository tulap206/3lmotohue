const DD_MM_YYYY = /^(\d{2})\/(\d{2})\/(\d{4})$/
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/

function pad2(n: number) {
  return String(n).padStart(2, "0")
}

/** Parse common stored date strings without timezone drift. */
export function parseDisplayDate(value: string | Date | null | undefined): Date | null {
  if (value == null || value === "") return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value

  const raw = String(value).trim()
  const vn = DD_MM_YYYY.exec(raw)
  if (vn) {
    return new Date(Number(vn[3]), Number(vn[2]) - 1, Number(vn[1]))
  }

  const iso = ISO_DATE.exec(raw)
  if (iso) {
    return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
  }

  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

/** Display date as dd/mm/yyyy (e.g. 26/06/2026). */
export function formatDisplayDate(value: string | Date | null | undefined): string {
  if (value == null || value === "") return "—"

  const raw = String(value).trim()
  const vn = DD_MM_YYYY.exec(raw)
  if (vn) return `${vn[1]}/${vn[2]}/${vn[3]}`

  const date = parseDisplayDate(value)
  if (!date) return raw

  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`
}

/** Display datetime as dd/mm/yyyy HH:mm. */
export function formatDisplayDateTime(value: string | Date | null | undefined): string {
  if (value == null || value === "") return "—"

  const date = parseDisplayDate(value)
  if (!date) return String(value)

  return `${formatDisplayDate(date)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

/** Convert stored date to YYYY-MM-DD for HTML date inputs. */
export function toDateInputValue(value: string | Date | null | undefined): string {
  if (value == null || value === "") return ""

  const raw = String(value).trim()
  const vn = DD_MM_YYYY.exec(raw)
  if (vn) return `${vn[3]}-${vn[2]}-${vn[1]}`

  const iso = ISO_DATE.exec(raw)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`

  const date = parseDisplayDate(value)
  if (!date) return ""

  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

/** Format date-only value for persistence as dd/mm/yyyy. */
export function toStoredDateValue(value: string | Date | null | undefined): string {
  return formatDisplayDate(value)
}
