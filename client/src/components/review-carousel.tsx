import React, { useCallback, useEffect, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import { Card, CardContent } from "@/components/ui/card";
import { Star, MessageSquare, ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GoogleReview } from '@/lib/google-reviews';

interface ReviewCarouselProps {
  reviews: GoogleReview[];
  autoplayDelay?: number;
}

export function ReviewCarousel({ reviews, autoplayDelay = 15000 }: ReviewCarouselProps) {
  // Initialize Embla carousel with autoplay plugin
  const autoplayOptions = {
    delay: autoplayDelay,
    stopOnInteraction: false,
    rootNode: (emblaRoot: any) => emblaRoot.parentElement,
  };

  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: 'start' }, [Autoplay(autoplayOptions)]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const scrollPrev = useCallback(() => emblaApi && emblaApi.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi && emblaApi.scrollNext(), [emblaApi]);

  // Track the current slide index and navigation states
  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onSelect);
    return () => {
      emblaApi.off('select', onSelect);
      emblaApi.off('reInit', onSelect);
    };
  }, [emblaApi, onSelect]);

  if (!reviews || reviews.length === 0) {
    return (
      <div className="bg-gray-50 p-6 rounded-lg text-center">
        <p className="text-gray-500">No reviews available at this time.</p>
      </div>
    );
  }

  return (
    <div className="relative mb-6">
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex">
          {reviews.map((review, index) => (
            <div className="flex-[0_0_100%] min-w-0 pl-4 pr-4" key={index}>
              <Card className="overflow-hidden border-gray-100 h-full">
                <CardContent className="p-6">
                  <div className="flex items-center mb-4">
                    <div className="mr-2 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                      {review.profile_photo_url ? (
                        <img 
                          src={review.profile_photo_url} 
                          alt={review.author_name} 
                          className="h-8 w-8 rounded-full object-cover"
                        />
                      ) : (
                        <MessageSquare className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-primary">{review.author_name}</h3>
                      <p className="text-sm text-gray-500">
                        {review.service || 'Tateo & Co Services'}
                        <span className="ml-2 text-gray-400">•</span>
                        <span className="ml-2 text-gray-400">{review.relative_time_description}</span>
                      </p>
                    </div>
                    <div className="ml-auto flex">
                      {[...Array(review.rating)].map((_, i) => (
                        <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      ))}
                      {review.rating < 5 && [...Array(5 - review.rating)].map((_, i) => (
                        <Star key={i} className="h-4 w-4 text-gray-300" />
                      ))}
                    </div>
                  </div>
                  <p className="text-gray-700 italic">"{`${review.text}`}"</p>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </div>

      {/* Navigation controls */}
      <div className="flex justify-between mt-4">
        <div className="flex gap-2">
          <Button
            onClick={scrollPrev}
            disabled={!canScrollPrev}
            variant="outline"
            size="sm"
            className="rounded-full p-2 h-10 w-10"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Button
            onClick={scrollNext}
            disabled={!canScrollNext}
            variant="outline"
            size="sm"
            className="rounded-full p-2 h-10 w-10"
          >
            <ArrowRight className="h-5 w-5" />
          </Button>
        </div>
        
        {/* Dots indicator */}
        <div className="flex gap-1 items-center">
          {reviews.map((_, index) => (
            <Button 
              key={index} 
              variant="ghost" 
              size="sm" 
              className={`h-2 w-2 rounded-full p-0 ${index === selectedIndex ? 'bg-primary' : 'bg-gray-300'}`}
              onClick={() => emblaApi?.scrollTo(index)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
