import { motion } from "motion/react";
import { RasterIcon } from "@/components/RasterIcon";

export default function Privacy() {
  return (
    <main className="standard-page-container">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8"
      >
        <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
          <RasterIcon name="privacy" size={36} />A Note About Privacy
        </h1>
        <p className="text-cyan-medium mb-8">
          <mark className="highlighted-text">
            How your account is kept safe and your content kept private
          </mark>
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="max-w-4xl mb-8 space-y-3 text-foreground"
      >
        <p>
          This is a small, independent project, so the privacy story here is a
          bit different from most sites. Since there's no company behind it, no
          investors to answer to, and no plans to monetize your data, I've been
          able to build it the way I'd want a tool like this built for me. That
          means keeping as little information about you as possible, and making
          sure even I can't see the content you create here. What follows is a
          plain-English description of how that actually works.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="standard-content accent-border-gradient space-y-12"
      >
        <section>
          <h2 className="text-2xl font-bold gradient-heading mb-3">
            Your Account ID
          </h2>
          <div className="space-y-3 text-foreground">
            <p>
              When you create an account, you're handed a 16-character Account
              ID that looks like <code>ABCD-EFGH-JKMN-PQRS</code>. No email, no
              password, no Google login, no two-factor dance. That's the whole
              account.
            </p>
            <p>
              A fair question is: isn't that trivially guessable? No. The ID is
              drawn from a 31-character alphabet (digits and letters, with
              lookalikes like <code>0/O</code> and <code>1/I/L</code> removed so
              it's hard to mis-copy), which works out to roughly
              <strong> 2.3 × 10²³ possible combinations</strong> — about 78 bits
              of entropy. Even at a wildly optimistic one billion guesses per
              second, brute-forcing a single account would take on the order of
              millions of years. And because the server rate-limits
              authentication, the real-world number is much, much worse for an
              attacker.
            </p>
            <p>
              The ID itself is generated using Node's cryptographic random
              source with rejection sampling, so every character is uniformly
              random — no subtle bias, no "looks random but isn't" pitfalls. The
              ID is never stored on the server in its original form; only a
              salted HMAC hash is kept, used exclusively for authenticating your
              next login.
            </p>
            <p>
              In exchange, you get an account that has no email to leak, no
              password to reuse, no recovery questions to guess, and nothing to
              tie back to your real identity. It's the simplest thing that could
              possibly work, and that simplicity is also what makes it hard to
              attack.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold gradient-heading mb-3">
            Encryption of Your Content
          </h2>
          <div className="space-y-3 text-foreground">
            <p>
              Everything you create here — prompts, blocks, wildcards,
              templates, snapshots, folder names, notes, scratchpad text — is
              end-to-end encrypted before it's stored. The point is blunt: it's
              better for everyone involved if I literally cannot see what you're
              writing. You don't have to trust my good intentions if the
              infrastructure doesn't give me the option.
            </p>
            <p>
              When you log in, your Account ID is passed through a key
              derivation function (HKDF-SHA256) to produce a 256-bit encryption
              key. That key exists only in memory for the duration of your
              session and is never written to disk on the server. All of your
              content is sealed with AES-256-GCM using that key before it's
              saved to the database — so anyone looking at the raw tables
              (including me) sees only encrypted envelopes.
            </p>
            <p>
              Decryption happens in two places, both kept as narrow as possible:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>In your browser</strong>, whenever you open something to
                view or edit it. The app also keeps a local, encrypted search
                index in IndexedDB so searches are fast and don't need to
                round-trip through the server — that index is unsealed in memory
                only when you actually search.
              </li>
              <li>
                <strong>Briefly on the server</strong>, in the exact spots that
                need plaintext to do their job (e.g. assembling a rendered
                prompt, or sending a request to an LLM provider you asked it to
                talk to). Nothing is written back to the database in plaintext.
              </li>
            </ul>
            <p>
              You don't have to take my word for any of this. The entire source
              code is public at{" "}
              <a
                href="https://github.com/aradnom/Prompt-Manager"
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-light underline hover:text-foreground transition-colors"
              >
                github.com/aradnom/Prompt-Manager
              </a>
              . If you want to read the encryption logic directly, the
              interesting files are <code>server/src/lib/auth.ts</code> (key
              derivation and AES-GCM) and{" "}
              <code>server/src/lib/envelope.ts</code> (how fields get wrapped
              and unwrapped at the router layer).
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold gradient-heading mb-3">
            Gotchas Worth Knowing
          </h2>
          <div className="space-y-3 text-foreground">
            <p>
              Encryption isn't free, and there are a few trade-offs that are
              worth being upfront about:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>
                  If you lose your Account ID, your content is gone.
                </strong>{" "}
                Because the encryption key is derived from your ID and the ID
                itself isn't stored anywhere in recoverable form, I genuinely
                cannot help you get back in. There's no password reset and no
                support ticket that can fix it. Please write the ID down
                somewhere you'll find it in six months.
              </li>
              <li>
                <strong>
                  A handful of identifier fields aren't encrypted.
                </strong>{" "}
                Specifically, the short display IDs that appear in URLs (
                <code>/prompts/abc123</code>, etc.) are stored in plaintext so
                the app can look things up without decrypting everything first.
                These are random identifiers with no meaning attached to them,
                but you should know they exist.
              </li>
              <li>
                <strong>LLM features send plaintext to third parties.</strong>{" "}
                When you use an "Explore Variations" or similar AI-powered
                feature, the relevant text is decrypted and sent to whichever
                provider you've configured (OpenAI, Anthropic, Vertex, Grok, or
                your own LM Studio instance). That's inherent to the feature
                working at all — the model needs to actually read the prompt.
                Nothing is sent to a provider unless you explicitly invoke a
                feature that calls one.
              </li>
              <li>
                <strong>The local cache lives on your device.</strong> If you
                use shared or public computers, remember that the browser's
                IndexedDB cache will hold an encrypted copy of your content
                until you log out or clear it. Logging out clears the session
                key needed to decrypt it, and the "Reset Local Cache" button on
                the Account page wipes the cache outright.
              </li>
              <li>
                <strong>No account deletion endpoint yet.</strong> If you want
                everything wiped from the server, drop me a line and I'll handle
                it by hand. This is on the list to automate.
              </li>
            </ul>
            <p>
              If you spot something in the code that doesn't match what's
              described here, or you think the approach could be stronger,
              please open an issue on GitHub. I'd rather hear about it.
            </p>
          </div>
        </section>
      </motion.div>
    </main>
  );
}
