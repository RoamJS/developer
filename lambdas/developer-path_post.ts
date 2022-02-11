import { APIGatewayProxyHandler } from "aws-lambda";
import { dynamo, listAll, s3, userError } from "./common";
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

  if (!/^[a-z][a-z0-9-]*$/.test(path)) {
    return userError(
      "Invalid path: must consist of only lowercase letters, numbers, and dashes, starting with a letter"
    );
  }

  const available = await listAll(path).then(
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

  const paths = [...(user.paths as string[] || []), path];
  return putRoamJSUser(user.token, { paths })
    .then(() =>
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
    )
    .then(() => ({
      statusCode: 200,
      body: JSON.stringify({ paths }),
      headers,
    }))
    .catch(emailCatch('Request Developer Path'));
});
