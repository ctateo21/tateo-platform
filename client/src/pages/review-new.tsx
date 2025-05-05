import { Helmet } from "react-helmet";
import { Link } from "wouter";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Star, MessageSquare, ThumbsUp } from "lucide-react";

export default function Review() {  
  const [rating, setRating] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [message, setMessage] = useState<string>("");
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
      setRating("");
      setName("");
      setEmail("");
      setMessage("");
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

  const testimonials = [
    {
      name: "Jennifer R.",
      service: "Mortgage Services",
      rating: 5,
      comment: "Working with Tateo & Co on our mortgage was a game-changer! They secured us a fantastic rate and made the entire process smooth and stress-free."
    },
    {
      name: "David M.",
      service: "Real Estate",
      rating: 5,
      comment: "Our agent went above and beyond to help us find our dream home. Their market knowledge and negotiation skills were invaluable."
    },
    {
      name: "Sarah L.",
      service: "Insurance",
      rating: 5,
      comment: "Tateo & Co helped us find the perfect insurance coverage for our new home at a competitive rate. Their attention to detail ensured we had all the protection we needed."
    },
    {
      name: "Michael T.",
      service: "Property Management",
      rating: 5,
      comment: "As an out-of-state property owner, their property management services have been essential. They handle everything professionally and keep me updated regularly."
    }
  ];

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
      
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12">
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
                  <div className="space-y-2">
                    <Label>Which services did you use? (Select all that apply)</Label>
                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <div className="flex items-center space-x-2">
                        <input 
                          type="checkbox" 
                          id="realtor" 
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                          checked={selectedServices.realtor}
                          onChange={(e) => setSelectedServices({...selectedServices, realtor: e.target.checked})}
                        />
                        <Label htmlFor="realtor" className="font-normal">Realtor</Label>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <input 
                          type="checkbox" 
                          id="mortgage" 
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                          checked={selectedServices.mortgage}
                          onChange={(e) => setSelectedServices({...selectedServices, mortgage: e.target.checked})}
                        />
                        <Label htmlFor="mortgage" className="font-normal">Mortgage</Label>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <input 
                          type="checkbox" 
                          id="insurance" 
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                          checked={selectedServices.insurance}
                          onChange={(e) => setSelectedServices({...selectedServices, insurance: e.target.checked})}
                        />
                        <Label htmlFor="insurance" className="font-normal">Insurance</Label>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <input 
                          type="checkbox" 
                          id="propertyManagement" 
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                          checked={selectedServices.propertyManagement}
                          onChange={(e) => setSelectedServices({...selectedServices, propertyManagement: e.target.checked})}
                        />
                        <Label htmlFor="propertyManagement" className="font-normal">Property Management</Label>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <input 
                          type="checkbox" 
                          id="construction" 
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                          checked={selectedServices.construction}
                          onChange={(e) => setSelectedServices({...selectedServices, construction: e.target.checked})}
                        />
                        <Label htmlFor="construction" className="font-normal">Construction</Label>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <input 
                          type="checkbox" 
                          id="homeServices" 
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                          checked={selectedServices.homeServices}
                          onChange={(e) => setSelectedServices({...selectedServices, homeServices: e.target.checked})}
                        />
                        <Label htmlFor="homeServices" className="font-normal">Home Services</Label>
                      </div>
                    </div>
                    
                    {hasSelectedService && (
                      <div className="mt-4 text-center">
                        <p className="font-bold mb-2">Please leave your review on EACH site below:</p>
                        <div className="flex flex-col space-y-2">
                          <a 
                            href="https://www.google.com/maps/place//data=!4m3!3m2!1s0x8203cd622a64e825:0xf771e45c35347782!12e1?source=g.page.m.kd._&laa=lu-desktop-review-solicitation" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-primary hover:text-primary/80 underline font-medium"
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
                                href="https://www.zillow.com/mortgage/lender-review/?screenName=tateoco" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-primary hover:text-primary/80 underline font-medium"
                              >
                                Zillow LENDER
                              </a>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="rating">Rate your experience</Label>
                    <Select value={rating} onValueChange={setRating}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a rating" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">
                          <div className="flex items-center">
                            <span className="mr-2">5</span>
                            <div className="flex">
                              {[...Array(5)].map((_, i) => (
                                <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                              ))}
                            </div>
                            <span className="ml-2">Excellent</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="4">
                          <div className="flex items-center">
                            <span className="mr-2">4</span>
                            <div className="flex">
                              {[...Array(4)].map((_, i) => (
                                <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                              ))}
                              {[...Array(1)].map((_, i) => (
                                <Star key={i} className="h-4 w-4 text-gray-300" />
                              ))}
                            </div>
                            <span className="ml-2">Good</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="3">
                          <div className="flex items-center">
                            <span className="mr-2">3</span>
                            <div className="flex">
                              {[...Array(3)].map((_, i) => (
                                <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                              ))}
                              {[...Array(2)].map((_, i) => (
                                <Star key={i} className="h-4 w-4 text-gray-300" />
                              ))}
                            </div>
                            <span className="ml-2">Average</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="2">
                          <div className="flex items-center">
                            <span className="mr-2">2</span>
                            <div className="flex">
                              {[...Array(2)].map((_, i) => (
                                <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                              ))}
                              {[...Array(3)].map((_, i) => (
                                <Star key={i} className="h-4 w-4 text-gray-300" />
                              ))}
                            </div>
                            <span className="ml-2">Below Average</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="1">
                          <div className="flex items-center">
                            <span className="mr-2">1</span>
                            <div className="flex">
                              {[...Array(1)].map((_, i) => (
                                <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                              ))}
                              {[...Array(4)].map((_, i) => (
                                <Star key={i} className="h-4 w-4 text-gray-300" />
                              ))}
                            </div>
                            <span className="ml-2">Poor</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="name">Your Name</Label>
                    <Input 
                      id="name" 
                      type="text" 
                      placeholder="John Smith"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input 
                      id="email" 
                      type="email" 
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="message">Your Review</Label>
                    <Textarea 
                      id="message" 
                      placeholder="Please share your experience working with Tateo & Co..."
                      rows={5}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                    />
                  </div>
                  
                  <Button 
                    type="submit" 
                    className="bg-primary hover:bg-primary/90 text-white w-full"
                    disabled={submitting}
                  >
                    {submitting ? "Submitting..." : "Submit Review"}
                    {!submitting && <ArrowRight className="ml-2 h-4 w-4" />}
                  </Button>
                </form>
              )}
            </div>
            
            <div>
              <h2 className="text-3xl font-bold text-primary mb-6">Client Testimonials</h2>
              <p className="text-gray-600 mb-8">
                See what our clients are saying about their experience working with Tateo & Co.
              </p>
              
              <div className="space-y-6">
                {testimonials.map((testimonial, index) => (
                  <Card key={index} className="overflow-hidden border-gray-100 hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-center mb-4">
                        <div className="mr-2 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                          <MessageSquare className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-primary">{testimonial.name}</h3>
                          <p className="text-sm text-gray-500">{testimonial.service}</p>
                        </div>
                        <div className="ml-auto flex">
                          {[...Array(testimonial.rating)].map((_, i) => (
                            <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          ))}
                        </div>
                      </div>
                      <p className="text-gray-700 italic">"{testimonial.comment}"</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
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