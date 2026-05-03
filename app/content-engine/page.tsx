"use client";

import { useState } from "react";
import { CopilotKit, useCopilotReadable, useCopilotAdditionalInstructions } from "@copilotkit/react-core";
import { CopilotSidebar } from "@copilotkit/react-ui";
import "@copilotkit/react-ui/styles.css";

export default function ContentEngine() {
  return (
    <CopilotKit runtimeUrl="/api/copilotkit">
      <BriefGenerator />
    </CopilotKit>
  );
}

function BriefGenerator() {
  const [topic, setTopic] = useState("");

  useCopilotReadable({
    description:
      "The raw topic, rough notes, or target audience the user wants to turn into a formal technical brief.",
    value: topic,
  });

  // Inject the gold-standard few-shot example into the agent's context
  const systemInstructions = `Here is your GOLD STANDARD example of the exact tone, depth, and structure you must follow:

--- START GOLD STANDARD ---
Audience

Senior SDETs, staff engineers, and QA leads running Playwright at scale within CI/CD pipelines. They've shipped feature-flagged code before and rely on LaunchDarkly, Split/Harness, Flagsmith, or a homegrown toggle system. Their pain points: tests that break when flags change in shared environments, parallel workers colliding on flag state, and flag-dependent tests either too tightly coupled to a live SDK or too loosely defined to be trusted. They want architectural patterns, not a beginner introduction to feature flags.

Outcome

By the end, readers will understand why feature flags break Playwright's isolation model, know the exact mechanisms (route mocking, fixture-level injection, per-worker scoping, globalSetup seeding) to achieve deterministic per-test flag state, and be able to audit their own suites for flag-induced flakiness.

Suggested structure

Introduction
- Open with the core tension: feature flags and Playwright's isolation guarantees operate at different layers.
- Playwright isolates browser contexts (cookies, localStorage, sessions), but feature flags are evaluated outside that boundary, often via backend services or SDKs. This creates hidden shared state across tests.
- Example: a beforeAll mutating a flag via an API in Worker 1 can affect what Worker 3 sees mid-test.
- Acknowledge the common initial response: hardcoding flag state in environments, conditional test logic. These approaches break under parallelism and flag lifecycle changes.
- Introduce the second layer of the problem: debugging.
- Link to https://currents.dev/posts/how-to-adopt-playwright-the-right-way

H2: Why Feature Flags Break Playwright's Isolation Model
- Clarify that Playwright isolation is not broken, but limited to browser context. Feature flags introduce state outside that boundary.
- Flag evaluation paths: server-side evaluation based on user identity; client-side SDK fetching remote config; cookie or header overrides.

H3: The Shared Environment Problem
- In shared environments, flag state is effectively global unless scoped per user. Parallel workers operate as the same user, hit the same endpoints, and share flag state. This leads to nondeterministic behavior across workers.
- Add debugging angle (and link to https://currents.dev/posts/debugging-playwright-timeouts): These issues often appear as: tests passing locally but failing in CI; failures only on certain workers or retries; inconsistent results across branches.
- Without cross-run visibility, these patterns are hard to detect.

H3: Conditional Test Logic as a Code Smell
- Critique: if (featureEnabled) { … } else { test.skip() }
- Explain why: couples tests to ambient state; creates hidden dependencies; causes unpredictable CI behavior.
- Principle: Flag state should be declared like auth state, not read reactively.
- Link to: https://currents.dev/posts/how-to-build-reliable-playwright-tests-a-cultural-approach

H2: A Taxonomy of Flag Integration Patterns
Define four patterns and clarify trade-offs:
- Live SDK: No isolation, only for smoke tests validating real production config.
- API-level mutation: Fragile under parallelism, requires strict isolation or serial execution.
- Network interception (page.route): Full per-test isolation, preferred for client-side flags.
- Cookie/header overrides: Lightweight and isolated within browser context.

H2: Fixture-Level Flag Architecture
Position flag state as first-class test infrastructure.

H3: The Flag Context Fixture
- Introduce flagContext / withFlags fixture.
- Key point: Route handlers must be registered before page.goto(). (Include code example.)

H3: Worker-Scoped vs Test-Scoped Fixtures
- Test-scoped: full isolation; higher overhead.
- Worker-scoped: faster; safe only when all tests share the same flag config.
- Important note: Worker-scoped fixtures combined with API mutation create parallelism risks.

H3: Composing Variants with test.use()
- Show describe-level overrides.
- Discuss benefits including removal of conditional logic and makes intent explicit.

H2: Deterministic Flag State in Parallel Runs

H3: Per-Worker Test User Isolation
Use testInfo.parallelIndex to create per-worker users. Each worker operates in its own flag scope.

H3: Avoiding Race Conditions in globalSetup
- globalSetup runs once, but flag propagation is not deterministic.
- Best practice: use globalSetup only for baseline, override per test via fixtures.
- Add readiness check via polling, but note polling reduces risk, does not eliminate propagation issues.

H3: The Flag Snapshot Pattern
For smoke tests: fetch flag state in globalSetup; store as JSON; reuse during test run. Benefits: prevents mid-run drift and creates audit trail.
Under this H2, add Currents integration. Explain that these parallel and propagation issues are difficult to debug without visibility across runs. Currents helps identify failures tied to specific workers, detect retry-only failures, correlate failures with environments or branches, etc., reducing the time spent diagnosing flag-related flakiness.

H2: Mocking Flag SDKs at the Network Layer

H3: Intercepting SDK Endpoints
Avoid hardcoding exact endpoints. Explain: intercept streaming or evaluation endpoints; return expected schema. Critical: Route must be registered before navigation.

H3: Handling SDK Initialization Race Conditions
Cover main strategies: reload page; force re-evaluation; rely on fresh context. And explain trade-offs.

H3: Generic REST Flag APIs
Use route.fulfill with correct schema. Warning: Malformed mocks can cause silent fallback and false positives.

H2: Playwright Projects as Flag Variant Test Suites
- Model variants as projects. Discuss benefits: explicit coverage, clean CI integration, and no conditional logic.
- Clarify that projects define variants, but visibility across them is equally important.

H2: Flag Lifecycle Management

H3: Tagging Tests by Flag
Use tags for traceability.

H3: Assertions Against Declared State
Tests should not depend on ambient flag state.

H3: Cleanup
Use try/finally for API mutations.

H2: Securing Flag API Credentials
Keep CI secrets, no logging; and add note: headers may bypass masking if constructed dynamically.
Link to https://currents.dev/posts/how-to-run-playwright-tests-without-the-pain

H2: Integrating with Currents for Flag Variant Visibility
Position Currents as a visibility and debugging layer. Discuss:
- Compare test behavior across flag variants, branches, and runs.
- Identify regressions tied to specific flag states.
- Distinguish between flaky tests and flag misconfiguration.
- Analyze trends such as failures only in one variant, failures after flag rollout, increased retries tied to a flag.

H2: Final Considerations
- Refine core principle: Feature flag state is test infrastructure, not environmental context.
- Mention that flag issues are not just setup problems, they are observability problems.
- Mention that teams that declare flag state, isolate it per test, and monitor behavior across runs build reliable test systems.
- Close by mentioning Currents provides visibility across flag variants, workers, and environments without custom tooling. When flag-aware suites are structured correctly, it surfaces variant-specific failures and helps diagnose regressions quickly.
--- END GOLD STANDARD ---

Always output: Audience, Outcome, and Suggested Structure (using H2s and H3s). Explicitly note where internal/external links or code examples belong.
`;

  useCopilotAdditionalInstructions({ instructions: systemInstructions });

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-gray-900">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">Technical Brief Engine</h1>
        <p className="text-gray-600">
          Jot down your rough ideas below, and the agent will structure them into a formal brief.
        </p>

        <div className="flex flex-col space-y-2">
          <textarea
            className="w-full p-4 border border-gray-300 rounded-lg shadow-sm h-64 focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="e.g., I want to write about anomaly detection in 5G networks using TensorFlow Lite on edge devices..."
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
        </div>

        <CopilotSidebar
          defaultOpen={true}
          labels={{
            title: "Brief Assistant",
            initial:
              "I'm ready. Describe your topic in the editor, then ask me to generate the brief.",
          }}
        />
      </div>
    </div>
  );
}
