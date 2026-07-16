import { useEffect } from "react";
import { useLocation } from "wouter";

export default function FlInsuranceCost() {
  const [, setLoc] = useLocation();
  useEffect(() => {
    setLoc("/education");
  }, []);
  return null;
}
