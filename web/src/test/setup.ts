import "@testing-library/jest-dom/vitest";
import { configure } from "@testing-library/react";

// Pages wait on mocked RPC promises; under a full parallel run 1 s is too tight.
configure({ asyncUtilTimeout: 5000 });
