import type { APIGatewayProxyHandler } from "aws-lambda";
import type { DynamoDB } from "aws-sdk";
import axios from "axios";
import type { TreeNode, ViewType } from "roamjs-components/types";
import Stripe from "stripe";
import { dynamo, listAll, s3, TableName, userError } from "./common";
import emailCatch from "roamjs-components/backend/emailCatch";
import headers from "roamjs-components/backend/headers";
import { awsGetRoamJSUser } from "roamjs-components/backend/getRoamJSUser";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2020-08-27",
  maxNetworkRetries: 3,
});
const Bucket = "roamjs.com";
const toDoubleDigit = (n: number) => n.toString().padStart(2, "0");
const viewTypeToPrefix = {
  bullet: "- ",
  document: "",
  numbered: "1. ",
};

const updateDynamoEntry = async ({
  path,
  description,
  entry,
  Item,
}: {
  path: string;
  description: string;
  entry: string;
  Item: DynamoDB.AttributeMap;
}) => {
  const updates: { key: string; value: string }[] = [];
  if (description !== Item.description?.S) {
    updates.push({ key: "description", value: description });
  }
  const src = entry || `https://roamjs.com/${path}/main.js`;
  if (src !== Item.src?.S) {
    updates.push({ key: "src", value: src });
  }
  return updates.length
    ? dynamo
        .updateItem({
          TableName,
          Key: {
            id: {
              S: path,
            },
          },
          UpdateExpression: `SET ${updates
            .map(({ key }) => key.slice(0, 1))
            .map((k) => `#${k}=:${k}`)
            .join(", ")}`,
          ExpressionAttributeNames: Object.fromEntries(
            updates.map(({ key }) => [`#${key.slice(0, 1)}`, key])
          ),
          ExpressionAttributeValues: Object.fromEntries(
            updates.map(({ key, value }) => [
              `:${key.slice(0, 1)}`,
              { S: value },
            ])
          ),
        })
        .promise()
    : Promise.resolve();
};

export const handler: APIGatewayProxyHandler = awsGetRoamJSUser<{
  path: string;
  blocks: TreeNode[];
  viewType: ViewType;
  description: string;
  contributors: string[];
  subpages: { [name: string]: { nodes: TreeNode[]; viewType: ViewType } };
  thumbnail?: string;
  entry?: string;
  implementation?: string;
}>(async (user, body) => {
  const {
    path,
    blocks,
    viewType,
    description,
    contributors,
    subpages,
    thumbnail,
    entry,
    implementation,
  } = body;
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
  const paths = await dynamo
    .query({
      TableName,
      IndexName: "user-index",
      KeyConditionExpression: "#u = :u",
      ExpressionAttributeNames: { "#u": "user" },
      ExpressionAttributeValues: { ":u": { S: user.id } },
    })
    .promise()
    .then((r) => r.Items.map((i) => i.id.S))
    .catch((e) =>
      Promise.reject(
        new Error(`Failed to get the user's current extensions: ${e.message}`)
      )
    );
  if (!paths.includes(path)) {
    return {
      statusCode: 403,
      body: `User does not have access to path ${path}`,
      headers,
    };
  }

  const today = new Date();
  const version = `${today.getFullYear()}-${toDoubleDigit(
    today.getMonth() + 1
  )}-${toDoubleDigit(today.getDate())}-${toDoubleDigit(
    today.getHours()
  )}-${toDoubleDigit(today.getMinutes())}`;

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
        /{{(?:\[\[)?video(?:\]\])?:(?:\s)*([^\s]+)(?:\s)*}}/g,
        (_, id) => `<DemoVideo src={"${id}"} />`
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
      .replace(/{{premium}}/g, "<Premium />")
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

  const subpageKeys = new Set(
    Object.keys(subpages).map(
      (p) => `markdown/${path}/${p.replace(/ /g, "_").toLowerCase()}.md`
    )
  );
  return s3
    .upload({
      Bucket,
      Key: `markdown-version-cache/${path}/${version}.json`,
      Body: JSON.stringify(body),
      ContentType: "application/json",
    })
    .promise()
    .then(() =>
      dynamo
        .getItem({
          TableName,
          Key: {
            id: {
              S: path,
            },
          },
        })
        .promise()
    )
    .then(({ Item }) =>
      Promise.all([
        updateDynamoEntry({
          Item,
          description,
          path,
          entry,
        }),
        listAll(`markdown/${path}/`)
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
                  Body:
                    blocks.length === 1 && blocks[0].text.includes("github.com")
                      ? blocks[0].text
                      : blocks
                          .map((b) => blockToMarkdown(b, viewType))
                          .join(""),
                  ContentType: "text/markdown",
                })
                .promise(),
              ...Object.keys(subpages).map((p) =>
                s3
                  .upload({
                    Bucket,
                    Key: `markdown/${path}/${p
                      .replace(/ /g, "_")
                      .toLowerCase()}.md`,
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
            ]).then((r) =>
              axios
                .post(
                  `https://api.github.com/repos/dvargas92495/roam-js-extensions/actions/workflows/isr.yaml/dispatches`,
                  { ref: "main", inputs: { extension: path } },
                  {
                    headers: {
                      Accept: "application/vnd.github.inertia-preview+json",
                      Authorization: `Basic ${Buffer.from(
                        `dvargas92495:${
                          process.env.ROAMJS_RELEASE_TOKEN ||
                          process.env.GITHUB_TOKEN
                        }`
                      ).toString("base64")}`,
                    },
                  }
                )
                .then(() => ({
                  etag: r[0].ETag,
                }))
                .catch((e) =>
                  Promise.reject(
                    new Error(`Failed to redeploy RoamJS: ${e.message}`)
                  )
                )
            )
          ),
      ])
    )
    .then(() => {
      if (implementation && !entry) {
        const fileName = "main.js";
        const Key = `${path}/${fileName}`;
        const uploadProps = {
          Bucket: "roamjs.com",
          ContentType: "text/javascript",
        };
        return Promise.all([
          s3
            .putObject({
              Key: `${path}/${version}/${fileName}`,
              ...uploadProps,
              Body: implementation,
            })
            .promise()
            .catch((e: Error) =>
              Promise.reject(
                new Error(`Failed to publish versioned extension: ${e.message}`)
              )
            ),
          s3
            .putObject({
              Key,
              ...uploadProps,
              Body: implementation,
            })
            .promise()
            .catch((e: Error) =>
              Promise.reject(
                new Error(`Failed to publish versioned extension: ${e.message}`)
              )
            ),
          ,
        ]);
      }
    })
    .then(() => ({
      statusCode: 200,
      body: JSON.stringify({ success: true }),
      headers,
    }))
    .catch(emailCatch(`Failed to publish documentation for ${path}.`));
});
