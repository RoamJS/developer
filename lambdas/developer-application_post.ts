import { APIGatewayProxyHandler, APIGatewayProxyResult } from "aws-lambda";
import { dynamo, TableName, userError } from "./common";
import headers from "roamjs-components/backend/headers";
import { awsGetRoamJSUser } from "roamjs-components/backend/getRoamJSUser";
import emailCatch from "roamjs-components/backend/emailCatch";
import sendEmail from "aws-sdk-plus/dist/sendEmail";

export const handler: APIGatewayProxyHandler = awsGetRoamJSUser<{
  id?: string;
}>(async (user, body) => {
  const { id } = body;
  if (!id) {
    return userError("Extension Id is required is required");
  }

  return dynamo
    .getItem({ TableName, Key: { id: { S: id } } })
    .promise()
    .then((r) => {
      if (user.id !== r.Item.user.S) {
        return userError(
          `Extension Id ${id} is not owned by the current user.`
        );
      }
      return dynamo
        .updateItem({
          TableName,
          Key: { id: { S: id } },
          UpdateExpression: "SET #s = :s",
          ExpressionAttributeNames: { "#s": "state" },
          ExpressionAttributeValues: { ":s": { S: "UNDER REVIEW" } },
        })
        .promise()
        .then(() =>
          sendEmail({
            to: "support@roamjs.com",
            subject: "New extension application to become live",
            body: `${user.email} just submitted a new application for the extension ${id}. Check it out at https://roamjs.com/extensions/${id} and let them know if it's ready!`,
            replyTo: user.email,
            from: "support@roamjs.com",
          })
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
    .catch(emailCatch("Request Developer Application"));
});
