import { APIGatewayProxyHandler } from "aws-lambda";
import axios from "axios";
import { TreeNode, ViewType } from "roam-client";
import {
  dynamo,
  emailCatch,
  getRoamJSUser,
  headers,
  listAll,
  s3,
  userError,
} from "./common";

const Bucket = "roamjs.com";
const toDoubleDigit = (n: number) => n.toString().padStart(2, "0");
const viewTypeToPrefix = {
  bullet: "- ",
  document: "",
  numbered: "1. ",
};

export const handler: APIGatewayProxyHandler = async (event) => {
  const userId = event.headers.Authorization;
  const {
    path,
    blocks,
    viewType,
    description,
    contributors,
    subpages,
    thumbnail,
    entry,
    premium,
  } = JSON.parse(event.body || "{}") as {
    path: string;
    blocks: TreeNode[];
    viewType: ViewType;
    description: string;
    contributors: string[];
    subpages: { [name: string]: { nodes: TreeNode[]; viewType: ViewType } };
    thumbnail?: string;
    entry?: string;
    premium?: string[];
  };
  if (blocks.length === 0) {
    return userError(
      'Missing documentation content. Create a "Documentation" block on your extensions page and nest the content under it.'
    );
  }
  if (!description) {
    return userError(
      'Missing extension description. Create a "Description" block on your extensions page and nest the extension description under it.'
    );
  }
  if (description.length > 128) {
    return userError(
      "Description is too long. Please keep it 128 characters or fewer."
    );
  }

  const frontmatter = `---
description: "${description}"${
    contributors?.length ? `\ncontributors: "${contributors.join(", ")}"` : ""
  }${entry ? `\nentry: "${entry}"` : ""}
---

`;

  const today = new Date();
  const version = `${today.getFullYear()}-${toDoubleDigit(
    today.getMonth() + 1
  )}-${toDoubleDigit(today.getDate())}-${toDoubleDigit(
    today.getHours()
  )}-${toDoubleDigit(today.getMinutes())}`;
  await s3
    .upload({
      Bucket,
      Key: `markdown-version-cache/${path}/${version}.json`,
      Body: event.body,
      ContentType: "application/json",
    })
    .promise()
    .then(() =>
      dynamo
        .updateItem({
          TableName: "RoamJSExtensions",
          Key: {
            id: {
              S: path,
            },
          },
          UpdateExpression: "SET #d=:d, #s=:s, #p=:p",
          ExpressionAttributeNames: {
            "#d": "description",
            "#s": "src",
            "#p": "premium",
          },
          ExpressionAttributeValues: {
            ":d": { S: description },
            ":s": { S: entry || `https://roamjs.com/${path}/main.js` },
            ":p": { SS: premium },
          },
        })
        .promise()
    );

  const { paths, stripeAccountId } = await getRoamJSUser(event)
    .then(({ data }) => data)
    .catch(() => ({ paths: [], stripeAccountId: undefined }));
  if (premium.length && !stripeAccountId) {
    return {
      statusCode: 403,
      body: "Need to connect a stripe account id before publishing premium features for an extension",
      headers,
    };
  }

  const replaceComponents = (text: string, prefix: string): string =>
    text
      .replace(
        /{{(?:\[\[)?video(?:\]\])?:(?:\s)*https:\/\/www.loom.com\/share\/([0-9a-f]*)}}/g,
        (_, id) => `<Loom id={"${id}"} />`
      )
      .replace(
        /{{(?:\[\[)?(?:youtube|video)(?:\]\])?:(?:\s)*https:\/\/youtu\.be\/([\w\d-]*)}}/g,
        (_, id) => `<YouTube id={"${id}"} />`
      )
      .replace(
        new RegExp(`\\[(.*?)\\]\\(\\[\\[${path}/(.*?)\\]\\]\\)`, "g"),
        (_, label, page) =>
          `[${label}](/extensions/${path}/${page
            .replace(/ /g, "_")
            .toLowerCase()})`
      )
      .replace(
        new RegExp(`\\[(.*?)\\]\\(\\[\\[${path}\\]\\]\\)`, "g"),
        (_, label) => `[${label}](/extensions/${path})`
      )
      .replace(/\^\^(.*?)\^\^/g, (_, i) => `<Highlight>${i}</Highlight>`)
      .replace(/__/g, "_")
      .replace(new RegExp(String.fromCharCode(160), "g"), " ")
      .replace(/```$/, "\n```")
      .replace(/\n/g, `\n${"".padStart(prefix.length, " ")}`);
  const blockToMarkdown = (
    block: TreeNode,
    viewType: ViewType,
    depth = 0
  ): string => {
    const prefix = `${"".padStart(depth * 4, " ")}${
      viewTypeToPrefix[viewType || "bullet"]
    }`;
    return `${prefix}<Block id={"${block.uid}"}>${"".padStart(
      block.heading,
      "#"
    )}${block.heading > 0 ? " " : ""}${
      block.textAlign === "center" ? "<Center>" : ""
    }${
      /\n/.test(block.text) ? `\n\n${"".padStart(prefix.length)}` : ""
    }${replaceComponents(block.text, prefix)}${
      /\n/.test(block.text) ? `\n\n${"".padStart(prefix.length)}` : ""
    }${
      block.textAlign === "center" ? "</Center>" : ""
    }</Block>\n\n${block.children
      .map((v) =>
        blockToMarkdown(
          v,
          block.viewType,
          viewType === "document" ? depth : depth + 1
        )
      )
      .join("")}${
      viewType === "document" && block.children.length ? "\n" : ""
    }`;
  };

  if (!paths.includes(path)) {
    return {
      statusCode: 401,
      body: `User does not have access to path ${path}`,
      headers,
    };
  }
  const subpageKeys = new Set(
    Object.keys(subpages).map(
      (p) => `markdown/${path}/${p.replace(/ /g, "_").toLowerCase()}.md`
    )
  );
  return listAll(`markdown/${path}/`)
    .then((r) => {
      const Objects = r.objects
        .filter(({ Key }) => !subpageKeys.has(Key))
        .map(({ Key }) => ({ Key }));
      return Objects.length
        ? s3
            .deleteObjects({
              Bucket,
              Delete: {
                Objects,
              },
            })
            .promise()
            .then((r) => {
              console.log(`Deleted ${r.Deleted.length} subpages.`);
            })
        : Promise.resolve();
    })
    .then(() =>
      Promise.all([
        s3
          .upload({
            Bucket,
            Key: `markdown/${path}.md`,
            Body: `${frontmatter}${blocks
              .map((b) => blockToMarkdown(b, viewType))
              .join("")}`,
            ContentType: "text/markdown",
          })
          .promise(),
        ...Object.keys(subpages).map((p) =>
          s3
            .upload({
              Bucket,
              Key: `markdown/${path}/${p.replace(/ /g, "_").toLowerCase()}.md`,
              Body: subpages[p].nodes
                .map((b) => blockToMarkdown(b, subpages[p].viewType))
                .join(""),
              ContentType: "text/markdown",
            })
            .promise()
        ),
        ...(thumbnail
          ? [
              axios
                .get(thumbnail, {
                  responseType: "stream",
                })
                .then((r) =>
                  s3
                    .upload({
                      Bucket,
                      Key: `thumbnails/${path}.png`,
                      Body: r.data,
                      ContentType: "image/png",
                    })
                    .promise()
                ),
            ]
          : []),
      ])
        .then((r) =>
          axios
            .post(
              `https://api.github.com/repos/dvargas92495/roam-js-extensions/actions/workflows/isr.yaml/dispatches`,
              { ref: "master", inputs: { extension: path } },
              {
                headers: {
                  Accept: "application/vnd.github.inertia-preview+json",
                  Authorization: `Basic ${Buffer.from(
                    `dvargas92495:${process.env.ROAMJS_RELEASE_TOKEN}`
                  ).toString("base64")}`,
                },
              }
            )
            .then(() => ({
              etag: r[0].ETag,
            }))
        )
        .then((r) => ({
          statusCode: 200,
          body: JSON.stringify(r),
          headers,
        }))
    )
    .catch(emailCatch(`Failed to publish documentation for ${path}.`));
};
