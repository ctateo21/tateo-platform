export default function FairHousing() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16 max-w-3xl">
        <h1 className="text-3xl font-bold mb-2">Fair Housing Notice</h1>
        <p className="text-muted-foreground text-sm mb-8">
          Federal Fair Housing Act Compliance
        </p>

        <div className="prose prose-sm max-w-none space-y-6 text-muted-foreground">

          <div className="bg-primary/5 border border-primary/20 rounded-xl p-6 mb-6">
            <p className="text-foreground font-medium text-sm leading-relaxed">
              We are pledged to the letter and spirit of U.S. policy for
              the achievement of equal housing opportunity throughout
              the nation. We encourage and support an affirmative
              advertising and marketing program in which there are no
              barriers to obtaining housing because of race, color,
              religion, sex, handicap, familial status, or national
              origin.
            </p>
          </div>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Federal Fair Housing Act</h2>
            <p>All real estate advertised on this website is subject to
            the Federal Fair Housing Act (42 U.S.C. §§ 3601–3619),
            which makes it illegal to advertise any preference,
            limitation, or discrimination because of race, color,
            religion, sex, handicap, familial status, or national
            origin, or intention to make any such preference,
            limitation, or discrimination.</p>
            <p className="mt-3">All persons are hereby informed that all
            dwellings advertised are available on an equal
            opportunity basis.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Florida Fair Housing Act</h2>
            <p>Real estate services are also subject to the Florida
            Fair Housing Act (Chapter 760, Florida Statutes), which
            prohibits discrimination in housing based on race, color,
            national origin, sex, disability, familial status,
            or religion, and additionally protects against discrimination
            based on age and marital status under Florida law.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Equal Credit Opportunity</h2>
            <p>Mortgage services are provided in compliance with
            the Equal Credit Opportunity Act (ECOA), which prohibits
            discrimination against credit applicants on the basis of
            race, color, religion, national origin, sex, marital
            status, age, or because any part of the applicant's income
            derives from a public assistance program.</p>
            <p className="mt-3">Barrett Financial Group LLC (NMLS
            #181106) is an Equal Housing Opportunity Lender.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Our Commitment</h2>
            <p>Havo, Horizons By The Sea, Inc (License #CQ216715), and
            all affiliated professionals are committed to complying
            with both the letter and spirit of all fair housing
            and equal credit laws. We will not, on the basis of any
            protected class:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Refuse to show, sell, rent, or negotiate housing</li>
              <li>Discriminate in the terms or conditions of any
                housing transaction</li>
              <li>Discriminate in providing brokerage services</li>
              <li>Deny a mortgage loan or impose different terms
                based on a protected characteristic</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Filing a Complaint</h2>
            <p>If you believe you have been discriminated against in
            housing, contact:</p>
            <ul className="mt-2 space-y-1">
              <li><strong>HUD:</strong>{" "}
                1-800-669-9777 or{" "}
                <a
                  href="https://www.hud.gov"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-primary">
                  www.hud.gov
                </a>
              </li>
              <li><strong>Florida FCHR:</strong>{" "}
                (850) 488-7082
              </li>
            </ul>
          </section>

        </div>
      </div>
    </div>
  );
}
