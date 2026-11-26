import { forwardRef, MouseEvent, useRef } from "react";
import { Link, LinkProps } from "react-router-dom";

/**
 * Router Link that warms code chunks on hover / focus / touchstart.
 * Pass `prefetch={() => import("@/pages/Foo")}` for lazy routes.
 */
interface Props extends LinkProps {
  prefetch?: () => Promise<unknown>;
}

const PrefetchLink = forwardRef<HTMLAnchorElement, Props>(
  ({ prefetch, onMouseEnter, onFocus, onTouchStart, ...rest }, ref) => {
    const warmedRef = useRef(false);
    const warm = () => {
      if (warmedRef.current || !prefetch) return;
      warmedRef.current = true;
      try { void prefetch(); } catch { /* noop */ }
    };
    return (
      <Link
        ref={ref}
        {...rest}
        onMouseEnter={(e: MouseEvent<HTMLAnchorElement>) => { warm(); onMouseEnter?.(e); }}
        onFocus={(e) => { warm(); onFocus?.(e); }}
        onTouchStart={(e) => { warm(); onTouchStart?.(e); }}
      />
    );
  },
);
PrefetchLink.displayName = "PrefetchLink";

export default PrefetchLink;