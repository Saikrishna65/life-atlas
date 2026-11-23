import { test } from "node:test";
import assert from "node:assert/strict";
import {
  authenticationScopes,
  defaultAuthenticationPolicy,
  validateAuthenticationPolicy,
  routeAuthenticationScope,
} from "../../src/lib/security/authentication";
test("every authentication location is opt-in and defaults remain independent", () => {
  const first = defaultAuthenticationPolicy(),
    second = defaultAuthenticationPolicy();
  assert.equal(authenticationScopes.length, 8);
  assert.ok(Object.values(first).every((value) => value === false));
  first.app = true;
  assert.equal(second.app, false);
  assert.deepEqual(validateAuthenticationPolicy({ gallery: true }), {
    ...second,
    gallery: true,
  });
});
test("invalid policy data cannot become a truthy or silently disabled check", () => {
  for (const value of [
    null,
    [],
    { app: "false" },
    { app: 1 },
    { newScope: true },
  ])
    assert.throws(() => validateAuthenticationPolicy(value));
});
test("private route gates are precise and never affect the public site", () => {
  assert.equal(routeAuthenticationScope("/secret/gallery/library"), "gallery");
  assert.equal(routeAuthenticationScope("/secret/atlas"), "privateSections");
  assert.equal(
    routeAuthenticationScope("/secret/vault/trip-1"),
    "privateSections",
  );
  for (const path of [
    "/",
    "/trips",
    "/secret/control-room",
    "/secret/gallery-other",
  ])
    assert.equal(routeAuthenticationScope(path), undefined);
});
