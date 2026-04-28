import * as fs from "node:fs";
import * as path from "node:path";

// qfg-noa: When @quonfig/javascript is installed as a copy (yarn `file:` proto),
// the dist/ inside sdk-react/node_modules drifts from the workspace sdk-javascript
// whenever sdk-javascript changes. Consumers (e.g. test-react-typesafe) then see
// two distinct Quonfig types via different realpaths and tsc fails with
// "'Quonfig' is missing the following properties from type 'Quonfig'".
// Using yarn's `portal:` protocol creates a symlink so both paths share a single
// realpath and a single type identity.
//
// Skipped in CI: the release/test workflows replace the portal: dep with a
// published npm version because there is no sibling sdk-javascript checkout
// next to sdk-react. This guard keeps the test useful locally without breaking
// CI.
const workspace = path.resolve(__dirname, "../../../sdk-javascript");
const workspaceAvailable = fs.existsSync(workspace);
const maybeTest = workspaceAvailable ? test : test.skip;

maybeTest("nested @quonfig/javascript shares realpath with workspace sdk-javascript", () => {
  const embedded = path.resolve(__dirname, "../../node_modules/@quonfig/javascript");

  expect(fs.existsSync(embedded)).toBe(true);
  expect(fs.existsSync(workspace)).toBe(true);

  expect(fs.realpathSync(embedded)).toBe(fs.realpathSync(workspace));
});
