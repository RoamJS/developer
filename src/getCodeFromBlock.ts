const getCodeFromBlock = (content: string) =>
  content
    .replace(/^\s*```javascript(\n)?/, "")
    .replace(/(\n)?```\s*$/, "")
    .replace(/^\s*`/, "")
    .replace(/`\s*$/, "");

export default getCodeFromBlock;
