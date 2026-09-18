import { LiIntentBridge } from "../js/voice/li-intent-bridge.js";
import assert from "node:assert";

console.log("🧪 Testing LiIntentBridge...");

const bridge = new LiIntentBridge();

// 1. Explicit tag extraction
{
  const text = "[action:retract_shell][emotion:shy] 我先躲进荔枝壳里啦！";
  const result = bridge.resolveIntent(text, "hoodie");
  assert.deepStrictEqual(result.actions, ["retract_shell"]);
  assert.deepStrictEqual(result.emotions, ["shy"]);
  assert.strictEqual(result.cleanText, "我先躲进荔枝壳里啦！");
  console.log("  ✅ Explicit action/emotion tag extraction passed.");
}

// 2. Natural language keyword intent detection (Hoodie)
{
  const text = "荔小卫，拉紧抽绳变身给我看看！";
  const result = bridge.resolveIntent(text, "hoodie");
  assert(result.actions.includes("retract_shell"), "Should detect retract_shell action");
  console.log("  ✅ Hoodie natural speech retract_shell detected.");
}

// 3. Natural language keyword intent detection (Astro)
{
  const text = "荔小星，开启零重力在空中漫游吧！";
  const result = bridge.resolveIntent(text, "astro");
  assert(result.actions.includes("zero_g_float"), "Should detect zero_g_float action");
  console.log("  ✅ Astro natural speech zero_g_float detected.");
}

// 4. Local fallback reply test
{
  const replyA = bridge.getLocalReply("躲起来", "hoodie");
  assert(replyA.actions.includes("retract_shell"));
  assert(replyA.clean.length > 0);

  const replyD = bridge.getLocalReply("飞起来", "astro");
  assert(replyD.actions.includes("zero_g_float"));
  assert(replyD.clean.length > 0);
  console.log("  ✅ Local fallback offline responses valid.");
}

console.log("🎉 All LiIntentBridge tests passed successfully!");
