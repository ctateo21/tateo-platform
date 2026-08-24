export default function Accessibility() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16 max-w-3xl">
        <h1 className="text-3xl font-bold mb-2">Accessibility Statement</h1>
        <p className="text-muted-foreground text-sm mb-8">
          ADA Title III Compliance
        </p>

        <div className="prose prose-sm max-w-none space-y-6 text-muted-foreground">

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Our Commitment</h2>
            <p>Havo is committed to ensuring that our platform
            at havofl.com is accessible to people with disabilities
            in accordance with the Americans with Disabilities
            Act (ADA) Title III and Section 508 of the
            Rehabilitation Act.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Conformance Status</h2>
            <p>We aim to conform with the Web Content Accessibility
            Guidelines (WCAG) 2.1 at Level AA. We are continually
            working to improve the accessibility of our platform
            for users with visual, auditory, motor, or cognitive
            disabilities.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Accessibility Features</h2>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Keyboard navigation support throughout the platform</li>
              <li>Screen reader compatible elements
                with proper ARIA labels</li>
              <li>Sufficient color contrast ratios</li>
              <li>Resizable text without loss of functionality</li>
              <li>Alt text for images and icons</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Feedback &amp; Contact</h2>
            <p>If you experience any accessibility barriers
            while using our platform, please contact us. We will
            work to provide the information you need through
            an alternative accessible format.</p>
            <p className="mt-3">
              <strong>Email:</strong>{" "}
              sales@havofl.com<br />
              <strong>Phone:</strong>{" "}
              (813) 214-8356<br />
              <strong>Response time:</strong>{" "}
              We respond to accessibility feedback within 5 business
              days.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
