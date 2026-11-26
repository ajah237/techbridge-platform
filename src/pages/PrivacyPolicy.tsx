import SEO from "@/components/SEO";

const PrivacyPolicy = () => (
  <main className="pt-20">
    <SEO title="Privacy Policy" description="TechBridge Privacy Policy — how we collect, use, and protect your personal data." />
    <section className="py-14 sm:py-20 bg-gradient-hero dark">
      <div className="container mx-auto px-4 text-center">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-heading font-bold text-foreground">Privacy Policy</h1>
        <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">Last updated: April 5, 2026</p>
      </div>
    </section>
    <section className="py-16">
      <div className="container mx-auto px-4 max-w-3xl prose prose-lg text-foreground prose-headings:font-heading prose-headings:text-foreground prose-p:text-muted-foreground prose-li:text-muted-foreground prose-strong:text-foreground">
        <h2>1. Information We Collect</h2>
        <p>We collect information you provide directly, including:</p>
        <ul>
          <li><strong>Account Information:</strong> Name, email address, university, and skills when you create an account.</li>
          <li><strong>Profile Data:</strong> Bio, avatar, portfolio URL, GitHub, and LinkedIn links you voluntarily add.</li>
          <li><strong>Event Registrations:</strong> Records of events you register for.</li>
          <li><strong>Communications:</strong> Messages you send through our contact form.</li>
        </ul>

        <h2>2. How We Use Your Information</h2>
        <ul>
          <li>To provide and maintain our services, including event registration and certificate issuance.</li>
          <li>To send you event confirmations, updates, and relevant notifications.</li>
          <li>To improve our platform and develop new features.</li>
          <li>To communicate with you about programs, events, and services.</li>
        </ul>

        <h2>3. Data Sharing</h2>
        <p>We do not sell your personal data. We may share information with:</p>
        <ul>
          <li><strong>Service Providers:</strong> Third-party services that help us operate the platform (hosting, email delivery, analytics).</li>
          <li><strong>Legal Requirements:</strong> When required by law or to protect our rights.</li>
          <li><strong>Event Partners:</strong> Anonymized or aggregated data with event sponsors, with your consent.</li>
        </ul>

        <h2>4. Data Security</h2>
        <p>We implement industry-standard security measures including encryption in transit (TLS), row-level security policies on our database, and secure authentication with password hashing. We regularly review our security practices.</p>

        <h2>5. Your Rights</h2>
        <p>You have the right to:</p>
        <ul>
          <li>Access, correct, or delete your personal data.</li>
          <li>Withdraw consent for optional data processing.</li>
          <li>Export your data in a portable format.</li>
          <li>Object to data processing for marketing purposes.</li>
        </ul>

        <h2>6. Cookies</h2>
        <p>We use essential cookies for authentication and session management. We do not use tracking cookies or third-party advertising cookies.</p>

        <h2>7. Data Retention</h2>
        <p>We retain your data for as long as your account is active or as needed to provide services. You may request deletion of your account and associated data at any time by contacting us.</p>

        <h2>8. Children's Privacy</h2>
        <p>Our services are not directed to individuals under 13. We do not knowingly collect personal data from children under 13.</p>

        <h2>9. International Transfers</h2>
        <p>Your data may be processed in countries other than your own. We ensure appropriate safeguards are in place for international data transfers in compliance with applicable laws including GDPR.</p>

        <h2>10. Contact Us</h2>
        <p>For privacy-related inquiries, contact us at <strong>bfozoh@gmail.com</strong> or <strong>+237 6 92 16 96 74</strong> (Yaoundé, Cameroon).</p>
      </div>
    </section>
  </main>
);

export default PrivacyPolicy;
