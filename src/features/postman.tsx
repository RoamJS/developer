import createHashtagObserver from "roamjs-components/dom/createHashtagObserver";
import getUids from "roamjs-components/dom/getUids";
import getFullTreeByParentUid from "roamjs-components/queries/getFullTreeByParentUid";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import extractTag from "roamjs-components/util/extractTag";
import { Icon, Popover, Spinner } from "@blueprintjs/core";
import axios from "axios";
import React, { useCallback, useState } from "react";
import ReactDOM from "react-dom";
import { TextNode, TreeNode, ViewType } from "roamjs-components/types/native";
import { getParseInline } from "roamjs-components/marked";
import { syncParseRoamBlocksToHtml } from "roamjs-components/dom/parseRoamBlocksToHtml";
import createTagRegex from "roamjs-components/util/createTagRegex";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import getPageTitleByBlockUid from "roamjs-components/queries/getPageTitleByBlockUid";
import createHTMLObserver from "roamjs-components/dom/createHTMLObserver";
import getPageTitleValueByHtmlElement from "roamjs-components/dom/getPageTitleValueByHtmlElement";
import getSettingValueFromTree from "roamjs-components/util/getSettingValueFromTree";

const getRoamUrl = (blockUid?: string): string =>
  `${window.location.href.replace(/\/page\/.*$/, "")}${
    blockUid ? `/page/${blockUid}` : ""
  }`;

const context = {
  pagesToHrefs: (page: string, ref?: string) =>
    ref ? getRoamUrl(ref) : getRoamUrl(getPageUidByPageTitle(page)),
  blockReferences: (ref: string) => ({
    text: getTextByBlockUid(ref),
    page: getPageTitleByBlockUid(ref),
  }),
  components: (): false => {
    return false;
  },
};

export const getParseRoamBlocks = (): Promise<
  (a: { content: TreeNode[]; viewType: ViewType }) => string
> =>
  getParseInline().then(
    (parseInline) => (args: { content: TreeNode[]; viewType: ViewType }) =>
      syncParseRoamBlocksToHtml({
        ...args,
        level: 0,
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        context,
        parseInline,
      })
  );

type PostmanProps = {
  apiUid: string;
  blockUid: string;
};

const toTextNode = (t: TreeNode): TextNode => ({
  text: t.text,
  children: t.children.map(toTextNode),
});

const toText = ({ t, i }: { t: TreeNode; i: number }): string => {
  const line = `${"".padEnd(i * 2, " ")}${t.text}\n`;
  const lines = t.children.map((c) => toText({ t: c, i: i + 1 })).join("");
  return `${line}${lines}`;
};

let parseRoamBlocks: Awaited<ReturnType<typeof getParseRoamBlocks>>;
getParseRoamBlocks().then((f) => (parseRoamBlocks = f));
const convertTextToValue = ({
  text,
  blockTree,
  tag,
}: {
  text: string;
  blockTree: { text: string; children: TreeNode[]; blockUid: string };
  tag: string;
}): string =>
  text
    ?.replace(/{block(:clean)?}/i, (_, clean) =>
      clean
        ? blockTree.text.replace(createTagRegex(extractTag(tag)), "")
        : blockTree.text
    )
    .replace(/{tree(?::(text|html))?}/i, (_, f) => {
      const format = f?.toUpperCase?.();
      if (format === "HTML") {
        return parseRoamBlocks({
          content: blockTree.children,
          viewType: "bullet",
        });
      } else if (format === "TEXT") {
        return blockTree.children.map((t) => toText({ t, i: 0 })).join("");
      } else {
        return JSON.stringify(blockTree.children.map(toTextNode));
      }
    })
    .replace(/{id}/i, blockTree.blockUid)
    .replace(/{attribute:(.*?)}/, (original, i) => {
      const blockText = blockTree.children.find((t) =>
        new RegExp(`${i}::`, "i").test(t.text)
      )?.text;
      return blockText ? blockText.split("::")[1].trim() : original;
    })
    .trim();

type BodyValue = string | boolean | Record<string, unknown> | number;

