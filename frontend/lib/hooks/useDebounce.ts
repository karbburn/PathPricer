import { useEffect, useState } from "react";

/**
 * Custom hook providing a debounced value.
 *
 * @param value The input value to debounce.
 * @param delay Milliseconds to delay before updating debounced value (default 200ms).
 */
export function useDebounce<T>(value: T, delay: number = 200): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}
