import { useEffect } from "react";
import { useLocation } from "wouter";

export default function FlFloodZones() {
  const [, setLoc] = useLocation();
  useEffect(() => {
    setLoc("/education");
  }, []);
  return null;
}
