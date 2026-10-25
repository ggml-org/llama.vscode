// Small number formatting helpers used by the agent composer.
// They keep the metrics row short: 1.2k tokens, $0.0021 - never toFixed(8).

export const formatTokens = (tokens: number): string => {
  const value = Math.round(Number.isFinite(tokens) ? tokens : 0);
  if (value <= 0) return '0';
  if (value < 1000) return String(value);
  // Choose the unit from the value that will actually be displayed, so 999_999
  // becomes "1.0M" instead of "1000k".
  if (value < 999500) {
    return (value < 10000 ? (value / 1000).toFixed(1) : String(Math.round(value / 1000))) + 'k';
  }
  const millions = value / 1000000;
  return (millions < 10 ? millions.toFixed(1) : String(Math.round(millions))) + 'M';
};

// Returns '' when there is nothing meaningful to show so the caller can skip
// rendering the price at all (most local models are free).
export const formatPrice = (price: number): string => {
  if (!price || !Number.isFinite(price) || price <= 0) return '';
  if (price < 0.0001) return '<$0.0001';
  if (price < 1) return '$' + price.toFixed(4);
  return '$' + price.toFixed(2);
};

export const formatFullNumber = (value: number): string =>
  Math.round(Number.isFinite(value) ? value : 0).toLocaleString();
