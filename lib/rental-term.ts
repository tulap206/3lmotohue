export type RentalTerm = "short" | "long"

const TERM_TAG_RE = /^\[rentalTerm:(short|long)\]\s*/i

export function getRentalTermLabel(term?: string | null): string {
  return term === "long" ? "Thuê dài hạn" : "Thuê ngắn hạn"
}

/** Prefer explicit column; fall back to notes tag; default short for legacy rows. */
export function getRentalTerm(order: {
  rentalTerm?: string | null
  notes?: string | null
}): RentalTerm {
  if (order.rentalTerm === "long" || order.rentalTerm === "short") {
    return order.rentalTerm
  }
  const match = (order.notes || "").match(TERM_TAG_RE)
  if (match?.[1]?.toLowerCase() === "long") return "long"
  if (match?.[1]?.toLowerCase() === "short") return "short"
  return "short"
}

export function stripRentalTermFromNotes(notes?: string | null): string {
  return (notes || "").replace(TERM_TAG_RE, "").trimStart()
}

export function embedRentalTermInNotes(notes: string | null | undefined, term: RentalTerm): string {
  const clean = stripRentalTermFromNotes(notes)
  return clean ? `[rentalTerm:${term}]\n${clean}` : `[rentalTerm:${term}]`
}

/** Build notes + optional rentalTerm column for Supabase write. */
export function buildRentalTermPayload(
  term: RentalTerm,
  notes?: string | null
): { rentalTerm: RentalTerm; notes: string } {
  return {
    rentalTerm: term,
    notes: embedRentalTermInNotes(notes, term),
  }
}
