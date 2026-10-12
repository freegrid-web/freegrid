/**
 * Parses a date string. An ISO date (`YYYY-MM-DD`) is read as local midnight, not UTC midnight as `new Date()` does.
 */
export const getNormalizedDate = (dateString: string): Date => {
  const nativeDate = new Date(dateString);

  // NaN if dateString is not in ISO format
  if (!Number.isNaN(new Date(`${dateString}T00:00`).getDate())) {
    // Compensate timezone offset
    return new Date(nativeDate.getTime() + (nativeDate.getTimezoneOffset() * 60000));
  }

  return nativeDate;
};
