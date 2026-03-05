export interface JobHandler {
  execute(input: unknown): Promise<unknown>;
}
