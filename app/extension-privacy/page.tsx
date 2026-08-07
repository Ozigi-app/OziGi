import type { Metadata } from "next";

// Chrome Web Store requires a publicly reachable privacy policy URL for any
// extension that handles user data, and reviewers read it against the
// permissions requested in the manifest. Kept separate from the main policy so
// it can describe exactly what the extension does and nothing else.
export const metadata: Metadata = {
  title: "Browser Extension Privacy Policy — Ozigi",
  description:
    "What the Ozigi for LinkedIn browser extension accesses, what it sends to Ozigi, and what it never collects.",
  alternates: { canonical: "https://ozigi.app/extension-privacy" },
};

export default function ExtensionPrivacy() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16 text-[#333]">
      <h1 className="text-4xl font-black italic uppercase tracking-tighter mb-2">
        Browser Extension Privacy Policy
      </h1>
      <p className="text-sm text-gray-500 mb-10">
        For the <strong>Ozigi for LinkedIn</strong> Chrome extension · Last updated: August 3, 2026
      </p>

      <div className="prose prose-slate max-w-none space-y-10 text-[15px] leading-relaxed">
        <section>
          <p>
            The Ozigi for LinkedIn extension performs LinkedIn actions on your behalf inside your own
            browser, using your own logged-in LinkedIn session. It exists because LinkedIn does not
            serve its interface reliably to server-side automation.
          </p>
          <p className="mt-3">
            This policy covers the extension only. Our main policy is at{" "}
            <a href="https://ozigi.app/privacy-policy" className="text-blue-600 underline">
              ozigi.app/privacy-policy
            </a>
            . Questions:{" "}
            <a href="mailto:hello@ozigi.app" className="text-blue-600 underline">hello@ozigi.app</a>.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-3">What it accesses</h2>
          <p>The extension runs only on <code>linkedin.com</code> and only reads two kinds of page:</p>
          <ul className="list-disc pl-6 mt-3 space-y-2">
            <li>
              <strong>LinkedIn people-search results.</strong> It reads the public profile URL, name
              and headline shown on each result card, for people matching the ideal-customer profile
              you defined in Ozigi.
            </li>
            <li>
              <strong>A lead&rsquo;s profile page.</strong> It locates the Connect button, sends the
              connection request with the note Ozigi wrote, and reads back whether LinkedIn now shows
              the invitation as pending.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-3">What it sends to Ozigi</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Profile URL, name and headline of people found in your searches, saved as leads in your account.</li>
            <li>The outcome of each connection request — sent, already connected, or failed — plus an error description when one fails.</li>
          </ul>
          <p className="mt-3">
            Everything is sent over HTTPS to <code>ozigi.app</code>, authenticated with a token you
            generate in your Ozigi settings and paste into the extension. That token identifies your
            account and nothing else; it is not your LinkedIn password and grants no access to your
            LinkedIn account.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-3">What it never does</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>It never reads, collects or transmits your LinkedIn credentials.</li>
            <li>It never reads your LinkedIn inbox, messages or notifications.</li>
            <li>It never sends LinkedIn messages or DMs. The connection request is the only thing it sends.</li>
            <li>It never runs on any site other than <code>linkedin.com</code>.</li>
            <li>It never sells, rents or shares your data with third parties, and it is not used for advertising.</li>
            <li>It never acts while you have it switched off, or while your browser is closed.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-3">Why it needs the permissions it asks for</h2>
          <dl className="space-y-4">
            <div>
              <dt className="font-bold">debugger</dt>
              <dd>
                LinkedIn ignores clicks that did not come from a real person — its own handlers check
                whether an event was browser-generated before opening the invite dialog. The Chrome
                DevTools Protocol input API is the only way to produce a click LinkedIn will accept.
                It is used solely to dispatch mouse and key input at coordinates on LinkedIn pages,
                and only while an action is running. Chrome displays its standard banner whenever it
                is attached.
              </dd>
            </div>
            <div>
              <dt className="font-bold">tabs &amp; scripting</dt>
              <dd>To open the lead&rsquo;s LinkedIn profile in a tab and read that page in order to find the Connect button.</dd>
            </div>
            <div>
              <dt className="font-bold">storage</dt>
              <dd>To keep your connection token, your on/off preference and today&rsquo;s counters on your own machine.</dd>
            </div>
            <div>
              <dt className="font-bold">alarms</dt>
              <dd>To check for due work on a timer, and to pace actions so they occur at a human rate.</dd>
            </div>
            <div>
              <dt className="font-bold">Host access to linkedin.com and ozigi.app</dt>
              <dd>LinkedIn is where the work happens; ozigi.app is where instructions come from and results go.</dd>
            </div>
          </dl>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-3">Retention and control</h2>
          <p>
            Leads and outreach records live in your Ozigi account and are deleted when you delete the
            campaign or your account. Removing the extension stops all activity immediately; revoking
            the token in your Ozigi settings does the same, from the other end.
          </p>
        </section>
      </div>
    </div>
  );
}
