export function getBeginningOfMonthTimestamp(params: {
  year: number;
  month: number;
}) {
  return new Date(params.year, params.month - 1, 0).getTime();
}
