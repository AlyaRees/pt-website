import type { Config } from "jest";

const config: Config = {
  projects: [
    {
      displayName: "client",
      testEnvironment: "jsdom",
      testMatch: ["**/*.client.test.tsx"],
      transform: { "^.+\\.tsx?$": "ts-jest" }
    },
    {
      displayName: "server",
      testEnvironment: "node",
      testMatch: ["**/*.server.test.ts"],
      transform: { "^.+\\.tsx?$": "ts-jest" },
    },
  ],
};

export default config