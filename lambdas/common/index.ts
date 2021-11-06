import AWS from "aws-sdk";
import axios from "axios";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

export const headers = {
  "Access-Control-Allow-Origin": "https://roamresearch.com",
};

export const userError = (body: string): APIGatewayProxyResult => ({
  statusCode: 400,
  body,
  headers,
});

const credentials = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
};

export const dynamo = new AWS.DynamoDB({
  apiVersion: "2012-08-10",
  credentials,
});

export const s3 = new AWS.S3({ apiVersion: "2006-03-01", credentials });
const roamjsHeaders: Record<string, string> = {
  Authorization: process.env.ROAMJS_DEVELOPER_TOKEN,
  "x-roamjs-service": "developer",
};
export const ses = new AWS.SES({ apiVersion: "2010-12-01", credentials });
if (process.env.NODE_ENV === "development") {
  roamjsHeaders["x-roamjs-dev"] = "true";
}

type DeveloperMetadata = { paths: string[] };

export const getRoamJSUser = (event: Pick<APIGatewayProxyEvent, "headers">) =>
  axios.get<DeveloperMetadata>(`https://api.roamjs.com/user`, {
    headers: {
      "x-roamjs-token":
        event.headers.Authorization || event.headers.authorization,
      ...roamjsHeaders,
    },
  });

export const putRoamJSUser = (
  event: Pick<APIGatewayProxyEvent, "headers">,
  data: DeveloperMetadata
) =>
  axios.put(`https://api.roamjs.com/user`, data, {
    headers: {
      "x-roamjs-token":
        event.headers.Authorization || event.headers.authorization,
      ...roamjsHeaders,
    },
  });

export const listAll = async (
  Prefix: string
): Promise<{
  objects: AWS.S3.ObjectList;
  prefixes: AWS.S3.CommonPrefixList;
}> => {
  const objects: AWS.S3.ObjectList = [];
  const prefixes: AWS.S3.CommonPrefixList = [];
  let ContinuationToken: string = undefined;
  let isTruncated = true;
  while (isTruncated) {
    const res = await s3
      .listObjectsV2({
        Bucket: "roamjs.com",
        Prefix,
        ContinuationToken,
        Delimiter: "/",
      })
      .promise();
    objects.push(...res.Contents);
    prefixes.push(...res.CommonPrefixes);
    ContinuationToken = res.ContinuationToken;
    isTruncated = res.IsTruncated;
  }
  return { objects, prefixes };
};

export const emailError = (subject: string, e: Error): Promise<string> =>
  ses
    .sendEmail({
      Destination: {
        ToAddresses: ["dvargas92495@gmail.com"],
      },
      Message: {
        Body: {
          Text: {
            Charset: "UTF-8",
            Data: `An error was thrown in a RoamJS lambda:

${e.name}: ${e.message}
${e.stack}`,
          },
        },
        Subject: {
          Charset: "UTF-8",
          Data: `RoamJS Error: ${subject}`,
        },
      },
      Source: "support@roamjs.com",
    })
    .promise()
    .then((r) => r.MessageId);

export const emailCatch =
  (subject: string) =>
  (e: Error): Promise<APIGatewayProxyResult> =>
    emailError(subject, e).then((id) => ({
      statusCode: 500,
      body: `Unknown error - Message Id ${id}`,
      headers,
    }));
