import { z } from "zod";

import type { ContentHash, GitRealizationLocator } from "../domain/contracts.js";

export const EntityIdSchema = z.string()
  .min(1)
  .regex(
    /^(?!\s)(?!.*\s$)(?!\.$)(?!\.\.$)[^\\/\0]+$/u,
    "entity ID must be trimmed, path-independent, and free of path separators",
  );
export const ConfidenceSchema = z.number().min(0).max(1).finite();

export const ContentHashSchema = z.string()
  .regex(
    /^sha256:v1:[0-9a-f]{64}$/u,
    "expected a sha256:v1 content hash with 64 lowercase hexadecimal characters",
  ) as z.ZodType<ContentHash>;

export const SourceClassSchema = z.enum(["authored", "derived", "observed", "inferred"]);

/** A portable, unambiguous relative path used by durable local artifacts. */
export const PortableRelativePathSchema = z.string().min(1).max(1_024).regex(
  /^(?!\/)(?!.*:)(?!.*\\)(?!.*\0)(?!.*\/\/)(?!.*[. ](?:\/|$))(?!.*(?:^|\/)(?:[Cc][Oo][Nn]|[Pp][Rr][Nn]|[Aa][Uu][Xx]|[Nn][Uu][Ll]|[Cc][Oo][Mm][1-9]|[Ll][Pp][Tt][1-9])(?:\.[^/]*)?(?:\/|$))(?!(?:\.|\.\.)(?:\/|$))(?!.*\/(?:\.|\.\.)(?:\/|$))[^/](?:.*[^/])?$/u,
  "must be a portable canonical relative path without aliases, device names, or alternate data streams",
);

export const GitRealizationLocatorSchema = z.string().regex(
  /^git:(?:[a-f0-9]{40}|[a-f0-9]{64}):(?!\/)(?![A-Za-z]:)(?!.*\\)(?!.*\/\/)(?!(?:\.|\.\.)(?:\/|$))(?!.*\/(?:\.|\.\.)(?:\/|$))[^/](?:.*[^/])?$/u,
  "git realization origin must contain a full commit ID and canonical repository-relative path",
) as z.ZodType<GitRealizationLocator>;

export * from "./generated-contracts.js";
