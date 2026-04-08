export function getDateRangeFromParams(searchParams: {
  range?: string;
  from?: string;
  to?: string;
}): { startDate: Date | null; endDate: Date | null } {
  const now = new Date();

  if (searchParams.range === '7d') {
    return {
      startDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      endDate: now
    };
  }
  if (searchParams.range === '30d') {
    return {
      startDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      endDate: now
    };
  }
  if (searchParams.range === '365d') {
    return {
      startDate: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
      endDate: now
    };
  }
  if (searchParams.from && searchParams.to) {
    return {
      startDate: new Date(searchParams.from),
      endDate: new Date(searchParams.to)
    };
  }

  // All time — no filter
  return { startDate: null, endDate: null };
}
