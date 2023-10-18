import { createConfigObserver } from "roamjs-components/components/ConfigPage";
import FlagPanel from "roamjs-components/components/ConfigPanels/FlagPanel";
import NumberPanel from "roamjs-components/components/ConfigPanels/NumberPanel";
import TextPanel from "roamjs-components/components/ConfigPanels/TextPanel";
import createBlockObserver from "roamjs-components/dom/createBlockObserver";
import createHTMLObserver from "roamjs-components/dom/createHTMLObserver";
import createIconButton from "roamjs-components/dom/createIconButton";
import updateBlock from "roamjs-components/writes/updateBlock";
import {
  Dialog,
  Classes,
  Label,
  RadioGroup,
  Radio,
  Spinner,
  Button,
  NumericInput,
  Icon,
  Checkbox,
  InputGroup,
} from "@blueprintjs/core";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import getSettingIntFromTree from "roamjs-components/util/getSettingIntFromTree";
import MenuItemSelect from "roamjs-components/components/MenuItemSelect";
import getSettingValueFromTree from "roamjs-components/util/getSettingValueFromTree";
import getUids from "roamjs-components/dom/getUids";
import getPageTitleByBlockUid from "roamjs-components/queries/getPageTitleByBlockUid";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getParentUidByBlockUid from "roamjs-components/queries/getParentUidByBlockUid";
import getShallowTreeByParentUid from "roamjs-components/queries/getShallowTreeByParentUid";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import { InputTextNode } from "roamjs-components/types";
import toFlexRegex from "roamjs-components/util/toFlexRegex";
import createBlock from "roamjs-components/writes/createBlock";
import deleteBlock from "roamjs-components/writes/deleteBlock";
import getPageTitleReferencesByPageTitle from "roamjs-components/queries/getPageTitleReferencesByPageTitle";
import getFullTreeByParentUid from "roamjs-components/queries/getFullTreeByParentUid";
import apiGet from "roamjs-components/util/apiGet";
import extractTag from "roamjs-components/util/extractTag";
import renderOverlay from "roamjs-components/util/renderOverlay";
import addStyle from "roamjs-components/dom/addStyle";
import getFirstChildUidByBlockUid from "roamjs-components/queries/getFirstChildUidByBlockUid";
import getSubTree from "roamjs-components/util/getSubTree";
import getCodeFromBlock from "../utils/getCodeFromBlock";

// https://github.com/spamscanner/url-regex-safe/blob/master/src/index.js
const protocol = `(?:https?://)`;
const host = "(?:(?:[a-z\\u00a1-\\uffff0-9][-_]*)*[a-z\\u00a1-\\uffff0-9]+)";
const domain = "(?:\\.(?:[a-z\\u00a1-\\uffff0-9]-*)*[a-z\\u00a1-\\uffff0-9]+)*";
const tld = `(?:\\.(?:[a-z\\u00a1-\\uffff]{2,}))`;
const port = "(?::\\d{2,5})?";
const path = "(?:[/?#][^\\s\"\\)']*)?";
const regex = `(?:${protocol}|www\\.)(?:${host}${domain}${tld})${port}${path}`;
const URL_REGEX = new RegExp(regex, "ig");

type PageResult = { description: string; id: string; label: string };
const OUTPUT_FORMATS = ["Parent", "Line", "Table"] as const;
export type OutputFormat = (typeof OUTPUT_FORMATS)[number];
export type RenderProps = {
  queriesCache: {
    [uid: string]: {
      query: string;
      source: string;
      outputFormat: OutputFormat;
    };
  };
  parentUid: string;
  blockUid: string;
};

export const DEFAULT_EXPORT_LABEL = "SPARQL Import";
export const getLabel = ({
  outputFormat,
  label,
}: {
  outputFormat: OutputFormat;
  label: string;
}): string =>
  `${label.replace("{date}", new Date().toLocaleString())} ${
    outputFormat === "Table" ? "{{[[table]]}}" : ""
  }`;

