export const formatSAR = (n: number): string =>
  new Intl.NumberFormat("en-SA", { style: "currency", currency: "SAR" }).format(n);

export const noop = (): void => undefined;