const convertNodeToValue = ({
  t,
  defaultType,
  blockTree,
  tag,
}: {
  t: TextNode;
  defaultType: string;
  blockTree: { text: string; children: TreeNode[]; blockUid: string };
  tag: string;
}): BodyValue | Array<BodyValue> => {
  const valueType =
    /{(string|number|boolean|object|array)}/i.exec(t.text)?.[1] || defaultType;
  if (valueType === "string") {
    return convertTextToValue({ text: t.text, blockTree, tag }).replace(
      /{string}/i,
      ""
    );
  } else if (valueType === "number") {
    return parseInt(
      convertTextToValue({ text: t.text, blockTree, tag }).replace(
        /{number}/i,
        ""
      )
    );
  } else if (valueType === "boolean") {
    return (
      convertTextToValue({ text: t.text, blockTree, tag }).replace(
        /{boolean}/i,
        ""
      ) === "true"
    );
  } else if (valueType === "object") {
    return Object.fromEntries(
      t.children.map((c) => [
        c.text,
        convertNodeToValue({
          t: c.children[0],
          blockTree,
          tag,
          defaultType: "string",
        }),
      ])
    );
  } else if (valueType === "array") {
    return t.children.map((c) =>
      convertNodeToValue({ t: c, defaultType: "string", blockTree, tag })
    ) as BodyValue[];
  } else {
    return "";
  }
};

const PostmanOverlay: React.FunctionComponent<PostmanProps> = ({
  apiUid,
  blockUid,
}) => {
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isError, setIsError] = useState(false);
  const [message, setMessage] = useState("");
  const fail = useCallback(
    (msg: string) => {
      setIsError(true);
      setMessage(msg);
      setTimeout(() => setIsOpen(false), 10000);
    },
    [setIsError, setMessage, setIsOpen]
  );
  const onClick = useCallback(() => {
    setIsOpen(true);
    const tree = getFullTreeByParentUid(apiUid);
    const urlNode = tree.children.find((t) => /url/i.test(t.text));
    if (!urlNode) {
      return fail(`No URL configured for API ${tree.text}`);
    }
    if (!urlNode.children.length) {
      return fail("Set URL as a child of the URL block");
    }
    const blockTree = getFullTreeByParentUid(blockUid);
    const url = urlNode.children[0].text.replace(/{id}/i, blockUid).trim();

    const bodyNode = tree.children.find((t) => /body/i.test(t.text));
    const body = bodyNode
      ? convertNodeToValue({
          t: bodyNode,
          defaultType: "object",
          blockTree: { ...blockTree, blockUid },
          tag: tree.text,
        })
      : {};
    const headersNode = tree.children.find((t) => /headers/i.test(t.text));
    const headers = headersNode
      ? Object.fromEntries(
          headersNode.children.map((t) => [t.text, t.children[0].text])
        )
      : {};

    setLoading(true);
    axios
      .post(url, body, { headers })
      .then((r) => {
        setMessage(`Success! Response:\n${JSON.stringify(r.data, null, 4)}`);
        setIsError(false);
        setTimeout(() => setIsOpen(false), 10000);
      })
      .catch((e) => fail(e.response?.data || e.message))
      .finally(() => setLoading(false));
  }, [setIsOpen, setLoading, setIsError, setMessage]);
  return (
    <Popover
      target={
        <Icon
          icon={"send-message"}
          onClick={onClick}
          style={{ marginLeft: 8 }}
          className={"cursor-pointer"}
        />
      }
      content={
        <div style={{ padding: 16 }}>
          {loading ? (
            <Spinner />
          ) : (
            <div
              style={{
                color: isError ? "darkred" : "darkgreen",
                whiteSpace: "pre-wrap",
                maxWidth: 600,
              }}
            >
              {message}
            </div>
          )}
        </div>
      }
      isOpen={isOpen}
      onInteraction={setIsOpen}
    />
  );
};

const APIS_REGEX = /apis/i;

