import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import app from "../src/server.js";

test("health endpoint responds", async () => {
  const res = await request(app).get("/");
  assert.equal(res.status, 200);
  assert.ok(res.body.message);
});

test("protected endpoint requires auth", async () => {
  const res = await request(app).get("/api/auth/me");
  assert.equal(res.status, 401);
});
