import type { APIGatewayProxyHandler } from "aws-lambda";
import { dynamo, s3, userError } from "./common";
import headers from "roamjs-components/backend/headers";
import { awsGetRoamJSUser } from "roamjs-components/backend/getRoamJSUser";
import putRoamJSUser from "roamjs-components/backend/putRoamJSUser";
import emailCatch from "roamjs-components/backend/emailCatch";

export const handler: APIGatewayProxyHandler = awsGetRoamJSUser<{
  path?: string;
}>(async (user, body) => {
  const { path } = body;
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
    .promise()
    .then(() =>
      dynamo
        .deleteItem({
          TableName: "RoamJSExtensions",
          Key: {
            id: {
              S: path,
            },
          },
        })
        .promise()
    );

  const paths = ((user.paths as string[]) || []).filter((p) => p !== path);
  return putRoamJSUser(user.token, { paths })
    .then(() => ({
      statusCode: 200,
      body: JSON.stringify({ paths }),
      headers,
    }))
    .catch(emailCatch("Error Deleting Path"));
});
