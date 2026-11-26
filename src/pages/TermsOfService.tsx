import { Link } from "react-router-dom";
import SEO from "@/components/SEO";

const TermsOfService = () => (
  <main className="pt-20">
    <SEO title="Terms of Service" description="TechBridge Terms of Service — rules and guidelines for using our platform." />
    <section className="py-14 sm:py-20 bg-gradient-hero dark">
      <div className="container mx-auto px-4 text-center">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-heading font-bold text-foreground">Terms of Service</h1>
        <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">Last updated: April 5, 2026</p>
      </div>
    </section>
    <section className="py-16">
      <div className="container mx-auto px-4 max-w-3xl prose prose-lg text-foreground prose-headings:font-heading prose-headings:text-foreground prose-p:text-muted-foreground prose-li:text-muted-foreground prose-strong:text-foreground">
        <h2>1. Acceptance of Terms</h2>
        <p>By accessing or using TechBridge ("the Platform"), you agree to be bound by these Terms of Service. If you do not agree, please do not use the Platform.</p>

        <h2>2. Account Registration</h2>
        <ul>
          <li>You must provide accurate and complete information during registration.</li>
          <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
          <li>You must be at least 13 years old to create an account.</li>
          <li>One person may not maintain more than one account.</li>
        </ul>

        <h2>3. Acceptable Use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Use the Platform for any unlawful purpose or in violation of any applicable laws.</li>
          <li>Submit false, misleading, or fraudulent information.</li>
          <li>Attempt to gain unauthorized access to other users' accounts or Platform systems.</li>
          <li>Upload malicious code, viruses, or harmful content.</li>
          <li>Harass, abuse, or discriminate against other users.</li>
          <li>Use automated tools to scrape or access the Platform without permission.</li>
        </ul>

        <h2>4. Event Registration</h2>
        <ul>
          <li>Registration for events is subject to availability and event-specific terms.</li>
          <li>You may cancel your registration before the event start date.</li>
          <li>Registration fees, if applicable, are subject to the refund policy stated at the time of registration.</li>
          <li>TechBridge reserves the right to cancel or modify events at any time.</li>
        </ul>

        <h2>5. Intellectual Property</h2>
        <ul>
          <li>The Platform and its content (excluding user submissions) are owned by TechBridge.</li>
          <li>Projects created during hackathons remain the intellectual property of their creators, unless otherwise specified in event-specific rules.</li>
          <li>By submitting content to the Platform, you grant TechBridge a non-exclusive, worldwide license to display and distribute such content on the Platform.</li>
        </ul>

        <h2>6. Certificates</h2>
        <p>Certificates issued through the Platform are for recognition of participation and achievement. TechBridge reserves the right to revoke certificates issued based on fraudulent participation.</p>

        <h2>7. Privacy</h2>
        <p>Your use of the Platform is also governed by our <Link to="/privacy">Privacy Policy</Link>, which is incorporated into these Terms by reference.</p>

        <h2>8. Disclaimers</h2>
        <p>The Platform is provided "as is" without warranties of any kind. TechBridge does not guarantee uninterrupted access, error-free operation, or specific outcomes from participation in events or programs.</p>

        <h2>9. Limitation of Liability</h2>
        <p>To the maximum extent permitted by law, TechBridge shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the Platform.</p>

        <h2>10. Termination</h2>
        <p>TechBridge may suspend or terminate your account at any time for violation of these Terms, with or without notice. Upon termination, your right to use the Platform ceases immediately.</p>

        <h2>11. Changes to Terms</h2>
        <p>We may update these Terms from time to time. Continued use of the Platform after changes constitutes acceptance of the revised Terms. We will notify registered users of material changes via email or in-app notification.</p>

        <h2>12. Governing Law</h2>
        <p>These Terms are governed by the laws of the Republic of Cameroon. Any disputes shall be resolved in the courts of competent jurisdiction in Cameroon.</p>

        <h2>13. Contact</h2>
        <p>For questions about these Terms, contact us at <strong>legal@techbridge.org</strong>.</p>
      </div>
    </section>
  </main>
);

export default TermsOfService;
