const audFormatter = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const formatAUD = (cents: number): string => {
  return audFormatter.format(centsToAUD(cents));
};

export const centsToAUD = (cents: number): number => {
  return cents / 100;
};

export const audToCents = (dollars: number): number => {
  return Math.round(dollars * 100);
};
