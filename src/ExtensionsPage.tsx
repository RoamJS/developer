import { Button, Intent, Tooltip } from "@blueprintjs/core";
import getPageTitleByBlockUid from "roamjs-components/queries/getPageTitleByBlockUid";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import getFullTreeByParentUid from "roamjs-components/queries/getFullTreeByParentUid";
import type { TreeNode } from "roamjs-components/types";
import getSettingValueFromTree from "roamjs-components/util/getSettingValueFromTree";
import getSettingValuesFromTree from "roamjs-components/util/getSettingValuesFromTree";
import apiPut from "roamjs-components/util/apiPut";
import apiDelete from "roamjs-components/util/apiDelete";
import { BLOCK_REF_REGEX } from "roamjs-components/dom/constants";
import { useCallback, useState } from "react";
import { render as renderToast } from "roamjs-components/components/Toast";
import apiPost from "roamjs-components/util/apiPost";
import { Extension, refreshPaths } from "./pathsCache";
import extractRef from "roamjs-components/util/extractRef";
import getCodeFromBlock from "./getCodeFromBlock";

const EMBED_REF_REGEX = new RegExp(
  `{{(?:\\[\\[)?embed(?:\\]\\])?:\\s*${BLOCK_REF_REGEX.source}\\s*}}`,
  "g"
);

const ALIAS_BLOCK_REGEX = new RegExp(
  `\\[(.*?)\\]\\(${BLOCK_REF_REGEX.source}\\)`,
  "g"
);

