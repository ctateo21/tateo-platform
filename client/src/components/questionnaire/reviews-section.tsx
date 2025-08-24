import { Star, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const reviews = [
  {
    platform: "Google Business",
    rating: 5,
    reviewCount: 36,
    url: "https://www.google.com/search?sca_esv=3153b04427d9d7e5&rlz=1C1VDKB_enUS1131US1132&sxsrf=AE3TifMtiwGchEiRksytxnEFIn5DdOAfIw%3A1756047789665&q=Tateo%20%26%20Co&stick=H4sIAAAAAAAAAONgU1I1qLAwMjBOTjEzMko0M0m1MDK1MqhIMzc3TDUxTTY2NTYxN7cwWsTKFZJYkpqvoKbgnA8AjPMJQjYAAAA&mat=CZL5qvNwa3N4&ved=2ahUKEwj-qNjl26OPAxXhmbAFHfJjE7gQrMcEegQIIRAC",
    logo: "📧",
    color: "text-red-600"
  },
  {
    platform: "Zillow Realtor",
    rating: 5,
    reviewCount: 21,
    url: "https://www.zillow.com/profile/ctateo21",
    logo: "🏠",
    color: "text-blue-600"
  },
  {
    platform: "Zillow Lender",
    rating: 5,
    reviewCount: 23,
    url: "https://www.zillow.com/lender-profile/tateoco/",
    logo: "💰",
    color: "text-green-600"
  },
  {
    platform: "MortgageMatchup",
    rating: 5,
    reviewCount: 12,
    url: "https://mortgagematchup.com/Profile/tateoco?page=1",
    logo: "🏦",
    color: "text-purple-600"
  }
];

export function ReviewsSection() {
  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            className={`h-3 w-3 sm:h-4 sm:w-4 ${i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="mt-12 pt-8 border-t border-gray-200">
      <div className="text-center mb-4">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-1">
          Trusted by Our Clients
        </h3>
        <p className="text-xs sm:text-sm text-gray-600">
          See what our clients are saying across all platforms
        </p>
      </div>
      
      <div className="grid grid-cols-4 gap-2 sm:gap-4">
        {reviews.map((review, index) => (
          <Card key={index} className="hover:shadow-md transition-shadow">
            <CardContent className="p-2 sm:p-4 text-center">
              <a
                href={review.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block group"
              >
                <div className="flex items-center justify-center mb-1 sm:mb-2">
                  <span className="text-lg sm:text-2xl mr-1 sm:mr-2">{review.logo}</span>
                  <ExternalLink className="h-2 w-2 sm:h-3 sm:w-3 text-gray-400 group-hover:text-gray-600" />
                </div>
                <h4 className="font-semibold text-xs sm:text-sm text-gray-900 mb-1 sm:mb-2 leading-tight">
                  {review.platform}
                </h4>
                <div className="flex items-center justify-center mb-1 sm:mb-2">
                  {renderStars(review.rating)}
                  <span className="ml-1 sm:ml-2 text-xs sm:text-sm font-medium text-gray-900">
                    {review.rating}.0
                  </span>
                </div>
                <p className="text-xs text-gray-600">
                  {review.reviewCount} reviews
                </p>
              </a>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <div className="text-center mt-2 sm:mt-4">
        <p className="text-xs text-gray-500">
          "Powered by" indicates this is a verification badge
        </p>
      </div>
    </div>
  );
}