import {
  Button,
  InputGroup,
  Intent,
  Label,
  Position,
  Spinner,
  Toaster,
  Tooltip,
} from "@blueprintjs/core";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BLOCK_REF_REGEX } from "roamjs-components/dom/constants";
import createPage from "roamjs-components/writes/createPage";
import getPageTitleByBlockUid from "roamjs-components/queries/getPageTitleByBlockUid";
import getPageTitlesStartingWithPrefix from "roamjs-components/queries/getPageTitlesStartingWithPrefix";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import getFullTreeByParentUid from "roamjs-components/queries/getFullTreeByParentUid";
import openBlockInSidebar from "roamjs-components/writes/openBlockInSidebar";
import { TreeNode } from "roamjs-components/types";
import setInputSetting from "roamjs-components/util/setInputSetting";
import {
  ServiceDashboard,
  StageContent,
  NextButton as ServiceNextButton,
  useNextStage as useServiceNextStage,
  usePageUid as useServicePageUid,
  useField as useServiceField,
  useSetMetadata as useServiceSetMetadata,
  useGetMetadata as useServiceGetMetadata,
  MainStage as WrapServiceMainStage,
} from "roamjs-components/components/ServiceComponents";
import getSettingValueFromTree from "roamjs-components/util/getSettingValueFromTree";
import getSettingValuesFromTree from "roamjs-components/util/getSettingValuesFromTree";
import getSettingIntFromTree from "roamjs-components/util/getSettingIntFromTree";
import getSubTree from "roamjs-components/util/getSubTree";
import apiGet from "roamjs-components/util/apiGet";
import apiPost from "roamjs-components/util/apiPost";
import apiPut from "roamjs-components/util/apiPut";
import apiDelete from "roamjs-components/util/apiDelete";
import useRoamJSTokenWarning from "roamjs-components/hooks/useRoamJSTokenWarning";
import StripePanel from "./StripePanel";

export const developerToaster = Toaster.create({
  position: Position.TOP,
});

const EMBED_REF_REGEX = new RegExp(
  `{{(?:\\[\\[)?embed(?:\\]\\])?:\\s*${BLOCK_REF_REGEX.source}\\s*}}`,
  "g"
);

const ALIAS_BLOCK_REGEX = new RegExp(
  `\\[(.*?)\\]\\(${BLOCK_REF_REGEX.source}\\)`,
  "g"
);

const DeveloperContent: StageContent = () => {
  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [paths, setPaths] = useState<string[]>([]);
  const setMetadataPaths = useServiceSetMetadata("paths");
  const [newPath, setNewPath] = useState("");
  const [error, setError] = useState("");
  const setAllPaths = useCallback(
    (ps) => {
      setPaths(ps);
      setMetadataPaths(ps);
    },
    [setPaths, setMetadataPaths]
  );
  useEffect(() => {
    if (initialLoading) {
      Promise.all([
        apiGet("developer-path")
          .then((r) => setAllPaths(r.data.value || []))
          .catch(() => setAllPaths([])),
        apiGet("check").then(
          (r) => !r.data.success && apiPost("developer-init")
        ).catch(console.error),
      ]).finally(() => setInitialLoading(false));
    }
  }, [initialLoading, setInitialLoading]);
  const prefix = useServiceField("prefix");
  const sortedPaths = useMemo(() => paths.sort(), [paths]);
  return initialLoading ? (
    <Spinner />
  ) : (
    <div>
      <h4>Paths</h4>
      <ul>
        {sortedPaths.map((p) => (
          <li
            key={p}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
            className={"roamjs-developer-path"}
          >
            <span
              style={{
                cursor: "pointer",
              }}
              onClick={(e) => {
                const title = `${prefix}${p}`;
                const uid = getPageUidByPageTitle(title);
                return (
                  uid ? Promise.resolve(uid) : createPage({ title })
                ).then((uid) => {
                  if (e.shiftKey) {
                    openBlockInSidebar(uid);
                  } else {
                    window.roamAlphaAPI.ui.mainWindow.openPage({
                      page: { uid },
                    });
                  }
                });
              }}
            >
              {p}
            </span>
            <span style={{ marginRight: 16 }}>
              <Tooltip content={"Update Documentation"}>
                <Button
                  icon={"upload"}
                  minimal
                  style={{ margin: "0 8px" }}
                  onClick={() => {
                    setLoading(true);
                    setError("");
                    setTimeout(() => {
                      const title = `${prefix}${p}`;
                      const tree = getFullTreeByParentUid(
                        getPageUidByPageTitle(title)
                      ).children;
                      const { children, viewType } = tree.find((t) =>
                        /documentation/i.test(t.text)
                      ) || {
                        children: [] as TreeNode[],
                        viewType: "document",
                      };
                      const isExternal = (s: string) =>
                        s !== p && !s.startsWith(`${p}/`);
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
                        .map((r) => r[0] as { title: string; uid: string; viewType: string });
                      const { children: premiumTree } = getSubTree({
                        tree,
                        key: "premium",
                      });
                      apiPut("developer-path", {
                        path: p,
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
                              nodes: getFullTreeByParentUid(t.uid).children.map(
                                (t) => {
                                  resolveRefsInNode(t);
                                  return t;
                                }
                              ),
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
                        premium: premiumTree.length
                          ? {
                              price: getSettingIntFromTree({
                                tree: premiumTree,
                                key: "price",
                              }),
                              description: getSettingValuesFromTree({
                                tree: premiumTree,
                                key: "description",
                              }),
                              name: getSettingValueFromTree({
                                tree: premiumTree,
                                key: "name",
                              }),
                              usage: getSettingValueFromTree({
                                tree: premiumTree,
                                key: "usage",
                              }),
                              quantity: getSettingIntFromTree({
                                tree: premiumTree,
                                key: "quantity",
                              }),
                            }
                          : undefined,
                      })
                        .then(() => {
                          developerToaster.show({
                            message: `Documentation has updated successfully for ${p}!`,
                            intent: Intent.SUCCESS,
                          });
                        })
                        .catch((e) =>
                          setError(
                            e.response?.data?.error ||
                              e.response?.data ||
                              e.message
                          )
                        )
                        .finally(() => setLoading(false));
                    }, 1);
                  }}
                />
              </Tooltip>
              <Tooltip content={"Delete Path"}>
                <Button
                  icon={"delete"}
                  minimal
                  onClick={() => {
                    setLoading(true);
                    setError("");
                    apiDelete(
                      `developer-path?path=${encodeURIComponent(p)}`
                    )
                      .then((r) => {
                        setAllPaths(r.data.paths);
                        developerToaster.show({
                          message: `Path ${p} has been successfully removed.`,
                          intent: Intent.SUCCESS,
                        });
                      })
                      .catch((e) =>
                        setError(
                          e.response?.data?.error ||
                            e.response?.data ||
                            e.message
                        )
                      )
                      .finally(() => setLoading(false));
                  }}
                />
              </Tooltip>
            </span>
          </li>
        ))}
      </ul>
      <div style={{ marginTop: 16, display: "flex", alignItems: "center" }}>
        <Label style={{ flexGrow: 1 }}>
          Path
          <InputGroup
            value={newPath}
            onChange={(e) => {
              setNewPath(e.target.value);
              setError("");
            }}
            intent={error ? Intent.DANGER : Intent.PRIMARY}
          />
          <span style={{ color: "darkred" }}>{error}</span>
        </Label>
        <Button
          onClick={() => {
            setLoading(true);
            apiPost("developer-path", { path: newPath })
              .then((r) => {
                createPage({
                  title: newPath,
                  tree: [{ text: "Documentation" }],
                });
                setNewPath("");
                setAllPaths(r.data.paths);
                developerToaster.show({
                  message: `New path ${newPath} has been successfully reserved!`,
                  intent: Intent.SUCCESS,
                });
              })
              .catch((e) => setError(e.response?.data || e.message))
              .finally(() => setLoading(false));
          }}
          style={{ margin: "8px 16px 0 16px" }}
          disabled={!!error}
        >
          Request Path
        </Button>
      </div>
      <div>{loading && <Spinner size={16} />}</div>
    </div>
  );
};

