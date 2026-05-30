import { useEffect } from "react";
import havoMockup from "./havo-mockup.html?raw";

export default function Havo() {
  useEffect(() => {
    const style = document.createElement("style");
    style.setAttribute("data-havo-demo", "true");
    style.textContent = "body > *:not(#root){display:none !important;}";
    document.head.appendChild(style);
    return () => {
      style.remove();
    };
  }, []);

  return (
    <iframe
      title="Havo — Every Step Home"
      srcDoc={havoMockup}
      className="fixed inset-0 h-screen w-screen border-0"
    />
  );
}
