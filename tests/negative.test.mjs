import { test } from "node:test";
import assert from "node:assert/strict";
import { add } from "../src/calculator.js";
test("AC-NEGATIVE: supports negative numbers", () => assert.equal(add(-3, 2), -1));
