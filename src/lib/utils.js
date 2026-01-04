import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
  }).format(amount);
};

export const formatDate = (date) => {
    if (!date) return "";
    return new Date(date.seconds * 1000).toLocaleDateString("en-GB");
};

export const parseMultiplier = (value) => {
  if (typeof value === "number") return value || 1;
  if (!value) return 1;
  const str = value.toString().trim();
  if (str.includes("/")) {
    const [num, den] = str.split("/").map(Number);
    if (den && !Number.isNaN(num) && !Number.isNaN(den)) return num / den;
  }
  const num = parseFloat(str);
  return Number.isFinite(num) ? num : 1;
};

export const toFraction = (decimal) => {
  if (!Number.isFinite(decimal)) return "0";
  if (decimal === 0) return "0";
  if (decimal < 0) return "0";
  if (Number.isInteger(decimal)) return decimal.toString();

  const tolerence = 1e-6;
  for (let den = 1; den <= 64; den++) {
    const num = Math.round(decimal * den);
    if (Math.abs(num / den - decimal) < tolerence) {
      if (num === den) return "1";
      if (num < den) return `${num}/${den}`;
      const whole = Math.floor(num / den);
      const remainder = num % den;
      return remainder === 0 ? whole.toString() : `${whole} ${remainder}/${den}`;
    }
  }
  return decimal.toFixed(2);
};