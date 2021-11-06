import { APIGatewayProxyHandler } from "aws-lambda";
import {
  emailCatch,
  getRoamJSUser,
  headers,
  putRoamJSUser,
  s3,
  userError,
} from "./common";

export const handler: APIGatewayProxyHandler = async (event) => {
  const { path } = event.queryStringParameters as { path?: string };
  if (!path) {
    return userError("Path is required");
  }
  const Objects = await s3
    .listObjectsV2({ Bucket: "roamjs.com", Prefix: path })
    .promise()
    .then((r) => r.Contents.map((c) => ({ Key: c.Key })));
  if (Objects.length === 0) {
    return userError("Requested path is not being used");
  }

  await s3
    .deleteObjects({ Bucket: "roamjs.com", Delete: { Objects } })
    .promise();

  return getRoamJSUser(event)
    .then(({ data }) => {
      const paths = (data.paths || []).filter((p) => p !== path);
      return putRoamJSUser(event, { paths }).then(() => ({
        statusCode: 200,
        body: JSON.stringify({ paths }),
        headers,
      }));
    })
    .catch(emailCatch("Error Deleting Path"));
};
