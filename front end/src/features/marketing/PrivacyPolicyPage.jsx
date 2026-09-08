import LegalLayout from './LegalLayout.jsx';

export default function PrivacyPolicyPage() {
  return (
    <LegalLayout title="Privacy Policy" updated="August 27, 2026">
      <p>
        This Privacy Policy explains how <strong>Northstar Edtech Private Limited</strong>
        {' '}("<strong>Northstar Edtech</strong>", "<strong>we</strong>", "<strong>us</strong>", or
        "<strong>our</strong>"), the company that owns and operates the <strong>Greeto</strong> brand
        and platform ("<strong>Greeto</strong>", the "<strong>Service</strong>"), collects, uses,
        discloses, and safeguards information when you use Greeto, including our website, web
        application, and any connected messaging channels such as WhatsApp, Instagram, Messenger,
        and Telegram (collectively, the "<strong>Platforms</strong>").
      </p>
      <p>
        Greeto is a business messaging and customer conversation platform. Our customers
        ("<strong>Business Users</strong>") use Greeto to communicate with their own end customers
        ("<strong>End Users</strong>") over WhatsApp and other supported channels, and to manage
        leads, campaigns, and support conversations. This policy describes our practices for both
        Business Users (who create accounts with us) and End Users (whose messages Business Users
        process through Greeto).
      </p>

      <h2>1. Information We Collect</h2>

      <h3>1.1 Account Information</h3>
      <p>When a Business User signs up for Greeto, we collect:</p>
      <ul>
        <li>Name, email address, phone number, and password (stored as a salted hash, never in plain text).</li>
        <li>Business/workspace details such as company name and team member roles.</li>
        <li>Billing information processed via our payment provider (see Section 4).</li>
      </ul>

      <h3>1.2 Messaging Data</h3>
      <p>
        When a Business User connects a WhatsApp Business Account, Instagram professional
        account, Messenger Page, or Telegram bot to Greeto, we process, on the Business User's
        behalf:
      </p>
      <ul>
        <li>Message content (text, images, audio, documents, video, location, and interactive replies) sent and received through the connected channel.</li>
        <li>Sender/recipient identifiers (e.g., WhatsApp phone number, Instagram-scoped user ID) needed to route conversations.</li>
        <li>Message delivery metadata (sent, delivered, read, failed) and timestamps.</li>
        <li>Contact profile information made available by the messaging platform (e.g., a WhatsApp display name) or entered manually by the Business User's team.</li>
      </ul>
      <p>
        We act as a <strong>data processor</strong> with respect to this messaging data: it is
        collected and controlled by the Business User for their own business purposes, and we
        process it only to provide, maintain, and improve the Service on their instructions.
      </p>

      <h3>1.3 Platform (Meta) Data</h3>
      <p>
        Where a Business User connects a Meta product (WhatsApp Business Platform, Instagram, or
        Messenger) to Greeto via the Meta Graph API or embedded signup, we receive and store:
      </p>
      <ul>
        <li>The WhatsApp Business Account ID, phone number ID, and associated display phone number.</li>
        <li>The Instagram Business Account ID and Page ID, and a long-lived Page access token.</li>
        <li>Message template content submitted to and approved by Meta.</li>
        <li>Webhook event payloads Meta sends us for message delivery and status updates.</li>
      </ul>
      <p>
        We use this data solely to send and receive messages, manage templates, and provide the
        conversation-management features Business Users configure, consistent with the{' '}
        <a href="https://developers.facebook.com/policy" target="_blank" rel="noreferrer">Meta Platform Terms</a>{' '}
        and{' '}
        <a href="https://developers.facebook.com/devpolicy" target="_blank" rel="noreferrer">Meta Developer Policies</a>.
        We do not use data received from Meta's APIs to build a profile of users for advertising
        purposes, and we do not sell this data.
      </p>

      <h3>1.4 Automatically Collected Information</h3>
      <ul>
        <li>Log data such as IP address, browser type, device identifiers, and pages visited within the Greeto web application.</li>
        <li>Cookies and similar technologies used to keep you signed in and remember preferences (see Section 8).</li>
      </ul>

      <h2>2. How We Use Information</h2>
      <ul>
        <li>To provide, operate, and maintain the Service, including delivering and receiving messages across connected channels.</li>
        <li>To authenticate accounts, enforce role-based permissions, and secure the platform.</li>
        <li>To route inbound leads/conversations to the correct team member and support assignment, tagging, and reporting features.</li>
        <li>To send transactional email (account verification, password resets, team invitations, billing notices) via our email delivery providers.</li>
        <li>To process payments and manage subscriptions.</li>
        <li>Where a Business User enables an AI-assisted reply feature, to generate suggested or automated responses to inbound messages.</li>
        <li>To detect, investigate, and prevent fraud, abuse, and security incidents.</li>
        <li>To comply with legal obligations and enforce our Terms & Conditions.</li>
      </ul>
      <p>We do not use message content to serve advertising, and we do not sell personal information to third parties.</p>

      <h2>3. How We Share Information</h2>
      <p>We disclose information only as described below:</p>
      <ul>
        <li>
          <strong>With the messaging platforms you connect.</strong> Meta (WhatsApp, Instagram,
          Messenger) and Telegram necessarily receive the messages Business Users send through
          those channels, as required for delivery.
        </li>
        <li>
          <strong>With sub-processors who help us run the Service</strong>, under contractual
          confidentiality and data-protection obligations, including:
          <ul>
            <li>Cloud database and application hosting providers (e.g., DigitalOcean) for storing and running the Service.</li>
            <li>Cloudinary and/or Bunny CDN, for storing and delivering media attachments (images, audio, documents, video) exchanged in conversations.</li>
            <li>Zeptomail, Mailgun, and/or Mailchimp, for sending transactional and marketing email on our or our Business Users' behalf.</li>
            <li>Razorpay, for processing subscription payments (Razorpay receives payment details directly; we do not store full card numbers).</li>
            <li>OpenAI, where a Business User enables AI-assisted reply generation, limited to the conversation text needed to produce a suggested reply.</li>
            <li>Fast2SMS, Twilio, and/or Exotel, where a Business User enables SMS or voice/call-related features.</li>
          </ul>
        </li>
        <li><strong>For legal reasons</strong>, if required by law, subpoena, or other legal process, or to protect the rights, property, or safety of Northstar Edtech, our users, or the public.</li>
        <li><strong>With your consent</strong>, or at the direction of the Business User who controls the relevant conversation data.</li>
        <li><strong>In a business transfer</strong>, such as a merger, acquisition, or sale of assets, subject to standard confidentiality protections.</li>
      </ul>

      <h2>4. Payments</h2>
      <p>
        Subscription payments are processed by Razorpay. We store subscription status, plan, and
        invoice records, but do not store full payment card numbers or bank account credentials
        on our servers.
      </p>

      <h2>5. Data Retention</h2>
      <p>
        We retain account and messaging data for as long as a Business User's workspace remains
        active, and for a reasonable period afterward to comply with legal, accounting, or
        reporting obligations, resolve disputes, and enforce our agreements. A Business User may
        request deletion of their workspace data as described in Section 7. Media attachments are
        retained in our storage provider according to the same retention practices as the
        conversation they belong to.
      </p>

      <h2>6. Data Security</h2>
      <p>
        We use industry-standard safeguards to protect information, including encrypted
        connections (TLS/HTTPS) for data in transit, hashed password storage, role-based access
        controls, and webhook signature verification for inbound messaging events. No method of
        transmission or storage is completely secure, and we cannot guarantee absolute security.
      </p>

      <h2>7. Your Rights and Choices</h2>
      <p>Depending on your location and role, you may have the right to:</p>
      <ul>
        <li>Access, correct, or request a copy of your personal information.</li>
        <li>Request deletion of your account or personal information, subject to legal retention requirements.</li>
        <li>Withdraw consent for optional processing, such as AI-assisted replies, where applicable.</li>
        <li>Object to or restrict certain processing of your information.</li>
      </ul>
      <p>
        <strong>End Users</strong> who message a Business User through WhatsApp, Instagram, or
        another connected channel and wish to exercise these rights should contact that Business
        User directly, as they control the underlying conversation data. <strong>Business Users</strong>{' '}
        may exercise these rights by contacting us at the address in Section 11.
      </p>

      <h2>8. Cookies and Similar Technologies</h2>
      <p>
        We use strictly necessary cookies and browser local storage to keep you signed in,
        remember your workspace preferences, and maintain session security. We do not use
        third-party advertising cookies.
      </p>

      <h2>9. Children's Privacy</h2>
      <p>
        Greeto is intended for business use and is not directed to children under 18. We do not
        knowingly collect personal information from children. If you believe a child has provided
        us with personal information, please contact us so we can delete it.
      </p>

      <h2>10. International Data Transfers</h2>
      <p>
        Greeto is operated from India, and information may be stored and processed in India or
        other countries where our service providers operate. Where required, we take steps
        intended to ensure such transfers comply with applicable data protection law.
      </p>

      <h2>11. Contact Us</h2>
      <p>
        If you have questions about this Privacy Policy or wish to exercise your data protection
        rights, contact us at:
      </p>
      <address>
        Northstar Edtech Private Limited<br />
        Email: <a href="mailto:privacy@xolox.io">privacy@xolox.io</a><br />
        Support: <a href="mailto:support@xolox.io">support@xolox.io</a>
      </address>

      <h2>12. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. We will post the updated version on
        this page with a revised "Last updated" date, and, for material changes, provide
        additional notice where required by law.
      </p>
    </LegalLayout>
  );
}
