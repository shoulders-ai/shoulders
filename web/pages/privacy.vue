<template>
  <div class="pt-36 pb-20 px-6">
    <div class="max-w-2xl mx-auto">

      <h1 class="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-stone-900">
        Privacy Policy
      </h1>
      <p class="mt-4 text-sm text-stone-400">Last updated: February 2026</p>

      <p class="mt-8 text-sm text-stone-600 leading-relaxed">
        This policy explains how Shoulders collects, uses, and protects personal data.
        See also our
        <NuxtLink to="/terms" class="underline hover:text-stone-900 transition-colors">Terms of Service</NuxtLink>.
      </p>

      <!-- 1 -->
      <h2 class="mt-12 text-base font-semibold text-stone-900">1. Local-First Architecture</h2>
      <p class="mt-3 text-sm text-stone-600 leading-relaxed">
        Shoulders is a desktop application. Your documents, references, and project files
        are stored locally on your machine. We do not have access to them unless you
        use features that connect to external services.
      </p>

      <!-- 2 -->
      <h2 class="mt-10 text-base font-semibold text-stone-900">2. Data We Collect</h2>

      <p class="mt-3 text-sm text-stone-600 leading-relaxed">
        <span class="font-medium text-stone-700">Without an account</span> (bring-your-own-keys mode):
        we collect no personal data. AI requests go directly from your machine to the
        provider you configured. We are not involved in that exchange.
      </p>

      <p class="mt-3 text-sm text-stone-600 leading-relaxed">
        <span class="font-medium text-stone-700">With a Shoulders AI subscription:</span>
      </p>
      <ul class="mt-2 text-sm text-stone-600 leading-relaxed list-disc pl-5 space-y-1">
        <li><span class="font-medium text-stone-700">Account data:</span> email address, password (stored as a secure hash), display name (optional)</li>
        <li><span class="font-medium text-stone-700">AI requests:</span> messages and document context sent through our infrastructure to AI providers</li>
        <li><span class="font-medium text-stone-700">Usage data:</span> cost tracking, request counts, model used. Message content is not stored on our servers</li>
        <li><span class="font-medium text-stone-700">Technical data:</span> access logs (IP, timestamps) for security</li>
      </ul>

      <p class="mt-4 text-sm text-stone-600 leading-relaxed">
        <span class="font-medium text-stone-700">Analytics:</span>
        Shoulders may collect anonymised usage data (e.g. feature usage, error reports)
        to improve the software. This can be disabled in Settings. We do not use advertising cookies, or third-party analytics services.
        We do not sell data to anyone. We do not use your data for training or inference.
      </p>

      <!-- 3 -->
      <h2 class="mt-10 text-base font-semibold text-stone-900">3. How We Use Your Data</h2>
      <ul class="mt-3 text-sm text-stone-600 leading-relaxed list-disc pl-5 space-y-1">
        <li><span class="font-medium text-stone-700">Service delivery:</span> processing AI requests, managing your subscription</li>
        <li><span class="font-medium text-stone-700">Security:</span> protecting against unauthorised access and fraud</li>
        <li><span class="font-medium text-stone-700">Communication:</span> essential notifications (password reset, important updates)</li>
      </ul>

      <!-- 4 -->
      <h2 class="mt-10 text-base font-semibold text-stone-900">4. Legal Basis (GDPR Art. 6)</h2>
      <ul class="mt-3 text-sm text-stone-600 leading-relaxed list-disc pl-5 space-y-1">
        <li><span class="font-medium text-stone-700">Contract (Art. 6(1)(b)):</span> account, subscription, AI features</li>
        <li><span class="font-medium text-stone-700">Legitimate interests (Art. 6(1)(f)):</span> security, fraud prevention</li>
        <li><span class="font-medium text-stone-700">Consent (Art. 6(1)(a)):</span> optional features requiring explicit consent</li>
        <li><span class="font-medium text-stone-700">Legal obligation (Art. 6(1)(c)):</span> compliance with applicable law</li>
      </ul>

      <!-- 5 -->
      <h2 class="mt-10 text-base font-semibold text-stone-900">5. Data Sharing</h2>
      <p class="mt-3 text-sm text-stone-600 leading-relaxed">
        When you use AI features, document context and messages are sent to the AI provider.
        This applies whether you use your own API keys or the Shoulders AI subscription.
      </p>

      <div class="mt-4 overflow-x-auto">
        <table class="w-full text-sm border border-stone-200">
          <thead>
            <tr class="border-b border-stone-200">
              <th class="text-left p-2.5 font-medium text-stone-700">Provider</th>
              <th class="text-left p-2.5 font-medium text-stone-700">Purpose</th>
              <th class="text-left p-2.5 font-medium text-stone-700">Data Sent</th>
            </tr>
          </thead>
          <tbody class="text-stone-600">
            <tr class="border-b border-stone-100">
              <td class="p-2.5">Anthropic</td>
              <td class="p-2.5">AI (Claude)</td>
              <td class="p-2.5">Chat messages, document context</td>
            </tr>
            <tr class="border-b border-stone-100">
              <td class="p-2.5">OpenAI</td>
              <td class="p-2.5">AI (GPT)</td>
              <td class="p-2.5">Chat messages, document context</td>
            </tr>
            <tr class="border-b border-stone-100">
              <td class="p-2.5">Google</td>
              <td class="p-2.5">AI (Gemini)</td>
              <td class="p-2.5">Chat messages, document context</td>
            </tr>
            <tr class="border-b border-stone-100">
              <td class="p-2.5">OpenAlex</td>
              <td class="p-2.5">Academic paper search</td>
              <td class="p-2.5">Search queries</td>
            </tr>
            <tr class="border-b border-stone-100">
              <td class="p-2.5">Exa.ai</td>
              <td class="p-2.5">Web search</td>
              <td class="p-2.5">Search queries</td>
            </tr>
            <tr class="border-b border-stone-100">
              <td class="p-2.5">CrossRef</td>
              <td class="p-2.5">Citation lookup</td>
              <td class="p-2.5">DOIs, metadata queries</td>
            </tr>
            <tr class="border-b border-stone-100">
              <td class="p-2.5">Stripe</td>
              <td class="p-2.5">Payments</td>
              <td class="p-2.5">Email, billing details</td>
            </tr>
            <tr>
              <td class="p-2.5">Resend</td>
              <td class="p-2.5">Transactional email</td>
              <td class="p-2.5">Email address</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p class="mt-4 text-sm text-stone-600 leading-relaxed">
        Account data is stored on servers in Frankfurt, Germany (EU).
      </p>

      <p class="mt-3 text-sm text-stone-600 leading-relaxed">
        <span class="font-medium text-stone-700">No training on your data.</span>
        AI providers process data for inference only. Under their API terms of service,
        your content is not used to train models.
      </p>

      <!-- 6 -->
      <h2 class="mt-10 text-base font-semibold text-stone-900">6. International Transfers</h2>
      <p class="mt-3 text-sm text-stone-600 leading-relaxed">
        Subscription data is stored in the EU (Frankfurt). AI providers are based in the US.
        Transfers are protected by Standard Contractual Clauses, data processing agreements,
        and encryption in transit.
      </p>

      <!-- 7 -->
      <h2 class="mt-10 text-base font-semibold text-stone-900">7. Data Retention</h2>
      <ul class="mt-3 text-sm text-stone-600 leading-relaxed list-disc pl-5 space-y-1">
        <li><span class="font-medium text-stone-700">Account data:</span> until you delete your account</li>
        <li><span class="font-medium text-stone-700">AI request logs:</span> retained for billing; deletable on request</li>
        <li><span class="font-medium text-stone-700">Security logs:</span> 90 days, then deleted</li>
      </ul>
      <p class="mt-3 text-sm text-stone-600 leading-relaxed">
        Local files are never sent to us and remain under your control.
      </p>

      <!-- 8 -->
      <h2 class="mt-10 text-base font-semibold text-stone-900">8. Your Rights</h2>
      <p class="mt-3 text-sm text-stone-600 leading-relaxed">Under the GDPR, you have the right to:</p>
      <ul class="mt-2 text-sm text-stone-600 leading-relaxed list-disc pl-5 space-y-1">
        <li><span class="font-medium text-stone-700">Access (Art. 15):</span> request a copy of your data</li>
        <li><span class="font-medium text-stone-700">Rectification (Art. 16):</span> correct inaccurate data</li>
        <li><span class="font-medium text-stone-700">Erasure (Art. 17):</span> delete your data</li>
        <li><span class="font-medium text-stone-700">Restriction (Art. 18):</span> limit processing in certain cases</li>
        <li><span class="font-medium text-stone-700">Portability (Art. 20):</span> receive your data in a portable format</li>
        <li><span class="font-medium text-stone-700">Object (Art. 21):</span> object to processing based on legitimate interests</li>
      </ul>
      <p class="mt-3 text-sm text-stone-600 leading-relaxed">
        To exercise these rights, email
        <a href="mailto:contact@shoulde.rs" class="underline hover:text-stone-900 transition-colors">contact@shoulde.rs</a>.
        We respond within 30 days. You may also file a complaint with a supervisory
        authority (in Germany: LDI NRW).
      </p>

      <!-- 9 -->
      <h2 class="mt-10 text-base font-semibold text-stone-900">9. Cookies</h2>
      <p class="mt-3 text-sm text-stone-600 leading-relaxed">
        We use only essential cookies (session authentication). Editor preferences are
        stored in local storage on your machine. No tracking cookies.
      </p>

      <!-- 10 -->
      <h2 class="mt-10 text-base font-semibold text-stone-900">10. Security</h2>
      <p class="mt-3 text-sm text-stone-600 leading-relaxed">
        All connections use TLS encryption. Passwords are securely hashed.
        Database policies ensure users can only access their own data.
      </p>

      <!-- 11 -->
      <h2 class="mt-10 text-base font-semibold text-stone-900">11. Policy Changes</h2>
      <p class="mt-3 text-sm text-stone-600 leading-relaxed">
        We may update this policy. Material changes are communicated via email or
        in-app notification. Continued use after notice constitutes acceptance.
      </p>

      <!-- Contact + Imprint -->
      <div class="mt-16 pt-8 border-t border-stone-100">
        <p class="text-sm text-stone-400">
          Questions about this policy:
          <a href="mailto:contact@shoulde.rs" class="underline hover:text-stone-600 transition-colors">contact@shoulde.rs</a>
        </p>

        <p class="mt-6 text-sm text-stone-600">
          Data Controller: Dr. Paul Schneider, Lohmuehlenstrasse 65, 12435 Berlin, Germany
        </p>
      </div>

    </div>
  </div>
</template>