const PAGE_QUERY = `SELECT ?property ?propertyLabel ?value ?valueLabel {QUALIFIER_SELECT}{
  VALUES (?id) {(wd:{ID})}
  
  ?id ?p ?statement .
  ?statement ?ps ?value .
  
  ?property wikibase:claim ?p.
  ?property wikibase:statementProperty ?ps.

{QUALIFIER_QUERY}  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
} 
ORDER BY ?property ?statement ?value
LIMIT {LIMIT}`;

const WIKIDATA_ITEMS = [
  "Current Page",
  "Current Block",
  "Custom Query",
] as const;
const LIMIT_REGEX = /LIMIT ([\d]*)/;
const IMAGE_REGEX_URL =
  /(http(s?):)([/|.|\w|\s|\-|:|%])*\.(?:jpg|gif|png|svg)/i;
const WIKIDATA_SOURCE =
  "https://query.wikidata.org/bigdata/namespace/wdq/sparql?format=json&query=";

const combineTextNodes = (nodes: InputTextNode[] = []) =>
  nodes
    .sort(({ text: a }, { text: b }) => a.localeCompare(b))
    .map((node, i, arr) => {
      const firstIndex = arr.findIndex((n) => n.text === node.text);
      if (i > firstIndex) {
        const { children } = arr[firstIndex];
        if (children) children.push(...(node.children || []));
        node.text = "";
        node.children = [];
      }
      return node;
    })
    .filter((node) => !!node.text || !!node.children?.length)
    .map((node) => {
      node.children = combineTextNodes(node.children);
      return node;
    });

type SparqlResult = {
  results: {
    bindings: {
      [k: string]: { value: string; type: string };
    }[];
  };
  head: {
    vars: string[];
  };
};

export const runSparqlQuery = ({
  query,
  source,
  parentUid,
  outputFormat,
}: {
  parentUid: string;
} & RenderProps["queriesCache"][string]): Promise<void> =>
  apiGet<{
    data: string;
  }>({ href: `${source}${encodeURIComponent(query)}`, anonymous: true }).then(
    (r) => {
      const dataContents: SparqlResult = JSON.parse(r.data);
      const data = dataContents.results.bindings;
      if (data.length) {
        const head = dataContents.head.vars as string[];
        const loadingUid = createBlock({
          node: {
            text: "Loading...",
          },
          parentUid,
        });
        setTimeout(() => {
          const dataLabels = head.filter((h) => !/Label$/.test(h));
          const returnedLabels = new Set(head.filter((h) => /Label$/.test(h)));
          const formatValue = (
            p: { [h: string]: { value: string; type: string } },
            h: string
          ) => {
            const valueKey = returnedLabels.has(`${h}Label`) ? `${h}Label` : h;
            const s = p[valueKey]?.value;
            return !s
              ? ""
              : IMAGE_REGEX_URL.test(s)
              ? `![](${s})`
              : URL_REGEX.test(s)
              ? `[${s}](${s})`
              : returnedLabels.has(`${h}Label`) &&
                /entity\/P\d*$/.test(p[h].value)
              ? `${s}::`
              : /^\d+$/.test(s)
              ? s
              : !isNaN(new Date(s).valueOf())
              ? `[[${window.roamAlphaAPI.util.dateToPageTitle(new Date(s))}]]`
              : p[h].type === "uri"
              ? `[[${s}]]`
              : s;
          };
          const output = [
            ...(outputFormat === "Table"
              ? [
                  dataLabels
                    .slice()
                    .reverse()
                    .reduce(
                      (prev, cur) => ({
                        text: cur,
                        children: prev.text ? [prev] : [],
                      }),
                      {
                        text: "",
                        children: [] as InputTextNode[],
                      }
                    ),
                ]
              : ([] as InputTextNode[])),
            ...combineTextNodes(
              data.map((p) =>
                outputFormat === "Line"
                  ? {
                      text: dataLabels.map((h) => formatValue(p, h)).join(" "),
                      children: [] as InputTextNode[],
                    }
                  : dataLabels
                      .slice()
                      .reverse()
                      .reduce(
                        (prev, cur) => ({
                          text: formatValue(p, cur),
                          children: prev.text ? [prev] : [],
                        }),
                        {
                          text: "",
                          children: [] as InputTextNode[],
                        }
                      )
              )
            ),
          ];
          output.forEach((node, order) =>
            createBlock({ node, order, parentUid })
          );
          const titlesSet = new Set(
            getPageTitleReferencesByPageTitle("same as")
          );
          setTimeout(() => {
            Object.entries(
              Object.fromEntries(
                data
                  .flatMap((p) =>
                    Array.from(returnedLabels)
                      .map((h) => ({
                        link: p[h.replace(/Label$/, "")]?.value,
                        title: p[h]?.value,
                      }))
                      .filter(({ link, title }) => !!link && !!title)
                  )
                  .filter(
                    ({ title }) =>
                      !titlesSet.has(title) && !IMAGE_REGEX_URL.test(title)
                  )
                  .map(({ title, link }) => [title, link])
              )
            ).forEach(([title, link]) =>
              createBlock({
                node: {
                  text: `same as:: ${link}`,
                },
                parentUid: getPageUidByPageTitle(title),
              })
            );
          }, 1);
        }, 1);
        loadingUid.then(deleteBlock);
      } else {
        createBlock({
          node: {
            text: "No results found",
          },
          parentUid,
        });
      }
    }
  );

