import fs from "fs";
export default function frappeVueStyle() {
  return {
    name: "frappe-vue-style",
    transform(code, id) {
      if (!id.endsWith(".vue")) return null;
      const styleMatch = code.match(/<style[^>]*>([\s\S]*?)<\/style>/);
      if (!styleMatch) return null;
      const css = styleMatch[1];
      const relPath = id.split("public/js").pop().replace(".vue", ".css");
      const out = `posawesome/public/css${relPath}`;
      fs.mkdirSync(out.substring(0, out.lastIndexOf("/")), { recursive: true });
      fs.writeFileSync(out, css);
      return null;
    }
  };
}
