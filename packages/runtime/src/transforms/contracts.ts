/** The composition root adapts a durable journal transaction to this narrow facade. */
export interface TransformMutationPort {
  readFile(path: string): Promise<string | undefined>;
  assertWritable(path: string): Promise<void>;
  moveFile(from: string, to: string): Promise<void>;
  writeFile(path: string, content: string): Promise<void>;
  deleteFile(path: string): Promise<void>;
  checkpoint(id: string): Promise<void>;
}

export class TransformScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransformScopeError";
  }
}

export class TransformPreconditionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransformPreconditionError";
  }
}
