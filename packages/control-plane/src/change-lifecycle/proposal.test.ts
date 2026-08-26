import { describe, expect, it } from "vitest";

import { parseChangeProposal } from "@projector/core";

const proposal = () => ({
  apiVersion: "projector.change-proposal/v1",
  requirements: [{ key: "greeting-personalization", title: "Personalized greeting", statement: "The greeting includes the supplied name.", aliases: ["named-greeting"] }],
  scenarios: [{
    key: "greet-supplied-name",
    title: "Greet a supplied name",
    steps: [
      { role: "precondition", statement: "A caller supplies a nonblank name." },
      { role: "trigger", statement: "The caller requests a greeting." },
      { role: "expected-outcome", statement: "The result includes that exact name." },
    ],
  }],
  architecture: {
    concernKey: "public-contract",
    title: "Greeting API compatibility",
    question: "How can the greeting accept a name without breaking existing callers?",
    materiality: "material-soon",
    deferral: {
      rationale: "The additive parameter preserves the current zero-argument contract for this bounded change.",
      reconsiderWhen: "A second caller needs a different greeting payload.",
      validUntil: "2027-02-26T00:00:00.000Z",
      preservedOptions: ["Introduce an options object after consumer evidence exists."],
      forbiddenCommitments: ["Do not remove the zero-argument behavior."],
      forbiddenWritePaths: ["package.json"],
    },
  },
  edits: [{ path: "src/greeting.mjs", before: "export const greet = () => 'hello';\n", after: "export const greet = (name = '') => name ? `hello ${name}` : 'hello';\n" }],
  validation: {
    independentNodeTests: ["test/public-contract.test.mjs"],
    supplementalNodeTests: ["test/greeting-change.test.mjs"],
  },
  analysisFacets: ["behavior", "architecture", "public-contract"],
});

describe("change proposal", () => {
  it("normalizes one strict versioned proposal deterministically", () => {
    const parsed = parseChangeProposal(proposal());
    expect(parsed.requirements[0]).toEqual({
      key: "greeting-personalization",
      title: "Personalized greeting",
      statement: "The greeting includes the supplied name.",
      aliases: ["named-greeting"],
    });
    expect(parsed.analysisFacets).toEqual(["architecture", "behavior", "public-contract"]);
    expect(parsed.validation.supplementalNodeTests).toEqual(["test/greeting-change.test.mjs"]);
    expect(parseChangeProposal({ ...proposal(), architecture: null, analysisFacets: ["behavior", "architecture"] }).architecture).toBeNull();
  });

  it("rejects unknown fields and unsupported versions instead of ignoring them", () => {
    expect(() => parseChangeProposal({ ...proposal(), hiddenAuthority: true })).toThrow(/unrecognized.*hiddenAuthority/iu);
    expect(() => parseChangeProposal({ ...proposal(), apiVersion: "projector.change-proposal/v2" })).toThrow(/apiVersion/iu);
    expect(() => parseChangeProposal({ ...proposal(), architecture: { ...proposal().architecture, decision: "use a database" } })).toThrow(/unrecognized.*decision/iu);
  });

  it("rejects blocking decisions, arbitrary validators, unsafe paths, duplicate identities, and edited independent tests", () => {
    expect(() => parseChangeProposal({ ...proposal(), architecture: { ...proposal().architecture, materiality: "blocking-now" } })).toThrow(/materiality|invalid option/iu);
    expect(() => parseChangeProposal({ ...proposal(), validation: { ...proposal().validation, command: "curl example.com" } })).toThrow(/unrecognized.*command/iu);
    expect(() => parseChangeProposal({ ...proposal(), edits: [{ path: "../escape", before: null, after: "x" }] })).toThrow(/repository-relative|path/iu);
    expect(() => parseChangeProposal({ ...proposal(), edits: [{ path: ".projector/model/requirements/forged.json", before: null, after: "{}" }] })).toThrow(/reserved|cannot be edited/iu);
    expect(() => parseChangeProposal({ ...proposal(), requirements: [...proposal().requirements, proposal().requirements[0]] })).toThrow(/duplicate.*requirement/iu);
    expect(() => parseChangeProposal({
      ...proposal(),
      edits: [{ path: "test/public-contract.test.mjs", before: "old", after: "new" }],
    })).toThrow(/independent.*edited/iu);
  });

  it("rejects empty semantics, no-op edits, non-test validators, and malformed deferral horizons", () => {
    expect(() => parseChangeProposal({ ...proposal(), requirements: [{ ...proposal().requirements[0], statement: " " }] })).toThrow(/statement/iu);
    expect(() => parseChangeProposal({ ...proposal(), edits: [{ path: "src/greeting.mjs", before: "same", after: "same" }] })).toThrow(/no-op/iu);
    expect(() => parseChangeProposal({ ...proposal(), validation: { independentNodeTests: ["src/greeting.mjs"], supplementalNodeTests: [] } })).toThrow(/test/iu);
    expect(() => parseChangeProposal({ ...proposal(), architecture: { ...proposal().architecture, deferral: { ...proposal().architecture.deferral, validUntil: "someday" } } })).toThrow(/validUntil/iu);
    expect(() => parseChangeProposal({ ...proposal(), architecture: { ...proposal().architecture, deferral: { ...proposal().architecture.deferral, forbiddenWritePaths: ["src/greeting.mjs"] } } })).toThrow(/forbidden write paths overlap/iu);
    expect(() => parseChangeProposal({ ...proposal(), architecture: { ...proposal().architecture, deferral: { ...proposal().architecture.deferral, forbiddenWritePaths: ["src/**"] } } })).toThrow(/exact canonical paths|globs/iu);
  });
});
