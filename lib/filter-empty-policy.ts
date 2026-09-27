/** Whether to ask the visitor to change their filters because the ones they
 *  just applied match nothing.
 *
 *  Owner request 2026-09-27: applying a combination that matches zero places
 *  left the map blank with no explanation. The prompt is a modal, so the
 *  policy is narrow on purpose — every input below is a reason NOT to ask,
 *  and all of them must be clear for the modal to appear.
 *
 *  - Only right after an Apply. A map that empties because the visitor panned
 *    into the sea, or because data changed underneath, is not a filter
 *    problem, and asking then would be nagging.
 *  - Only when at least one filter is on. With none on, there is nothing to
 *    reset.
 *  - Only when the result is actually empty. */
export type FilterEmptyState = {
  resultCount: number;
  activeFilters: number;
  justApplied: boolean;
};

export function shouldOfferFilterReset(state: FilterEmptyState): boolean {
  if (!state.justApplied) return false;
  if (state.activeFilters === 0) return false;
  return state.resultCount === 0;
}
