import { Helmet } from "react-helmet";
import { Link } from "wouter";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Star, MessageSquare, ThumbsUp, Loader2 } from "lucide-react";
import { type GoogleReview } from "@/lib/google-reviews";
import { fetchGoogleReviews } from "@/lib/api-reviews";
import { ReviewCarousel } from "@/components/review-carousel";

export default function Review() {  
  // State for selected agents
  const [selectedAgents, setSelectedAgents] = useState<{
    christian: boolean;
    omar: boolean;
  }>({
    christian: false,
    omar: false
  });
  
  // State for selected services
  const [selectedServices, setSelectedServices] = useState<{
    realtor: boolean;
    mortgage: boolean;
    insurance: boolean;
    propertyManagement: boolean;
    construction: boolean;
    homeServices: boolean;
  }>({ 
    realtor: false, 
    mortgage: false, 
    insurance: false, 
    propertyManagement: false, 
    construction: false, 
    homeServices: false 
  });
  
  // Check if any service is selected
  const hasSelectedService = Object.values(selectedServices).some(value => value === true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitted, setSubmitted] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    // In a real implementation, you would send the data to a server
    // For now, we'll just simulate a successful submission
    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
      // Reset form
      setSelectedAgents({
        christian: false,
        omar: false
      });
      setSelectedServices({ 
        realtor: false, 
        mortgage: false, 
        insurance: false, 
        propertyManagement: false, 
        construction: false, 
        homeServices: false 
      });
    }, 1500);
  };

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
    <div>
      <Helmet>
        <title>Review Your Experience | Tateo & Co</title>
      </Helmet>

      <div className="py-10 bg-primary/5">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl font-bold text-primary mb-4">Review Your Experience</h1>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            Your feedback helps us improve and better serve our clients. Share your experience working with Tateo & Co.
          </p>
        </div>
      </div>
      
      <section className="py-8 md:py-16">
        <div className="container mx-auto px-2 sm:px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-12">
            <div>
              <h2 className="text-3xl font-bold text-primary mb-6">Leave Your Review</h2>
              <p className="text-gray-600 mb-8">
                We value your feedback and would love to hear about your experience working with our team. 
                Please take a moment to share your thoughts and help us continue to improve our services.
              </p>
              
              {submitted ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                  <ThumbsUp className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-green-700 mb-2">Thank You for Your Review!</h3>
                  <p className="text-green-600 mb-4">
                    We appreciate you taking the time to share your experience with us. 
                    Your feedback helps us improve our services and better serve our clients.
                  </p>
                  <Button 
                    onClick={() => setSubmitted(false)}
                    className="bg-primary hover:bg-primary/90 text-white"
                  >
                    Submit Another Review
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Agent Selection */}
                  <div className="space-y-2 border-2 border-primary/20 rounded-lg p-3 sm:p-4 bg-primary/5">
                    <Label className="text-base sm:text-lg font-semibold text-primary">Who did you work with?</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 pt-2">
                      <div className="flex items-center space-x-2 sm:space-x-3">
                        <input 
                          type="checkbox" 
                          id="christian-agent" 
                          className="h-4 w-4 sm:h-5 sm:w-5 rounded border-gray-300 text-primary focus:ring-primary"
                          checked={selectedAgents.christian}
                          onChange={(e) => setSelectedAgents({...selectedAgents, christian: e.target.checked})}
                        />
                        <Label htmlFor="christian-agent" className="font-medium text-sm sm:text-base">Christian</Label>
                      </div>
                      
                      <div className="flex items-center space-x-2 sm:space-x-3">
                        <input 
                          type="checkbox" 
                          id="omar-agent" 
                          className="h-4 w-4 sm:h-5 sm:w-5 rounded border-gray-300 text-primary focus:ring-primary"
                          checked={selectedAgents.omar}
                          onChange={(e) => setSelectedAgents({...selectedAgents, omar: e.target.checked})}
                        />
                        <Label htmlFor="omar-agent" className="font-medium text-sm sm:text-base">Omar</Label>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm sm:text-base">Which services did you use? (Select all that apply)</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                      <div className="flex items-center space-x-2">
                        <input 
                          type="checkbox" 
                          id="realtor" 
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary flex-shrink-0"
                          checked={selectedServices.realtor}
                          onChange={(e) => setSelectedServices({...selectedServices, realtor: e.target.checked})}
                        />
                        <Label htmlFor="realtor" className="font-normal text-sm sm:text-base">Realtor</Label>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <input 
                          type="checkbox" 
                          id="mortgage" 
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary flex-shrink-0"
                          checked={selectedServices.mortgage}
                          onChange={(e) => setSelectedServices({...selectedServices, mortgage: e.target.checked})}
                        />
                        <Label htmlFor="mortgage" className="font-normal text-sm sm:text-base">Mortgage</Label>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <input 
                          type="checkbox" 
                          id="insurance" 
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary flex-shrink-0"
                          checked={selectedServices.insurance}
                          onChange={(e) => setSelectedServices({...selectedServices, insurance: e.target.checked})}
                        />
                        <Label htmlFor="insurance" className="font-normal text-sm sm:text-base">Insurance</Label>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <input 
                          type="checkbox" 
                          id="propertyManagement" 
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary flex-shrink-0"
                          checked={selectedServices.propertyManagement}
                          onChange={(e) => setSelectedServices({...selectedServices, propertyManagement: e.target.checked})}
                        />
                        <Label htmlFor="propertyManagement" className="font-normal text-sm sm:text-base">Property Management</Label>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <input 
                          type="checkbox" 
                          id="construction" 
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary flex-shrink-0"
                          checked={selectedServices.construction}
                          onChange={(e) => setSelectedServices({...selectedServices, construction: e.target.checked})}
                        />
                        <Label htmlFor="construction" className="font-normal text-sm sm:text-base">Construction</Label>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <input 
                          type="checkbox" 
                          id="homeServices" 
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary flex-shrink-0"
                          checked={selectedServices.homeServices}
                          onChange={(e) => setSelectedServices({...selectedServices, homeServices: e.target.checked})}
                        />
                        <Label htmlFor="homeServices" className="font-normal text-sm sm:text-base">Home Services</Label>
                      </div>
                    </div>
                    
                    {hasSelectedService && (
                      <div className="mt-4 text-left">
                        <p className="font-bold mb-2 text-sm sm:text-base">Please leave your review on EACH site below:</p>
                        <div className="flex flex-col space-y-2 text-left break-words overflow-hidden">
                          <a 
                            href="https://www.google.com/maps/place//data=!4m3!3m2!1s0x8203cd622a64e825:0xf771e45c35347782!12e1?source=g.page.m.kd._&laa=lu-desktop-review-solicitation" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-primary hover:text-primary/80 underline font-medium text-sm sm:text-base break-all"
                          >
                            Google My Business
                          </a>
                          
                          {selectedServices.mortgage && (
                            <>
                              <a 
                                href="https://mortgagematchup.com/Profile/tateoco?page=1" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-primary hover:text-primary/80 underline font-medium"
                              >
                                Mortgage Matchup
                              </a>
                              
                              <a 
                                href={
                                  selectedAgents.omar
                                    ? "https://www.zillow.com/lender-profile/OmarA0809/"
                                    : "https://www.zillow.com/mortgage/lender-review/?screenName=tateoco"
                                }
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-primary hover:text-primary/80 underline font-medium"
                              >
                                Zillow LENDER
                              </a>
                            </>
                          )}
                          
                          {selectedServices.realtor && (
                            <a 
                              href={
                                selectedAgents.christian && selectedAgents.omar 
                                  ? "https://www.zillow.com/lender-profile/OmarA0809/"
                                  : "https://www.zillow.com/user/acct/login/?entry_point=redirect&url=%2Freviews%2Fwrite%2F%3Fs%3DX1-ZU1094ao4brvy15_9od0t"
                              }
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-primary hover:text-primary/80 underline font-medium"
                            >
                              Zillow REALTOR
                            </a>
                          )}
                          
                          {selectedServices.propertyManagement && (
                            <a 
                              href="https://www.google.com/search?q=company+called+furnished+flats+google+reviews&sca_esv=8e26205c2bafb5f9&rlz=1C1VDKB_enUS1131US1132&biw=1433&bih=1038&tbm=lcl&sxsrf=AHTn8zoOxnJu6qAAcQqIxbexxHR1hVlObQ%3A1746467461916&ei=hfoYaILbN7uUwbkP_PPpkQQ&ved=0ahUKEwjCsbel8oyNAxU7SjABHfx5OkIQ4dUDCAo&uact=5&oq=company+called+furnished+flats+google+reviews&gs_lp=Eg1nd3Mtd2l6LWxvY2FsIi1jb21wYW55IGNhbGxlZCBmdXJuaXNoZWQgZmxhdHMgZ29vZ2xlIHJldmlld3MyBRAhGKABMgUQIRigATIFECEYoAEyBRAhGKABSONEUNEVWO5DcAN4AJABAZgBswGgAbEqqgEFMTEuMze4AQPIAQD4AQGYAjGgArEqwgIEECMYJ8ICCBAAGKIEGIkFwgIFEAAY7wXCAggQABiABBiiBMICCxAAGIAEGJECGIoFwgIOEAAYgAQYsQMYgwEYigXCAgsQABiABBixAxiDAcICCBAAGIAEGLEDwgIKEAAYgAQYQxiKBcICDRAAGIAEGLEDGEMYigXCAgoQABiABBgUGIcCwgIFEAAYgATCAgcQABiABBgKwgIGEAAYFhgewgIIEAAYFhgKGB7CAgsQABiABBiGAxiKBcICBRAhGJ8FwgIFECEYqwLCAgcQIRigARgKmAMAiAYBkgcFMTEuMzigB7zRArIHBDguMzi4B6Mq&sclient=gws-wiz-local#lkt=LocalPoiReviews&rlfi=hd:;si:15851102711039641024,l,Ci1jb21wYW55IGNhbGxlZCBmdXJuaXNoZWQgZmxhdHMgZ29vZ2xlIHJldmlld3MiA4gBAUjKt4CslbiAgAhaPxAAEAEQAhADEAQQBRgCGAMiLWNvbXBhbnkgY2FsbGVkIGZ1cm5pc2hlZCBmbGF0cyBnb29nbGUgcmV2aWV3c3oOU3QuIFBldGVyc2J1cmeSARtwcm9wZXJ0eV9tYW5hZ2VtZW50X2NvbXBhbnmqAcYBCg0vZy8xMWM1OXAwZzhuCgkvbS8wNDVjN2IKCy9nLzEyMHoxOGwzCgkvbS8wMW5ibHQKCS9tLzAybXoxZBABKjEiLWNvbXBhbnkgY2FsbGVkIGZ1cm5pc2hlZCBmbGF0cyBnb29nbGUgcmV2aWV3cygAMh8QASIb4OwIODG_XAD0Q1WkBS3nKqcvv-gCyE2W0JMoMjEQAiItY29tcGFueSBjYWxsZWQgZnVybmlzaGVkIGZsYXRzIGdvb2dsZSByZXZpZXdz4AEA;mv:[[27.812263607249385,-82.58539773672517],[27.676584457822006,-82.75586911159799]]&lrd=0x2bc318c6080dab3:0xdbfa6deed5bfc5c0,3,,,," 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-primary hover:text-primary/80 underline font-medium"
                            >
                              Property Management Review
                            </a>
                          )}
                          
                          <a 
                            href="https://www.facebook.com/login/?next=https%3A%2F%2Fwww.facebook.com%2Fprofile.php%3Fid%3D100086591377788&sk=reviews&utm_source=website&utm_medium=review_form&utm_campaign=review" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-primary hover:text-primary/80 underline font-medium"
                          >
                            Facebook Review
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                    {hasSelectedService && (
                      <div className="flex justify-start mt-6">
                        <Button 
                          type="submit" 
                          className="bg-primary hover:bg-primary/90 text-white"
                          disabled={submitting}
                        >
                          {submitting ? "Submitting..." : "Back"}
                        </Button>
                      </div>
                    )}
                </form>
              )}
            </div>
            
            <div>
              <h2 className="text-3xl font-bold text-primary mb-6">Client Testimonials</h2>
              <p className="text-gray-600 mb-8">
                See what our clients are saying about their experience working with Tateo & Co.
              </p>
              
              {isLoadingReviews ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 text-primary animate-spin mb-4" />
                  <p className="text-gray-600">Loading reviews...</p>
                </div>
              ) : reviewsError ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                  <p className="text-red-600">{reviewsError}</p>
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-100">
                  <div className="p-4 md:p-6">
                    <ReviewCarousel reviews={googleReviews} autoplayDelay={15000} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-6 text-primary">Ready to Experience Our Services?</h2>
            <p className="text-gray-600 mb-8">Discover why our clients consistently rate us highly for our professional services.</p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button asChild className="bg-primary hover:bg-primary/90 text-white">
                <Link href="/questionnaire">
                  Get Started <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild className="bg-secondary hover:bg-secondary/90 text-white">
                <Link href="/#contact">
                  Contact Us <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}