import { useEffect } from "react";
import { useLocation } from "wouter";

export default function FlPropertyTax() {
  const [, setLoc] = useLocation();
  useEffect(() => {
    setLoc("/education");
  }, []);
  return null;
}
