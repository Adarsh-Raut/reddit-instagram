"use client";

import { useRef } from "react";

/**
 * Errors clear when a field gains focus. After a failed submit we also move focus to the first
 * invalid field in code; that focus must not wipe the error we just showed.
 */
export function useProgrammaticFocus() {
  const programmatic = useRef(false);
  return {
    focus(el: HTMLElement | null | undefined) {
      programmatic.current = true;
      try {
        el?.focus();
      } finally {
        programmatic.current = false;
      }
    },
    /** True while `focus()` above is running; use it to skip clear-on-focus. */
    isProgrammatic: () => programmatic.current,
  };
}
