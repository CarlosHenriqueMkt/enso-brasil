import type { Reporter, TestModule, TestCase } from "vitest/node";

const isCI = process.env.CI === "1" || process.env.CI === "true";

export default class NoSkipReporter implements Reporter {
  onTestRunEnd(testModules: ReadonlyArray<TestModule>): void {
    if (!isCI) return;

    const skipped: string[] = [];
    for (const mod of testModules) {
      for (const test of collectTests(mod)) {
        const state = test.result()?.state;
        if (state === "skipped" || state === "pending") {
          skipped.push(`${mod.moduleId} → ${test.fullName}`);
        }
      }
    }

    if (skipped.length > 0) {
      console.error(`\n[no-skip] ${skipped.length} test(s) skipped in CI — failing run:`);
      for (const name of skipped) console.error(`  - ${name}`);
      process.exitCode = 1;
    }
  }
}

function* collectTests(node: { children: Iterable<unknown> }): Generator<TestCase> {
  for (const child of node.children) {
    if (isTestCase(child)) {
      yield child;
    } else if (hasChildren(child)) {
      yield* collectTests(child);
    }
  }
}

function isTestCase(x: unknown): x is TestCase {
  return (
    typeof x === "object" && x !== null && "type" in x && (x as { type: string }).type === "test"
  );
}

function hasChildren(x: unknown): x is { children: Iterable<unknown> } {
  return typeof x === "object" && x !== null && "children" in x;
}
