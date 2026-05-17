import { Helmet } from "react-helmet";
import { useSearch } from "wouter";

export default function Estimate() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const address = params.get("address") || "";

  return (
    <>
      <Helmet>
        <title>Estimate — {address}</title>
      </Helmet>
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-lg">
          <h1 className="text-3xl font-bold text-primary mb-3">Coming Soon</h1>
          <p className="text-muted-foreground text-lg mb-2">
            Generating estimate for:
          </p>
          <p className="text-xl font-semibold text-foreground">{address}</p>
        </div>
      </div>
    </>
  );
}
