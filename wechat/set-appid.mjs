// 把 AppID 写进小游戏工程配置
// 用法：node set-appid.mjs wx1234567890abcdef
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const appid = (process.argv[2] || "").trim();
if (!/^wx[0-9a-fA-F]{16}$/.test(appid)) {
  console.error("❌ AppID 格式不对。应为 wx + 16 位十六进制，例如 wx1234567890abcdef");
  console.error("   在 微信公众平台 → 开发管理 → 开发设置 里复制。");
  process.exit(1);
}
const file = path.join(dir, "project.config.json");
const cfg = JSON.parse(fs.readFileSync(file, "utf8"));
cfg.appid = appid;
fs.writeFileSync(file, JSON.stringify(cfg, null, 2) + "\n", "utf8");
console.log("✅ 已写入 AppID：" + appid);
console.log("   现在可以用微信开发者工具导入 wechat/ 目录并上传了。");
