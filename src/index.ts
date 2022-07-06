import Dashboard from "./DeveloperDashboard";
import addStyle from "roamjs-components/dom/addStyle";
import runExtension from "roamjs-components/util/runExtension";
import toConfigPageName from "roamjs-components/util/toConfigPageName";
import { createConfigObserver } from "roamjs-components/components/ConfigPage";
import type {
  Field,
  CustomField,
} from "roamjs-components/components/ConfigPanels/types";
import CustomPanel from "roamjs-components/components/ConfigPanels/CustomPanel";
import TextPanel from "roamjs-components/components/ConfigPanels/TextPanel";
import createHTMLObserver from "roamjs-components/dom/createHTMLObserver";
import getBlockUidFromTarget from "roamjs-components/dom/getBlockUidFromTarget";
import StripePanel from "./StripePanel";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import createBlock from "roamjs-components/writes/createBlock";

const extensionId = "developer";
const AsyncFunction: FunctionConstructor = new Function(
  `return Object.getPrototypeOf(async function(){}).constructor`
)();

export default runExtension({
  extensionId,
  run: async () => {
    const style = addStyle(`.roamjs-developer-path {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-left: 16px;
      border-radius: 4px;
    }
    
    .roamjs-developer-path:hover {
      background-color: #eeeeee;
    }`);
    const { observer } = await createConfigObserver({
      title: toConfigPageName(extensionId),
      config: {
        tabs: [
          {
            id: "home",
            fields: [
              {
                Panel: CustomPanel,
                title: "extensions",
                description: "The list of extensions you have on RoamJS",
                options: {
                  component: Dashboard,
                },
              } as Field<CustomField>,
              {
                Panel: TextPanel,
                title: "prefix",
                description:
                  "The prefix used for the documentation for your extensions",
              },
              {
                Panel: CustomPanel,
                title: "stripe",
                description:
                  "Connect your Stripe account to receive sponsorships directly",
                options: {
                  component: StripePanel,
                },
              } as Field<CustomField>,
            ],
          },
        ],
      },
    });

    const buttonObserver = createHTMLObserver({
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
            const { [1]: buttonText = "", index, [0]: full } = match;
            const [ref] = buttonText.split(":");
            b.addEventListener("click", (e) => {
              const content = getTextByBlockUid(ref);
              if (!content) {
                createBlock({
                  node: {
                    text: `Could not find a code block to execute with uid ${ref}:`,
                    children: [{ text: ref }],
                  },
                  parentUid,
                });
              } else {
                const code = content
                  .replace(/^\s*```javascript(\n)?/, "")
                  .replace(/(\n)?```\s*$/, "")
                  .replace(/^\s*`/, "")
                  .replace(/`\s*$/, "");

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
    return {
      elements: [style],
      observers: [observer, buttonObserver],
    };
  },
});
