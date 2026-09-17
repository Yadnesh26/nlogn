import Parser from "web-tree-sitter";

const lang = process.argv[2];
const code = process.argv[3];

await Parser.init();
const language = await Parser.Language.load(`node_modules/tree-sitter-wasms/out/tree-sitter-${lang}.wasm`);
const parser = new Parser();
parser.setLanguage(language);
const tree = parser.parse(code);

function dump(node, depth) {
  const text = node.childCount === 0 ? ` "${node.text.slice(0, 20)}"` : "";
  console.log("  ".repeat(depth) + node.type + text + ` [${node.startPosition.row + 1}]`);
  for (const child of node.children) dump(child, depth + 1);
}
dump(tree.rootNode, 0);
