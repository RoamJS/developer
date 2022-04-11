import type { APIGatewayProxyHandler, APIGatewayProxyResult } from "aws-lambda";
import { dynamo, s3, TableName, userError } from "./common";
import headers from "roamjs-components/backend/headers";
import { awsGetRoamJSUser } from "roamjs-components/backend/getRoamJSUser";
import emailCatch from "roamjs-components/backend/emailCatch";

export const handler: APIGatewayProxyHandler = awsGetRoamJSUser<{
  path?: string;
}>(async (user, body) => {
  const { path } = body;
  if (!path) {
    return userError("Path is required");
  }

  return dynamo
    .getItem({ TableName, Key: { id: { S: path } } })
    .promise()
    .then((r) => {
      if (!r.Item) return userError("Requested path is not being used");
      if (r.Item.user?.S !== user.id)
        return userError("User is not authorized to delete this path");
      return dynamo
        .deleteItem({ TableName, Key: { id: { S: path } } })
        .promise()
        .then(() =>
          s3.listObjectsV2({ Bucket: "roamjs.com", Prefix: path }).promise()
        )
        .then((r) => r.Contents.map((c) => ({ Key: c.Key })))
        .then((Objects) =>
          s3
            .deleteObjects({ Bucket: "roamjs.com", Delete: { Objects } })
            .promise()
        )
        .then(
          () =>
            ({
              statusCode: 200,
              body: JSON.stringify({ success: true }),
              headers,
            } as APIGatewayProxyResult)
        );
    })
    .catch(emailCatch("Error Deleting Path"));
});
