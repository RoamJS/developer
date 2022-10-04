import runExtension from "roamjs-components/util/runExtension";
import createHTMLObserver from "roamjs-components/dom/createHTMLObserver";
import getBlockUidFromTarget from "roamjs-components/dom/getBlockUidFromTarget";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import createBlock from "roamjs-components/writes/createBlock";
import extractRef from "roamjs-components/util/extractRef";
import getCodeFromBlock from "./getCodeFromBlock";
import getParentUidByBlockUid from "roamjs-components/queries/getParentUidByBlockUid";
import getOrderByBlockUid from "roamjs-components/queries/getOrderByBlockUid";
import getChildrenLengthByParentUid from "roamjs-components/queries/getChildrenLengthByParentUid";
import apiGet from "roamjs-components/util/apiGet";
import { render as renderToast } from "roamjs-components/components/Toast";

const AsyncFunction: FunctionConstructor = new Function(
  `return Object.getPrototypeOf(async function(){}).constructor`
)();

export default runExtension({
  run: async (args) => {
    args.extensionAPI.settings.panel.create({
      tabTitle: "Developer",
      settings: [
        {
          id: "username",
          name: "GitHub Username",
          action: { type: "input", placeholder: "dvargas92495" },
          description: "Your GitHub username",
        },
        {
          id: "token",
          name: "GitHub Token",
          action: { type: "input", placeholder: "ghp_xxx..." },
          description: "The GitHub token to use during quering",
        },
      ],
    });

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

    window.roamAlphaAPI.ui.commandPalette.addCommand({
      label: "Import My GitHub Issues",
      callback: async () => {
        const username = args.extensionAPI.settings.get("username");
        const token = args.extensionAPI.settings.get("token");
        const blockUid =
          window.roamAlphaAPI.ui.getFocusedBlock()?.["block-uid"];
        const parentUid = blockUid
          ? getParentUidByBlockUid(blockUid)
          : await window.roamAlphaAPI.ui.mainWindow.getOpenPageOrBlockUid();
        const base = blockUid
          ? getOrderByBlockUid(blockUid)
          : getChildrenLengthByParentUid(blockUid);
        return apiGet<{ data: { title: string; html_url: string }[] }>({
          domain: "https://api.github.com",
          path: "issues",
          authorization: `Basic ${window.btoa(`${username}:${token}`)}`,
        })
          .then(({ data: issues }) => {
            if (issues.length === 0) {
              createBlock({
                parentUid,
                order: base,
                node: { text: "No issues created by you!" },
              });
              return;
            }
            issues
              .map((i) => `[${i.title}](${i.html_url})`)
              .map((text, index) =>
                createBlock({
                  parentUid,
                  order: base + index,
                  node: { text },
                })
              );
          })
          .catch((e) =>
            renderToast({
              id: "github-fail",
              content: `Failed to import GitHub issues: ${e.message}`,
              intent: "danger",
            })
          );
      },
    });

    return {
      commands: ["Import My GitHub Issues"],
    };
  },
});
