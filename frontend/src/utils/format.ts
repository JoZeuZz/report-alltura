export const formatFixedNumber = (
  value: number | string | null | undefined,
  decimals = 2
): string => {
  const numericValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numericValue)) {
    return (0).toFixed(decimals);
  }
  return numericValue.toFixed(decimals);
};

export const formatCubicMeters = (value: number | string | null | undefined): string => {
  return `${formatFixedNumber(value, 2)} m³`;
};
