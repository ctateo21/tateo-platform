export default function Privacy() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16 max-w-3xl">
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground text-sm mb-8">
          Last updated: July 2026
        </p>

        <div className="prose prose-sm max-w-none space-y-6 text-muted-foreground">

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Information We Collect</h2>
            <p>We collect information you provide directly, including
            your name, email address, phone number, and property
            addresses entered into our platform. We also collect
            usage data including pages visited, features used, and
            scenarios calculated.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">How We Use Your Information</h2>
            <p>We use your information to provide the services you
            request, communicate with you about your real estate,
            mortgage, and insurance needs, improve our platform,
            comply with legal obligations, and, with your
            consent, send you updates and alerts via email or
            SMS text message.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Gramm-Leach-Bliley Act (GLBA) Notice</h2>
            <p>In connection with mortgage services provided through
            Barrett Financial Group LLC (NMLS #181106), we may collect
            nonpublic personal financial information. This information
            is used solely to provide you with mortgage services and is
            shared only as permitted or required by law. We do not
            sell your personal financial information to third parties
            for marketing purposes.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Insurance Information</h2>
            <p>Property details you enter for insurance estimates may
            be shared with licensed insurance carriers through
            QuoteRUSH for the purpose of obtaining quotes. This sharing
            is limited to what is necessary to provide you
            with quotes and is governed by carrier privacy policies
            and Florida insurance law.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">SMS Text Messages</h2>
            <p>If you consent to receive text messages, your phone
            number will only be used to send messages related to
            your real estate, mortgage, and insurance inquiries.
            Message and data rates may apply. Reply STOP to opt out
            at any time. See our{" "}
            <a href="/sms-terms" className="underline text-primary">
              SMS &amp; Text Terms
            </a>{" "}
            for full details.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Data Security</h2>
            <p>We implement industry-standard security
            measures including encryption, secure servers,
            and access controls to protect your personal
            information in compliance with the Florida Information
            Protection Act (FIPA).</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Third-Party Services</h2>
            <p>We use trusted third-party services including Supabase
            (data storage), PostHog (analytics), Resend (email),
            and FollowUpBoss (CRM). Each is governed by their own
            privacy policy and complies with applicable data
            protection laws.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Your Rights</h2>
            <p>You have the right to access, correct, or request
            deletion of your personal information. To exercise
            these rights, contact us at sales@havofl.com. We will
            respond within 30 days.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Contact</h2>
            <p>Privacy questions: sales@havofl.com or
            (813) 214-8356.</p>
          </section>

        </div>
      </div>
    </div>
  );
}
