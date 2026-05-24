export function scrollToTop(behavior: ScrollBehavior = "smooth") {
  if (typeof window === "undefined") return;
  const doScroll = () => {
    try {
      window.scrollTo({ top: 0, left: 0, behavior });
    } catch {
      window.scrollTo(0, 0);
    }
    if (typeof document !== "undefined") {
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
    }
  };
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(doScroll);
  } else {
    doScroll();
  }
}