const createBlock = ({
  node,
  parentUid,
  order,
}: {
  node: TextNode;
  parentUid: string;
  order: number;
}) => {
  const uid = window.roamAlphaAPI.util.generateUID();
  window.roamAlphaAPI.createBlock({
    location: { "parent-uid": parentUid, order },
    block: { uid, string: node.text },
  });
  node.children.forEach((n, o) =>
    createBlock({ node: n, parentUid: uid, order: o })
  );
};

const createPage = ({ title, tree }: { title: string; tree: TextNode[] }) => {
  const uid = window.roamAlphaAPI.util.generateUID();
  window.roamAlphaAPI.createPage({ page: { title, uid } });
  tree.forEach((node, order) => createBlock({ node, parentUid: uid, order }));
};

const initializePostman = () => {
  if (!getPageUidByPageTitle("roam/js/postman")) {
    createPage({
      title: "roam/js/postman",
      tree: [
        {
          text: "apis",
          children: [
            {
              text: "PostmanExample",
              children: [
                {
                  text: "url",
                  children: [
                    { text: "https://lambda.roamjs.com/postman", children: [] },
                  ],
                },
                {
                  text: "body",
                  children: [
                    { text: "foo", children: [{ text: "bar", children: [] }] },
                    {
                      text: "body_content",
                      children: [{ text: "Contents: {block}", children: [] }],
                    },
                    {
                      text: "tree_content",
                      children: [{ text: "{tree}", children: [] }],
                    },
                  ],
                },
                {
                  text: "headers",
                  children: [
                    {
                      text: "Content-Type",
                      children: [{ text: "application/json", children: [] }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
  }

  createHashtagObserver({
    attribute: "data-roamjs-postman",
    callback: (s: HTMLSpanElement) => {
      const tree = getFullTreeByParentUid(
        getPageUidByPageTitle("roam/js/postman")
      ).children;
      const tag = s.getAttribute("data-tag") || "";
      const apis = (
        tree.find((t) => APIS_REGEX.test(t.text))?.children || []
      ).filter(
        (a) =>
          getSettingValueFromTree({ tree: a.children, key: "target" }) !==
          "page"
      );
      const api = apis.find(
        (a) => tag.toUpperCase() === extractTag(a.text.trim()).toUpperCase()
      );
      if (api) {
        const { blockUid } = getUids(
          s.closest(".roam-block") as HTMLDivElement
        );
        const p = document.createElement("span");
        p.style.verticalAlign = "middle";
        p.onmousedown = (e: MouseEvent) => e.stopPropagation();
        s.appendChild(p);
        ReactDOM.render(
          <PostmanOverlay apiUid={api.uid} blockUid={blockUid} />,
          p
        );
      }
    },
  });

  createHTMLObserver({
    tag: "H1",
    className: "rm-title-display",
    callback: (h) => {
      const title = getPageTitleValueByHtmlElement(h);
      const metadata = new Set(
        (
          window.roamAlphaAPI.data.fast.q(`
      [:find ?t 
        :where 
          [?p :node/title "${title}"] 
          [?b :block/page ?p] 
          [?b :block/refs ?r] 
          [?r :node/title ?t]
      ]
     `) as [string][]
        ).map(([t]) => t)
      );
      const tree = getFullTreeByParentUid(
        getPageUidByPageTitle("roam/js/postman")
      ).children;
      const apis = tree.find((t) => APIS_REGEX.test(t.text))?.children || [];
      const pageApis = apis.filter(
        (a) =>
          getSettingValueFromTree({ tree: a.children, key: "target" }) ===
          "page"
      );
      const api = pageApis.find((a) => metadata.has(a.text.trim()));
      if (api && h.parentElement) {
        const pageUid = getPageUidByPageTitle(title);
        const p = document.createElement("span");
        p.style.verticalAlign = "middle";
        p.onmousedown = (e: MouseEvent) => e.stopPropagation();
        h.parentElement.appendChild(p);
        ReactDOM.render(
          <PostmanOverlay apiUid={api.uid} blockUid={pageUid} />,
          p
        );
      }
    },
  });
};

export default initializePostman;
