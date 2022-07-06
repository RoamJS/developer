import apiGet from "roamjs-components/util/apiGet";

export type Extension = {
  id: string;
  state: "LIVE" | "DEVELOPMENT" | "UNDER REVIEW" | "PRIVATE";
};

const paths: { cache: Set<string>; extensions: Extension[]; prefix: string } = {
  cache: new Set(),
  extensions: [],
  prefix: "",
};

export const refreshPaths = () =>
  apiGet<{ extensions: Extension[] }>("developer-path")
    .then((r) => {
      paths.cache = new Set(r.extensions.map((e) => e.id));
      paths.extensions = r.extensions;
    })
    .catch(() => {
      // email roamjs
    });

export const hasPath = (title: string) =>
  paths.cache.has(`${paths.prefix}${title}`);
export const getExtensions = () => paths.extensions;
