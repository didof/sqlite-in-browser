import * as Comlink from "comlink";
import type { Database, Task } from "./worker";

export type { Task };

// Instantiate the web worker
const worker = new Worker(new URL("./worker.ts", import.meta.url), {
    type: "module",
});

// Wrap the worker with Comlink to create a typed, asynchronous API
export const db = Comlink.wrap<Database>(worker);
