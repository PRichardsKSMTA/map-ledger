import type { HTMLAttributes, ReactNode } from 'react';
import { createPortal } from 'react-dom';

type ModalBackdropProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export default function ModalBackdrop({ children, ...rest }: ModalBackdropProps) {
  const portalTarget = typeof document !== 'undefined' ? document.body : null;
  const backdrop = <div {...rest}>{children}</div>;
  return portalTarget ? createPortal(backdrop, portalTarget) : backdrop;
}
