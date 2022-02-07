import { APIGatewayProxyHandler } from "aws-lambda";
import {
  dynamo,
  getRoamJSUser,
  headers,
  listAll,
  putRoamJSUser,
  s3,
  userError,
} from "./common";

export const handler: APIGatewayProxyHandler = async (event) => {
  const { path } = JSON.parse(event.body || "{}") as { path?: string };
  if (!path) {
    return userError("Path is required");
  }

  if (!/^[a-z][a-z0-9-]*$/.test(path)) {
    return userError(
      "Invalid path: must consist of only lowercase letters, numbers, and dashes, starting with a letter"
    );
  }

  const available = listAll(path).then(
    (r) => !r.objects.length && !r.prefixes.length
  );
  if (!available) {
    return userError("Requested path is not available");
  }

  await s3
    .putObject({
      Bucket: "roamjs.com",
      Key: `${path}/index`,
      Body: "lock",
    })
    .promise();

  return getRoamJSUser(event)
    .then((r) => {
      const paths = [...(r.data.paths || []), path];
      return putRoamJSUser(event, { paths }).then(() => paths);
    })
    .then((paths) =>
      dynamo
        .putItem({
          TableName: "RoamJSExtensions",
          Item: {
            id: {
              S: path,
            },
            description: {
              S: "",
            },
            state: {
              S: "DEVELOPMENT",
            },
          },
        })
        .promise()
        .then(() => paths)
    )
    .then((paths) => ({
      statusCode: 200,
      body: JSON.stringify({ paths }),
      headers,
    }))
    .catch((e) => ({
      statusCode: 500,
      body: e.message,
    }));
};
