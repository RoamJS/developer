import { Button, InputGroup, Intent, Label, Spinner } from "@blueprintjs/core";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import createPage from "roamjs-components/writes/createPage";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import openBlockInSidebar from "roamjs-components/writes/openBlockInSidebar";
import apiPost from "roamjs-components/util/apiPost";
import useRoamJSTokenWarning from "roamjs-components/hooks/useRoamJSTokenWarning";
import useSubTree from "roamjs-components/hooks/useSubTree";
import { render as renderToast } from "roamjs-components/components/Toast";
import { Extension, getExtensions, refreshPaths } from "./pathsCache";
import ExtensionsPage from "./ExtensionsPage";

const DeveloperDashboard = ({ parentUid }: { parentUid: string }) => {
  useRoamJSTokenWarning();
  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [paths, setPaths] = useState<Extension[]>([]);
  const [newPath, setNewPath] = useState("");
  const [error, setError] = useState("");
  const catchError = useCallback((e: Error) => setError(e.message), [setError]);
  useEffect(() => {
    if (initialLoading) {
      refreshPaths()
        .then(() => setPaths(getExtensions()))
        .catch(catchError)
        .finally(() => setInitialLoading(false));
    }
  }, [initialLoading, setInitialLoading]);
  const prefix =
    useSubTree({ key: "prefix", parentUid }).children[0]?.text || "";
  const sortedPaths = useMemo(
    () => paths.sort((a, b) => a.id.localeCompare(b.id)),
    [paths]
  );
  return initialLoading ? (
    <Spinner />
  ) : (
    <div>
      <h4
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span>Paths</span> <div>{loading && <Spinner size={16} />}</div>
      </h4>
      <ul style={{ paddingLeft: 0 }}>
        {sortedPaths.map((p) => {
          const title = `${prefix}${p.id}`;
          const uid = getPageUidByPageTitle(title);
          return (
            <li key={p.id} className={"roamjs-developer-path"}>
              <span
                style={{
                  cursor: "pointer",
                  flexGrow: 1,
                  display: "inline-block",
                }}
                onClick={(e) => {
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
                {p.id}
              </span>
              <ExtensionsPage
                title={title}
                parentUid={uid}
                onSuccess={() => setPaths(getExtensions())}
                {...p}
              />
            </li>
          );
        })}
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
              .then(() => 
                createPage({
                  title: newPath,
                  tree: [{ text: "Documentation", viewType: "document" }],
                })
              ).then(() => {
                setNewPath("");
                setPaths([
                  ...paths,
                  { id: newPath, state: "DEVELOPMENT" } as const,
                ]);
                refreshPaths();
                renderToast({
                  content: `New path ${newPath} has been successfully reserved!`,
                  intent: Intent.SUCCESS,
                  id: "developer-panel",
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
    </div>
  );
};

export default DeveloperDashboard;
