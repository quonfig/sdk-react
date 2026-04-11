import React from "react";
import { Reforge } from "@reforge-com/javascript";
import { createQuonfigHook } from "../index";

// Simple TypesafeClass for testing
export class AppConfig {
  private quonfig: Reforge;

  constructor(quonfig: Reforge) {
    this.quonfig = quonfig;
  }

  get myCoolFeature(): boolean {
    return this.quonfig.isEnabled("my.cool.feature");
  }

  get appName(): string {
    const name = this.quonfig.get("app.name");
    return typeof name === "string" ? name : "Default App";
  }

  get apiUrl(): string {
    const url = this.quonfig.get("api.url");
    return typeof url === "string" ? url : "https://api.default.com";
  }

  get themeColor(): string {
    const color = this.quonfig.get("theme.color");
    return typeof color === "string" ? color : "#000000";
  }

  calculateTimeout(multiplier: number): number {
    const baseValue = this.quonfig.get("timeout.base");
    const base = typeof baseValue === "number" ? baseValue : 1000;
    return base * multiplier;
  }
}

// Create a typed hook for our test class
export const useAppConfig = createQuonfigHook(AppConfig);

// Component using the custom typed hook
export function HookComponent() {
  const { appName, apiUrl, calculateTimeout, loading } = useAppConfig();

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h1 data-testid="app-name-hook">{String(appName)}</h1>
      <div data-testid="api-url">{String(apiUrl)}</div>
      <div data-testid="timeout">
        {
          // @ts-expect-error We don't care about this error in a test
          calculateTimeout(2)
        }
      </div>
    </div>
  );
}

export const typesafeTestConfig = {
  "app.name": "Test App From TestProvider",
  "api.url": "https://test-provider.example.com",
  "theme.color": "#00FF00",
  "my.cool.feature": true,
  "timeout.base": 3000,
};

export const mockEvaluationsResponse = {
  evaluations: {
    "app.name": { value: { string: "Test App" } },
    "api.url": { value: { string: "https://api.test.com" } },
    "theme.color": { value: { string: "#FF5500" } },
    "my.cool.feature": { value: { boolean: true } },
    "timeout.base": { value: { int: 2000 } },
  },
};
