import {
  createElement,
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
  type HTMLAttributes,
  type MutableRefObject,
  type ReactNode,
} from "react";

type VariantValue = {
  opacity?: number;
  y?: number | string;
  scale?: number;
  transition?: MotionTransition;
};

export type Variants = Record<string, VariantValue | { transition?: unknown }>;
type MotionTransition = {
  duration?: number;
  delay?: number;
  ease?: unknown;
  [key: string]: unknown;
};

type MotionProps = Omit<HTMLAttributes<HTMLElement>, "style"> & {
  children?: ReactNode;
  href?: string;
  variants?: Variants;
  initial?: string | VariantValue;
  animate?: string | VariantValue;
  whileInView?: string | VariantValue;
  viewport?: { once?: boolean; amount?: number };
  transition?: MotionTransition;
  style?: CSSProperties;
  className?: string;
};

function resolveVariant(value: string | VariantValue | undefined, variants?: Variants) {
  if (!value) return undefined;
  if (typeof value === "string") {
    const variant = variants?.[value];
    return variant ? (variant as VariantValue) : undefined;
  }
  return value;
}

function toStyle(variant?: VariantValue, transition?: MotionTransition): CSSProperties {
  const transformParts: string[] = [];
  if (typeof variant?.y === "number") {
    transformParts.push(`translateY(${variant.y}px)`);
  }
  if (typeof variant?.y === "string") {
    const value = /^-?\d+(?:\.\d+)?$/.test(variant.y) ? `${variant.y}px` : variant.y;
    transformParts.push(`translateY(${value})`);
  }
  if (typeof variant?.scale === "number") {
    transformParts.push(`scale(${variant.scale})`);
  }

  const duration = transition?.duration ?? variant?.transition?.duration ?? 0.7;
  const delay = transition?.delay ?? variant?.transition?.delay ?? 0;

  return {
    opacity: variant?.opacity,
    transform: transformParts.length ? transformParts.join(" ") : undefined,
    transition: `opacity ${duration}s cubic-bezier(0.22, 1, 0.36, 1) ${delay}s, transform ${duration}s cubic-bezier(0.22, 1, 0.36, 1) ${delay}s`,
  };
}

function createMotionComponent(tag: ElementType) {
  return forwardRef<HTMLElement, MotionProps>(function MotionComponent(
    {
      variants,
      initial,
      animate,
      whileInView,
      viewport,
      transition,
      style,
      ...rest
    },
    ref,
  ) {
    const localRef = useRef<HTMLElement | null>(null);
    const [active, setActive] = useState(() => !initial);
    const initialVariant = useMemo(() => resolveVariant(initial, variants), [initial, variants]);
    const targetVariant = useMemo(
      () => resolveVariant(animate ?? whileInView, variants),
      [animate, whileInView, variants],
    );

    useEffect(() => {
      if (animate) {
        const id = window.setTimeout(() => setActive(true), 20);
        return () => window.clearTimeout(id);
      }

      if (!whileInView || !localRef.current) return undefined;

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setActive(true);
            if (viewport?.once !== false) observer.disconnect();
          }
        },
        { threshold: viewport?.amount ?? 0.2 },
      );

      observer.observe(localRef.current);
      return () => observer.disconnect();
    }, [animate, viewport?.amount, viewport?.once, whileInView]);

    const motionStyle = toStyle(active ? targetVariant : initialVariant, transition);

    return createElement(tag, {
      ...rest,
      ref: (node: HTMLElement | null) => {
        localRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) (ref as MutableRefObject<HTMLElement | null>).current = node;
      },
      style: { ...motionStyle, ...style },
    });
  });
}

export const motion = {
  a: createMotionComponent("a"),
  article: createMotionComponent("article"),
  div: createMotionComponent("div"),
  h1: createMotionComponent("h1"),
  p: createMotionComponent("p"),
  section: createMotionComponent("section"),
  span: createMotionComponent("span"),
};