const SparqlQuery = ({
  onClose,
  queriesCache,
  parentUid,
  blockUid: _blockUid,
}: {
  onClose: () => void;
} & RenderProps): React.ReactElement => {
  const configUid = useMemo(() => getPageUidByPageTitle("roam/js/sparql"), []);

  const pageTitle = useMemo(
    () => getPageTitleByPageUid(parentUid) || getPageTitleByBlockUid(parentUid),
    [parentUid]
  );
  const cursorBlockUid = useMemo(
    () => (getTextByBlockUid(parentUid) ? parentUid : _blockUid),
    [parentUid, _blockUid]
  );
  const cursorBlockString = useMemo(
    () => extractTag(getTextByBlockUid(cursorBlockUid)),
    [cursorBlockUid]
  );
  const blockUid = useMemo(
    () =>
      cursorBlockString
        ? cursorBlockUid
        : getParentUidByBlockUid(cursorBlockUid),
    [cursorBlockString, cursorBlockUid]
  );
  const blockString = useMemo(
    () => extractTag(getTextByBlockUid(blockUid)),
    [blockUid]
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeItem, setActiveItem] = useState<(typeof WIKIDATA_ITEMS)[number]>(
    WIKIDATA_ITEMS[0]
  );
  const [radioValue, setRadioValue] = useState("");
  const [showAdditionalOptions, setShowAdditionalOptions] = useState(false);
  const toggleAdditionalOptions = useCallback(
    () => setShowAdditionalOptions(!showAdditionalOptions),
    [setShowAdditionalOptions, showAdditionalOptions]
  );
  const importTree = useMemo(
    () =>
      getFullTreeByParentUid(configUid).children.find((t) =>
        toFlexRegex("import").test(t.text)
      )?.children || [],
    [configUid]
  );

  const [customQueryUid, setCustomQueryUid] = useState("");

  useEffect(() => {
    const currentCustomQueryParent = getSubTree({
      key: "customQuery",
      parentUid: configUid,
    });

    if (!currentCustomQueryParent.children.length) {
      createBlock({
        node: {
          text: "```sparql```",
        },
        parentUid: currentCustomQueryParent.uid,
      }).then((uid) => setCustomQueryUid(uid));
    } else {
      setCustomQueryUid(currentCustomQueryParent.children[0].uid);
    }
  }, [configUid]);

  const [label, setLabel] = useState(
    getSettingValueFromTree({
      tree: importTree,
      key: "default label",
      defaultValue: DEFAULT_EXPORT_LABEL,
    })
  );
  const [dataSource, setDataSource] = useState<string>(WIKIDATA_SOURCE);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("Parent");
  const [limit, setLimit] = useState(
    getSettingIntFromTree({
      tree: importTree,
      key: "default limit",
      defaultValue: 10,
    })
  );
  const [saveQuery, setSaveQuery] = useState(false);
  const [importQualifiers, setImportQualifiers] = useState(
    importTree.some((t) => toFlexRegex("qualifiers").test(t.text))
  );
  const query = useMemo(() => {
    if (activeItem === "Current Page" || activeItem === "Current Block") {
      return PAGE_QUERY.replace("{ID}", radioValue)
        .replace("{LIMIT}", `${limit}`)
        .replace(
          "{QUALIFIER_SELECT}",
          importQualifiers
            ? "?qualifierProperty ?qualifierPropertyLabel ?qualifierValue ?qualifierValueLabel "
            : ""
        )
        .replace(
          "{QUALIFIER_QUERY}",
          importQualifiers
            ? `  OPTIONAL {
          ?statement ?pq ?qualifierValue .
          ?qualifierProperty wikibase:qualifier ?pq .
        }
        
`
            : ""
        );
    }
    return "";
  }, [radioValue, activeItem, limit, importQualifiers]);
  const [pageResults, setPageResults] = useState<PageResult[]>([]);
  const searchQuery = useMemo(
    () => (activeItem === "Current Block" ? blockString : pageTitle),
    [activeItem, blockString, pageTitle]
  );
  const dropdownRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    dropdownRef.current?.focus?.();
    if (searchQuery) {
      apiGet<{ search: PageResult[] }>({
        href: `https://www.wikidata.org/w/api.php?origin=*&action=wbsearchentities&format=json&limit=5&continue=0&language=en&uselang=en&search=${searchQuery}&type=item`,
        anonymous: true,
      }).then((r) =>
        setPageResults(
          r.search.map((i: PageResult) => ({
            description: i.description,
            id: i.id,
            label: i.label,
          }))
        )
      );
    } else {
      setPageResults([]);
    }
  }, [dropdownRef, setPageResults, searchQuery]);
  const catchImport = useCallback(
    (e: Error) => {
      console.error(e);
      setError(
        "Unknown error occured when querying. Contact support@roamjs.com for help!"
      );
      setLoading(false);
    },
    [setLoading, setError]
  );

  const CustomQueryEmbed = ({ uid }: { uid: string }) => {
    const contentRef = useRef(null);
    useEffect(() => {
      const el = contentRef.current;
      if (el) {
        window.roamAlphaAPI.ui.components.renderBlock({
          uid,
          el,
        });
      }
    }, [contentRef]);
    return <div className="roamjs-customquery-embed" ref={contentRef}></div>;
  };
  return (
    <Dialog
      isOpen={true}
      onClose={onClose}
      title={"SPARQL Import"}
      canEscapeKeyClose
      canOutsideClickClose
      autoFocus={false}
      enforceFocus={false}
    >
      <div className={Classes.DIALOG_BODY}>
        <Label>
          Query Type
          <MenuItemSelect
            items={[...WIKIDATA_ITEMS]}
            onItemSelect={(s) => {
              setActiveItem(s);
              setDataSource(WIKIDATA_SOURCE);
            }}
            activeItem={activeItem}
            ButtonProps={{ elementRef: dropdownRef }}
          />
        </Label>
        {(activeItem === "Current Page" || activeItem === "Current Block") && (
          <>
            <RadioGroup
              onChange={(e) =>
                setRadioValue((e.target as HTMLInputElement).value)
              }
              selectedValue={radioValue}
            >
              {pageResults.map((pr) => (
                <Radio
                  key={pr.id}
                  value={pr.id}
                  labelElement={
                    <span>
                      <b>{pr.label}</b>
                      <span style={{ fontSize: 10 }}> ({pr.description})</span>
                    </span>
                  }
                />
              ))}
            </RadioGroup>
            {!pageResults.length && (
              <div>No results found for {searchQuery}</div>
            )}
          </>
        )}
        {activeItem === "Custom Query" && (
          <div style={{ marginTop: 16 }} className={"roamjs-sparql-editor"}>
            <div>
              <CustomQueryEmbed uid={currentCustomQueryTree[0].uid} />
            </div>
            {/* <CodeMirror
              value={codeValue}
              options={{
                mode: { name: "sparql" },
                lineNumbers: true,
                lineWrapping: true,
              }}
              onBeforeChange={(_, __, v) => setCodeValue(v)}
            /> */}
            <span style={{ marginTop: 8, display: "inline-block" }}>
              <Label>
                SPARQL Endpoint
                <InputGroup
                  value={dataSource}
                  onChange={(e) => setDataSource(e.target.value)}
                />
              </Label>
            </span>
          </div>
        )}
        {showAdditionalOptions && (
          <div style={{ marginTop: 16 }}>
            <Label>
              Label
              <InputGroup
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </Label>
            <Label>
              Limit
              <NumericInput value={limit} onValueChange={setLimit} />
            </Label>
            <Label>
              Output Format
              <MenuItemSelect
                activeItem={outputFormat}
                items={[...OUTPUT_FORMATS]}
                onItemSelect={(s) => setOutputFormat(s)}
              />
            </Label>
            <Checkbox
              label={"Save Query"}
              checked={saveQuery}
              onChange={(e) =>
                setSaveQuery((e.target as HTMLInputElement).checked)
              }
            />
            {activeItem !== "Custom Query" && (
              <Checkbox
                label={"Import Qualifiers"}
                checked={importQualifiers}
                onChange={(e) =>
                  setImportQualifiers((e.target as HTMLInputElement).checked)
                }
              />
            )}
          </div>
        )}
        <style>
          {`.roamjs-sparql-options-toggle {
  cursor: pointer;
  color: blue;
  margin-top: 8px;
  display: inline-block;
}

.roamjs-sparql-options-toggle:hover {
    text-decoration: 'underline';
  }`}
        </style>
        <span
          className={"roamjs-sparql-options-toggle"}
          onClick={toggleAdditionalOptions}
        >
          <Icon icon={showAdditionalOptions ? "caret-up" : "caret-down"} />
          {showAdditionalOptions ? "Hide" : "Show"} additional options
        </span>
      </div>
      <div className={Classes.DIALOG_FOOTER}>
        <div className={Classes.DIALOG_FOOTER_ACTIONS}>
          <span style={{ color: "darkred" }}>{error}</span>
          {loading && <Spinner size={Spinner.SIZE_SMALL} />}
          <Button
            text={"Import"}
            disabled={activeItem === "Custom Query" ? false : !radioValue}
            onClick={async () => {
              setLoading(true);
              const importParentUid =
                activeItem === "Current Page" ? parentUid : blockUid;
              const isQuery = activeItem === "Custom Query";
              if (!isQuery) {
                createBlock({
                  parentUid: importParentUid,
                  node: {
                    text: `same as:: http://www.wikidata.org/entity/${radioValue}`,
                  },
                });
              }
              // get custom query at time of submit
              const customQuery = isQuery
                ? getCodeFromBlock(getTextByBlockUid(customQueryUid))
                : "";

              const labelUid = await createBlock({
                node: {
                  text: getLabel({ outputFormat, label }),
                },
                parentUid: importParentUid,
                order: isQuery ? 0 : 1,
              });
              const queryInfo = {
                query: isQuery ? customQuery : query,
                source: dataSource,
                outputFormat,
              };
              if (saveQuery) {
                const configUid = getPageUidByPageTitle("roam/js/sparql");

                const queriesUid =
                  getShallowTreeByParentUid(configUid).find(({ text }) =>
                    /queries/i.test(text)
                  )?.uid ||
                  createBlock({
                    node: { text: "queries" },
                    parentUid: configUid,
                  });

                createBlock({
                  node: {
                    text: labelUid,
                    children: [
                      { text: query },
                      { text: queryInfo.source },
                      { text: outputFormat },
                    ],
                  },
                  parentUid: await queriesUid,
                });
                queriesCache[labelUid] = queryInfo;
              }
              runSparqlQuery({
                ...queryInfo,
                parentUid: labelUid,
              })
                .then(() => {
                  onClose();
                })
                .catch(catchImport);
            }}
          />
        </div>
      </div>
    </Dialog>
  );
};

