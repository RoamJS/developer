import runExtension from "roamjs-components/util/runExtension";
import createHTMLObserver from "roamjs-components/dom/createHTMLObserver";
import getBlockUidFromTarget from "roamjs-components/dom/getBlockUidFromTarget";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import createBlock from "roamjs-components/writes/createBlock";
import extractRef from "roamjs-components/util/extractRef";
import getCodeFromBlock from "./getCodeFromBlock";

const AsyncFunction: FunctionConstructor = new Function(
  `return Object.getPrototypeOf(async function(){}).constructor`
)();

export default runExtension({
  run: async () => {
    createHTMLObserver({
      className: "bp3-button",
      tag: "BUTTON",
      callback: (b: HTMLButtonElement) => {
        const parentUid = getBlockUidFromTarget(b);
        if (parentUid && !b.hasAttribute("data-roamjs-developer-button")) {
          b.setAttribute("data-roamjs-developer-button", "true");
          // We include textcontent here bc there could be multiple smartblocks in a block
          const regex = new RegExp(`{{${b.textContent}:developer:(.*?)}}`);
          const text = getTextByBlockUid(parentUid);
          const match = regex.exec(text);
          if (match) {
            const { [1]: buttonText = "" } = match;
            const [ref] = buttonText.split(":");
            b.addEventListener("click", (e) => {
              const content = getTextByBlockUid(extractRef(ref));
              if (!content) {
                createBlock({
                  node: {
                    text: `Could not find a code block to execute with uid ${ref}:`,
                    children: [{ text: ref }],
                  },
                  parentUid,
                });
              } else {
                const code = getCodeFromBlock(content);

                Promise.resolve(new AsyncFunction(code)()).then((result) => {
                  if (typeof result === "undefined" || result === null) {
                    return "";
                  } else if (Array.isArray(result)) {
                    return result.map((r) => {
                      if (typeof r === "undefined" || r === null) {
                        return "";
                      } else if (typeof r === "object") {
                        return {
                          text: (r.text || "").toString(),
                          children: [...r.children],
                        };
                      } else {
                        return r.toString();
                      }
                    });
                  } else {
                    return result.toString();
                  }
                });
              }
              e.stopPropagation();
            });
          }
        }
      },
    });
  },
});
