export interface ScrollToTopOptions {
  behavior?: ScrollBehavior;
}

export const scrollPageToTop = (options?: ScrollToTopOptions) => {
  if (typeof window === 'undefined' || typeof window.scrollTo !== 'function') {
    return;
  }

  const { behavior = 'smooth' } = options ?? {};

  window.scrollTo({ top: 0, left: 0, behavior });
};

export default scrollPageToTop;
