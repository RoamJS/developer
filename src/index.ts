import Dashboard from "./DeveloperDashboard";
import addStyle from "roamjs-components/dom/addStyle";
import runExtension from "roamjs-components/util/runExtension";
import toConfigPageName from "roamjs-components/util/toConfigPageName";
import {
  createConfigObserver,
  render as configPageRender,
} from "roamjs-components/components/ConfigPage";
import type {
  Field,
  CustomField,
} from "roamjs-components/components/ConfigPanels/types";
import CustomPanel from "roamjs-components/components/ConfigPanels/CustomPanel";
import BlocksPanel from "roamjs-components/components/ConfigPanels/BlocksPanel";
import TextPanel from "roamjs-components/components/ConfigPanels/TextPanel";
import MultiTextPanel from "roamjs-components/components/ConfigPanels/MultiTextPanel";
import createHTMLObserver from "roamjs-components/dom/createHTMLObserver";
import getBlockUidFromTarget from "roamjs-components/dom/getBlockUidFromTarget";
import StripePanel from "./StripePanel";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import createBlock from "roamjs-components/writes/createBlock";
import extractRef from "roamjs-components/util/extractRef";
import getPageTitleValueByHtmlElement from "roamjs-components/dom/getPageTitleValueByHtmlElement";
import { getExtensions, hasPath } from "./pathsCache";
import React from "react";
import ExtensionPage from "./ExtensionsPage";
import getCodeFromBlock from "./getCodeFromBlock";

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

    const headingObserver = createHTMLObserver({
      tag: "H1",
      className: "rm-title-display",
      callback: (h1: HTMLHeadingElement) => {
        const title = getPageTitleValueByHtmlElement(h1);
        if (hasPath(title)) {
          const extension = getExtensions().find((e) => title.endsWith(e.id));
          configPageRender({
            h: h1,
            title,
            config: {
              tabs: [
                {
                  id: "home",
                  fields: [
                    {
                      title: "Actions",
                      description:
                        "Publish or delete your extension from RoamJS",
                      Panel: CustomPanel,
                      options: {
                        component: ({ parentUid }) =>
                          React.createElement(ExtensionPage, {
                            title,
                            parentUid,
                            ...extension,
                          }),
                      },
                    } as Field<CustomField>,
                    {
                      title: "Documentation",
                      description:
                        "The content users need to know how to use your extension",
                      Panel: BlocksPanel,
                    },
                    {
                      title: "Description",
                      description: "The description for your extension",
                      Panel: TextPanel,
                    },
                    {
                      title: "Contributors",
                      description:
                        "Anyone else who helped contribute to the extension",
                      Panel: MultiTextPanel,
                    },
                    {
                      title: "Thumbnail",
                      description: "The thumbnail to represent your extension",
                      Panel: TextPanel,
                    },
                    {
                      title: "Entry",
                      description:
                        "The custom URL to host the main entry file of your extension, if not hosted on RoamJS",
                      Panel: TextPanel,
                    },
                    {
                      title: "Implementation",
                      description:
                        "Block reference pointing to the implementation of the extension, if coded within Roam",
                      Panel: TextPanel,
                    },
                  ],
                },
              ],
            },
          });
        }
      },
    });
    return {
      elements: [style],
      observers: [observer, buttonObserver, headingObserver],
    };
  },
});
