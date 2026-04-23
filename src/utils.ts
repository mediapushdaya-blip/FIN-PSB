export const formatCurrency = (amount: number) => {
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  const formatted = new Intl.NumberFormat('id-ID', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(absAmount);
  return isNegative ? `(Rp ${formatted})` : `Rp ${formatted}`;
};

export const formatNumber = (amount: number) => {
  return new Intl.NumberFormat('id-ID').format(amount);
};

export const getLocalDateString = () => {
  const d = new Date();
  return new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
};

export const parseDateForInput = (dateStr: string) => {
  if (!dateStr) return getLocalDateString();
  try {
    if (dateStr.includes('T')) return dateStr.split('T')[0];
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return getLocalDateString();
    return new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
  } catch (e) {
    return getLocalDateString();
  }
};