const ExtensionsPage = ({
  id,
  state,
  title,
  parentUid,
  onSuccess,
}: {
  title: string;
  parentUid: string;
  onSuccess?: () => void;
} & Extension) => {
  const [loading, setLoading] = useState(false);
  const catchError = useCallback(
    (e: Error) =>
      renderToast({
        content: e.message,
        intent: Intent.DANGER,
        id: "developer-panel",
      }),
    []
  );
  return (
    <span className="mr-4">
      <Tooltip content={"Update Extension"}>
        <Button
          icon={"upload"}
          minimal
          disabled={loading}
          style={{ margin: "0 8px" }}
          onClick={() => {
            setLoading(true);
            setTimeout(() => {
              const tree = getFullTreeByParentUid(parentUid).children;
              const { children, viewType } = tree.find((t) =>
                /documentation/i.test(t.text)
              ) || {
                children: [] as TreeNode[],
                viewType: "document",
              };
              const isExternal = (s: string) =>
                s !== title && !s.startsWith(`${title}/`);
              const resolveRefsInNode = (t: TreeNode) => {
                t.text = t.text
                  .replace(EMBED_REF_REGEX, (_, blockUid) => {
                    const tree = getFullTreeByParentUid(blockUid);
                    t.children.push(...tree.children);
                    t.heading = tree.heading;
                    t.viewType = tree.viewType || "bullet";
                    t.textAlign = tree.textAlign;
                    return tree.text;
                  })
                  .replace(ALIAS_BLOCK_REGEX, (_, alias, blockUid) => {
                    const page = getPageTitleByBlockUid(blockUid)
                      .replace(/ /g, "_")
                      .toLowerCase();
                    return isExternal(page)
                      ? alias
                      : `[${alias}](/extensions/${page}#${blockUid})`;
                  })
                  .replace(BLOCK_REF_REGEX, (_, blockUid) => {
                    const reference = getTextByBlockUid(blockUid);
                    const page = getPageTitleByBlockUid(blockUid)
                      .replace(/ /g, "_")
                      .toLowerCase();
                    return isExternal(page)
                      ? reference
                      : `[${reference}](/extensions/${page}#${blockUid})`;
                  });
                t.children.forEach(resolveRefsInNode);
              };
              children.forEach(resolveRefsInNode);
              const subpageTitles = window.roamAlphaAPI
                .q(
                  `[:find 
                    (pull ?b [:node/title :block/uid [:children/view-type :as "viewType"]]) 
                  :where 
                    [?b :node/title ?title] 
                    [(clojure.string/starts-with? ?title  "${title}/")]
                  ]`
                )
                .map(
                  (r) =>
                    r[0] as {
                      title: string;
                      uid: string;
                      viewType: string;
                    }
                );
              apiPut("developer-path", {
                path: id,
                blocks: children,
                viewType,
                description: getSettingValueFromTree({
                  tree,
                  key: "description",
                }),
                contributors: getSettingValuesFromTree({
                  tree,
                  key: "contributors",
                }),
                subpages: Object.fromEntries(
                  subpageTitles.map((t) => [
                    t.title.substring(title.length + 1),
                    {
                      nodes: getFullTreeByParentUid(t.uid).children.map((t) => {
                        resolveRefsInNode(t);
                        return t;
                      }),
                      viewType: t.viewType,
                    },
                  ])
                ),
                thumbnail: getSettingValueFromTree({
                  tree,
                  key: "thumbnail",
                }).match(/!\[(?:.*?)\]\((.*?)\)/)?.[1],
                entry: getSettingValueFromTree({
                  tree,
                  key: "entry",
                }),
                implementation: getCodeFromBlock(
                  getTextByBlockUid(
                    extractRef(
                      getSettingValueFromTree({
                        tree,
                        key: "implementation",
                      })
                    )
                  )
                ),
              })
                .then(() => {
                  renderToast({
                    content: `Documentation has updated successfully for ${id}!`,
                    intent: Intent.SUCCESS,
                    id: "developer-panel",
                  });
                })
                .catch(catchError)
                .finally(() => setLoading(false));
            }, 1);
          }}
        />
      </Tooltip>
      {state === "DEVELOPMENT" ? (
        <Tooltip content={"Apply for Live"}>
          <Button
            icon={"application"}
            minimal
            disabled={loading}
            onClick={() => {
              setLoading(true);
              apiPost<{ success: boolean }>({
                path: "developer-application",
                data: {
                  id,
                },
              })
                .then((r) => {
                  if (r.success) {
                    refreshPaths().then(() => {
                      renderToast({
                        id: "developer-panel",
                        content:
                          "Successfully submitted application! Please allow up to 24 hours for the extension to undergo review.",
                        intent: Intent.SUCCESS,
                      });
                      onSuccess?.();
                    });
                  } else {
                    renderToast({
                      id: "developer-panel",
                      content:
                        "Something went wrong. Reach out to support@roamjs.com for help.",
                      intent: Intent.DANGER,
                    });
                  }
                })
                .catch(catchError)
                .finally(() => setLoading(false));
            }}
          />
        </Tooltip>
      ) : state === "LIVE" ? (
        <Tooltip content={"Request Removal"}>
          <Button
            icon={"remove"}
            disabled={loading}
            minimal
            onClick={() =>
              renderToast({
                id: "developer-panel",
                intent: Intent.WARNING,
                content:
                  "This feature is not yet supported. Reach out to support@roamjs.com if you need to remove an extension.",
              })
            }
          />
        </Tooltip>
      ) : state === "UNDER REVIEW" ? (
        <Tooltip content={"Check Status"}>
          <Button
            disabled={loading}
            icon={"stopwatch"}
            minimal
            onClick={() =>
              renderToast({
                id: "developer-panel",
                intent: Intent.WARNING,
                content:
                  "Email support@roamjs.com to check on the status of your extension application.",
              })
            }
          />
        </Tooltip>
      ) : state === "PRIVATE" ? (
        <Tooltip content={"Make Public"}>
          <Button
            disabled={loading}
            icon={"eye-open"}
            minimal
            onClick={() =>
              renderToast({
                id: "developer-panel",
                intent: Intent.WARNING,
                content:
                  "Email support@roamjs.com to make your private extension public",
              })
            }
          />
        </Tooltip>
      ) : (
        state
      )}
      <Tooltip content={"Delete Path"}>
        <Button
          icon={"delete"}
          disabled={loading}
          style={{ marginLeft: 8 }}
          minimal
          onClick={() => {
            setLoading(true);
            apiDelete({
              path: `developer-path`,
              data: { path: id },
            })
              .then(refreshPaths)
              .then(() => {
                renderToast({
                  id: "developer-panel",
                  content: `Path ${id} has been successfully removed.`,
                  intent: Intent.SUCCESS,
                });
                onSuccess?.();
              })
              .catch(catchError)
              .finally(() => setLoading(false));
          }}
        />
      </Tooltip>
    </span>
  );
};

export default ExtensionsPage;
