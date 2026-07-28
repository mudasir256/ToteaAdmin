type DenoRuntime = {
  env: {
    get(name: string): string | undefined;
  };
  serve(
    handler: (request: Request) => Response | Promise<Response>,
  ): unknown;
};

export const deno = (
  globalThis as unknown as { Deno: DenoRuntime }
).Deno;