const RequestPrefixContent: StageContent = ({ openPanel }) => {
  const nextStage = useServiceNextStage(openPanel);
  const pageUid = useServicePageUid();
  const paths = useServiceGetMetadata("paths") as string[];
  const oldPrefix = useServiceField("prefix");
  const [value, setValue] = useState(oldPrefix);
  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setValue(e.target.value),
    [setValue]
  );
  const onSubmit = useCallback(() => {
    setInputSetting({ blockUid: pageUid, key: "prefix", value, index: 1 });
    paths
      .flatMap((s) => [
        s,
        ...getPageTitlesStartingWithPrefix(`${oldPrefix}${s}/`).map((sp) =>
          sp.substring(oldPrefix.length)
        ),
      ])
      .forEach((s) =>
        window.roamAlphaAPI.updatePage({
          page: {
            uid: getPageUidByPageTitle(`${oldPrefix}${s}`),
            title: `${value}${s}`,
          },
        })
      );
    nextStage();
  }, [value, nextStage, pageUid]);
  const disabled = value === oldPrefix;
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (
        e.key === "Enter" &&
        !e.shiftKey &&
        !e.altKey &&
        !e.metaKey &&
        !e.ctrlKey &&
        !disabled
      ) {
        onSubmit();
      }
    },
    [onSubmit]
  );
  return (
    <>
      <Label>
        {"Documentation Prefix"}
        <InputGroup value={value} onChange={onChange} onKeyDown={onKeyDown} />
      </Label>
      <ServiceNextButton onClick={onSubmit} disabled={disabled} />
    </>
  );
};

const RequestStripePanel: StageContent = ({ openPanel }) => {
  const nextStage = useServiceNextStage(openPanel);
  const pageUid = useServicePageUid();
  return (
    <>
      <div style={{ marginBottom: 32 }}>
        <StripePanel parentUid={pageUid} />
      </div>
      <ServiceNextButton onClick={nextStage} />
    </>
  );
};

const DeveloperDashboard = (): React.ReactElement => {
  useRoamJSTokenWarning();
  return (
    <ServiceDashboard
      service={"developer"}
      stages={[
        WrapServiceMainStage(DeveloperContent),
        {
          component: RequestPrefixContent,
          setting: "Prefix",
        },
        {
          component: RequestStripePanel,
          setting: "Payout",
        },
      ]}
    />
  );
};

export default DeveloperDashboard;