export const render = (props: RenderProps): void => {
  renderOverlay({
    id: "roamjs-sparql-query",
    Overlay: SparqlQuery,
    props,
  });
};

const ID = "sparql";
const CONFIG = `roam/js/${ID}`;
const queriesCache: RenderProps["queriesCache"] = {};

const initializeSparql = () => {
  addStyle(`.roamjs-sparql-editor .cmt-comment {
    color: #72777d;
  }
  
  .roamjs-sparql-editor .cmt-keyword {
    color: #b32424;
  }
  
  .roamjs-sparql-editor .cmt-variable-2 {
    color: #14866d;
  }
  
  .roamjs-sparql-editor .cmt-atom {
    color: #2a4b8d;
  }
  
  .roamjs-sparql-editor .cmt-string {
    color: #ac6600;
  }
  
  .roamjs-sparql-editor .cmt-bracket {
    color: inherit;
  }
  
  .roamjs-sparql-editor .cmt-operator {
    color: inherit;
  }`);

  // TODO - Migrate to roam depot settings
  createConfigObserver({
    title: CONFIG,
    config: {
      tabs: [
        {
          id: "import",
          fields: [
            {
              // @ts-ignore
              Panel: TextPanel,
              title: "default label",
              description:
                "The default label each Sparql query will have on import",
              defaultValue: DEFAULT_EXPORT_LABEL,
            },
            {
              // @ts-ignore
              Panel: NumberPanel,
              title: "default limit",
              description:
                "The default limit each Sparql query will have on import",
              defaultValue: 10,
            },
            {
              // @ts-ignore
              Panel: FlagPanel,
              title: "qualifiers",
              description:
                "Whether sparql queries for blocks and pages should import qualifiers by default",
            },
          ],
        },
      ],
    },
  });

  const queryUid = getShallowTreeByParentUid(
    getPageUidByPageTitle(CONFIG)
  ).find(({ text }) => toFlexRegex("queries").test(text))?.uid;
  if (queryUid) {
    getShallowTreeByParentUid(queryUid).forEach(({ uid, text }) => {
      const cache = getShallowTreeByParentUid(uid);
      queriesCache[text] = {
        query: cache[0]?.text,
        source: cache[1]?.text,
        outputFormat: cache[2]?.text as OutputFormat,
      };
    });
  }
  createBlockObserver((b) => {
    if (!b.hasAttribute("roamjs-sparql-update-button")) {
      b.setAttribute("roamjs-sparql-update-button", "true");
      const { blockUid } = getUids(b);
      const queryInfo = queriesCache[blockUid];
      if (queryInfo) {
        const updateButton = createIconButton("refresh");
        updateButton.style.float = "right";
        updateButton.onmousedown = (e) => e.stopPropagation();
        updateButton.onclick = () => {
          getShallowTreeByParentUid(blockUid).forEach(({ uid }) =>
            deleteBlock(uid)
          );
          runSparqlQuery({ ...queryInfo, parentUid: blockUid });
          updateBlock({
            uid: blockUid,
            text: getLabel({
              outputFormat: queryInfo.outputFormat,
              label: getTextByBlockUid(blockUid).replace(
                /(\d)?\d\/(\d)?\d\/\d\d\d\d, (\d)?\d:\d\d:\d\d [A|P]M/,
                "{date}"
              ),
            }),
          });
        };
        b.appendChild(updateButton);
      }
    }
  });

  window.roamAlphaAPI.ui.commandPalette.addCommand({
    label: "Run SPARQL Query",
    callback: () =>
      window.roamAlphaAPI.ui.mainWindow.getOpenPageOrBlockUid().then(
        (parentUid) =>
          parentUid &&
          render({
            blockUid:
              window.roamAlphaAPI.ui.getFocusedBlock()?.["block-uid"] ||
              getFirstChildUidByBlockUid(parentUid),
            queriesCache,
            parentUid,
          })
      ),
  });

  createHTMLObserver({
    callback: (s: HTMLSpanElement) => {
      if (s.innerText === "sparql") {
        const editor = s.closest(".rm-code-block");
        if (editor && !editor.classList.contains("roamjs-sparql-editor")) {
          editor.classList.add("roamjs-sparql-editor");
        }
      }
    },
    tag: "SPAN",
    className: "bp3-button-text",
  });
};

export default initializeSparql;
