import { useEffect, useState } from "react";
import { ReviewCarousel } from "@/components/review-carousel";
import { GoogleReview } from "@/lib/google-reviews";
import { fetchGoogleReviews } from "@/lib/api-reviews";

export default function CTASection() {
  const [googleReviews, setGoogleReviews] = useState<GoogleReview[]>([]);
  const [isLoadingReviews, setIsLoadingReviews] = useState<boolean>(false);
  const [reviewsError, setReviewsError] = useState<string | null>(null);
  
  // Fetch Google Reviews when component mounts
  useEffect(() => {
    async function loadReviews() {
      setIsLoadingReviews(true);
      try {
        const reviews = await fetchGoogleReviews();
        setGoogleReviews(reviews);
        setReviewsError(null);
      } catch (error) {
        console.error('Error loading Google reviews:', error);
        setReviewsError('Unable to load reviews. Please try again later.');
      } finally {
        setIsLoadingReviews(false);
      }
    }
    
    loadReviews();
  }, []);

  return (
    <section id="testimonials" className="py-20 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            What Our Clients Say
          </h2>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            Don't just take our word for it. Here's what real clients have to say about their experience with Tateo & Co.
          </p>
        </div>
        
        {isLoadingReviews ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="mt-4 text-gray-600">Loading reviews...</p>
          </div>
        ) : reviewsError ? (
          <div className="text-center py-12">
            <p className="text-red-600">{reviewsError}</p>
          </div>
        ) : (
          <ReviewCarousel reviews={googleReviews} autoplayDelay={7000} />
        )}
      </div>
    </section>
  );
}